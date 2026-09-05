/**
 * Local storefront fixtures for the public Seller directory.
 *
 * Creates three approved Seller accounts in MySQL, then writes their public-only profiles
 * to MongoDB. It is idempotent and deliberately never overwrites an existing password.
 * Do not run this against a production database.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { requireMongoUri } from './mongo/mongo.config';
import {
  MarketplaceSeller,
  MarketplaceSellerSchema,
} from './sellers/schemas/marketplace-seller.schema';

const FIXTURE_PASSWORD = 'Seller12345!';

const SELLERS = [
  {
    email: 'store@hideauto.local',
    name: 'HideAuto',
    contact: 'https://hideauto.local',
    slug: 'hideauto',
    headline: 'Official automation tools from the HideAuto team.',
    verified: true,
  },
  {
    email: 'hello@growthforge.local',
    name: 'Growth Forge',
    contact: 'https://growthforge.local',
    slug: 'growth-forge',
    headline: 'Practical browser automation for growth teams.',
    verified: false,
  },
  {
    email: 'team@workflowlab.local',
    name: 'Workflow Lab',
    contact: 'https://workflowlab.local',
    slug: 'workflow-lab',
    headline: 'Reliable data and operations workflows.',
    verified: false,
  },
] as const;

async function main() {
  const prisma = new PrismaClient();
  await mongoose.connect(requireMongoUri(process.env.MONGO_URI));
  const model = mongoose.models[MarketplaceSeller.name] ?? mongoose.model(
    MarketplaceSeller.name,
    MarketplaceSellerSchema,
  );

  try {
    for (const profile of SELLERS) {
      const seller = await prisma.seller.upsert({
        where: { email: profile.email },
        create: {
          email: profile.email,
          name: profile.name,
          password: await bcrypt.hash(FIXTURE_PASSWORD, 10),
          contact: profile.contact,
          status: 'APPROVED',
        },
        update: {
          name: profile.name,
          contact: profile.contact,
          status: 'APPROVED',
          statusReason: null,
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });

      await model.findOneAndUpdate(
        { sellerId: seller.id },
        {
          $set: {
            slug: profile.slug,
            displayName: profile.name,
            headline: profile.headline,
            verified: profile.verified,
            status: 'APPROVED',
            updatedAt: seller.updatedAt,
          },
          $setOnInsert: { sellerId: seller.id, createdAt: seller.createdAt },
        },
        { upsert: true, setDefaultsOnInsert: true, timestamps: false },
      );
    }

    console.log(`Seeded ${SELLERS.length} public marketplace sellers; HideAuto is verified.`);
  } finally {
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('Could not seed public marketplace sellers:', error);
  process.exitCode = 1;
});
