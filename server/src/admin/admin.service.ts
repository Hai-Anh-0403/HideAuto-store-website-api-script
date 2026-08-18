import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PageDto } from '../common/dto/page.dto';
import { readScan } from '../common/graph/workflow-graph';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sellers ──────────────────────────────────────────────

  async listSellers(pagination: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.seller.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          email: true,
          name: true,
          contact: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { scripts: true, members: true, keys: true } },
        },
      }),
      this.prisma.seller.count(),
    ]);

    return new PageDto(items, total, pagination.skip, pagination.limit);
  }

  async approveSeller(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'APPROVED' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async rejectSeller(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'REJECTED' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async suspendSeller(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { status: 'SUSPENDED' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  // ── Scripts ──────────────────────────────────────────────

  async listPendingScripts(pagination: PaginationDto) {
    const where = { status: 'PENDING_REVIEW' as const };

    const [items, total] = await Promise.all([
      this.prisma.script.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          tags: { select: { id: true, name: true, slug: true, color: true } },
          versions: {
            where: { status: 'PENDING_REVIEW' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              version: true,
              changelog: true,
              nodeCount: true,
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
      throw new BadRequestException('Version is not pending review');
    }

    // Hard gate: a graph that still carries real secrets never goes on the store.
    const scan = readScan(version.scan);
    if (scan.embedded_credentials_count > 0) {
      throw new ConflictException(
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

    // Set the script to PUBLISHED
    await this.prisma.script.update({
      where: { id: version.scriptId },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        nodeCount: version.nodeCount,
        nodeGroupsUsed: version.nodeGroupsUsed,
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
      throw new BadRequestException('Version is not pending review');
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

    // Set the script to REJECTED
    await this.prisma.script.update({
      where: { id: version.scriptId },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
      },
    });

    return updatedVersion;
  }
}
