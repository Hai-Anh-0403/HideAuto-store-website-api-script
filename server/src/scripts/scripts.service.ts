import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  BadRequestError,
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
import { UploadMiniAppDto } from './dto/upload-mini-app.dto';
import { PageDto } from '../common/dto/page.dto';
import {
  EMPTY_GRAPH,
  extractPackage,
  type ExtractedPackage,
} from '../common/graph/package-extract';
import {
  exeFileSlug,
  isHaupFilename,
  looksLikeHaup2,
  MiniAppContainerError,
  parseMiniAppContainer,
  validSemver,
  type MiniAppHeader,
  type ParsedMiniAppContainer,
} from '../common/graph/mini-app-container';
import {
  deriveMetadata,
  emptyCapabilities,
  scrubCredentials,
  type GraphMetadata,
  type GraphScan,
} from '../common/graph/workflow-graph';
import { toStringArray } from '../common/json-array';
import { sanitizeDescription } from '../common/sanitize-html';

/** Everything a version row derives from an upload — never trusted from the seller. */
interface IngestedUpload {
  fileUrl: string;
  sourceChecksum: string;
  sourceFilename: string;
  delivery: string;
  graphExtracted: boolean;
  appId: string | null;
  appName: string | null;
  wrapperVersion: string | null;
  iconUrl: string | null;
  metadata: GraphMetadata;
  scan: GraphScan;
}

