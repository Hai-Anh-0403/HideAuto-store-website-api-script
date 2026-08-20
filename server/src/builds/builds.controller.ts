import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { ApprovedSellerGuard } from '../auth/approved-seller.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { BuildsService } from './builds.service';
import { CreateBuildDto } from './dto/create-build.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Builds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)
@Controller('api/v1/scripts/:scriptId/builds')
export class BuildsController {
  constructor(private readonly buildsService: BuildsService) {}

  @Get()
  @ApiOperation({ summary: 'List builds for a script' })
  async list(
    @CurrentUser() user: RequestUser,
    @Param('scriptId') scriptId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.buildsService.listForScript(user.id, scriptId, pagination);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a build for a script' })
  async create(
    @CurrentUser() user: RequestUser,
    @Param('scriptId') scriptId: string,
    @Body() dto: CreateBuildDto,
  ) {
    return this.buildsService.create(user.id, scriptId, dto);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a packaged build' })
  async download(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filename, body } = await this.buildsService.download(user.id, id);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(body);
  }
}
