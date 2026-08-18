import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuildDto } from './dto/create-build.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PageDto } from '../common/dto/page.dto';

@Injectable()
export class BuildsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.miniAppBuild.create({
      data: {
        scriptId,
        scriptVersionId: approvedVersion.id,
        appId: approvedVersion.appId ?? scriptId,
        appName: approvedVersion.appName ?? script.name,
        appVersion: approvedVersion.version,
        platform: dto.platform ?? 'win',
        arch: dto.arch ?? 'x64',
        status: 'READY',
        builtAt: new Date(),
      },
    });
  }
}
