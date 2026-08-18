/**
 * Ed25519 licences for packaged mini apps.
 *
 * The store signs a small JSON payload binding (mini app, user, machine) with an expiry;
 * the packaged app ships the matching public key and verifies the licence at launch.
 * See `docs/mini-app-licensing.md` §5.
 *
 * ⚠️ The signature covers the **exact bytes** in `payload_b64`. A verifier must check the
 * bytes it received and parse afterwards — re-serializing the parsed object can produce
 * different bytes (key order, unicode escaping) and reject a perfectly good licence.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from 'crypto';
import { ServiceUnavailableError } from '../common/errors';

/** DER wrappers: Node will not accept a bare 32-byte Ed25519 seed / public key. */
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

const ED25519_SEED_BYTES = 32;

export interface LicensePayload {
  format: 1;
  script_id: string;
  app_id: string;
  app_name: string;
  seller_name: string;
  user_id: string;
  user_email: string;
  machine_id: string;
  issued_at: string;
  expires_at: string;
}

export interface SignedLicense {
  payload_b64: string;
  signature: string;
  algorithm: 'Ed25519';
}

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly privateKey: KeyObject | null;
  private readonly publicKeyRaw: Buffer | null;
  readonly ttlDays: number;

  constructor(private readonly config: ConfigService) {
    this.ttlDays = Number(config.get<string>('LICENSE_TTL_DAYS', '7')) || 7;

    const seedB64 = config.get<string>('LICENSE_SIGNING_KEY', '').trim();
    if (!seedB64) {
      // Not fatal: without a key the store simply ships packages with no licence gate.
      this.logger.warn(
        'LICENSE_SIGNING_KEY is not set — mini apps will be packaged without a licence gate',
      );
      this.privateKey = null;
      this.publicKeyRaw = null;
      return;
    }

    const seed = Buffer.from(seedB64, 'base64');
    if (seed.length !== ED25519_SEED_BYTES) {
      throw new Error(
        `LICENSE_SIGNING_KEY must be a base64 ${ED25519_SEED_BYTES}-byte Ed25519 seed ` +
          `(got ${seed.length} bytes)`,
      );
    }

    this.privateKey = createPrivateKey({
      key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
      format: 'der',
      type: 'pkcs8',
    });
    // The raw public key is the tail of the SPKI encoding.
    this.publicKeyRaw = createPublicKey(this.privateKey)
      .export({ format: 'der', type: 'spki' })
      .subarray(SPKI_ED25519_PREFIX.length);
  }

  /** True when the store can actually issue licences. */
  get enabled(): boolean {
    return this.privateKey !== null;
  }

  /** Base64 public key to embed in a package, or null when licensing is off. */
  get publicKeyBase64(): string | null {
    return this.publicKeyRaw ? this.publicKeyRaw.toString('base64') : null;
  }

  /**
   * Serialize the payload to its canonical signed bytes.
   *
   * Keys are sorted and there is no whitespace, matching the format packaged mini apps
   * were built against (Python's `json.dumps(..., sort_keys=True, separators=(',',':'))`).
   * Non-ASCII stays raw UTF-8 — a seller name with dấu tiếng Việt must not become \uXXXX.
   */
  encodePayload(payload: LicensePayload): Buffer {
    const sorted = Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
    return Buffer.from(JSON.stringify(sorted), 'utf8');
  }

  sign(payload: LicensePayload): SignedLicense {
    if (!this.privateKey) {
      throw new ServiceUnavailableError(
        'licensing_unconfigured',
        'Mini-app licensing is not configured (LICENSE_SIGNING_KEY)',
      );
    }

    // Serialize once; both the signature and payload_b64 refer to these exact bytes.
    const bytes = this.encodePayload(payload);
    return {
      payload_b64: bytes.toString('base64'),
      signature: edSign(null, bytes, this.privateKey).toString('base64'),
      algorithm: 'Ed25519',
    };
  }

  /** Server-side mirror of what the mini app does — for tests and debugging. */
  verify(raw: Buffer, signature: string): boolean {
    if (!this.publicKeyRaw) return false;
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, this.publicKeyRaw]),
      format: 'der',
      type: 'spki',
    });
    try {
      return edVerify(null, raw, key, Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }

  /** `issued_at` / `expires_at` as the second-precision UTC stamps the payload uses. */
  window(now: Date = new Date()): { issuedAt: string; expiresAt: string } {
    const expires = new Date(now.getTime() + this.ttlDays * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;
    return { issuedAt: iso(now), expiresAt: iso(expires) };
  }
}
