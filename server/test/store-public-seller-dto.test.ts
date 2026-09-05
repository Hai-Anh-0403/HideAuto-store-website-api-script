import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BrowsePublicSellersDto } from '../src/store/dto/browse-public-sellers.dto';

async function errorsFor(input: Record<string, unknown>) {
  return validate(plainToInstance(BrowsePublicSellersDto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

async function run() {
  const defaults = plainToInstance(BrowsePublicSellersDto, {});
  assert.equal(defaults.skip, 0);
  assert.equal(defaults.limit, 20);
  assert.equal(defaults.sort, 'popular');
  assert.equal((await errorsFor({ skip: '0', limit: '3', sort: 'popular' })).length, 0);
  assert.ok((await errorsFor({ limit: '101' })).some((error) => error.property === 'limit'));
  assert.ok((await errorsFor({ sort: 'newest' })).some((error) => error.property === 'sort'));
  console.log('public seller DTO tests passed');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
