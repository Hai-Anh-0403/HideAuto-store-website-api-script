import { useLocation } from 'react-router-dom'
import { Pill } from '../ui/Pill'
import { useI18n, type MessageKey } from '../i18n'
import { sellerStatus } from '../lib/pills'
import { useAuth } from '../store/auth'
import { useTheme } from '../theme/ThemeProvider'
import styles from './Topbar.module.css'

function titleKeyFor(pathname: string): MessageKey | null {
  if (pathname === '/') return 'nav.overview'
  if (pathname.startsWith('/mini-apps/')) return 'topbar.detail'
  if (pathname.startsWith('/mini-apps')) return 'nav.miniApps'
  if (pathname.startsWith('/keys')) return 'nav.keys'
  if (pathname.startsWith('/members')) return 'nav.members'
  return null
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const THEME_ICON = { system: '◐', light: '☀', dark: '☾' } as const

export function Topbar() {
  const { pathname } = useLocation()
  const { mode, cycle } = useTheme()
  const { seller, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const status = seller ? sellerStatus[seller.status] : null
  const titleKey = titleKeyFor(pathname)

  return (
    <header className={styles.top}>
      <div>
        <div className={styles.crumb}>
          <b>{t('topbar.crumb')}</b> · storeAutoHide
        </div>
        <h1 className={styles.title}>{titleKey ? t(titleKey) : ''}</h1>
      </div>
      <div className="sp" />
      {status && <Pill tone={status.tone}>{t(status.key)}</Pill>}
      <div className={styles.who}>
        <span className={styles.av}>{initials(seller?.name ?? '?')}</span>
        {seller?.name}
      </div>
      <button
        className={styles.icobtn}
        onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
        title={t('topbar.language')}
      >
        {lang === 'vi' ? 'VI' : 'EN'}
      </button>
      <button className={styles.icobtn} onClick={cycle} title={t('topbar.theme')}>
        {THEME_ICON[mode]}
      </button>
      <button className="btn sm" onClick={logout}>
        {t('topbar.logout')}
      </button>
    </header>
  )
}
