#!/usr/bin/env bash
# Manual production rollback: `bash scripts/rollback.sh [sha-tag]` (no tag → .previous_deploy).
# Delegates to deploy-remote.sh — the same code path as the pipeline's auto-rollback, so it
# only touches the apps the pipeline rolls out (.deploy_apps) and leaves kept apps (e.g. the
# old prod landing, LANDING_SEO_PLAN §0) on their own tag.
set -euo pipefail

PROD_DIR="${PROD_DIR:-/var/www/srv/workflo/production}"
# MUST match compose_project in .github/workflows/production.yml — without it compose
# derives the project from the directory name and `up` starts a SECOND stack with
# conflicting Traefik labels instead of rolling back the running one.
PROJECT_NAME="${PROJECT_NAME:-workflo-production}"

cd "$PROD_DIR"

# GHCR owner as the running api image spells it (ghcr.io/<owner>/workflo-api:<tag>).
owner="$(docker ps --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
  --filter "label=com.docker.compose.service=api" --format '{{.Image}}' | head -n1 | cut -d/ -f2)"
if [[ -z "$owner" ]]; then
  echo "Cannot detect the GHCR owner: no running api container in project ${PROJECT_NAME}" >&2
  exit 1
fi

ENVIRONMENT=production \
  COMPOSE_PROJECT="$PROJECT_NAME" \
  REGISTRY_OWNER="$owner" \
  APPS="$(cat .deploy_apps 2>/dev/null || echo 'portal workspace api bot')" \
  ROLLBACK_TAG="${1:-}" \
  bash scripts/deploy-remote.sh rollback

echo "Verify: ./scripts/healthcheck.sh --env production"
