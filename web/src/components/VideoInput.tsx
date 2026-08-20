'use client'

import { useI18n } from '@/i18n'

const YOUTUBE_RE = /^https?:\/\/(www\.)?youtube\.com\/watch\?/
const YOUTU_BE_RE = /^https?:\/\/youtu\.be\//
const YOUTUBE_EMBED_RE = /^https?:\/\/(www\.)?youtube\.com\/embed\//
const VIMEO_RE = /^https?:\/\/(www\.)?vimeo\.com\/(\d+)/

function extractEmbed(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (YOUTUBE_RE.test(url)) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`
    }
    if (YOUTU_BE_RE.test(url)) {
      const id = u.pathname.slice(1)
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`
    }
    if (YOUTUBE_EMBED_RE.test(url)) return url
    const vimeoMatch = url.match(VIMEO_RE)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[2]}`
  } catch {
    // not a valid URL
  }
  return null
}

interface VideoInputProps {
  value: string
  onChange: (v: string) => void
}

export function VideoInput({ value, onChange }: VideoInputProps) {
  const { t } = useI18n()
  const embedUrl = extractEmbed(value)

  return (
    <div>
      <div className="video-field">
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('newUpload.videoPlaceholder')}
          maxLength={500}
        />
      </div>
      {embedUrl && (
        <div
          style={{
            marginTop: 10,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          <iframe
            src={embedUrl}
            style={{ width: '100%', aspectRatio: '16/9', border: 0, display: 'block' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  )
}
