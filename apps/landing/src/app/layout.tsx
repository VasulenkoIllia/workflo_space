import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@/styles/terminal.css'
import '@/styles/pages.css'
import { UtmCapture } from '@/components/UtmCapture'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://workflo.space'),
  title: 'workflo.space — автоматизації для команд, що виросли з Excel',
  description:
    'Ілля з Луцька будує автоматизації для команд, що виросли з Excel. Telegram-боти, AI-агенти, інтеграції, кастомні CRM. 6 років у продуктовій розробці.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'workflo.space — автоматизації для команд',
    description:
      'Будую Telegram-ботів, AI-агентів, внутрішні портали та інтеграції. Луцьк · Україна.',
    type: 'website',
    locale: 'uk_UA',
    siteName: 'workflo.space',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'workflo.space — автоматизації для команд',
    description:
      'Будую Telegram-ботів, AI-агентів, внутрішні портали та інтеграції. Луцьк · Україна.',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body style={{ margin: 0, background: '#fafaf9' }}>
        <UtmCapture />
        {children}
      </body>
    </html>
  )
}
