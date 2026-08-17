import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api, getToken, setToken, setUnauthorizedHandler } from '../lib/api'
import type { Seller, Token } from '../types'

interface AuthValue {
  seller: Seller | null
  /** null while the stored token is still being checked on boot. */
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<Seller>
  logout: () => void
  refresh: () => void
}

const AuthCtx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [seller, setSeller] = useState<Seller | null>(null)
  const [ready, setReady] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!getToken()) {
      setSeller(null)
      setReady(true)
      return
    }
    let alive = true
    api
      .get<Seller>('/sellers/me')
      .then((me) => alive && setSeller(me))
      .catch((err: unknown) => {
        // A stale or foreign token is not worth keeping around.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setToken(null)
        if (alive) setSeller(null)
      })
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [nonce])

  const login = useCallback(async (email: string, password: string) => {
    const token = await api.post<Token>('/sellers/login', { email, password })
    setToken(token.access_token)
    setSeller(await api.get<Seller>('/sellers/me'))
  }, [])

  const register = useCallback(
    (email: string, password: string, name: string) =>
      api.post<Seller>('/sellers/register', { email, password, name }),
    [],
  )

  const logout = useCallback(() => {
    // Kết thúc phiên ở server để thiết bị này biến mất khỏi danh sách; token đã nằm
    // trong request rồi nên xoá ngay sau đó vẫn an toàn.
    void api.post('/sellers/logout').catch(() => {})
    setToken(null)
    setSeller(null)
  }, [])

  // Token chết giữa chừng (hết hạn, hoặc bị đăng xuất từ máy khác) thì về màn đăng nhập.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setSeller(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  const value = useMemo<AuthValue>(
    () => ({ seller, ready, login, register, logout, refresh }),
    [seller, ready, login, register, logout, refresh],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** The seller can only act once an admin approved the account. */
export function useApprovedSeller(): Seller | null {
  const { seller } = useAuth()
  return seller?.status === 'approved' ? seller : null
}
