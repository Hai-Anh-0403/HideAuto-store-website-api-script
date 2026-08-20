import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConflictError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PackagingService } from './packaging.service';
import { CreateBuildDto } from './dto/create-build.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PageDto } from '../common/dto/page.dto';

@Injectable()
export class BuildsService {
  private readonly logger = new Logger(BuildsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly packaging: PackagingService,
  ) {}

  async listForScript(
    sellerId: string,
    scriptId: string,
    pagination: PaginationDto,
  ) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    const where = { scriptId };

    const [items, total] = await Promise.all([
      this.prisma.miniAppBuild.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.miniAppBuild.count({ where }),
    ]);

    return new PageDto(items, total, pagination.skip, pagination.limit);
  }

  async create(sellerId: string, scriptId: string, dto: CreateBuildDto) {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, sellerId },
    });

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    // Which version to package: the seller's pick, else the one the listing sells today,
    // else the newest approved. A seller shipping a fix to an older line needs the choice.
    const approvedVersion = await this.prisma.scriptVersion.findFirst({
      where: {
        scriptId,
        status: 'APPROVED',
        // No pick ⇒ the version the listing sells today, and only if that one is approved.
        id: dto.versionId ?? script.latestVersionId ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!approvedVersion) {
      throw new ConflictError(
        'version_not_approved',
        dto.versionId
          ? 'That version is not approved, so it cannot be packaged'
          : 'This mini app has no approved version to package yet',
      );
    }

    // Packaging the same version twice produces the same bytes and two rows the seller has
    // to tell apart — point them at the existing one instead.
    const existing = await this.prisma.miniAppBuild.findFirst({
      where: {
        scriptId,
        scriptVersionId: approvedVersion.id,
        platform: dto.platform ?? 'win',
        arch: dto.arch ?? 'x64',
        status: 'READY',
      },
    });
    if (existing) {
      throw new ConflictError(
        'build_exists',
        `v${approvedVersion.version} already has a ${existing.platform}/${existing.arch} package`,
      );
    }

    // Record the attempt first so a failure is visible to the seller instead of vanishing.
    const build = await this.prisma.miniAppBuild.create({
      data: {
        scriptId,
        scriptVersionId: approvedVersion.id,
        appId: approvedVersion.appId ?? scriptId,
        appName: approvedVersion.appName ?? script.name,
        appVersion: approvedVersion.version,
        platform: dto.platform ?? 'win',
        arch: dto.arch ?? 'x64',
        status: 'BUILDING',
      },
    });

    try {
      const builtAt = new Date();
      const pkg = await this.packaging.packageApp(
        script,
        approvedVersion,
        builtAt,
      );
      const stored = await this.storage.saveBytes(
        pkg.body,
        'builds',
        pkg.filename,
      );

      const ready = await this.prisma.miniAppBuild.update({
        where: { id: build.id },
        data: {
          status: 'READY',
          fileUrl: stored.ref,
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          builtAt,
          error: null,
        },
      });

      await this.prisma.script.update({
        where: { id: scriptId },
        data: { hasMiniApp: true },
      });

      return ready;
    } catch (err) {
      // The portal shows this string to the seller, so take the *detail* an
      // AppException carries — `message` on those is just "Service Unavailable Error".
      const message = detailOf(err);
      this.logger.error(`Build ${build.id} failed: ${message}`);
      await this.prisma.miniAppBuild.update({
        where: { id: build.id },
        data: { status: 'FAILED', error: message },
      });
      throw err;
    }
  }

  /** The packaged archive for a build the seller owns. */
  async download(sellerId: string, buildId: string) {
    const build = await this.prisma.miniAppBuild.findFirst({
      where: { id: buildId, script: { sellerId } },
      include: { script: true },
    });

    if (!build) {
      throw new NotFoundException('Build not found');
    }
    if (build.status !== 'READY' || !build.fileUrl) {
      throw new BadRequestException(
        `Build is not ready to download (status=${build.status})`,
      );
    }

    return {
      filename: `${build.script.slug}-${build.appVersion}.zip`,
      body: await this.storage.readBytes(build.fileUrl),
    };
  }
}

/** The human-readable half of a thrown error: `{ detail }` for our coded exceptions. */
function detailOf(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return err instanceof Error ? err.message : String(err);
}
