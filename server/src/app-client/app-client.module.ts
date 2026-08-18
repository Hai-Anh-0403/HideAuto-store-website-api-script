import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BuildsModule } from '../builds/builds.module';
import { AppClientController } from './app-client.controller';
import { ActivationService } from './activation.service';
import { AppDownloadService } from './app-download.service';
import { FlowdeskService } from './flowdesk.service';
import { AppAuthGuard } from './app-auth.guard';

@Module({
  imports: [PrismaModule, BuildsModule],
  controllers: [AppClientController],
  providers: [
    ActivationService,
    AppDownloadService,
    FlowdeskService,
    AppAuthGuard,
  ],
  exports: [ActivationService],
})
export class AppClientModule {}
