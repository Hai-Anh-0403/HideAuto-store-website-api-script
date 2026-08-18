'use client'

import { useState, type KeyboardEvent } from 'react'
import { useI18n } from '@/i18n'

export function Pager({
  skip,
  limit,
  total,
  onChange,
}: {
  skip: number
  limit: number
  total: number
  onChange: (skip: number) => void
}) {
  const { t } = useI18n()
  if (total <= limit) return null

  const from = skip + 1
  const to = Math.min(skip + limit, total)
  const currentPage = Math.floor(skip / limit) + 1
  const totalPages = Math.ceil(total / limit)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [draft, setDraft] = useState(String(currentPage))

  const jump = () => {
    const n = parseInt(draft, 10)
    if (Number.isNaN(n) || n < 1 || n > totalPages) {
      setDraft(String(currentPage))
      return
    }
    onChange((n - 1) * limit)
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') jump()
  }

  if (
    String(currentPage) !== draft &&
    typeof document !== 'undefined' &&
    document.activeElement?.tagName !== 'INPUT'
  ) {
    setDraft(String(currentPage))
  }

  return (
    <div className="pager">
      <span className="note">{t('pager.range', { from, to, total })}</span>
      <div className="pager-btns">
        <button
          className="btn sm"
          disabled={skip <= 0}
          onClick={() => onChange(Math.max(0, skip - limit))}
        >
          {t('pager.prev')}
        </button>
        <input
          className="pager-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={jump}
          onKeyDown={handleKey}
          inputMode="numeric"
          aria-label={t('pager.pageLabel')}
        />
        <span className="note">/ {totalPages}</span>
        <button
          className="btn sm"
          disabled={skip + limit >= total}
          onClick={() => onChange(skip + limit)}
        >
          {t('pager.next')}
        </button>
      </div>
    </div>
  )
}
