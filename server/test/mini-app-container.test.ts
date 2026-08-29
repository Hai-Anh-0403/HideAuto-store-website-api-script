/**
 * HAUP2 wrapper — decrypt must stay compatible with the desktop app's mini-app-wrapper.ts.
 */

import { generateKeyPairSync } from 'crypto';
import JSZip from 'jszip';
import {
  encodeMiniAppContainer,
  exeFileSlug,
  looksLikeHaup2,
  parseMiniAppContainer,
} from '../src/common/graph/mini-app-container';
import { extractPackage } from '../src/common/graph/package-extract';

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

function checkTrue(name: string, actual: boolean) {
  if (actual) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}\n         expected true`);
  }
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const { publicKey, privateKey } = generateKeyPairSync('x25519');
const publicX = publicKey.export({ format: 'jwk' }).x ?? '';
const privatePkcs8 = privateKey
  .export({ type: 'pkcs8', format: 'der' })
  .toString('base64');

async function zipWithWorkflow(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    'resources/app.workflow',
    JSON.stringify({
      version: 1,
      appName: 'Envelope Name',
      appId: 'com.hideauto.mini.envelope',
      workflow: { nodes: [{ id: 'n1', data: { code: 'gotoUrl' } }], edges: [], variables: [] },
    }),
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  console.log('\n--- HAUP2 container ---');

  const exe = Buffer.from('fake-installer-bytes');
  const wrapped = encodeMiniAppContainer(
    {
      exe,
      name: 'Anna Bot',
      version: '1.2.3',
      appId: 'com.hideauto.mini.anna-bot',
      builderId: 'seller-1',
      iconPng: PNG_1X1,
    },
    publicX,
  );

  checkTrue('magic HAUP2', looksLikeHaup2(wrapped));
  check('exe slug', exeFileSlug('Anna Bot'), 'anna-bot');
  check('exe slug empty', exeFileSlug('   '), 'mini-app');

  const parsed = parseMiniAppContainer(wrapped, privatePkcs8);
  check('name', parsed.header.name, 'Anna Bot');
  check('version', parsed.header.version, '1.2.3');
  check('appId', parsed.header.appId, 'com.hideauto.mini.anna-bot');
  check('builderId', parsed.header.builderId, 'seller-1');
  check('exe bytes', parsed.exe.equals(exe), true);
  check(
    'icon roundtrip',
    parsed.header.iconPng === PNG_1X1.toString('base64'),
    true,
  );

  try {
    parseMiniAppContainer(Buffer.from('not-a-haup'), privatePkcs8);
    failures++;
    console.log('  FAIL bad magic should throw');
  } catch (err) {
    check('bad magic code', (err as { code?: string }).code, 'wrapper_bad_magic');
  }

  try {
    parseMiniAppContainer(wrapped, '');
    failures++;
    console.log('  FAIL missing key should throw');
  } catch (err) {
    check('missing key code', (err as { code?: string }).code, 'wrapper_key_missing');
  }

  const other = generateKeyPairSync('x25519');
  const otherPkcs8 = other.privateKey
    .export({ type: 'pkcs8', format: 'der' })
    .toString('base64');
  try {
    parseMiniAppContainer(wrapped, otherPkcs8);
    failures++;
    console.log('  FAIL wrong key should throw');
  } catch (err) {
    check(
      'wrong key code',
      (err as { code?: string }).code,
      'wrapper_decrypt_failed',
    );
  }

  const tampered = Buffer.from(wrapped);
  // Flip a byte inside the outer JSON so appId changes without re-encrypting.
  const appIdBytes = Buffer.from('com.hideauto.mini.anna-bot');
  const idx = tampered.indexOf(appIdBytes);
  checkTrue('found appId in header', idx >= 0);
  tampered[idx] ^= 0x01;
  try {
    parseMiniAppContainer(tampered, privatePkcs8);
    failures++;
    console.log('  FAIL AAD tamper should throw');
  } catch (err) {
    check(
      'AAD tamper code',
      (err as { code?: string }).code,
      'wrapper_decrypt_failed',
    );
  }

  const innerZip = await zipWithWorkflow();
  const wrappedZip = encodeMiniAppContainer(
    {
      exe: innerZip,
      name: 'Zip Bot',
      version: '2.0.0',
      appId: 'com.hideauto.mini.zip-bot',
    },
    publicX,
  );
  const unzipped = parseMiniAppContainer(wrappedZip, privatePkcs8);
  const pkg = await extractPackage(unzipped.exe, 'zip-bot-setup.exe');
  check('graph extracted from inner zip', pkg.graphExtracted, true);
  check('inner envelope appId', pkg.appId, 'com.hideauto.mini.envelope');
  check(
    'node count',
    Array.isArray((pkg.graph as { nodes?: unknown }).nodes)
      ? (pkg.graph as { nodes: unknown[] }).nodes.length
      : 0,
    1,
  );

  if (failures) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log('\nall passed');
}

void main();
