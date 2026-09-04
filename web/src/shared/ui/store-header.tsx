'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogIn, Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LanguageSwitcher } from './language-switcher';
import { useI18n } from '@/i18n';
import { ThemeToggle } from './theme-toggle';

export function StoreHeader() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <header>
      <div className="shell nav">
        <Link className="brand" href="/">
          <Image src="/images/icon.png" alt="HideAuto" width={28} height={28} priority />
          <span>HIDEAUTO</span>
        </Link>
        <nav>
          <Link href="/scripts">{t('navigation.scripts')}</Link>
          <Link href="/sellers">{t('navigation.sellers')}</Link>
          <Link href="/#docs">{t('navigation.docs')}</Link>
        </nav>
        <div className="nav-actions">
          <form className="header-search" action="/scripts">
            <Search size={15} />
            <input
              name="q"
              placeholder={t('navigation.searchScripts')}
              aria-label={t('navigation.searchScripts')}
            />
          </form>
          <ThemeToggle />
          <LanguageSwitcher />
          <Link className="login-button" href="/login">
            <LogIn size={16} />
            {t('navigation.signIn')}
          </Link>
        </div>
        <button
          className="mobile-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={t(
            menuOpen ? 'navigation.closeMenu' : 'navigation.openMenu',
          )}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>
      {menuOpen && (
        <div id="mobile-navigation" className="mobile-navigation">
          <div>
            <form className="header-search" action="/scripts">
              <Search size={17} />
              <input
                name="q"
                placeholder={t('navigation.searchScripts')}
                aria-label={t('navigation.searchScripts')}
              />
            </form>
            <nav aria-label={t('navigation.mobileNavigation')}>
              <Link href="/scripts" onClick={() => setMenuOpen(false)}>
                {t('navigation.scripts')}
              </Link>
              <Link href="/sellers" onClick={() => setMenuOpen(false)}>
                {t('navigation.sellers')}
              </Link>
              <Link href="/#docs" onClick={() => setMenuOpen(false)}>
                {t('navigation.docs')}
              </Link>
            </nav>
            <div className="mobile-navigation-actions">
              <LanguageSwitcher />
            </div>
            <Link
              className="login-button"
              href="/login"
              onClick={() => setMenuOpen(false)}
            >
              <LogIn size={16} />
              {t('navigation.signIn')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
