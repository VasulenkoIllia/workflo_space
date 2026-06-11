#!/usr/bin/env bash
# AR-54 (audit 2026-06-11): ONE source of truth for secrets.
#
#   - GitHub Secrets  → ТІЛЬКИ те, що споживають воркфлоу: SSH-доступ до сервера
#     (звірено grep'ом по .github/workflows: HETZNER_HOST/SSH_USER/SSH_KEY;
#     GITHUB_TOKEN видається автоматично).
#   - Server .env     → КАНОН для всіх runtime-секретів (DATABASE_URL_*, JWT_*,
#     SMTP_*, BOT_TOKEN, SENTRY_DSN, TEAM_IPS, OPENAI_API_KEY, ...). Живе у
#     /var/www/srv/workflo/{staging,production}/.env і читається compose через
#     --env-file. Ротація runtime-секрету = правка .env + recreate сервісу.
#
# Раніше цей скрипт заливав 17 секретів у GH, з яких 14 ніщо не читало — дві
# несинхронізовані копії правди. Якщо колись захочеш рендерити server .env з GH
# Secrets на деплої — це окреме рішення (додай scp-крок у workflow), не повертай
# мовчазне дублювання.
set -euo pipefail

REPO="${1:-}"
SECRETS_FILE="${2:-.env.github.secrets}"

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo> [secrets-file]" >&2
  exit 1
fi

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Secrets file not found: $SECRETS_FILE" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required. Install: https://cli.github.com/" >&2
  exit 1
fi

gh auth status >/dev/null

set -a
# shellcheck source=/dev/null
source "$SECRETS_FILE"
set +a

# CI-вживані секрети (див. шапку). Runtime-секрети живуть у server .env — НЕ тут.
REQUIRED_SECRETS=(
  HETZNER_HOST
  HETZNER_SSH_USER
  HETZNER_SSH_KEY
)

missing=0
for key in "${REQUIRED_SECRETS[@]}"; do
  value="${!key:-}"
  file_var="${key}_FILE"
  file_path="${!file_var:-}"

  if [[ -z "$value" && -n "$file_path" ]]; then
    if [[ -f "$file_path" ]]; then
      value="$(cat "$file_path")"
    else
      echo "Secret file not found for $key: $file_path" >&2
      missing=$((missing + 1))
      continue
    fi
  fi

  if [[ -z "$value" ]]; then
    echo "Missing secret value: $key" >&2
    missing=$((missing + 1))
    continue
  fi

  gh secret set "$key" --repo "$REPO" --body "$value" >/dev/null
  echo "Set secret: $key"
done

if [[ "$missing" -gt 0 ]]; then
  echo "Completed with $missing missing secrets." >&2
  exit 1
fi

echo "All required secrets were uploaded for $REPO"
