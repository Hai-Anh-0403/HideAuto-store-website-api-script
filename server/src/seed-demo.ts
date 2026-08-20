/**
 * Demo data: one working seller account with scripts, versions, keys and members.
 *
 * Why it exists: `seed.ts` only creates tags and an **admin**, and the seller portal's
 * login form calls the *seller* endpoint — so the admin account can never sign in there
 * and a fresh stack looks empty. This fills the portal with something to click.
 *
 * Development only. Everything it writes is fake and the password is public knowledge;
 * never run it against anything reachable.
 *
 * Idempotent: keyed on unique columns (seller email, script slug, key, member id), so
 * re-running updates in place. The demo seller's password IS reset on every run, so the
 * credentials printed at the end always work.
 *
 * Uploads go through the real pipeline — `extractPackage` → `scrubCredentials` →
 * `deriveMetadata` — so the rows look exactly like a genuine publish, embedded secrets
 * included (one demo script carries them on purpose, to show the scan blocking approval).
 *
 *   pnpm db:seed              # tags + admin first
 *   pnpm db:seed:demo         # then this
 *   pnpm db:seed:demo:clear   # and this to take it all back out
 */

import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { extractPackage } from './common/graph/package-extract';
import {
  deriveMetadata,
  scrubCredentials,
  type Json,
} from './common/graph/workflow-graph';
import {
  KEY_CODE_ALPHABET,
  KEY_CODE_LENGTH,
  formatKeyCode,
} from './keys/key-code';
import { StorageService } from './storage/storage.service';
import { seedTags } from './seed';
import { promises as fs } from 'fs';

/** `--clear` removes the demo seller and everything it owns instead of seeding. */
const CLEAR = process.argv.includes('--clear');

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'seller@local.test';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'seller12345';
const DEMO_NAME = process.env.DEMO_NAME ?? 'Demo Automation Store';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

/**
 * A stable activation code in the real format (`SK-XXXXX-…`).
 *
 * `generateKeyCode()` is random by design, which would mint four new keys on every run.
 * Hashing the fixture's seed into the same alphabet keeps the demo idempotent and still
 * shows the seller exactly the shape of code the API issues.
 */
const stableKeyCode = (seed: string) => {
  const digest = createHash('sha256').update(`storeAutoHide:key:${seed}`).digest();
  let body = '';
  for (let i = 0; i < KEY_CODE_LENGTH; i++) {
    body += KEY_CODE_ALPHABET[digest[i] % KEY_CODE_ALPHABET.length];
  }
  return formatKeyCode(body);
};

/** Stable fake key/user ids: same input ⇒ same value, so re-runs stay idempotent. */
const stableHex = (seed: string, bytes: number) =>
  createHash('sha256')
    .update(`storeAutoHide:demo:${seed}`)
    .digest('hex')
    .slice(0, bytes * 2);

// ─── Graphs ─────────────────────────────────────────────────────────────
// Shaped like real hideflow exports: `nodes[].data.code` plus declared `variables`.
// The `label` on a variable is kept for realism but never surfaces: `deriveMetadata`
// reports `label = key` on purpose and refuses to copy seller values into `example`.

const postGraph: Json = {
  nodes: [
    {
      id: 'n1',
      data: {
        code: 'openConnect',
        openConnectMode: 'otherApp',
        openConnectPlatform: 'hidemium',
        openConnectProxyEnabled: true,
      },
    },
    { id: 'n2', data: { code: 'gotoUrl', url: '{{page_url}}' } },
    { id: 'n3', data: { code: 'waitForSelector', selector: '[role="textbox"]' } },
    { id: 'n4', data: { code: 'typeText', text: '{{post_content}}' } },
    { id: 'n5', data: { code: 'clickElement', selector: '[aria-label="Post"]' } },
    { id: 'n6', data: { code: 'loop' } },
    { id: 'n7', data: { code: 'screenshot' } },
  ],
  edges: [],
  variables: [
    { key: 'page_url', label: 'Fanpage URL' },
    { key: 'post_content', label: 'Nội dung bài đăng' },
    { key: 'profile_uuid', value: 'builtin' },
  ],
};

