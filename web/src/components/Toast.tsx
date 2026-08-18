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

interface ToastState {
  toast: (msg: string) => void
}

const ToastContext = createContext<ToastState>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([])
  // A ref, not a render-scoped variable: ids must stay unique for the life of the
  // provider, or a restarted counter would collide with a toast still on screen.
  const nextId = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const toast = useCallback((msg: string) => {
    const id = ++nextId.current
    setMessages((prev) => [...prev, { id, text: msg }])
    timers.current.push(
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id))
      }, 3000),
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {messages.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 16px',
                fontSize: 13,
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-3)',
                maxWidth: 360,
              }}
            >
              {m.text}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
