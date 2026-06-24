import { test, expect, type Page } from '@playwright/test'

/**
 * Seeded test accounts (packages/db/prisma/seed.ts). The smoke logs in as each app's
 * primary actor and visits the key implemented (≤ S5) screens.
 */
const CONFIG = {
  portal: {
    email: 'client@example.com',
    password: 'Client123!',
    pages: [
      ['/orders', /Замовлення/],
      ['/inbox', /Інбокс/],
      ['/billing', /Фінанси|Рахунки|Білінг/],
      ['/wallet', /Гаманець/],
      ['/loyalty', /Лояльність/],
      ['/referrals', /Реферал/],
      ['/team', /Учасники/],
      ['/settings', /Налаштування/],
    ],
  },
  workspace: {
    email: 'owner@workflo.space',
    password: 'Admin123!',
    pages: [
      ['/', /Огляд/],
      ['/inbox', /Інбокс/],
      ['/orders', /Замовлення/],
      ['/clients', /Клієнти/],
      ['/team', /Команда/],
      ['/billing', /Білінг|Фінанси/],
      ['/finance', /Фінанси/],
      ['/projects', /Фін-проєкти/],
      ['/margin', /Маржа/],
      ['/payouts', /Виплати/],
      ['/services', /Каталог послуг/],
      ['/admin-wallet', /Бонусні гаманці/],
      ['/profile', /Профіль/],
      ['/settings', /Налаштування/],
    ],
  },
} as const

// Console noise that isn't a real regression. "Failed to load resource" is the
// browser's URL-less echo of an HTTP error — we catch those with their URL+status
// via the response listener below instead, so the console copy is just a dup.
const BENIGN =
  /favicon|fonts\.g(static|oogleapis)|ResizeObserver loop|Download the React DevTools|Failed to load resource/i

// Static assets surface their own 404s through HMR/dev-server churn — not app health.
const ASSET = /\.(js|css|map|png|jpe?g|svg|ico|woff2?)(\?|$)/

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !BENIGN.test(m.text())) errors.push(`console.error: ${m.text()}`)
  })
  page.on('response', (r) => {
    const status = r.status()
    if (status < 400) return
    const url = r.url()
    if (ASSET.test(url)) return
    errors.push(`http ${status}: ${new URL(url).pathname}`)
  })
  return errors
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page, 'login should navigate off /login').not.toHaveURL(/\/login(\?|$)/, {
    timeout: 20_000,
  })
}

/**
 * Client-side (SPA) navigation — pushState + popstate so react-router changes route
 * WITHOUT a full page load. This keeps the in-memory access token alive: a hard
 * `goto()` would drop it and force /auth/refresh, which can't round-trip in the dev
 * proxy (the refresh cookie is Path=/auth/refresh but the SPA hits /api/auth/refresh,
 * so the browser never sends it). Real users navigate this way too, so the smoke
 * exercises the genuine route-mount + data-fetch path on every page.
 */
