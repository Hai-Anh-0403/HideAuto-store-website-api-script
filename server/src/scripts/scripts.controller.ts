import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { ApprovedSellerGuard } from '../auth/approved-seller.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { ScriptsService } from './scripts.service';
import { CreateScriptDto } from './dto/create-script.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListScriptsDto } from './dto/list-scripts.dto';

/**
 * Uploads are untrusted: cap the request before multer buffers it into memory.
 * 128 MB comfortably covers a packaged mini-app installer.
 */
const UPLOAD_LIMITS = { limits: { fileSize: 128 * 1024 * 1024, files: 1 } };

@ApiTags('Scripts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)
@Controller('api/v1/scripts')
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Get()
  @ApiOperation({
    summary: 'List seller scripts (paginated, searchable, filterable)',
  })
  async list(@CurrentUser() user: RequestUser, @Query() query: ListScriptsDto) {
    return this.scriptsService.list(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new script' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateScriptDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.scriptsService.create(user.id, dto, file);
  }

  @Post('inspect')
  @ApiOperation({
    summary: 'Scan a file without saving it (pre-upload preview)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async inspectUpload(@UploadedFile() file: Express.Multer.File) {
    return this.scriptsService.inspectFile(file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get script detail with versions' })
  async findOne(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.scriptsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update script listing' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateScriptDto,
  ) {
    return this.scriptsService.update(user.id, id, dto);
  }

  @Post(':id/inspect')
  @ApiOperation({ summary: 'Upload and scan a file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async inspect(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.scriptsService.inspect(user.id, id, file);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download the stored (scrubbed) graph for a script' })
  async download(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filename, body } = await this.scriptsService.download(user.id, id);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(body);
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a new version' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async createVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.scriptsService.createVersion(user.id, id, dto, file);
  }

  @Delete(':id/versions/:versionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a pending or rejected version (mis-upload cleanup)',
  })
  async deleteVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    await this.scriptsService.deleteVersion(user.id, id, versionId);
  }

  @Post(':id/versions/:versionId/rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make an older approved version live again' })
  async rollbackVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.scriptsService.rollbackVersion(user.id, id, versionId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit script for review' })
  async submit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.scriptsService.submit(user.id, id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive script' })
  async archive(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.scriptsService.archive(user.id, id);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive script' })
  async unarchive(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.scriptsService.unarchive(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete draft script' })
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    await this.scriptsService.remove(user.id, id);
  }
}
