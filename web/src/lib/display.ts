/**
 * Display preferences — theme — kept in localStorage and applied to the document.
 * A tiny pre-paint script in the root layout applies the stored value before React
 * mounts (so the page never flashes the wrong theme); this module is the typed
 * surface the topbar toggle uses at runtime. Keep the two in sync.
 */

export type ThemePref = 'light' | 'dark' | 'system'

export const THEME_KEY = 'ui.theme'

export function readTheme(): ThemePref {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function applyTheme(pref: ThemePref): void {
  const el = document.documentElement
  if (pref === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', pref)
}
