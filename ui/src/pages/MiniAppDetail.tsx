import { Fragment, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { CapsChips } from '../ui/CapsChips'
import { Pill } from '../ui/Pill'
import { ErrorState, Loading } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { useErrorText } from '../lib/errors'
import { buildStatus, fmtBytes, fmtWhen, keyStatus, nextVersion, scriptStatus, versionStatus } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import type { KeyItem, MiniAppBuild, ScriptDetail, ScriptVersion } from '../types'

type Tab = 'ov' | 'ver' | 'keys' | 'mini'

export function MiniAppDetail() {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const { t } = useI18n()
  const errorText = useErrorText()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('ov')

  const script = useFetch(() => api.get<ScriptDetail>(`/sellers/me/scripts/${id}`), `script:${id}`)
  const keys = useFetch(() => api.get<KeyItem[]>(`/sellers/me/scripts/${id}/keys`), `keys:${id}`)
  const builds = useFetch(
    () => api.get<MiniAppBuild[]>(`/sellers/me/scripts/${id}/mini-app-builds`),
    `builds:${id}`,
  )

  const run = async (action: () => Promise<string>) => {
    try {
      toast(await action())
    } catch (err) {
      toast(errorText(err))
    }
  }

  if (script.loading) return <Loading what={t('nav.miniApps').toLowerCase()} />
  if (script.error || !script.data) return <ErrorState message={script.error ?? t('detail.notFound')} />

  const s = script.data
  const st = scriptStatus[s.status]
  const latest = s.versions[0]

  return (
    <>
      <button className="btn sm" onClick={() => nav('/mini-apps')}>
        {t('detail.back')}
      </button>
      <div className="vhead" style={{ marginTop: 12 }}>
        <div>
          <h2>{s.name}</h2>
          <p>
            {t('detail.meta', {
              slug: s.slug,
              version: s.latest_version ?? '—',
              count: s.node_count,
            })}
          </p>
        </div>
        <span style={{ marginLeft: 'auto' }}>
          <Pill tone={st.tone}>{t(st.key)}</Pill>
        </span>
      </div>

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
          onSubmit={() =>
            run(async () => {
              await api.post(`/sellers/me/scripts/${s.id}/submit`)
              script.reload()
              return t('detail.moderation.submitted')
            })
          }
          onDownloadGraph={() =>
            run(async () => {
              await api.download(`/sellers/me/scripts/${s.id}/download?format=graph`, `${s.slug}.json`)
              return t('detail.graphDownloaded')
            })
          }
        />
      )}

      {tab === 'ver' && <DetailVersions s={s} onUploaded={() => script.reload()} />}

      {tab === 'keys' && (
        <DetailKeys
          scriptId={s.id}
          scriptName={s.name}
          keys={keys.data ?? []}
          loading={keys.loading}
          error={keys.error}
          onCreate={(label) =>
            run(async () => {
              const key = await api.post<KeyItem>(`/sellers/me/scripts/${s.id}/keys`, {
                label: label || null,
              })
              keys.reload()
              return t('detailKeys.created', { key: key.key })
            })
          }
          onRevoke={(keyId) =>
            run(async () => {
              await api.post(`/sellers/me/keys/${keyId}/revoke`)
              keys.reload()
              return t('keys.revoked')
            })
          }
        />
      )}

      {tab === 'mini' && (
        <DetailPackaging
          builds={builds.data ?? []}
          loading={builds.loading}
          error={builds.error}
          onBuild={() =>
            run(async () => {
              await api.post<MiniAppBuild>(`/sellers/me/scripts/${s.id}/mini-app-builds`)
              builds.reload()
              script.reload()
              return t('packaging.built')
            })
          }
          onDownload={() =>
            run(async () => {
              await api.download(`/sellers/me/scripts/${s.id}/download?format=exe`, `${s.slug}.zip`)
              return t('packaging.downloading')
            })
          }
        />
      )}
    </>
  )
}

