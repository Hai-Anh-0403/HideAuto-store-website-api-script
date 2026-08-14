import { useI18n } from '../i18n'

/** Trạng thái loading / lỗi / chờ duyệt dùng chung để mọi trang nhìn giống nhau. */

export function Loading({ what }: { what?: string }) {
  const { t } = useI18n()
  return <div className="state">{t('common.loading', { what: what ?? t('common.data') })}</div>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="banner bad">
      <span className="bi">⛔</span>
      <div>{message}</div>
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
