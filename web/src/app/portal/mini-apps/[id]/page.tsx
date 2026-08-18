'use client'

import { Fragment, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Pill } from '@/components/Pill'
import { TagPicker } from '@/components/TagPicker'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/errors'
import {
  buildStatus,
  fmtBytes,
  fmtWhen,
  keyStatus,
  nextVersion,
  scriptStatus,
  versionStatus,
} from '@/lib/pills'
import { useFetch } from '@/lib/useFetch'
import type {
  Capabilities,
  KeyCreate,
  KeyItem,
  MiniAppBuild,
  Page,
  ScriptDetail,
  ScriptVersion,
} from '@/types'

type Tab = 'ov' | 'ver' | 'keys' | 'mini'

export default function MiniAppDetailPage() {
  const params = useParams()
  const id = (params.id as string) ?? ''
  const { toast } = useToast()
  const { t } = useI18n()
  const errorText = useErrorText()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('ov')

  const script = useFetch(
    () => api.get<ScriptDetail>(`/scripts/${id}`),
    `script:${id}`,
  )
  const keys = useFetch(() => api.get<Page<KeyItem>>(`/keys?scriptId=${id}`), `keys:${id}`)
  const builds = useFetch(
    () => api.get<Page<MiniAppBuild>>(`/scripts/${id}/builds`),
    `builds:${id}`,
  )

  const run = async (action: () => Promise<string>) => {
    try {
      toast(await action())
    } catch (err) {
      toast(errorText(err))
    }
  }

  if (script.loading) {
    return <div className="state">{t('common.loading', { what: t('nav.miniApps').toLowerCase() })}</div>
  }
  if (script.error || !script.data) {
    return <div className="state bad">{script.error ?? t('detail.notFound')}</div>
  }

  const s = script.data
  const st = scriptStatus[s.status]
  const latest = s.versions[0]

  return (
    <>
      <button className="btn sm" onClick={() => router.push('/portal/mini-apps')}>
        {t('detail.back')}
      </button>
      <div className="vhead" style={{ marginTop: 12 }}>
        <div>
          <h2>{s.name}</h2>
          <p>
            {t('detail.meta', {
              slug: s.slug,
              version: s.latestVersion ?? '—',
              count: s.nodeCount,
            })}
          </p>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill tone={st.tone}>{t(st.key)}</Pill>
          {s.status === 'DRAFT' ? (
            <button
              className="btn bad sm"
              onClick={() => {
                if (!window.confirm(t('upload.discardConfirm'))) return
                void run(async () => {
                  await api.del(`/scripts/${s.id}`)
                  router.push('/portal/mini-apps')
                  return t('upload.discarded')
                })
              }}
            >
              {t('upload.discard')}
            </button>
          ) : s.status === 'ARCHIVED' ? (
            <button
              className="btn sm"
              onClick={() =>
                run(async () => {
                  await api.post(`/scripts/${s.id}/unarchive`)
                  script.reload()
                  return t('detail.unarchived', { name: s.name })
                })
              }
            >
              {t('detail.unarchive')}
            </button>
          ) : (
            <button
              className="btn bad sm"
              onClick={() => {
                if (!window.confirm(t('detail.archiveConfirm', { name: s.name }))) return
                void run(async () => {
                  await api.post(`/scripts/${s.id}/archive`)
                  script.reload()
                  return t('detail.archived', { name: s.name })
                })
              }}
            >
              {t('detail.archive')}
            </button>
          )}
        </span>
      </div>

      {s.status === 'ARCHIVED' && (
        <div className="banner warn">
          <span className="bi">📦</span>
          <div>
            <b>{t('detail.archivedBanner')}</b>
            {t('detail.archivedBannerBody')}
          </div>
        </div>
      )}

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'ov' ? 'on' : ''} onClick={() => setTab('ov')}>
          {t('detail.tab.overview')}
        </button>
        <button className={tab === 'ver' ? 'on' : ''} onClick={() => setTab('ver')}>
          {t('detail.tab.versions')}
        </button>
        <button className={tab === 'keys' ? 'on' : ''} onClick={() => setTab('keys')}>
          {t('detail.tab.keys')}
        </button>
        <button className={tab === 'mini' ? 'on' : ''} onClick={() => setTab('mini')}>
          {t('detail.tab.packaging')}
        </button>
      </div>

      {tab === 'ov' && (
        <DetailOverview
          s={s}
          latest={latest}
          onSaved={() => script.reload()}
          onSubmit={() =>
            run(async () => {
              await api.post(`/scripts/${s.id}/submit`)
              script.reload()
              return t('detail.moderation.submitted')
            })
          }
        />
      )}
      {tab === 'ver' && <DetailVersions s={s} onUploaded={() => script.reload()} />}
      {tab === 'keys' && (
        <DetailKeys
          scriptName={s.name}
          keys={keys.data?.items ?? []}
          loading={keys.loading}
          error={keys.error}
          onCreate={(payload) =>
            run(async () => {
              const key = await api.post<KeyItem>(`/keys/scripts/${s.id}/keys`, payload)
              keys.reload()
              return t('detailKeys.created', { key: key.key })
            })
          }
          onRevoke={(keyId) =>
            run(async () => {
              await api.patch(`/keys/${keyId}/revoke`)
              keys.reload()
              return t('keys.revoked')
            })
          }
        />
      )}
      {tab === 'mini' && (
        <DetailPackaging
          builds={builds.data?.items ?? []}
          loading={builds.loading}
          error={builds.error}
          onBuild={() =>
            run(async () => {
              await api.post<MiniAppBuild>(`/scripts/${s.id}/builds`, {})
              builds.reload()
              script.reload()
              return t('packaging.built')
            })
          }
          onDownload={() =>
            run(async () => {
              await api.download(`/scripts/${s.id}/download`, `${s.slug}.json`)
              return t('packaging.downloading')
            })
          }
        />
      )}
    </>
  )
}

