#!/usr/bin/env bash
# INFRA-DR1: restore-from-backup — «restore ІSNУЄ лише якщо його проганяли».
#
# Режими:
#   ./scripts/restore.sh --drill [dump.sql.gz]
#       Безпечна щомісячна перевірка (cron): розпаковує ОСТАННІЙ дамп у THROWAWAY
#       postgres-контейнер, рахує таблиці/ключові рядки, звітує в Telegram і
#       прибирає за собою. Робочу БД НЕ чіпає. Exit 0 лише якщо дамп реально
#       відновлюється і не порожній.
#
#   ./scripts/restore.sh --restore [dump.sql.gz]
#       СПРАВЖНІЙ disaster-restore у робочий postgres стека: зупиняє api/worker/bot,
#       застосовує дамп (--clean --if-exists усередині дампа робить це ідемпотентно),
#       піднімає сервіси назад. Вимагає надрукувати RESTORE для підтвердження.
#
# Без аргументів дамп = найсвіжіший backups/*.sql.gz (включно з pre-migrate-*).
set -euo pipefail

PROD_DIR="${PROD_DIR:-/var/www/srv/workflo/production}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROD_DIR/docker-compose.production.yml}"
PROJECT_NAME="${PROJECT_NAME:-workflo-production}"
BACKUP_DIR="${BACKUP_DIR:-$PROD_DIR/backups}"
DRILL_IMAGE="${DRILL_IMAGE:-postgres:16-bookworm}"
# Мінімальні інваріанти живої БД: сід гарантує owner-профіль і агенцію.
MIN_TABLES="${MIN_TABLES:-30}"

compose() {
  docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { printf '[%s] %s\n' "$(timestamp)" "$1"; }

send_telegram() {
  local text="$1"
  local bot_token="${TELEGRAM_DEPLOY_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
  local chat_id="${TELEGRAM_DEPLOY_CHAT_ID:-}"
  [[ -z "$bot_token" || -z "$chat_id" ]] && return 0
  curl -fsS -X POST "https://api.telegram.org/bot${bot_token}/sendMessage" \
    -d "chat_id=${chat_id}" --data-urlencode "text=${text}" >/dev/null || true
}

MODE="${1:-}"
DUMP="${2:-}"

if [[ "$MODE" != "--drill" && "$MODE" != "--restore" ]]; then
  echo "Usage: restore.sh --drill|--restore [dump.sql.gz]" >&2
  exit 2
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

if [[ -z "$DUMP" ]]; then
  DUMP="$(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1 || true)"
fi
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  log "FATAL: no dump found (looked in $BACKUP_DIR)"
  send_telegram "Restore ${MODE#--} FAILED: no dump found in $BACKUP_DIR"
  exit 1
fi
log "Dump: $DUMP ($(du -sh "$DUMP" | awk '{print $1}'))"

# ── shared: застосувати дамп у "psql що читає stdin" і зняти метрики ─────────
# $1 = команда-обгортка, якій передаємо psql-аргументи (масив через "${@:2}")
run_psql() { "$@"; }

count_metric() {
  # $1..$n-1 — psql cmd; останній аргумент — SQL. Повертає число (або 'ERR').
  local sql="${*: -1}"
  run_psql "${@:1:$#-1}" -tAc "$sql" 2>/dev/null | tr -d '[:space:]' || echo ERR
}

if [[ "$MODE" == "--drill" ]]; then
  NAME="workflo-restore-drill-$$"
  log "Starting throwaway postgres ($DRILL_IMAGE) as $NAME"
  docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill "$DRILL_IMAGE" >/dev/null
  cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
  trap cleanup EXIT

  for i in $(seq 1 30); do
    docker exec "$NAME" pg_isready -U postgres -d drill >/dev/null 2>&1 && break
    sleep 2
    [[ "$i" -eq 30 ]] && { log "FATAL: throwaway postgres never became ready"; exit 1; }
  done

  PSQL=(docker exec -i "$NAME" psql -U postgres -d drill -v ON_ERROR_STOP=0 -q)
  log "Applying dump..."
  if ! gunzip -c "$DUMP" | "${PSQL[@]}" >/dev/null 2>&1; then
    # ON_ERROR_STOP=0: власницькі GRANT/extension-рядки можуть скаржитись — це ок;
    # справжній провал ловимо метриками нижче, а не exit-кодом psql.
    log "psql exited non-zero (може бути шум GRANT/ownership) — перевіряю метрики"
  fi

  TABLES="$(count_metric docker exec -i "$NAME" psql -U postgres -d drill "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
  PROFILES="$(count_metric docker exec -i "$NAME" psql -U postgres -d drill "SELECT count(*) FROM profiles")"
  AGENCIES="$(count_metric docker exec -i "$NAME" psql -U postgres -d drill "SELECT count(*) FROM agencies")"
  ORDERS="$(count_metric docker exec -i "$NAME" psql -U postgres -d drill "SELECT count(*) FROM orders")"
  log "Metrics: tables=$TABLES profiles=$PROFILES agencies=$AGENCIES orders=$ORDERS"

  if [[ "$TABLES" == "ERR" || "$PROFILES" == "ERR" || "$TABLES" -lt "$MIN_TABLES" || "$PROFILES" -lt 1 || "$AGENCIES" -lt 1 ]]; then
    log "DRILL FAILED — dump does not restore to a sane DB"
    send_telegram "Restore drill FAILED: $(basename "$DUMP") → tables=$TABLES profiles=$PROFILES agencies=$AGENCIES"
    exit 1
  fi

  log "DRILL OK"
  send_telegram "Restore drill OK: $(basename "$DUMP") → tables=$TABLES, profiles=$PROFILES, agencies=$AGENCIES, orders=$ORDERS"
  exit 0
fi

# ── --restore: справжнє відновлення робочої БД ───────────────────────────────
echo "УВАГА: це перезапише БД проєкту '$PROJECT_NAME' вмістом $DUMP"
read -r -p "Надрукуйте RESTORE щоб продовжити: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Скасовано."
  exit 1
fi

log "Stopping app services (postgres лишається)"
compose stop api worker bot 2>/dev/null || compose stop api bot

log "Applying dump into the live postgres..."
if ! gunzip -c "$DUMP" | compose exec -T postgres sh -lc \
  'export PGPASSWORD="${POSTGRES_PASSWORD:-}"; psql -q -v ON_ERROR_STOP=0 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' >/dev/null; then
  log "psql exited non-zero — перевірте вручну (сервіси НЕ підняті)"
  send_telegram "RESTORE FAILED applying $(basename "$DUMP") — services left DOWN"
  exit 1
fi

TABLES="$(compose exec -T postgres sh -lc 'export PGPASSWORD="${POSTGRES_PASSWORD:-}"; psql -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='"'"'public'"'"'" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"' | tr -d '[:space:]')"
log "Restored: $TABLES tables. Bringing services back up..."
compose up -d --wait --wait-timeout 180 api bot || {
  send_telegram "RESTORE: DB applied but services UNHEALTHY — investigate"
  exit 1
}

log "RESTORE OK"
send_telegram "RESTORE OK from $(basename "$DUMP") — $TABLES tables, services healthy"
echo "Не забудьте: uploads відновлюються окремо (tar -xzf uploads_*.tar.gz у volume)."
