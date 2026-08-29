'use client'

import { Fragment, useCallback, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { useConfirm } from '@/components/Confirm'
import { TagPicker } from '@/components/TagPicker'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import { useErrorText } from '@/lib/errors'
import {
  buildStatus,
  fmtBytes,
  fmtWhen,
  keyState,
  nextVersion,
  scriptStatus,
  versionStatus,
} from '@/lib/pills'
import { useFetch } from '@/lib/useFetch'
import { useTitle } from '@/lib/useTitle'
import { CapsChips, GroupChips } from '@/components/Chips'
import { RichTextEditor } from '@/components/RichTextEditor'
import { VideoInput } from '@/components/VideoInput'
import type {
  KeyCreate,
  KeyItem,
  MiniAppBuild,
  Page,
  ScriptDetail,
  ScriptVersion,
} from '@/types'

const MAX_THUMBNAIL_SIZE = 1 * 1024 * 1024
const MAX_IMAGE_SIZE = 3 * 1024 * 1024

async function uploadMedia(
  file: File,
  type: 'thumbnail' | 'image',
): Promise<string | null> {
  const limit = type === 'thumbnail' ? MAX_THUMBNAIL_SIZE : MAX_IMAGE_SIZE
  if (file.size > limit || !file.type.startsWith('image/')) return null
  const form = new FormData()
  form.append('file', file)
  form.append('type', type)
  try {
    const result = await api.upload<{ url: string }>('/media', form)
    return result.url
  } catch {
    return null
  }
}

type Tab = 'ov' | 'ver' | 'keys' | 'mini'

const KEY_PAGE_SIZE = 20

export default function MiniAppDetailPage() {
  const params = useParams()
  const id = (params.id as string) ?? ''
  const { toast } = useToast()
  const { t } = useI18n()
  const errorText = useErrorText()
  const router = useRouter()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('ov')
  const [keySkip, setKeySkip] = useState(0)
  const [buildSkip, setBuildSkip] = useState(0)

  const script = useFetch(
    () => api.get<ScriptDetail>(`/scripts/${id}`),
    `script:${id}`,
  )
  const keys = useFetch(
    () => api.get<Page<KeyItem>>(`/keys?scriptId=${id}&skip=${keySkip}&limit=${KEY_PAGE_SIZE}`),
    `keys:${id}:${keySkip}`,
  )
  const builds = useFetch(
    () => api.get<Page<MiniAppBuild>>(`/scripts/${id}/builds?skip=${buildSkip}&limit=${KEY_PAGE_SIZE}`),
    `builds:${id}:${buildSkip}`,
  )

  // Above the early returns below: hooks cannot be conditional. Undefined while the
  // fetch is in flight, which leaves the layout's own title in place.
  useTitle(script.data?.name)

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
              onClick={() =>
                void confirm({
                  title: t('upload.discard'),
                  body: t('upload.discardConfirm'),
                  confirmLabel: t('upload.discard'),
                  danger: true,
                }).then(({ ok }) => {
                  if (!ok) return
                  void run(async () => {
                    await api.del(`/scripts/${s.id}`)
                    router.push('/portal/mini-apps')
                    return t('upload.discarded')
                  })
                })
              }
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
              onClick={() =>
                void confirm({
                  title: t('detail.archive'),
                  body: t('detail.archiveConfirm', { name: s.name }),
                  confirmLabel: t('detail.archive'),
                  danger: true,
                }).then(({ ok }) => {
                  if (!ok) return
                  void run(async () => {
                    await api.post(`/scripts/${s.id}/archive`)
                    script.reload()
                    return t('detail.archived', { name: s.name })
                  })
                })
              }
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
      {tab === 'ver' && (
        <DetailVersions
          s={s}
          onUploaded={() => script.reload()}
          onRollback={(version) =>
            void confirm({
              title: t('versions.rollback'),
              body: t('versions.rollbackConfirm', { version: version.version }),
              confirmLabel: t('versions.rollback'),
            }).then(({ ok }) => {
              if (!ok) return
              void run(async () => {
                await api.post(`/scripts/${s.id}/versions/${version.id}/rollback`)
                script.reload()
                return t('versions.rolledBack', { version: version.version })
              })
            })
          }
          onDelete={(version) =>
            void confirm({
              title: t('versions.delete'),
              body: t('versions.deleteConfirm', { version: version.version }),
              confirmLabel: t('versions.delete'),
              danger: true,
            }).then(({ ok }) => {
              if (!ok) return
              void run(async () => {
                await api.del(`/scripts/${s.id}/versions/${version.id}`)
                script.reload()
                return t('versions.deleted', { version: version.version })
              })
            })
          }
        />
      )}
      {tab === 'keys' && (
        <DetailKeys
          scriptName={s.name}
          keys={keys.data?.items ?? []}
          total={keys.data?.total ?? 0}
          skip={keySkip}
          onSkip={setKeySkip}
          loading={keys.loading}
          error={keys.error}
          onCopy={(value, message) =>
            void copyText(value).then((ok) => toast(ok ? message : t('keys.copyFailed')))
          }
          onCreate={(payload) =>
            run(async () => {
              const made = await api.post<KeyItem[]>('/keys', { ...payload, scriptId: s.id })
              setKeySkip(0)
              keys.reload()
              return made.length === 1
                ? t('detailKeys.created', { key: made[0].key })
                : t('keys.created', { count: made.length })
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
          total={builds.data?.total ?? 0}
          skip={buildSkip}
          onSkip={setBuildSkip}
          versions={s.versions.filter((v) => v.status === 'APPROVED')}
          liveVersionId={s.latestVersionId}
          loading={builds.loading}
          error={builds.error}
          onBuild={(versionId) =>
            run(async () => {
              await api.post<MiniAppBuild>(
                `/scripts/${s.id}/builds`,
                versionId ? { versionId } : {},
              )
              setBuildSkip(0)
              builds.reload()
              script.reload()
              return t('packaging.built')
            })
          }
          onDownload={(build) =>
            void run(async () => {
              // Always fetch→blob (same as key export). Navigating to a raw .exe URL
              // is what Chrome blocks; blob: downloads are allowed.
              const filename =
                build.builtBy === 'upload'
                  ? (build.fileUrl?.split('/').pop() ??
                    `${s.slug}-${build.appVersion}-setup.exe`)
                  : `${s.slug}-${build.appVersion}.zip`
              await api.download(
                `/scripts/${s.id}/builds/${build.id}/download`,
                filename,
              )
              return t('packaging.downloading')
            })
          }
        />
      )}
    </>
  )
}

/* ---------- Capabilities + Group chips ---------- */

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
        </div>
        <div className="card-body">
          <div className="kv">
            <span className="klab">{t('detail.caps.node')}</span>
            <b className="tnum">{s.nodeCount}</b>
            <GroupChips groups={s.nodeGroupsUsed} />
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.compat')}</span>{' '}
            {/* No minimum means the sentence has no version to end on, so it changes
                shape rather than trailing a dash the seller has to interpret. */}
            {s.minAppVersion ? (
              <>
                {t('detail.caps.compatValue')} <b>{s.minAppVersion}</b>
              </>
            ) : (
              <b>{t('detail.caps.anyVersion')}</b>
            )}
          </div>
          <div className="kv">
            <span className="klab">{t('detail.caps.deps')}</span>{' '}
            {latest?.subWorkflowIds.length ? (
              <b>{t('detail.caps.depsCount', { count: latest.subWorkflowIds.length })}</b>
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
  const thumbRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(s.name)
  const [short, setShort] = useState(s.shortDescription ?? '')
  const [description, setDescription] = useState(s.description ?? '')
  const [videoUrl, setVideoUrl] = useState(s.videoUrl ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(s.thumbnailUrl ?? null)
  const [images, setImages] = useState<string[]>(s.images ?? [])
  const [tagIds, setTagIds] = useState<string[]>(s.tags.map((tg) => tg.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const dirty =
    name !== s.name ||
    short !== (s.shortDescription ?? '') ||
    description !== (s.description ?? '') ||
    videoUrl !== (s.videoUrl ?? '') ||
    thumbnailUrl !== (s.thumbnailUrl ?? null) ||
    JSON.stringify(images) !== JSON.stringify(s.images ?? []) ||
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
        videoUrl: videoUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        images,
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

  const pickThumb = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_THUMBNAIL_SIZE) {
      toast(t('newUpload.thumbnailTooBig', { max: '1 MB' }))
      e.target.value = ''
      return
    }
    const url = await uploadMedia(file, 'thumbnail')
    if (url) setThumbnailUrl(url)
    else toast(t('newUpload.uploadFailed'))
    e.target.value = ''
  }, [toast, t])

  const pickGallery = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_IMAGE_SIZE) {
        toast(t('newUpload.imageTooBig', { name: file.name, max: '3 MB' }))
        continue
      }
      const url = await uploadMedia(file, 'image')
      if (url) newUrls.push(url)
    }
    if (newUrls.length) setImages((prev) => [...prev, ...newUrls])
    e.target.value = ''
  }, [toast, t])

  return (
    <>
      {/* Basic info */}
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
              <input className="input" value={short} onChange={(e) => setShort(e.target.value)} maxLength={300} placeholder={t('detail.edit.shortPlaceholder')} />
            </label>
          </div>

          {/* Video URL */}
          <div className="field">
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 5 }}>
              {t('newUpload.videoTitle')}
            </span>
            <VideoInput value={videoUrl} onChange={setVideoUrl} />
          </div>

          {/* Thumbnail */}
          <div className="field">
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 5 }}>
              {t('newUpload.thumbnailTitle')}
            </span>
            {thumbnailUrl ? (
              <div className="img-preview" style={{ maxWidth: 240 }}>
                <img src={thumbnailUrl} alt="Thumbnail" />
                <button type="button" className="img-preview-rm" onClick={() => setThumbnailUrl(null)}>✕</button>
              </div>
            ) : (
              <div className="img-upload-zone" onClick={() => thumbRef.current?.click()}>
                {t('newUpload.pickThumbnail', { max: '1 MB' })}
              </div>
            )}
            <input ref={thumbRef} type="file" accept="image/*" onChange={pickThumb} style={{ display: 'none' }} />
          </div>

          {/* Gallery */}
          <div className="field">
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 5 }}>
              {t('newUpload.galleryTitle')}
            </span>
            {images.length > 0 && (
              <div className="gallery-grid" style={{ marginBottom: 8 }}>
                {images.map((u, i) => (
                  <div key={u} className="img-preview">
                    <img src={u} alt={`Image ${i + 1}`} />
                    <button type="button" className="img-preview-rm" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="img-upload-zone" onClick={() => galleryRef.current?.click()}>
              {t('newUpload.pickImages', { max: '3 MB' })}
            </div>
            <input ref={galleryRef} type="file" accept="image/*" multiple onChange={pickGallery} style={{ display: 'none' }} />
          </div>

          {/* Rich text description */}
          <div className="field">
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 5 }}>
              {t('detail.edit.description')}
            </span>
            <p className="note" style={{ marginBottom: 8 }}>{t('newUpload.descriptionHint')}</p>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder={t('detail.edit.descriptionPlaceholder')}
            />
          </div>

          <TagPicker value={tagIds} onChange={setTagIds} />
          <div className="formrow">
            <button className="btn pri sm" type="submit" disabled={busy || !dirty}>
              {busy ? t('detail.edit.saving') : t('detail.edit.save')}
            </button>
            <span className="note">{t('detail.edit.slugNote', { slug: s.slug })}</span>
          </div>
        </form>
      </div>
    </>
  )
}

function Moderation({ s, latest, onSubmit }: { s: ScriptDetail; latest: ScriptVersion | undefined; onSubmit: () => void }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const creds = latest?.scan.embedded_credentials_count ?? 0

  if (s.status === 'PUBLISHED') {
    return (
      <div className="banner ok">
        <span className="bi">✓</span>
        <div>
          <b>{t('detail.moderation.published')}</b>
          {s.capabilities.uses_shell && t('detail.moderation.publishedShell')}
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
          {t('detail.moderation.pendingBody')}
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
        <div className="credguard" style={{ margin: '0 16px 14px' }}>
          <div className="credguard-h">
            <span className="cg-ic">🔒</span>
            <div className="cg-txt">
              <span className="cg-ttl">{t('detail.moderation.credTitle', { count: creds })}</span>
              <span className="cg-sub">{t('detail.moderation.credHint')}</span>
            </div>
          </div>
          {(latest?.scan.credential_paths.length ?? 0) > 0 && (
            <details className="techdetails">
              <summary>{t('detail.moderation.credDetails')}</summary>
              {latest?.scan.credential_paths.map((p) => (
                <div key={p} className="credrow">
                  <span className="cr-ic">🔑</span>
                  <code>{p}</code>
                  <button
                    className="btn sm"
                    type="button"
                    title={t('detail.moderation.credCopy')}
                    onClick={() =>
                      void copyText(p).then((ok) =>
                        toast(ok ? t('detail.moderation.credCopied') : t('keys.copyFailed')),
                      )
                    }
                  >
                    {t('detail.moderation.credCopy')}
                  </button>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Versions tab ---------- */

function DetailVersions({
  s,
  onUploaded,
  onRollback,
  onDelete,
}: {
  s: ScriptDetail
  onUploaded: () => void
  /** Point the listing back at an older approved version. */
  onRollback: (version: ScriptVersion) => void
  onDelete: (version: ScriptVersion) => void
}) {
  const { toast } = useToast()
  const { t, tryT, lang } = useI18n()
  const errorText = useErrorText()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [version, setVersion] = useState(nextVersion(s.latestVersion))
  const [changelog, setChangelog] = useState('')
  const [minApp, setMinApp] = useState(s.minAppVersion ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const pickVersionFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.haup')) {
      toast(t('upload.wrongType'))
      return
    }
    setFile(f)
    setError(null)
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragging(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickVersionFile(f)
  }

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
    if (minApp) form.append('minAppVersion', minApp)
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
          <label
            className={`dropzone${dragging ? ' is-drag' : ''}`}
            style={{ display: 'block', cursor: 'pointer', marginBottom: 12 }}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept=".haup,application/octet-stream"
              className="hide"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pickVersionFile(f)
                e.target.value = ''
              }}
            />
            {file ? (<>✓ <b>{file.name}</b></>) : t('versions.pick')}
          </label>
          {error != null && <div className="state bad">{errorText(error, 'upload.failed')}</div>}
          <div className="grid2">
            <label className="field">
              <span>{t('upload.version')}</span>
              <input className="input mono" value={version} onChange={(e) => setVersion(e.target.value)} pattern="\d+\.\d+\.\d+" maxLength={20} required />
            </label>
            <label className="field">
              <span>{t('versions.changelog')}</span>
              <input className="input" value={changelog} onChange={(e) => setChangelog(e.target.value)} maxLength={2000} />
            </label>
          </div>
          <div className="grid2">
            <label className="field">
              <span>{t('upload.minApp')}</span>
              <input
                className="input mono"
                value={minApp}
                onChange={(e) => setMinApp(e.target.value)}
                placeholder={t('upload.minAppPlaceholder')}
                pattern="\d+\.\d+\.\d+"
                maxLength={20}
              />
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
                <th />
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
                      <td className="rowbtns">
                        {v.status === 'APPROVED' && v.id !== s.latestVersionId && (
                          <button className="btn sm" onClick={() => onRollback(v)}>
                            {t('versions.rollback')}
                          </button>
                        )}
                        {v.status !== 'APPROVED' && v.id !== s.latestVersionId && (
                          <button className="btn bad sm" onClick={() => onDelete(v)}>
                            {t('versions.delete')}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open.has(v.id) && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--surface-2)', padding: '6px 16px 12px' }}>
                          <div className="kv">
                            <span className="klab">{t('versions.moderation')}</span>
                            {!v.graphExtracted ? (
                              <span>{t('versions.noGraph')}</span>
                            ) : v.scan.embedded_credentials_count === 0 ? (
                              <span>{t('versions.cleanScan')}</span>
                            ) : (
                              <span>{t('versions.dirtyScan', { count: v.scan.embedded_credentials_count })}</span>
                            )}
                          </div>
                          <div className="kv">
                            <span className="klab">{t('versions.source')}</span>
                            <span className="mono">{v.sourceFilename ?? '—'}</span> →{' '}
                            {tryT(`delivery.${v.delivery}`, v.delivery)}
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
                <tr><td colSpan={6} className="u-sub" style={{ padding: '18px 16px' }}>{t('versions.empty')}</td></tr>
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

function DetailKeys({
  scriptName,
  keys,
  total,
  skip,
  onSkip,
  loading,
  error,
  onCopy,
  onCreate,
  onRevoke,
}: {
  scriptName: string
  keys: KeyItem[]
  total: number
  skip: number
  onSkip: (skip: number) => void
  loading: boolean
  error: string | null
  onCopy: (value: string, message: string) => void
  onCreate: (payload: KeyCreate) => void
  onRevoke: (keyId: string) => void
}) {
  const { t } = useI18n()
  const [label, setLabel] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const count = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 200)

  const create = (e: FormEvent) => {
    e.preventDefault()
    onCreate({
      label: label.trim() || undefined,
      maxUses: maxUses ? Number(maxUses) : undefined,
      // `datetime-local` carries no timezone; Date then toISOString hands the API UTC.
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      quantity: count,
    })
    setLabel('')
    setQuantity('1')
    setMaxUses('')
    setExpiresAt('')
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('detailKeys.title')}</h3>
        <div className="sp" />
        {keys.length > 0 && (
          <button
            className="btn sm"
            onClick={() =>
              onCopy(
                keys.map((k) => k.key).join('\n'),
                t('keys.copiedAll', { count: keys.length }),
              )
            }
          >
            {t('keys.copyAll')}
          </button>
        )}
      </div>
      <form onSubmit={create} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="grid2">
          <label className="field">
            <span>{t('keys.col.label')}</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('detailKeys.labelPlaceholder')} maxLength={100} />
          </label>
          <label className="field">
            <span>{t('keys.form.quantity')}</span>
            <input className="input tnum" type="number" min={1} max={200} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
        </div>
        <div className="grid2">
          <label className="field">
            <span>{t('detailKeys.maxUses')}</span>
            <input className="input tnum" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder={t('detailKeys.maxUsesPlaceholder')} />
          </label>
          <label className="field">
            <span>{t('detailKeys.expires')}</span>
            <input className="input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        </div>
        <button className="btn pri sm" type="submit">{t('keys.form.submit', { count })}</button>
      </form>
      {error && <div className="state bad">{error}</div>}
      {loading && !keys.length ? (
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
                const ks = keyState[k.state]
                return (
                  <tr key={k.id}>
                    <td>
                      <button
                        className="keychip"
                        title={t('keys.copy')}
                        style={{ cursor: 'pointer', border: 0 }}
                        onClick={() => onCopy(k.key, t('keys.copied'))}
                      >
                        {k.key}
                      </button>
                    </td>
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
      <Pager skip={skip} limit={KEY_PAGE_SIZE} total={total} onChange={onSkip} />
      <div className="card-foot"><span className="note">{t('detailKeys.foot', { name: scriptName })}</span></div>
    </div>
  )
}

/* ---------- Packaging tab ---------- */

function DetailPackaging({
  builds,
  total,
  skip,
  onSkip,
  versions,
  liveVersionId,
  loading,
  error,
  onBuild,
  onDownload,
}: {
  builds: MiniAppBuild[]
  total: number
  skip: number
  onSkip: (skip: number) => void
  /** Approved versions — the only ones that may be packaged. */
  versions: ScriptVersion[]
  liveVersionId: string | null
  loading: boolean
  error: string | null
  onBuild: (versionId: string) => void
  /** The packaged artifact of one build (upload = .exe via media URL; else .zip stream). */
  onDownload: (build: MiniAppBuild) => void
}) {
  const { t } = useI18n()
  const [versionId, setVersionId] = useState(liveVersionId ?? versions[0]?.id ?? '')

  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('packaging.title')}</h3>
        <div className="sp" />
        {versions.length > 0 && (
          <select
            className="input"
            style={{ width: 'auto', marginLeft: 8 }}
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version}
                {v.id === liveVersionId ? ` · ${t('versions.live')}` : ''}
              </option>
            ))}
          </select>
        )}
        <button
          className="btn pri sm"
          style={{ marginLeft: 8 }}
          disabled={!versions.length}
          onClick={() => onBuild(versionId)}
        >
          {t('packaging.build')}
        </button>
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
                      <Pill tone="neutral">
                        {t(
                          b.builtBy === 'upload'
                            ? 'packaging.builtBy.upload'
                            : b.builtBy === 'server'
                              ? 'packaging.builtBy.server'
                              : 'packaging.builtBy.agent',
                        )}
                      </Pill>
                    </td>
                    <td className="tnum u-sub opt">{fmtBytes(b.sizeBytes)}</td>
                    <td>
                      <Pill tone={bs.tone}>{t(bs.key)}</Pill>
                      {b.status === 'FAILED' && b.error && (
                        <div className="u-sub">{b.error}</div>
                      )}
                    </td>
                    <td className="rowbtns">
                      <button className="btn sm" disabled={b.status !== 'READY'} onClick={() => onDownload(b)}>{t('packaging.download')}</button>
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
      <Pager skip={skip} limit={KEY_PAGE_SIZE} total={total} onChange={onSkip} />
      <div className="card-foot"><span className="note">{t('packaging.foot')}</span></div>
    </div>
  )
}
