'use client';

import { useI18n } from '@/i18n';

const localeLabels = { en: 'English', vi: 'Tiếng Việt' } as const;
type Locale = keyof typeof localeLabels;

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="language-switcher">
      <span className="sr-only">{t('common.language')}</span>
      <select
        aria-label={t('common.selectLanguage')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {Object.entries(localeLabels).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
