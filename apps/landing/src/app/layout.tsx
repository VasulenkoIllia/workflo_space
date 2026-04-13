import type { ReactNode } from 'react'

export const metadata = {
  title: 'Workflo Landing',
  description: 'Workflo service landing page',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  )
}
