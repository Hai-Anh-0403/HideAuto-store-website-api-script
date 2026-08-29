'use client'

import { PendingBanner } from '@/components/PendingBanner'
import { Pill } from '@/components/Pill'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { fmtWhen, isOnline } from '@/lib/pills'
import { useFetch } from '@/lib/useFetch'
import type { Member, Page, SellerStats } from '@/types'
import { useTitle } from '@/lib/useTitle'
import { useRouter } from 'next/navigation'

const CHART_BARS = [
  { day: '11', h: 62, ok: true },
  { day: '12', h: 48, ok: true },
  { day: '13', h: 80, ok: true },
  { day: '14', h: 35, ok: true },
  { day: '15', h: 92, ok: true },
  { day: '16', h: 105, ok: true },
  { day: '17', h: 78, ok: true },
  { day: '18', h: 60, ok: false },
  { day: '19', h: 88, ok: true },
  { day: '20', h: 95, ok: true },
  { day: '21', h: 72, ok: true },
  { day: '22', h: 110, ok: true },
  { day: '23', h: 68, ok: true },
  { day: '24', h: 85, ok: true },
]

const TOP_APPS = [
  { name: 'Auto Register', amount: '$420', pct: '100%', color: 'var(--brand)' },
  { name: 'Bulk Messenger', amount: '$310', pct: '74%', color: 'var(--success)' },
  { name: 'Data Scraper Pro', amount: '$195', pct: '46%', color: 'var(--warning)' },
  { name: 'Account Checker', amount: '$115', pct: '27%', color: 'var(--text-muted)' },
]

const AUDIT_EVENTS = [
  { text: 'Key batch created', meta: '10 keys · Whole shop', color: 'var(--brand)' },
  { text: 'Auto Register v2.1 approved', meta: 'admin · 2h ago', color: 'var(--success)' },
  { text: 'New user redeemed a key', meta: 'buyer@example.com · 4h ago', color: 'var(--brand)' },
  { text: 'Bulk Messenger v1.3 uploaded', meta: 'pending review · 6h ago', color: 'var(--warning)' },
  { text: 'Device blocked', meta: 'machine a3f2… · 1d ago', color: 'var(--danger)' },
  { text: 'Password changed', meta: 'your account · 2d ago', color: 'var(--text-muted)' },
]

