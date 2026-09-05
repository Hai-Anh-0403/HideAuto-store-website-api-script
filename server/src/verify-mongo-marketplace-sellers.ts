import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import { requireMongoUri } from './mongo/mongo.config';

const PUBLIC_FIELDS = new Set([
  '_id',
  '__v',
  'sellerId',
  'slug',
  'displayName',
  'avatarStorageKey',
  'headline',
  'verified',
  'status',
  'createdAt',
  'updatedAt',
]);

async function main() {
  const prisma = new PrismaClient();
  await mongoose.connect(requireMongoUri(process.env.MONGO_URI));

  try {
    const [mysqlSellers, mongoSellers] = await Promise.all([
      prisma.seller.findMany({
        select: { id: true, status: true },
      }),
      mongoose.connection.collection('marketplace_sellers').find({}).toArray(),
    ]);

    const mongoBySellerId = new Map(
      mongoSellers.map((seller) => [seller.sellerId as string, seller]),
    );
    const missing = mysqlSellers
      .filter((seller) => !mongoBySellerId.has(seller.id))
      .map((seller) => seller.id);
    const statusDrift = mysqlSellers
      .filter((seller) => mongoBySellerId.get(seller.id)?.status !== seller.status)
      .map((seller) => seller.id);
    const privateFields = mongoSellers.flatMap((seller) =>
      Object.keys(seller)
        .filter((field) => !PUBLIC_FIELDS.has(field))
        .map((field) => `${seller.sellerId}.${field}`),
    );
    const duplicateCount =
      mongoBySellerId.size === mongoSellers.length ? 0 : mongoSellers.length - mongoBySellerId.size;

    if (missing.length || statusDrift.length || privateFields.length || duplicateCount) {
      throw new Error(
        `Marketplace seller verification failed: missing=${missing.length}, ` +
          `statusDrift=${statusDrift.length}, privateFields=${privateFields.length}, ` +
          `duplicateSellerIds=${duplicateCount}`,
      );
    }

    console.log(
      `Verified ${mongoSellers.length} marketplace sellers: IDs, statuses, and public fields are in sync.`,
    );
  } finally {
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}

void main();
