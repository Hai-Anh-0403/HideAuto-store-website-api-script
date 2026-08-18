import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

    // Find the latest APPROVED version for this script
    const approvedVersion = await this.prisma.scriptVersion.findFirst({
      where: { scriptId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!approvedVersion) {
      throw new BadRequestException(
        'Script has no approved version to build from',
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
      const message = (err as Error).message;
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
