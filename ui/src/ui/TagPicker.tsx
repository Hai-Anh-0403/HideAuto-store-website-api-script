import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import type { Tag } from '../types'

let _cache: Tag[] | null = null

function useTags(): Tag[] {
  const [tags, setTags] = useState<Tag[]>(_cache ?? [])
  useEffect(() => {
    if (_cache) return
    api.get<Tag[]>('/tags').then((list) => {
      _cache = list
      setTags(list)
    }).catch(() => {})
  }, [])
  return tags
}

export function TagPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const { t } = useI18n()
  const tags = useTags()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const selected = tags.filter((t) => value.includes(t.id))
  const available = tags.filter((t) => !value.includes(t.id))

  const add = (id: string) => onChange([...value, id])
  const remove = (id: string) => onChange(value.filter((v) => v !== id))

  return (
    <div className="field">
      <span>{t('tags.label')}</span>
      <div className="tagpicker" ref={ref}>
        <div className="tagpicker-chips" onClick={() => setOpen(true)}>
          {selected.map((tag) => (
            <span key={tag.id} className="tagchip">
              {tag.name}
              <button
                type="button"
                className="tagchip-x"
                onClick={(e) => { e.stopPropagation(); remove(tag.id) }}
              >
                ×
              </button>
            </span>
          ))}
          {!selected.length && (
            <span className="tagpicker-placeholder">{t('tags.placeholder')}</span>
          )}
        </div>
        {open && available.length > 0 && (
          <div className="tagpicker-dropdown">
            {available.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="tagpicker-option"
                onClick={() => add(tag.id)}
              >
                {tag.name}
                {tag.description && (
                  <span className="tagpicker-desc">{tag.description}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
