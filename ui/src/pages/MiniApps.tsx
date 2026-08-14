import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { CapsChips } from '../ui/CapsChips'
import { GroupChips } from '../ui/GroupChips'
import { Pill } from '../ui/Pill'
import { Empty, ErrorState, PendingApproval, TableSkeleton } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { useErrorText } from '../lib/errors'
import { fmtCount, scriptStatus } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../store/auth'
import type { Page, Script, ScriptInspect } from '../types'

export function MiniApps() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const approved = seller?.status === 'approved'
  const nav = useNavigate()
  const [showUpload, setShowUpload] = useState(false)

  const scripts = useFetch(
    () => (approved ? api.get<Page<Script>>('/sellers/me/scripts?limit=100') : Promise.resolve(null)),
    `scripts:${approved}`,
  )
  const items = scripts.data?.items ?? []

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('miniApps.title')}</h2>
          <p>{t('miniApps.subtitle')}</p>
        </div>
      </div>

      {!approved && <PendingApproval />}
      {scripts.error && <ErrorState message={scripts.error} />}

      {showUpload && (
        <UploadForm
          onClose={() => setShowUpload(false)}
          onDone={(script) => {
            setShowUpload(false)
            scripts.reload()
            nav(`/mini-apps/${script.id}`)
          }}
        />
      )}

      <Card>
        <CardHead
          title={t('miniApps.count', { count: scripts.data?.total ?? 0 })}
          actions={
            <button className="btn pri sm" disabled={!approved} onClick={() => setShowUpload((v) => !v)}>
              {t('miniApps.upload')}
            </button>
          }
        />
        {scripts.loading ? (
          <TableSkeleton />
        ) : !items.length ? (
          <Empty
            icon="🧩"
            title={t('miniApps.emptyTitle')}
            body={t('miniApps.emptyBody')}
            action={
              <button className="btn pri sm" disabled={!approved} onClick={() => setShowUpload(true)}>
                {t('miniApps.upload')}
              </button>
            }
          />
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>{t('miniApps.col.app')}</th>
                  <th className="opt">{t('miniApps.col.needs')}</th>
                  <th>{t('miniApps.col.status')}</th>
                  <th>{t('miniApps.col.version')}</th>
                  <th className="opt">{t('miniApps.col.downloads')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const st = scriptStatus[s.status]
                  return (
                    <tr key={s.id} className="rowlink" onClick={() => nav(`/mini-apps/${s.id}`)}>
                      <td>
                        <div className="u-main">{s.name}</div>
                        <div className="u-sub">{s.short_description ?? s.slug}</div>
                      </td>
                      <td className="opt">
                        <div className="chips">
                          {s.capabilities.browser_platforms.map((p) => (
                            <Pill key={p} tone="accent">
                              {p}
                            </Pill>
                          ))}
                          {s.capabilities.uses_shell && <Pill tone="bad">⚠ shell</Pill>}
                        </div>
                      </td>
                      <td>
                        <Pill tone={st.tone}>{t(st.key)}</Pill>
                      </td>
                      <td>
                        <span className="keychip">v{s.latest_version ?? '—'}</span>
                        {s.has_mini_app && <span className="u-sub"> · {t('miniApps.hasZip')}</span>}
                      </td>
                      <td className="tnum opt">
                        {s.stats.downloads ? fmtCount(s.stats.downloads, lang) : '—'}
                      </td>
                      <td className="u-sub">›</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          <span className="note">{t('miniApps.foot')}</span>
        </div>
      </Card>
    </>
  )
}

function UploadForm({ onClose, onDone }: { onClose: () => void; onDone: (script: Script) => void }) {
  const { toast } = useToast()
  const { t } = useI18n()
  const errorText = useErrorText()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ScriptInspect | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [minApp, setMinApp] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [busy, setBusy] = useState(false)
  // Giữ nguyên lỗi gốc rồi mới dịch lúc render — đổi ngôn ngữ là chữ đổi theo.
  const [error, setError] = useState<unknown>(null)

  /** Chọn file xong là hỏi server luôn: gói này có gì, còn secret không. */
  const pick = async (picked: File | null) => {
    setFile(picked)
    setPreview(null)
    setError(null)
    if (!picked) return
    setInspecting(true)
    const form = new FormData()
    form.append('file', picked)
    try {
      const info = await api.upload<ScriptInspect>('/sellers/me/scripts/inspect', form)
      setPreview(info)
      if (!name) setName(info.suggested_name)
    } catch (err) {
      setError(err)
    } finally {
      setInspecting(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    if (name) form.append('name', name)
    form.append('version', version)
    if (minApp) form.append('min_app_version', minApp)
    if (shortDescription) form.append('short_description', shortDescription)
    try {
      const script = await api.upload<Script>('/sellers/me/scripts', form)
      toast(t('upload.done', { name: script.name }))
      onDone(script)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHead
        title={t('upload.title')}
        actions={
          <button className="btn sm" onClick={onClose}>
            {t('common.close')}
          </button>
        }
      />
      <form onSubmit={submit} style={{ padding: 16 }}>
        <label className="dropzone" style={{ display: 'block', cursor: 'pointer', marginBottom: 14 }}>
          <input
            type="file"
            accept=".zip,.exe,.json,.workflow"
            className="hide"
            onChange={(e) => void pick(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              ✓ <b>{file.name}</b> · {(file.size / 1024).toFixed(0)} KB
            </>
          ) : (
            t('upload.pick', { zip: '.zip/.exe', json: 'app.workflow / .json' })
          )}
        </label>

        {inspecting && <div className="state">{t('upload.inspecting')}</div>}
        {preview && <Preview info={preview} />}
        {error != null && <ErrorState message={errorText(error, 'upload.failed')} />}

        <div className="grid2">
          <label className="field">
            <span>{t('upload.name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              placeholder={preview?.suggested_name ?? t('upload.namePlaceholder')}
            />
          </label>
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
            <span>{t('upload.minApp')}</span>
            <input
              className="input mono"
              value={minApp}
              onChange={(e) => setMinApp(e.target.value)}
              pattern="\d+\.\d+\.\d+"
              placeholder="1.4.0"
            />
          </label>
          <label className="field">
            <span>{t('upload.shortDescription')}</span>
            <input
              className="input"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              maxLength={200}
            />
          </label>
        </div>

        <button className="btn pri" type="submit" disabled={busy || !file || inspecting}>
          {busy ? t('upload.submitting') : t('upload.submit')}
        </button>
        <span className="note" style={{ marginLeft: 10 }}>
          {t('upload.note')}
        </span>
      </form>
    </Card>
  )
}

/** Những gì store đọc được từ gói vừa chọn — hiện trước khi seller bấm tải lên. */
function Preview({ info }: { info: ScriptInspect }) {
  const { t } = useI18n()
  const creds = info.scan.embedded_credentials_count
  return (
    <>
      <div className={creds ? 'banner bad' : 'banner ok'}>
        <span className="bi">{creds ? '🔑' : '🔎'}</span>
        <div>
          <b>
            {info.app_name
              ? t('preview.extracted', { name: info.app_name, count: info.node_count })
              : t('preview.extractedAnon', { count: info.node_count })}
          </b>
          {creds ? (
            <>
              {t('preview.credentials', { count: creds })}
              <div className="chips" style={{ marginTop: 6 }}>
                {info.scan.credential_paths.map((p) => (
                  <span key={p} className="keychip">
                    🔑 {p}
                  </span>
                ))}
              </div>
            </>
          ) : (
            t('preview.clean', {
              groups: info.node_groups_used.join(', ') || t('preview.noNodes'),
            })
          )}
        </div>
      </div>
      <div className="kv">
        <span className="klab">{t('preview.needs')}</span>
        <CapsChips caps={info.capabilities} />
      </div>
      <div className="kv" style={{ marginBottom: 14 }}>
        <span className="klab">{t('detail.caps.node')}</span>
        <b className="tnum">{info.node_count}</b>
        <GroupChips groups={info.node_groups_used} />
      </div>
    </>
  )
}
