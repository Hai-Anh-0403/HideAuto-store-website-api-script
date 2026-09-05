import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketplaceSellerProjectorService } from './marketplace-seller-projector.service';
import {
  MarketplaceSeller,
  MarketplaceSellerSchema,
} from './schemas/marketplace-seller.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketplaceSeller.name, schema: MarketplaceSellerSchema },
    ]),
  ],
  providers: [MarketplaceSellerProjectorService],
  exports: [MongooseModule, MarketplaceSellerProjectorService],
})
export class MarketplaceSellersModule {}
