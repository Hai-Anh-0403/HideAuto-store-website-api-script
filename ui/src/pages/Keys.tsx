import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { Pager } from '../ui/Pager'
import { Pill } from '../ui/Pill'
import { Empty, ErrorState, PendingApproval, TableSkeleton } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { useErrorText } from '../lib/errors'
import { fmtWhen, keyStatus } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../store/auth'
import type { KeyItem, Page } from '../types'

const PAGE_SIZE = 20

export function Keys() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const errorText = useErrorText()
  const approved = seller?.status === 'approved'
  const nav = useNavigate()
  const { toast } = useToast()
  const [skip, setSkip] = useState(0)

  const keys = useFetch(
    () =>
      approved
        ? api.get<Page<KeyItem>>(`/sellers/me/keys?skip=${skip}&limit=${PAGE_SIZE}`)
        : Promise.resolve(null),
    `keys:${approved}:${skip}`,
  )
  const rows = keys.data?.items ?? []

  const revoke = async (keyId: string) => {
    try {
      await api.post(`/sellers/me/keys/${keyId}/revoke`)
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

      {!approved && <PendingApproval />}
      {keys.error && <ErrorState message={keys.error} />}

      <Card>
        <CardHead
          title={t('keys.count', { count: keys.data?.total ?? 0 })}
          actions={
            <button className="btn pri sm" onClick={() => nav('/mini-apps')}>
              {t('keys.goToApps')}
            </button>
          }
        />
        {keys.loading ? (
          <TableSkeleton />
        ) : !rows.length ? (
          <Empty
            icon="🔑"
            title={t('detailKeys.emptyTitle')}
            body={t('keys.empty')}
            action={
              <button className="btn pri sm" onClick={() => nav('/mini-apps')}>
                {t('keys.goToApps')}
              </button>
            }
          />
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
                        {k.script_name ? (
                          <Pill tone="accent">{k.script_name}</Pill>
                        ) : (
                          <Pill tone="neutral">{t('keys.allApps')}</Pill>
                        )}
                      </td>
                      <td>
                        {k.label ?? '—'}
                        {k.expires_at && (
                          <div className="u-sub">
                            {t('detailKeys.expires')}: {new Date(k.expires_at).toLocaleDateString(lang)}
                          </div>
                        )}
                      </td>
                      <td>
                        <Pill tone={ks.tone}>{t(ks.key)}</Pill>
                      </td>
                      <td className="tnum">
                        {k.used_count} / {k.max_uses ?? '∞'}
                      </td>
                      <td className="u-sub tnum opt">{fmtWhen(k.created_at, lang, t('time.now'))}</td>
                      <td className="rowbtns">
                        <button className="btn bad sm" disabled={k.status !== 'active'} onClick={() => revoke(k.id)}>
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
      </Card>
    </>
  )
}
