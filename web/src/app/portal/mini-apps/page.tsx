'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pager } from '@/components/Pager'
import { PendingBanner } from '@/components/PendingBanner'
import { Pill } from '@/components/Pill'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtCount, scriptPill, scriptStatus } from '@/lib/pills'
import { useDebounced } from '@/lib/useDebounced'
import { useFetch } from '@/lib/useFetch'
import type { Page, Script, ScriptStatus } from '@/types'
import { useTitle } from '@/lib/useTitle'
import { GroupChips } from '@/components/Chips'

const PAGE_SIZE = 20

/** Mirrors the API's own allow-list (server/src/scripts/dto/list-scripts.dto.ts). */
const SCRIPT_STATUSES: ScriptStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
]

type ScriptSort = 'newest' | 'name' | 'downloads'
const SCRIPT_SORTS: ScriptSort[] = ['newest', 'name', 'downloads']

/* ────────────────── Mini apps list ────────────────── */

export default function MiniAppsPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  useTitle(t('miniApps.title'))
  const router = useRouter()
  const approved = seller?.status === 'APPROVED'
  const [skip, setSkip] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ScriptStatus | ''>('')
  const [sort, setSort] = useState<ScriptSort>('newest')

  // The box updates on every keystroke; the request waits for a pause.
  const search = useDebounced(q.trim())

  const filter = [
    search ? `search=${encodeURIComponent(search)}` : '',
    status ? `status=${status}` : '',
    sort === 'newest' ? '' : `sort=${sort}`,
  ]
    .filter(Boolean)
    .join('&')

  const scripts = useFetch(
    () =>
      approved
        ? api.get<Page<Script>>(
            `/scripts?skip=${skip}&limit=${PAGE_SIZE}${filter ? `&${filter}` : ''}`,
          )
        : Promise.resolve(null),
    `scripts:${approved}:${skip}:${filter}`,
  )
  const rows = scripts.data?.items ?? []

  /** Any filter change restarts at page 1 — page 3 of the old query is usually empty. */
  const reset = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setSkip(0)
  }

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('miniApps.title')}</h2>
          <p>{t('miniApps.subtitle')}</p>
        </div>
        <div className="sp" />
        {approved && (
          <button className="btn pri" onClick={() => router.push('/portal/mini-apps/new')}>
            {t('miniApps.upload')}
          </button>
        )}
      </div>

      <PendingBanner />
      {scripts.error && <div className="state bad">{scripts.error}</div>}

      <div className="card">
        <div className="card-h">
          <h3>{t('miniApps.count', { count: scripts.data?.total ?? 0 })}</h3>
          <div className="sp" />
          <input
            className="search"
            placeholder={t('miniApps.search')}
            value={q}
            onChange={(e) => reset(setQ)(e.target.value)}
          />
          <select
            className="input"
            style={{ width: 'auto', marginLeft: 8 }}
            value={status}
            onChange={(e) => reset(setStatus)(e.target.value as ScriptStatus | '')}
          >
            <option value="">{t('miniApps.filter.anyStatus')}</option>
            {SCRIPT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(scriptStatus[value].key)}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 'auto', marginLeft: 8 }}
            value={sort}
            onChange={(e) => reset(setSort)(e.target.value as ScriptSort)}
          >
            {SCRIPT_SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`miniApps.sort.${value}`)}
              </option>
            ))}
          </select>
          <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => scripts.reload()}>
            {t('common.refresh')}
          </button>
        </div>
        {scripts.loading && !scripts.data ? (
          <>
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
          </>
        ) : !rows.length ? (
          <div className="empty">
            <div className="icon">📦</div>
            <b>{filter ? t('miniApps.emptyFilteredTitle') : t('miniApps.emptyTitle')}</b>
            <p>{t('miniApps.emptyBody')}</p>
            {approved && (
              <button className="btn pri sm" onClick={() => router.push('/portal/mini-apps/new')}>
                {t('miniApps.upload')}
              </button>
            )}
          </div>
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>{t('miniApps.col.app')}</th>
                  <th>{t('miniApps.col.needs')}</th>
                  <th>{t('miniApps.col.status')}</th>
                  <th>{t('miniApps.col.version')}</th>
                  <th className="opt">{t('miniApps.col.downloads')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const badge = scriptPill(s.status)
                  return (
                    <tr
                      key={s.id}
                      className="rowlink"
                      onClick={() => router.push(`/portal/mini-apps/${s.id}`)}
                    >
                      <td>
                        <div className="u-main">{s.name}</div>
                        {s.shortDescription && <div className="u-sub">{s.shortDescription}</div>}
                      </td>
                      <td>
                        <div className="chips">
                          <GroupChips groups={s.nodeGroupsUsed} />
                          {!s.nodeGroupsUsed.length && (
                            <span className="note">{t('common.dash')}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Pill tone={badge.tone}>{t(badge.key)}</Pill>
                        {s.hasMiniApp && (
                          <span className="pill accent" style={{ marginLeft: 4 }}>
                            {t('miniApps.hasZip')}
                          </span>
                        )}
                      </td>
                      <td className="tnum">
                        {s.latestVersion ? `v${s.latestVersion}` : t('common.dash')}
                      </td>
                      <td className="tnum opt">{fmtCount(s.downloads, lang)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {scripts.data && (
          <Pager skip={skip} limit={PAGE_SIZE} total={scripts.data.total} onChange={setSkip} />
        )}
        <div className="card-foot">
          <span className="note">{t('miniApps.foot')}</span>
        </div>
      </div>
    </>
  )
}
