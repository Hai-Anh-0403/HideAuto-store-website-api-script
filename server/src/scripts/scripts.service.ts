import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../common/errors';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateScriptDto } from './dto/create-script.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PageDto } from '../common/dto/page.dto';
import { extractPackage } from '../common/graph/package-extract';
import {
  deriveMetadata,
  emptyCapabilities,
  scrubCredentials,
  type GraphMetadata,
  type GraphScan,
} from '../common/graph/workflow-graph';

/** Everything a version row derives from an upload — never trusted from the seller. */
interface IngestedUpload {
  fileUrl: string;
  sourceChecksum: string;
  sourceFilename: string;
  delivery: string;
  graphExtracted: boolean;
  appId: string | null;
  appName: string | null;
  metadata: GraphMetadata;
  scan: GraphScan;
}

@Injectable()
export class ScriptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Parse an upload, scrub embedded credentials, and derive listing metadata.
   *
   * Only the scrubbed graph is ever persisted — the original bytes (which may hold real
   * secrets) are discarded. Metadata comes from the graph itself, never from the seller.
   */
  private async ingest(file: Express.Multer.File): Promise<IngestedUpload> {
    const pkg = await extractPackage(file.buffer, file.originalname);
    const { graph, scan } = scrubCredentials(pkg.graph);

    // Persist the scrubbed graph, not the upload: a rejected publish must not leave
    // seller secrets sitting in storage.
    const stored = await this.storage.saveBytes(
      Buffer.from(JSON.stringify(graph), 'utf8'),
      'graphs',
      `${file.originalname}.json`,
    );

    return {
      fileUrl: stored.ref,
      sourceChecksum: stored.checksum,
      sourceFilename: file.originalname,
      delivery: pkg.delivery,
      graphExtracted: pkg.graphExtracted,
      appId: pkg.appId,
      appName: pkg.appName,
      metadata: pkg.graphExtracted
        ? deriveMetadata(graph)
        : {
            node_count: 0,
            node_groups_used: [],
            uses_control_flow: false,
            sub_workflow_ids: [],
            capabilities: emptyCapabilities(),
            required_variables: [],
          },
      scan,
    };
  }

  /** Version columns derived from an upload (or the neutral defaults when none). */
  private versionData(ingested: IngestedUpload | null) {
    if (!ingested) return {};
    const { metadata } = ingested;
    return {
      fileUrl: ingested.fileUrl,
      sourceChecksum: ingested.sourceChecksum,
      sourceFilename: ingested.sourceFilename,
      delivery: ingested.delivery,
      graphExtracted: ingested.graphExtracted,
      appId: ingested.appId,
      appName: ingested.appName,
      nodeCount: metadata.node_count,
      nodeGroupsUsed: metadata.node_groups_used,
      usesControlFlow: metadata.uses_control_flow,
      subWorkflowIds: metadata.sub_workflow_ids,
      capabilities: metadata.capabilities as unknown as object,
      requiredVars: metadata.required_variables as unknown as object,
      scan: ingested.scan as unknown as object,
      scannedAt: new Date(),
    };
  }

  async list(sellerId: string, pagination: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.script.findMany({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          tags: { select: { id: true, name: true, slug: true, color: true } },
          _count: { select: { versions: true, keys: true } },
        },
      }),
      this.prisma.script.count({ where: { sellerId } }),
    ]);

    return new PageDto(items, total, pagination.skip, pagination.limit);
  }

  async create(
    sellerId: string,
    dto: CreateScriptDto,
    file?: Express.Multer.File,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { name: true },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const ingested = file ? await this.ingest(file) : null;
    const slug = await this.generateUniqueSlug(dto.name);

    const tagIds = dto.tagIds
      ? dto.tagIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    const script = await this.prisma.script.create({
      data: {
        name: dto.name,
        slug,
        shortDescription: dto.shortDescription,
        sellerId,
        sellerName: seller.name,
        status: 'DRAFT',
        hasMiniApp: ingested?.delivery === 'mini_app_exe',
        nodeCount: ingested?.metadata.node_count ?? 0,
        nodeGroupsUsed: ingested?.metadata.node_groups_used ?? [],
        capabilities: (ingested?.metadata.capabilities ??
          emptyCapabilities()) as unknown as object,
        tags: tagIds.length > 0
          ? { connect: tagIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        tags: { select: { id: true, name: true, slug: true, color: true } },
      },
    });

    // Create initial version
    const version = await this.prisma.scriptVersion.create({
      data: {
        scriptId: script.id,
        version: '1.0.0',
        status: 'PENDING_REVIEW',
        ...this.versionData(ingested),
      },
    });

    return this.prisma.script.update({
      where: { id: script.id },
      data: {
        latestVersion: version.version,
        latestVersionId: version.id,
      },
      include: {
        tags: { select: { id: true, name: true, slug: true, color: true } },
      },
    });
  }

  async findOne(sellerId: string, scriptId: string) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
      include: {
        tags: { select: { id: true, name: true, slug: true, color: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            version: true,
            changelog: true,
            status: true,
            nodeCount: true,
            createdAt: true,
            releasedAt: true,
            reviewNote: true,
          },
        },
      },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    return script;
  }

  async update(sellerId: string, scriptId: string, dto: UpdateScriptDto) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    const slugData =
      dto.name && dto.name !== script.name
        ? { slug: await this.generateUniqueSlug(dto.name) }
        : {};

    return this.prisma.script.update({
      where: { id: scriptId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.shortDescription !== undefined && {
          shortDescription: dto.shortDescription,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...slugData,
        ...(dto.tagIds !== undefined && {
          tags: { set: dto.tagIds.map((id) => ({ id })) },
        }),
      },
      include: {
        tags: { select: { id: true, name: true, slug: true, color: true } },
      },
    });
  }

  async inspect(sellerId: string, scriptId: string, file: Express.Multer.File) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    return this.inspectFile(file);
  }

  /**
   * Dry run: parse and scan an upload without persisting anything, so the seller sees the
   * derived metadata — and any embedded secrets — before committing to a version.
   */
  async inspectFile(file: Express.Multer.File) {
    const pkg = await extractPackage(file.buffer, file.originalname);
    const { graph, scan } = scrubCredentials(pkg.graph);
    const metadata = deriveMetadata(graph);

    return {
      filename: file.originalname,
      size: file.size,
      graphExtracted: pkg.graphExtracted,
      nodeCount: metadata.node_count,
      nodeGroupsUsed: metadata.node_groups_used,
      usesControlFlow: metadata.uses_control_flow,
      capabilities: metadata.capabilities,
      requiredVars: metadata.required_variables,
      embeddedCredentialsCount: scan.embedded_credentials_count,
      credentialPaths: scan.credential_paths,
      usesShell: scan.uses_shell,
    };
  }

  async createVersion(
    sellerId: string,
    scriptId: string,
    dto: CreateVersionDto,
    file?: Express.Multer.File,
  ) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    const existingVersion = await this.prisma.scriptVersion.findUnique({
      where: {
        scriptId_version: { scriptId, version: dto.version },
      },
    });

    if (existingVersion) {
      throw new ConflictError(
        'version_exists',
        `Version ${dto.version} already exists for this script`,
      );
    }

    const ingested = file ? await this.ingest(file) : null;

    const version = await this.prisma.scriptVersion.create({
      data: {
        scriptId,
        version: dto.version,
        changelog: dto.changelog,
        status: 'PENDING_REVIEW',
        ...this.versionData(ingested),
      },
    });

    // Listing-level metadata always mirrors the newest version's graph.
    await this.prisma.script.update({
      where: { id: scriptId },
      data: {
        latestVersion: version.version,
        latestVersionId: version.id,
        ...(ingested && {
          hasMiniApp: ingested.delivery === 'mini_app_exe',
          nodeCount: ingested.metadata.node_count,
          nodeGroupsUsed: ingested.metadata.node_groups_used,
          capabilities: ingested.metadata.capabilities as unknown as object,
        }),
      },
    });

    return version;
  }

  async submit(sellerId: string, scriptId: string) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    if (script.status !== 'DRAFT' && script.status !== 'REJECTED') {
      throw new ConflictError(
        'not_submittable',
        'Only DRAFT or REJECTED scripts can be submitted for review',
      );
    }

    const pending = await this.prisma.scriptVersion.findFirst({
      where: { scriptId, status: 'PENDING_REVIEW' },
    });
    if (!pending) {
      throw new ConflictError(
        'no_pending_version',
        'No pending version to review — upload one first',
      );
    }

    return this.prisma.script.update({
      where: { id: scriptId },
      data: { status: 'PENDING_REVIEW', rejectReason: null },
    });
  }

  async archive(sellerId: string, scriptId: string) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    return this.prisma.script.update({
      where: { id: scriptId },
      data: { status: 'ARCHIVED' },
    });
  }

  async unarchive(sellerId: string, scriptId: string) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    if (script.status !== 'ARCHIVED') {
      throw new ConflictError(
        'not_archived',
        'Only ARCHIVED scripts can be unarchived',
      );
    }

    return this.prisma.script.update({
      where: { id: scriptId },
      data: { status: 'PUBLISHED' },
    });
  }

  async remove(sellerId: string, scriptId: string) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    if (script.status !== 'DRAFT') {
      throw new ForbiddenError(
        'not_deletable',
        'Only DRAFT scripts can be deleted',
      );
    }

    await this.prisma.script.delete({ where: { id: scriptId } });
  }

  /**
   * The seller's own copy of a version's graph — the scrubbed one the store holds,
   * never the original upload. Defaults to the live version, falling back to the newest
   * one that actually carries a stored artifact.
   */
  async download(
    sellerId: string,
    scriptId: string,
  ): Promise<{ filename: string; body: Buffer }> {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
      select: { id: true, slug: true, latestVersionId: true },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    const version =
      (script.latestVersionId
        ? await this.prisma.scriptVersion.findFirst({
            where: { id: script.latestVersionId, fileUrl: { not: null } },
          })
        : null) ??
      (await this.prisma.scriptVersion.findFirst({
        where: { scriptId, fileUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
      }));

    if (!version?.fileUrl) {
      throw new NotFoundError(
        'artifact_missing',
        'No stored artifact for this script',
      );
    }

    return {
      filename: `${script.slug}-${version.version}.json`,
      body: await this.storage.readBytes(version.fileUrl),
    };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.script.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
