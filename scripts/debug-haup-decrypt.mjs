#!/usr/bin/env node
/**
 * Debug HAUP2 unwrap — in từng bước, không gộp thành wrapper_decrypt_failed.
 *
 *   node scripts/debug-haup-decrypt.mjs path/to/file.haup
 *   node scripts/debug-haup-decrypt.mjs file.haup --key "<PKCS8 base64>"
 *
 * Mặc định đọc MINI_APP_WRAPPER_PRIVATE_KEY từ server/.env
 *
 * Layout:
 *   [ HAUP2 5B ][ outerLen u32 LE ][ outer JSON ][ ciphertext AES-GCM ]
 * Decrypt: ECDH(X25519) → HKDF-SHA256(salt='', info=hideauto-miniapp-wrapper-v2)
 *          → AES-256-GCM, AAD = utf8(builderId) + 0x00 + utf8(appId)
 */

import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  hkdfSync,
} from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MAGIC = Buffer.from('HAUP2')
const PREFIX = 9
const HKDF_INFO = Buffer.from('hideauto-miniapp-wrapper-v2')

function arg(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function readEnvKey() {
  const envPath = resolve('server/.env')
  if (!existsSync(envPath)) return ''
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('MINI_APP_WRAPPER_PRIVATE_KEY='))
  if (!line) return ''
  return line.slice('MINI_APP_WRAPPER_PRIVATE_KEY='.length).trim().replace(/^["']|["']$/g, '')
}

function aad(builderId, appId) {
  return Buffer.concat([
    Buffer.from(builderId, 'utf8'),
    Buffer.from([0]),
    Buffer.from(appId, 'utf8'),
  ])
}

function b64(s) {
  return Buffer.from(s, 'base64')
}

function b64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function step(ok, label, extra) {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${extra ? `  ${extra}` : ''}`)
}

const file = process.argv[2]
if (!file || file.startsWith('--')) {
  console.error('Usage: node scripts/debug-haup-decrypt.mjs <file.haup> [--key PKCS8_BASE64]')
  process.exit(1)
}

const buf = readFileSync(resolve(file))
console.log(`file        ${file}  (${buf.length} bytes)`)
console.log(`magic       ${buf.subarray(0, 5).toString('latin1')}`)

if (buf.length < PREFIX) {
  console.error('File quá nhỏ (< 9 bytes).')
  process.exit(1)
}
if (!buf.subarray(0, 5).equals(MAGIC)) {
  console.error('Không phải HAUP2 — magic lệch.')
  process.exit(1)
}

const outerLen = buf.readUInt32LE(5)
step(outerLen > 0 && PREFIX + outerLen <= buf.length, 'outerLen', String(outerLen))
if (outerLen <= 0 || PREFIX + outerLen > buf.length) process.exit(1)

const outerRaw = buf.subarray(PREFIX, PREFIX + outerLen).toString('utf8')
let outer
try {
  outer = JSON.parse(outerRaw)
  step(true, 'outer JSON')
} catch (e) {
  step(false, 'outer JSON', e.message)
  process.exit(1)
}

console.log('outer header:')
console.log(JSON.stringify({ v: outer.v, alg: outer.alg, builderId: outer.builderId, appId: outer.appId, ephPub: outer.ephPub, iv: outer.iv, tag: outer.tag }, null, 2))

const ciphertext = buf.subarray(PREFIX + outerLen)
step(ciphertext.length > 0, 'ciphertext', `${ciphertext.length} bytes`)

const pkcs8 = (arg('--key') ?? readEnvKey()).trim()
if (!pkcs8) {
  console.error('Thiếu MINI_APP_WRAPPER_PRIVATE_KEY (server/.env) hoặc --key.')
  process.exit(1)
}

let priv
try {
  priv = createPrivateKey({
    key: Buffer.from(pkcs8, 'base64'),
    format: 'der',
    type: 'pkcs8',
  })
  const jwk = priv.export({ format: 'jwk' })
  step(priv.asymmetricKeyType === 'x25519', 'load PKCS8', `crv=${jwk.crv}`)
  console.log(`public x    ${jwk.x}`)
  console.log('            ↑ phải khớp HIDEAUTO_WRAPPER_PUBLIC_KEY / public key nhúng app')
} catch (e) {
  step(false, 'load PKCS8', e.message)
  process.exit(1)
}

const appId = typeof outer.appId === 'string' ? outer.appId : ''
const builderId = typeof outer.builderId === 'string' ? outer.builderId : ''
const ephPub = typeof outer.ephPub === 'string' ? outer.ephPub : ''
const ivB64 = typeof outer.iv === 'string' ? outer.iv : ''
const tagB64 = typeof outer.tag === 'string' ? outer.tag : ''

function tryDecrypt(label, iv, tag, aadBuf, ephX) {
  try {
    const publicKey = createPublicKey({
      key: { kty: 'OKP', crv: 'X25519', x: ephX },
      format: 'jwk',
    })
    const shared = diffieHellman({ privateKey: priv, publicKey })
    const key = Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), HKDF_INFO, 32))
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(aadBuf)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    step(true, label, `plain=${plain.length}B`)
    return plain
  } catch (e) {
    step(false, label, e.message)
    return null
  }
}

const iv = b64(ivB64)
const tag = b64(tagB64)
console.log(`iv          ${iv.length} bytes (cần 12)`)
console.log(`tag         ${tag.length} bytes (cần 16)`)
console.log(`ephPub      ${ephPub}`)
console.log(`AAD         builderId=${JSON.stringify(builderId)}  appId=${JSON.stringify(appId)}`)

let plain = tryDecrypt(
  'decrypt  AAD=builderId\\0appId  (chuẩn app)',
  iv,
  tag,
  aad(builderId, appId),
  ephPub,
)

if (!plain) {
  console.log('\nThử biến thể (file/app lệch layout):')
  plain =
    tryDecrypt('AAD=appId only', iv, tag, aad('', appId), ephPub) ||
    tryDecrypt('AAD empty', iv, tag, Buffer.alloc(0), ephPub) ||
    tryDecrypt(
      'iv/tag base64url',
      b64url(ivB64),
      b64url(tagB64),
      aad(builderId, appId),
      ephPub,
    )
}

if (!plain) {
  console.log(`
Kết luận: GCM auth tag fail → hầu như chắc SAI CẶP KHOÁ.
  Private trên store phải là cặp của public nhúng trong app lúc đóng .haup.
  Public x vừa in ở trên phải trùng HIDEAUTO_WRAPPER_PUBLIC_KEY trên app.

  Nest đọc server/.env (không đọc .env.example). Đổi key xong phải restart pnpm dev.
`)
  process.exit(2)
}

if (plain.length < 4) {
  console.error('Inner quá ngắn.')
  process.exit(1)
}
const innerLen = plain.readUInt32LE(0)
step(innerLen > 0 && 4 + innerLen <= plain.length, 'innerLen', String(innerLen))
const inner = JSON.parse(plain.subarray(4, 4 + innerLen).toString('utf8'))
const exe = plain.subarray(4 + innerLen)
console.log('inner header:')
console.log(JSON.stringify({ name: inner.name, version: inner.version, createdAt: inner.createdAt, hasIcon: Boolean(inner.iconPng) }, null, 2))
console.log(`exe         ${exe.length} bytes`)
console.log('\nGiải mã thành công.')
