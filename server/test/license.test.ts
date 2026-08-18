/**
 * Licence signing contract.
 *
 * These are the failures that would be silent and expensive: a licence that verifies on
 * the server but not in the packaged app, or a seed leaking into a package.
 */

import { ConfigService } from '@nestjs/config';
import { LicenseService, type LicensePayload } from '../src/licensing/license.service';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`);
  }
}

/** The fixture seed the Python suite used, so results stay comparable across the port. */
const SEED = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString('base64');

function serviceWith(env: Record<string, string>): LicenseService {
  const config = {
    get: <T>(key: string, fallback?: T) => (env[key] ?? fallback) as T,
  } as ConfigService;
  return new LicenseService(config);
}

const payload: LicensePayload = {
  format: 1,
  script_id: 'script-1',
  app_id: 'com.hideflow.mini.demo',
  app_name: 'Demo',
  seller_name: 'Cửa hàng Đặng Vũ', // non-ASCII on purpose
  user_id: 'user-1',
  user_email: 'buyer@example.com',
  machine_id: 'machine-aaa',
  issued_at: '2026-08-18T00:00:00Z',
  expires_at: '2026-08-25T00:00:00Z',
};

console.log('\n--- canonical serialization ---');
const svc = serviceWith({ LICENSE_SIGNING_KEY: SEED, LICENSE_TTL_DAYS: '7' });
const raw = svc.encodePayload(payload);
const text = raw.toString('utf8');

// The wire order is what a packaged app signs against, so assert the order itself
// rather than a prefix — this is the documented layout in mini-app-licensing.md §5.
check('keys are in sorted wire order', [...text.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]), [
  'app_id',
  'app_name',
  'expires_at',
  'format',
  'issued_at',
  'machine_id',
  'script_id',
  'seller_name',
  'user_email',
  'user_id',
]);
check('no whitespace between tokens', /,\s|\s:/.test(text), false);
check('format stays a number, not a string', text.includes('"format":1'), true);
check(
  'non-ASCII travels as raw UTF-8, not \\uXXXX',
  raw.includes(Buffer.from('Cửa hàng Đặng Vũ', 'utf8')),
  true,
);
check(
  'every field is present',
  Object.keys(JSON.parse(text)).sort(),
  Object.keys(payload).sort(),
);

console.log('\n--- signing ---');
const signed = svc.sign(payload);
check('algorithm', signed.algorithm, 'Ed25519');
check('payload_b64 decodes to the signed bytes', Buffer.from(signed.payload_b64, 'base64').equals(raw), true);
check('signature is 64 bytes', Buffer.from(signed.signature, 'base64').length, 64);
check('verifies against the received bytes', svc.verify(raw, signed.signature), true);
check(
  'a tampered machine_id fails',
  svc.verify(Buffer.from(text.replace('machine-aaa', 'machine-bbb'), 'utf8'), signed.signature),
  false,
);
check(
  'a licence for another machine has different bytes',
  svc.sign({ ...payload, machine_id: 'machine-bbb' }).payload_b64 === signed.payload_b64,
  false,
);

console.log('\n--- public key & secrecy ---');
const pub = svc.publicKeyBase64;
check('public key is 32 raw bytes', Buffer.from(pub ?? '', 'base64').length, 32);
check('public key is not the seed', pub === SEED, false);
check(
  'the seed appears nowhere in what ships to a buyer',
  JSON.stringify({ licensePublicKey: pub, ...signed }).includes(SEED),
  false,
);

console.log('\n--- unconfigured store ---');
const off = serviceWith({});
check('reports disabled', off.enabled, false);
check('exposes no public key', off.publicKeyBase64, null);
check('verify() cannot succeed', off.verify(raw, signed.signature), false);
let code = '';
try {
  off.sign(payload);
} catch (err) {
  code = (err as { code?: string }).code ?? '';
}
check('signing raises licensing_unconfigured', code, 'licensing_unconfigured');

console.log('\n--- ttl window ---');
const w = svc.window(new Date('2026-08-18T00:00:00.000Z'));
check('issued_at', w.issuedAt, '2026-08-18T00:00:00Z');
check('expires_at honours LICENSE_TTL_DAYS', w.expiresAt, '2026-08-25T00:00:00Z');

console.log(failures === 0 ? '\nALL PASSED\n' : `\n${failures} FAILURE(S)\n`);
process.exitCode = failures === 0 ? 0 : 1;
