#!/usr/bin/env bash
# AR-51 (audit 2026-06-11): install the daily DB backup cron via automation —
# INFRASTRUCTURE.md listed `0 3 * * * backup.sh` as a checklist item, but nothing
# ever installed it (crontab -e was tribal knowledge). Run ONCE on the server as
# root (or rerun safely — the file is overwritten idempotently):
#
#   sudo REPO_DIR=/var/www/srv/workflo bash scripts/install-backup-cron.sh
#
# Offsite testing note (owner decision 2026-06-11): the offsite leg (restic/rclone
# env in production/.env) is wired but UNTESTED until the storage box exists —
# backup.sh warns loudly on every run until it is configured.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/srv/workflo}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-$REPO_DIR/production/scripts/backup.sh}"
RESTORE_SCRIPT="${RESTORE_SCRIPT:-$REPO_DIR/production/scripts/restore.sh}"
CRON_FILE="/etc/cron.d/workflo-backup"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
# INFRA-DR1: щомісячний restore-drill — 1-го числа о 04:20, після нічного бекапу.
DRILL_SCHEDULE="${DRILL_SCHEDULE:-20 4 1 * *}"
CRON_USER="${CRON_USER:-root}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (writes $CRON_FILE)" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_SCRIPT" ]]; then
  echo "WARN: $BACKUP_SCRIPT not found — adjust BACKUP_SCRIPT before the first run" >&2
fi

cat >"$CRON_FILE" <<CRON
# Installed by scripts/install-backup-cron.sh (workflo S5.5 AR-51). Do not edit by hand —
# rerun the installer instead. Logs: \$BACKUP_DIR/backup.log + Telegram on failure.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
$CRON_SCHEDULE $CRON_USER $BACKUP_SCRIPT >>/var/log/workflo-backup-cron.log 2>&1
# INFRA-DR1: monthly restore drill — «бекап існує, лише якщо він відновлюється».
$DRILL_SCHEDULE $CRON_USER $RESTORE_SCRIPT --drill >>/var/log/workflo-backup-cron.log 2>&1
CRON

chmod 0644 "$CRON_FILE"
echo "Installed $CRON_FILE → '$CRON_SCHEDULE' $BACKUP_SCRIPT (user: $CRON_USER)"
echo "Verify: run '$BACKUP_SCRIPT' once manually, then check backup.log and Telegram."
