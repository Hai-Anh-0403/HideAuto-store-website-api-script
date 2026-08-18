'use client'

import { Pill } from '@/components/Pill'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtWhen, isOnline } from '@/lib/pills'
import { useFetch } from '@/lib/useFetch'
import type { Member, Page, SellerStats } from '@/types'

export default function OverviewPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const approved = seller?.status === 'APPROVED'
  const key = `overview:${approved}`

  const stats = useFetch(
    () => (approved ? api.get<SellerStats>('/sellers/me/stats') : Promise.resolve(null)),
    key,
  )
  const members = useFetch(
    () => (approved ? api.get<Page<Member>>('/members?limit=8') : Promise.resolve(null)),
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

      {!approved && (
        <div className="banner warn">
          <span className="bi">!</span>
          <div>
            <b>{t('common.pendingApproval.title')}</b>
            {t('common.pendingApproval.body')}
          </div>
        </div>
      )}
      {error && <div className="state bad">{error}</div>}

      <div className="tiles">
        <div className="tile">
          <div className="k">{t('overview.tile.members')}</div>
          <div className="v tnum">{stats.data?.memberCount ?? 0}</div>
          <div className="s">{t('overview.tile.membersSub')}</div>
        </div>
        <div className="tile">
          <div className="k">
            <span className="dot on" /> {t('overview.tile.online')}
          </div>
          <div className="v tnum" style={{ color: 'var(--success)' }}>
            {stats.data?.onlineCount ?? 0}
          </div>
          <div className="s">{t('overview.tile.onlineSub')}</div>
        </div>
        <div className="tile">
          <div className="k">{t('overview.tile.keys')}</div>
          <div className="v tnum">{stats.data?.activeKeyCount ?? 0}</div>
          <div className="s">{t('overview.tile.keysSub')}</div>
        </div>
        <div className="tile">
          <div className="k">{t('overview.tile.apps')}</div>
          <div className="v tnum">{stats.data?.scriptCount ?? 0}</div>
          <div className="s">{t('overview.tile.appsSub')}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>{t('overview.recent')}</h3>
        </div>
        {members.loading ? (
          <div className="state">{t('common.loading', { what: t('nav.members').toLowerCase() })}</div>
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
                        <div className="u-main">
                          {m.userName ?? m.userEmail ?? t('common.dash')}
                        </div>
                        <div className="u-sub">{m.userEmail}</div>
                      </td>
                      <td>
                        {m.status === 'BLOCKED' ? (
                          <Pill tone="bad">{t('status.member.blocked')}</Pill>
                        ) : (
                          <Pill tone="ok">{t('status.member.active')}</Pill>
                        )}
                      </td>
                      <td>
                        {isOnline(m.lastSeenAt) ? (
                          <Pill tone="ok">
                            <span className="dot on live" /> {t('members.online')}
                          </Pill>
                        ) : (
                          <Pill tone="neutral">
                            <span className="dot off" />{' '}
                            {fmtWhen(m.lastSeenAt, lang, t('time.now'))}
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
      </div>
    </>
  )
}
