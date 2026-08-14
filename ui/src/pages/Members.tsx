import { useState } from 'react'
import { Card, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { ErrorState, Loading, PendingApproval } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { useErrorText } from '../lib/errors'
import { fmtWhen, isOnline } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../store/auth'
import type { Member, Page, Script } from '../types'

export function Members() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const errorText = useErrorText()
  const approved = seller?.status === 'approved'
  const { toast } = useToast()
  const [q, setQ] = useState('')

  const members = useFetch(
    () => (approved ? api.get<Page<Member>>('/sellers/me/members?limit=100') : Promise.resolve(null)),
    `members:${approved}`,
  )
  const scripts = useFetch(
    () => (approved ? api.get<Page<Script>>('/sellers/me/scripts?limit=100') : Promise.resolve(null)),
    `scripts:${approved}`,
  )

  const scriptItems = scripts.data?.items ?? []
  const nameOf = (id: string) => scriptItems.find((s) => s.id === id)?.name ?? id
  const needle = q.trim().toLowerCase()
  const rows = (members.data?.items ?? []).filter(
    (m) => !needle || (m.user_email ?? '').toLowerCase().includes(needle),
  )

  const toggleBlock = async (m: Member) => {
    const action = m.status === 'blocked' ? 'unblock' : 'block'
    try {
      await api.post(`/sellers/me/members/${m.id}/${action}`)
      members.reload()
      const email = m.user_email ?? m.user_id
      toast(action === 'block' ? t('members.blocked', { email }) : t('members.unblocked', { email }))
    } catch (err) {
      toast(errorText(err))
    }
  }

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('members.title')}</h2>
          <p>{t('members.subtitle')}</p>
        </div>
        <span className="ep">
          <b>GET</b> /sellers/me/members
        </span>
      </div>

      {!approved && <PendingApproval />}
      {(members.error ?? scripts.error) && <ErrorState message={members.error ?? scripts.error ?? ''} />}

      <Card>
        <CardHead
          title={t('members.count', { count: members.data?.total ?? 0 })}
          actions={
            <>
              <input
                className="search"
                placeholder={t('members.search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => members.reload()}>
                {t('common.refresh')}
              </button>
            </>
          }
        />
        {members.loading ? (
          <Loading what={t('nav.members').toLowerCase()} />
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>{t('members.col.user')}</th>
                  <th>{t('members.col.status')}</th>
                  <th>{t('members.col.using')}</th>
                  <th>{t('members.col.online')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="u-main">{m.user_name ?? m.user_email ?? m.user_id}</div>
                        <div className="u-sub">
                          {m.user_email} · <span className="mono">{m.user_id}</span>
                        </div>
                      </td>
                      <td>
                        {m.status === 'blocked' ? (
                          <Pill tone="bad">{t('status.member.blocked')}</Pill>
                        ) : (
                          <Pill tone="ok">{t('status.member.active')}</Pill>
                        )}
                      </td>
                      <td>
                        <div className="chips">
                          {m.all_scripts && <Pill tone="accent">{t('members.allApps')}</Pill>}
                          {m.script_ids.map((id) => (
                            <Pill key={id} tone="accent">
                              {nameOf(id)}
                            </Pill>
                          ))}
                        </div>
                        <div className="u-sub tnum" style={{ marginTop: 4 }}>
                          {t('members.appCount', {
                            used: m.all_scripts ? scriptItems.length : m.script_ids.length,
                            total: scriptItems.length,
                          })}
                        </div>
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
                      <td className="rowbtns">
                        <button
                          className={m.status === 'blocked' ? 'btn ok sm' : 'btn bad sm'}
                          onClick={() => toggleBlock(m)}
                        >
                          {m.status === 'blocked' ? t('members.unblock') : t('members.block')}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="u-sub" style={{ padding: '18px 16px' }}>
                      {t('members.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          <span className="note">
            {t('members.foot')}{' '}
            <span className="mono">POST /sellers/me/members/{'{id}'}/block</span>
          </span>
        </div>
      </Card>
    </>
  )
}
