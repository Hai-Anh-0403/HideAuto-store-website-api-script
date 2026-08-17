import { useEffect, useState, type FormEvent } from 'react'
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
import type { Page, Script, ScriptDetail, ScriptVersion } from '../types'

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
          onChanged={() => scripts.reload()}
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

const DRAFT_KEY = 'storeautohide.upload-draft'

/** Phần chữ đang gõ dở — nhớ ở máy để đóng form hoặc F5 xong mở lại vẫn còn. */
interface SavedDraft {
  id: string
  name: string
  shortDescription: string
}

function readSavedDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as SavedDraft) : null
  } catch {
    return null
  }
}

/** Chọn file là gói được tải lên ngay ở dạng nháp; điền nốt thông tin rồi mới đăng. */
function UploadForm({
  onClose,
  onChanged,
  onDone,
}: {
  onClose: () => void
  onChanged: () => void
  onDone: (script: Script) => void
}) {
  const { toast } = useToast()
  const { t } = useI18n()
  const errorText = useErrorText()
  const [draft, setDraft] = useState<ScriptDetail | null>(null)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [minApp, setMinApp] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  // Giữ nguyên lỗi gốc rồi mới dịch lúc render — đổi ngôn ngữ là chữ đổi theo.
  const [error, setError] = useState<unknown>(null)

  // Mở lại form thì nhặt nháp cũ về: id nằm ở localStorage, nội dung lấy từ server.
  useEffect(() => {
    const saved = readSavedDraft()
    if (!saved) return
    setName(saved.name)
    setShortDescription(saved.shortDescription)
    api
      .get<ScriptDetail>(`/sellers/me/scripts/${saved.id}`)
      .then((detail) => {
        // Đã đăng hoặc đã xử lý ở chỗ khác thì thôi, không coi là nháp nữa.
        if (detail.status !== 'draft') {
          localStorage.removeItem(DRAFT_KEY)
          return
        }
        setDraft(detail)
        setVersion(detail.latest_version ?? '1.0.0')
        setMinApp(detail.min_app_version ?? '')
      })
      // Nháp đã bị xoá ở chỗ khác thì quên nó đi.
      .catch(() => localStorage.removeItem(DRAFT_KEY))
  }, [])

  useEffect(() => {
    if (!draft) return
    const saved: SavedDraft = { id: draft.id, name, shortDescription }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(saved))
  }, [draft, name, shortDescription])

  const forget = () => localStorage.removeItem(DRAFT_KEY)
  const latest = draft?.versions[0]

  /** Chọn file xong là tải luôn lên dạng nháp — thoát ra vẫn còn trong danh sách. */
  const pick = async (picked: File | null) => {
    if (!picked) return
    setError(null)
    setUploading(true)
    const form = new FormData()
    form.append('file', picked)
    form.append('version', version)
    form.append('publish', 'false')
    if (minApp) form.append('min_app_version', minApp)
    try {
      const created = await api.upload<Script>('/sellers/me/scripts', form)
      setDraft(await api.get<ScriptDetail>(`/sellers/me/scripts/${created.id}`))
      setName((current) => current || created.name)
      onChanged()
      toast(t('upload.draftSaved'))
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  const saveText = (id: string) =>
    api.patch<Script>(`/sellers/me/scripts/${id}`, {
      name,
      short_description: shortDescription || null,
    })

  const publish = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      await saveText(draft.id)
      const script = await api.post<Script>(`/sellers/me/scripts/${draft.id}/publish`)
      forget()
      toast(t('upload.done', { name: script.name }))
      onDone(script)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const keepDraft = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      await saveText(draft.id)
      onChanged()
      toast(t('upload.draftSaved'))
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const discard = async () => {
    if (!draft) return
    // Hành động phá hủy: hỏi lại, gói vừa tải lên sẽ mất.
    if (!window.confirm(t('upload.discardConfirm'))) return
    setBusy(true)
    setError(null)
    try {
      await api.del(`/sellers/me/scripts/${draft.id}`)
      forget()
      onChanged()
      toast(t('upload.discarded'))
      onClose()
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
      <form onSubmit={publish} style={{ padding: 16 }}>
        {draft ? (
          <div className="dropzone" style={{ marginBottom: 14 }}>
            ✓ <b>{latest?.source_filename ?? draft.name}</b> · {t('upload.draftChip')}
          </div>
        ) : (
          <label className="dropzone" style={{ display: 'block', cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="file"
              accept=".zip,.exe,.json,.workflow"
              className="hide"
              disabled={uploading}
              onChange={(e) => void pick(e.target.files?.[0] ?? null)}
            />
            {t('upload.pick', { zip: '.zip/.exe', json: 'app.workflow / .json' })}
          </label>
        )}

        {uploading && <div className="state">{t('upload.inspecting')}</div>}
        {latest && <Preview version={latest} fallbackName={draft?.name ?? ''} />}
        {error != null && <ErrorState message={errorText(error, 'upload.failed')} />}

        <div className="grid2">
          <label className="field">
            <span>{t('upload.name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              required={draft != null}
              placeholder={t('upload.namePlaceholder')}
            />
          </label>
          <label className="field">
            <span>{t('upload.version')}</span>
            <input
              className="input mono"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              pattern="\d+\.\d+\.\d+"
              disabled={draft != null}
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
              disabled={draft != null}
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

        <div className="formrow">
          <button className="btn pri" type="submit" disabled={busy || !draft}>
            {busy ? t('upload.publishing') : t('upload.publish')}
          </button>
          <button className="btn" type="button" disabled={busy || !draft} onClick={() => void keepDraft()}>
            {t('upload.saveDraft')}
          </button>
          <button className="btn bad" type="button" disabled={busy || !draft} onClick={() => void discard()}>
            {t('upload.discard')}
          </button>
          <span className="note">{draft ? t('upload.versionLocked') : t('upload.draftNote')}</span>
        </div>
      </form>
    </Card>
  )
}

/** Những gì store đọc được từ gói vừa tải lên. */
function Preview({ version, fallbackName }: { version: ScriptVersion; fallbackName: string }) {
  const { t } = useI18n()
  const creds = version.scan.embedded_credentials_count
  const appName = version.app_name ?? fallbackName

  // Gói .exe đóng kín: chưa mở được graph nên không có gì để khoe, chỉ báo đúng sự thật.
  if (!version.graph_extracted) {
    return (
      <div className="banner warn">
        <span className="bi">📦</span>
        <div>
          <b>{t('preview.opaqueTitle', { name: appName })}</b>
          {t('preview.opaqueBody')}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={creds ? 'banner bad' : 'banner ok'}>
        <span className="bi">{creds ? '🔑' : '🔎'}</span>
        <div>
          <b>{t('preview.extracted', { name: appName, count: version.node_count })}</b>
          {creds ? (
            <>
              {t('preview.credentials', { count: creds })}
              <div className="chips" style={{ marginTop: 6 }}>
                {version.scan.credential_paths.map((p) => (
                  <span key={p} className="keychip">
                    🔑 {p}
                  </span>
                ))}
              </div>
            </>
          ) : (
            t('preview.clean', {
              groups: version.node_groups_used.join(', ') || t('preview.noNodes'),
            })
          )}
        </div>
      </div>
      <div className="kv">
        <span className="klab">{t('preview.needs')}</span>
        <CapsChips caps={version.capabilities} />
      </div>
      <div className="kv" style={{ marginBottom: 14 }}>
        <span className="klab">{t('detail.caps.node')}</span>
        <b className="tnum">{version.node_count}</b>
        <GroupChips groups={version.node_groups_used} />
      </div>
    </>
  )
}