function DetailOverview({
  s,
  latest,
  onSubmit,
  onDownloadGraph,
}: {
  s: ScriptDetail
  latest: ScriptVersion | undefined
  onSubmit: () => void
  onDownloadGraph: () => void
}) {
  const { t } = useI18n()
  return (
    <>
      <Card>
        <CardHead
          title={t('detail.caps.title')}
          actions={
            <>
              <span className="ep" style={{ marginRight: 8 }}>
                <b>{t('common.auto')}</b> {t('common.fromGraph')}
              </span>
              <button className="btn sm" onClick={onDownloadGraph}>
                {t('detail.caps.downloadGraph')}
              </button>
            </>
          }
        />
        <div className="card-body">
          <div className="kv">
            <span className="klab">{t('detail.caps.node')}</span>
            {t('detail.caps.nodeValue', {
              count: s.node_count,
              groups: s.node_groups_used.join(', ') || '—',
            })}
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.needs')}</span>
            <CapsChips caps={s.capabilities} />
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.vars')}</span>{' '}
            {latest?.required_variables.length ? (
              latest.required_variables.map((v) => (
                <span key={v.key} className="keychip" style={{ marginRight: 5 }}>
                  {`{{${v.key}}}`}
                </span>
              ))
            ) : (
              <span className="u-sub">{t('common.none')}</span>
            )}
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.compat')}</span> {t('detail.caps.compatValue')}{' '}
            <b>{s.min_app_version ?? '—'}</b>
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.deps')}</span>{' '}
            {latest?.sub_workflow_ids.length ? (
              latest.sub_workflow_ids.map((w) => (
                <span key={w} className="keychip" style={{ marginRight: 5 }}>
                  {w}
                </span>
              ))
            ) : (
              <span className="u-sub">{t('detail.caps.noDeps')}</span>
            )}
          </div>
        </div>
      </Card>
      <Moderation s={s} latest={latest} onSubmit={onSubmit} />
    </>
  )
}

function Moderation({
  s,
  latest,
  onSubmit,
}: {
  s: ScriptDetail
  latest: ScriptVersion | undefined
  onSubmit: () => void
}) {
  const { t } = useI18n()
  const creds = latest?.scan.embedded_credentials_count ?? 0

  if (s.status === 'published') {
    return (
      <div className="banner ok">
        <span className="bi">✓</span>
        <div>
          <b>{t('detail.moderation.published')}</b>
          {s.capabilities.uses_shell
            ? t('detail.moderation.publishedShell')
            : t('detail.moderation.publishedNoShell')}
        </div>
      </div>
    )
  }
  if (s.status === 'pending_review') {
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
    <Card>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Pill tone={s.status === 'rejected' ? 'bad' : 'neutral'}>
          {t(s.status === 'rejected' ? 'status.script.rejected' : 'status.script.draft')}
        </Pill>
        <span className="u-sub">{s.reject_reason ?? t('detail.moderation.draft')}</span>
        <div className="sp" />
        <button className="btn pri sm" onClick={onSubmit}>
          {t('detail.moderation.submit')}
        </button>
      </div>
      {creds > 0 && (
        <div className="card-foot">
          <span className="note">
            {t('detail.moderation.credWarning', { count: creds })}{' '}
            {latest?.scan.credential_paths.map((p) => (
              <span key={p} className="keychip" style={{ marginRight: 4 }}>
                🔑 {p}
              </span>
            ))}
          </span>
        </div>
      )}
    </Card>
  )
}

