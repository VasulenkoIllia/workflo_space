// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, …)
// and augments vitest's `expect` types. Loaded via vitest.config setupFiles.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// We run without vitest globals, so RTL's auto-cleanup is not wired — do it explicitly
// to unmount between tests (otherwise renders accumulate in the jsdom document).
afterEach(() => {
  cleanup()
})
