import type { MessageKey } from '../i18n'
import type { BuildStatus, KeyStatus, ScriptStatus, SellerStatus, VersionStatus } from '../types'

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'accent'

/** Tone + khoá dịch cho mỗi trạng thái — component tự gọi `t()`. */
interface Badge {
  tone: Tone
  key: MessageKey
}

export const scriptStatus: Record<ScriptStatus, Badge> = {
  draft: { tone: 'neutral', key: 'status.script.draft' },
  pending_review: { tone: 'warn', key: 'status.script.pending_review' },
  published: { tone: 'ok', key: 'status.script.published' },
  rejected: { tone: 'bad', key: 'status.script.rejected' },
  archived: { tone: 'neutral', key: 'status.script.archived' },
}

export const versionStatus: Record<VersionStatus, Badge> = {
  approved: { tone: 'ok', key: 'status.version.approved' },
  pending_review: { tone: 'warn', key: 'status.version.pending_review' },
  rejected: { tone: 'bad', key: 'status.version.rejected' },
}

export const buildStatus: Record<BuildStatus, Badge> = {
  ready: { tone: 'ok', key: 'status.build.ready' },
  building: { tone: 'warn', key: 'status.build.building' },
  failed: { tone: 'bad', key: 'status.build.failed' },
}

export const keyStatus: Record<KeyStatus, Badge> = {
  active: { tone: 'ok', key: 'status.key.active' },
  revoked: { tone: 'neutral', key: 'status.key.revoked' },
}

export const sellerStatus: Record<SellerStatus, Badge> = {
  pending: { tone: 'warn', key: 'status.seller.pending' },
  approved: { tone: 'ok', key: 'status.seller.approved' },
  rejected: { tone: 'bad', key: 'status.seller.rejected' },
  suspended: { tone: 'bad', key: 'status.seller.suspended' },
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

/** "3 giờ trước" / "3 hours ago" — Intl lo phần ngôn ngữ, quá 1 ngày thì hiện ngày. */
export function fmtWhen(iso: string | null, lang: string, justNow: string): string {
  if (!iso) return '—'
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return justNow
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'always' })
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  if (minutes < 60 * 24) return rtf.format(-Math.floor(minutes / 60), 'hour')
  return new Date(iso).toLocaleDateString(lang)
}

/** Số hiệu bản vá kế tiếp — mặc định khi tải version mới. */
export function nextVersion(current: string | null): string {
  const parts = (current ?? '1.0.0').split('.').map((n) => Number(n) || 0)
  return [parts[0] ?? 1, parts[1] ?? 0, (parts[2] ?? 0) + 1].join('.')
}
