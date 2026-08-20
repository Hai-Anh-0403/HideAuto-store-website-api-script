import { Injectable, NotFoundException } from '@nestjs/common';
import { ConflictError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PageDto } from '../common/dto/page.dto';
import { readScan } from '../common/graph/workflow-graph';
import { ListSellersDto } from './dto/list-sellers.dto';
import { toStringArray } from '../common/json-array';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sellers ──────────────────────────────────────────────

  async listSellers(dto: ListSellersDto) {
    // Without a status filter the pending queue had to be paged out of every seller who
    // ever registered — the one thing an admin opens this list to do.
    const where: Prisma.SellerWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search } },
        { email: { contains: dto.search } },
        { contact: { contains: dto.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          email: true,
          name: true,
          contact: true,
          status: true,
          statusReason: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { scripts: true, members: true, keys: true } },
        },
      }),
      this.prisma.seller.count({ where }),
    ]);

    return new PageDto(items, total, dto.skip, dto.limit);
  }

  approveSeller(sellerId: string) {
    return this.decideSeller(sellerId, 'APPROVED');
  }

  rejectSeller(sellerId: string, reason?: string) {
    return this.decideSeller(sellerId, 'REJECTED', reason);
  }

  suspendSeller(sellerId: string, reason?: string) {
    return this.decideSeller(sellerId, 'SUSPENDED', reason);
  }

  /**
   * Move a seller account between states, recording *why*.
   *
   * A rejection with no reason leaves the seller with a dead account and no idea what to
   * fix, so the reason is stored on the account and shown to them. Approving clears it.
   */
  private async decideSeller(
    sellerId: string,
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    reason?: string,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    if (seller.status === status) {
      throw new ConflictError(
        'seller_status_unchanged',
        `Seller is already ${status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        status,
        statusReason: status === 'APPROVED' ? null : (reason ?? null),
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        statusReason: true,
        updatedAt: true,
      },
    });

    // A suspended or rejected seller should not keep a live portal session.
    if (status !== 'APPROVED') {
      await this.prisma.sellerSession.deleteMany({ where: { sellerId } });
    }

    return updated;
  }

  // ── Scripts ──────────────────────────────────────────────

  /**
   * The review queue.
   *
   * Keyed on the *version*, not the script's own status: an update to an app that is
   * already PUBLISHED leaves the script PUBLISHED, and those versions used to sit in the
   * queue forever without ever being listed.
   *
   * Each row carries the scan and capabilities of the version waiting — approving without
   * seeing the credential count or whether the graph shells out is exactly the decision
   * this endpoint exists to prevent.
   */
  async listPendingScripts(pagination: PaginationDto) {
    const where: Prisma.ScriptWhereInput = {
      versions: { some: { status: 'PENDING_REVIEW' } },
      // ...and the seller actually offered it. A brand-new listing writes its first version
      // as PENDING_REVIEW while the script is still DRAFT, so keying on the version alone
      // would queue half-finished shells and make `submit()` decorative.
      status: { in: ['PENDING_REVIEW', 'PUBLISHED'] },
    };

    const [items, total] = await Promise.all([
      this.prisma.script.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          tags: { select: { id: true, name: true, slug: true, color: true } },
          seller: { select: { id: true, name: true, email: true, status: true } },
          versions: {
            where: { status: 'PENDING_REVIEW' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              version: true,
              changelog: true,
              nodeCount: true,
              nodeGroupsUsed: true,
              capabilities: true,
              scan: true,
              graphExtracted: true,
              delivery: true,
              sourceFilename: true,
              minAppVersion: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.script.count({ where }),
    ]);

    return new PageDto(items, total, pagination.skip, pagination.limit);
  }

  async approveVersion(versionId: string, adminId: string) {
    const version = await this.prisma.scriptVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException('Script version not found');
    }

    if (version.status !== 'PENDING_REVIEW') {
      throw new ConflictError(
        'version_decided',
        'This version has already been approved or rejected',
      );
    }

    // Nothing to sell: a version with no stored artifact would publish a listing whose
    // download 404s and whose package cannot be built.
    if (!version.fileUrl) {
      throw new ConflictError(
        'version_has_no_file',
        'This version has no uploaded file — the seller must upload one first',
      );
    }

    // Hard gate: a graph that still carries real secrets never goes on the store.
    const scan = readScan(version.scan);
    if (scan.embedded_credentials_count > 0) {
      throw new ConflictError(
        'credentials_present',
        `Version still contains ${scan.embedded_credentials_count} embedded ` +
          'credential(s); the seller must remove them and re-upload',
      );
    }

    const now = new Date();

    const updatedVersion = await this.prisma.scriptVersion.update({
      where: { id: versionId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: now,
        releasedAt: now,
      },
    });

    const script = await this.prisma.script.findUniqueOrThrow({
      where: { id: version.scriptId },
      select: { status: true },
    });

    // Approval is what makes a version live: the pointer, the listing metadata and the
    // store status all move here, never on upload. A seller who took the app off the store
    // stays off it — approving their pending version must not quietly relist it.
    await this.prisma.script.update({
      where: { id: version.scriptId },
      data: {
        ...(script.status === 'ARCHIVED'
          ? {}
          : { status: 'PUBLISHED', publishedAt: now, rejectReason: null }),
        latestVersion: version.version,
        latestVersionId: version.id,
        minAppVersion: version.minAppVersion,
        nodeCount: version.nodeCount,
        nodeGroupsUsed: toStringArray(version.nodeGroupsUsed),
        capabilities: version.capabilities ?? {},
      },
    });

    return updatedVersion;
  }

  async rejectVersion(versionId: string, adminId: string, reason: string) {
    const version = await this.prisma.scriptVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException('Script version not found');
    }

    if (version.status !== 'PENDING_REVIEW') {
      throw new ConflictError(
        'version_decided',
        'This version has already been approved or rejected',
      );
    }

    const updatedVersion = await this.prisma.scriptVersion.update({
      where: { id: versionId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });

    // Rejecting an *update* must not take the live listing down: the version carries the
    // rejection (`reviewNote`), and the app keeps selling its already-approved version.
    // Only a listing that has never had an approved version becomes REJECTED.
    const approvedCount = await this.prisma.scriptVersion.count({
      where: { scriptId: version.scriptId, status: 'APPROVED' },
    });

    if (approvedCount === 0) {
      await this.prisma.script.update({
        where: { id: version.scriptId },
        data: { status: 'REJECTED', rejectReason: reason },
      });
    }

    return updatedVersion;
  }
}
