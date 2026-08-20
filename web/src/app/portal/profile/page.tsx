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

      <StoreInfo seller={seller} onSaved={refresh} />
      <Devices key={devicesKey} logout={logout} />
      <ChangePassword onChanged={() => setDevicesKey((n) => n + 1)} />
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
      <div className="card-h">
        <h3>{t('profile.info.title')}</h3>
        <div className="sp" />
        <Pill tone={status.tone}>{t(status.key)}</Pill>
      </div>
      <form onSubmit={save} style={{ padding: 16 }}>
        {error != null && <div className="state bad">{errorText(error)}</div>}
        <div className="kv">
          <span className="klab">{t('profile.email')}</span>
          <span className="mono">{seller.email}</span>
        </div>
        <div className="kv">
          <span className="klab">{t('profile.joined')}</span>
          <span>{new Date(seller.createdAt).toLocaleDateString(lang)}</span>
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
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
        <div className="formrow">
          <button className="btn pri sm" type="submit" disabled={busy || !dirty}>
            {busy ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </form>
      <div className="card-foot">
        <span className="note">{t('profile.foot')}</span>
      </div>
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
      <div className="card-h">
        <h3>{t('profile.devices.title')}</h3>
        <div className="sp" />
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

function ChangePassword({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMismatch(next !== confirm)
    if (next !== confirm) return
    setBusy(true)
    try {
      await api.patch('/sellers/me/password', {
        oldPassword: current,
        newPassword: next,
      })
      toast(t('profile.pw.changed'))
      setCurrent('')
      setNext('')
      setConfirm('')
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>{t('profile.pw.title')}</h3>
      </div>
      <form onSubmit={submit} style={{ padding: 16 }}>
        {mismatch && <div className="state bad">{t('profile.pw.mismatch')}</div>}
        {error != null && <div className="state bad">{errorText(error)}</div>}
        <div style={{ maxWidth: 440 }}>
          <label className="field">
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
          <label className="field">
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
          <label className="field">
            <span>{t('profile.pw.confirm')}</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        </div>
        <div className="formrow">
          <button className="btn pri sm" type="submit" disabled={busy}>
            {busy ? t('profile.pw.submitting') : t('profile.pw.submit')}
          </button>
        </div>
      </form>
      <div className="card-foot">
        <span className="note">{t('profile.pw.foot')}</span>
      </div>
    </div>
  )
}
