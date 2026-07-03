#!/usr/bin/env bash
set -euo pipefail

PROD_DIR="${PROD_DIR:-/var/www/srv/workflo/production}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROD_DIR/docker-compose.production.yml}"
# MUST match PRODUCTION_COMPOSE_PROJECT in production.yml — without it compose derives
# the project from the dir name ("production"), `up -d postgres` starts a SECOND empty
# postgres and the dump is of an empty DB (the same trap rollback.sh had).
PROJECT_NAME="${PROJECT_NAME:-workflo-production}"
BACKUP_DIR="${BACKUP_DIR:-$PROD_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_MODE="${BACKUP_MODE:-auto}" # auto|docker|direct

compose() {
  docker compose --project-name "$PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

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

  compose up -d postgres >/dev/null
  # --clean --if-exists --no-owner: the dump restores idempotently into a non-empty
  # DB (restore.sh applies it as-is) — same flags as the pre-migrate deploy dump.
  compose exec -T postgres sh -lc \
    'export PGPASSWORD="${POSTGRES_PASSWORD:-}"; pg_dump --no-owner --clean --if-exists -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}"'
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

  if pg_dump --no-owner --clean --if-exists "$DATABASE_URL_VALUE" | gzip >"$BACKUP_FILE"; then
    backup_ok=1
  fi
fi

if [[ "$backup_ok" -eq 1 ]]; then
  # AR-51 sanity: an "OK" that is a few bytes of error output is worse than a loud failure.
  BYTES="$(wc -c <"$BACKUP_FILE" | tr -d ' ')"
  if [[ "$BYTES" -lt 1024 ]]; then
    log "Backup file is suspiciously small (${BYTES} bytes) — treating as FAILED"
    send_telegram "Daily backup FAILED (tiny dump ${BYTES}B): $DATE"
    exit 1
  fi
  SIZE="$(du -sh "$BACKUP_FILE" | awk '{print $1}')"
  log "Backup completed: $BACKUP_FILE ($SIZE)"
  send_telegram "Daily backup OK: $DATE ($SIZE)"
else
  log "Backup failed"
  send_telegram "Daily backup FAILED: $DATE"
  exit 1
fi

# ── INFRA-DR1: uploads (клієнтські файли) — тар named volume ────────────────
# uploads_data живе поруч із postgres_data; без цього тару файли існують в
# ОДНОМУ екземплярі. Non-fatal: провал uploads-тару не блокує DB-бекап, але
# кричить у Telegram.
UPLOADS_FILE="$BACKUP_DIR/uploads_$DATE.tar.gz"
uploads_ok=0
if [[ "$use_docker_backup" -eq 1 ]]; then
  if compose exec -T api tar -czf - -C /data uploads >"$UPLOADS_FILE" 2>>"$BACKUP_DIR/backup.log"; then
    U_BYTES="$(wc -c <"$UPLOADS_FILE" | tr -d ' ')"
    if [[ "$U_BYTES" -ge 45 ]]; then # порожній tar.gz ≈ 45B — теж валідний (нуль файлів)
      uploads_ok=1
      log "Uploads backup OK: $UPLOADS_FILE ($(du -sh "$UPLOADS_FILE" | awk '{print $1}'))"
    fi
  fi
  if [[ "$uploads_ok" -eq 0 ]]; then
    rm -f "$UPLOADS_FILE"
    log "Uploads backup FAILED (api container down or volume missing)"
    send_telegram "Uploads backup FAILED: $DATE"
  fi
else
  log "Uploads backup skipped (non-docker mode)"
fi

# ── AR-51 (audit 2026-06-11): OFFSITE copy ───────────────────────────────────
# Local dumps live on the SAME disk as Postgres — a host failure loses both.
# Configure ONE of (in .env or the cron environment):
#   restic: RESTIC_REPOSITORY (e.g. sftp:uXXXX@uXXXX.your-storagebox.de:/backups/workflo)
#           + RESTIC_PASSWORD — encrypted, deduplicated, supports retention.
#   rclone: RCLONE_REMOTE (e.g. storagebox:workflo-backups) — plain copy.
# Neither set → loud WARN in log+Telegram so the gap is never silent.
offsite_ok=0
if [[ -n "${RESTIC_REPOSITORY:-}" && -n "${RESTIC_PASSWORD:-}" ]]; then
  if command -v restic >/dev/null 2>&1; then
    OFFSITE_FILES=("$BACKUP_FILE")
    [[ "$uploads_ok" -eq 1 ]] && OFFSITE_FILES+=("$UPLOADS_FILE")
    if restic backup "${OFFSITE_FILES[@]}" --tag workflo-db 2>>"$BACKUP_DIR/backup.log" &&
      restic forget --tag workflo-db --keep-daily 14 --keep-weekly 8 --prune 2>>"$BACKUP_DIR/backup.log"; then
      offsite_ok=1
      log "Offsite (restic) OK: $RESTIC_REPOSITORY"
    else
      log "Offsite (restic) FAILED"
      send_telegram "Offsite backup FAILED (restic): $DATE"
    fi
  else
    log "RESTIC_REPOSITORY set but restic is not installed"
    send_telegram "Offsite backup MISCONFIGURED: restic not installed"
  fi
elif [[ -n "${RCLONE_REMOTE:-}" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    if rclone copy "$BACKUP_FILE" "$RCLONE_REMOTE" 2>>"$BACKUP_DIR/backup.log" &&
      { [[ "$uploads_ok" -eq 0 ]] || rclone copy "$UPLOADS_FILE" "$RCLONE_REMOTE" 2>>"$BACKUP_DIR/backup.log"; }; then
      offsite_ok=1
      log "Offsite (rclone) OK: $RCLONE_REMOTE"
    else
      log "Offsite (rclone) FAILED"
      send_telegram "Offsite backup FAILED (rclone): $DATE"
    fi
  else
    log "RCLONE_REMOTE set but rclone is not installed"
    send_telegram "Offsite backup MISCONFIGURED: rclone not installed"
  fi
else
  log "WARN: no offsite target configured (RESTIC_REPOSITORY / RCLONE_REMOTE) — backups exist ONLY on this host"
  send_telegram "WARN: backup $DATE is local-only — configure offsite storage"
fi

find "$BACKUP_DIR" -name '*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -type f -mtime +"$RETENTION_DAYS" -delete
log "Old backups cleanup completed (retention: $RETENTION_DAYS days, offsite_ok=$offsite_ok)"
