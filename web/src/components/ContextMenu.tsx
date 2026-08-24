'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'

export interface CtxItem {
  label: string
  icon?: string
  danger?: boolean
  /** Draw a separator above this item. */
  sep?: boolean
  onClick: () => void
}

interface CtxState {
  x: number
  y: number
  items: CtxItem[]
}

/**
 * A right-click quick-actions menu. Wire a row's `onContextMenu` to `open(e, items)`, drop
 * `<ContextMenu {...menu} />` once at the top of the page, and the menu closes itself on any
 * outside click, scroll or Escape.
 */
export function useContextMenu() {
  const [state, setState] = useState<CtxState | null>(null)
  const open = useCallback((e: React.MouseEvent, items: CtxItem[]) => {
    e.preventDefault()
    setState({ x: e.clientX, y: e.clientY, items })
  }, [])
  const close = useCallback(() => setState(null), [])
  return { state, open, close }
}

export function ContextMenu({ state, close }: { state: CtxState | null; close: () => void }) {
  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // mousedown inside the menu is stopped below, so these only fire for outside interactions.
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [state, close])

  if (!state) return null

  // Keep the menu on screen near the cursor.
  const estWidth = 200
  const estHeight = state.items.length * 38 + 12
  const left = Math.min(state.x, window.innerWidth - estWidth - 8)
  const top = Math.min(state.y, window.innerHeight - estHeight - 8)

  return (
    <div
      className="ctxmenu"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {state.items.map((it, i) => (
        <Fragment key={i}>
          {it.sep && <div className="ctxmenu-sep" />}
          <button
            type="button"
            className={it.danger ? 'danger' : ''}
            onClick={() => {
              it.onClick()
              close()
            }}
          >
            {it.icon != null && <span className="ci">{it.icon}</span>}
            {it.label}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