/* ---------- Capabilities + Group chips ---------- */

function CapsChips({ caps }: { caps: Capabilities }) {
  return (
    <div className="chips">
      {caps.browser_platforms?.map((p) => (
        <Pill key={p} tone="accent">{p}</Pill>
      ))}
      {caps.uses_shell && <Pill tone="bad">shell</Pill>}
      {caps.requires_proxy && <Pill tone="neutral">proxy</Pill>}
      {caps.uses_ai_llm && <Pill tone="accent">AI</Pill>}
      {caps.uses_email && <Pill tone="neutral">email</Pill>}
      {caps.uses_2fa && <Pill tone="warn">2FA</Pill>}
    </div>
  )
}

function GroupChips({ groups }: { groups: string[] }) {
  return (
    <span className="chips" style={{ display: 'inline-flex' }}>
      {groups.map((g) => (
        <span key={g} className="groupchip" data-group={g}>{g}</span>
      ))}
    </span>
  )
}

/* ---------- Overview tab ---------- */

function DetailOverview({
  s, latest, onSaved, onSubmit,
}: {
  s: ScriptDetail; latest: ScriptVersion | undefined; onSaved: () => void; onSubmit: () => void
}) {
  const { t } = useI18n()
  return (
    <>
      <EditListing s={s} onSaved={onSaved} />
      <div className="card">
        <div className="card-h">
          <h3>{t('detail.caps.title')}</h3>
          <div className="sp" />
          <span className="ep"><b>{t('common.auto')}</b> {t('common.fromGraph')}</span>
        </div>
        <div className="card-body">
          <div className="kv">
            <span className="klab">{t('detail.caps.node')}</span>
            <b className="tnum">{s.nodeCount}</b>
            <GroupChips groups={s.nodeGroupsUsed} />
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.compat')}</span> {t('detail.caps.compatValue')}{' '}
            <b>{s.minAppVersion ?? '—'}</b>
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.deps')}</span>{' '}
            {latest?.subWorkflowIds.length ? (
              latest.subWorkflowIds.map((w) => (
                <span key={w} className="keychip" style={{ marginRight: 5 }}>{w}</span>
              ))
            ) : (
              <span className="u-sub">{t('detail.caps.noDeps')}</span>
            )}
          </div>
        </div>
      </div>
      <Moderation s={s} latest={latest} onSubmit={onSubmit} />
    </>
  )
}

