import assert from 'node:assert/strict';
import { MarketplaceSellerProjectorService } from '../src/sellers/marketplace-seller-projector.service';

type UpdateCall = {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  options: Record<string, unknown>;
};

async function run() {
  const calls: UpdateCall[] = [];
  const model = {
    findOneAndUpdate: async (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => {
      calls.push({ filter, update, options });
      return null;
    },
  };
  const projector = new MarketplaceSellerProjectorService(model as never);
  const createdAt = new Date('2026-01-18T09:30:00.000Z');
  const updatedAt = new Date('2026-01-19T09:30:00.000Z');

  await projector.project({
    id: 'seller_12345678',
    name: 'Cửa hàng Auto',
    status: 'PENDING',
    createdAt,
    updatedAt,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.filter, { sellerId: 'seller_12345678' });
  assert.deepEqual(calls[0]?.options, {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true,
    timestamps: false,
  });
  const firstUpdate = calls[0]?.update as {
    $set: { displayName: string; status: string; updatedAt: Date };
    $setOnInsert: { sellerId: string; slug: string; createdAt: Date };
  };
  assert.equal(firstUpdate.$set.displayName, 'Cửa hàng Auto');
  assert.equal(firstUpdate.$set.status, 'PENDING');
  assert.equal(firstUpdate.$set.updatedAt, updatedAt);
  assert.equal(firstUpdate.$setOnInsert.sellerId, 'seller_12345678');
  assert.match(firstUpdate.$setOnInsert.slug, /^cua-hang-auto-/);
  assert.equal(firstUpdate.$setOnInsert.createdAt, createdAt);

  await projector.project({
    id: 'seller_12345678',
    name: 'Auto Store',
    status: 'APPROVED',
    createdAt,
    updatedAt,
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1]?.filter, { sellerId: 'seller_12345678' });
  assert.equal((calls[1]?.update as { $set: { status: string } }).$set.status, 'APPROVED');

  const result = await projector.reconcile([
    {
      id: 'seller_12345678',
      name: 'Auto Store',
      status: 'APPROVED',
      createdAt,
      updatedAt,
    },
    {
      id: 'seller_87654321',
      name: 'Browser Tools',
      status: 'SUSPENDED',
      createdAt,
      updatedAt,
    },
  ]);
  assert.deepEqual(result, { processed: 2 });
  assert.equal(calls.length, 4);

  console.log('marketplace seller projector tests passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
