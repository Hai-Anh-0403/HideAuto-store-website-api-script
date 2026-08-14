import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { ErrorState, Loading, PendingApproval } from '../ui/States'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { fmtWhen, isOnline } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../store/auth'
import type { KeyItem, Member, Page, Script } from '../types'

export function Overview() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const approved = seller?.status === 'approved'
  const key = `overview:${approved}`

  const scripts = useFetch(
    () => (approved ? api.get<Page<Script>>('/sellers/me/scripts?limit=100') : Promise.resolve(null)),
    key,
  )
  const members = useFetch(
    () => (approved ? api.get<Page<Member>>('/sellers/me/members?limit=100') : Promise.resolve(null)),
    key,
  )
  const keys = useFetch(
    () => (approved ? api.get<KeyItem[]>('/sellers/me/keys') : Promise.resolve(null)),
    key,
  )

  const memberItems = members.data?.items ?? []
  const scriptItems = scripts.data?.items ?? []
  const activeKeys = (keys.data ?? []).filter((k) => k.status === 'active').length
  const online = memberItems.filter((m) => isOnline(m.last_seen_at)).length
  const nameOf = (id: string) => scriptItems.find((s) => s.id === id)?.name ?? id
  const error = scripts.error ?? members.error ?? keys.error

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
          <div className="v tnum">{members.data?.total ?? 0}</div>
          <div className="s">{t('overview.tile.membersSub')}</div>
        </div>
        <div className="tile">
          <div className="k">
            <span className="dot on" /> {t('overview.tile.online')}
          </div>
          <div className="v tnum" style={{ color: 'var(--success)' }}>
            {online}
          </div>
          <div className="s">{t('overview.tile.onlineSub')}</div>
        </div>
        <div className="tile">
          <div className="k">{t('overview.tile.keys')}</div>
          <div className="v tnum">{activeKeys}</div>
          <div className="s">{t('overview.tile.keysSub')}</div>
        </div>
        <div className="tile">
          <div className="k">{t('overview.tile.apps')}</div>
          <div className="v tnum">{scripts.data?.total ?? 0}</div>
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
                  <th className="opt">{t('members.col.using')}</th>
                </tr>
              </thead>
              <tbody>
                {memberItems.length ? (
                  memberItems.slice(0, 8).map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="u-main">{m.user_name ?? m.user_email ?? m.user_id}</div>
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
                      <td className="opt">
                        <div className="chips">
                          {m.all_scripts && <Pill tone="accent">{t('members.allApps')}</Pill>}
                          {m.script_ids.map((id) => (
                            <Pill key={id} tone="accent">
                              {nameOf(id)}
                            </Pill>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="u-sub" style={{ padding: '18px 16px' }}>
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
