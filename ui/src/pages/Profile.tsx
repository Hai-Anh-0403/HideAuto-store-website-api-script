import { useState, type FormEvent } from 'react'
import { Card, CardFoot, CardHead } from '../ui/Card'
import { Pill } from '../ui/Pill'
import { ErrorState, PendingApproval, TableSkeleton } from '../ui/States'
import { useToast } from '../ui/Toast'
import { useI18n } from '../i18n'
import { api } from '../lib/api'
import { useErrorText } from '../lib/errors'
import { fmtWhen, sellerStatus } from '../lib/pills'
import { useFetch } from '../lib/useFetch'
import { useAuth } from '../store/auth'
import type { Seller, SellerSession } from '../types'

/** Tài khoản seller: thông tin cửa hàng, thiết bị đang đăng nhập, đổi mật khẩu. */
export function Profile() {
  const { seller, refresh } = useAuth()
  const { t } = useI18n()
  // Đổi mật khẩu đá các thiết bị khác ra, nên danh sách bên trên phải tải lại.
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

      {seller.status !== 'approved' && <PendingApproval />}

      <StoreInfo seller={seller} onSaved={refresh} />
      <Devices key={devicesKey} />
      <ChangePassword onChanged={() => setDevicesKey((n) => n + 1)} />
    </>
  )
}

/** Các thiết bị đang đăng nhập — seller theo dõi và đăng xuất từ xa được. */
function Devices() {
  const { t, lang } = useI18n()
  const { toast } = useToast()
  const { logout } = useAuth()
  const errorText = useErrorText()
  const [busy, setBusy] = useState<string | null>(null)

  const sessions = useFetch(() => api.get<SellerSession[]>('/sellers/me/sessions'), 'sessions')
  const rows = sessions.data ?? []
  const others = rows.filter((s) => !s.current).length

  const signOut = async (session: SellerSession) => {
    setBusy(session.id)
    try {
      await api.post(`/sellers/me/sessions/${session.id}/revoke`)
      // Tự đăng xuất chính mình thì về luôn màn đăng nhập.
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
      const { revoked } = await api.post<{ revoked: number }>('/sellers/me/sessions/revoke-others')
      sessions.reload()
      toast(t('profile.devices.signedOutOthers', { count: revoked }))
    } catch (err) {
      toast(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHead
        title={t('profile.devices.title')}
        actions={
          <button className="btn sm" onClick={signOutOthers} disabled={busy != null || !others}>
            {t('profile.devices.signOutOthers')}
          </button>
        }
      />
      {sessions.error && <ErrorState message={sessions.error} />}
      {sessions.loading ? (
        <TableSkeleton rows={2} />
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
                      <span className="u-main">{s.device ?? t('profile.devices.unknown')}</span>
                      {s.current && <Pill tone="accent">{t('profile.devices.thisDevice')}</Pill>}
                    </div>
                  </td>
                  <td className="mono opt">{s.ip ?? t('common.dash')}</td>
                  <td className="u-sub tnum">{fmtWhen(s.last_seen_at, lang, t('time.now'))}</td>
                  <td className="u-sub tnum opt">
                    {new Date(s.created_at).toLocaleDateString(lang)}
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
      <CardFoot>{t('profile.devices.foot')}</CardFoot>
    </Card>
  )
}

function StoreInfo({ seller, onSaved }: { seller: Seller; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { toast } = useToast()
  const errorText = useErrorText()
  const [name, setName] = useState(seller.name)
  const [contact, setContact] = useState(seller.contact ?? '')
  const [busy, setBusy] = useState(false)
  // Lỗi gốc, dịch lúc render để đổi ngôn ngữ là đổi theo.
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
    <Card>
      <CardHead title={t('profile.info.title')} actions={<Pill tone={status.tone}>{t(status.key)}</Pill>} />
      <form onSubmit={save} style={{ padding: 16 }}>
        {error != null && <ErrorState message={errorText(error)} />}
        <div className="kv">
          <span className="klab">{t('profile.email')}</span>
          <span className="mono">{seller.email}</span>
        </div>
        <div className="kv">
          <span className="klab">{t('profile.joined')}</span>
          <span>{new Date(seller.created_at).toLocaleDateString(lang)}</span>
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <label className="field">
            <span>{t('profile.name')}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={1}
              maxLength={100}
              required
            />
          </label>
          <label className="field">
            <span>{t('profile.contact')}</span>
            <input
              className="input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={100}
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
      <CardFoot>{t('profile.foot')}</CardFoot>
    </Card>
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
    // Hai ô mới lệch nhau là lỗi của form, không cần gọi API.
    setMismatch(next !== confirm)
    if (next !== confirm) return
    setBusy(true)
    try {
      const result = await api.post<{ signed_out: number }>('/sellers/me/password', {
        current_password: current,
        new_password: next,
      })
      toast(
        result.signed_out
          ? t('profile.pw.changedAndSignedOut', { count: result.signed_out })
          : t('profile.pw.changed'),
      )
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
    <Card>
      <CardHead title={t('profile.pw.title')} />
      <form onSubmit={submit} style={{ padding: 16 }}>
        {mismatch && <ErrorState message={t('profile.pw.mismatch')} />}
        {error != null && <ErrorState message={errorText(error)} />}
        <div className="grid2">
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
        </div>
        <div className="grid2">
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
      <CardFoot>{t('profile.pw.foot')}</CardFoot>
    </Card>
  )
}
