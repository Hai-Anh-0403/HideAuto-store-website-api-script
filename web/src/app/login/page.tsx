'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/Brand'
import { useI18n } from '@/i18n'
import { api, setToken } from '@/lib/api'
import { useErrorText } from '@/lib/errors'
import type { Token } from '@/types'
import { useTitle } from '@/lib/useTitle'

type Mode = 'login' | 'register'
type FieldErrors = { name?: string; email?: string; password?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const router = useRouter()
  const { t, lang, setLang } = useI18n()
  useTitle(t('login.signIn'))
  const errorText = useErrorText()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [registered, setRegistered] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system')

  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors((f) => (f[field] ? { ...f, [field]: undefined } : f))

  const switchMode = (next: Mode) => {
    setMode(next)
    setFieldErrors({})
    setError(null)
  }

  const cycleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
    setTheme(next)
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', next)
    }
  }

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
        const data = await api.post<Token>('/auth/login', { email, password })
        setToken(data.access_token)
        router.push('/portal/overview')
      } else {
        const data = await api.post<Token>('/auth/register', { email, password, name })
        setToken(data.access_token)
        router.push('/portal/overview')
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
              <span className="bi">!</span>
              <div>{errorText(error, 'login.failed')}</div>
            </div>
          )}

          <div className="card">
            <div className="card-h">
              <div className="seg">
                <button
                  type="button"
                  className={mode === 'login' ? 'on' : ''}
                  onClick={() => switchMode('login')}
                >
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
              <button
                type="button"
                className="btn sm"
                onClick={cycleTheme}
                title={t('topbar.theme')}
              >
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
                  {fieldErrors.name && (
                    <span className="field-error">{t(fieldErrors.name)}</span>
                  )}
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
                {fieldErrors.email && (
                  <span className="field-error">{t(fieldErrors.email)}</span>
                )}
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
              <button
                className="btn pri"
                type="submit"
                disabled={busy}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {busy
                  ? t('login.working')
                  : mode === 'login'
                    ? t('login.signIn')
                    : t('login.signUp')}
              </button>
            </form>
            {/*
             * No link to the review console from here, for now.
             *
             * It is a separate identity system that no seller can use, and this is the
             * store's public front door — pointing at the admin entrance from it invites
             * people to knock. `/admin` still answers on a direct URL, so nothing about
             * the approval flow changes; an admin just has to know the address.
             */}
          </div>
        </div>
      </div>
    </div>
  )
}
