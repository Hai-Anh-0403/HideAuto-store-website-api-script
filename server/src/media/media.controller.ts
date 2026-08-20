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
import { promises as fs } from 'fs';
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
};

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
 * Serve endpoint — public, no auth required. Content-addressed files are immutable.
 */
@ApiTags('Media')
@Controller('api/v1/media')
export class MediaServeController {
  constructor(private readonly storage: StorageService) {}

  @Get('{*ref}')
  @ApiOperation({ summary: 'Serve a stored media file (public)' })
  async serve(
    @Param('ref') ref: string,
    @Res() res: Response,
  ) {
    const filePath = this.storage.pathFor(ref);

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    const data = await fs.readFile(filePath);
    res.send(data);
  }
}
