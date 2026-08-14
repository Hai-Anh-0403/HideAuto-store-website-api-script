import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styles from './AppShell.module.css'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  // Điều hướng xong thì đóng drawer, và Esc luôn đóng được.
  useEffect(() => setNavOpen(false), [pathname])
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className={styles.app}>
      <Sidebar open={navOpen} />
      {navOpen && <div className={styles.scrim} onClick={() => setNavOpen(false)} aria-hidden />}
      <div className={styles.main}>
        <Topbar navOpen={navOpen} onToggleNav={() => setNavOpen((v) => !v)} />
        <div className={styles.wrap}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
