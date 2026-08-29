'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { TagPicker } from '@/components/TagPicker'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/errors'
import { useTitle } from '@/lib/useTitle'
import { RichTextEditor } from '@/components/RichTextEditor'
import { VideoInput } from '@/components/VideoInput'

type UploadResponse = {
  ok?: boolean
  appId?: string
  name?: string
  version?: string
  mode?: string
  downloadUrl?: string
  iconUrl?: string | null
  fileSize?: number
  checksumSha256?: string
  scriptId?: string
}

const MAX_THUMBNAIL_SIZE = 1 * 1024 * 1024
const MAX_IMAGE_SIZE = 3 * 1024 * 1024

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function uploadMedia(
  file: File,
  type: 'thumbnail' | 'image' | 'description',
): Promise<string | null> {
  const limit = type === 'thumbnail' ? MAX_THUMBNAIL_SIZE : MAX_IMAGE_SIZE
  if (file.size > limit) return null
  if (!file.type.startsWith('image/')) return null

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

function isHaupFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.haup')
}

/* ────────────────── Thumbnail uploader ────────────────── */

function ThumbnailUploader({
  url,
  onChange,
}: {
  url: string | null
  onChange: (url: string | null) => void
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const pick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (file.size > MAX_THUMBNAIL_SIZE) {
        toast(t('newUpload.thumbnailTooBig', { max: '1 MB' }))
        e.target.value = ''
        return
      }

      setUploading(true)
      const result = await uploadMedia(file, 'thumbnail')
      setUploading(false)
      if (result) {
        onChange(result)
      } else {
        toast(t('newUpload.uploadFailed'))
      }
      e.target.value = ''
    },
    [onChange, toast, t],
  )

  if (url) {
    return (
      <div className="img-preview" style={{ maxWidth: 240 }}>
        <img src={url} alt="Thumbnail" />
        <button type="button" className="img-preview-rm" onClick={() => onChange(null)}>✕</button>
      </div>
    )
  }

  return (
    <>
      <div className="img-upload-zone" onClick={() => fileRef.current?.click()}>
        {uploading ? t('common.loadingShort') : t('newUpload.pickThumbnail', { max: '1 MB' })}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
    </>
  )
}

/* ────────────────── Gallery uploader ────────────────── */

function GalleryUploader({
  urls,
  onChange,
}: {
  urls: string[]
  onChange: (urls: string[]) => void
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const pick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return

      setUploading(true)
      const newUrls: string[] = []
      for (const file of Array.from(files)) {
        if (file.size > MAX_IMAGE_SIZE) {
          toast(t('newUpload.imageTooBig', { name: file.name, max: '3 MB' }))
          continue
        }
        const result = await uploadMedia(file, 'image')
        if (result) newUrls.push(result)
      }
      setUploading(false)
      if (newUrls.length) onChange([...urls, ...newUrls])
      e.target.value = ''
    },
    [urls, onChange, toast, t],
  )

  const remove = useCallback(
    (idx: number) => {
      onChange(urls.filter((_, i) => i !== idx))
    },
    [urls, onChange],
  )

  return (
    <>
      <div className="gallery-grid">
        {urls.map((u, i) => (
          <div key={u} className="img-preview">
            <img src={u} alt={`Image ${i + 1}`} />
            <button type="button" className="img-preview-rm" onClick={() => remove(i)}>✕</button>
          </div>
        ))}
      </div>
      <div
        className="img-upload-zone"
        style={{ marginTop: urls.length ? 10 : 0 }}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? t('common.loadingShort') : t('newUpload.pickImages', { max: '3 MB' })}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={pick}
        style={{ display: 'none' }}
      />
    </>
  )
}

/* ────────────────── Main upload page ────────────────── */

