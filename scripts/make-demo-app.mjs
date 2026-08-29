#!/usr/bin/env node
/**
 * Build a demo `.haup` (HAUP2 wrapper) for local upload tests.
 *
 * Encrypts the same way as the desktop app (`mini-app-wrapper.ts`): X25519 ECDH →
 * HKDF-SHA256(info="hideauto-miniapp-wrapper-v2") → AES-256-GCM, AAD = builderId\0appId.
 *
 * Default public key is the **dev** pair documented in `server/.env.example`. Swap
 * `--public-key` for the JWK `x` baked into a real app build.
 *
 *   node scripts/make-demo-app.mjs --name "Anna Bot" --version 1.0.0 \
 *       [--appId com.hideauto.mini.anna-bot] [--builderId u-123] \
 *       [--exe setup.exe] [--icon icon.png] [--out out.haup] \
 *       [--public-key <JWK x>]
 *
 * Without `--exe` the payload is ~2KB of fake bytes — enough to test unwrap, not an installer.
 */

import {
  createCipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

const DEV_PUBLIC_JWK_X = '_jAiJPS4hK_8EFP_bH4fgPvOvvC_s28vpUyeAG5UIhU'
const ALG = 'x25519-aes256gcm-hkdfsha256'
const HKDF_INFO = Buffer.from('hideauto-miniapp-wrapper-v2')
const MAGIC = Buffer.from('HAUP2')

function arg(flag, fallback = '') {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] ?? fallback : fallback
}

function has(flag) {
  return process.argv.includes(flag)
}

function u32le(n) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(n)
  return buf
}

function aad(builderId, appId) {
  return Buffer.concat([
    Buffer.from(builderId, 'utf8'),
    Buffer.from([0]),
    Buffer.from(appId, 'utf8'),
  ])
}

function wrap({ exe, name, version, appId, builderId, iconPng, publicJwkX }) {
  const innerHeader = {
    name,
    version,
    createdAt: new Date().toISOString(),
  }
  if (iconPng?.length) innerHeader.iconPng = iconPng.toString('base64')

  const innerJson = Buffer.from(JSON.stringify(innerHeader), 'utf8')
  const inner = Buffer.concat([u32le(innerJson.length), innerJson, exe])

  const serverPub = createPublicKey({
    key: { kty: 'OKP', crv: 'X25519', x: publicJwkX },
    format: 'jwk',
  })
  const eph = generateKeyPairSync('x25519')
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: serverPub })
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), HKDF_INFO, 32))
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad(builderId, appId))
  const ciphertext = Buffer.concat([cipher.update(inner), cipher.final()])
  const tag = cipher.getAuthTag()

  const outerHeader = {
    v: 2,
    alg: ALG,
    builderId,
    appId,
    ephPub: eph.publicKey.export({ format: 'jwk' }).x,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
  const outerJson = Buffer.from(JSON.stringify(outerHeader), 'utf8')
  return Buffer.concat([MAGIC, u32le(outerJson.length), outerJson, ciphertext])
}

if (has('--help') || has('-h')) {
  console.log(`Usage:
  node scripts/make-demo-app.mjs --name "Anna Bot" --version 1.0.0 [options]

Options:
  --name          innerHeader.name          (required)
  --version       innerHeader.version       (default 1.0.0)
  --appId         outerHeader.appId
  --builderId     outerHeader.builderId
  --exe           path to installer bytes
  --icon          path to PNG (embedded as innerHeader.iconPng)
  --out           output path               (default <slug>.haup)
  --public-key    X25519 JWK x              (default: local DEV pair)
`)
  process.exit(0)
}

const name = arg('--name')
if (!name) {
  console.error('Missing --name. See --help.')
  process.exit(1)
}

const version = arg('--version', '1.0.0')
const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60) || 'app'
const appId = arg('--appId', `com.hideauto.mini.${slug}`)
const builderId = arg('--builderId', '')
const publicJwkX = arg('--public-key', DEV_PUBLIC_JWK_X)
const out = resolve(arg('--out', `${slug}.haup`))

const exePath = arg('--exe')
const exe = exePath
  ? readFileSync(resolve(exePath))
  : Buffer.from(`demo-exe:${name}:${version}:${appId}\n`.padEnd(2048, '.'))

let iconPng = null
const iconPath = arg('--icon')
if (iconPath) {
  iconPng = readFileSync(resolve(iconPath))
  if (iconPng.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    console.error('--icon must be a PNG')
    process.exit(1)
  }
}

const buf = wrap({ exe, name, version, appId, builderId, iconPng, publicJwkX })
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, buf)
console.log(`Wrote ${basename(out)} (${buf.length} bytes)`)
console.log(`  name=${name} version=${version} appId=${appId}`)
console.log(`  public-key x=${publicJwkX}`)
if (!exePath) console.log('  (fake exe — pass --exe for a real installer)')
