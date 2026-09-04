import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BrowsePublicScriptsDto } from '../src/store/dto/browse-public-scripts.dto';

async function errorsFor(input: Record<string, unknown>) {
  const dto = plainToInstance(BrowsePublicScriptsDto, input);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

async function run() {
  const valid = await errorsFor({
    skip: '0',
    limit: '20',
    q: 'browser automation',
    tagIds: 'abc,def',
    sort: 'popular',
  });
  assert.equal(valid.length, 0, 'valid public browse query must pass');

  const unsupportedSort = await errorsFor({ sort: 'price' });
  assert.ok(
    unsupportedSort.some((error) => error.property === 'sort'),
    'unsupported sort must be rejected',
  );

  const invalidLimit = await errorsFor({ limit: '101' });
  assert.ok(
    invalidLimit.some((error) => error.property === 'limit'),
    'limit above 100 must be rejected',
  );

  const invalidTagIds = await errorsFor({ tagIds: 42 });
  assert.ok(
    invalidTagIds.some((error) => error.property === 'tagIds'),
    'tagIds must be a string',
  );

  const snakeCase = await errorsFor({ tag_ids: 'legacy-tag' });
  assert.ok(
    snakeCase.some((error) => error.property === 'tag_ids'),
    'legacy snake-case tag parameter must not be part of the public contract',
  );

  console.log('public store DTO tests passed');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