const scrapeGraph: Json = {
  nodes: [
    {
      id: 'n1',
      data: {
        code: 'openConnect',
        openConnectMode: 'otherApp',
        openConnectPlatform: 'hidemium',
      },
    },
    { id: 'n2', data: { code: 'gotoUrl', url: 'https://shopee.vn/{{shop_id}}' } },
    { id: 'n3', data: { code: 'loop' } },
    { id: 'n4', data: { code: 'getText', selector: '.order-row' } },
    { id: 'n5', data: { code: 'extractionInText' } },
    {
      id: 'n6',
      data: {
        code: 'writeSpreadsheet',
        writeSpreadsheetSource: 'googleSheet',
        spreadsheetId: '{{sheet_id}}',
      },
    },
    { id: 'n7', data: { code: 'browserClose' } },
  ],
  edges: [],
  variables: [
    { key: 'shop_id', label: 'Shop ID' },
    { key: 'sheet_id', label: 'Google Sheet ID' },
  ],
};

/**
 * Deliberately dirty: a real-looking API key, an SMTP password and a `runCommand` node.
 * Seeding it proves the scan works end to end — the version lands with
 * `embedded_credentials_count = 2`, which `admin.service.ts` refuses to approve.
 */
const dirtyGraph: Json = {
  nodes: [
    {
      id: 'n1',
      data: {
        code: 'openConnect',
        openConnectMode: 'otherApp',
        openConnectPlatform: 'hidemium',
      },
    },
    { id: 'n2', data: { code: 'gotoUrl', url: 'https://mail.google.com' } },
    {
      id: 'n3',
      data: {
        code: 'aiLlm',
        aiLlmProvider: 'openai',
        apiKey: 'sk-demo-not-a-real-key',
      },
    },
    { id: 'n4', data: { code: 'getCode2Fa' } },
    { id: 'n5', data: { code: 'runCommand', command: 'echo warmup' } },
    { id: 'n6', data: { code: 'typeText', text: '{{mail_body}}' } },
  ],
  edges: [],
  variables: [
    { key: 'mail_body', label: 'Nội dung mail' },
    { key: 'smtp_password', value: 'demo-plaintext-secret' },
  ],
};

// ─── Catalog ────────────────────────────────────────────────────────────

interface DemoVersion {
  version: string;
  changelog: string;
  status: Prisma.ScriptVersionCreateManyInput['status'];
  graph: Json;
  releasedAt?: Date;
}

interface DemoScript {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  tagSlugs: string[];
  status: Prisma.ScriptCreateManyInput['status'];
  publishedAt?: Date;
  downloads: number;
  views: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  versions: DemoVersion[];
}

const SCRIPTS: DemoScript[] = [
  {
    slug: 'demo-facebook-auto-poster',
    name: 'Facebook Auto Poster',
    shortDescription: 'Đăng bài hàng loạt lên fanpage theo lịch.',
    description:
      'Mở profile Hidemium, vào fanpage, điền nội dung và đăng. Lặp qua danh sách bài viết, ' +
      'chụp màn hình sau mỗi lần đăng để đối soát.',
    tagSlugs: ['social', 'automation'],
    status: 'PUBLISHED',
    publishedAt: ago(12),
    downloads: 184,
    views: 1263,
    ratingAvg: 4.6,
    ratingCount: 23,
    createdAt: ago(30),
    versions: [
      {
        version: '1.0.0',
        changelog: 'Bản phát hành đầu tiên.',
        status: 'APPROVED',
        graph: postGraph,
        releasedAt: ago(12),
      },
      {
        version: '1.1.0',
        changelog: 'Thêm chụp màn hình sau khi đăng, chờ selector lâu hơn.',
        status: 'PENDING_REVIEW',
        graph: postGraph,
      },
    ],
  },
  {
    slug: 'demo-shopee-order-scraper',
    name: 'Shopee Order Scraper',
    shortDescription: 'Quét đơn hàng Shopee và ghi thẳng vào Google Sheet.',
    description:
      'Duyệt danh sách đơn của shop, bóc tách mã đơn / trạng thái / giá trị rồi ghi vào ' +
      'Google Sheet. Chạy theo lịch để có báo cáo hằng ngày.',
    tagSlugs: ['ecommerce', 'scraping'],
    status: 'PENDING_REVIEW',
    downloads: 0,
    views: 47,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: ago(6),
    versions: [
      {
        version: '1.0.0',
        changelog: 'Bản đầu tiên gửi duyệt.',
        status: 'PENDING_REVIEW',
        graph: scrapeGraph,
      },
    ],
  },
  {
    slug: 'demo-gmail-warmup-bot',
    name: 'Gmail Warmup Bot',
    shortDescription: 'Nuôi tài khoản Gmail: đọc, trả lời, đánh dấu không spam.',
    description:
      'Bản nháp còn để lộ API key và mật khẩu SMTP trong graph — store đã xoá trắng khi lưu, ' +
      'nhưng version vẫn bị chặn duyệt cho tới khi seller upload bản sạch.',
    tagSlugs: ['registration', 'ai'],
    status: 'DRAFT',
    downloads: 0,
    views: 3,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: ago(2),
    versions: [
      {
        version: '0.9.0',
        changelog: 'Bản nháp nội bộ.',
        status: 'PENDING_REVIEW',
        graph: dirtyGraph,
      },
    ],
  },
];

