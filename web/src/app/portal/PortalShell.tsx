'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ConfirmProvider } from '@/components/Confirm'
import { ToastProvider } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { AuthProvider, useAuth } from '@/lib/auth'
import { api, getToken } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'
import {
  THEME_KEY,
  applyTheme,
  readTheme,
  type ThemePref,
} from '@/lib/display'
import type { SellerStats } from '@/types'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')
  return letters.toUpperCase() || 'S'
}

const THEME_CYCLE: ThemePref[] = ['system', 'light', 'dark']
const THEME_GLYPH: Record<ThemePref, string> = { system: '◐', light: '☀', dark: '☾' }

function PortalFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { seller, loading, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')
  const [theme, setThemeState] = useState<ThemePref>(() => readTheme())

  useEffect(() => {
    if (!loading && !getToken()) {
      router.replace('/login')
    }
  }, [loading, router])

  const approved = seller?.status === 'APPROVED'
  const stats = useFetch(
    () => (approved ? api.get<SellerStats>('/sellers/me/stats') : Promise.resolve(null)),
    `shell-stats:${approved}:${pathname}`,
  )
  const s = stats.data

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <span className="state">{t('common.loadingShort')}</span>
      </div>
    )
  }

  if (!seller) return null

  const toggleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setThemeState(next)
    applyTheme(next)
    localStorage.setItem(THEME_KEY, next)
  }

  const fmt = (n?: number) => (n && n > 0 ? String(n) : '')
  const navItems = [
    { href: '/portal/overview', label: t('nav.overview'), glyph: '⌂', count: '' },
    { href: '/portal/mini-apps', label: t('nav.miniApps'), glyph: '▦', count: fmt(s?.scriptCount) },
    { href: '/portal/keys', label: t('nav.keys'), glyph: '⚷', count: fmt(s?.activeKeyCount) },
    { href: '/portal/members', label: t('nav.members'), glyph: '◎', count: fmt(s?.memberCount) },
    { href: '/portal/profile', label: t('nav.profile'), glyph: '⚙', count: '' },
  ]

  const isActive = (href: string) => {
    if (href === '/portal/overview') return pathname === href
    return pathname.startsWith(href)
  }

  const currentPage = navItems.find((item) => isActive(item.href))

  const runSearch = () => {
    const term = q.trim()
    router.push(term ? `/portal/mini-apps?q=${encodeURIComponent(term)}` : '/portal/mini-apps')
  }

  return (
    <div className="portal">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-badge">HS</span>
          <div className="bt">
            <b>Store-HideAuto</b>
            <span className="sub">{t('nav.tagline')}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-ic">{item.glyph}</span>
              <span className="nav-label">{item.label}</span>
              {item.count && <span className="nav-count">{item.count}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="rev-card">
            <div className="rev-label">{t('sidebar.month')}</div>
            <div className="rev-row">
              <span className="rev-amount tnum">$1,240</span>
              <span className="rev-delta">+18%</span>
            </div>
            <div className="rev-bar">
              <div className="rev-fill" style={{ width: '68%' }} />
            </div>
            <div className="rev-sub">{t('sidebar.monthSub')}</div>
          </div>
          <div className="user-card">
            <span className="ava">{initials(seller.name)}</span>
            <div className="uc-txt">
              <div className="uc-name">{seller.name}</div>
              <div className="uc-mail">{seller.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <div className="main-content">
        <header className="topbar">
          <button
            className="btn sm menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            title={t('topbar.menu')}
          >
            ☰
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>{t('topbar.crumb')}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: 'var(--text-primary)' }}>{currentPage?.label ?? ''}</span>
          </div>
          <div className="sp" />
          <div className="topbar-search">
            <span className="si">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch()
              }}
              placeholder={t('topbar.search')}
              aria-label={t('topbar.search')}
            />
            <span className="kbd">⌘K</span>
          </div>
          <div className="lang-toggle">
            <button
              className={lang === 'en' ? 'on' : 'off'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              className={lang === 'vi' ? 'on' : 'off'}
              onClick={() => setLang('vi')}
            >
              VI
            </button>
          </div>
          <button
            className="btn sm"
            onClick={toggleTheme}
            title={t('topbar.themeToggle')}
          >
            {THEME_GLYPH[theme]}
          </button>
          <button className="btn sm" onClick={logout}>
            {t('topbar.logout')}
          </button>
        </header>
        <main className="page-area">{children}</main>
      </div>
    </div>
  )
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <PortalFrame>{children}</PortalFrame>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
