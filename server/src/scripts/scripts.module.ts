import { Module } from '@nestjs/common';
import { ScriptsController } from './scripts.controller';
import { AppsUploadController } from './apps-upload.controller';
import { ScriptsService } from './scripts.service';

@Module({
  controllers: [ScriptsController, AppsUploadController],
  providers: [ScriptsService],
  exports: [ScriptsService],
})
export class ScriptsModule {}
