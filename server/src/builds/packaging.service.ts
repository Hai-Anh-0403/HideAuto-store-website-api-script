/**
 * Turn a stored version + its scrubbed graph into a downloadable mini-app package.
 *
 * Shared by the seller ("repackage my app") and the buyer download path, so both produce
 * byte-identical archives and neither can bypass the licence block.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { NotFoundError, ServiceUnavailableError } from '../common/errors';
import type { Script, ScriptVersion } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { LicenseService } from '../licensing/license.service';
import type { Json } from '../common/graph/workflow-graph';
import {
  buildMiniAppPackage,
  type AppWorkflowEnvelope,
  type BuiltPackage,
  type StoreBlock,
} from './mini-app-builder';

@Injectable()
export class PackagingService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly license: LicenseService,
  ) {}

  /** The scrubbed graph the store persisted for this version. */
  async graphFor(version: ScriptVersion): Promise<Json> {
    if (!version.fileUrl) {
      throw new NotFoundError(
        'artifact_missing',
        'This version has no stored graph',
      );
    }
    const raw = await this.storage.readBytes(version.fileUrl);
    return JSON.parse(raw.toString('utf8')) as Json;
  }

  /** Raw graph download — always available, needs no template. */
  async graphDownload(
    script: Script,
    version: ScriptVersion,
  ): Promise<BuiltPackage> {
    const graph = await this.graphFor(version);
    return {
      body: Buffer.from(JSON.stringify(graph, null, 2), 'utf8'),
      filename: `${script.slug}-${version.version}.json`,
    };
  }

  /**
   * The `store` block embedded in a package. Omitted entirely when licensing is off, so
   * the app falls back to "no key gate" instead of failing to verify against no key.
   */
  private storeBlock(script: Script): StoreBlock | undefined {
    const publicKey = this.license.publicKeyBase64;
    if (!publicKey) return undefined;
    return {
      baseUrl: this.config.get<string>(
        'STORE_PUBLIC_URL',
        'http://localhost:3001',
      ),
      scriptId: script.id,
      sellerName: script.sellerName,
      licensePublicKey: publicKey,
      licenseAlgorithm: 'Ed25519',
    };
  }

  private async template(): Promise<Buffer> {
    const path = this.config.get<string>('MINI_APP_TEMPLATE_PATH', '').trim();
    if (!path) {
      throw new ServiceUnavailableError(
        'template_missing',
        'Mini-app packaging is not configured (MINI_APP_TEMPLATE_PATH is unset) — ' +
          'download the graph instead',
      );
    }
    try {
      return await fs.readFile(path);
    } catch {
      throw new ServiceUnavailableError(
        'template_missing',
        `Mini-app template not found at ${path}`,
      );
    }
  }

  /** Repackage the version into a mini-app archive (template inject). */
  async packageApp(
    script: Script,
    version: ScriptVersion,
    builtAt: Date = new Date(),
  ): Promise<BuiltPackage> {
    const [graph, template] = await Promise.all([
      this.graphFor(version),
      this.template(),
    ]);

    const envelope: AppWorkflowEnvelope = {
      version: 1,
      appName: version.appName ?? script.name,
      appId: version.appId ?? script.slug,
      workflowId: version.id,
      workflowName: script.name,
      builtAt: builtAt.toISOString(),
      workflow: graph,
      store: this.storeBlock(script),
    };

    return buildMiniAppPackage(template, envelope, script.slug);
  }
}
