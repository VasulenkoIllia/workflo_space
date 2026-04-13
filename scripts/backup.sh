#!/usr/bin/env bash
set -euo pipefail

PROD_DIR="${PROD_DIR:-/var/www/srv/workflo/production}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROD_DIR/docker-compose.production.yml}"
BACKUP_DIR="${BACKUP_DIR:-$PROD_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_MODE="${BACKUP_MODE:-auto}" # auto|docker|direct

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$1" | tee -a "$BACKUP_DIR/backup.log"
}

send_telegram() {
  local text="$1"
  local bot_token="${TELEGRAM_DEPLOY_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
  local chat_id="${TELEGRAM_DEPLOY_CHAT_ID:-}"

  if [[ -z "$bot_token" || -z "$chat_id" ]]; then
    return 0
  fi

  curl -fsS -X POST "https://api.telegram.org/bot${bot_token}/sendMessage" \
    -d "chat_id=${chat_id}" \
    --data-urlencode "text=${text}" >/dev/null || true
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

DATABASE_URL_VALUE="${DATABASE_URL_PROD:-${DATABASE_URL:-}}"

DATE="$(date +"%Y-%m-%d_%H-%M-%S")"
BACKUP_FILE="$BACKUP_DIR/$DATE.sql.gz"

log "Starting backup to $BACKUP_FILE"

backup_via_docker() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    return 1
  fi

  docker compose -f "$COMPOSE_FILE" up -d postgres >/dev/null
  docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
    'export PGPASSWORD="${POSTGRES_PASSWORD:-}"; pg_dump -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"'
}

use_docker_backup=0
if [[ "$BACKUP_MODE" == "docker" ]]; then
  use_docker_backup=1
elif [[ "$BACKUP_MODE" == "auto" ]]; then
  if [[ "$DATABASE_URL_VALUE" == *"@postgres:"* ]]; then
    use_docker_backup=1
  elif [[ -f "$COMPOSE_FILE" ]] && docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | grep -qx "postgres"; then
    use_docker_backup=1
  fi
fi

backup_ok=0

if [[ "$use_docker_backup" -eq 1 ]]; then
  if backup_via_docker | gzip >"$BACKUP_FILE"; then
    backup_ok=1
  else
    log "Docker backup path failed, trying direct pg_dump fallback"
  fi
fi

if [[ "$backup_ok" -eq 0 ]]; then
  if [[ -z "$DATABASE_URL_VALUE" ]]; then
    echo "DATABASE_URL_PROD or DATABASE_URL is required in $ENV_FILE for direct backup mode" >&2
    exit 1
  fi

  if pg_dump "$DATABASE_URL_VALUE" | gzip >"$BACKUP_FILE"; then
    backup_ok=1
  fi
fi

if [[ "$backup_ok" -eq 1 ]]; then
  SIZE="$(du -sh "$BACKUP_FILE" | awk '{print $1}')"
  log "Backup completed: $BACKUP_FILE ($SIZE)"
  send_telegram "Daily backup OK: $DATE ($SIZE)"
else
  log "Backup failed"
  send_telegram "Daily backup FAILED: $DATE"
  exit 1
fi

find "$BACKUP_DIR" -name '*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete
log "Old backups cleanup completed (retention: $RETENTION_DAYS days)"
