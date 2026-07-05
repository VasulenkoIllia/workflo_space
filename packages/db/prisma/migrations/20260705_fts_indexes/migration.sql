-- S11-01 (модуль 16): full-text пошук — expression-GIN індекси (конфіг 'simple':
-- безсловниковий lowercase-токенізатор, чесний для змішаної uk/en лексики; словниковий
-- 'ukrainian' у стоковому PG відсутній). Expression-індекси не входять у Prisma-датамодель
-- (drift-гейт їх не бачить) — запит у routes/search.ts використовує ті САМІ вирази.

BEGIN;

CREATE INDEX IF NOT EXISTS "orders_fts_idx" ON "orders"
  USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

CREATE INDEX IF NOT EXISTS "companies_fts_idx" ON "companies"
  USING GIN (to_tsvector('simple', coalesce("name", '')));

CREATE INDEX IF NOT EXISTS "leads_fts_idx" ON "leads"
  USING GIN (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("contactName", '') || ' ' || coalesce("email", '')));

CREATE INDEX IF NOT EXISTS "projects_fts_idx" ON "projects"
  USING GIN (to_tsvector('simple', coalesce("name", '')));

COMMIT;
