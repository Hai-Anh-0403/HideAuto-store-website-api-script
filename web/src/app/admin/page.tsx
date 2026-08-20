'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { BrandLogo } from '@/components/Brand'
import { Pager } from '@/components/Pager'
import { Pill } from '@/components/Pill'
import { useConfirm } from '@/components/Confirm'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import {
  adminApi,
  getAdminToken,
  setAdminToken,
  setAdminUnauthorizedHandler,
} from '@/lib/api'
import { useErrorText } from '@/lib/errors'
import { fmtWhen, scriptPill, sellerPill } from '@/lib/pills'
import { useDebounced } from '@/lib/useDebounced'
import { useFetch } from '@/lib/useFetch'
import type { AdminSeller, PendingScript, Page, SellerStatus, Token } from '@/types'
import { useTitle } from '@/lib/useTitle'

const PAGE_SIZE = 20

/**
 * The review console.
 *
 * Until this page existed, approving a seller or a version could only be done by hand
 * through Swagger — which meant nobody could go on the store without someone holding a
 * bearer token in a REST client.
 */
export default function AdminPage() {
  const { t } = useI18n()
  useTitle(t('admin.title'))
  const [token, setTok] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'sellers' | 'review'>('sellers')

  // localStorage only exists after mount, so the first render cannot know whether we are
  // signed in. Reading it inside a promise (like `AuthProvider` does) keeps both state
  // updates out of the effect body, which the React 19 lint rules forbid.
  useEffect(() => {
    let alive = true
    void Promise.resolve().then(() => {
      if (!alive) return
      setTok(getAdminToken())
      setReady(true)
    })
    // An expired or revoked admin token would otherwise leave the console signed in with
    // every panel erroring and no way back to the form.
    setAdminUnauthorizedHandler(() => {
      setAdminToken(null)
      if (alive) setTok(null)
    })
    return () => {
      alive = false
      setAdminUnauthorizedHandler(null)
    }
  }, [])

  if (!ready) return <div className="state">{t('common.loadingShort')}</div>

  if (!token) {
    return <AdminLogin onSignedIn={(value) => setTok(value)} />
  }

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('admin.title')}</h2>
          <p>{t('admin.subtitle')}</p>
        </div>
        <div className="sp" />
        <button
          className="btn sm"
          onClick={() => {
            setAdminToken(null)
            setTok(null)
          }}
        >
          {t('topbar.logout')}
        </button>
      </div>

      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'sellers' ? 'on' : ''} onClick={() => setTab('sellers')}>
          {t('admin.tab.sellers')}
        </button>
        <button className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>
          {t('admin.tab.review')}
        </button>
      </div>

      {tab === 'sellers' ? <SellersQueue /> : <ReviewQueue />}
    </>
  )
}

/* ---------- Sign in ---------- */

function AdminLogin({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const { t } = useI18n()
  const errorText = useErrorText()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const data = await adminApi.post<Token>('/auth/admin/login', { email, password })
      setAdminToken(data.access_token)
      onSignedIn(data.access_token)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '10vh auto 0' }}>
      <div className="card-h">
        <BrandLogo />
        <div className="sp" />
        <h3>{t('admin.signIn')}</h3>
      </div>
      <form onSubmit={submit} style={{ padding: 16 }}>
        {error != null && <div className="state bad">{errorText(error)}</div>}
        <label className="field">
          <span>{t('login.email')}</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>{t('login.password')}</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn pri" type="submit" disabled={busy}>
          {busy ? t('login.working') : t('admin.signIn')}
        </button>
      </form>
      <div className="card-foot">
        <span className="note">{t('admin.signInFoot')}</span>
      </div>
    </div>
  )
}

/* ---------- Seller accounts ---------- */

/**
 * Every i18n key per decision, spelled out.
 *
 * Building them from the verb (`admin.seller.${action}d`) is what once shipped "rejectd" to
 * the screen — a key that renders as itself.
 */
const SELLER_ACTION = {
  approve: { label: 'admin.seller.approve', toast: 'admin.seller.approved' },
  reject: { label: 'admin.seller.reject', toast: 'admin.seller.rejected' },
  suspend: { label: 'admin.seller.suspend', toast: 'admin.seller.suspended' },
} as const

const SELLER_FILTERS: Array<SellerStatus | 'ALL'> = [
  'PENDING',
  'APPROVED',
  'SUSPENDED',
  'REJECTED',
  'ALL',
]

