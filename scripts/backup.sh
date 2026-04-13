#!/usr/bin/env bash
set -euo pipefail

PROD_DIR="${PROD_DIR:-/srv/workflo/production}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$PROD_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

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

if [[ -z "$DATABASE_URL_VALUE" ]]; then
  echo "DATABASE_URL_PROD or DATABASE_URL is required in $ENV_FILE" >&2
  exit 1
fi

DATE="$(date +"%Y-%m-%d_%H-%M-%S")"
BACKUP_FILE="$BACKUP_DIR/$DATE.sql.gz"

log "Starting backup to $BACKUP_FILE"

if pg_dump "$DATABASE_URL_VALUE" | gzip >"$BACKUP_FILE"; then
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
