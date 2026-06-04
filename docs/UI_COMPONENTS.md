# UI Components — `@workflo/ui` (design core)

> Жива дока компонентів дизайн-системи. **Single source of truth для коду UI.**
> Пов'язано: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) (токени/екрани/§7 workflow-gate) ·
> [`FRONTEND_STANDARDS.md`](FRONTEND_STANDARDS.md) (патерни застосунків).

## Що це

`packages/ui` — ядро дизайн-системи: **токени + типовані React-компоненти** поверх
портованого дизайн-CSS («Engineer's Cut», термінальна естетика). Будуємо
**component-first**: спершу правильне ядро з докою, далі перевикористовуємо на екранах
(Portal, Workspace, Landing).

## Storybook (жива документація)

```bash
pnpm --filter @workflo/ui storybook        # dev на http://localhost:6006
pnpm --filter @workflo/ui build-storybook   # статична збірка (storybook-static/)
```

У тулбарі — перемикачі **Theme** (light/dark), **Accent** (6 пресетів) і **Aesthetic**
(A · Terminal / B · Studio). Кожен компонент має `autodocs` (таблиця props із TS + JSDoc)
та сторінку **Foundations/Overview** (кольори, типографіка, accent-пресети).

## Архітектура стилів

Усе під класом-скоупом **`.wfp-root`** (його рендерить `ThemeProvider`).

| Файл                        | Роль                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/styles/tokens.css`     | `--wf-*` токени (light + `[data-theme=dark]`), re-scoped на `.wfp-root`                         |
| `src/styles/product.css`    | **vendored** — копія `design/project/product-styles.css` (класи `.wfp-*`). Не редагувати руками |
| `src/styles/polish.css`     | **vendored** — копія `design/project/polish.css` (elevation/skeletons)                          |
| `src/styles/components.css` | **наш** шар: стани/варіанти, яких дизайн-CSS не визначив (button loading/lg/link/block)         |
| `src/styles/index.css`      | єдиний вхід → `import '@workflo/ui/styles.css'`                                                 |

**Accent** застосовується в рантаймі `ThemeProvider`-ом як inline `--wf-accent/-bg/-soft`
(пресети — `ACCENT_PRESETS`, дзеркало `product-shell.jsx`). Re-sync vendored-CSS із
`design/` — лише свідомо (`cp`), не ручним редагуванням.

## Воркфлоу нового компонента (повторюваний)

1. **Знайди в дизайні** — звір клас(и) `.wfp-*` у `design/project/product-styles.css` + екран у `DESIGN_SYSTEM.md §5`.
2. **Компонент** — `src/components/X.tsx`: типована обгортка над `.wfp-*` класами. Колір/розміри **лише через токени `--wf-*`**, ніколи не хардкодь hex. Розширення станів, яких нема в дизайн-CSS, — у `components.css`.
3. **Інтерактивний?** — додай директиву `'use client'` (для Next-консюмера landing).
4. **Story** — `X.stories.tsx` з `tags: ['autodocs']`: усі варіанти × розміри × **стани** (default/hover/loading/disabled/empty/error — що застосовно).
5. **Тест** — `X.test.tsx` (Vitest + RTL): рендер, ключова поведінка, a11y-роль.
6. **Експорт** — додай у `src/index.ts`.
7. **Reuse** — споживай з застосунків через `@workflo/ui`.

## Конвенції

- **Токени-only**: акцент через `var(--wf-accent|-bg|-soft)`, поверхні/текст через `--wf-*`. Без хардкоду hex.
- **Імпорти** — NodeNext, відносні з розширенням `.js` (напр. `'./Button.js'`).
- **Компоненти НЕ імпортують CSS** — стилі глобальні через `@workflo/ui/styles.css`. Класи передаються рядком.
- **Усі стани обов'язкові** перед мерджем (DESIGN_SYSTEM §7): empty/loading/error + light & dark.
- `forwardRef` для елементів-обгорток; прокидай нативні HTML-атрибути.

## Споживання із застосунку

```tsx
import '@workflo/ui/styles.css' // один раз, у точці входу
import { ThemeProvider, Button } from '@workflo/ui'

export function App() {
  return (
    <ThemeProvider defaultTheme="system" defaultAccent="lime">
      {/* ThemeProvider рендерить .wfp-root scope */}
      <Button variant="primary" onClick={save}>
        Зберегти
      </Button>
    </ThemeProvider>
  )
}
```

Термінальна естетика (брекети `[ ]` на кнопках) вмикається класом `.wfp-aesA` на shell
(додасться в AppShell, Фаза B).

## Перевірка пакета

```bash
pnpm --filter @workflo/ui type-check   # tsc, включно зі stories/tests
pnpm --filter @workflo/ui lint
pnpm --filter @workflo/ui test          # Vitest + RTL
pnpm --filter @workflo/ui build         # tsc → dist (stories/tests виключені)
pnpm --filter @workflo/ui build-storybook
```

## Стан

**Фаза A+B ✅ — ядро готове** (кожен компонент = wrapper + Storybook-story + тест; **30 тестів**):

- **Примітиви:** `Button` · `Input` · `Badge` · `StatusDot` · `Card` · `EmptyState` · `Skeleton` · `Avatar` (+`AvatarStack`) · `Modal` · `Tabs`.
- **Shell:** `Icon` · `Sidebar` (config-driven) · `Topbar` · `AppShell` (термінал-вікно, aesA/B) · `AuthShell` (+`AuthHeader`/`AuthStatus`).
- **Foundation:** токени (light/dark + 6 accent-пресетів) · `ThemeProvider` · `useTheme`/`useMediaQuery`/`useDebounce` · Storybook (a11y, autodocs, Foundations, тулбар theme/accent/aesthetic).

**Фаза C 🔄 — екрани Portal (reuse).** C1 ✅: wiring (`apps/portal/src/lib/api.ts` Bearer+401-refresh, `lib/sse.ts` fetch-SSE, `queryClient`, `AuthContext`, `ProtectedRoute`, router, i18n) + робочий `/login`. Далі: register/forgot/reset → `/orders` → `/orders/:id` (чат-SSE + файли + activity).

**Свідомо НЕ будуємо (нема в дизайн-CSS):** `Table` — коли знадобиться екрану (S10); generic `Tabs`/`Toast` — ні (`Tabs` зробимо в order-detail; `Toast` = Sonner). Button-варіанти обмежені дизайном (`primary/secondary/ghost/danger`, `sm/md`) — без спекулятивних.
