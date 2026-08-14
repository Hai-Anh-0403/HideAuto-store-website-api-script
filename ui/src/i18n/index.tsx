import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en } from './en'
import { vi } from './vi'

export type Lang = 'vi' | 'en'
export type MessageKey = keyof typeof vi

const DICTS: Record<Lang, Record<MessageKey, string>> = { vi, en }
const LANG_KEY = 'storeautohide.lang'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
]

function initialLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'vi' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'vi'
}

/** `{name}` trong chuỗi được thay bằng giá trị tương ứng. */
function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  )
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  /** Dịch nếu có bản dịch cho khoá đó, còn không thì trả về `fallback`. */
  tryT: (key: string, fallback: string) => string
}

const I18nCtx = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(LANG_KEY, next)
    setLangState(next)
  }, [])

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang]
    return {
      lang,
      setLang,
      t: (key, vars) => interpolate(dict[key] ?? key, vars),
      tryT: (key, fallback) => (key in dict ? dict[key as MessageKey] : fallback),
    }
  }, [lang, setLang])

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
