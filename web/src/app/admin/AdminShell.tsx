'use client'

import { ConfirmProvider } from '@/components/Confirm'
import { ToastProvider } from '@/components/Toast'

/**
 * The admin console is deliberately outside `/portal`.
 *
 * It authenticates against a different identity system (an admin JWT, kept in its own
 * storage slot) and must not inherit the seller shell's `AuthProvider`, which would bounce
 * an admin to the seller login screen.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="page-area" style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
          {children}
        </div>
      </ConfirmProvider>
    </ToastProvider>
  )
}
