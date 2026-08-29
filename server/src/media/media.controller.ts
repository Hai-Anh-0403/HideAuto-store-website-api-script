import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SellerAuthGuard } from '../auth/seller-auth.guard';
import { ApprovedSellerGuard } from '../auth/approved-seller.guard';
import { StorageService } from '../storage/storage.service';
import { MediaService } from './media.service';

const UPLOAD_LIMITS = { limits: { fileSize: 3 * 1024 * 1024, files: 1 } };

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.exe': 'application/octet-stream',
};

/** Images stay inline for `<img>`; everything else forces a Save As dialog. */
const INLINE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Upload endpoint — requires seller auth.
 */
@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SellerAuthGuard, ApprovedSellerGuard)
@Controller('api/v1/media')
export class MediaUploadController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a media image (thumbnail, gallery, or rich-text inline)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const mediaType = type as 'thumbnail' | 'image' | 'description' | undefined;
    if (mediaType && !['thumbnail', 'image', 'description'].includes(mediaType)) {
      throw new BadRequestException(
        'type must be one of: thumbnail, image, description',
      );
    }

    return this.mediaService.upload(file, mediaType || 'image');
  }
}

/**
 * Serve endpoint — public, no auth required.
 *
 * Mini-app exe/icon keys (`mini-apps/…`) and content-addressed media share this path.
 * Streams from disk so large installers are not buffered entirely into RAM
 * (`docs/MINI_APP_DOWNLOAD.md`).
 */
@ApiTags('Media')
@Controller('api/v1/media')
export class MediaServeController {
  constructor(private readonly storage: StorageService) {}

  @Get('{*ref}')
  @ApiOperation({ summary: 'Serve a stored media/artifact file (public)' })
  async serve(
    @Param('ref') ref: string,
    @Res() res: Response,
  ) {
    const normalized = Array.isArray(ref) ? ref.join('/') : ref;
    const filePath = this.storage.pathFor(normalized);

    let size: number;
    try {
      const st = await fs.stat(filePath);
      size = st.size;
    } catch {
      throw new NotFoundException('File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';
    const filename = path.basename(filePath) || 'download';

    res.set({
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // Without attachment, Chrome often navigates (or Safe-Browsing-blocks) an .exe
      // instead of saving — and `<a download>` alone is not enough across the rewrite.
      ...(INLINE_EXT.has(ext)
        ? {}
        : { 'Content-Disposition': contentDisposition(filename) }),
    });

    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).end();
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}
