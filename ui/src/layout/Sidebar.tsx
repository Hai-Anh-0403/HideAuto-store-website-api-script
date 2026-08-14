import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/', label: 'Tổng quan', icon: '📊', end: true },
  { to: '/mini-apps', label: 'Mini app của tôi', icon: '🧩', end: false },
  { to: '/keys', label: 'Khóa kích hoạt', icon: '🔑', end: false },
  { to: '/members', label: 'Người dùng của tôi', icon: '👥', end: false },
]

export function Sidebar() {
  return (
    <aside className={styles.side}>
      <div className={styles.brand}>
        <div className={styles.logo}>S</div>
        <div>
          <b>storeAutoHide</b>
          <span>mini app store</span>
        </div>
      </div>
      <div className={styles.navlabel}>Cửa hàng của tôi</div>
      <nav className={styles.navgroup}>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? `${styles.nav} ${styles.active}` : styles.nav)}
          >
            <span className={styles.ic}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.foot}>Bản demo UI — dữ liệu mẫu.</div>
    </aside>
  )
}
