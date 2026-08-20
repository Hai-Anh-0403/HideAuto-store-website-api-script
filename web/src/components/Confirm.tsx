'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useI18n } from '@/i18n'

/**
 * In-app confirmation, replacing `window.confirm` / `window.prompt`.
 *
 * The native dialogs looked fine in a normal tab and were **dead** everywhere else: an
 * embedded browser (the desktop app's own webview, an in-app preview) returns `false` from
 * `confirm()` without ever drawing anything, so "Revoke", "Delete" and "Archive" simply did
 * nothing when clicked. They also freeze the page while open, which is the last thing a
 * destructive action should feel like.
 *
 *   const confirm = useConfirm()
 *   const { ok, reason } = await confirm({ title, body, danger: true, reason: {...} })
 */

export interface ConfirmRequest {
  title: string
  body?: string
  /** Label of the accept button. Defaults to a plain "OK". */
  confirmLabel?: string
  /** Red accept button, for anything that destroys or takes something away. */
  danger?: boolean
  /** Ask for a sentence along with the decision — a rejection reason, typically. */
  reason?: {
    label: string
    placeholder?: string
    required?: boolean
  }
}

export interface ConfirmResult {
  ok: boolean
  reason?: string
}

type Ask = (request: ConfirmRequest) => Promise<ConfirmResult>

const ConfirmContext = createContext<Ask | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [reason, setReason] = useState('')
  const resolveRef = useRef<((result: ConfirmResult) => void) | null>(null)
  const acceptRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback<Ask>((next) => {
    setReason('')
    setRequest(next)
    return new Promise<ConfirmResult>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = useCallback((result: ConfirmResult) => {
    resolveRef.current?.(result)
    resolveRef.current = null
    setRequest(null)
    setReason('')
  }, [])

  // Escape closes, and the accept button takes focus so the keyboard alone can answer.
  useEffect(() => {
    if (!request) return
    acceptRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle({ ok: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request, settle])

  const blocked = Boolean(request?.reason?.required) && !reason.trim()

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {request && (
        <div
          className="modal-backdrop"
          onClick={() => settle({ ok: false })}
          role="presentation"
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={request.title}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{request.title}</h3>
            {request.body && <p className="u-sub">{request.body}</p>}
            {request.reason && (
              <label className="field" style={{ marginTop: 12 }}>
                <span>{request.reason.label}</span>
                <input
                  className="input"
                  value={reason}
                  placeholder={request.reason.placeholder}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !blocked) {
                      settle({ ok: true, reason: reason.trim() || undefined })
                    }
                  }}
                  maxLength={500}
                  autoFocus
                />
              </label>
            )}
            <div className="modal-actions">
              <button className="btn sm" onClick={() => settle({ ok: false })}>
                {t('common.cancel')}
              </button>
              <button
                ref={acceptRef}
                className={request.danger ? 'btn bad sm' : 'btn pri sm'}
                disabled={blocked}
                onClick={() => settle({ ok: true, reason: reason.trim() || undefined })}
              >
                {request.confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext)
  if (!ask) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>')
  }
  return ask
}
