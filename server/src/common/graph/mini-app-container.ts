/**
 * HAUP2 mini-app wrapper (layer A).
 *
 * Decrypt logic must match Manager `docs/handle.md` and the desktop app's
 * `mini-app-wrapper.ts` byte-for-byte:
 *
 *   [ magic 'HAUP2' 5B ][ outerLen u32 LE 4B ][ outerHeader JSON ][ ciphertext ]
 *   outerHeader = { v:2, alg, builderId, appId, ephPub, iv, tag }
 *   ciphertext  = AES-256-GCM( innerPayload, key, iv, aad=builderId\0appId )
 *   innerPayload = [ innerLen u32 LE ][ innerHeader JSON {name,version,iconPng?,createdAt} ][ exe ]
 *
 * key = HKDF-SHA256( ECDH(hideautoPriv, ephPub), salt=empty, info="hideauto-miniapp-wrapper-v2", 32 )
 * Private key: MINI_APP_WRAPPER_PRIVATE_KEY (PKCS8 base64), passed in by the caller.
 */

import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from 'crypto';
import { BadRequestError } from '../errors';

export const HAUP2_MAGIC = Buffer.from('HAUP2');
const MAGIC_LEN = 5;
const PREFIX = MAGIC_LEN + 4;
const ALG = 'x25519-aes256gcm-hkdfsha256';
/** Same string as Manager handle.md / desktop mini-app-wrapper.ts. */
const HKDF_INFO = 'hideauto-miniapp-wrapper-v2';
const GCM_IV_BYTES = 12;

const VERSION_RE = /^\d+\.\d+\.\d+$/;

export class MiniAppContainerError extends BadRequestError {
  constructor(message: string, code = 'wrapper_invalid') {
    super(code, message);
  }
}

export interface OuterHeader {
  v: 2;
  alg: string;
  builderId: string;
  appId: string;
  ephPub: string;
  iv: string;
  tag: string;
}

export interface MiniAppHeader {
  appId: string;
  builderId: string;
  name: string;
  version: string;
  iconPng?: string;
  createdAt?: string;
}

export interface ParsedMiniAppContainer {
  header: MiniAppHeader;
  exe: Buffer;
}

export function looksLikeHaup2(buf: Buffer): boolean {
  return (
    buf.length >= HAUP2_MAGIC.length && buf.subarray(0, MAGIC_LEN).equals(HAUP2_MAGIC)
  );
}

export function isHaupFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith('.haup');
}

export function validSemver(value: unknown): string | null {
  return typeof value === 'string' && VERSION_RE.test(value) ? value : null;
}

function fail(message: string, code = 'wrapper_invalid'): never {
  throw new MiniAppContainerError(message, code);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function writeU32LE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
}

/** AAD = builderId \0 appId — must match handle.md / app wrapper. */
function aadBytes(builderId: string, appId: string): Buffer {
  return Buffer.from(`${builderId}\0${appId}`, 'utf8');
}

