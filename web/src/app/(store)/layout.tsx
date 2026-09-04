import { BackToTop } from '@/shared/ui/back-to-top'
import './storefront.css'

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BackToTop />
    </>
  )
}
