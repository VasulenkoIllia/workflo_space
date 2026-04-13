#!/usr/bin/env bash
set -euo pipefail

PROD_DIR="${PROD_DIR:-/var/www/srv/workflo/production}"
ENV_FILE="${ENV_FILE:-$PROD_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROD_DIR/docker-compose.production.yml}"
TARGET_TAG="${1:-}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

LAST_DEPLOY_FILE="$PROD_DIR/.last_deploy"
PREVIOUS_DEPLOY_FILE="$PROD_DIR/.previous_deploy"

CURRENT_TAG="$(cat "$LAST_DEPLOY_FILE" 2>/dev/null || echo 'none')"
PREVIOUS_TAG="$(cat "$PREVIOUS_DEPLOY_FILE" 2>/dev/null || echo 'none')"

if [[ -z "$TARGET_TAG" ]]; then
  TARGET_TAG="$PREVIOUS_TAG"
fi

if [[ "$TARGET_TAG" == "none" || -z "$TARGET_TAG" ]]; then
  echo "No rollback target found. Pass a tag manually: ./scripts/rollback.sh sha-xxxx" >&2
  exit 1
fi

echo "Rolling back from $CURRENT_TAG to $TARGET_TAG"

export LANDING_TAG="$TARGET_TAG"
export PORTAL_TAG="$TARGET_TAG"
export WORKSPACE_TAG="$TARGET_TAG"
export API_TAG="$TARGET_TAG"
export BOT_TAG="$TARGET_TAG"

cd "$PROD_DIR"
docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d

echo "$CURRENT_TAG" >"$PREVIOUS_DEPLOY_FILE"
echo "$TARGET_TAG" >"$LAST_DEPLOY_FILE"

echo "Rollback completed."
