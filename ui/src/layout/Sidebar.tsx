import { NavLink } from 'react-router-dom'
import { BrandLogo } from '../ui/Brand'
import { useI18n, type MessageKey } from '../i18n'
import styles from './Sidebar.module.css'

const NAV: { to: string; key: MessageKey; icon: string; end: boolean }[] = [
  { to: '/', key: 'nav.overview', icon: '📊', end: true },
  { to: '/mini-apps', key: 'nav.miniApps', icon: '🧩', end: false },
  { to: '/keys', key: 'nav.keys', icon: '🔑', end: false },
  { to: '/members', key: 'nav.members', icon: '👥', end: false },
  { to: '/profile', key: 'nav.profile', icon: '⚙', end: false },
]

export function Sidebar({ open = false }: { open?: boolean }) {
  const { t } = useI18n()
  return (
    <aside className={open ? `${styles.side} ${styles.open}` : styles.side}>
      <div className={styles.brand}>
        <BrandLogo size={28} />
        <div>
          <b>storeAutoHide</b>
          <span>{t('nav.tagline')}</span>
        </div>
      </div>
      <div className={styles.navlabel}>{t('nav.group')}</div>
      <nav className={styles.navgroup}>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? `${styles.nav} ${styles.active}` : styles.nav)}
          >
            <span className={styles.ic}>{n.icon}</span>
            {t(n.key)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
