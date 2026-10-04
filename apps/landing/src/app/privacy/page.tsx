import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Політика конфіденційності — workflo.space',
  description: 'Які дані збирає workflo.space, навіщо й як вони захищені. Без рекламних трекерів.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />
}
