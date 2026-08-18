'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

interface Loaded<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

interface Settled<T> {
  data: T | null
  error: string | null
  /** The request token this result belongs to; null until the first one settles. */
  token: string | null
}

/**
 * Fetch on `key` change, and on `reload()`.
 *
 * `loading` is derived, not stored: it's simply "the settled result is for an older
 * request than the one we're asking for now". That keeps the effect free of a
 * synchronous setState, which would otherwise cascade an extra render on every key change.
 */
export function useFetch<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [nonce, setNonce] = useState(0)
  const [settled, setSettled] = useState<Settled<T>>({
    data: null,
    error: null,
    token: null,
  })
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const token = `${key}#${nonce}`

  useEffect(() => {
    let alive = true
    load()
      .then((data) => {
        if (alive) setSettled({ data, error: null, token })
      })
      .catch((err: unknown) => {
        // Keep the previous data on screen; only the error is new.
        if (alive) {
          setSettled((prev) => ({
            data: prev.data,
            error: err instanceof ApiError ? err.message : 'API error',
            token,
          }))
        }
      })
    return () => {
      alive = false
    }
    // `load` is intentionally excluded: `key` is the identity of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return {
    data: settled.data,
    error: settled.error,
    loading: settled.token !== token,
    reload,
  }
}
