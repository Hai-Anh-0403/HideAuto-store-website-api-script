import { Module } from '@nestjs/common';
import { BuildsController } from './builds.controller';
import { BuildsService } from './builds.service';
import { PackagingService } from './packaging.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BuildsController],
  providers: [BuildsService, PackagingService],
  exports: [PackagingService],
})
export class BuildsModule {}
