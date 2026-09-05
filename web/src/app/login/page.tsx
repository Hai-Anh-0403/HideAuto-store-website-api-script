'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Moon,
  Sun,
  UserPlus,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { api, setToken } from '@/lib/api';
import { useErrorText } from '@/lib/errors';
import type { Token } from '@/types';
import { useTitle } from '@/lib/useTitle';
import { applyTheme, THEME_KEY } from '@/lib/display';

type Mode = 'login' | 'register';
type FieldErrors = { name?: string; email?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  useTitle(t('login.signIn'));
  const errorText = useErrorText();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [registered, setRegistered] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors((f) => (f[field] ? { ...f, [field]: undefined } : f));

  const switchMode = (next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setError(null);
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (mode === 'register' && !name.trim()) errs.name = 'login.err.name';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'login.err.email';
    if (!password) errs.password = 'login.err.passwordRequired';
    else if (mode === 'register' && password.length < 8) errs.password = 'login.err.passwordShort';
    return errs;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (errs.name || errs.email || errs.password) return;
    setBusy(true);
    setError(null);
    setRegistered(false);
    try {
      if (mode === 'login') {
        const data = await api.post<Token>('/auth/login', { email, password });
        setToken(data.access_token);
        router.push('/portal/overview');
      } else {
        const data = await api.post<Token>('/auth/register', { email, password, name });
        setToken(data.access_token);
        router.push('/portal/overview');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-4 sm:p-6 md:p-12 relative">
      {/* Top-Left Back Button */}
      <Link
        href="/"
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 inline-flex items-center gap-2 px-3 py-1.5 border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:border-[var(--steel)] hover:text-[var(--steel)] font-mono text-xs uppercase tracking-wider transition-colors shadow-sm"
      >
        <ArrowLeft size={14} />
        <span>{t('common.back')}</span>
      </Link>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[1fr_400px] gap-8 md:gap-14 items-center">
        {/* Left Column: Brand & Tagline & Core features */}
        <div className="max-w-md">
          <div className="flex items-center gap-3.5 mb-5">
            <Image
              src="/images/icon.png"
              alt="HideAuto"
              width={48}
              height={48}
              priority
              className="w-12 h-12 shrink-0"
            />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--steel)] font-semibold leading-none mb-1.5">
                SELLER PORTAL
              </p>
              <h3 className="font-heading font-bold text-xl uppercase tracking-wider text-[var(--ink)] leading-none">
                STORE - HIDEAUTO
              </h3>
            </div>
          </div>

          <h1 className="font-heading font-bold text-2xl uppercase text-[var(--ink)] leading-snug mb-3">
            {t('login.tagline')}
          </h1>

          <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed mb-6">
            Cổng quản trị dành cho nhà phát triển tự động hóa: phát hành kịch bản (.haup), quản lý mã khóa số Ed25519 và phân phối đến người mua.
          </p>

          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-xs sm:text-sm text-[var(--ink)]">
              <span className="w-5 h-5 grid place-items-center bg-[var(--bg)] border border-[var(--line)] text-[var(--steel)] font-mono text-[11px] shrink-0 font-bold">
                ✓
              </span>
              <span>{t('login.feature.publish')}</span>
            </li>
            <li className="flex items-center gap-3 text-xs sm:text-sm text-[var(--ink)]">
              <span className="w-5 h-5 grid place-items-center bg-[var(--bg)] border border-[var(--line)] text-[var(--steel)] font-mono text-[11px] shrink-0 font-bold">
                ✓
              </span>
              <span>{t('login.feature.keys')}</span>
            </li>
            <li className="flex items-center gap-3 text-xs sm:text-sm text-[var(--ink)]">
              <span className="w-5 h-5 grid place-items-center bg-[var(--bg)] border border-[var(--line)] text-[var(--steel)] font-mono text-[11px] shrink-0 font-bold">
                ✓
              </span>
              <span>{t('login.feature.package')}</span>
            </li>
          </ul>
        </div>

        {/* Right Column: Industry Blueprint Auth Card */}
        <div className="relative bg-[var(--panel)] border border-[var(--line)] px-6 py-7 sm:px-8 sm:py-8 min-h-[465px] flex flex-col justify-between">
          {/* Blueprint Corner Registration Marks */}
          <span className="absolute -top-1.5 -left-1.5 font-mono text-xs text-[var(--steel)] leading-none select-none" aria-hidden="true">+</span>
          <span className="absolute -top-1.5 -right-1.5 font-mono text-xs text-[var(--steel)] leading-none select-none" aria-hidden="true">+</span>
          <span className="absolute -bottom-1.5 -left-1.5 font-mono text-xs text-[var(--steel)] leading-none select-none" aria-hidden="true">+</span>
          <span className="absolute -bottom-1.5 -right-1.5 font-mono text-xs text-[var(--steel)] leading-none select-none" aria-hidden="true">+</span>

          {/* Top section: Topbar + Notifications */}
          <div>
            {/* Card Topbar: Tabs + Language/Theme Controls */}
            <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-[var(--line)]">
              {/* Segmented Mode Switcher */}
              <div className="flex border border-[var(--line)] bg-[var(--bg)]">
                <button
                  type="button"
                  className={`px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[var(--steel)] text-white'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  onClick={() => switchMode('login')}
                >
                  {t('login.signIn')}
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 font-heading font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[var(--steel)] text-white'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  onClick={() => switchMode('register')}
                >
                  {t('login.signUp')}
                </button>
              </div>

              {/* Language & Theme Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="h-8 px-2.5 border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--steel)] font-mono text-xs uppercase transition-colors cursor-pointer"
                  onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
                  title={t('topbar.language')}
                >
                  {lang === 'vi' ? 'VI' : 'EN'}
                </button>
                <button
                  type="button"
                  className="h-8 w-8 grid place-items-center border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--steel)] text-xs transition-colors cursor-pointer"
                  onClick={toggleTheme}
                  title={t('topbar.theme')}
                  aria-label={t('topbar.theme')}
                >
                  <Sun size={14} className="theme-icon-sun" />
                  <Moon size={14} className="theme-icon-moon" />
                </button>
              </div>
            </div>

            {/* Notifications / Alerts */}
            {registered && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <div>{t('login.registered')}</div>
              </div>
            )}

            {error != null && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-mono text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <div>{errorText(error, 'login.failed')}</div>
              </div>
            )}
          </div>

          {/* Auth Form */}
          <form onSubmit={submit} noValidate className="flex-1 flex flex-col justify-between">
            <div className={`flex-1 flex flex-col justify-center ${mode === 'login' ? 'gap-5 py-3' : 'gap-3.5 py-1'}`}>
              {mode === 'register' && (
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--dim)] mb-1.5">
                    {t('login.storeName')}
                  </label>
                  <input
                    className={`w-full h-10.5 px-3.5 bg-[var(--bg)] border ${
                      fieldErrors.name ? 'border-[var(--danger)]' : 'border-[var(--line)]'
                    } text-[var(--ink)] text-sm outline-none focus:border-[var(--steel)] font-sans transition-colors rounded-none placeholder:text-[var(--dim)]`}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFieldError('name');
                    }}
                    aria-invalid={fieldErrors.name != null}
                    placeholder={t('login.storeNamePlaceholder')}
                    maxLength={120}
                  />
                  {fieldErrors.name && (
                    <span className="block font-mono text-[10px] text-[var(--danger)] mt-1">
                      {t(fieldErrors.name)}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--dim)] mb-1.5">
                  {t('login.email')}
                </label>
                <input
                  type="email"
                  className={`w-full h-10.5 px-3.5 bg-[var(--bg)] border ${
                    fieldErrors.email ? 'border-[var(--danger)]' : 'border-[var(--line)]'
                  } text-[var(--ink)] text-sm outline-none focus:border-[var(--steel)] font-sans transition-colors rounded-none placeholder:text-[var(--dim)]`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  aria-invalid={fieldErrors.email != null}
                  autoComplete="username"
                  maxLength={254}
                  placeholder="seller@example.com"
                />
                {fieldErrors.email && (
                  <span className="block font-mono text-[10px] text-[var(--danger)] mt-1">
                    {t(fieldErrors.email)}
                  </span>
                )}
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--dim)] mb-1.5">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`w-full h-10.5 pl-3.5 pr-10 bg-[var(--bg)] border ${
                      fieldErrors.password ? 'border-[var(--danger)]' : 'border-[var(--line)]'
                    } text-[var(--ink)] text-sm outline-none focus:border-[var(--steel)] font-sans transition-colors rounded-none placeholder:text-[var(--dim)]`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError('password');
                    }}
                    aria-invalid={fieldErrors.password != null}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    maxLength={128}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-10.5 w-10 grid place-items-center text-[var(--dim)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <span className="block font-mono text-[10px] text-[var(--danger)] mt-1">
                    {t(fieldErrors.password)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 bg-[var(--steel)] text-white hover:opacity-90 font-heading font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-opacity border border-transparent disabled:opacity-50 cursor-pointer mt-4"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('login.working')}</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn size={16} />
                  <span>{t('login.signIn')}</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>{t('login.signUp')}</span>
                </>
              )}
            </button>
          </form>

          <p className="font-mono text-[10px] text-[var(--dim)] text-center mt-5 uppercase tracking-wider">
            STORE-HIDEAUTO · AUTHENTICATION v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
