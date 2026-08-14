import { useState, type FormEvent } from 'react'
import { Card } from '../ui/Card'
import { useI18n } from '../i18n'
import { useErrorText } from '../lib/errors'
import { useAuth } from '../store/auth'
import { useTheme } from '../theme/ThemeProvider'

type Mode = 'login' | 'register'

export function Login() {
  const { login, register } = useAuth()
  const { mode: theme, cycle } = useTheme()
  const { t, lang, setLang } = useI18n()
  const errorText = useErrorText()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // Cất lỗi/thông báo ở dạng chưa dịch để đổi ngôn ngữ là chữ đổi theo.
  const [error, setError] = useState<unknown>(null)
  const [registered, setRegistered] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setRegistered(false)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        const created = await register(email, password, name)
        if (created.status === 'approved') {
          // Store đang bật tự duyệt — vào thẳng portal, không bắt đăng nhập lại.
          await login(email, password)
        } else {
          setMode('login')
          setRegistered(true)
        }
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-box">
        <div className="login-brand">
          <b>storeAutoHide</b>
          <span>{t('login.tagline')}</span>
        </div>

        {registered && (
          <div className="banner ok">
            <span className="bi">✓</span>
            <div>{t('login.registered')}</div>
          </div>
        )}
        {error != null && (
          <div className="banner bad">
            <span className="bi">⛔</span>
            <div>{errorText(error, 'login.failed')}</div>
          </div>
        )}

        <Card>
          <div className="card-h">
            <div className="seg">
              <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
                {t('login.signIn')}
              </button>
              <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
                {t('login.signUp')}
              </button>
            </div>
            <div className="sp" />
            <button
              type="button"
              className="btn sm"
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              title={t('topbar.language')}
            >
              {lang === 'vi' ? 'VI' : 'EN'}
            </button>
            <button type="button" className="btn sm" onClick={cycle} title={t('topbar.theme')}>
              {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
            </button>
          </div>

          <form onSubmit={submit} style={{ padding: 16 }}>
            {mode === 'register' && (
              <label className="field">
                <span>{t('login.storeName')}</span>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t('login.storeNamePlaceholder')}
                />
              </label>
            )}
            <label className="field">
              <span>{t('login.email')}</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>{t('login.password')}</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            <button className="btn pri" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? t('login.working') : mode === 'login' ? t('login.signIn') : t('login.signUp')}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
