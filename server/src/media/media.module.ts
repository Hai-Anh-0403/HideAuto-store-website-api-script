import { Module } from '@nestjs/common';
import { MediaUploadController, MediaServeController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaUploadController, MediaServeController],
  providers: [MediaService],
})
export class MediaModule {}