function loadPrivateKey(pkcs8Base64: string): KeyObject {
  const trimmed = pkcs8Base64.trim();
  if (!trimmed) {
    fail(
      'Chưa cấu hình MINI_APP_WRAPPER_PRIVATE_KEY — không giải mã được file mini-app.',
      'wrapper_key_missing',
    );
  }
  try {
    return createPrivateKey({
      key: Buffer.from(trimmed, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  } catch {
    fail(
      'MINI_APP_WRAPPER_PRIVATE_KEY không hợp lệ (cần PKCS8 base64).',
      'wrapper_key_invalid',
    );
  }
}

/**
 * Resolve outer.ephPub to the JWK `x` string the desktop app / handle.md write.
 * Accepts a plain string or `{ x: "…" }` object.
 */
function ephPubX(raw: unknown): string {
  if (typeof raw === 'object' && raw !== null && 'x' in raw) {
    const x = (raw as { x: unknown }).x;
    return typeof x === 'string' ? x : '';
  }
  return typeof raw === 'string' ? raw : '';
}

/**
 * Unwrap a `.haup` buffer. Private key is loaded only after the outer header
 * parses — a garbage file never touches the key material.
 *
 * Decrypt steps follow `docs/handle.md` exactly.
 */
export function parseMiniAppContainer(
  buf: Buffer,
  privateKeyPkcs8Base64: string,
): ParsedMiniAppContainer {
  if (buf.length < PREFIX) {
    fail('File quá nhỏ / không đúng định dạng mini-app.');
  }
  if (buf.subarray(0, MAGIC_LEN).toString('ascii') !== 'HAUP2') {
    fail(
      'Sai magic — không phải file mini-app hợp lệ (cần HAUP2).',
      'wrapper_bad_magic',
    );
  }

  const outerLen = buf.readUInt32LE(MAGIC_LEN);
  const outerEnd = PREFIX + outerLen;
  if (outerLen <= 0 || outerEnd > buf.length) {
    fail('Outer header hỏng — độ dài không hợp lệ.');
  }

  let outer: Record<string, unknown>;
  try {
    outer = JSON.parse(buf.subarray(PREFIX, outerEnd).toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    fail('Outer header không phải JSON hợp lệ.');
  }
  if (
    outer === null ||
    typeof outer !== 'object' ||
    Array.isArray(outer)
  ) {
    fail('Outer header không phải JSON hợp lệ.');
  }

  const ephPub = ephPubX(outer.ephPub);
  if (
    outer.v !== 2 ||
    !isNonEmptyString(outer.alg) ||
    !isNonEmptyString(outer.appId) ||
    !isNonEmptyString(ephPub) ||
    !isNonEmptyString(outer.iv) ||
    !isNonEmptyString(outer.tag)
  ) {
    fail('Outer header thiếu trường bắt buộc.');
  }

  const appId = outer.appId;
  const builderId = typeof outer.builderId === 'string' ? outer.builderId : '';
  const ciphertext = buf.subarray(outerEnd);
  if (ciphertext.length === 0) {
    fail('Không có ciphertext trong file.');
  }

  // --- Hybrid decrypt (docs/handle.md): ECDH → HKDF → AES-256-GCM ---
  const priv = loadPrivateKey(privateKeyPkcs8Base64);
  let plain: Buffer;
  try {
    const ephKey = createPublicKey({
      key: { kty: 'OKP', crv: 'X25519', x: ephPub },
      format: 'jwk',
    });
    const shared = diffieHellman({ privateKey: priv, publicKey: ephKey });
    const key = Buffer.from(
      hkdfSync('sha256', shared, Buffer.alloc(0), HKDF_INFO, 32),
    );
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(outer.iv, 'base64'),
    );
    decipher.setAAD(aadBytes(builderId, appId));
    decipher.setAuthTag(Buffer.from(outer.tag, 'base64'));
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    if (err instanceof MiniAppContainerError) throw err;
    const pubX = priv.export({ format: 'jwk' }).x ?? '?';
    console.warn(
      `[haup2] decrypt failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.warn(
      `[haup2] our public x=${pubX}  file appId=${appId} builderId=${JSON.stringify(builderId)} alg=${outer.alg} ephPub=${ephPub.slice(0, 24)}…`,
    );
    fail(
      'Giải mã thất bại — file hỏng hoặc sai khoá.',
      'wrapper_decrypt_failed',
    );
  }

  // --- Parse innerPayload: [innerLen][innerHeader JSON][exe] ---
  if (plain.length < 4) {
    fail('Inner payload hỏng.');
  }
  const innerLen = plain.readUInt32LE(0);
  const innerEnd = 4 + innerLen;
  if (innerLen <= 0 || innerEnd > plain.length) {
    fail('Inner header hỏng — độ dài không hợp lệ.');
  }

  let innerHeader: Record<string, unknown>;
  try {
    innerHeader = JSON.parse(
      plain.subarray(4, innerEnd).toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    fail('Inner header không phải JSON hợp lệ.');
  }
  if (
    !isNonEmptyString(innerHeader.name) ||
    !isNonEmptyString(innerHeader.version)
  ) {
    fail('Inner header thiếu name/version.');
  }

  const exe = plain.subarray(innerEnd);
  if (exe.length === 0) {
    fail('Không có phần exe trong file.');
  }

  const header: MiniAppHeader = {
    appId,
    builderId,
    name: innerHeader.name,
    version: innerHeader.version,
  };
  if (typeof innerHeader.iconPng === 'string' && innerHeader.iconPng) {
    header.iconPng = innerHeader.iconPng;
  }
  if (typeof innerHeader.createdAt === 'string' && innerHeader.createdAt) {
    header.createdAt = innerHeader.createdAt;
  }

  return { header, exe };
}

export interface EncodeMiniAppOptions {
  exe: Buffer;
  name: string;
  version: string;
  appId: string;
  builderId?: string;
  iconPng?: Buffer | null;
  createdAt?: string;
}

/** Inverse of `parseMiniAppContainer` — tests and `scripts/make-demo-app.mjs`. */
export function encodeMiniAppContainer(
  opts: EncodeMiniAppOptions,
  publicJwkX: string,
): Buffer {
  const builderId = opts.builderId ?? '';
  const innerHeader: Record<string, string> = {
    name: opts.name,
    version: opts.version,
    createdAt: opts.createdAt ?? new Date().toISOString(),
  };
  if (opts.iconPng?.length) {
    innerHeader.iconPng = opts.iconPng.toString('base64');
  }

  const innerJson = Buffer.from(JSON.stringify(innerHeader), 'utf8');
  const inner = Buffer.concat([writeU32LE(innerJson.length), innerJson, opts.exe]);

  const serverPub = createPublicKey({
    key: { kty: 'OKP', crv: 'X25519', x: publicJwkX },
    format: 'jwk',
  });
  const eph = generateKeyPairSync('x25519');
  const shared = diffieHellman({
    privateKey: eph.privateKey,
    publicKey: serverPub,
  });
  const key = Buffer.from(
    hkdfSync('sha256', shared, Buffer.alloc(0), HKDF_INFO, 32),
  );
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aadBytes(builderId, opts.appId));
  const ciphertext = Buffer.concat([cipher.update(inner), cipher.final()]);
  const tag = cipher.getAuthTag();

  const ephJwk = eph.publicKey.export({ format: 'jwk' });
  const outerHeader: OuterHeader = {
    v: 2,
    alg: ALG,
    builderId,
    appId: opts.appId,
    ephPub: ephJwk.x ?? '',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
  const outerJson = Buffer.from(JSON.stringify(outerHeader), 'utf8');
  return Buffer.concat([
    HAUP2_MAGIC,
    writeU32LE(outerJson.length),
    outerJson,
    ciphertext,
  ]);
}

export function exeFileSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'mini-app';
}
