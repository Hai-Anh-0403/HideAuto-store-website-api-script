import { useLocation } from 'react-router-dom'
import { useTheme } from '../theme/ThemeProvider'
import styles from './Topbar.module.css'

function titleFor(pathname: string): string {
  if (pathname === '/') return 'Tổng quan'
  if (pathname.startsWith('/mini-apps/')) return 'Chi tiết mini app'
  if (pathname.startsWith('/mini-apps')) return 'Mini app của tôi'
  if (pathname.startsWith('/keys')) return 'Khóa kích hoạt'
  if (pathname.startsWith('/members')) return 'Người dùng của tôi'
  return ''
}

const THEME_ICON = { system: '◐', light: '☀', dark: '☾' } as const

export function Topbar() {
  const { pathname } = useLocation()
  const { mode, cycle } = useTheme()
  return (
    <header className={styles.top}>
      <div>
        <div className={styles.crumb}>
          <b>Seller</b> · storeAutoHide
        </div>
        <h1 className={styles.title}>{titleFor(pathname)}</h1>
      </div>
      <div className="sp" />
      <div className={styles.who}>
        <span className={styles.av}>AS</span>
        AutoHide Studio
      </div>
      <button className={styles.icobtn} onClick={cycle} title="Đổi giao diện sáng / tối / theo hệ thống">
        {THEME_ICON[mode]}
      </button>
    </header>
  )
}
