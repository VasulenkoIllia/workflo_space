#!/usr/bin/env bash
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

REQUIRED_SECRETS=(
  HETZNER_HOST
  HETZNER_SSH_KEY
  DATABASE_URL_PROD
  DATABASE_URL_STAGING
  JWT_SECRET_PROD
  JWT_SECRET_STAGING
  JWT_REFRESH_SECRET_PROD
  JWT_REFRESH_SECRET_STAGING
  SMTP_USER
  SMTP_PASS
  BOT_TOKEN
  TELEGRAM_DEPLOY_CHAT_ID
  TELEGRAM_DEPLOY_BOT_TOKEN
  OPENAI_API_KEY
  SENTRY_DSN
  TEAM_IPS
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
