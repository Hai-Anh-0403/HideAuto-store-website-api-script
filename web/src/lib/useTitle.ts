'use client'

import { useEffect } from 'react'

/**
 * Set the browser tab title from a client page.
 *
 * Every page here is a client component, so none of them can export `metadata` — without
 * this every tab, history entry and bookmark reads the same "Store-HideAuto". Titles are
 * translated and the locale lives in localStorage, so the server could not produce the
 * right string anyway; pass an already-resolved `t(...)` value (or a dynamic name).
 *
 * The suffix mirrors the `%s · Store-HideAuto` template in the root layout, so titles look
 * the same whether they came from metadata or from here. Pass a falsy value while the
 * data is still loading and the layout's own title stands.
 */
export function useTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · Store-HideAuto`
  }, [title])
}
