'use client'

import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'

/**
 * Why the portal is read-only for this account.
 *
 * Every seller page showed the same "waiting for approval" banner, which meant a *rejected*
 * or *suspended* seller was told to keep waiting for something that already happened. This
 * says which of the three it is and, when the admin left one, the reason.
 *
 * Renders nothing for an approved seller, so pages can drop it in unconditionally.
 */
export function PendingBanner() {
  const { seller } = useAuth()
  const { t, tryT } = useI18n()

  if (!seller || seller.status === 'APPROVED') return null

  const blocked = seller.status === 'REJECTED' || seller.status === 'SUSPENDED'

  return (
    <div className={blocked ? 'banner bad' : 'banner warn'}>
      <span className="bi">!</span>
      <div>
        <b>
          {blocked
            ? tryT(`errors.seller_${seller.status.toLowerCase()}`, seller.status)
            : t('common.pendingApproval.title')}
        </b>
        {t('common.pendingApproval.body')}
        {seller.statusReason && (
          <div className="u-sub">
            {t('common.statusReason', { reason: seller.statusReason })}
          </div>
        )}
      </div>
    </div>
  )
}