interface DemoKey {
  seed: string;
  label: string;
  scriptSlug: string | null;
  status: Prisma.SellerKeyCreateManyInput['status'];
  maxUses?: number;
  usedCount?: number;
  expiresAt?: Date;
}

const KEYS: DemoKey[] = [
  {
    seed: 'fb-lifetime',
    label: 'FB Poster · vĩnh viễn',
    scriptSlug: 'demo-facebook-auto-poster',
    status: 'ACTIVE',
  },
  {
    seed: 'fb-trial',
    label: 'FB Poster · dùng thử 30 ngày',
    scriptSlug: 'demo-facebook-auto-poster',
    status: 'ACTIVE',
    maxUses: 5,
    usedCount: 2,
    expiresAt: ahead(30),
  },
  {
    seed: 'fb-revoked',
    label: 'FB Poster · đã thu hồi',
    scriptSlug: 'demo-facebook-auto-poster',
    status: 'REVOKED',
    maxUses: 1,
    usedCount: 1,
  },
  {
    seed: 'shop-wide',
    label: 'Key toàn shop',
    scriptSlug: null,
    status: 'ACTIVE',
    maxUses: 50,
    usedCount: 7,
  },
];

interface DemoMember {
  seed: string;
  userEmail: string;
  userName: string;
  status: Prisma.SellerMemberCreateManyInput['status'];
  allScripts: boolean;
  lastSeenAt: Date;
  redeemedAt: Date;
  scriptSlugs: string[];
  /** Which demo key this buyer redeemed — drives the provenance panel. */
  redeemedKeySeed?: string;
  /** Machines this buyer has activated on. */
  devices?: { machineId: string; activations: number; lastSeenAt: Date }[];
  blockedDevices?: string[];
}

const MEMBERS: DemoMember[] = [
  {
    seed: 'member-online',
    userEmail: 'buyer.online@local.test',
    userName: 'Nguyễn An',
    status: 'ACTIVE',
    allScripts: false,
    lastSeenAt: new Date(Date.now() - 60_000),
    redeemedAt: ago(9),
    scriptSlugs: ['demo-facebook-auto-poster'],
    redeemedKeySeed: 'fb-trial',
    devices: [
      { machineId: 'DESKTOP-A17C3E', activations: 14, lastSeenAt: new Date(Date.now() - 60_000) },
      { machineId: 'LAPTOP-9K2M08', activations: 3, lastSeenAt: ago(2) },
    ],
  },
  {
    seed: 'member-offline',
    userEmail: 'buyer.offline@local.test',
    userName: 'Trần Bình',
    status: 'ACTIVE',
    allScripts: true,
    lastSeenAt: ago(3),
    redeemedAt: ago(21),
    scriptSlugs: [],
    redeemedKeySeed: 'shop-wide',
    devices: [{ machineId: 'WIN-4B7DQ2', activations: 41, lastSeenAt: ago(3) }],
  },
  {
    seed: 'member-blocked',
    userEmail: 'buyer.blocked@local.test',
    userName: 'Lê Cường',
    status: 'BLOCKED',
    allScripts: false,
    lastSeenAt: ago(14),
    redeemedAt: ago(25),
    scriptSlugs: ['demo-facebook-auto-poster'],
    blockedDevices: ['DESKTOP-7F2A91'],
    redeemedKeySeed: 'fb-revoked',
    devices: [{ machineId: 'DESKTOP-7F2A91', activations: 2, lastSeenAt: ago(14) }],
  },
];

