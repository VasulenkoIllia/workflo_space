'use client'

import { useEffect } from 'react'

/**
 * DSN-9: коренева розмітка одна (lang="uk"); для /en виставляємо <html lang="en"> на клієнті
 * (скрінрідери, переклад браузера). Для ботів мова — у hreflang і <div lang="en">.
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const prev = document.documentElement.lang
    document.documentElement.lang = lang
    return () => {
      document.documentElement.lang = prev
    }
  }, [lang])
  return null
}
