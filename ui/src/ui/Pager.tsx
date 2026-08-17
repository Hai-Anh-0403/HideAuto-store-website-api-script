import { useI18n } from '../i18n'

/** Thanh phân trang skip/limit — ẩn hẳn khi mọi thứ đã gọn trong một trang. */
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
