'use client';

import { Moon, Sun } from 'lucide-react';
import { useI18n } from '@/i18n';
import { applyTheme, readTheme, THEME_KEY } from '@/lib/display';

export function ThemeToggle() {
  const { t } = useI18n();

  const handleToggle = () => {
    const current = readTheme();
    const isDark =
      current === 'dark' ||
      (current === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={t('theme.toggle')}
      title={t('topbar.themeToggle')}
      onClick={handleToggle}
    >
      <Sun size={15} className="theme-icon-sun" aria-hidden="true" />
      <Moon size={15} className="theme-icon-moon" aria-hidden="true" />
    </button>
  );
}
