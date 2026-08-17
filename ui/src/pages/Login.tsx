import { useState, type FormEvent } from 'react'
import { BrandLogo } from '../ui/Brand'
import { Card } from '../ui/Card'
import { useI18n, type MessageKey } from '../i18n'
import { useErrorText } from '../lib/errors'
import { useAuth } from '../store/auth'
import { useTheme } from '../theme/ThemeProvider'

type Mode = 'login' | 'register'
type FieldErrors = { name?: MessageKey; email?: MessageKey; password?: MessageKey }

// Đủ để bắt lỗi gõ nhầm (thiếu @, thiếu tên miền); server mới là nơi chốt email thật.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors((f) => (f[field] ? { ...f, [field]: undefined } : f))

  const switchMode = (next: Mode) => {
    setMode(next)
    setFieldErrors({})
    setError(null)
  }

  // Kiểm ngay trên client để báo lỗi đã dịch, không để trình duyệt bung tooltip tiếng máy.
  const validate = (): FieldErrors => {
    const errs: FieldErrors = {}
    if (mode === 'register' && !name.trim()) errs.name = 'login.err.name'
    if (!EMAIL_RE.test(email.trim())) errs.email = 'login.err.email'
    if (!password) errs.password = 'login.err.passwordRequired'
    else if (mode === 'register' && password.length < 8) errs.password = 'login.err.passwordShort'
    return errs
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setFieldErrors(errs)
    if (errs.name || errs.email || errs.password) return
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
      <div className="login-shell">
        <div className="login-hero">
          <BrandLogo size={56} detail />
          <b>storeAutoHide</b>
          <span className="sub">{t('login.tagline')}</span>
          <ul className="login-features">
            <li>
              <span className="fi">✓</span>
              <span>{t('login.feature.publish')}</span>
            </li>
            <li>
              <span className="fi">✓</span>
              <span>{t('login.feature.keys')}</span>
            </li>
            <li>
              <span className="fi">✓</span>
              <span>{t('login.feature.package')}</span>
            </li>
          </ul>
        </div>

        <div className="login-panel">
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
              <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>
                {t('login.signIn')}
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'on' : ''}
                onClick={() => switchMode('register')}
              >
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

          <form onSubmit={submit} style={{ padding: 16 }} noValidate>
            {mode === 'register' && (
              <label className="field">
                <span>{t('login.storeName')}</span>
                <input
                  className={`input${fieldErrors.name ? ' bad' : ''}`}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    clearFieldError('name')
                  }}
                  aria-invalid={fieldErrors.name != null}
                  placeholder={t('login.storeNamePlaceholder')}
                />
                {fieldErrors.name && <span className="field-error">{t(fieldErrors.name)}</span>}
              </label>
            )}
            <label className="field">
              <span>{t('login.email')}</span>
              <input
                className={`input${fieldErrors.email ? ' bad' : ''}`}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearFieldError('email')
                }}
                aria-invalid={fieldErrors.email != null}
                autoComplete="username"
              />
              {fieldErrors.email && <span className="field-error">{t(fieldErrors.email)}</span>}
            </label>
            <label className="field">
              <span>{t('login.password')}</span>
              <input
                className={`input${fieldErrors.password ? ' bad' : ''}`}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearFieldError('password')
                }}
                aria-invalid={fieldErrors.password != null}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {fieldErrors.password && (
                <span className="field-error">{t(fieldErrors.password)}</span>
              )}
            </label>
            <button className="btn pri" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? t('login.working') : mode === 'login' ? t('login.signIn') : t('login.signUp')}
            </button>
          </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
