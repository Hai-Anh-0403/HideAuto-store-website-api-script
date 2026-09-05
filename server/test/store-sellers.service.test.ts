import assert from 'node:assert/strict';
import { StoreService } from '../src/store/store.service';
import { BrowsePublicSellersDto } from '../src/store/dto/browse-public-sellers.dto';

async function run() {
  let pipeline: unknown[] = [];
  const sellerModel = { aggregate: (value: unknown[]) => {
    pipeline = value;
    return Promise.resolve([{ items: [{ sellerId: 'seller_1', slug: 'auto', displayName: 'Auto', avatarStorageKey: null, headline: null, createdAt: new Date('2026-01-01T00:00:00.000Z'), statistics: { publishedScripts: 2, downloads: 9, views: 12, ratingAvg: 4.5, ratingCount: 2 } }], total: [{ count: 1 }] }]);
  } };
  const service = new StoreService({} as never, {} as never, {} as never, {} as never, sellerModel as never);
  const page = await service.browsePublicSellers(Object.assign(new BrowsePublicSellersDto(), { skip: 0, limit: 3 }));
  assert.deepEqual(page.items[0], { id: 'seller_1', slug: 'auto', displayName: 'Auto', avatarUrl: null, headline: null, joinedAt: '2026-01-01T00:00:00.000Z', statistics: { publishedScripts: 2, downloads: 9, views: 12, ratingAvg: 4.5, ratingCount: 2 } });
  const serialised = JSON.stringify(pipeline);
  assert.ok(serialised.includes('APPROVED'));
  assert.ok(serialised.includes('PUBLISHED'));
  assert.ok(serialised.includes('weightedRating'));
  console.log('public seller aggregation tests passed');
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
