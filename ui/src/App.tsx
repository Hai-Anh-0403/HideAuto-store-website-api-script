import { Route, Routes } from 'react-router-dom'
import { useI18n } from './i18n'
import { AppShell } from './layout/AppShell'
import { Keys } from './pages/Keys'
import { Login } from './pages/Login'
import { Members } from './pages/Members'
import { MiniAppDetail } from './pages/MiniAppDetail'
import { MiniApps } from './pages/MiniApps'
import { Overview } from './pages/Overview'
import { Profile } from './pages/Profile'
import { useAuth } from './store/auth'

export function App() {
  const { seller, ready } = useAuth()
  const { t } = useI18n()

  if (!ready) return <div className="state">{t('common.loadingShort')}</div>
  if (!seller) return <Login />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="mini-apps" element={<MiniApps />} />
        <Route path="mini-apps/:id" element={<MiniAppDetail />} />
        <Route path="keys" element={<Keys />} />
        <Route path="members" element={<Members />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Overview />} />
      </Route>
    </Routes>
  )
}
