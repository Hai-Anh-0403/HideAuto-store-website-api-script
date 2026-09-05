import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import slugify from 'slugify';
import { Model } from 'mongoose';
import {
  MarketplaceSeller,
  MarketplaceSellerStatus,
} from './schemas/marketplace-seller.schema';

export interface MarketplaceSellerProjection {
  id: string;
  name: string;
  status: MarketplaceSellerStatus;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MarketplaceSellerProjectorService {
  constructor(
    @InjectModel(MarketplaceSeller.name)
    private readonly marketplaceSellers: Model<MarketplaceSeller>,
  ) {}

  async project(seller: MarketplaceSellerProjection): Promise<void> {
    await this.marketplaceSellers.findOneAndUpdate(
      { sellerId: seller.id },
      {
        $set: {
          displayName: seller.name,
          status: seller.status,
          updatedAt: seller.updatedAt,
        },
        $setOnInsert: {
          sellerId: seller.id,
          slug: this.createInitialSlug(seller.name, seller.id),
          createdAt: seller.createdAt,
        },
      },
      // Keep timestamps authoritative from MySQL rather than replacing `updatedAt`
      // with the time the projector happened to run.
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
        timestamps: false,
      },
    );
  }

  async reconcile(
    sellers: Iterable<MarketplaceSellerProjection>,
  ): Promise<{ processed: number }> {
    let processed = 0;

    for (const seller of sellers) {
      await this.project(seller);
      processed += 1;
    }

    return { processed };
  }

  private createInitialSlug(name: string, sellerId: string): string {
    const base = slugify(name, { lower: true, strict: true }) || 'seller';
    return `${base}-${sellerId.slice(-8).toLowerCase()}`;
  }
}
