import { BackToTop } from '@/shared/ui/back-to-top'
import '@/styles/store/base.css'
import '@/styles/store/layout.css'
import '@/styles/store/hero.css'
import '@/styles/store/catalog.css'
import '@/styles/store/script-detail.css'
import '@/styles/store/developers.css'
import '@/styles/store/legal.css'
import '@/styles/store/ad-slot.css'
import '@/styles/store/responsive.css'

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BackToTop />
    </>
  )
}

