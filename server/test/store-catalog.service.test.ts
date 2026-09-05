import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { BrowsePublicScriptsDto } from '../src/store/dto/browse-public-scripts.dto';
import { StoreService } from '../src/store/store.service';

async function run() {
  const tagId = new Types.ObjectId();
  const scriptId = new Types.ObjectId();
  const versionId = new Types.ObjectId();
  let aggregatePipeline: unknown[] = [];

  const scriptModel = {
    aggregate: (pipeline: unknown[]) => {
      aggregatePipeline = pipeline;
      return Promise.resolve([
        {
          items: [
            {
              _id: scriptId,
              slug: 'browser-helper',
              name: 'Browser Helper',
              shortDescription: 'Automates browser checks',
              thumbnailStorageKey: 'media/private-key.png',
              sellerId: 'mysql-seller-1',
              tagIds: [tagId],
              latestVersion: { _id: versionId, version: '1.2.3' },
              price: '$39',
              ratingAvg: 4.5,
              ratingCount: 12,
              downloads: 34,
              views: 56,
              publishedAt: new Date('2026-09-01T00:00:00.000Z'),
              updatedAt: new Date('2026-09-02T00:00:00.000Z'),
            },
          ],
          total: [{ count: 1 }],
        },
      ]);
    },
  };
  const tagModel = {
    find: () => ({
      lean: () =>
        Promise.resolve([{ _id: tagId, name: 'Browser', slug: 'browser' }]),
      sort: () => ({
        lean: () =>
          Promise.resolve([{ _id: tagId, name: 'Browser', slug: 'browser' }]),
      }),
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
    {} as never,
    {} as never,
  );
  const dto = Object.assign(new BrowsePublicScriptsDto(), {
    q: 'browser',
    tagIds: tagId.toString(),
    sort: 'views' as const,
    skip: 0,
    limit: 20,
  });

  const page = await service.browsePublic(dto);
  assert.equal(page.total, 1);
  assert.deepEqual(page.items, [
    {
      id: scriptId.toString(),
      slug: 'browser-helper',
      name: 'Browser Helper',
      shortDescription: 'Automates browser checks',
      thumbnailUrl: '/api/v1/media/media/private-key.png',
      seller: { displayName: 'Acme Automation' },
      tags: [{ id: tagId.toString(), name: 'Browser', slug: 'browser' }],
      latestApprovedVersion: '1.2.3',
      price: '$39',
      priceAmount: 29,
      currency: 'USD',
      statistics: { ratingAvg: 4.5, ratingCount: 12, downloads: 34, views: 56 },
      publishedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
  ]);
  assert.ok(
    JSON.stringify(aggregatePipeline).includes('PUBLISHED'),
    'catalog pipeline must explicitly limit results to PUBLISHED scripts',
  );
  assert.ok(
    JSON.stringify(aggregatePipeline).includes('APPROVED'),
    'catalog pipeline must require the latest version to be APPROVED',
  );
  assert.ok(
    JSON.stringify(aggregatePipeline).includes('views'),
    'views sort must be represented in the MongoDB pipeline',
  );

  for (const sort of ['popular', 'newest', 'updated', 'price_asc', 'price_desc'] as const) {
    await service.browsePublic(Object.assign(new BrowsePublicScriptsDto(), {
      sort,
      skip: 0,
      limit: 20,
    }));
    const expectedField =
      sort === 'popular'
        ? 'ratingAvg'
        : sort === 'newest'
        ? 'publishedAt'
        : sort === 'updated'
        ? 'updatedAt'
        : 'priceAmount';
    assert.ok(
      JSON.stringify(aggregatePipeline).includes(expectedField),
      `${sort} sort must be represented in the MongoDB pipeline`,
    );
  }

  await assert.rejects(
    service.browsePublic(Object.assign(new BrowsePublicScriptsDto(), {
      tagIds: 'not-an-object-id',
      skip: 0,
      limit: 20,
    })),
    (error: unknown) => (error as { response?: { code?: string } }).response?.code === 'invalid_tag_ids',
  );

  const tags = await service.publicTags();
  assert.equal(tags.length, 1);
  assert.equal(tags[0].name, 'Browser');
  assert.equal(tags[0].id, tagId.toString());

  console.log('public catalog service tests passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
