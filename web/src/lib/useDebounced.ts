'use client'

import { useEffect, useState } from 'react'

/**
 * The value, but only after it has stopped changing for `delay` ms.
 *
 * Search boxes key their `useFetch` on what you typed, so every keystroke used to fire its
 * own request and swap the table underneath the cursor. Debouncing the *query* — never the
 * input itself — keeps typing instant while the list settles once.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    if (value === settled) return
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, settled, delay])

  return settled
}