// ─── Seeding ────────────────────────────────────────────────────────────

const storage = new StorageService(new ConfigService());

/** Run a graph through the real publish pipeline and persist only the scrubbed copy. */
async function ingestGraph(graph: Json, filename: string) {
  const pkg = await extractPackage(
    Buffer.from(JSON.stringify(graph), 'utf8'),
    filename,
  );
  const { graph: clean, scan } = scrubCredentials(pkg.graph);
  const stored = await storage.saveBytes(
    Buffer.from(JSON.stringify(clean), 'utf8'),
    'graphs',
    filename,
  );
  const metadata = deriveMetadata(clean);

  return {
    columns: {
      fileUrl: stored.ref,
      sourceChecksum: stored.checksum,
      sourceFilename: filename,
      delivery: pkg.delivery,
      graphExtracted: pkg.graphExtracted,
      appId: pkg.appId,
      appName: pkg.appName,
      nodeCount: metadata.node_count,
      nodeGroupsUsed: metadata.node_groups_used,
      usesControlFlow: metadata.uses_control_flow,
      subWorkflowIds: metadata.sub_workflow_ids,
      capabilities: metadata.capabilities as unknown as Prisma.InputJsonValue,
      requiredVars: metadata.required_variables as unknown as Prisma.InputJsonValue,
      scan: scan as unknown as Prisma.InputJsonValue,
      scannedAt: new Date(),
    },
    delivery: pkg.delivery,
    scan,
  };
}

async function seedSeller(prisma: PrismaClient) {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.seller.upsert({
    where: { email: DEMO_EMAIL },
    // Password is reset on purpose: the credentials this prints must always work.
    update: { name: DEMO_NAME, password, status: 'APPROVED' },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      password,
      contact: 'https://t.me/demo_store',
      status: 'APPROVED',
      createdAt: ago(45),
    },
  });
}

async function seedScripts(
  prisma: PrismaClient,
  sellerId: string,
  sellerName: string,
) {
  const tags = await prisma.tag.findMany({ select: { id: true, slug: true } });
  const tagIdBySlug = new Map(tags.map((tag) => [tag.slug, tag.id]));
  const scriptIdBySlug = new Map<string, string>();
  let dirtyVersions = 0;

  for (const demo of SCRIPTS) {
    const tagIds = demo.tagSlugs
      .map((slug) => tagIdBySlug.get(slug))
      .filter((id): id is string => id !== undefined)
      .map((id) => ({ id }));

    const base = {
      name: demo.name,
      shortDescription: demo.shortDescription,
      description: demo.description,
      sellerId,
      sellerName,
      status: demo.status,
      publishedAt: demo.publishedAt ?? null,
      downloads: demo.downloads,
      views: demo.views,
      ratingAvg: demo.ratingAvg,
      ratingCount: demo.ratingCount,
    };

    const script = await prisma.script.upsert({
      where: { slug: demo.slug },
      update: { ...base, tags: { set: tagIds } },
      create: {
        ...base,
        slug: demo.slug,
        createdAt: demo.createdAt,
        tags: { connect: tagIds },
      },
    });
    scriptIdBySlug.set(demo.slug, script.id);

    let latestId: string | null = null;
    let latestVersion: string | null = null;
    let latestIngest: Awaited<ReturnType<typeof ingestGraph>> | null = null;
    let hasApproved = false;

    for (const demoVersion of demo.versions) {
      const ingested = await ingestGraph(
        demoVersion.graph,
        `${demo.slug}-${demoVersion.version}.json`,
      );
      if (ingested.scan.embedded_credentials_count > 0) dirtyVersions++;

      // The review columns are reset explicitly. Without them, a re-run over a version
      // an admin already approved leaves the row back at PENDING_REVIEW while still
      // claiming it was reviewed — "idempotent" has to cover the whole row.
      const versionBase = {
        changelog: demoVersion.changelog,
        status: demoVersion.status,
        releasedAt: demoVersion.releasedAt ?? null,
        reviewedAt: demoVersion.releasedAt ?? null,
        reviewedBy: null,
        reviewNote: null,
        ...ingested.columns,
      };

      const version = await prisma.scriptVersion.upsert({
        where: {
          scriptId_version: {
            scriptId: script.id,
            version: demoVersion.version,
          },
        },
        update: versionBase,
        create: {
          scriptId: script.id,
          version: demoVersion.version,
          ...versionBase,
        },
      });
      // The live pointer follows the newest **approved** version, exactly like the real
      // flow: an upload waiting for review must not become what buyers download. A listing
      // with nothing approved yet still shows its newest upload, the way `addVersion` does
      // while a draft is still finding its shape.
      const approved = demoVersion.status === 'APPROVED';
      if (approved || !hasApproved) {
        latestId = version.id;
        latestVersion = version.version;
        latestIngest = ingested;
        hasApproved = hasApproved || approved;
      }
    }

    // Listing metadata mirrors the live version's graph, same as a real publish.
    if (latestId && latestVersion && latestIngest) {
      await prisma.script.update({
        where: { id: script.id },
        data: {
          latestVersion,
          latestVersionId: latestId,
          hasMiniApp: latestIngest.delivery === 'mini_app_exe',
          nodeCount: latestIngest.columns.nodeCount,
          nodeGroupsUsed: latestIngest.columns.nodeGroupsUsed,
          capabilities: latestIngest.columns.capabilities,
        },
      });
    }
  }

  return { scriptIdBySlug, dirtyVersions };
}

