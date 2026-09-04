'use client'

import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react'
import { en } from './en'
import { vi } from './vi'
import { en as storefrontEn } from '@/shared/i18n/messages/en'
import { vi as storefrontVi } from '@/shared/i18n/messages/vi'

const dicts = {
  en: { ...en, ...storefrontEn },
  vi: { ...vi, ...storefrontVi },
} as const

export type Locale = keyof typeof dicts
export type MessageKey = keyof typeof dicts.vi

export const DEFAULT_LOCALE: Locale = 'vi'

interface I18nContextValue {
  locale: Locale
  setLocale: (loc: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  tryT: (key: string, fallback: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem('locale') as Locale | null
        if (stored && (stored === 'en' || stored === 'vi') && stored !== locale) {
          setLocaleState(stored)
          document.cookie = `locale=${stored}; path=/; max-age=31536000; SameSite=Lax`
          document.documentElement.lang = stored
        }
      } catch {
        // Ignore errors when localStorage is unavailable
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [locale])

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc)
    try {
      localStorage.setItem('locale', loc)
      document.cookie = `locale=${loc}; path=/; max-age=31536000; SameSite=Lax`
      document.documentElement.lang = loc
    } catch {
      // Ignore errors when localStorage is unavailable
    }
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text = dicts[locale][key as MessageKey] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return text
    },
    [locale],
  )

  const tryT = useCallback(
    (key: string, fallback: string) => {
      const found = dicts[locale][key as MessageKey]
      return found ?? fallback
    },
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t, tryT }),
    [locale, setLocale, t, tryT],
  )

  return React.createElement(I18nContext.Provider, { value }, children)
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (ctx) {
    return {
      t: ctx.t,
      tryT: ctx.tryT,
      locale: ctx.locale,
      lang: ctx.locale,
      setLang: ctx.setLocale,
      setLocale: ctx.setLocale,
    }
  }

  // Fallback if accessed outside provider
  const fallbackT = (key: string, vars?: Record<string, string | number>) => {
    let text = dicts[DEFAULT_LOCALE][key as MessageKey] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return text
  }

  const fallbackTryT = (key: string, fallback: string) => {
    return dicts[DEFAULT_LOCALE][key as MessageKey] ?? fallback
  }

  return {
    t: fallbackT,
    tryT: fallbackTryT,
    locale: DEFAULT_LOCALE,
    lang: DEFAULT_LOCALE,
    setLang: () => {},
    setLocale: () => {},
  }
}
