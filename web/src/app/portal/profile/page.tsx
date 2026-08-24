'use client'

import { useState, type FormEvent } from 'react'
import { PendingBanner } from '@/components/PendingBanner'
import { Pill } from '@/components/Pill'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useErrorText } from '@/lib/errors'
import { fmtWhen, sellerStatus } from '@/lib/pills'
import { useFetch } from '@/lib/useFetch'
import type { Seller, SellerSession } from '@/types'
import { useTitle } from '@/lib/useTitle'

export default function ProfilePage() {
  const { seller, refresh, logout } = useAuth()
  const { t } = useI18n()
  useTitle(t('profile.title'))
  const [devicesKey, setDevicesKey] = useState(0)

  if (!seller) return null

  return (
    <>
      <div className="vhead">
        <div>
          <h2>{t('profile.title')}</h2>
          <p>{t('profile.subtitle')}</p>
        </div>
      </div>

      <PendingBanner />

      <div className="profile-grid">
        <StoreInfo seller={seller} onSaved={refresh} />
        <SecurityCard onChanged={() => setDevicesKey((n) => n + 1)} />
      </div>

      <Devices key={devicesKey} logout={logout} />
    </>
  )
}

function StoreInfo({ seller, onSaved }: { seller: Seller; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const [name, setName] = useState(seller.name)
  const [contact, setContact] = useState(seller.contact ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const status = sellerStatus[seller.status]
  const dirty = name !== seller.name || contact !== (seller.contact ?? '')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.patch<Seller>('/sellers/me', { name, contact: contact || null })
      toast(t('profile.saved'))
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="ov-card-h">
        <h3 style={{ flex: 1 }}>{t('profile.info.title')}</h3>
        <Pill tone={status.tone}>{t(status.key)}</Pill>
      </div>
      <form onSubmit={save} style={{ padding: 18 }}>
        {error != null && <div className="state bad">{errorText(error)}</div>}
        <div className="grid2" style={{ gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="rev-label">{t('profile.email')}</span>
            <span className="mono" style={{ fontSize: 13 }}>{seller.email}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="rev-label">{t('profile.joined')}</span>
            <span className="mono" style={{ fontSize: 13 }}>
              {new Date(seller.createdAt).toLocaleDateString(lang)}
            </span>
          </div>
        </div>
        <div className="grid2" style={{ gap: 14 }}>
          <label className="field">
            <span>{t('profile.name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label className="field">
            <span>{t('profile.contact')}</span>
            <input
              className="input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={300}
              placeholder={t('profile.contactPlaceholder')}
            />
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <button className="btn pri sm" type="submit" disabled={busy || !dirty}>
            {busy ? t('profile.saving') : t('profile.save')}
          </button>
          <span className="note">{t('profile.foot')}</span>
        </div>
      </form>
    </div>
  )
}

function SecurityCard({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [twoFa, setTwoFa] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMismatch(false)
    if (!next) return
    setBusy(true)
    try {
      await api.patch('/sellers/me/password', {
        oldPassword: current,
        newPassword: next,
      })
      toast(t('profile.pw.changed'))
      setCurrent('')
      setNext('')
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {t('profile.security')}
      </h3>
      {mismatch && <div className="state bad">{t('profile.pw.mismatch')}</div>}
      {error != null && <div className="state bad">{errorText(error)}</div>}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>{t('profile.pw.current')}</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>{t('profile.pw.new')}</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        <div className="twofa-row">
          <div>
            <div className="twofa-label">{t('profile.twoFa')}</div>
            <div className="twofa-sub">{t('profile.twoFaSub')}</div>
          </div>
          <button
            type="button"
            className={`toggle-switch ${twoFa ? 'on' : 'off'}`}
            onClick={() => setTwoFa(!twoFa)}
          >
            <span className="knob" />
          </button>
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? t('profile.pw.submitting') : t('profile.updatePw')}
        </button>
      </form>
    </div>
  )
}

function Devices({ logout }: { logout: () => void }) {
  const { t, lang } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const [busy, setBusy] = useState<string | null>(null)

  const sessions = useFetch(() => api.get<SellerSession[]>('/sellers/me/sessions'), 'sessions')
  const rows = sessions.data ?? []
  const others = rows.filter((s) => !s.current).length

  const signOut = async (session: SellerSession) => {
    setBusy(session.id)
    try {
      await api.del(`/sellers/me/sessions/${session.id}`)
      if (session.current) return logout()
      sessions.reload()
      toast(t('profile.devices.signedOut'))
    } catch (err) {
      toast(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const signOutOthers = async () => {
    setBusy('others')
    try {
      await api.del('/sellers/me/sessions')
      sessions.reload()
      toast(t('profile.devices.signedOut'))
    } catch (err) {
      toast(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card">
      <div className="ov-card-h">
        <h3 style={{ flex: 1 }}>{t('profile.devices.title')}</h3>
        <button className="btn sm" onClick={signOutOthers} disabled={busy != null || !others}>
          {t('profile.devices.signOutOthers')}
        </button>
      </div>
      {sessions.error && <div className="state bad">{sessions.error}</div>}
      {sessions.loading ? (
        <>
          <div className="skel" />
          <div className="skel" />
        </>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{t('profile.devices.col.device')}</th>
                <th className="opt">{t('profile.devices.col.ip')}</th>
                <th>{t('profile.devices.col.active')}</th>
                <th className="opt">{t('profile.devices.col.signedIn')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="chips">
                      <span className="u-main">
                        {s.device ?? t('profile.devices.unknown')}
                      </span>
                      {s.current && <Pill tone="accent">{t('profile.devices.thisDevice')}</Pill>}
                    </div>
                  </td>
                  <td className="mono opt">{s.ip ?? t('common.dash')}</td>
                  <td className="u-sub tnum">{fmtWhen(s.lastSeenAt, lang, t('time.now'))}</td>
                  <td className="u-sub tnum opt">
                    {new Date(s.createdAt).toLocaleDateString(lang)}
                  </td>
                  <td className="rowbtns">
                    <button
                      className="btn bad sm"
                      onClick={() => signOut(s)}
                      disabled={busy != null}
                    >
                      {t('profile.devices.signOut')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-foot">
        <span className="note">{t('profile.devices.foot')}</span>
      </div>
    </div>
  )
}
