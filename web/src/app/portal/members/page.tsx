'use client'

import { useState } from 'react'
import { Pager } from '@/components/Pager'
import { PendingBanner } from '@/components/PendingBanner'
import { Pill } from '@/components/Pill'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useErrorText } from '@/lib/errors'
import { fmtWhen, isOnline } from '@/lib/pills'
import { useDebounced } from '@/lib/useDebounced'
import { useFetch } from '@/lib/useFetch'
import type { Member, MemberDevice, Page, Script } from '@/types'
import { useTitle } from '@/lib/useTitle'

const PAGE_SIZE = 20

type StatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED' | 'ONLINE'
const STATUS_FILTERS: StatusFilter[] = ['ALL', 'ACTIVE', 'BLOCKED', 'ONLINE']

export default function MembersPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  useTitle(t('members.title'))
  const errorText = useErrorText()
  const approved = seller?.status === 'APPROVED'
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [skip, setSkip] = useState(0)
  const [open, setOpen] = useState<string | null>(null)

  // The box updates on every keystroke; the request waits for a pause.
  const search = useDebounced(q.trim())

  const query = [
    `skip=${skip}`,
    `limit=${PAGE_SIZE}`,
    search ? `search=${encodeURIComponent(search)}` : '',
    filter === 'ACTIVE' || filter === 'BLOCKED' ? `status=${filter}` : '',
    filter === 'ONLINE' ? 'online=true' : '',
  ]
    .filter(Boolean)
    .join('&')

  const members = useFetch(
    () => (approved ? api.get<Page<Member>>(`/members?${query}`) : Promise.resolve(null)),
    `members:${approved}:${query}`,
  )
  const scripts = useFetch(
    () => (approved ? api.get<Page<Script>>('/scripts?limit=100') : Promise.resolve(null)),
    `scripts:${approved}`,
  )

  const scriptItems = scripts.data?.items ?? []
  /** null when the app behind an id is gone — a raw cuid means nothing to a seller. */
  const nameOf = (id: string): string | null =>
    scriptItems.find((s) => s.id === id)?.name ?? null
  const rows = members.data?.items ?? []

  const run = async (action: () => Promise<string>) => {
    try {
      toast(await action())
    } catch (err) {
      toast(errorText(err))
    }
  }

  const toggleBlock = (m: Member) =>
    run(async () => {
      const action = m.status === 'BLOCKED' ? 'unblock' : 'block'
      await api.patch(`/members/${m.id}/${action}`)
      members.reload()
      const email = m.userEmail ?? m.userName ?? t('common.dash')
      return action === 'block'
        ? t('members.blocked', { email })
        : t('members.unblocked', { email })
    })

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('members.title')}</h2>
          <p>{t('members.subtitle')}</p>
        </div>
      </div>

      <PendingBanner />
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
            onChange={(e) => {
              setQ(e.target.value)
              // Page 4 of the old query is usually empty for the new one.
              setSkip(0)
            }}
          />
          <button
            className="btn sm"
            style={{ marginLeft: 8 }}
            onClick={() => members.reload()}
          >
            {t('common.refresh')}
          </button>
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <div className="seg">
            {STATUS_FILTERS.map((value) => (
              <button
                key={value}
                className={filter === value ? 'on' : ''}
                onClick={() => {
                  setFilter(value)
                  setSkip(0)
                }}
              >
                {t(`members.filter.${value.toLowerCase()}`)}
              </button>
            ))}
          </div>
        </div>

        {members.loading && !members.data ? (
          <>
            <div className="skel" />
            <div className="skel" />
            <div className="skel" />
          </>
        ) : !rows.length ? (
          <div className="empty">
            <div className="icon">👥</div>
            <b>{q || filter !== 'ALL' ? t('members.emptyFilteredTitle') : t('members.emptyTitle')}</b>
            <p>{q || filter !== 'ALL' ? t('members.emptyFilteredBody') : t('members.emptyBody')}</p>
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
                  <MemberRow
                    key={m.id}
                    member={m}
                    scripts={scriptItems}
                    nameOf={nameOf}
                    lang={lang}
                    expanded={open === m.id}
                    onToggleExpand={() => setOpen(open === m.id ? null : m.id)}
                    onToggleBlock={() => toggleBlock(m)}
                    onChanged={() => members.reload()}
                    run={run}
                  />
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

/* ---------- One buyer ---------- */

function MemberRow({
  member,
  scripts,
  nameOf,
  lang,
  expanded,
  onToggleExpand,
  onToggleBlock,
  onChanged,
  run,
}: {
  member: Member
  scripts: Script[]
  nameOf: (id: string) => string | null
  lang: string
  expanded: boolean
  onToggleExpand: () => void
  onToggleBlock: () => void
  onChanged: () => void
  run: (action: () => Promise<string>) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <tr>
        <td>
          <div className="u-main">{member.userName ?? member.userEmail ?? t('common.dash')}</div>
          <div className="u-sub">{member.userEmail}</div>
        </td>
        <td>
          {member.status === 'BLOCKED' ? (
            <Pill tone="bad">{t('status.member.blocked')}</Pill>
          ) : (
            <Pill tone="ok">{t('status.member.active')}</Pill>
          )}
        </td>
        <td className="opt">
          <div className="chips">
            {member.allScripts && <Pill tone="accent">{t('members.allApps')}</Pill>}
            {member.scriptIds.map((id) => {
              const name = nameOf(id)
              return (
                <Pill key={id} tone={name ? 'accent' : 'neutral'}>
                  {name ?? t('members.unknownApp')}
                </Pill>
              )
            })}
          </div>
          <div className="u-sub tnum" style={{ marginTop: 4 }}>
            {t('members.appCount', {
              used: member.allScripts ? scripts.length : member.scriptIds.length,
              total: scripts.length,
            })}
          </div>
        </td>
        <td>
          {isOnline(member.lastSeenAt) ? (
            <Pill tone="ok">
              <span className="dot on live" /> {t('members.online')}
            </Pill>
          ) : (
            <Pill tone="neutral">
              <span className="dot off" /> {fmtWhen(member.lastSeenAt, lang, t('time.now'))}
            </Pill>
          )}
        </td>
        <td className="rowbtns">
          <button className="btn sm" onClick={onToggleExpand}>
            {expanded ? t('members.hideDetail') : t('members.showDetail')}
          </button>
          <button
            className={member.status === 'BLOCKED' ? 'btn ok sm' : 'btn bad sm'}
            onClick={onToggleBlock}
          >
            {member.status === 'BLOCKED' ? t('members.unblock') : t('members.block')}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ background: 'var(--surface-2)', padding: '10px 16px 16px' }}>
            <MemberAccess member={member} scripts={scripts} onChanged={onChanged} run={run} />
            <MemberDevices member={member} nameOf={nameOf} lang={lang} run={run} />
            <MemberKeys member={member} lang={lang} />
          </td>
        </tr>
      )}
    </>
  )
}

