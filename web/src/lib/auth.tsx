'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { Seller, Token } from '@/types'

interface AuthState {
  seller: Seller | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  refresh: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [seller, setSeller] = useState<Seller | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setSeller(null)
    router.push('/login')
  }, [router])

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<Seller>('/sellers/me')
      setSeller(me)
    } catch {
      setToken(null)
      setTokenState(null)
      setSeller(null)
    }
  }, [])

  const refresh = useCallback(() => {
    void fetchMe()
  }, [fetchMe])

  // Restore the session from localStorage after mount. The work is deferred into a
  // promise so the state updates land together in one pass instead of cascading
  // renders straight out of the effect body.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    let alive = true

    void (async () => {
      const stored = getToken()
      if (stored) {
        await fetchMe()
        if (alive) setTokenState(stored)
      }
      if (alive) setLoading(false)
    })()

    return () => {
      alive = false
      setUnauthorizedHandler(null)
    }
  }, [fetchMe, logout])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<Token>('/auth/login', { email, password })
      setToken(data.access_token)
      setTokenState(data.access_token)
      await fetchMe()
      router.push('/portal/overview')
    },
    [fetchMe, router],
  )

  // `/auth/register` signs the new seller straight in, so it returns a token like login
  // does — there is no Seller in the response.
  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const data = await api.post<Token>('/auth/register', { email, password, name })
      setToken(data.access_token)
      setTokenState(data.access_token)
      await fetchMe()
      router.push('/portal/overview')
    },
    [fetchMe, router],
  )

  return (
    <AuthContext.Provider value={{ seller, token, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
