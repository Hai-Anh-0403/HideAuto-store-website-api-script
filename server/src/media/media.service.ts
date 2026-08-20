import { Injectable, BadRequestException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

type MediaType = 'thumbnail' | 'image' | 'description';

const MAX_THUMBNAIL_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  async upload(
    file: Express.Multer.File,
    type: MediaType,
  ): Promise<{ url: string }> {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
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