/* ---------- Which apps this buyer may run ---------- */

function MemberAccess({
  member,
  scripts,
  onChanged,
  run,
}: {
  member: Member
  scripts: Script[]
  onChanged: () => void
  run: (action: () => Promise<string>) => void
}) {
  const { t } = useI18n()
  const [allScripts, setAllScripts] = useState(member.allScripts)
  const [scriptIds, setScriptIds] = useState<string[]>(member.scriptIds)

  const dirty =
    allScripts !== member.allScripts ||
    JSON.stringify([...scriptIds].sort()) !== JSON.stringify([...member.scriptIds].sort())

  const toggle = (id: string) =>
    setScriptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  return (
    <div className="kv" style={{ display: 'block' }}>
      <span className="klab">{t('members.access.title')}</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0' }}>
        <input
          type="checkbox"
          checked={allScripts}
          onChange={(e) => setAllScripts(e.target.checked)}
        />{' '}
        {t('members.access.allApps')}
      </label>
      {!allScripts && (
        <div className="chips" style={{ marginBottom: 6 }}>
          {scripts.length ? (
            scripts.map((s) => (
              <label key={s.id} className="tagchip" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scriptIds.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />{' '}
                {s.name}
              </label>
            ))
          ) : (
            <span className="u-sub">{t('members.access.noApps')}</span>
          )}
        </div>
      )}
      <div className="formrow">
        <button
          className="btn pri sm"
          disabled={!dirty}
          onClick={() =>
            run(async () => {
              await api.patch(`/members/${member.id}/access`, { allScripts, scriptIds })
              onChanged()
              return t('members.access.saved')
            })
          }
        >
          {t('keys.save')}
        </button>
        <span className="note">{t('members.access.hint')}</span>
      </div>
    </div>
  )
}

/* ---------- Machines ---------- */

function MemberDevices({
  member,
  nameOf,
  lang,
  run,
}: {
  member: Member
  nameOf: (id: string) => string | null
  lang: string
  run: (action: () => Promise<string>) => void
}) {
  const { t } = useI18n()
  const devices = useFetch(
    () => api.get<MemberDevice[]>(`/members/${member.id}/devices`),
    `devices:${member.id}`,
  )
  const rows = devices.data ?? []

  return (
    <div className="kv" style={{ display: 'block' }}>
      <span className="klab">{t('members.devices.title')}</span>
      {devices.loading ? (
        <div className="skel" />
      ) : !rows.length ? (
        <div className="u-sub">{t('members.devices.empty')}</div>
      ) : (
        <table style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>{t('members.devices.machine')}</th>
              <th className="opt">{t('members.devices.app')}</th>
              <th className="opt">{t('members.devices.activations')}</th>
              <th>{t('members.devices.lastSeen')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className="keychip">{d.machineId}</span>{' '}
                  {d.blocked && <Pill tone="bad">{t('members.devices.blocked')}</Pill>}
                </td>
                <td className="opt u-sub">
                  {d.scriptId ? (nameOf(d.scriptId) ?? t('members.unknownApp')) : '—'}
                </td>
                <td className="opt tnum">{d.activationCount}</td>
                <td className="u-sub tnum">{fmtWhen(d.lastSeenAt, lang, t('time.now'))}</td>
                <td className="rowbtns">
                  <button
                    className={d.blocked ? 'btn ok sm' : 'btn bad sm'}
                    onClick={() =>
                      run(async () => {
                        const action = d.blocked ? 'unblock' : 'block'
                        await api.patch(
                          `/members/${member.id}/devices/${encodeURIComponent(d.machineId)}/${action}`,
                        )
                        devices.reload()
                        return d.blocked
                          ? t('members.devices.unblocked')
                          : t('members.devices.blockedToast')
                      })
                    }
                  >
                    {d.blocked ? t('members.devices.unblock') : t('members.devices.block')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <span className="note">{t('members.devices.hint')}</span>
    </div>
  )
}

/* ---------- How they got in ---------- */

function MemberKeys({ member, lang }: { member: Member; lang: string }) {
  const { t } = useI18n()
  return (
    <div className="kv" style={{ display: 'block' }}>
      <span className="klab">{t('members.keys.title')}</span>
      {member.keys.length ? (
        <div className="chips">
          {member.keys.map((k) => (
            <span key={k.id} className="keychip" title={k.label ?? ''}>
              {k.key}
              <span className="u-sub"> · {fmtWhen(k.redeemedAt, lang, t('time.now'))}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="u-sub">{t('members.keys.empty')}</span>
      )}
    </div>
  )
}
