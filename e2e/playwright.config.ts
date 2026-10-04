import { defineConfig } from '@playwright/test'

/**
 * Post-deploy smoke. Drives the two SPAs (portal + workspace) against a locally
 * orchestrated stack (see scripts/e2e.sh): real api + Postgres + seed. Catches the
 * "page crashed / key data missing / uncaught error" regression class that the
 * type/lint/unit gate can't see (there are no frontend unit tests).
 *
 * Each project pins a baseURL; the spec branches on `project.name`. The stack must
 * already be up (scripts/e2e.sh starts it) — no Playwright webServer, because a
 * multi-service stack with a DB is orchestrated more reliably by the script.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'off',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'portal', use: { baseURL: process.env.PORTAL_URL ?? 'http://localhost:3001' } },
    { name: 'workspace', use: { baseURL: process.env.WORKSPACE_URL ?? 'http://localhost:3002' } },
  ],
})
