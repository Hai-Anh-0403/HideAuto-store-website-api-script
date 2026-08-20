/**
 * Buyer downloads: entitlement first, then hand back the artifact.
 *
 * Packaging is reused from the seller path so a buyer and a seller downloading the same
 * version get the same bytes — and so the licence block can never be skipped by asking
 * for the buyer URL instead.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PackagingService } from '../builds/packaging.service';
import { NotFoundError } from '../common/errors';
import { ActivationService } from './activation.service';
import type { BuyerIdentity } from './flowdesk.service';

export interface Download {
  filename: string;
  body: Buffer;
  contentType: string;
}

@Injectable()
export class AppDownloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activation: ActivationService,
    private readonly packaging: PackagingService,
  ) {}

  async forBuyer(
    buyer: BuyerIdentity,
    scriptId: string,
    format: 'exe' | 'graph',
  ): Promise<Download> {
    const { script } = await this.activation.authorize(buyer, scriptId);

    // The version the listing currently sells — which is `latestVersionId`, not simply the
    // newest approved row: rolling back to an older version has to change what buyers get,
    // and the licence the app checks is signed against this same pointer.
    //
    // Only an approved version is ever downloadable; a pending one has not been reviewed
    // and may still carry whatever the seller uploaded. The newest approved row is the
    // fallback for a listing whose pointer was never set.
    const version =
      (script.latestVersionId
        ? await this.prisma.scriptVersion.findFirst({
            where: { id: script.latestVersionId, status: 'APPROVED' },
          })
        : null) ??
      (await this.prisma.scriptVersion.findFirst({
        where: { scriptId, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
      }));
    if (!version) {
      throw new NotFoundError(
        'no_approved_version',
        'This mini app has no approved version to download',
      );
    }

    const built =
      format === 'graph'
        ? await this.packaging.graphDownload(script, version)
        : await this.packaging.packageApp(script, version);

    await this.prisma.script.update({
      where: { id: scriptId },
      data: { downloads: { increment: 1 } },
    });

    return {
      ...built,
      contentType: format === 'graph' ? 'application/json' : 'application/zip',
    };
  }
}
