#!/usr/bin/env bash
set -euo pipefail

APPLY=0
DEPLOY_USER="${DEPLOY_USER:-deploy}"
PROD_DB_USER="${PROD_DB_USER:-workflo_prod}"
STAGING_DB_USER="${STAGING_DB_USER:-workflo_stg}"
PROD_DB_NAME="${PROD_DB_NAME:-workflo_production}"
STAGING_DB_NAME="${STAGING_DB_NAME:-workflo_staging}"
PROD_DB_PASSWORD="${PROD_DB_PASSWORD:-}"
STAGING_DB_PASSWORD="${STAGING_DB_PASSWORD:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--apply]" >&2
      exit 1
      ;;
  esac
done

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

if [[ "$APPLY" -eq 1 ]]; then
  if [[ -z "$PROD_DB_PASSWORD" || -z "$STAGING_DB_PASSWORD" ]]; then
    echo "Set PROD_DB_PASSWORD and STAGING_DB_PASSWORD before --apply." >&2
    exit 1
  fi
fi

run() {
  if [[ "$APPLY" -eq 1 ]]; then
    eval "$1"
  else
    echo "[dry-run] $1"
  fi
}

run "apt-get update"
if command -v docker >/dev/null 2>&1; then
  echo "Docker is already installed. Skipping docker package installation."
  run "apt-get install -y ca-certificates curl gnupg ufw postgresql postgresql-contrib"
else
  run "apt-get install -y ca-certificates curl gnupg ufw docker.io docker-compose-plugin postgresql postgresql-contrib"
fi
run "systemctl enable --now docker"
run "systemctl enable --now postgresql"

if id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "Deploy user already exists: $DEPLOY_USER"
else
  run "adduser --disabled-password --gecos \"\" $DEPLOY_USER"
fi
run "usermod -aG docker $DEPLOY_USER"

run "mkdir -p /srv/workflo/production/backups /srv/workflo/staging /srv/traefik"
run "chown -R $DEPLOY_USER:$DEPLOY_USER /srv/workflo /srv/traefik"

run "sudo -u postgres psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$PROD_DB_USER'\" | grep -q 1 || sudo -u postgres psql -c \"CREATE ROLE $PROD_DB_USER LOGIN PASSWORD '$PROD_DB_PASSWORD';\""
run "sudo -u postgres psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$STAGING_DB_USER'\" | grep -q 1 || sudo -u postgres psql -c \"CREATE ROLE $STAGING_DB_USER LOGIN PASSWORD '$STAGING_DB_PASSWORD';\""
run "sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname='$PROD_DB_NAME'\" | grep -q 1 || sudo -u postgres createdb -O $PROD_DB_USER $PROD_DB_NAME"
run "sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname='$STAGING_DB_NAME'\" | grep -q 1 || sudo -u postgres createdb -O $STAGING_DB_USER $STAGING_DB_NAME"
run "sudo -u postgres psql -d $PROD_DB_NAME -c \"CREATE EXTENSION IF NOT EXISTS pg_cron;\" || true"

run "ufw --force reset"
run "ufw default deny incoming"
run "ufw default allow outgoing"
run "ufw allow 22/tcp"
run "ufw allow 80/tcp"
run "ufw allow 443/tcp"
run "ufw deny 5432/tcp"
run "ufw deny 19999/tcp"
run "ufw --force enable"

echo "Bootstrap finished (apply=$APPLY)."
