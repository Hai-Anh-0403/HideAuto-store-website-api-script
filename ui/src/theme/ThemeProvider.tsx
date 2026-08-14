import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type ThemeMode = 'system' | 'light' | 'dark'
const ORDER: ThemeMode[] = ['system', 'light', 'dark']

interface ThemeValue {
  mode: ThemeMode
  cycle: () => void
}

const ThemeCtx = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', mode)
  }, [mode])

  const cycle = useCallback(() => {
    setMode((m) => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length])
  }, [])

  return <ThemeCtx.Provider value={{ mode, cycle }}>{children}</ThemeCtx.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
