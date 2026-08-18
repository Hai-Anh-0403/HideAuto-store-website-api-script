'use client'

import { useCallback } from 'react'
import { ApiError } from './api'
import { useI18n } from '@/i18n'

/** Turn any error into a human-readable string, preferring translated error codes from the API. */
export function useErrorText(): (err: unknown, fallback?: string) => string {
  const { t, tryT } = useI18n()
  return useCallback(
    (err: unknown, fallback: string = 'common.actionFailed') => {
      if (!(err instanceof ApiError)) return t(fallback)
      return err.code ? tryT(`errors.${err.code}`, err.message) : err.message
    },
    [t, tryT],
  )
}
