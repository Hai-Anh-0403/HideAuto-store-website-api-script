import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BrowseScriptsDto } from './dto/browse-scripts.dto';
import { PageDto } from '../common/dto/page.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async browse(dto: BrowseScriptsDto) {
    const where: Prisma.ScriptWhereInput = {
      status: 'PUBLISHED',
    };

    // Tag filter (AND logic: script must have ALL specified tags)
    if (dto.tag_ids) {
      const tagIds = dto.tag_ids.split(',').map((id) => id.trim()).filter(Boolean);
      if (tagIds.length > 0) {
        where.AND = tagIds.map((tagId) => ({
          tags: { some: { id: tagId } },
        }));
      }
    }

    // Text search on name and short_description
    if (dto.q) {
      where.OR = [
        { name: { contains: dto.q, mode: 'insensitive' } },
        { shortDescription: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.script.findMany({
        where,
        orderBy: { ratingAvg: 'desc' },
        skip: dto.skip,
        take: dto.limit,
        select: {
          id: true,
          slug: true,
          name: true,
          shortDescription: true,
          sellerName: true,
          engine: true,
          hasMiniApp: true,
          latestVersion: true,
          nodeCount: true,
          status: true,
          ratingAvg: true,
          ratingCount: true,
          downloads: true,
          views: true,
          publishedAt: true,
          tags: {
            select: { id: true, name: true, slug: true, color: true },
          },
        },
      }),
      this.prisma.script.count({ where }),
    ]);

    return new PageDto(items, total, dto.skip, dto.limit);
  }

  async findBySlugOrId(slugOrId: string) {
    const script = await this.prisma.script.findFirst({
      where: {
        status: 'PUBLISHED',
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        description: true,
        sellerName: true,
        engine: true,
        hasMiniApp: true,
        latestVersion: true,
        nodeCount: true,
        nodeGroupsUsed: true,
        capabilities: true,
        status: true,
        ratingAvg: true,
        ratingCount: true,
        downloads: true,
        views: true,
        publishedAt: true,
        createdAt: true,
        tags: {
          select: { id: true, name: true, slug: true, color: true },
        },
        versions: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            version: true,
            changelog: true,
            releasedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    return script;
  }
}
