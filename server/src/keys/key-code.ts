/**
 * Human-typeable activation codes.
 *
 * A buyer retypes these from a chat message or an invoice, so the alphabet drops every
 * pair a person confuses on sight — `0/O`, `1/I/L` — and the code is printed in groups of
 * five behind an `SK-` prefix, which is what makes a key recognisable when it is pasted
 * into a support thread. 20 symbols out of a 30-symbol alphabet is ~98 bits: far past
 * anything guessable, and still short enough to read out loud.
 *
 * `normalize()` is the counterpart of `generate()`: it accepts whatever the buyer actually
 * pasted (lowercase, no dashes, stray spaces, the prefix missing) and rebuilds the exact
 * stored string, or returns null when the input is not a code of this format.
 *
 * ⚠ Keys issued before this format existed are 32 lowercase hex characters with no prefix.
 * They are still valid and `normalize()` deliberately ignores them, so every lookup must
 * try the raw trimmed input *as well as* the normalised one.
 */

import { randomBytes } from 'crypto';

/** No 0/O, no 1/I/L, no U — 30 symbols left. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Exported for fixtures that need deterministic-but-well-formed codes (the demo seed). */
export const KEY_CODE_ALPHABET = ALPHABET;
const PREFIX = 'SK';
const GROUP_LEN = 5;
const GROUPS = 4;
const CODE_LEN = GROUP_LEN * GROUPS;

/** Largest multiple of the alphabet size that fits in a byte, for unbiased sampling. */
const UNBIASED_CEIL = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

/** A fresh code, e.g. `SK-4KDPQ-7WZHM-2XCVB-9NRTF`. */
export function generateKeyCode(): string {
  const symbols: string[] = [];
  while (symbols.length < CODE_LEN) {
    // Rejection sampling: `% 30` on a raw byte would favour the first 16 symbols.
    for (const byte of randomBytes(CODE_LEN)) {
      if (byte >= UNBIASED_CEIL) continue;
      symbols.push(ALPHABET[byte % ALPHABET.length]);
      if (symbols.length === CODE_LEN) break;
    }
  }
  return formatKeyCode(symbols.join(''));
}

export const KEY_CODE_LENGTH = CODE_LEN;

/** `4KDPQ7WZHM2XCVB9NRTF` → `SK-4KDPQ-7WZHM-2XCVB-9NRTF`. */
export function formatKeyCode(body: string): string {
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += GROUP_LEN) {
    groups.push(body.slice(i, i + GROUP_LEN));
  }
  return [PREFIX, ...groups].join('-');
}

/**
 * Canonical form of a typed code, or null if it is not one.
 *
 * Tolerates: lowercase, missing/extra dashes, spaces, a missing or duplicated `SK` prefix.
 * Does *not* guess at ambiguous characters — a code containing `0`, `1`, `I`, `L`, `O` or
 * `U` was mistyped or belongs to the legacy hex format, and silently rewriting it would
 * turn a typo into someone else's key.
 */
export function normalizeKeyCode(input: string): string | null {
  const cleaned = input.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  // Strip the prefix only when doing so leaves a whole code: one body in ~900 starts with
  // `SK` itself, and cutting those two symbols off turned a valid pasted code into null.
  const body =
    cleaned.length === CODE_LEN + PREFIX.length && cleaned.startsWith(PREFIX)
      ? cleaned.slice(PREFIX.length)
      : cleaned;

  if (body.length !== CODE_LEN) return null;
  for (const ch of body) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return formatKeyCode(body);
}

/** True for a string this module could have produced. */
export function isKeyCode(value: string): boolean {
  return normalizeKeyCode(value) === value;
}
