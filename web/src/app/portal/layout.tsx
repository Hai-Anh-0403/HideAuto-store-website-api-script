'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { BrandLogo } from '@/components/Brand'
import { ConfirmProvider } from '@/components/Confirm'
import { ToastProvider } from '@/components/Toast'
import { useI18n } from '@/i18n'
import { AuthProvider, useAuth } from '@/lib/auth'
import { getToken } from '@/lib/api'

function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { seller, loading, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system')

  useEffect(() => {
    if (!loading && !getToken()) {
      router.replace('/login')
    }
  }, [loading, router])

  const cycleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
    setTheme(next)
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', next)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <span className="state">{t('common.loadingShort')}</span>
      </div>
    )
  }

  if (!seller) return null

  const navItems = [
    { href: '/portal/overview', label: t('nav.overview') },
    { href: '/portal/mini-apps', label: t('nav.miniApps') },
    { href: '/portal/keys', label: t('nav.keys') },
    { href: '/portal/members', label: t('nav.members') },
    { href: '/portal/profile', label: t('nav.profile') },
  ]

  const isActive = (href: string) => {
    if (href === '/portal/overview') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="portal">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <BrandLogo size={28} />
          <b style={{ marginLeft: 8 }}>storeAutoHide</b>
          <span className="sub">{t('nav.tagline')}</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sp" />
        <div style={{ padding: '8px 16px' }}>
          <span className="u-sub">{seller.name}</span>
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
          <span className="topbar-crumb">{t('topbar.crumb')}</span>
          <div className="sp" />
          <span className="u-sub">{seller.name}</span>
          <button
            className="btn sm"
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            title={t('topbar.language')}
          >
            {lang === 'vi' ? 'VI' : 'EN'}
          </button>
          <button className="btn sm" onClick={cycleTheme} title={t('topbar.theme')}>
            {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
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

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <PortalShell>{children}</PortalShell>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
