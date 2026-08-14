import { useCallback } from 'react'
import { ApiError } from './api'
import { useI18n, type MessageKey } from '../i18n'

/** Đổi lỗi bất kỳ thành câu tiếng người: ưu tiên bản dịch theo `code` của API. */
export function useErrorText(): (err: unknown, fallback?: MessageKey) => string {
  const { t, tryT } = useI18n()
  return useCallback(
    (err: unknown, fallback: MessageKey = 'common.actionFailed') => {
      if (!(err instanceof ApiError)) return t(fallback)
      // Không có bản dịch cho code này thì dùng nguyên văn từ API (tiếng Anh).
      return err.code ? tryT(`errors.${err.code}`, err.message) : err.message
    },
    [t, tryT],
  )
}
