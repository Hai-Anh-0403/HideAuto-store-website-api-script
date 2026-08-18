'use client'

import { useState } from 'react'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useErrorText } from '@/lib/errors'
import { fmtWhen, isOnline } from '@/lib/pills'
import { useFetch } from '@/lib/useFetch'
import type { Member, Page, Script } from '@/types'

const PAGE_SIZE = 20

export default function MembersPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const errorText = useErrorText()
  const approved = seller?.status === 'APPROVED'
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [skip, setSkip] = useState(0)

  const members = useFetch(
    () =>
      approved
        ? api.get<Page<Member>>(`/members?skip=${skip}&limit=${PAGE_SIZE}${q.trim() ? `&search=${encodeURIComponent(q.trim())}` : ''}`)
        : Promise.resolve(null),
    `members:${approved}:${skip}:${q}`,
  )
  const scripts = useFetch(
    () =>
      approved
        ? api.get<Page<Script>>('/scripts?limit=100')
        : Promise.resolve(null),
    `scripts:${approved}`,
  )

  const scriptItems = scripts.data?.items ?? []
  const nameOf = (id: string) => scriptItems.find((s) => s.id === id)?.name ?? id
  const rows = members.data?.items ?? []

  const toggleBlock = async (m: Member) => {
    const action = m.status === 'BLOCKED' ? 'unblock' : 'block'
    try {
      await api.patch(`/members/${m.id}/${action}`)
      members.reload()
      const email = m.userEmail ?? m.userName ?? t('common.dash')
      toast(
        action === 'block'
          ? t('members.blocked', { email })
          : t('members.unblocked', { email }),
      )
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
      {(members.error ?? scripts.error) && (
        <div className="state bad">{members.error ?? scripts.error}</div>
      )}

      <div className="card">
        <div className="card-h">
          <h3>{t('members.count', { count: members.data?.total ?? 0 })}</h3>
          <div className="sp" />
          <input
            className="search"
            placeholder={t('members.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => members.reload()}>
            {t('common.refresh')}
          </button>
        </div>
        {members.loading ? (
          <>
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
          </>
        ) : !rows.length ? (
          <div className="empty">
            <div className="icon">👥</div>
            <b>{t('members.emptyTitle')}</b>
            <p>{t('members.emptyBody')}</p>
          </div>
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>{t('members.col.user')}</th>
                  <th>{t('members.col.status')}</th>
                  <th className="opt">{t('members.col.using')}</th>
                  <th>{t('members.col.online')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
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
                    <td className="opt">
                      <div className="chips">
                        {m.allScripts && <Pill tone="accent">{t('members.allApps')}</Pill>}
                        {m.scriptIds.map((id) => (
                          <Pill key={id} tone="accent">
                            {nameOf(id)}
                          </Pill>
                        ))}
                      </div>
                      <div className="u-sub tnum" style={{ marginTop: 4 }}>
                        {t('members.appCount', {
                          used: m.allScripts ? scriptItems.length : m.scriptIds.length,
                          total: scriptItems.length,
                        })}
                      </div>
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
                    <td className="rowbtns">
                      <button
                        className={m.status === 'BLOCKED' ? 'btn ok sm' : 'btn bad sm'}
                        onClick={() => toggleBlock(m)}
                      >
                        {m.status === 'BLOCKED' ? t('members.unblock') : t('members.block')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {members.data && (
          <Pager skip={skip} limit={PAGE_SIZE} total={members.data.total} onChange={setSkip} />
        )}
        <div className="card-foot">
          <span className="note">{t('members.foot')}</span>
        </div>
      </div>
    </>
  )
}