function EditListing({ s, onSaved }: { s: ScriptDetail; onSaved: () => void }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const [name, setName] = useState(s.name)
  const [short, setShort] = useState(s.shortDescription ?? '')
  const [description, setDescription] = useState(s.description ?? '')
  const [tagIds, setTagIds] = useState<string[]>(s.tags.map((tg) => tg.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const dirty =
    name !== s.name ||
    short !== (s.shortDescription ?? '') ||
    description !== (s.description ?? '') ||
    JSON.stringify(tagIds) !== JSON.stringify(s.tags.map((tg) => tg.id))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.patch(`/scripts/${s.id}`, {
        name,
        shortDescription: short || null,
        description: description || null,
        tagIds,
      })
      toast(t('detail.edit.saved'))
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-h"><h3>{t('detail.edit.title')}</h3></div>
      <form onSubmit={save} style={{ padding: 16 }}>
        {error != null && <div className="state bad">{errorText(error)}</div>}
        <div className="grid2">
          <label className="field">
            <span>{t('detail.edit.name')}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={120} required />
          </label>
          <label className="field">
            <span>{t('detail.edit.shortDescription')}</span>
            <input className="input" value={short} onChange={(e) => setShort(e.target.value)} maxLength={200} placeholder={t('detail.edit.shortPlaceholder')} />
          </label>
        </div>
        <label className="field">
          <span>{t('detail.edit.description')}</span>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000} placeholder={t('detail.edit.descriptionPlaceholder')} />
        </label>
        <TagPicker value={tagIds} onChange={setTagIds} />
        <div className="formrow">
          <button className="btn pri sm" type="submit" disabled={busy || !dirty}>
            {busy ? t('detail.edit.saving') : t('detail.edit.save')}
          </button>
          <span className="note">{t('detail.edit.slugNote', { slug: s.slug })}</span>
        </div>
      </form>
    </div>
  )
}