@Injectable()
export class ScriptsService {
  private readonly logger = new Logger(ScriptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private wrapperPrivateKey(): string {
    return this.config.get<string>('MINI_APP_WRAPPER_PRIVATE_KEY', '').trim();
  }

  /** One-slot dump so `scripts/debug-haup-decrypt.mjs` can inspect the real file. */
  private dumpFailedHaup(buf: Buffer): void {
    try {
      const dir = join(process.cwd(), 'var');
      mkdirSync(dir, { recursive: true });
      const dest = join(dir, 'debug-last-failed.haup');
      writeFileSync(dest, buf);
      this.logger.warn(
        `HAUP2 decrypt failed — dumped ${buf.length} bytes to ${dest}`,
      );
    } catch (dumpErr) {
      this.logger.warn(
        `Could not dump failed .haup: ${dumpErr instanceof Error ? dumpErr.message : dumpErr}`,
      );
    }
  }

  /**
   * `.haup` is the wrapped installer (layer A). Unwrap it, then extract the graph from
   * the inner exe the same way a raw `.zip`/`.exe` is handled. Identity (appId / name /
   * version / icon) comes from the wrapper, not from the seller's form.
   */
  private async openUpload(file: Express.Multer.File): Promise<{
    pkg: ExtractedPackage;
    wrapper: ParsedMiniAppContainer | null;
  }> {
    let bytes = file.buffer;
    let filename = file.originalname;
    let wrapper: ParsedMiniAppContainer | null = null;

    if (looksLikeHaup2(bytes) || isHaupFilename(filename)) {
      try {
        wrapper = parseMiniAppContainer(bytes, this.wrapperPrivateKey());
      } catch (err) {
        if (
          err instanceof MiniAppContainerError &&
          err.code === 'wrapper_decrypt_failed'
        ) {
          this.dumpFailedHaup(bytes);
        }
        throw err;
      }
      bytes = wrapper.exe;
      filename = `${exeFileSlug(wrapper.header.name)}-setup.exe`;
      return {
        pkg: await this.extractGraphSafe(bytes, filename),
        wrapper,
      };
    }

    return { pkg: await extractPackage(bytes, filename), wrapper };
  }

  /** An unreadable inner exe is an opaque build — never fail the request here. */
  private async extractGraphSafe(
    bytes: Buffer,
    filename: string,
  ): Promise<ExtractedPackage> {
    try {
      return await extractPackage(bytes, filename);
    } catch {
      return {
        graph: structuredClone(EMPTY_GRAPH),
        delivery: 'mini_app_exe',
        appName: null,
        appId: null,
        workflowId: null,
        workflowName: null,
        graphExtracted: false,
      };
    }
  }

  private mediaUrl(ref: string): string {
    return `/api/v1/media/${ref.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** Best-effort icon: any throw is swallowed, matching the Manager handler. */
  private async storeWrapperIcon(
    header: MiniAppHeader,
    overwriteKey?: string,
  ): Promise<string | null> {
    if (!header.iconPng) return null;
    try {
      const iconBuf = Buffer.from(header.iconPng, 'base64');
      if (!iconBuf.length) return null;
      const stored = overwriteKey
        ? await this.storage.saveAs(overwriteKey, iconBuf)
        : await this.storage.saveBytes(iconBuf, 'media', 'icon.png');
      return this.mediaUrl(stored.ref);
    } catch {
      return null;
    }
  }

  /**
   * Parse an upload, scrub embedded credentials, and derive listing metadata.
   *
   * Only the scrubbed graph is ever persisted — the original bytes (which may hold real
   * secrets) are discarded. Metadata comes from the graph itself, never from the seller.
   */
  private async ingest(file: Express.Multer.File): Promise<IngestedUpload> {
    const { pkg, wrapper } = await this.openUpload(file);
    const { graph, scan } = scrubCredentials(pkg.graph);

    // Persist the scrubbed graph, not the upload: a rejected publish must not leave
    // seller secrets sitting in storage. The unwrapped exe is not kept — it may still
    // hold secrets inside resources/app.workflow.
    const stored = await this.storage.saveBytes(
      Buffer.from(JSON.stringify(graph), 'utf8'),
      'graphs',
      `${file.originalname}.json`,
    );

    const iconUrl = wrapper
      ? await this.storeWrapperIcon(wrapper.header)
      : null;
    const exeChecksum = wrapper
      ? createHash('sha256').update(wrapper.exe).digest('hex')
      : stored.checksum;

    return {
      fileUrl: stored.ref,
      sourceChecksum: exeChecksum,
      sourceFilename: wrapper
        ? `${exeFileSlug(wrapper.header.name)}-setup.exe`
        : file.originalname,
      delivery: pkg.delivery,
      graphExtracted: pkg.graphExtracted,
      appId: wrapper?.header.appId || pkg.appId,
      appName: wrapper?.header.name || pkg.appName,
      wrapperVersion: wrapper?.header.version ?? null,
      iconUrl,
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
   * `POST /api/apps/upload` — unwrap a `.haup`, persist the decoded exe (+ icon),
   * upsert `Script` / `ScriptVersion` / `MiniAppBuild`. See
   * `docs/mini-app-upload-server.md`. Identity always comes from the wrapper.
   */
  async uploadMiniApp(
    sellerId: string,
    dto: UploadMiniAppDto,
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestError('file_required', 'Thiếu file');
    }

    const mode = dto.mode ?? 'PUBLIC';

    let parsed: ParsedMiniAppContainer;
    try {
      parsed = parseMiniAppContainer(file.buffer, this.wrapperPrivateKey());
    } catch (err) {
      if (
        err instanceof MiniAppContainerError &&
        err.code === 'wrapper_decrypt_failed'
      ) {
        this.dumpFailedHaup(file.buffer);
      }
      if (err instanceof MiniAppContainerError) throw err;
      throw new BadRequestError(
        'wrapper_invalid',
        'Không đọc được file mini-app',
      );
    }

    try {
      return await this.persistUnwrappedUpload(sellerId, dto, mode, parsed);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException({
        detail: err instanceof Error ? err.message : 'Upload lỗi',
        code: 'upload_failed',
      });
    }
  }

  private async persistUnwrappedUpload(
    sellerId: string,
    dto: UploadMiniAppDto,
    mode: 'PUBLIC' | 'LICENSE',
    parsed: ParsedMiniAppContainer,
  ) {
    const { header, exe } = parsed;
    const exeName = `${exeFileSlug(header.name)}-setup.exe`;
    const exeKey = `mini-apps/${header.appId}/${header.version}/${exeName}`;
    const exeStored = await this.storage.saveAs(exeKey, exe);

    const iconUrl = await this.storeWrapperIcon(
      header,
      `mini-apps/${header.appId}/icon.png`,
    );

    const pkg = await this.extractGraphSafe(exe, exeName);
    const { graph, scan } = scrubCredentials(pkg.graph);
    const graphStored = await this.storage.saveBytes(
      Buffer.from(JSON.stringify(graph), 'utf8'),
      'graphs',
      `${exeName}.json`,
    );

    const ingested: IngestedUpload = {
      fileUrl: graphStored.ref,
      sourceChecksum: exeStored.checksum,
      sourceFilename: exeName,
      delivery: 'mini_app_exe',
      graphExtracted: pkg.graphExtracted,
      appId: header.appId,
      appName: header.name,
      wrapperVersion: header.version,
      iconUrl,
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

    const owned = await this.findOwnedByAppId(sellerId, header.appId);
    const versionRow = owned
      ? await this.upsertOwnedVersion(owned.script.id, header.version, dto, ingested)
      : await this.createOwnedListing(sellerId, header, dto, ingested);

    await this.upsertUploadBuild({
      scriptId: versionRow.scriptId,
      scriptVersionId: versionRow.id,
      header,
      exeStored,
    });

    const listingPatch: Prisma.ScriptUpdateInput = {
      name: header.name,
      hasMiniApp: true,
      ...(dto.shortDescription !== undefined && {
        shortDescription: dto.shortDescription,
      }),
      ...(dto.description !== undefined && {
        description: dto.description.trim()
          ? sanitizeDescription(dto.description)
          : null,
      }),
      ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl || null }),
      ...(dto.minAppVersion ? { minAppVersion: dto.minAppVersion } : {}),
      ...(iconUrl ? { thumbnailUrl: dto.thumbnailUrl || iconUrl } : {}),
      ...(dto.thumbnailUrl && !iconUrl ? { thumbnailUrl: dto.thumbnailUrl } : {}),
    };
    if (dto.images !== undefined) {
      listingPatch.images = JSON.stringify(
        dto.images
          .split(',')
          .filter(Boolean)
          .filter((u) => /^https?:\/\//i.test(u)),
      );
    }
    const tagIds = dto.tagIds
      ? dto.tagIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];
    if (tagIds.length) {
      listingPatch.tags = { set: tagIds.map((id) => ({ id })) };
    }

    await this.prisma.script.update({
      where: { id: versionRow.scriptId },
      data: listingPatch,
    });

    return {
      ok: true as const,
      appId: header.appId,
      name: header.name,
      version: header.version,
      mode,
      downloadUrl: this.mediaUrl(exeStored.ref),
      iconUrl,
      fileSize: exeStored.sizeBytes,
      checksumSha256: exeStored.checksum,
      scriptId: versionRow.scriptId,
    };
  }

  /**
   * Locate the listing that already claimed this wrapper `appId`. Re-upload must not
   * steal another seller's row — `builderId` is first-claim only.
   */
  private async findOwnedByAppId(sellerId: string, appId: string) {
    const row = await this.prisma.scriptVersion.findFirst({
      where: { appId },
      include: { script: { select: { id: true, sellerId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) return null;
    if (row.script.sellerId !== sellerId) {
      throw new ConflictError(
        'app_id_taken',
        'Mini-app này thuộc seller khác',
      );
    }
    return { script: row.script, version: row };
  }

  private async createOwnedListing(
    sellerId: string,
    header: MiniAppHeader,
    dto: UploadMiniAppDto,
    ingested: IngestedUpload,
  ) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { name: true },
    });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const slug = await this.generateUniqueSlug(header.name);
    const tagIds = dto.tagIds
      ? dto.tagIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    const script = await this.prisma.script.create({
      data: {
        name: header.name,
        slug,
        shortDescription: dto.shortDescription,
        description: dto.description?.trim()
          ? sanitizeDescription(dto.description)
          : undefined,
        videoUrl: dto.videoUrl || undefined,
        thumbnailUrl: dto.thumbnailUrl || ingested.iconUrl || undefined,
        images: dto.images
          ? JSON.stringify(
              dto.images
                .split(',')
                .filter(Boolean)
                .filter((u) => /^https?:\/\//i.test(u)),
            )
          : undefined,
        minAppVersion: dto.minAppVersion || undefined,
        sellerId,
        sellerName: seller.name,
        status: 'DRAFT',
        hasMiniApp: true,
        nodeCount: ingested.metadata.node_count,
        nodeGroupsUsed: ingested.metadata.node_groups_used,
        capabilities: ingested.metadata.capabilities as unknown as object,
        tags: tagIds.length
          ? { connect: tagIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    const version = await this.prisma.scriptVersion.create({
      data: {
        scriptId: script.id,
        version: header.version,
        changelog: dto.changelog || undefined,
        minAppVersion: dto.minAppVersion || undefined,
        status: 'PENDING_REVIEW',
        ...this.versionData(ingested),
      },
    });

    await this.prisma.script.update({
      where: { id: script.id },
      data: {
        latestVersion: version.version,
        latestVersionId: version.id,
      },
    });

    return version;
  }

  /**
   * Same appId + same version → overwrite file fields. New version → new row; do not
   * move `latestVersion*` once anything is APPROVED.
   */
  private async upsertOwnedVersion(
    scriptId: string,
    versionNumber: string,
    dto: UploadMiniAppDto,
    ingested: IngestedUpload,
  ) {
    const existing = await this.prisma.scriptVersion.findUnique({
      where: { scriptId_version: { scriptId, version: versionNumber } },
    });

    if (existing) {
      return this.prisma.scriptVersion.update({
        where: { id: existing.id },
        data: {
          changelog: dto.changelog || existing.changelog,
          minAppVersion: dto.minAppVersion || existing.minAppVersion,
          status:
            existing.status === 'APPROVED'
              ? existing.status
              : 'PENDING_REVIEW',
          ...this.versionData(ingested),
        },
      });
    }

    const version = await this.prisma.scriptVersion.create({
      data: {
        scriptId,
        version: versionNumber,
        changelog: dto.changelog || undefined,
        minAppVersion: dto.minAppVersion || undefined,
        status: 'PENDING_REVIEW',
        ...this.versionData(ingested),
      },
    });

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
          hasMiniApp: true,
          nodeCount: ingested.metadata.node_count,
          nodeGroupsUsed: ingested.metadata.node_groups_used,
          capabilities: ingested.metadata.capabilities as unknown as object,
        },
      });
    }

    return version;
  }

  private async upsertUploadBuild(opts: {
    scriptId: string;
    scriptVersionId: string;
    header: MiniAppHeader;
    exeStored: { ref: string; checksum: string; sizeBytes: number };
  }) {
    const existing = await this.prisma.miniAppBuild.findFirst({
      where: {
        scriptVersionId: opts.scriptVersionId,
        builtBy: 'upload',
      },
    });
    const data = {
      appId: opts.header.appId,
      appName: opts.header.name,
      appVersion: opts.header.version,
      fileUrl: opts.exeStored.ref,
      sizeBytes: opts.exeStored.sizeBytes,
      checksum: opts.exeStored.checksum,
      status: 'READY' as const,
      builtBy: 'upload',
      builtAt: new Date(),
      error: null,
      installerFormat: 'exe',
    };
    if (existing) {
      await this.prisma.miniAppBuild.update({
        where: { id: existing.id },
        data,
      });
      return;
    }
    await this.prisma.miniAppBuild.create({
      data: {
        scriptId: opts.scriptId,
        scriptVersionId: opts.scriptVersionId,
        platform: 'win',
        arch: 'x64',
        ...data,
      },
    });
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
    // Tag filter — a listing must carry every tag given (AND), the same rule the store
    // catalogue uses. The implicit AND with `where.OR` keeps search and tags both required.
    const tagIds = dto.tagIds
      ? dto.tagIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];
    if (tagIds.length) {
      where.AND = tagIds.map((id) => ({ tags: { some: { id } } }));
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
    const listingName = dto.name || ingested?.appName || 'Untitled';
    const slug = await this.generateUniqueSlug(listingName);

    const tagIds = dto.tagIds
      ? dto.tagIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    const script = await this.prisma.script.create({
      data: {
        name: listingName,
        slug,
        shortDescription: dto.shortDescription,
        description: dto.description
          ? sanitizeDescription(dto.description)
          : undefined,
        videoUrl: dto.videoUrl || undefined,
        thumbnailUrl: dto.thumbnailUrl || ingested?.iconUrl || undefined,
        images: dto.images
          ? JSON.stringify(
              dto.images
                .split(',')
                .filter(Boolean)
                .filter((u) => /^https?:\/\//i.test(u)),
            )
          : undefined,
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

    // Version number prefers the wrapper (innerHeader) over the form — the seller can
    // still type one when the file is not a .haup.
    const version = await this.prisma.scriptVersion.create({
      data: {
        scriptId: script.id,
        version: ingested?.wrapperVersion ?? dto.version ?? '1.0.0',
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
        ...(dto.description !== undefined && {
          description: dto.description
            ? sanitizeDescription(dto.description)
            : null,
        }),
        ...(dto.videoUrl !== undefined && {
          videoUrl: dto.videoUrl || null,
        }),
        ...(dto.thumbnailUrl !== undefined && {
          thumbnailUrl: dto.thumbnailUrl || null,
        }),
        ...(dto.images !== undefined && {
          images: JSON.stringify(dto.images),
        }),
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
    if (!file) {
      throw new BadRequestError('file_required', 'A file is required');
    }

    const { pkg, wrapper } = await this.openUpload(file);
    const { graph, scan } = scrubCredentials(pkg.graph);
    const metadata: GraphMetadata = pkg.graphExtracted
      ? deriveMetadata(graph)
      : {
          node_count: 0,
          node_groups_used: [],
          uses_control_flow: false,
          sub_workflow_ids: [],
          capabilities: emptyCapabilities(),
          required_variables: [],
        };

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
      name: wrapper?.header.name ?? pkg.appName,
      version:
        validSemver(wrapper?.header.version) ??
        wrapper?.header.version ??
        null,
      appId: wrapper?.header.appId || pkg.appId,
      appName: wrapper?.header.name || pkg.appName,
      hasIcon: Boolean(wrapper?.header.iconPng),
      iconDataUrl: wrapper?.header.iconPng
        ? `data:image/png;base64,${wrapper.header.iconPng}`
        : null,
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

    const ingested = file ? await this.ingest(file) : null;
    const versionNumber = ingested?.wrapperVersion ?? dto.version;

    const existingVersion = await this.prisma.scriptVersion.findUnique({
      where: {
        scriptId_version: { scriptId, version: versionNumber },
      },
    });

    if (existingVersion) {
      throw new ConflictError(
        'version_exists',
        `Version ${versionNumber} already exists for this script`,
      );
    }

    const version = await this.prisma.scriptVersion.create({
      data: {
        scriptId,
        version: versionNumber,
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
