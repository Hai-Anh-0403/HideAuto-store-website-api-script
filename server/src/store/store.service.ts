import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
import { BrowseScriptsDto } from './dto/browse-scripts.dto';
import { PageDto } from '../common/dto/page.dto';
import { Prisma } from '@prisma/client';
import {
  BrowsePublicScriptsDto,
  type PublicScriptSort,
} from './dto/browse-public-scripts.dto';
import { Script } from '../scripts/schemas/script.schema';
import { ScriptVersion } from '../scripts/schemas/script-version.schema';
import { Tag } from '../tags/schemas/tag.schema';
import { BadRequestError, NotFoundError } from '../common/errors';

interface CatalogReferenceRow {
  sellerId: string;
  tagIds: Types.ObjectId[];
}

interface CatalogAggregateRow extends CatalogReferenceRow {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  shortDescription: string;
  thumbnailStorageKey: string | null;
  latestVersion: { _id: Types.ObjectId; version: string };
  price?: string;
  priceAmount?: number;
  currency?: string;
  ratingAvg: number;
  ratingCount: number;
  downloads: number;
  views: number;
  publishedAt: Date;
  updatedAt: Date;
}

interface CatalogAggregateResult {
  items: CatalogAggregateRow[];
  total: Array<{ count: number }>;
}

interface PublicTagRow {
  _id: Types.ObjectId;
  name: string;
  slug: string;
}

interface PublicScriptDetailRow extends CatalogReferenceRow {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  shortDescription: string;
  price?: string;
  priceAmount?: number;
  currency?: string;
  descriptionHtml: string | null;
  thumbnailStorageKey: string | null;
  galleryStorageKeys: string[];
  latestApprovedVersionId: Types.ObjectId;
  capabilities: string[];
  ratingAvg: number;
  ratingCount: number;
  downloads: number;
  views: number;
  publishedAt: Date;
  updatedAt: Date;
}

