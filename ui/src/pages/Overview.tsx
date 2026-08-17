import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { ErrorState, Loading, PendingApproval } from '../ui/States'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { fmtWhen, isOnline } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../store/auth'
import type { Member, Page } from '../types'

interface SellerStats {
  scripts_total: number
  members_total: number
  members_online: number
  keys_active: number
}

export function Overview() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const approved = seller?.status === 'approved'
  const key = `overview:${approved}`

  const stats = useFetch(
    () => (approved ? api.get<SellerStats>('/sellers/me/stats') : Promise.resolve(null)),
    key,
  )
  const members = useFetch(
    () => (approved ? api.get<Page<Member>>('/sellers/me/members?limit=8') : Promise.resolve(null)),
    key,
  )

  const memberItems = members.data?.items ?? []
  const error = stats.error ?? members.error

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('overview.title')}</h2>
          <p>{t('overview.subtitle', { name: seller?.name ?? '' })}</p>
        </div>
      </div>

      {!approved && <PendingApproval />}
      {error && <ErrorState message={error} />}

      <div className="tiles">
        <div className="tile">
          <div className="k">{t('overview.tile.members')}</div>
          <div className="v tnum">{stats.data?.members_total ?? 0}</div>
          <div className="s">{t('overview.tile.membersSub')}</div>
        </div>
        <div className="tile">
          <div className="k">
            <span className="dot on" /> {t('overview.tile.online')}
          </div>
          <div className="v tnum" style={{ color: 'var(--success)' }}>
            {stats.data?.members_online ?? 0}
          </div>
          <div className="s">{t('overview.tile.onlineSub')}</div>
        </div>
        <div className="tile">
          <div className="k">{t('overview.tile.keys')}</div>
          <div className="v tnum">{stats.data?.keys_active ?? 0}</div>
          <div className="s">{t('overview.tile.keysSub')}</div>
        </div>
        <div className="tile">
          <div className="k">{t('overview.tile.apps')}</div>
          <div className="v tnum">{stats.data?.scripts_total ?? 0}</div>
          <div className="s">{t('overview.tile.appsSub')}</div>
        </div>
      </div>

      <Card>
        <CardHead title={t('overview.recent')} />
        {members.loading ? (
          <Loading what={t('nav.members').toLowerCase()} />
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>{t('members.col.user')}</th>
                  <th>{t('members.col.status')}</th>
                  <th>{t('members.col.online')}</th>
                </tr>
              </thead>
              <tbody>
                {memberItems.length ? (
                  memberItems.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="u-main">{m.user_name ?? m.user_email ?? t('common.dash')}</div>
                        <div className="u-sub">{m.user_email}</div>
                      </td>
                      <td>
                        {m.status === 'blocked' ? (
                          <Pill tone="bad">{t('status.member.blocked')}</Pill>
                        ) : (
                          <Pill tone="ok">{t('status.member.active')}</Pill>
                        )}
                      </td>
                      <td>
                        {isOnline(m.last_seen_at) ? (
                          <Pill tone="ok">
                            <span className="dot on live" /> {t('members.online')}
                          </Pill>
                        ) : (
                          <Pill tone="neutral">
                            <span className="dot off" /> {fmtWhen(m.last_seen_at, lang, t('time.now'))}
                          </Pill>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="u-sub" style={{ padding: '18px 16px' }}>
                      {t('overview.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
