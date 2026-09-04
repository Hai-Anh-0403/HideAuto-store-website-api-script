import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { StoreService } from '../src/store/store.service';

async function run() {
  const tagId = new Types.ObjectId();
  const scriptId = new Types.ObjectId();
  const versionId = new Types.ObjectId();
  const newerVersionId = new Types.ObjectId();
  let scriptQuery: Record<string, unknown> | undefined;
  let versionQuery: Record<string, unknown> | undefined;

  const scriptModel = {
    findOne: (query: Record<string, unknown>) => {
      scriptQuery = query;
      return {
        lean: () => Promise.resolve({
          _id: scriptId,
          slug: 'browser-helper',
          name: 'Browser Helper',
          shortDescription: 'Automates browser checks',
          descriptionHtml: '<p>Safe description</p>',
          thumbnailStorageKey: 'media/thumbnail.png',
          galleryStorageKeys: ['media/gallery-1.png'],
          sellerId: 'mysql-seller-1',
          tagIds: [tagId],
          latestApprovedVersionId: versionId,
          capabilities: ['requires_browser'],
          ratingAvg: 4.5,
          ratingCount: 12,
          downloads: 34,
          views: 56,
          publishedAt: new Date('2026-09-01T00:00:00.000Z'),
          updatedAt: new Date('2026-09-02T00:00:00.000Z'),
        }),
      };
    },
  };
  const versionModel = {
    findOne: (query: Record<string, unknown>) => {
      versionQuery = query;
      return {
        lean: () => Promise.resolve({ _id: versionId, version: '1.2.3' }),
      };
    },
    find: () => ({
      sort: () => ({
        lean: () => Promise.resolve([
          {
            _id: newerVersionId,
            version: '1.2.4',
            changelog: 'Improved checks',
            releasedAt: new Date('2026-09-03T00:00:00.000Z'),
            createdAt: new Date('2026-09-03T00:00:00.000Z'),
            scrubbedGraphStorageKey: 'graphs/private.json',
          },
          {
            _id: versionId,
            version: '1.2.3',
            changelog: null,
            releasedAt: null,
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          },
        ]),
      }),
    }),
  };
  const tagModel = {
    find: () => ({
      lean: () => Promise.resolve([{ _id: tagId, name: 'Browser', slug: 'browser' }]),
    }),
  };
  const prisma = {
    seller: {
      findMany: () => Promise.resolve([{ id: 'mysql-seller-1', name: 'Acme Automation' }]),
    },
  };

  const service = new StoreService(
    prisma as unknown as ConstructorParameters<typeof StoreService>[0],
    scriptModel as never,
    tagModel as never,
    versionModel as never,
  );
  const detail = await service.findPublicBySlugOrId('browser-helper');

  assert.deepEqual(detail, {
    id: scriptId.toString(),
    slug: 'browser-helper',
    name: 'Browser Helper',
    shortDescription: 'Automates browser checks',
    thumbnailUrl: '/api/v1/media/media/thumbnail.png',
    seller: { displayName: 'Acme Automation' },
    tags: [{ id: tagId.toString(), name: 'Browser', slug: 'browser' }],
    latestApprovedVersion: '1.2.3',
    statistics: { ratingAvg: 4.5, ratingCount: 12, downloads: 34, views: 56 },
    publishedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    descriptionHtml: '<p>Safe description</p>',
    galleryUrls: ['/api/v1/media/media/gallery-1.png'],
    capabilities: ['requires_browser'],
    versions: [
      {
        id: newerVersionId.toString(),
        version: '1.2.4',
        changelog: 'Improved checks',
        releasedAt: '2026-09-03T00:00:00.000Z',
        createdAt: '2026-09-03T00:00:00.000Z',
      },
      {
        id: versionId.toString(),
        version: '1.2.3',
        changelog: null,
        releasedAt: null,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  });
  assert.ok(JSON.stringify(scriptQuery).includes('PUBLISHED'));
  assert.ok(JSON.stringify(versionQuery).includes('APPROVED'));
  assert.ok(!JSON.stringify(detail).includes('scrubbedGraphStorageKey'));

  console.log('public detail service tests passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