function SellersQueue() {
  const { t, lang } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const confirm = useConfirm()
  // Sellers waiting for a decision are the reason this page gets opened.
  const [status, setStatus] = useState<SellerStatus | 'ALL'>('PENDING')
  const [q, setQ] = useState('')
  const [skip, setSkip] = useState(0)

  // The box updates on every keystroke; the request waits for a pause.
  const search = useDebounced(q.trim())

  const query = [
    `skip=${skip}`,
    `limit=${PAGE_SIZE}`,
    status === 'ALL' ? '' : `status=${status}`,
    search ? `search=${encodeURIComponent(search)}` : '',
  ]
    .filter(Boolean)
    .join('&')

  const sellers = useFetch(
    () => adminApi.get<Page<AdminSeller>>(`/admin/sellers?${query}`),
    `adminSellers:${query}`,
  )
  const rows = sellers.data?.items ?? []

  const decide = async (
    seller: AdminSeller,
    action: 'approve' | 'reject' | 'suspend',
  ) => {
    // A rejected seller reads this text in their portal, so it is asked for, not invented.
    const decision = await confirm({
      title: t(SELLER_ACTION[action].label),
      body: t('admin.reasonPrompt', { name: seller.name }),
      confirmLabel: t(SELLER_ACTION[action].label),
      danger: action !== 'approve',
      reason:
        action === 'approve'
          ? undefined
          : { label: t('admin.reasonLabel'), placeholder: t('admin.reasonPlaceholder') },
    })
    if (!decision.ok) return
    const reason = decision.reason

    try {
      await adminApi.patch(`/admin/sellers/${seller.id}/${action}`, reason ? { reason } : {})
      sellers.reload()
      toast(t(SELLER_ACTION[action].toast, { name: seller.name }))
    } catch (err) {
      toast(errorText(err))
    }
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('admin.sellers.count', { count: sellers.data?.total ?? 0 })}</h3>
        <div className="sp" />
        <input
          className="search"
          placeholder={t('admin.sellers.search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setSkip(0)
          }}
        />
        <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => sellers.reload()}>
          {t('common.refresh')}
        </button>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <div className="seg">
          {SELLER_FILTERS.map((value) => (
            <button
              key={value}
              className={status === value ? 'on' : ''}
              onClick={() => {
                setStatus(value)
                setSkip(0)
              }}
            >
              {value === 'ALL' ? t('keys.filter.all') : t(sellerPill(value).key)}
            </button>
          ))}
        </div>
      </div>

      {sellers.error && <div className="state bad">{sellers.error}</div>}
      {sellers.loading && !sellers.data ? (
        <>
          <div className="skel" />
          <div className="skel" />
        </>
      ) : !rows.length ? (
        <div className="empty">
          <div className="icon">✅</div>
          <b>{t('admin.sellers.emptyTitle')}</b>
          <p>{t('admin.sellers.emptyBody')}</p>
        </div>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{t('admin.sellers.col.shop')}</th>
                <th>{t('admin.sellers.col.status')}</th>
                <th className="opt">{t('admin.sellers.col.volume')}</th>
                <th className="opt">{t('admin.sellers.col.joined')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const badge = sellerPill(s.status)
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="u-main">{s.name}</div>
                      <div className="u-sub">{s.email}</div>
                      {s.contact && <div className="u-sub">{s.contact}</div>}
                    </td>
                    <td>
                      <Pill tone={badge.tone}>{t(badge.key)}</Pill>
                      {s.statusReason && <div className="u-sub">{s.statusReason}</div>}
                    </td>
                    <td className="opt u-sub tnum">
                      {t('admin.sellers.volume', {
                        scripts: s._count.scripts,
                        keys: s._count.keys,
                        members: s._count.members,
                      })}
                    </td>
                    <td className="opt u-sub tnum">
                      {fmtWhen(s.createdAt, lang, t('time.now'))}
                    </td>
                    <td className="rowbtns">
                      {s.status !== 'APPROVED' && (
                        <button className="btn ok sm" onClick={() => decide(s, 'approve')}>
                          {t('admin.seller.approve')}
                        </button>
                      )}
                      {s.status === 'APPROVED' && (
                        <button className="btn bad sm" onClick={() => decide(s, 'suspend')}>
                          {t('admin.seller.suspend')}
                        </button>
                      )}
                      {s.status !== 'REJECTED' && (
                        <button className="btn bad sm" onClick={() => decide(s, 'reject')}>
                          {t('admin.seller.reject')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {sellers.data && (
        <Pager skip={skip} limit={PAGE_SIZE} total={sellers.data.total} onChange={setSkip} />
      )}
      <div className="card-foot">
        <span className="note">{t('admin.sellers.foot')}</span>
      </div>
    </div>
  )
}

/* ---------- Versions waiting for review ---------- */

function ReviewQueue() {
  const { t, lang } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const confirm = useConfirm()
  const [skip, setSkip] = useState(0)

  const scripts = useFetch(
    () => adminApi.get<Page<PendingScript>>(`/admin/scripts?skip=${skip}&limit=${PAGE_SIZE}`),
    `adminScripts:${skip}`,
  )
  const rows = scripts.data?.items ?? []

  const decide = async (
    script: PendingScript,
    versionId: string,
    action: 'approve' | 'reject',
  ) => {
    const decision = await confirm({
      title:
        action === 'approve' ? t('admin.review.approve') : t('admin.review.reject'),
      body:
        action === 'approve'
          ? t('admin.review.approveConfirm', { name: script.name })
          : t('admin.review.reasonPrompt', { name: script.name }),
      confirmLabel:
        action === 'approve' ? t('admin.review.approve') : t('admin.review.reject'),
      danger: action === 'reject',
      reason:
        action === 'reject'
          ? { label: t('admin.reasonLabel'), placeholder: t('admin.reasonPlaceholder') }
          : undefined,
    })
    if (!decision.ok) return
    const reason = decision.reason

    try {
      await adminApi.patch(
        `/admin/scripts/versions/${versionId}/${action}`,
        reason ? { reason } : {},
      )
      scripts.reload()
      toast(
        t(
          action === 'approve' ? 'admin.review.approved' : 'admin.review.rejected',
          { name: script.name },
        ),
      )
    } catch (err) {
      toast(errorText(err))
    }
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('admin.review.count', { count: scripts.data?.total ?? 0 })}</h3>
        <div className="sp" />
        <button className="btn sm" onClick={() => scripts.reload()}>
          {t('common.refresh')}
        </button>
      </div>

      {scripts.error && <div className="state bad">{scripts.error}</div>}
      {scripts.loading && !scripts.data ? (
        <>
          <div className="skel" />
          <div className="skel" />
        </>
      ) : !rows.length ? (
        <div className="empty">
          <div className="icon">📥</div>
          <b>{t('admin.review.emptyTitle')}</b>
          <p>{t('admin.review.emptyBody')}</p>
        </div>
      ) : (
        rows.map((script) => {
          const version = script.versions[0]
          if (!version) return null
          const badge = scriptPill(script.status)
          const creds = version.scan?.embedded_credentials_count ?? 0

          return (
            <div key={script.id} className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="kv">
                <b>{script.name}</b>
                <span className="keychip">v{version.version}</span>
                <Pill tone={badge.tone}>{t(badge.key)}</Pill>
                <span className="u-sub">
                  {script.seller.name} · {script.seller.email}
                </span>
                <div className="sp" />
                <span className="u-sub tnum">
                  {fmtWhen(version.createdAt, lang, t('time.now'))}
                </span>
              </div>

              {version.changelog && (
                <div className="kv">
                  <span className="klab">{t('versions.col.changelog')}</span>
                  {version.changelog}
                </div>
              )}

              <div className="kv">
                <span className="klab">{t('versions.nodes')}</span>
                <b className="tnum">{version.nodeCount}</b>
                <span className="chips" style={{ display: 'inline-flex' }}>
                  {version.nodeGroupsUsed.map((g) => (
                    <span key={g} className="groupchip" data-group={g}>
                      {g}
                    </span>
                  ))}
                </span>
                {version.capabilities?.uses_shell && <Pill tone="bad">shell</Pill>}
                {version.capabilities?.uses_ai_llm && <Pill tone="accent">AI</Pill>}
                {version.capabilities?.requires_proxy && <Pill tone="neutral">proxy</Pill>}
              </div>

              <div className="kv">
                <span className="klab">{t('versions.moderation')}</span>
                {!version.graphExtracted ? (
                  <span>{t('versions.noGraph')}</span>
                ) : creds === 0 ? (
                  <span>{t('versions.cleanScan')}</span>
                ) : (
                  <span>
                    {t('versions.dirtyScan', { count: creds })}{' '}
                    {version.scan.credential_paths.map((p) => (
                      <span key={p} className="keychip" style={{ marginRight: 4 }}>
                        {p}
                      </span>
                    ))}
                  </span>
                )}
              </div>

              <div className="formrow">
                <button
                  className="btn ok sm"
                  disabled={creds > 0}
                  title={creds > 0 ? t('admin.review.blocked') : undefined}
                  onClick={() => decide(script, version.id, 'approve')}
                >
                  {t('admin.review.approve')}
                </button>
                <button
                  className="btn bad sm"
                  onClick={() => decide(script, version.id, 'reject')}
                >
                  {t('admin.review.reject')}
                </button>
                {creds > 0 && <span className="note">{t('admin.review.blocked')}</span>}
              </div>
            </div>
          )
        })
      )}
      {scripts.data && (
        <Pager skip={skip} limit={PAGE_SIZE} total={scripts.data.total} onChange={setSkip} />
      )}
      <div className="card-foot">
        <span className="note">{t('admin.review.foot')}</span>
      </div>
    </div>
  )
}
