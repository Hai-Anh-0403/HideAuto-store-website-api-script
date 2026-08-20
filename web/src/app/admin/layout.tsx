import type { Metadata } from 'next'
import { AdminShell } from './AdminShell'

/**
 * Server wrapper around the client shell, so the admin console can declare metadata.
 *
 * `noindex` matters more here than anywhere else: this route lists pending sellers and
 * the credential scan of every submitted version.
 */
export const metadata: Metadata = {
  title: 'Admin',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
