#!/usr/bin/env bash
#
# Post-deploy smoke orchestrator. Brings up a real stack — Postgres + seeded
# data + api (dev) + both SPAs (vite dev) — runs the Playwright smoke against
# it, then tears everything down. Used locally and by the `smoke` CI job.
#
#   scripts/e2e.sh                # throwaway docker PG on :5440, full run
#   DATABASE_URL=... scripts/e2e.sh   # reuse an existing PG (CI service)
#   scripts/e2e.sh --project=portal   # extra args pass through to playwright
#
# Why dev servers (not the built SPAs): the dev proxy keeps /api same-origin on
# http://localhost, so the auth cookie is non-secure (NODE_ENV=development) and
# survives reloads/goto — which the smoke relies on. A prod nginx image would
# need https + a separate api origin, far more setup for no extra coverage.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

export NODE_ENV=development
export JWT_SECRET="${JWT_SECRET:-e2e-smoke-jwt-secret-please-rotate-0123456789}"
export API_PORT="${API_PORT:-4000}"
export API_HOST=127.0.0.1
export CORS_ALLOWED_ORIGINS="http://localhost:3001,http://localhost:3002"
# Quieter, deterministic logs from the background services.
export LOG_LEVEL="${LOG_LEVEL:-warn}"

LOGDIR="$ROOT/e2e/.logs"
mkdir -p "$LOGDIR"
PG_CONTAINER="workflo-e2e-pg"
# Dedicated port so the throwaway DB never collides with the dev compose stack
# (postgres-1 :5440) or other local Postgres instances.
E2E_PG_PORT="${E2E_PG_PORT:-5466}"
PG_STARTED=0
PIDS=()

log() { printf '\033[1;36m[e2e]\033[0m %s\n' "$*"; }

cleanup() {
  local code=$?
  log "teardown (exit $code)..."
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  # tsx/vite spawn children that outlive the parent PID — sweep by signature.
  pkill -f 'tsx watch src/index.ts' 2>/dev/null || true
  pkill -f 'vite --host --port 300' 2>/dev/null || true
  if [ "$PG_STARTED" = "1" ]; then docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true; fi
  exit $code
}
trap cleanup EXIT INT TERM

# Free the ports a previous half-dead run may still hold (best-effort).
for port in "$API_PORT" 3001 3002; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  [ -n "$pids" ] && { log "freeing port $port"; kill $pids 2>/dev/null || true; }
done

# ---------------------------------------------------------------------------
# 1. Database
# ---------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  log "starting throwaway Postgres ($PG_CONTAINER :$E2E_PG_PORT)"
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$PG_CONTAINER" \
    -e POSTGRES_USER=workflo -e POSTGRES_PASSWORD=workflo_e2e -e POSTGRES_DB=workflo_e2e \
    -p "$E2E_PG_PORT:5432" postgres:16-alpine >/dev/null
  PG_STARTED=1
  export DATABASE_URL="postgresql://workflo:workflo_e2e@localhost:$E2E_PG_PORT/workflo_e2e"
  for _ in $(seq 1 30); do
    docker exec "$PG_CONTAINER" pg_isready -U workflo -d workflo_e2e >/dev/null 2>&1 && break
    sleep 1
  done
fi
log "DATABASE_URL=$DATABASE_URL"

# ---------------------------------------------------------------------------
# 2. Build shared packages (deps only) + Prisma client, migrate, seed
# ---------------------------------------------------------------------------
log "generating Prisma client"
pnpm --filter @workflo/db run db:generate >/dev/null

log "building shared packages (deps of api/portal/workspace)"
pnpm exec turbo run build \
  --filter='@workflo/api^...' --filter='@workflo/portal^...' --filter='@workflo/workspace^...' \
  >"$LOGDIR/build.log" 2>&1 || { tail -40 "$LOGDIR/build.log"; exit 1; }

log "prisma migrate deploy + seed"
pnpm --filter @workflo/db exec prisma migrate deploy >"$LOGDIR/migrate.log" 2>&1
pnpm --filter @workflo/db run seed >"$LOGDIR/seed.log" 2>&1

# ---------------------------------------------------------------------------
# 3. Services
# ---------------------------------------------------------------------------
log "starting api (:$API_PORT)"
pnpm --filter @workflo/api dev >"$LOGDIR/api.log" 2>&1 & PIDS+=($!)
log "starting portal (:3001) + workspace (:3002)"
pnpm --filter @workflo/portal dev >"$LOGDIR/portal.log" 2>&1 & PIDS+=($!)
pnpm --filter @workflo/workspace dev >"$LOGDIR/workspace.log" 2>&1 & PIDS+=($!)

wait_url() { # url label [tries]
  for _ in $(seq 1 "${3:-60}"); do
    curl -fsS -o /dev/null "$1" 2>/dev/null && { log "up: $2"; return 0; }
    sleep 1
  done
  log "TIMEOUT waiting for $2 ($1)"
  tail -30 "$LOGDIR/$2.log" 2>/dev/null || true
  return 1
}
wait_url "http://localhost:$API_PORT/health" api
wait_url "http://localhost:3001/" portal
wait_url "http://localhost:3002/" workspace

# ---------------------------------------------------------------------------
# 4. Smoke
# ---------------------------------------------------------------------------
log "running Playwright smoke"
pnpm --filter @workflo/e2e exec playwright test "$@"
log "smoke passed ✓"
