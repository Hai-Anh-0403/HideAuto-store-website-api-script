/**
 * Activation-code contract.
 *
 * Two failures here are expensive and silent: a code a buyer cannot retype, and a
 * `normalize()` that maps two different inputs onto the same stored key — which would hand
 * one buyer someone else's licence.
 */

import {
  generateKeyCode,
  isKeyCode,
  normalizeKeyCode,
} from '../src/keys/key-code';

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

console.log('\n--- shape ---');
const code = generateKeyCode();
check('matches SK-XXXXX-XXXXX-XXXXX-XXXXX', /^SK(-[2-9A-HJ-NP-TV-Z]{5}){4}$/.test(code), true);
check('is its own canonical form', isKeyCode(code), true);
check(
  'carries no look-alike characters',
  /[01ILOU]/.test(code.slice(3)),
  false,
);

console.log('\n--- uniqueness ---');
const many = new Set(Array.from({ length: 5000 }, () => generateKeyCode()));
check('5000 codes are distinct', many.size, 5000);

console.log('\n--- alphabet is used evenly ---');
// Rejection sampling, not `% 30`: a biased generator leaves the tail of the alphabet rare.
const counts = new Map<string, number>();
for (const c of many) {
  // Skip the fixed `SK-` prefix: counting it would register as a fake bias.
  for (const ch of c.slice(3).replace(/-/g, '')) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
}
const seen = [...counts.values()];
const spread = Math.max(...seen) / Math.min(...seen);
check('30 symbols all appear', counts.size, 30);
check(`most/least common symbol ratio under 1.3 (got ${spread.toFixed(2)})`, spread < 1.3, true);

console.log('\n--- normalize ---');
check('exact code round-trips', normalizeKeyCode(code), code);
check('lowercase', normalizeKeyCode(code.toLowerCase()), code);
check('no dashes', normalizeKeyCode(code.replace(/-/g, '')), code);
check('body only, no prefix', normalizeKeyCode(code.slice(3)), code);
check('pasted with spaces', normalizeKeyCode(`  ${code.replace(/-/g, ' ')}  `), code);
check('mixed separators', normalizeKeyCode(code.replace(/-/g, ' — ')), code);

console.log('\n--- normalize refuses what it cannot rebuild ---');
check('empty', normalizeKeyCode(''), null);
check('too short', normalizeKeyCode('SK-4KDPQ-7WZHM'), null);
check('too long', normalizeKeyCode(`${code}XYZ`), null);
check(
  'legacy 32-hex key is left alone',
  normalizeKeyCode('dda688ccd88d2c3ca3b2d70c4d0efded'),
  null,
);
check('ambiguous 0 is not guessed', normalizeKeyCode('SK-0KDPQ-7WZHM-2XCVB-9NRTF'), null);
check('ambiguous I is not guessed', normalizeKeyCode('SK-IKDPQ-7WZHM-2XCVB-9NRTF'), null);
check('ambiguous L is not guessed', normalizeKeyCode('SK-LKDPQ-7WZHM-2XCVB-9NRTF'), null);
check('ambiguous O is not guessed', normalizeKeyCode('SK-OKDPQ-7WZHM-2XCVB-9NRTF'), null);
check('ambiguous U is not guessed', normalizeKeyCode('SK-UKDPQ-7WZHM-2XCVB-9NRTF'), null);

console.log('\n--- normalize is injective on well-formed input ---');
// Different codes must never normalise onto the same string.
const normalised = new Set([...many].map((c) => normalizeKeyCode(c)));
check('no two codes collide', normalised.size, many.size);

console.log(failures === 0 ? '\nALL PASSED\n' : `\n${failures} FAILURE(S)\n`);
process.exitCode = failures === 0 ? 0 : 1;