async function seedKeys(
  prisma: PrismaClient,
  sellerId: string,
  scriptIdBySlug: Map<string, string>,
) {
  const rows: { key: string; label: string; seed: string }[] = [];

  for (const demo of KEYS) {
    const key = stableKeyCode(demo.seed);
    const data = {
      sellerId,
      scriptId: demo.scriptSlug
        ? (scriptIdBySlug.get(demo.scriptSlug) ?? null)
        : null,
      label: demo.label,
      status: demo.status,
      maxUses: demo.maxUses ?? null,
      usedCount: demo.usedCount ?? 0,
      expiresAt: demo.expiresAt ?? null,
    };
    await prisma.sellerKey.upsert({
      where: { key },
      update: data,
      create: { key, ...data },
    });
    rows.push({ key, label: demo.label, seed: demo.seed });
  }

  // Codes from an earlier run (or an earlier code format) would otherwise pile up next to
  // these. Scoped to the demo labels on purpose: keys a developer made by hand while
  // clicking around the portal are not this script's to delete.
  await prisma.sellerKey.deleteMany({
    where: {
      sellerId,
      label: { in: KEYS.map((demo) => demo.label) },
      key: { notIn: rows.map((row) => row.key) },
    },
  });

  return rows;
}

async function seedMembers(
  prisma: PrismaClient,
  sellerId: string,
  scriptIdBySlug: Map<string, string>,
  keyIdBySeed: Map<string, { id: string; scriptId: string | null }>,
) {
  for (const demo of MEMBERS) {
    const userId = stableHex(demo.seed, 12);
    const data = {
      userEmail: demo.userEmail,
      userName: demo.userName,
      status: demo.status,
      allScripts: demo.allScripts,
      lastSeenAt: demo.lastSeenAt,
      redeemedAt: demo.redeemedAt,
      blockedDevices: demo.blockedDevices ?? [],
      scriptIds: demo.scriptSlugs
        .map((slug) => scriptIdBySlug.get(slug))
        .filter((id): id is string => id !== undefined),
    };
    const member = await prisma.sellerMember.upsert({
      where: { sellerId_userId: { sellerId, userId } },
      update: data,
      create: { sellerId, userId, ...data },
    });

    // How they got in — the portal reads this to show "keys redeemed".
    const usedKey = demo.redeemedKeySeed
      ? keyIdBySeed.get(demo.redeemedKeySeed)
      : undefined;
    if (usedKey) {
      await prisma.keyRedemption.upsert({
        where: { keyId_memberId: { keyId: usedKey.id, memberId: member.id } },
        update: { scriptId: usedKey.scriptId },
        create: {
          keyId: usedKey.id,
          memberId: member.id,
          scriptId: usedKey.scriptId,
          createdAt: demo.redeemedAt,
        },
      });
    }

    // Machines, so the device list (and its block button) has something to act on.
    for (const device of demo.devices ?? []) {
      await prisma.memberDevice.upsert({
        where: {
          memberId_machineId: { memberId: member.id, machineId: device.machineId },
        },
        update: {
          // Re-point at the current app: script ids change whenever the demo is reset.
          scriptId: data.scriptIds[0] ?? null,
          activationCount: device.activations,
          lastSeenAt: device.lastSeenAt,
        },
        create: {
          memberId: member.id,
          machineId: device.machineId,
          scriptId: data.scriptIds[0] ?? null,
          activationCount: device.activations,
          firstSeenAt: demo.redeemedAt,
          lastSeenAt: device.lastSeenAt,
        },
      });
    }
  }
  return MEMBERS.length;
}