function DetailVersions({ s, onUploaded }: { s: ScriptDetail; onUploaded: () => void }) {
  const { toast } = useToast()
  const { t, lang } = useI18n()
  const errorText = useErrorText()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState(nextVersion(s.latest_version))
  const [changelog, setChangelog] = useState('')
  const [busy, setBusy] = useState(false)
  // Lỗi gốc, dịch lúc render để đổi ngôn ngữ là đổi theo.
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
    if (s.min_app_version) form.append('min_app_version', s.min_app_version)
    try {
      const result = await api.upload<ScriptVersion>(`/sellers/me/scripts/${s.id}/versions`, form)
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
      <Card>
        <CardHead title={t('versions.uploadTitle')} />
        <form onSubmit={upload} style={{ padding: 16 }}>
          <label className="dropzone" style={{ display: 'block', cursor: 'pointer', marginBottom: 12 }}>
            <input
              type="file"
              accept=".zip,.exe,.json,.workflow"
              className="hide"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                ✓ <b>{file.name}</b>
              </>
            ) : (
              t('versions.pick')
            )}
          </label>
          {error != null && <ErrorState message={errorText(error, 'upload.failed')} />}
          <div className="grid2">
            <label className="field">
              <span>{t('upload.version')}</span>
              <input
                className="input mono"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                pattern="\d+\.\d+\.\d+"
                required
              />
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
      </Card>

      <Card>
        <CardHead title={t('versions.count', { count: s.versions.length })} />
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{t('versions.col.version')}</th>
                <th>{t('versions.col.changelog')}</th>
                <th>{t('versions.col.minApp')}</th>
                <th>{t('versions.col.status')}</th>
                <th>{t('versions.col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {s.versions.length ? (
                s.versions.map((v) => {
                  const vs = versionStatus[v.status]
                  return (
                    <Fragment key={v.id}>
                      <tr>
                        <td>
                          <span className="keychip">v{v.version}</span>{' '}
                          {v.id === s.latest_version_id && <Pill tone="ok">{t('versions.live')}</Pill>}
                        </td>
                        <td>
                          {v.changelog ?? <span className="u-sub">—</span>}
                          <div>
                            <button
                              className="btn sm"
                              style={{ marginTop: 5, padding: '2px 9px' }}
                              onClick={() => toggle(v.id)}
                            >
                              {open.has(v.id) ? t('versions.hideDetail') : t('versions.showDetail')}
                            </button>
                          </div>
                        </td>
                        <td className="tnum u-sub">{v.min_app_version ?? '—'}</td>
                        <td>
                          <Pill tone={vs.tone}>{t(vs.key)}</Pill>
                        </td>
                        <td className="u-sub tnum">{fmtWhen(v.created_at, lang, t('time.now'))}</td>
                      </tr>
                      {open.has(v.id) && (
                        <tr>
                          <td colSpan={5} style={{ background: 'var(--surface-2)', padding: '6px 16px 12px' }}>
                            <div className="kv">
                              <span className="klab">{t('versions.moderation')}</span>
                              {v.scan.embedded_credentials_count === 0 ? (
                                <span>{t('versions.cleanScan')}</span>
                              ) : (
                                <span>
                                  {t('versions.dirtyScan', { count: v.scan.embedded_credentials_count })}{' '}
                                  {v.scan.credential_paths.map((p) => (
                                    <span key={p} className="keychip" style={{ marginRight: 4 }}>
                                      🔑 {p}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                            <div className="kv">
                              <span className="klab">{t('versions.source')}</span>
                              <span className="mono">{v.source_filename ?? '—'}</span> → {v.delivery}
                            </div>
                            <div className="kv">
                              <span className="klab">{t('versions.caps')}</span>
                              <CapsChips caps={v.capabilities} />
                            </div>
                            <div className="kv">
                              <span className="klab">{t('versions.nodes')}</span>{' '}
                              {t('detail.caps.nodeValue', {
                                count: v.node_count,
                                groups: v.node_groups_used.join(', ') || '—',
                              })}
                              {v.uses_control_flow && ` ${t('versions.controlFlow')}`}
                            </div>
                            {v.moderation.reason && (
                              <div className="kv">
                                <span className="klab">{t('versions.rejectReason')}</span> {v.moderation.reason}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="u-sub" style={{ padding: '18px 16px' }}>
                    {t('versions.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span className="note">
            {t('versions.foot')}{' '}
            <span className="mono">POST /sellers/me/scripts/{'{id}'}/versions</span>
          </span>
        </div>
      </Card>
    </>
  )
}

function DetailKeys({
  scriptId,
  scriptName,
  keys,
  loading,
  error,
  onCreate,
  onRevoke,
}: {
  scriptId: string
  scriptName: string
  keys: KeyItem[]
  loading: boolean
  error: string | null
  onCreate: (label: string) => void
  onRevoke: (keyId: string) => void
}) {
  const { t } = useI18n()
  const [label, setLabel] = useState('')

  return (
    <Card>
      <CardHead
        title={t('detailKeys.title')}
        actions={
          <>
            <input
              className="search"
              placeholder={t('detailKeys.labelPlaceholder')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <button
              className="btn pri sm"
              style={{ marginLeft: 8 }}
              onClick={() => {
                onCreate(label)
                setLabel('')
              }}
            >
              {t('detailKeys.create')}
            </button>
          </>
        }
      />
      {error && <ErrorState message={error} />}
      {loading ? (
        <Loading what={t('nav.keys').toLowerCase()} />
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
              {keys.length ? (
                keys.map((k) => {
                  const ks = keyStatus[k.status]
                  return (
                    <tr key={k.id}>
                      <td>
                        <span className="keychip">{k.key}</span>
                      </td>
                      <td>{k.label ?? '—'}</td>
                      <td>
                        <Pill tone={ks.tone}>{t(ks.key)}</Pill>
                      </td>
                      <td className="tnum">
                        {k.used_count} / {k.max_uses ?? '∞'}
                      </td>
                      <td className="rowbtns">
                        <button className="btn bad sm" disabled={k.status !== 'active'} onClick={() => onRevoke(k.id)}>
                          {t('keys.revoke')}
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="u-sub" style={{ padding: '18px 16px' }}>
                    {t('detailKeys.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-foot">
        <span className="note">
          {t('detailKeys.foot', { name: scriptName })}{' '}
          <span className="mono">POST /sellers/me/scripts/{scriptId}/keys</span>
        </span>
      </div>
    </Card>
  )
}

function DetailPackaging({
  builds,
  loading,
  error,
  onBuild,
  onDownload,
}: {
  builds: MiniAppBuild[]
  loading: boolean
  error: string | null
  onBuild: () => void
  onDownload: () => void
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHead
        title={t('packaging.title')}
        actions={
          <button className="btn pri sm" onClick={onBuild}>
            {t('packaging.build')}
          </button>
        }
      />
      {error && <ErrorState message={error} />}
      {loading ? (
        <Loading />
      ) : builds.length ? (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{t('packaging.col.platform')}</th>
                <th>{t('packaging.col.fromVersion')}</th>
                <th>{t('packaging.col.builtBy')}</th>
                <th>{t('packaging.col.size')}</th>
                <th>{t('packaging.col.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {builds.map((b) => {
                const bs = buildStatus[b.status]
                return (
                  <tr key={b.id}>
                    <td>
                      🪟 {b.platform} · <span className="mono">{b.arch}</span>
                    </td>
                    <td>
                      <span className="keychip">v{b.app_version}</span>
                    </td>
                    <td>
                      <Pill tone="neutral">
                        {t(b.built_by === 'server' ? 'packaging.builtBy.server' : 'packaging.builtBy.agent')}
                      </Pill>
                    </td>
                    <td className="tnum u-sub">{fmtBytes(b.size_bytes)}</td>
                    <td>
                      <Pill tone={bs.tone}>{t(bs.key)}</Pill>
                    </td>
                    <td className="rowbtns">
                      <button className="btn sm" disabled={b.status !== 'ready'} onClick={onDownload}>
                        {t('packaging.download')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '22px 16px' }} className="u-sub">
          {t('packaging.empty')}
        </div>
      )}
      <div className="card-foot">
        <span className="note">{t('packaging.foot')}</span>
      </div>
    </Card>
  )
}
