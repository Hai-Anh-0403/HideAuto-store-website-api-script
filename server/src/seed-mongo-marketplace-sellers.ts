import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import { requireMongoUri } from './mongo/mongo.config';
import { MarketplaceSellerProjectorService } from './sellers/marketplace-seller-projector.service';
import {
  MarketplaceSeller,
  MarketplaceSellerSchema,
  MarketplaceSellerStatus,
} from './sellers/schemas/marketplace-seller.schema';

async function main() {
  const prisma = new PrismaClient();
  await mongoose.connect(requireMongoUri(process.env.MONGO_URI));

  const MarketplaceSellerModel =
    mongoose.models[MarketplaceSeller.name] ??
    mongoose.model(MarketplaceSeller.name, MarketplaceSellerSchema);
  const projector = new MarketplaceSellerProjectorService(
    MarketplaceSellerModel,
  );

  try {
    const sellers = await prisma.seller.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const result = await projector.reconcile(
      sellers.map((seller) => ({
        ...seller,
        status: seller.status as MarketplaceSellerStatus,
      })),
    );
    console.log(`Reconciled ${result.processed} marketplace sellers into MongoDB.`);
  } finally {
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}

void main();
