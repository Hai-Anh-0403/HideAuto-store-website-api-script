import type {
  BuildStatus,
  KeyState,
  KeyStatus,
  MemberStatus,
  ScriptStatus,
  SellerStatus,
  VersionStatus,
} from '@/types'

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'accent'

interface Badge {
  tone: Tone
  key: string
}

export const scriptStatus: Record<ScriptStatus, Badge> = {
  DRAFT: { tone: 'neutral', key: 'status.script.draft' },
  PENDING_REVIEW: { tone: 'warn', key: 'status.script.pending_review' },
  PUBLISHED: { tone: 'ok', key: 'status.script.published' },
  REJECTED: { tone: 'bad', key: 'status.script.rejected' },
  ARCHIVED: { tone: 'neutral', key: 'status.script.archived' },
}

export const versionStatus: Record<VersionStatus, Badge> = {
  APPROVED: { tone: 'ok', key: 'status.version.approved' },
  PENDING_REVIEW: { tone: 'warn', key: 'status.version.pending_review' },
  REJECTED: { tone: 'bad', key: 'status.version.rejected' },
}

export const buildStatus: Record<BuildStatus, Badge> = {
  READY: { tone: 'ok', key: 'status.build.ready' },
  BUILDING: { tone: 'warn', key: 'status.build.building' },
  FAILED: { tone: 'bad', key: 'status.build.failed' },
}

export const keyStatus: Record<KeyStatus, Badge> = {
  ACTIVE: { tone: 'ok', key: 'status.key.active' },
  REVOKED: { tone: 'neutral', key: 'status.key.revoked' },
}

/** What the API derived: a key can be ACTIVE in the database yet unusable. */
export const keyState: Record<KeyState, Badge> = {
  ACTIVE: { tone: 'ok', key: 'status.key.active' },
  REVOKED: { tone: 'neutral', key: 'status.key.revoked' },
  EXPIRED: { tone: 'warn', key: 'status.key.expired' },
  EXHAUSTED: { tone: 'warn', key: 'status.key.exhausted' },
}

export const sellerStatus: Record<SellerStatus, Badge> = {
  PENDING: { tone: 'warn', key: 'status.seller.pending' },
  APPROVED: { tone: 'ok', key: 'status.seller.approved' },
  REJECTED: { tone: 'bad', key: 'status.seller.rejected' },
  SUSPENDED: { tone: 'bad', key: 'status.seller.suspended' },
}

export const memberStatus: Record<MemberStatus, Badge> = {
  ACTIVE: { tone: 'ok', key: 'status.member.active' },
  BLOCKED: { tone: 'bad', key: 'status.member.blocked' },
}

export function sellerPill(s: string): Badge {
  return sellerStatus[s as SellerStatus] ?? { tone: 'neutral', key: s }
}

export function scriptPill(s: string): Badge {
  return scriptStatus[s as ScriptStatus] ?? { tone: 'neutral', key: s }
}

export function versionPill(s: string): Badge {
  return versionStatus[s as VersionStatus] ?? { tone: 'neutral', key: s }
}

export function buildPill(s: string): Badge {
  return buildStatus[s as BuildStatus] ?? { tone: 'neutral', key: s }
}

export function keyPill(s: string): Badge {
  return keyStatus[s as KeyStatus] ?? { tone: 'neutral', key: s }
}

export function memberPill(s: string): Badge {
  return memberStatus[s as MemberStatus] ?? { tone: 'neutral', key: s }
}

export function fmtCount(n: number, lang: string): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', lang === 'vi' ? ',' : '.')}k` : String(n)
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000

export function isOnline(lastSeenAt: string | null): boolean {
  return lastSeenAt != null && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS
}

export function fmtWhen(iso: string | null, lang: string, justNow: string): string {
  if (!iso) return '—'
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return justNow
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'always' })
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  if (minutes < 60 * 24) return rtf.format(-Math.floor(minutes / 60), 'hour')
  return new Date(iso).toLocaleDateString(lang)
}

export function nextVersion(current: string | null): string {
  const parts = (current ?? '1.0.0').split('.').map((n) => Number(n) || 0)
  return [parts[0] ?? 1, parts[1] ?? 0, (parts[2] ?? 0) + 1].join('.')
}
