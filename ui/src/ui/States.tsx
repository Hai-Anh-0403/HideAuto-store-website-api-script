import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

/** Trạng thái loading / rỗng / lỗi / chờ duyệt dùng chung để mọi trang nhìn giống nhau. */

export function Loading({ what }: { what?: string }) {
  const { t } = useI18n()
  return <div className="state">{t('common.loading', { what: what ?? t('common.data') })}</div>
}

/** Skeleton cho bảng — giữ chỗ đúng chiều cao nên không nhảy layout khi tải xong. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: '10px 0' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel" style={{ width: `${92 - i * 7}%` }} />
      ))}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="banner bad">
      <span className="bi">⛔</span>
      <div>{message}</div>
    </div>
  )
}

/** Lời mời, không phải lời xin lỗi: tiêu đề + 1 dòng + hành động. */
export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <b>{title}</b>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function PendingApproval() {
  const { t } = useI18n()
  return (
    <div className="banner warn">
      <span className="bi">⏳</span>
      <div>
        <b>{t('common.pendingApproval.title')}</b>
        {t('common.pendingApproval.body')}
      </div>
    </div>
  )
}