interface ApprovedVersionRow {
  _id: Types.ObjectId;
  version: string;
  changelog: string | null;
  releasedAt: Date | null;
  createdAt: Date;
  capabilities?: string[];
}

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(Script.name) private readonly scriptModel: Model<Script>,
    @InjectModel(Tag.name) private readonly tagModel: Model<Tag>,
    @InjectModel(ScriptVersion.name)
    private readonly scriptVersionModel: Model<ScriptVersion>,
  ) {}

  async browsePublic(dto: BrowsePublicScriptsDto) {
    const tagIds = this.parseTagIds(dto.tagIds);
    const match: Record<string, unknown> = {
      status: 'PUBLISHED',
      publishedAt: { $ne: null },
    };
    if (tagIds.length > 0) match.tagIds = { $all: tagIds };
    if (dto.q?.trim()) {
      const search = this.escapeRegex(dto.q.trim());
      match.$or = [
        { name: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
      ];
    }

    const result = await this.scriptModel.aggregate<CatalogAggregateResult>([
      { $match: match },
      {
        $lookup: {
          from: 'script_versions',
          let: { versionId: '$latestApprovedVersionId', scriptId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$versionId'] },
                    { $eq: ['$scriptId', '$$scriptId'] },
                    { $eq: ['$status', 'APPROVED'] },
                  ],
                },
              },
            },
            { $project: { version: 1 } },
          ],
          as: 'latestVersion',
        },
      },
      { $unwind: '$latestVersion' },
      {
        $addFields: {
          priceAmount: { $ifNull: ['$priceAmount', 29] },
        },
      },
      { $sort: this.catalogSort(dto.sort ?? 'popular') },
      {
        $facet: {
          items: [{ $skip: dto.skip }, { $limit: dto.limit }],
          total: [{ $count: 'count' }],
        },
      },
    ]);
    const page = result[0] ?? { items: [], total: [] };
    const tagMap = await this.publicTagMap(page.items);
    const sellerNameMap = await this.sellerNameMap(page.items);

    return new PageDto(
      page.items.map((script) => ({
        id: script._id.toString(),
        slug: script.slug,
        name: script.name,
        shortDescription: script.shortDescription,
        thumbnailUrl: script.thumbnailStorageKey
          ? this.mediaUrl(script.thumbnailStorageKey)
          : null,
        seller: {
          displayName: sellerNameMap.get(script.sellerId) ?? 'Unknown seller',
        },
        tags: script.tagIds
          .map((tagId) => tagMap.get(tagId.toString()))
          .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag)),
        latestApprovedVersion: script.latestVersion.version,
        price: script.price || '$29',
        priceAmount: script.priceAmount ?? 29,
        currency: script.currency || 'USD',
        statistics: {
          ratingAvg: script.ratingAvg,
          ratingCount: script.ratingCount,
          downloads: script.downloads,
          views: script.views,
        },
        publishedAt: script.publishedAt.toISOString(),
        updatedAt: script.updatedAt.toISOString(),
      })),
      page.total[0]?.count ?? 0,
      dto.skip,
      dto.limit,
    );
  }

  async findPublicBySlugOrId(slugOrId: string) {
    const query: Record<string, unknown> = {
      status: 'PUBLISHED',
      publishedAt: { $ne: null },
    };
    query.$or = [{ slug: slugOrId }];
    if (Types.ObjectId.isValid(slugOrId)) {
      (query.$or as Array<Record<string, unknown>>).push({
        _id: new Types.ObjectId(slugOrId),
      });
    }

    const script = await this.scriptModel
      .findOne(query)
      .lean<PublicScriptDetailRow>();
    if (!script) {
      throw new NotFoundError('script_not_found', 'Script not found');
    }

    const latestVersion = await this.scriptVersionModel
      .findOne({
        _id: script.latestApprovedVersionId,
        scriptId: script._id,
        status: 'APPROVED',
      })
      .lean<ApprovedVersionRow>();
    if (!latestVersion) {
      throw new NotFoundError('script_not_found', 'Script not found');
    }

    const [tagMap, sellerNameMap, versions] = await Promise.all([
      this.publicTagMap([script]),
      this.sellerNameMap([script]),
      this.scriptVersionModel
        .find({ scriptId: script._id, status: 'APPROVED' })
        .sort({ createdAt: -1 })
        .lean<ApprovedVersionRow[]>(),
    ]);

    return {
      id: script._id.toString(),
      slug: script.slug,
      name: script.name,
      shortDescription: script.shortDescription,
      thumbnailUrl: script.thumbnailStorageKey
        ? this.mediaUrl(script.thumbnailStorageKey)
        : null,
      seller: {
        displayName: sellerNameMap.get(script.sellerId) ?? 'Unknown seller',
      },
      tags: script.tagIds
        .map((tagId) => tagMap.get(tagId.toString()))
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag)),
      latestApprovedVersion: latestVersion.version,
      price: script.price || '$29',
      priceAmount: script.priceAmount ?? 29,
      currency: script.currency || 'USD',
      statistics: {
        ratingAvg: script.ratingAvg,
        ratingCount: script.ratingCount,
        downloads: script.downloads,
        views: script.views,
      },
      publishedAt: script.publishedAt.toISOString(),
      updatedAt: script.updatedAt.toISOString(),
      descriptionHtml: script.descriptionHtml,
      galleryUrls: (script.galleryStorageKeys ?? []).map((key) => this.mediaUrl(key)),
      capabilities: latestVersion.capabilities ?? script.capabilities ?? [],
      versions: versions.map((version) => ({
        id: version._id.toString(),
        version: version.version,
        changelog: version.changelog,
        releasedAt: version.releasedAt?.toISOString() ?? null,
        createdAt: version.createdAt.toISOString(),
      })),
    };
  }

  private parseTagIds(raw?: string): Types.ObjectId[] {
    if (!raw?.trim()) return [];
    const ids = raw.split(',').map((value) => value.trim()).filter(Boolean);
    if (ids.some((id) => !Types.ObjectId.isValid(id))) {
      throw new BadRequestError(
        'invalid_tag_ids',
        'tagIds must contain comma-separated MongoDB ObjectIds',
      );
    }
    return ids.map((id) => new Types.ObjectId(id));
  }

  private catalogSort(sort: PublicScriptSort): Record<string, 1 | -1> {
    switch (sort) {
      case 'newest':
        return { publishedAt: -1, _id: -1 };
      case 'updated':
        return { updatedAt: -1, _id: -1 };
      case 'views':
        return { views: -1, publishedAt: -1 };
      case 'price_asc':
        return { priceAmount: 1, publishedAt: -1, _id: -1 };
      case 'price_desc':
        return { priceAmount: -1, publishedAt: -1, _id: -1 };
      case 'popular':
        return { ratingAvg: -1, ratingCount: -1, publishedAt: -1 };
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async publicTagMap(items: CatalogReferenceRow[]) {
    const tagIds = [...new Set(items.flatMap((script) => script.tagIds.map(String)))];
    if (tagIds.length === 0) return new Map<string, { id: string; name: string; slug: string }>();

    const tags = await this.tagModel
      .find({ _id: { $in: tagIds } })
      .lean<PublicTagRow[]>();
    return new Map(
      tags.map((tag) => [
        tag._id.toString(),
        { id: tag._id.toString(), name: tag.name, slug: tag.slug },
      ]),
    );
  }

  async publicTags() {
    const tags = await this.tagModel.find().sort({ name: 1 }).lean<PublicTagRow[]>();
    return tags.map((tag) => ({
      id: tag._id.toString(),
      name: tag.name,
      slug: tag.slug,
    }));
  }

  private async sellerNameMap(items: CatalogReferenceRow[]) {
    const sellerIds = [...new Set(items.map((script) => script.sellerId))];
    if (sellerIds.length === 0) return new Map<string, string>();

    const sellers = await this.prisma.seller.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, name: true },
    });
    return new Map(sellers.map((seller) => [seller.id, seller.name]));
  }

  private mediaUrl(storageKey: string): string {
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return storageKey;
    }
    return `/api/v1/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
  }

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
        { name: { contains: dto.q } },
        { shortDescription: { contains: dto.q } },
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
          thumbnailUrl: true,
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
        videoUrl: true,
        thumbnailUrl: true,
        images: true,
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
