import type { Metadata } from 'next'
import '@/styles/store/base.css'

/**
 * The one page a stranger can actually reach, so it is the one that gets a real
 * description and link preview. Everything past it is `noindex`.
 */
export const metadata: Metadata = {
  title: 'Đăng nhập',
  description:
    'Đăng nhập hoặc đăng ký tài khoản seller Store-HideAuto để đăng mini app automation ' +
    'cho hideflow, phát khoá kích hoạt và quản lý người mua.',
  alternates: { canonical: '/login' },
  // Next replaces the root `openGraph` wholesale rather than merging it, so `type` and
  // `siteName` have to be repeated here or the tags simply vanish on this page.
  openGraph: {
    type: 'website',
    siteName: 'Store-HideAuto',
    title: 'Đăng nhập · Store-HideAuto',
    description: 'Cổng seller — bán mini app automation cho hideflow.',
    url: '/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
