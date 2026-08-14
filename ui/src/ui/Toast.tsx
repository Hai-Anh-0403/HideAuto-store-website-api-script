import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import styles from './Toast.module.css'

interface ToastValue {
  toast: (msg: string) => void
}

const ToastCtx = createContext<ToastValue | null>(null)
let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([])

  const toast = useCallback((msg: string) => {
    const id = ++counter
    setItems((x) => [...x, { id, msg }])
    window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2600)
  }, [])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className={styles.wrap}>
        {items.map((i) => (
          <div key={i.id} className={styles.toast}>
            <span className={styles.tick}>✓</span>
            {i.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
