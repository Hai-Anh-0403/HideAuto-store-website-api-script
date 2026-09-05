import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import { HtmlLang } from '@/components/HtmlLang'
import { I18nProvider, type Locale } from '@/i18n'
import '@/styles/global.css'

/**
 * `metadataBase` resolves the relative OG/icon URLs below into absolute ones, which is
 * what link previews need. It has no sensible default at build time — set
 * `NEXT_PUBLIC_SITE_URL` for a real deployment; localhost is only right on a laptop.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Store-HideAuto',
    // Pages set the leaf; the brand is appended once, here, instead of in every title.
    template: '%s · Store-HideAuto',
  },
  description:
    'Cổng seller của Store-HideAuto: đăng mini app automation cho hideflow, phát khoá ' +
    'kích hoạt và quản lý người mua.',
  applicationName: 'Store-HideAuto',
  icons: {
    icon: '/images/icon.png',
    shortcut: '/images/icon.png',
    apple: '/images/icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Store-HideAuto',
    title: 'Store-HideAuto',
    description: 'Cổng seller — bán mini app automation cho hideflow.',
    url: '/',
  },
  twitter: { card: 'summary' },
  // Only `/` and `/login` are public; `portal/` and `admin/` opt out in their own layouts.
  robots: { index: true, follow: true },
  // Phone-number autolinking mangles key codes and version strings on iOS.
  formatDetection: { telephone: false, date: false, address: false, email: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches --bg-base in tokens.css for each scheme, so the browser chrome does not
  // flash the wrong colour before the stylesheet lands.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1117' },
  ],
  colorScheme: 'dark light',
}

// Applied before paint so a saved theme never flashes the default first. Kept in
// lockstep with `src/lib/display.ts` (same keys, same allowed values).
const applyDisplayPrefs = `(function(){try{var e=document.documentElement,t=localStorage.getItem('ui.theme');if(t==='light'||t==='dark')e.setAttribute('data-theme',t);}catch(_){}})();`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const rawLocale = cookieStore.get('locale')?.value
  const initialLocale: Locale = rawLocale === 'en' ? 'en' : 'vi'

  return (
    <html
      lang={initialLocale}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: applyDisplayPrefs }} />
        <I18nProvider initialLocale={initialLocale}>
          <HtmlLang />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