export default function OverviewPage() {
  const { seller } = useAuth()
  const { t, lang } = useI18n()
  const router = useRouter()
  useTitle(t('overview.title'))
  const approved = seller?.status === 'APPROVED'
  const key = `overview:${approved}`

  const stats = useFetch(
    () => (approved ? api.get<SellerStats>('/sellers/me/stats') : Promise.resolve(null)),
    key,
  )
  const members = useFetch(
    () => (approved ? api.get<Page<Member>>('/members?limit=6') : Promise.resolve(null)),
    key,
  )

  const memberItems = members.data?.items ?? []
  const error = stats.error ?? members.error

  return (
    <>
      <div className="vhead">
        <div style={{ flex: 1, minWidth: 260 }}>
          <h2 style={{ fontSize: 26, letterSpacing: '-0.03em' }}>{t('overview.title')}</h2>
          <p>{t('overview.subtitle', { name: seller?.name ?? '' })}</p>
        </div>
        {approved && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn pri"
              onClick={() => router.push('/portal/keys')}
              style={{ borderRadius: 10, padding: '10px 15px' }}
            >
              {t('overview.newKeys')}
            </button>
            <button
              className="btn"
              onClick={() => router.push('/portal/mini-apps/new')}
              style={{ borderRadius: 10, padding: '10px 15px' }}
            >
              {t('overview.upload')}
            </button>
          </div>
        )}
      </div>

      <PendingBanner />
      {error && <div className="state bad">{error}</div>}

      <div className="tiles">
        <div className="tile">
          <div className="k">
            <span className="dot" style={{ background: 'var(--brand)' }} />
            {t('overview.tile.members')}
          </div>
          <div className="vrow">
            <span className="v tnum">{stats.data?.memberCount ?? 0}</span>
            <span className="delta" style={{ color: 'var(--success)' }}>+12%</span>
          </div>
          <div className="s">{t('overview.tile.membersSub')}</div>
        </div>
        <div className="tile">
          <div className="k">
            <span className="dot on" />
            {t('overview.tile.online')}
          </div>
          <div className="vrow">
            <span className="v tnum" style={{ color: 'var(--success)' }}>
              {stats.data?.onlineCount ?? 0}
            </span>
          </div>
          <div className="s">{t('overview.tile.onlineSub')}</div>
        </div>
        <div className="tile">
          <div className="k">
            <span className="dot" style={{ background: 'var(--warning)' }} />
            {t('overview.tile.keys')}
          </div>
          <div className="vrow">
            <span className="v tnum">{stats.data?.activeKeyCount ?? 0}</span>
            <span className="delta" style={{ color: 'var(--success)' }}>+8%</span>
          </div>
          <div className="s">{t('overview.tile.keysSub')}</div>
        </div>
        <div className="tile">
          <div className="k">
            <span className="dot" style={{ background: 'var(--cat-ai)' }} />
            {t('overview.tile.apps')}
          </div>
          <div className="vrow">
            <span className="v tnum">{stats.data?.scriptCount ?? 0}</span>
          </div>
          <div className="s">{t('overview.tile.appsSub')}</div>
        </div>
      </div>

      {/* Activity chart + Revenue breakdown */}
      <div className="ov-grid" style={{ marginBottom: 12 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '17px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {t('overview.activity')}
              </h3>
              <div className="u-sub">{t('overview.activitySub')}</div>
            </div>
            <div className="chart-stats">
              <div className="chart-stat">
                <div className="fig tnum">1,284</div>
                <div className="lab">{t('overview.runs')}</div>
              </div>
              <div className="chart-stat">
                <div className="fig tnum" style={{ color: 'var(--success)' }}>99.2%</div>
                <div className="lab">{t('overview.successRate')}</div>
              </div>
            </div>
          </div>
          <div className="chart-bars">
            {CHART_BARS.map((b) => (
              <div key={b.day} className="chart-bar">
                <div
                  className="bar"
                  style={{
                    height: `${Math.round((b.h / 120) * 100)}%`,
                    background: b.ok ? 'var(--brand)' : 'var(--danger)',
                  }}
                />
                <div className="lbl">{b.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '17px 18px' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {t('overview.revenueTitle')}
            </h3>
            <div className="u-sub">{t('overview.revenueSub')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {TOP_APPS.map((a) => (
              <div key={a.name} className="rev-app">
                <div className="rev-app-row">
                  <span className="rev-app-name">{a.name}</span>
                  <span className="rev-app-amt tnum">{a.amount}</span>
                </div>
                <div className="progress">
                  <div className="fill" style={{ width: a.pct, background: a.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="payout-foot">
            <span className="lab">{t('overview.payout')}</span>
            <span className="val tnum">$1,040</span>
          </div>
        </div>
      </div>

      {/* Recent users + Audit log */}
      <div className="ov-grid">
        <div className="card">
          <div className="ov-card-h">
            <h3 style={{ flex: 1 }}>{t('overview.recent')}</h3>
            <button
              className="btn ghost sm"
              style={{ color: 'var(--brand)', fontWeight: 700, fontSize: '12.5px' }}
              onClick={() => router.push('/portal/members')}
            >
              {t('overview.viewAll')} →
            </button>
          </div>
          {members.loading ? (
            <div className="state">
              {t('common.loading', { what: t('nav.members').toLowerCase() })}
            </div>
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

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="ov-card-h">
            <h3>{t('overview.audit')}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {AUDIT_EVENTS.map((e, i) => (
              <div key={i} className="audit-item">
                <span className="audit-dot" style={{ background: e.color }} />
                <div style={{ minWidth: 0 }}>
                  <div className="audit-text">{e.text}</div>
                  <div className="audit-meta">{e.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
