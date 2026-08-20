'use client'

import { useEffect } from 'react'
import { useI18n } from '@/i18n'

/**
 * Keep `<html lang>` honest.
 *
 * The locale lives in localStorage, so the server cannot know it and the document ships
 * with `lang="vi"`. Leaving that wrong matters beyond tidiness: screen readers pick a
 * voice from it, and browsers offer to translate a page whose declared language is not
 * the one on screen.
 */
export function HtmlLang() {
  const { locale } = useI18n()

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}
