import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Умови надання послуг — workflo.space',
  description: 'Умови співпраці: порядок робіт, оплата, права на результат, гарантія.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return <LegalPage kind="terms" />
}