export default function NewMiniAppPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const errorText = useErrorText()
  useTitle(t('newUpload.pageTitle'))

  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  // Basic info
  const [name, setName] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [changelog, setChangelog] = useState('')
  const [minApp, setMinApp] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])

  // Media
  const [videoUrl, setVideoUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])

  // Description
  const [description, setDescription] = useState('')

  const [busy, setBusy] = useState(false)

  const pickFile = (f: File) => {
    if (!isHaupFile(f)) {
      toast(t('upload.wrongType'))
      return
    }
    setFile(f)
    setName((prev) => prev || stripExtension(f.name))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
    e.target.value = ''
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
    if (f) pickFile(f)
  }

  const publish = async () => {
    if (!file) {
      toast(t('upload.pick'))
      return
    }
    setBusy(true)
    setProgress(0)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('name', name || file.name)
      form.set('shortDescription', shortDesc)
      form.set('description', description)
      form.set('version', version)
      form.set('changelog', changelog)
      form.set('minAppVersion', minApp)
      form.set('tagIds', tagIds.join(','))
      form.set('videoUrl', videoUrl)
      if (thumbnailUrl) form.set('thumbnailUrl', thumbnailUrl)
      if (images.length) form.set('images', images.join(','))
      const res = await api.uploadWithProgress<UploadResponse>(
        '/apps/upload',
        form,
        setProgress,
      )
      const uploadedName = res.name || name || file.name
      setFile(null)
      toast(t('upload.done', { name: uploadedName }))
      router.push(
        res.scriptId
          ? `/portal/mini-apps/${res.scriptId}`
          : '/portal/mini-apps',
      )
    } catch (err) {
      toast(errorText(err, 'upload.failed'))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <>
      <div className="vhead">
        <div>
          <button className="btn sm" onClick={() => router.push('/portal/mini-apps')}>
            {t('detail.back')}
          </button>
          <h2 style={{ marginTop: 8 }}>{t('newUpload.pageTitle')}</h2>
          <p>{t('newUpload.pageSubtitle')}</p>
        </div>
      </div>

      {/* ── File picker ── */}
      <div className="card">
        <div className="card-h"><h3>{t('newUpload.fileSection')}</h3></div>
        <div className="card-body" style={{ padding: '16px' }}>
          <div
            className={`dropzone${dragging ? ' is-drag' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div>{file ? `✓ ${file.name} (${fmtSize(file.size)})` : t('upload.pick')}</div>
            <input
              ref={fileRef}
              type="file"
              accept=".haup,application/octet-stream"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
          {progress !== null && (
            <div className="progress" style={{ marginTop: 12 }}>
              <div
                className="fill"
                style={{
                  width: `${progress}%`,
                  background: 'var(--brand)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Basic info ── */}
      <div className="card">
        <div className="card-h"><h3>{t('newUpload.infoSection')}</h3></div>
        <div className="card-body" style={{ padding: '16px' }}>
          <div className="grid2">
            <label className="field">
              <span>{t('upload.name')}</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('upload.namePlaceholder')}
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>{t('upload.shortDescription')}</span>
              <input
                className="input"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                maxLength={300}
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
                maxLength={20}
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
                maxLength={20}
              />
            </label>
          </div>
          <label className="field">
            <span>{t('versions.changelog')}</span>
            <input
              className="input"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              maxLength={2000}
            />
          </label>
          <TagPicker value={tagIds} onChange={setTagIds} />
        </div>
      </div>

      {/* ── Media section ── */}
      <div className="card">
        <div className="card-h"><h3>{t('newUpload.mediaSection')}</h3></div>
        <div className="card-body" style={{ padding: '16px' }}>
          {/* Video */}
          <div className="upload-section">
            <h3>{t('newUpload.videoTitle')}</h3>
            <VideoInput value={videoUrl} onChange={setVideoUrl} />
          </div>

          {/* Thumbnail */}
          <div className="upload-section">
            <h3>{t('newUpload.thumbnailTitle')}</h3>
            <ThumbnailUploader url={thumbnailUrl} onChange={setThumbnailUrl} />
          </div>

          {/* Gallery images */}
          <div className="upload-section" style={{ marginBottom: 0 }}>
            <h3>{t('newUpload.galleryTitle')}</h3>
            <GalleryUploader urls={images} onChange={setImages} />
          </div>
        </div>
      </div>

      {/* ── Description section ── */}
      <div className="card">
        <div className="card-h"><h3>{t('newUpload.descriptionSection')}</h3></div>
        <div className="card-body" style={{ padding: '16px' }}>
          <p className="note" style={{ marginBottom: 10 }}>{t('newUpload.descriptionHint')}</p>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder={t('detail.edit.descriptionPlaceholder')}
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4, marginBottom: 40 }}>
        <button className="btn sm" onClick={() => router.push('/portal/mini-apps')}>
          {t('common.cancel')}
        </button>
        <button className="btn pri sm" onClick={publish} disabled={busy || !file}>
          {busy ? t('upload.publishing') : t('upload.publish')}
        </button>
      </div>
    </>
  )
}
