import assert from 'node:assert/strict';
import { model } from 'mongoose';
import {
  MARKETPLACE_SELLER_STATUSES,
  MarketplaceSellerSchema,
} from '../src/sellers/schemas/marketplace-seller.schema';

function indexExists(
  schema: { indexes(): Array<[unknown, unknown]> },
  fields: Record<string, number>,
  options: Record<string, unknown> = {},
) {
  return schema.indexes().some(([actualFields, actualOptions]) => {
    const indexOptions = actualOptions as Record<string, unknown>;
    return (
      JSON.stringify(actualFields) === JSON.stringify(fields) &&
      Object.entries(options).every(([key, value]) => indexOptions[key] === value)
    );
  });
}

async function expectValidationError(
  document: { validate(): Promise<unknown> },
  field: string,
) {
  await assert.rejects(document.validate(), (error: unknown) => {
    const validationError = error as { errors?: Record<string, unknown> };
    assert.ok(validationError.errors?.[field], `expected validation error for ${field}`);
    return true;
  });
}

async function run() {
  const SellerModel = model('MarketplaceSellerSchemaTest', MarketplaceSellerSchema);
  const emptySeller = new SellerModel({});

  await expectValidationError(emptySeller, 'sellerId');
  await expectValidationError(emptySeller, 'slug');
  await expectValidationError(emptySeller, 'displayName');

  const status = MarketplaceSellerSchema.path('status') as unknown as {
    enumValues: readonly string[];
  };
  assert.deepEqual(status.enumValues, MARKETPLACE_SELLER_STATUSES);
  assert.ok(indexExists(MarketplaceSellerSchema, { sellerId: 1 }, { unique: true }));
  assert.ok(indexExists(MarketplaceSellerSchema, { slug: 1 }, { unique: true }));
  assert.ok(indexExists(MarketplaceSellerSchema, { status: 1, createdAt: -1 }));

  for (const privateField of [
    'password',
    'email',
    'contact',
    'statusReason',
    'sessions',
    'keys',
    'members',
    'devices',
  ]) {
    assert.equal(MarketplaceSellerSchema.path(privateField), undefined);
  }

  console.log('marketplace seller schema tests passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