/**
 * Undo the seed: drop the demo seller and everything hanging off it.
 *
 * Deletion order is not cosmetic. `Seller` cascades only to `seller_sessions`, and
 * `mini_app_builds` cascades from nothing at all, so scripts / keys / members / builds
 * have to go by hand first; killing keys and members on the way takes `key_redemptions`
 * and `member_devices` with them, and killing scripts takes `script_versions`.
 *
 * Tags and the admin are left alone — those come from `seed.ts`, not from here.
 */
async function clearDemo(prisma: PrismaClient): Promise<string> {
  const seller = await prisma.seller.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });
  if (!seller) return `nothing to clear — no seller ${DEMO_EMAIL}`;

  const scripts = await prisma.script.findMany({
    where: { sellerId: seller.id },
    select: { id: true },
  });
  const scriptIds = scripts.map((script) => script.id);

  // Stored graphs are content-addressed, so a ref can be shared with a version that is
  // not the demo's. Collect the refs now and only unlink the orphans afterwards.
  const versions = await prisma.scriptVersion.findMany({
    where: { scriptId: { in: scriptIds } },
    select: { fileUrl: true },
  });
  const refs = [
    ...new Set(versions.flatMap((v) => (v.fileUrl ? [v.fileUrl] : []))),
  ];

  const builds = await prisma.miniAppBuild.deleteMany({
    where: { scriptId: { in: scriptIds } },
  });
  const keys = await prisma.sellerKey.deleteMany({
    where: { sellerId: seller.id },
  });
  const members = await prisma.sellerMember.deleteMany({
    where: { sellerId: seller.id },
  });
  const removed = await prisma.script.deleteMany({
    where: { sellerId: seller.id },
  });
  await prisma.seller.delete({ where: { id: seller.id } });

  let blobs = 0;
  for (const ref of refs) {
    if (await prisma.scriptVersion.count({ where: { fileUrl: ref } })) continue;
    try {
      await fs.unlink(storage.pathFor(ref));
      blobs++;
    } catch {
      // Already gone, or never written on this host — nothing to undo.
    }
  }

  return (
    `removed seller ${DEMO_EMAIL} · ${removed.count} scripts · ${keys.count} keys` +
    ` · ${members.count} members · ${builds.count} builds · ${blobs} stored graphs`
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    if (CLEAR) {
      console.log(`[seed:demo] ${await clearDemo(prisma)}`);
      return;
    }

    await seedTags(prisma);
    const seller = await seedSeller(prisma);
    const { scriptIdBySlug, dirtyVersions } = await seedScripts(
      prisma,
      seller.id,
      seller.name,
    );
    const keys = await seedKeys(prisma, seller.id, scriptIdBySlug);

    const keyRows = await prisma.sellerKey.findMany({
      where: { sellerId: seller.id },
      select: { id: true, key: true, scriptId: true },
    });
    const keyIdBySeed = new Map(
      keys.flatMap((row) => {
        const stored = keyRows.find((k) => k.key === row.key);
        return stored ? [[row.seed, { id: stored.id, scriptId: stored.scriptId }] as const] : [];
      }),
    );

    const members = await seedMembers(
      prisma,
      seller.id,
      scriptIdBySlug,
      keyIdBySeed,
    );

    console.log(
      `\n[seed:demo] ${SCRIPTS.length} scripts · ${keys.length} keys · ${members} members` +
        ` · ${dirtyVersions} version(s) flagged with embedded credentials (approval blocked)`,
    );
    console.log('\n  Portal  http://localhost:3000');
    console.log(`  Email   ${DEMO_EMAIL}`);
    console.log(`  Pass    ${DEMO_PASSWORD}`);
    console.log('\n  Demo keys:');
    for (const row of keys) console.log(`    ${row.key}  ${row.label}`);
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('[seed:demo] failed:', err);
  process.exitCode = 1;
});
