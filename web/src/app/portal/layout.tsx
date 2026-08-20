import type { Metadata } from 'next'
import { PortalShell } from './PortalShell'

/**
 * A server layout that exists only to carry metadata: the shell itself is a client
 * component (it reads the token and the locale), and a client component cannot export
 * `metadata`.
 *
 * Everything under `/portal` is a seller's private data. `noindex` is what keeps a URL
 * that leaked into a chat message or a referrer log out of a search index — robots.txt
 * alone cannot, because it only asks a crawler not to fetch, not to forget.
 */
export const metadata: Metadata = {
  title: 'Portal',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>
}
