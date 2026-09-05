import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketplaceSellersModule } from '../sellers/marketplace-sellers.module';

@Module({
  imports: [PrismaModule, MarketplaceSellersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
