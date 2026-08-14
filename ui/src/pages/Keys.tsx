import { useNavigate } from 'react-router-dom'
import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { ErrorState, Loading, PendingApproval } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { useErrorText } from '../lib/errors'
import { fmtWhen, keyStatus } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../store/auth'
import type { KeyItem } from '../types'

export function Keys() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const errorText = useErrorText()
  const approved = seller?.status === 'approved'
  const nav = useNavigate()
  const { toast } = useToast()

  const keys = useFetch(
    () => (approved ? api.get<KeyItem[]>('/sellers/me/keys') : Promise.resolve(null)),
    `keys:${approved}`,
  )
  const rows = keys.data ?? []

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
        <span className="ep">
          <b>GET</b> /sellers/me/keys
        </span>
      </div>

      {!approved && <PendingApproval />}
      {keys.error && <ErrorState message={keys.error} />}

      <Card>
        <CardHead
          title={t('keys.count', { count: rows.length })}
          actions={
            <button className="btn pri sm" onClick={() => nav('/mini-apps')}>
              {t('keys.goToApps')}
            </button>
          }
        />
        {keys.loading ? (
          <Loading what={t('nav.keys').toLowerCase()} />
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
                  <th>{t('keys.col.created')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((k) => {
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
                        <td>{k.label ?? '—'}</td>
                        <td>
                          <Pill tone={ks.tone}>{t(ks.key)}</Pill>
                        </td>
                        <td className="tnum">
                          {k.used_count} / {k.max_uses ?? '∞'}
                        </td>
                        <td className="u-sub tnum">{fmtWhen(k.created_at, lang, t('time.now'))}</td>
                        <td className="rowbtns">
                          <button className="btn bad sm" disabled={k.status !== 'active'} onClick={() => revoke(k.id)}>
                            {t('keys.revoke')}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="u-sub" style={{ padding: '18px 16px' }}>
                      {t('keys.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          <span className="note">
            {t('keys.foot')} <span className="mono">POST /sellers/me/scripts/{'{id}'}/keys</span>
          </span>
        </div>
      </Card>
    </>
  )
}
