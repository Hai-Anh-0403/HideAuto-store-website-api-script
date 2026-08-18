'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useErrorText } from '@/lib/errors'
import { fmtWhen, keyStatus } from '@/lib/pills'
import { useFetch } from '@/lib/useFetch'
import type { KeyItem, Page } from '@/types'

const PAGE_SIZE = 20

export default function KeysPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const errorText = useErrorText()
  const approved = seller?.status === 'APPROVED'
  const router = useRouter()
  const { toast } = useToast()
  const [skip, setSkip] = useState(0)

  const keys = useFetch(
    () =>
      approved
        ? api.get<Page<KeyItem>>(`/keys?skip=${skip}&limit=${PAGE_SIZE}`)
        : Promise.resolve(null),
    `keys:${approved}:${skip}`,
  )
  const rows = keys.data?.items ?? []

  const revoke = async (keyId: string) => {
    try {
      await api.patch(`/keys/${keyId}/revoke`)
      keys.reload()
      toast(t('keys.revoked'))
    } catch (err) {
      toast(errorText(err, 'keys.revokeFailed'))
    }
  }

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('keys.title')}</h2>
          <p>{t('keys.subtitle')}</p>
        </div>
      </div>

      {!approved && (
        <div className="banner warn">
          <span className="bi">!</span>
          <div>
            <b>{t('common.pendingApproval.title')}</b>
            {t('common.pendingApproval.body')}
          </div>
        </div>
      )}
      {keys.error && <div className="state bad">{keys.error}</div>}

      <div className="card">
        <div className="card-h">
          <h3>{t('keys.count', { count: keys.data?.total ?? 0 })}</h3>
          <div className="sp" />
          <button className="btn pri sm" onClick={() => router.push('/portal/mini-apps')}>
            {t('keys.goToApps')}
          </button>
        </div>
        {keys.loading ? (
          <>
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
          </>
        ) : !rows.length ? (
          <div className="empty">
            <div className="icon">🔑</div>
            <b>{t('detailKeys.emptyTitle')}</b>
            <p>{t('keys.empty')}</p>
            <button className="btn pri sm" onClick={() => router.push('/portal/mini-apps')}>
              {t('keys.goToApps')}
            </button>
          </div>
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>{t('keys.col.key')}</th>
                  <th>{t('keys.col.app')}</th>
                  <th>{t('keys.col.label')}</th>
                  <th>{t('keys.col.status')}</th>
                  <th>{t('keys.col.used')}</th>
                  <th className="opt">{t('keys.col.created')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => {
                  const ks = keyStatus[k.status]
                  return (
                    <tr key={k.id}>
                      <td>
                        <span className="keychip">{k.key}</span>
                      </td>
                      <td>
                        <Pill tone="accent">{k.script.name}</Pill>
                      </td>
                      <td>
                        {k.label ?? '—'}
                        {k.expiresAt && (
                          <div className="u-sub">
                            {t('detailKeys.expires')}:{' '}
                            {new Date(k.expiresAt).toLocaleDateString(lang)}
                          </div>
                        )}
                      </td>
                      <td>
                        <Pill tone={ks.tone}>{t(ks.key)}</Pill>
                      </td>
                      <td className="tnum">
                        {k.usedCount} / {k.maxUses ?? '∞'}
                      </td>
                      <td className="u-sub tnum opt">
                        {fmtWhen(k.createdAt, lang, t('time.now'))}
                      </td>
                      <td className="rowbtns">
                        <button
                          className="btn bad sm"
                          disabled={k.status !== 'ACTIVE'}
                          onClick={() => revoke(k.id)}
                        >
                          {t('keys.revoke')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {keys.data && (
          <Pager skip={skip} limit={PAGE_SIZE} total={keys.data.total} onChange={setSkip} />
        )}
        <div className="card-foot">
          <span className="note">{t('keys.foot')}</span>
        </div>
      </div>
    </>
  )
}
