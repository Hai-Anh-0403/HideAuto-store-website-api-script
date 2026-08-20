'use client'

import { useCallback, useEffect, useState } from 'react'
import { en } from './en'
import { vi } from './vi'

const dicts = { en, vi } as const
type Locale = keyof typeof dicts
type Key = keyof typeof vi

const DEFAULT_LOCALE: Locale = 'vi'

/**
 * Starts at the default on both sides of the wire.
 *
 * Reading localStorage here instead would make the module's value differ between the
 * server render and the first client render, and React answers a mismatch by throwing
 * the server HTML away and re-rendering the whole tree (hydration error #418). The
 * stored choice is applied just after mount, which costs one extra render instead.
 */
let currentLocale: Locale = DEFAULT_LOCALE
let storedLocaleApplied = false
const listeners = new Set<() => void>()

/** Adopt the visitor's saved locale. Safe to call from every mount; only the first acts. */
function applyStoredLocale(): void {
  if (storedLocaleApplied || typeof window === 'undefined') return
  storedLocaleApplied = true

  const stored = localStorage.getItem('locale')
  if (stored && stored !== currentLocale && stored in dicts) {
    currentLocale = stored as Locale
    listeners.forEach((fn) => fn())
  }
}

export type MessageKey = Key

export function useI18n() {
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    listeners.add(forceUpdate)
    applyStoredLocale()
    return () => {
      listeners.delete(forceUpdate)
    }
  }, [forceUpdate])

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let text = dicts[currentLocale][key as Key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return text
  }, [])

  const tryT = useCallback((key: string, fallback: string) => {
    const found = dicts[currentLocale][key as Key]
    return found ?? fallback
  }, [])

  const setLocale = useCallback((loc: Locale) => {
    currentLocale = loc
    localStorage.setItem('locale', loc)
    listeners.forEach((fn) => fn())
  }, [])

  return { t, tryT, locale: currentLocale, lang: currentLocale, setLang: setLocale, setLocale }
}
