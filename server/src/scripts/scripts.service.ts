import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../common/errors';
import slugify from 'slugify';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateScriptDto } from './dto/create-script.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListScriptsDto } from './dto/list-scripts.dto';
import { PageDto } from '../common/dto/page.dto';
import { extractPackage } from '../common/graph/package-extract';
import {
  deriveMetadata,
  emptyCapabilities,
  scrubCredentials,
  type GraphMetadata,
  type GraphScan,
} from '../common/graph/workflow-graph';
import { toStringArray } from '../common/json-array';

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

  /**
   * The seller's own catalogue.
   *
   * `sellerId` is part of the filter, never of the query string — a seller must not be able
   * to widen this list past their own scripts. Search stays case-insensitive on the three
   * fields a seller actually recognises an app by (name, slug, the one-line description).
   */
  async list(sellerId: string, dto: ListScriptsDto) {
    const where: Prisma.ScriptWhereInput = { sellerId };
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search } },
        { slug: { contains: dto.search } },
        { shortDescription: { contains: dto.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.script.findMany({
        where,
        orderBy: this.scriptOrderBy(dto.sort),
        skip: dto.skip,
        take: dto.limit,
        include: {
          tags: { select: { id: true, name: true, slug: true, color: true } },
          _count: { select: { versions: true, keys: true } },
        },
      }),
      this.prisma.script.count({ where }),
    ]);

    return new PageDto(items, total, dto.skip, dto.limit);
  }

  /**
   * Sort keys are an allow-list, not a column name off the wire.
   *
   * Every option falls back to `createdAt desc` so paging stays stable when the primary key
   * ties (two apps with zero downloads must not swap places between page 1 and page 2).
   */
  private scriptOrderBy(
    sort: ListScriptsDto['sort'],
  ): Prisma.ScriptOrderByWithRelationInput[] {
    switch (sort) {
      case 'name':
        return [{ name: 'asc' }, { createdAt: 'desc' }];
      case 'downloads':
        return [{ downloads: 'desc' }, { createdAt: 'desc' }];
      default:
        return [{ createdAt: 'desc' }];
    }
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
        description: dto.description,
        minAppVersion: dto.minAppVersion,
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

    // The first version. The seller names it — a shop porting an app that is already at
    // 2.3.0 elsewhere should not have to call it 1.0.0 and then immediately re-upload.
    const version = await this.prisma.scriptVersion.create({
      data: {
        scriptId: script.id,
        version: dto.version ?? '1.0.0',
        changelog: dto.changelog,
        minAppVersion: dto.minAppVersion,
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
          // The detail page renders the derived metadata and the scan, so a version has
          // to come back whole. Storage refs (fileUrl / sourceChecksum) stay internal;
          // `scan.credential_paths` is safe to ship — paths only, never values.
          select: {
            id: true,
            scriptId: true,
            version: true,
            changelog: true,
            sourceFilename: true,
            delivery: true,
            formatVersion: true,
            minAppVersion: true,
            testedAppVersion: true,
            graphExtracted: true,
            nodeCount: true,
            nodeGroupsUsed: true,
            usesControlFlow: true,
            subWorkflowIds: true,
            capabilities: true,
            requiredVars: true,
            scan: true,
            appId: true,
            appName: true,
            status: true,
            reviewNote: true,
            reviewedAt: true,
            scannedAt: true,
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
        minAppVersion: dto.minAppVersion,
        status: 'PENDING_REVIEW',
        ...this.versionData(ingested),
      },
    });

    // `latestVersion*` is the **live** version — what the store lists, what a licence is
    // signed against, what a buyer downloads. A fresh upload is not that until an admin
    // approves it, so the pointer only moves here while nothing has ever been approved
    // (a draft still finding its shape). `AdminService.approveVersion` moves it after that.
    const approvedCount = await this.prisma.scriptVersion.count({
      where: { scriptId, status: 'APPROVED' },
    });

    if (approvedCount === 0) {
      await this.prisma.script.update({
        where: { id: scriptId },
        data: {
          latestVersion: version.version,
          latestVersionId: version.id,
          ...(dto.minAppVersion ? { minAppVersion: dto.minAppVersion } : {}),
          ...(ingested && {
            hasMiniApp: ingested.delivery === 'mini_app_exe',
            nodeCount: ingested.metadata.node_count,
            nodeGroupsUsed: ingested.metadata.node_groups_used,
            capabilities: ingested.metadata.capabilities as unknown as object,
          }),
        },
      });
    }

    return version;
  }

  /**
   * Resolve a version through its script's owner.
   *
   * Version ids are globally unique, so a version-scoped route that looked one up directly
   * would happily act on another seller's row. Ownership is proved on the *script* first,
   * then the version is only ever fetched scoped to that script.
   */
  private async ownedVersion(
    sellerId: string,
    scriptId: string,
    versionId: string,
  ) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    const version = await this.prisma.scriptVersion.findFirst({
      where: { id: versionId, scriptId },
    });

    if (!version) {
      throw new NotFoundError(
        'version_not_found',
        'Version not found for this script',
      );
    }

    return { script, version };
  }

  /**
   * Drop a version the seller uploaded by mistake.
   *
   * Deleting is only ever safe while nothing downstream depends on the row. An APPROVED
   * version has been on the store — a buyer may hold a licence signed against it — so it
   * stays forever; only something still waiting for review, or already turned down, can go.
   * The live pointer and any packaged build are the other two things that would be left
   * dangling, and each refuses with its own code so the portal can say which one it is.
   */
  async deleteVersion(
    sellerId: string,
    scriptId: string,
    versionId: string,
  ): Promise<void> {
    const { script, version } = await this.ownedVersion(
      sellerId,
      scriptId,
      versionId,
    );

    if (version.status !== 'PENDING_REVIEW' && version.status !== 'REJECTED') {
      throw new ConflictError(
        'version_not_deletable',
        'Only a pending or rejected version can be deleted — an approved one may ' +
          'already have been sold and downloaded',
      );
    }

    if (script.latestVersionId === version.id) {
      throw new ConflictError(
        'version_is_live',
        'This is the version the listing currently points at — make another version ' +
          'live first',
      );
    }

    const remaining = await this.prisma.scriptVersion.count({
      where: { scriptId },
    });
    if (remaining <= 1) {
      throw new ConflictError(
        'version_last_remaining',
        'A script must keep at least one version — delete the script instead',
      );
    }

    const builds = await this.prisma.miniAppBuild.count({
      where: { scriptVersionId: versionId },
    });
    if (builds > 0) {
      throw new ConflictError(
        'version_has_builds',
        `${builds} mini-app build(s) were packaged from this version; it cannot be ` +
          'deleted',
      );
    }

    await this.prisma.scriptVersion.delete({ where: { id: versionId } });
  }

  /**
   * Point the listing back at an older approved version.
   *
   * When a fresh release turns out to be broken the seller's only recourse used to be
   * uploading the old graph again and waiting for another review, leaving buyers on the bad
   * build in the meantime. Rollback reuses a version review has already cleared, so it needs
   * no new approval — which is also why only an APPROVED version qualifies.
   *
   * The listing columns are copied from the version exactly as `AdminService.approveVersion`
   * copies them; the script's own `status` is deliberately left alone, so rolling back never
   * relists an app the seller took off the store.
   */
  async rollbackVersion(
    sellerId: string,
    scriptId: string,
    versionId: string,
  ) {
    const { script, version } = await this.ownedVersion(
      sellerId,
      scriptId,
      versionId,
    );

    if (version.status !== 'APPROVED') {
      throw new ConflictError(
        'version_not_approved',
        'Only an approved version can be made live',
      );
    }

    if (script.latestVersionId === version.id) {
      throw new ConflictError(
        'version_already_live',
        `Version ${version.version} is already the live one`,
      );
    }

    await this.prisma.script.update({
      where: { id: scriptId },
      data: {
        latestVersion: version.version,
        latestVersionId: version.id,
        minAppVersion: version.minAppVersion,
        nodeCount: version.nodeCount,
        nodeGroupsUsed: toStringArray(version.nodeGroupsUsed),
        capabilities: version.capabilities ?? {},
      },
    });

    return this.findOne(sellerId, scriptId);
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
