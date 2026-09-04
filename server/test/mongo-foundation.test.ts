import assert from 'node:assert/strict';
import { requireMongoUri } from '../src/mongo/mongo.config';
import {
  SCRIPT_STATUSES,
  ScriptSchema,
} from '../src/scripts/schemas/script.schema';
import {
  SCRIPT_VERSION_STATUSES,
  ScriptVersionSchema,
} from '../src/scripts/schemas/script-version.schema';
import { TagSchema } from '../src/tags/schemas/tag.schema';
import { model } from 'mongoose';

function indexExists(
  schema: { indexes(): Array<[unknown, unknown]> },
  fields: Record<string, number>,
  options: Record<string, unknown> = {},
) {
  return schema.indexes().some(([actualFields, actualOptions]) => {
    const indexOptions = actualOptions as Record<string, unknown>;
    return (
      JSON.stringify(actualFields) === JSON.stringify(fields) &&
    Object.entries(options).every(
        ([key, value]) => indexOptions[key] === value,
      )
    );
  });
}

async function expectValidationError(
  document: { validate(): Promise<unknown> },
  field: string,
) {
  await assert.rejects(document.validate(), (error: unknown) => {
    const validationError = error as { errors?: Record<string, unknown> };
    assert.ok(
      validationError.errors?.[field],
      `expected validation error for ${field}`,
    );
    return true;
  });
}

async function run() {
  assert.equal(
    requireMongoUri('mongodb://localhost:27017/hide_auto'),
    'mongodb://localhost:27017/hide_auto',
  );
  assert.equal(
    requireMongoUri(' mongodb+srv://user:pass@cluster.example/hide_auto '),
    'mongodb+srv://user:pass@cluster.example/hide_auto',
  );
  assert.throws(() => requireMongoUri(), /MONGO_URI/);
  assert.throws(() => requireMongoUri('http://localhost:27017/hide_auto'), /MONGO_URI/);
  assert.throws(() => requireMongoUri('mongodb://'), /MONGO_URI/);

  const ScriptModel = model('PhaseZeroScript', ScriptSchema);
  const emptyScript = new ScriptModel({});
  await expectValidationError(emptyScript, 'sellerId');
  await expectValidationError(emptyScript, 'slug');
  await expectValidationError(emptyScript, 'name');
  const scriptStatus = ScriptSchema.path('status') as unknown as {
    enumValues: readonly string[];
  };
  assert.deepEqual(scriptStatus.enumValues, SCRIPT_STATUSES);
  assert.ok(indexExists(ScriptSchema, { slug: 1 }, { unique: true }));
  assert.ok(indexExists(ScriptSchema, { status: 1, publishedAt: -1 }));
  assert.ok(indexExists(ScriptSchema, { sellerId: 1, updatedAt: -1 }));
  assert.ok(
    indexExists(ScriptSchema, { tagIds: 1, status: 1, publishedAt: -1 }),
  );

  const ScriptVersionModel = model('PhaseZeroScriptVersion', ScriptVersionSchema);
  const emptyVersion = new ScriptVersionModel({});
  await expectValidationError(emptyVersion, 'scriptId');
  await expectValidationError(emptyVersion, 'sellerId');
  await expectValidationError(emptyVersion, 'version');
  await expectValidationError(emptyVersion, 'scrubbedGraphStorageKey');
  const versionStatus = ScriptVersionSchema.path('status') as unknown as {
    enumValues: readonly string[];
  };
  assert.deepEqual(versionStatus.enumValues, SCRIPT_VERSION_STATUSES);
  assert.ok(
    indexExists(ScriptVersionSchema, { scriptId: 1, version: 1 }, { unique: true }),
  );
  assert.ok(
    indexExists(ScriptVersionSchema, { scriptId: 1, status: 1, createdAt: -1 }),
  );
  assert.ok(indexExists(ScriptVersionSchema, { sellerId: 1, createdAt: -1 }));

  const TagModel = model('PhaseZeroTag', TagSchema);
  const emptyTag = new TagModel({});
  await expectValidationError(emptyTag, 'slug');
  await expectValidationError(emptyTag, 'name');
  assert.ok(indexExists(TagSchema, { slug: 1 }, { unique: true }));

  console.log('mongo foundation tests passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
