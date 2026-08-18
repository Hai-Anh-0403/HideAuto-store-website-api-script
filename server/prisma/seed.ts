/**
 * Development seed: the bootstrap admin plus the baseline tag catalog.
 *
 * Idempotent — every write is an upsert, so re-running it never duplicates rows and
 * never clobbers an existing admin password. Credentials come from the environment;
 * seeding is skipped rather than defaulted when ADMIN_PASSWORD is absent.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TAGS = [
  { name: 'Social', slug: 'social', color: '#6366f1' },
  { name: 'E-commerce', slug: 'ecommerce', color: '#10b981' },
  { name: 'Scraping', slug: 'scraping', color: '#f59e0b' },
  { name: 'Registration', slug: 'registration', color: '#ec4899' },
  { name: 'Automation', slug: 'automation', color: '#3b82f6' },
  { name: 'AI', slug: 'ai', color: '#8b5cf6' },
];

async function seedTags(): Promise<void> {
  for (const tag of TAGS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name, color: tag.color },
      create: tag,
    });
  }
  console.log(`Seeded ${TAGS.length} tags`);
}

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  // `update: {}` on purpose: an existing admin keeps its current password.
  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, password: await bcrypt.hash(password, 10) },
  });
  console.log(`Seeded admin ${email}`);
}

async function main(): Promise<void> {
  await seedTags();
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
