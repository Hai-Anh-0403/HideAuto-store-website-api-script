import { Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { Keys } from './pages/Keys'
import { Members } from './pages/Members'
import { MiniAppDetail } from './pages/MiniAppDetail'
import { MiniApps } from './pages/MiniApps'
import { Overview } from './pages/Overview'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="mini-apps" element={<MiniApps />} />
        <Route path="mini-apps/:id" element={<MiniAppDetail />} />
        <Route path="keys" element={<Keys />} />
        <Route path="members" element={<Members />} />
      </Route>
    </Routes>
  )
}
