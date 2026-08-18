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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { BuildsService } from './builds.service';
import { CreateBuildDto } from './dto/create-build.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Builds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard)
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
}
