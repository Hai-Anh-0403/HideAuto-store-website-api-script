import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import { scripts } from './seeds/frontend-catalog.data';
import { Script, ScriptSchema } from './scripts/schemas/script.schema';
import { ScriptVersion, ScriptVersionSchema } from './scripts/schemas/script-version.schema';
import { Tag, TagSchema } from './tags/schemas/tag.schema';

async function main() {
  const uri = process.env.MONGO_URI?.trim();
  if (!uri) throw new Error('MONGO_URI must be configured');
  const prisma = new PrismaClient();
  await mongoose.connect(uri);
  const ScriptModel = mongoose.models[Script.name] ?? mongoose.model(Script.name, ScriptSchema);
  const VersionModel = mongoose.models[ScriptVersion.name] ?? mongoose.model(ScriptVersion.name, ScriptVersionSchema);
  const TagModel = mongoose.models[Tag.name] ?? mongoose.model(Tag.name, TagSchema);
  try {
    const seller = await prisma.seller.findUnique({ where: { email: process.env.MONGO_DEMO_SELLER_EMAIL ?? 'seller@local.test' }, select: { id: true } });
    if (!seller) throw new Error('Demo seller not found. Run pnpm db:seed:demo first.');
    for (const item of scripts) {
      const tag = await TagModel.findOneAndUpdate(
        { slug: item.category.toLowerCase() },
        { $setOnInsert: { slug: item.category.toLowerCase(), name: item.category } },
        { upsert: true, new: true },
      );
      const script = await ScriptModel.findOneAndUpdate(
        { slug: item.slug },
        {
          $set: {
            sellerId: seller.id,
            slug: item.slug,
            name: item.name,
            shortDescription: item.outcome,
            status: 'PUBLISHED',
            tagIds: [tag._id],
            thumbnailStorageKey: item.image,
            galleryStorageKeys: [item.image],
            views: item.views,
            publishedAt: new Date(),
            latestApprovedVersionId: null,
          },
        },
        { upsert: true, new: true },
      );
      const version = await VersionModel.findOneAndUpdate(
        { scriptId: script._id, version: item.version },
        { $set: { sellerId: seller.id, status: 'APPROVED', scrubbedGraphStorageKey: 'seed/graph.json', changelog: 'Frontend demo seed', releasedAt: new Date() } },
        { upsert: true, new: true },
      );
      await ScriptModel.updateOne({ _id: script._id }, { $set: { latestApprovedVersionId: version._id } });
    }
    console.log(`Seeded ${scripts.length} frontend scripts into MongoDB.`);
  } finally { await prisma.$disconnect(); await mongoose.disconnect(); }
}

void main();