function Moderation({ s, latest, onSubmit }: { s: ScriptDetail; latest: ScriptVersion | undefined; onSubmit: () => void }) {
  const { t } = useI18n()
  const creds = latest?.scan.embedded_credentials_count ?? 0

  if (s.status === 'PUBLISHED') {
    return (
      <div className="banner ok">
        <span className="bi">✓</span>
        <div>
          <b>{t('detail.moderation.published')}</b>
          {s.capabilities.uses_shell ? t('detail.moderation.publishedShell') : t('detail.moderation.publishedNoShell')}
        </div>
      </div>
    )
  }
  if (s.status === 'PENDING_REVIEW') {
    return (
      <div className="banner warn">
        <span className="bi">⏳</span>
        <div>
          <b>{t('detail.moderation.pending')}</b>
          {t('detail.moderation.pendingBody', { count: creds })}
        </div>
      </div>
    )
  }
  return (
    <div className="card">
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Pill tone={s.status === 'REJECTED' ? 'bad' : 'neutral'}>
          {t(s.status === 'REJECTED' ? 'status.script.rejected' : 'status.script.draft')}
        </Pill>
        <span className="u-sub">{s.rejectReason ?? t('detail.moderation.draft')}</span>
        <div className="sp" />
        <button className="btn pri sm" onClick={onSubmit}>{t('detail.moderation.submit')}</button>
      </div>
      {creds > 0 && (
        <div className="card-foot">
          <span className="note">
            {t('detail.moderation.credWarning', { count: creds })}{' '}
            {latest?.scan.credential_paths.map((p) => (
              <span key={p} className="keychip" style={{ marginRight: 4 }}>{p}</span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------- Versions tab ---------- */

function DetailVersions({ s, onUploaded }: { s: ScriptDetail; onUploaded: () => void }) {
  const { toast } = useToast()
  const { t, lang } = useI18n()
  const errorText = useErrorText()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState(nextVersion(s.latestVersion))
  const [changelog, setChangelog] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const toggle = (vid: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(vid)) next.delete(vid)
      else next.add(vid)
      return next
    })

  const upload = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('version', version)
    if (changelog) form.append('changelog', changelog)
    try {
      const result = await api.upload<ScriptVersion>(`/scripts/${s.id}/versions`, form)
      toast(t('versions.uploaded', { version: result.version }))
      setFile(null)
      setChangelog('')
      onUploaded()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-h"><h3>{t('versions.uploadTitle')}</h3></div>
        <form onSubmit={upload} style={{ padding: 16 }}>
          <label className="dropzone" style={{ display: 'block', cursor: 'pointer', marginBottom: 12 }}>
            <input type="file" accept=".zip,.exe,.json,.workflow" className="hide" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (<>✓ <b>{file.name}</b></>) : t('versions.pick')}
          </label>
          {error != null && <div className="state bad">{errorText(error, 'upload.failed')}</div>}
          <div className="grid2">
            <label className="field">
              <span>{t('upload.version')}</span>
              <input className="input mono" value={version} onChange={(e) => setVersion(e.target.value)} pattern="\d+\.\d+\.\d+" required />
            </label>
            <label className="field">
              <span>{t('versions.changelog')}</span>
              <input className="input" value={changelog} onChange={(e) => setChangelog(e.target.value)} />
            </label>
          </div>
          <button className="btn pri sm" type="submit" disabled={busy || !file}>
            {busy ? t('versions.scanning') : t('versions.submit')}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-h"><h3>{t('versions.count', { count: s.versions.length })}</h3></div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{t('versions.col.version')}</th>
                <th>{t('versions.col.changelog')}</th>
                <th className="opt">{t('versions.col.minApp')}</th>
                <th>{t('versions.col.status')}</th>
                <th className="opt">{t('versions.col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {s.versions.length ? s.versions.map((v) => {
                const vs = versionStatus[v.status]
                return (
                  <Fragment key={v.id}>
                    <tr>
                      <td>
                        <span className="keychip">v{v.version}</span>{' '}
                        {v.id === s.latestVersionId && <Pill tone="ok">{t('versions.live')}</Pill>}
                      </td>
                      <td>
                        {v.changelog ?? <span className="u-sub">—</span>}
                        <div>
                          <button className="btn sm" style={{ marginTop: 5, padding: '2px 9px' }} onClick={() => toggle(v.id)}>
                            {open.has(v.id) ? t('versions.hideDetail') : t('versions.showDetail')}
                          </button>
                        </div>
                      </td>
                      <td className="tnum u-sub opt">{v.minAppVersion ?? '—'}</td>
                      <td><Pill tone={vs.tone}>{t(vs.key)}</Pill></td>
                      <td className="u-sub tnum opt">{fmtWhen(v.createdAt, lang, t('time.now'))}</td>
                    </tr>
                    {open.has(v.id) && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--surface-2)', padding: '6px 16px 12px' }}>
                          <div className="kv">
                            <span className="klab">{t('versions.moderation')}</span>
                            {!v.graphExtracted ? (
                              <span>{t('versions.noGraph')}</span>
                            ) : v.scan.embedded_credentials_count === 0 ? (
                              <span>{t('versions.cleanScan')}</span>
                            ) : (
                              <span>
                                {t('versions.dirtyScan', { count: v.scan.embedded_credentials_count })}{' '}
                                {v.scan.credential_paths.map((p) => (
                                  <span key={p} className="keychip" style={{ marginRight: 4 }}>{p}</span>
                                ))}
                              </span>
                            )}
                          </div>
                          <div className="kv">
                            <span className="klab">{t('versions.source')}</span>
                            <span className="mono">{v.sourceFilename ?? '—'}</span> → {v.delivery}
                          </div>
                          <div className="kv">
                            <span className="klab">{t('versions.caps')}</span>
                            <CapsChips caps={v.capabilities} />
                          </div>
                          <div className="kv">
                            <span className="klab">{t('versions.nodes')}</span>
                            <b className="tnum">{v.nodeCount}</b>
                            <GroupChips groups={v.nodeGroupsUsed} />
                            {v.usesControlFlow && <span className="u-sub">{t('versions.controlFlow')}</span>}
                          </div>
                          {v.reviewNote && (
                            <div className="kv">
                              <span className="klab">{t('versions.rejectReason')}</span> {v.reviewNote}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              }) : (
                <tr><td colSpan={5} className="u-sub" style={{ padding: '18px 16px' }}>{t('versions.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-foot"><span className="note">{t('versions.foot')}</span></div>
      </div>
    </>
  )
}

/* ---------- Keys tab ---------- */

function DetailKeys({ scriptName, keys, loading, error, onCreate, onRevoke }: {
  scriptName: string; keys: KeyItem[]; loading: boolean; error: string | null
  onCreate: (payload: KeyCreate) => void; onRevoke: (keyId: string) => void
}) {
  const { t } = useI18n()
  const [label, setLabel] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const create = (e: FormEvent) => {
    e.preventDefault()
    onCreate({ label: label || null, maxUses: maxUses ? Number(maxUses) : null, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null })
    setLabel(''); setMaxUses(''); setExpiresAt('')
  }

  return (
    <div className="card">
      <div className="card-h"><h3>{t('detailKeys.title')}</h3></div>
      <form onSubmit={create} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="grid2">
          <label className="field">
            <span>{t('keys.col.label')}</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('detailKeys.labelPlaceholder')} maxLength={100} />
          </label>
          <label className="field">
            <span>{t('detailKeys.maxUses')}</span>
            <input className="input tnum" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder={t('detailKeys.maxUsesPlaceholder')} />
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            <span>{t('detailKeys.expires')}</span>
            <input className="input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        </div>
        <button className="btn pri sm" type="submit">{t('detailKeys.create')}</button>
      </form>
      {error && <div className="state bad">{error}</div>}
      {loading ? (
        <><div className="skel" /><div className="skel" /><div className="skel" /></>
      ) : !keys.length ? (
        <div className="empty">
          <div className="icon">🔑</div>
          <b>{t('detailKeys.emptyTitle')}</b>
          <p>{t('detailKeys.emptyBody')}</p>
        </div>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{t('keys.col.key')}</th>
                <th>{t('keys.col.label')}</th>
                <th>{t('keys.col.status')}</th>
                <th>{t('keys.col.used')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const ks = keyStatus[k.status]
                return (
                  <tr key={k.id}>
                    <td><span className="keychip">{k.key}</span></td>
                    <td>
                      {k.label ?? '—'}
                      {k.expiresAt && <div className="u-sub">{t('detailKeys.expires')}: {new Date(k.expiresAt).toLocaleString()}</div>}
                    </td>
                    <td><Pill tone={ks.tone}>{t(ks.key)}</Pill></td>
                    <td className="tnum">{k.usedCount} / {k.maxUses ?? '∞'}</td>
                    <td className="rowbtns">
                      <button className="btn bad sm" disabled={k.status !== 'ACTIVE'} onClick={() => onRevoke(k.id)}>{t('keys.revoke')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-foot"><span className="note">{t('detailKeys.foot', { name: scriptName })}</span></div>
    </div>
  )
}

/* ---------- Packaging tab ---------- */

function DetailPackaging({ builds, loading, error, onBuild, onDownload }: {
  builds: MiniAppBuild[]; loading: boolean; error: string | null; onBuild: () => void; onDownload: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('packaging.title')}</h3>
        <div className="sp" />
        <button className="btn pri sm" onClick={onBuild}>{t('packaging.build')}</button>
      </div>
      {error && <div className="state bad">{error}</div>}
      {loading ? (
        <div className="state">{t('common.loadingShort')}</div>
      ) : builds.length ? (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{t('packaging.col.platform')}</th>
                <th>{t('packaging.col.fromVersion')}</th>
                <th className="opt">{t('packaging.col.builtBy')}</th>
                <th className="opt">{t('packaging.col.size')}</th>
                <th>{t('packaging.col.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {builds.map((b) => {
                const bs = buildStatus[b.status]
                return (
                  <tr key={b.id}>
                    <td>{b.platform} · <span className="mono">{b.arch}</span></td>
                    <td><span className="keychip">v{b.appVersion}</span></td>
                    <td className="opt">
                      <Pill tone="neutral">{t(b.builtBy === 'server' ? 'packaging.builtBy.server' : 'packaging.builtBy.agent')}</Pill>
                    </td>
                    <td className="tnum u-sub opt">{fmtBytes(b.sizeBytes)}</td>
                    <td><Pill tone={bs.tone}>{t(bs.key)}</Pill></td>
                    <td className="rowbtns">
                      <button className="btn sm" disabled={b.status !== 'READY'} onClick={onDownload}>{t('packaging.download')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '22px 16px' }} className="u-sub">{t('packaging.empty')}</div>
      )}
      <div className="card-foot"><span className="note">{t('packaging.foot')}</span></div>
    </div>
  )
}
