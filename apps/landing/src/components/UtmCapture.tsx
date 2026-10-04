'use client'

import { useEffect } from 'react'
import { captureUtm } from '@/lib/utm'

/** Invisible mount in the root layout — records first-touch UTM/referrer per tab (26-UTM). */
export function UtmCapture() {
  useEffect(() => {
    captureUtm()
  }, [])
  return null
}
