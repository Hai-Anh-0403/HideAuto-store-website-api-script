import { Injectable, BadRequestException } from '@nestjs/common';
import imageSize from 'image-size';
import { StorageService } from '../storage/storage.service';

type MediaType = 'thumbnail' | 'image' | 'description';

const MAX_THUMBNAIL_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB

const ALLOWED_IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  async upload(
    file: Express.Multer.File,
    type: MediaType,
  ): Promise<{ url: string }> {
    // Validate actual image content — never trust client-supplied mimetype.
    let detected: string | undefined;
    try {
      const result = imageSize(file.buffer);
      detected = result.type;
    } catch {
      throw new BadRequestException('File is not a valid image');
    }

    if (!detected || !ALLOWED_IMAGE_TYPES.has(detected)) {
      throw new BadRequestException(
        `Unsupported image format "${detected ?? 'unknown'}". Allowed: ${[...ALLOWED_IMAGE_TYPES].join(', ')}`,
      );
    }

    const limit = type === 'thumbnail' ? MAX_THUMBNAIL_SIZE : MAX_IMAGE_SIZE;
    if (file.size > limit) {
      const limitMB = limit / (1024 * 1024);
      throw new BadRequestException(
        `File exceeds the ${limitMB} MB limit for type "${type}"`,
      );
    }

    const result = await this.storage.saveBytes(
      file.buffer,
      'media',
      file.originalname,
    );

    return { url: `/api/v1/media/${result.ref}` };
  }
}
