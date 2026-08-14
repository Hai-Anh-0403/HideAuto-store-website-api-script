import type { BuildStatus, KeyStatus, ScriptStatus, VersionStatus } from '../types'

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'accent'

export const scriptStatus: Record<ScriptStatus, { tone: Tone; label: string }> = {
  draft: { tone: 'neutral', label: 'Nháp' },
  pending_review: { tone: 'warn', label: 'Chờ duyệt' },
  published: { tone: 'ok', label: 'Đang bán' },
  rejected: { tone: 'bad', label: 'Bị từ chối' },
  archived: { tone: 'neutral', label: 'Lưu trữ' },
}

export const versionStatus: Record<VersionStatus, { tone: Tone; label: string }> = {
  approved: { tone: 'ok', label: 'Approved' },
  pending: { tone: 'warn', label: 'Chờ duyệt' },
  rejected: { tone: 'bad', label: 'Từ chối' },
}

export const buildStatus: Record<BuildStatus, { tone: Tone; label: string }> = {
  ready: { tone: 'ok', label: 'Sẵn sàng' },
  building: { tone: 'warn', label: 'Đang build…' },
  failed: { tone: 'bad', label: 'Lỗi' },
}

export const keyStatus: Record<KeyStatus, { tone: Tone; label: string }> = {
  active: { tone: 'ok', label: 'Active' },
  revoked: { tone: 'neutral', label: 'Đã thu hồi' },
}

export function fmtCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n)
}

export function newKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 14; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `SK-${s}`
}