async function gotoInApp(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}(\\?|$)`), { timeout: 10_000 })
}

test.describe('smoke', () => {
  test('login + key pages render without crashes', async ({ page }, info) => {
    const cfg = CONFIG[info.project.name as keyof typeof CONFIG]
    const errors = watchErrors(page)

    await login(page, cfg.email, cfg.password)
    // Drop bootstrap noise: before auth, the app fires a protected fetch + /auth/refresh
    // that both 401 by design (no session yet). Login correctness is already asserted in
    // login(); from here every error is a post-login regression.
    errors.length = 0

    for (const [path, heading] of cfg.pages) {
      await test.step(`${info.project.name} ${path}`, async () => {
        await gotoInApp(page, path)
        // The page-specific heading must render (proves the route mounted + data resolved
        // enough to paint the shell, not the 404 / error EmptyState).
        await expect(
          page.getByText(heading as RegExp).first(),
          `heading for ${path}`
        ).toBeVisible()
        await page.screenshot({
          path: `screenshots/${info.project.name}${path === '/' ? '/_home' : path}.png`,
          fullPage: true,
        })
      })
    }

    // Portal-only: client saves their company legal requisites (another form submit).
    if (info.project.name === 'portal') {
      await test.step('portal /settings → save company requisites', async () => {
        await gotoInApp(page, '/settings')
        await page.getByLabel('Юридична назва').fill('ТОВ Смоук Клієнт')
        await page.getByRole('button', { name: 'Зберегти реквізити' }).first().click()
        await expect(page.getByText('Реквізити збережено')).toBeVisible()
        await page.screenshot({
          path: 'screenshots/portal/_settings-requisites.png',
          fullPage: true,
        })
      })

      await test.step('portal create order', async () => {
        await gotoInApp(page, '/orders/new')
        await page.getByLabel('Назва').fill('Smoke замовлення з порталу')
        await page.getByRole('button', { name: 'Створити замовлення' }).first().click()
        await expect(page, 'should land on the new order').toHaveURL(/\/orders\/[0-9a-f-]{8,}/)
        await page.screenshot({ path: 'screenshots/portal/_order-create.png', fullPage: true })
      })
    }

    // Workspace-only: actually SUBMIT a form (create a legal entity) — guards the
    // contract class that page-visits can't see (e.g. the createExpenseSchema null-400
    // that shipped because nothing exercised a submit). The DB is re-seeded per run
    // (scripts/e2e.sh), so the name is deterministic and collision-free.
    if (info.project.name === 'workspace') {
      await test.step('workspace /settings → create legal entity', async () => {
        await gotoInApp(page, '/settings')
        await page.getByRole('button', { name: '+ Додати юр-особу' }).click()
        // Scope to the dialog: buttons render with bracket decoration ("[ Додати ]"),
        // and "+ Додати юр-особу" also contains "Додати" — the dialog disambiguates.
        const dialog = page.getByRole('dialog')
        await dialog.getByLabel('Назва (внутрішня)').fill('Smoke ФОП')
        await dialog.getByLabel('Юридична назва').fill('ФОП Тестовий Смоук')
        await dialog.getByRole('button', { name: 'Додати' }).click()
        // Modal closes + list refetches → the new row renders (proves POST 201 + re-fetch).
        await expect(page.getByText('Smoke ФОП')).toBeVisible()
        await page.screenshot({
          path: 'screenshots/workspace/_settings-legal-entity.png',
          fullPage: true,
        })
      })

      await test.step('workspace /projects → open a project detail', async () => {
        await gotoInApp(page, '/projects')
        // Project rows carry the price ("…/міс USD" | "…/год USD") — unique to a row.
        await page
          .locator('button', { hasText: /\/(міс|год)/ })
          .first()
          .click()
        await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{8,}/)
        await expect(page.getByText('Юр-особа').first()).toBeVisible()
        await page.screenshot({ path: 'screenshots/workspace/_project-detail.png', fullPage: true })
      })

      await test.step('workspace /orders → timeline view', async () => {
        await gotoInApp(page, '/orders')
        await page.getByRole('button', { name: 'Таймлайн' }).click()
        await expect(page.getByRole('heading', { name: 'Замовлення' })).toBeVisible()
        await page.screenshot({ path: 'screenshots/workspace/_orders-timeline.png', fullPage: true })
      })

      await test.step('workspace order detail: tabs + generate a document (D1/D3)', async () => {
        // Open an order via the timeline rows (they carry the seed client name).
        await page.getByRole('button', { name: /ТОВ Тестова Компанія/ }).first().click()
        await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{8,}/)
        await expect(page.getByRole('tab', { name: 'Час' })).toBeVisible()
        // «Задачі» tab was removed (design has no per-order task kanban).
        await expect(page.getByRole('tab', { name: 'Задачі' })).toHaveCount(0)
        // Documents tab → generate an invoice → it lands with a per-agency number (INV-YYYY-NNNNNN).
        await page.getByRole('tab', { name: 'Документи' }).click()
        await page.getByRole('button', { name: /Рахунок/ }).first().click()
        await expect(page.getByText(/INV-\d{4}-\d{6}/).first()).toBeVisible({ timeout: 10000 })
        // Click the number → renders the document (PDF, or HTML fallback when no Chromium) in a tab.
        const [docView] = await Promise.all([
          page.waitForEvent('popup'),
          page.getByRole('button', { name: /INV-\d{4}-\d{6}/ }).first().click(),
        ])
        await docView.waitForLoadState('domcontentloaded')
        await docView.close()
        await page.screenshot({ path: 'screenshots/workspace/_order-detail.png', fullPage: true })
      })

      await test.step('workspace /margin → executors tab', async () => {
        await gotoInApp(page, '/margin')
        await page.getByRole('tab', { name: 'За виконавцями' }).click()
        await expect(page.getByText('Маржа').first()).toBeVisible()
        await page.screenshot({ path: 'screenshots/workspace/_margin-executors.png', fullPage: true })
      })

      await test.step('workspace create order (modal)', async () => {
        await gotoInApp(page, '/orders')
        await page.getByRole('button', { name: 'Нове замовлення' }).first().click()
        const dialog = page.getByRole('dialog')
        await dialog.getByLabel('Назва').fill('Smoke замовлення з workspace')
        await dialog.getByRole('button', { name: 'Створити' }).click()
        await expect(page, 'should land on the new order').toHaveURL(/\/orders\/[0-9a-f-]{8,}/)
        // The new order is NEW → estimate editor is visible. Set a fixed price (form-submit smoke
        // for the estimate slice; catches any null/contract regression on PATCH /orders/:id).
        await page.getByLabel(/Сума/).fill('1500')
        await page.getByRole('button', { name: 'Зберегти оцінку' }).click()
        await expect(page.getByText(/надіслати на погодження|Оцінку збережено/)).toBeVisible()
        await page.screenshot({ path: 'screenshots/workspace/_order-create.png', fullPage: true })
      })

      await test.step('workspace /clients → open a client 360', async () => {
        await gotoInApp(page, '/clients')
        // Client rows are role=button → navigate to /clients/:id.
        await page.locator('[role="button"]').filter({ hasText: /ТОВ|Компан/ }).first().click()
        await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{8,}/)
        await expect(page.getByText(/усього замовлень/i).first()).toBeVisible()
        await page.screenshot({ path: 'screenshots/workspace/_client-detail.png', fullPage: true })
      })
    }

    expect(errors, `uncaught/console errors:\n${errors.join('\n')}`).toEqual([])
  })
})
