# ADR-007: SaaS Foundation Order & RLS Strategy

**Статус:** Прийнято · **Дата:** 1 червня 2026

> **Реалізовано (foundation closure 2.06.2026):** F4 RLS-політики + FORCE RLS + `workflo_app`-роль (міграція `20260603_f4_rls_policies`) + `$extends` tenant-context, flag-gated `RLS_ENFORCED` (commit a68be2d); S-D2/S-D3 schema-scoping реалізовано (`20260602_sd234`). Activation-checklist → `ENGINEERING_STANDARDS.md` §«RLS rollout».

**Контекст:** Перехід на SaaS планується «у кінці» (після прод-релізу для власної агенції). Питання: чи це безпечно без переписування, і що саме закласти ЗАРАЗ vs відкласти. Зводить розкидане з ADR-004 amendment + SAAS.md F1-F6 в одне рішення про порядок і про модель ізоляції.

---

## Рішення

**SaaS у кінці можливий без переписування** — за умови, що ЗАРАЗ доскладемо дві речі, які дорожчають критично з ростом (бо змінюють форму кожного запиту / схему живої БД). Решта F/E відкладається безпечно.

### Модель ізоляції тенантів

**Shared-DB + app-level scoping (primary) + Postgres RLS (belt-and-suspenders).**

- Primary guard (вже діє): `assertSameTenant` + loader'и (`requireOrderParticipant`/`requireTeamOrder`), `agencyId` зі сесії.
- **RLS — другий рубіж** перед першим зовнішнім тенантом: навіть забутий `where agencyId` фізично не поверне чужі рядки.
- Реалізація: **Prisma Client `$extends`**, що обгортає запити в interactive-tx і робить `SET LOCAL app.current_agency_id = <activeAgencyId>`; per-table `CREATE POLICY ... USING ("agencyId" = current_setting('app.current_agency_id'))`.
- **Альтернативи відкладено:** schema-per-tenant / DB-per-tenant — переглянути на 100+ тенантах або вимозі фізичної ізоляції (enterprise).

### Закласти ЗАРАЗ (поки роутів ~25)

1. **F4 — tenant-context/`$extends`-seam** (порожній: ставить GUC, політики додаємо per-table потім). **#1 пріоритет** — змінює ЯК виконується кожен запит; ретрофіт після 150+ роутів = археологія + ризик, що половина не в tx.
2. **S-D2 — `agencyId` на singleton-таблиці** `DocumentCounter`/`PaymentSettings`/`ExchangeRate`. `DocumentCounter @@id([type,year])` без agencyId = **наскрізна нумерація інвойсів між тенантами** (бухгалтерська/юридична катастрофа). Дешево на порожній таблиці; неможливо після виданих документів.
3. **S-D1 — `orders.agencyId` NOT NULL + FK RESTRICT** (backfill готовий із S1.6).
4. **F2 — quota-seam** `assertWithinQuota()` (no-op) у create-точках — увімкнути ліміти потім = тіло однієї функції, не 20 хендлерів.

### Відкласти (Enablement, поверх готової схеми, без міграції)

- E1 signup/onboarding агенції, E2 SaaS-підписка (Stripe/Paddle), E3 per-domain branding-рантайм, E4 quota-значення (PLAN_LIMITS), E5 super-admin, E6 tenant-lifecycle (suspend/export/delete), E7 flags/api/webhooks-UI.
- F5 tenant-rate-limit — частково (per-route post-auth ліміти — Phase 1; `BASE_DOMAIN`+wildcard subdomain — зафіксувати в інфра-доках зараз).
- Frontend-foundation (SAAS_CONFIG.md): `--wf-*` токени + host→tenant resolver + token-injection — **перший крок фронтенд-проходу** (єдиний дорогий UI-ретрофіт; доки UI немає — зафіксовано).

## Наслідки

- Перехід на SaaS = реалізація E-блоку як окремого пізнього спрінта, **без міграції даних** — якщо F4 + S-D1/D2 закладено.
- F4 — найдорожчий ретрофіт у SaaS-частині; зробити поки дешево.

## Звʼязок

ADR-004 (tenancy) + amendments · SAAS.md (F1-F6/E1-E7) · SAAS_CONFIG.md (white-label) · AUDIT_S0_S2 (T-D2/D3/D4, S-D1/D2).
