'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pager } from '@/components/Pager'
import { PendingBanner } from '@/components/PendingBanner'
import { Pill } from '@/components/Pill'
import { TagPicker } from '@/components/TagPicker'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useErrorText } from '@/lib/errors'
import { fmtCount, scriptPill, scriptStatus } from '@/lib/pills'
import { useDebounced } from '@/lib/useDebounced'
import { useFetch } from '@/lib/useFetch'
import type { Page, Script, ScriptInspect, ScriptStatus } from '@/types'
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

/** "gmail-auto.zip" → "gmail-auto" — a sensible default name from the filename. */
function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

/* ────────────────── Pre-upload scan result ────────────────── */

function InspectPreview({
  inspect,
  filename,
}: {
  inspect: ScriptInspect
  filename: string
}) {
  const { t } = useI18n()

  // A packed .exe keeps its graph behind the desktop app's key: nothing was scanned,
  // so say that plainly rather than showing a reassuring "0 secrets".
  if (!inspect.graphExtracted) {
    return (
      <div className="banner warn" style={{ marginBottom: 12 }}>
        <span className="bi">📦</span>
        <div>
          <b>{t('preview.opaqueTitle', { name: filename })}</b>
          {t('preview.opaqueBody')}
        </div>
      </div>
    )
  }

  const dirty = inspect.embeddedCredentialsCount > 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div className={dirty ? 'banner warn' : 'banner ok'}>
        <span className="bi">{dirty ? '!' : '✓'}</span>
        <div>
          <b>
            {t('preview.extracted', {
              name: filename,
              count: inspect.nodeCount,
            })}
          </b>
          {dirty ? (
            <div>
              {t('preview.credentials', {
                count: inspect.embeddedCredentialsCount,
              })}
              <div className="chips" style={{ marginTop: 6 }}>
                {inspect.credentialPaths.map((p) => (
                  <span key={p} className="keychip">🔑 {p}</span>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {t('preview.clean', {
                groups: inspect.nodeGroupsUsed.join(', ') || t('preview.noNodes'),
              })}
            </div>
          )}
        </div>
      </div>

      {(inspect.nodeGroupsUsed.length > 0 || inspect.usesShell) && (
        <div className="chips" style={{ marginTop: 8 }}>
          <span className="note">{t('preview.needs')}:</span>
          <GroupChips groups={inspect.nodeGroupsUsed} />
          {inspect.usesShell && <Pill tone="bad">⚠ {t('cap.shell')}</Pill>}
        </div>
      )}
    </div>
  )
}

/* ────────────────── Upload form (modal-like card) ────────────────── */

function UploadForm({
  onDone,
  onCancel,
}: {
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [inspect, setInspect] = useState<ScriptInspect | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [changelog, setChangelog] = useState('')
  const [minApp, setMinApp] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  /**
   * Scan the picked file before anything is created, so credential warnings show up
   * while the seller can still fix them — nothing is persisted by this call.
   */
  const pickFile = async (f: File) => {
    setFile(f)
    setInspect(null)
    setInspectError(null)
    setInspecting(true)
    try {
      const form = new FormData()
      form.append('file', f)
      const result = await api.upload<ScriptInspect>('/scripts/inspect', form)
      setInspect(result)
      if (!name) setName(stripExtension(f.name))
    } catch (err) {
      setInspectError(errorText(err, 'upload.inspectFailed'))
    } finally {
      setInspecting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void pickFile(f)
  }

  const publish = async () => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('name', name || file.name)
      if (shortDesc) form.append('shortDescription', shortDesc)
      if (version) form.append('version', version)
      if (changelog) form.append('changelog', changelog)
      if (minApp) form.append('minAppVersion', minApp)
      if (tagIds.length) form.append('tagIds', tagIds.join(','))

      await api.upload('/scripts', form)
      toast(t('upload.done', { name: name || file.name }))
      onDone()
    } catch (err) {
      toast(errorText(err, 'upload.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-h">
        <h3>{t('upload.title')}</h3>
        <div className="sp" />
        <button className="btn sm" onClick={onCancel}>
          {t('common.close')}
        </button>
      </div>
      <div className="card-body">
        <div
          className="dropzone"
          style={{ marginTop: 8, marginBottom: 12, cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
        >
          <div>{file ? `✓ ${file.name}` : t('upload.pick', { zip: '.zip', exe: '.exe' })}</div>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.exe"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {inspecting && <div className="state">{t('upload.inspecting')}</div>}
        {inspectError && (
          <div className="banner bad">
            <span className="bi">!</span>
            <div>{inspectError}</div>
          </div>
        )}
        {inspect && file && (
          <InspectPreview inspect={inspect} filename={file.name} />
        )}

        <div className="grid2">
          <label className="field">
            <span>{t('upload.name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('upload.namePlaceholder')}
            />
          </label>
          <label className="field">
            <span>{t('upload.shortDescription')}</span>
            <input
              className="input"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
            />
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            <span>{t('upload.version')}</span>
            <input
              className="input mono"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              pattern="\d+\.\d+\.\d+"
            />
          </label>
          <label className="field">
            <span>{t('upload.minApp')}</span>
            <input
              className="input mono"
              value={minApp}
              onChange={(e) => setMinApp(e.target.value)}
              placeholder={t('upload.minAppPlaceholder')}
              pattern="\d+\.\d+\.\d+"
            />
          </label>
        </div>
        <label className="field">
          <span>{t('versions.changelog')}</span>
          <input
            className="input"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
          />
        </label>
        <TagPicker value={tagIds} onChange={setTagIds} />
        <div className="formrow" style={{ justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn pri sm" onClick={publish} disabled={busy || !file}>
            {busy ? t('upload.publishing') : t('upload.publish')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────── Mini apps list ────────────────── */

export default function MiniAppsPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  useTitle(t('miniApps.title'))
  const router = useRouter()
  const approved = seller?.status === 'APPROVED'
  const [skip, setSkip] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
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
          <button className="btn pri" onClick={() => setShowUpload(true)}>
            {t('miniApps.upload')}
          </button>
        )}
      </div>

      <PendingBanner />
      {scripts.error && <div className="state bad">{scripts.error}</div>}

      {showUpload && (
        <UploadForm
          onDone={() => {
            setShowUpload(false)
            scripts.reload()
          }}
          onCancel={() => setShowUpload(false)}
        />
      )}

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
              <button className="btn pri sm" onClick={() => setShowUpload(true)}>
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
