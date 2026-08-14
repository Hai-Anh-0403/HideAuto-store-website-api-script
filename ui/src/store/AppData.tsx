import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { MOCK_MEMBERS, MOCK_SCRIPTS } from '../data/mock'
import { newKey } from '../lib/pills'
import type { Member, Script } from '../types'

interface AppDataValue {
  scripts: Script[]
  members: Member[]
  getScript: (id: string) => Script | undefined
  createKey: (appId: string, label?: string) => void
  revokeKey: (appId: string, keyIndex: number) => void
  addVersion: (appId: string) => string
  buildMini: (appId: string) => void
  submitScript: (appId: string) => void
  toggleMemberBlock: (index: number) => void
}

const AppDataCtx = createContext<AppDataValue | null>(null)

function bump(version: string): string {
  const base = version === '—' ? '1.0.0' : version
  const parts = base.split('.').map((n) => Number(n) || 0)
  parts[2] = (parts[2] ?? 0) + 1
  return parts.join('.')
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [scripts, setScripts] = useState<Script[]>(() => JSON.parse(JSON.stringify(MOCK_SCRIPTS)))
  const [members, setMembers] = useState<Member[]>(() => JSON.parse(JSON.stringify(MOCK_MEMBERS)))

  const patch = useCallback((id: string, fn: (s: Script) => Script) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? fn(s) : s)))
  }, [])

  const getScript = useCallback((id: string) => scripts.find((s) => s.id === id), [scripts])

  const createKey = useCallback(
    (appId: string, label = 'Khóa mới') => {
      patch(appId, (s) => ({
        ...s,
        keys: [{ k: newKey(), label, status: 'active', used: 0, max: null }, ...s.keys],
      }))
    },
    [patch],
  )

  const revokeKey = useCallback(
    (appId: string, keyIndex: number) => {
      patch(appId, (s) => ({
        ...s,
        keys: s.keys.map((k, i) => (i === keyIndex ? { ...k, status: 'revoked' } : k)),
      }))
    },
    [patch],
  )

  const addVersion = useCallback(
    (appId: string): string => {
      const s = scripts.find((x) => x.id === appId)
      const nv = bump(s?.latest ?? '1.0.0')
      patch(appId, (cur) => ({
        ...cur,
        versions: [
          { v: nv, status: 'pending', published: false, minApp: cur.minApp, log: 'Bản mới — chờ duyệt', at: 'hôm nay', desc: 'Phiên bản mới vừa tải lên, đang chờ quét & duyệt.' },
          ...cur.versions,
        ],
      }))
      return nv
    },
    [patch, scripts],
  )

  const buildMini = useCallback(
    (appId: string) => {
      const s = scripts.find((x) => x.id === appId)
      const v = s?.latest === '—' ? '1.0.0' : (s?.latest ?? '1.0.0')
      patch(appId, (cur) => ({
        ...cur,
        hasMini: true,
        builds: [{ plat: 'Windows', arch: 'x64', v, status: 'building' }, ...cur.builds],
      }))
      window.setTimeout(() => {
        setScripts((prev) =>
          prev.map((cur) =>
            cur.id === appId
              ? { ...cur, builds: cur.builds.map((b, i) => (i === 0 ? { ...b, status: 'ready' } : b)) }
              : cur,
          ),
        )
      }, 1600)
    },
    [patch, scripts],
  )

  const submitScript = useCallback(
    (appId: string) => {
      patch(appId, (s) => ({
        ...s,
        status: 'pending_review',
        reject: null,
        scan: { creds: 0, shell: s.caps.shell },
        versions: s.versions.map((v, i) => (i === 0 ? { ...v, status: 'pending' } : v)),
      }))
    },
    [patch],
  )

  const toggleMemberBlock = useCallback((index: number) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, status: m.status === 'blocked' ? 'active' : 'blocked' } : m)),
    )
  }, [])

  const value = useMemo<AppDataValue>(
    () => ({ scripts, members, getScript, createKey, revokeKey, addVersion, buildMini, submitScript, toggleMemberBlock }),
    [scripts, members, getScript, createKey, revokeKey, addVersion, buildMini, submitScript, toggleMemberBlock],
  )

  return <AppDataCtx.Provider value={value}>{children}</AppDataCtx.Provider>
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataCtx)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
