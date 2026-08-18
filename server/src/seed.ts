/**
 * Bootstrap data: the baseline tag catalog plus an initial admin.
 *
 * Lives under `src/` so `nest build` compiles it — the container runs the compiled
 * `dist/seed.js` on startup, where `ts-node` is not installed.
 *
 * Idempotent: every write is an upsert, so it is safe to run on every boot. An existing
 * admin keeps its current password; this never resets one.
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

/** Defaulted in compose for a working local stack — never acceptable in production. */
const INSECURE_DEFAULT_PASSWORD = 'admin12345';

async function seedTags(): Promise<number> {
  for (const tag of TAGS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name, color: tag.color },
      create: tag,
    });
  }
  return TAGS.length;
}

async function seedAdmin(): Promise<string> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return 'ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin created, so no one can approve sellers yet';
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    return `admin ${email} already exists (password left untouched)`;
  }

  await prisma.admin.create({
    data: { email, password: await bcrypt.hash(password, 10) },
  });

  if (password === INSECURE_DEFAULT_PASSWORD) {
    console.warn(
      `[seed] ⚠  admin ${email} was created with the well-known default password. ` +
        'Fine on a laptop, never on anything reachable — set ADMIN_PASSWORD.',
    );
  }
  return `created admin ${email}`;
}

async function main(): Promise<void> {
  const tags = await seedTags();
  const admin = await seedAdmin();
  console.log(`[seed] ${tags} tags ready · ${admin}`);
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
