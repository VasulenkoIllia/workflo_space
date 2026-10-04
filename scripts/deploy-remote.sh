#!/usr/bin/env bash
# Server-side half of the deploy pipeline (.github/workflows/deploy.yml, AUDIT_2026-09-cicd N4).
# Shipped to the host by the scp step and run INSIDE the env runtime dir
# (/var/www/srv/workflo/<env>), so staging and production share one tested code path.
#
#   deploy-remote.sh deploy    pull → backup (blocking) → migrate → [seed] → up --wait → TLS
#   deploy-remote.sh record    mark NEW_TAG verified: .last_deploy + *_TAG in .env
#   deploy-remote.sh rollback  pipeline (ROLLBACK_TO=last-verified): back to .last_deploy —
#                              the version that ran before this failed rollout;
#                              manual (scripts/rollback.sh): ROLLBACK_TAG or .previous_deploy
#
# Config (env):
#   ENVIRONMENT      staging | production
#   COMPOSE_PROJECT  compose project name (workflo-staging | workflo-production)
#   NEW_TAG          image tag being rolled out (sha-<commit>)
#   APPS             space-separated apps rolled out this time; every other app KEEPS the tag it
#                    already runs (e.g. production keeps the old landing — LANDING_SEO_PLAN §0)
#   REGISTRY_OWNER   lowercased GHCR owner
#   SEED             1 → idempotent baseline seed after migrate (staging only, never production)
#   TLS_HOSTS        space-separated host|path pairs that must serve a non-default cert
#   API_HOST, ROUTER_SUFFIX  legacy Traefik router cleanup ('-staging' | '')
#   IMAGE_RETENTION  local images kept per app (default 5)
set -euo pipefail

MODE="${1:-}"
: "${ENVIRONMENT:?}" "${COMPOSE_PROJECT:?}" "${REGISTRY_OWNER:?}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
ALL_APPS=(landing portal workspace api bot)
read -r -a DEPLOY_APPS <<<"${APPS:-${ALL_APPS[*]}}"

[[ -f "$COMPOSE_FILE" ]] || {
  echo "FATAL: $COMPOSE_FILE not found in $(pwd)" >&2
  exit 1
}

compose() {
  docker compose --project-name "$COMPOSE_PROJECT" --env-file .env -f "$COMPOSE_FILE" "$@"
}

tag_var() { echo "$(tr '[:lower:]' '[:upper:]' <<<"$1")_TAG"; }

is_deployed() {
  local a
  for a in "${DEPLOY_APPS[@]}"; do [[ "$a" == "$1" ]] && return 0; done
  return 1
}

env_value() { grep -m1 "^$1=" .env 2>/dev/null | cut -d= -f2- || true; }

set_env_value() {
  if grep -q "^$1=" .env 2>/dev/null; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >>.env
  fi
}

# Tag an app runs right now: .env first (persisted by `record`), else the live container.
current_tag() {
  local app="$1" tag image
  tag="$(env_value "$(tag_var "$app")")"
  if [[ -z "$tag" ]]; then
    image="$(docker ps --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
      --filter "label=com.docker.compose.service=${app}" --format '{{.Image}}' | head -n1)"
    [[ "$image" == *:* ]] && tag="${image##*:}"
  fi
  echo "${tag:-none}"
}

# Rolled-out apps get $1; kept apps get their running tag (persisted to .env so manual
# compose ops parse). A kept app with no known tag ("none") is never pulled/started.
export_tags() {
  local target="$1" app var tag
  export GITHUB_REPOSITORY_OWNER="$REGISTRY_OWNER"
  for app in "${ALL_APPS[@]}"; do
    var="$(tag_var "$app")"
    if is_deployed "$app"; then
      tag="$target"
    else
      tag="$(current_tag "$app")"
      [[ "$tag" != none ]] && set_env_value "$var" "$tag"
      echo "keep: $app → $tag"
    fi
    export "$var=$tag"
  done
}

# Compose services that run an image of the rolled-out apps. worker shares the api image
# but sits behind the `workers` profile — include it only when that profile is active,
# because naming a profiled service explicitly would start it.
target_services() {
  local services=() app
  for app in "${DEPLOY_APPS[@]}"; do
    services+=("$app")
    if [[ "$app" == api ]] && compose config --services 2>/dev/null | grep -qx worker; then
      services+=(worker)
    fi
  done
  echo "${services[@]}"
}

up_services() {
  local services
  read -r -a services <<<"$(target_services)"
  if ! compose up -d --no-deps --wait --wait-timeout 180 "${services[@]}"; then
    echo "FATAL: services did not become healthy within 180s"
    compose ps || true
    compose logs --tail 50 "${services[@]}" || true
    return 1
  fi
}

cleanup_legacy_project_if_conflicting() {
  local project_name="$1" label_filter="$2" legacy_ids
  legacy_ids="$(docker ps -q --filter "label=com.docker.compose.project=${project_name}" --filter "label=${label_filter}")"
  if [[ -n "$legacy_ids" ]]; then
    echo "Found legacy compose project '${project_name}' with conflicting Traefik labels. Stopping it."
    docker compose --project-name "$project_name" --env-file .env -f "$COMPOSE_FILE" down --remove-orphans || true
  fi
}

cleanup_conflicting_router_containers() {
  local label_filter="$1" ids cid project name
  ids="$(docker ps -q --filter "label=${label_filter}")"
  [[ -z "$ids" ]] && return 0
  for cid in $ids; do
    project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$cid" 2>/dev/null || true)"
    name="$(docker inspect -f '{{ .Name }}' "$cid" 2>/dev/null | sed 's#^/##' || true)"
    if [[ "$project" != "$COMPOSE_PROJECT" ]]; then
      echo "Removing conflicting container '${name}' (project='${project}') for label '${label_filter}'"
      docker rm -f "$cid" || true
    fi
  done
}

# GHCR layer pulls occasionally stall mid-download. `timeout` wraps the docker binary
# directly (it can't exec the compose() function). 3 × 6m stays under the 20m SSH timeout.
pull_with_retry() {
  local attempt
  for attempt in 1 2 3; do
    if timeout 360 docker compose --project-name "$COMPOSE_PROJECT" --env-file .env \
      -f "$COMPOSE_FILE" pull "$@"; then
      return 0
    fi
    echo "WARN: image pull failed/stalled (attempt ${attempt}/3); retrying in 10s..."
    sleep 10
  done
  echo "FATAL: image pull failed after 3 attempts"
  return 1
}

ensure_pg_cron_enabled() {
  local attempt
  for attempt in $(seq 1 20); do
    # shellcheck disable=SC2016 # $POSTGRES_* expand inside the postgres container, on purpose
    if compose exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS pg_cron;" && psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT extname FROM pg_extension WHERE extname='\''pg_cron'\''" | grep -q pg_cron'; then
      echo "pg_cron extension is enabled"
      return 0
    fi
    sleep 3
  done
  echo "FATAL: failed to enable pg_cron extension"
  compose logs postgres || true
  return 1
}

# AR-03: blocking — Prisma has no down-migrations; restore-from-backup IS the rollback
# plan, so migrating without a verified backup is forbidden.
backup_before_migrate() {
  local raw_dump dump_bytes
  echo "Backing up DB before migrations (blocking)..."
  mkdir -p backups
  raw_dump="backups/pre-migrate-$(date +%Y%m%d-%H%M%S).sql"
  # shellcheck disable=SC2016 # $POSTGRES_* expand inside the postgres container, on purpose
  if ! compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' >"$raw_dump"; then
    echo "FATAL: pre-migrate backup failed — refusing to run migrations"
    rm -f "$raw_dump"
    return 1
  fi
  dump_bytes=$(wc -c <"$raw_dump")
  if ((dump_bytes < 1024)); then
    echo "FATAL: pre-migrate backup is suspiciously small (${dump_bytes} bytes) — refusing to run migrations"
    return 1
  fi
  gzip -f "$raw_dump"
  # shellcheck disable=SC2012 # our own timestamped names; keep the 10 newest dumps
  ls -1t backups/pre-migrate-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
}

cleanup_old_images() {
  local keep="${IMAGE_RETENTION:-5}" app repo image_ids image_id
  [[ "$keep" =~ ^[0-9]+$ ]] && ((keep >= 1)) || keep=5
  for app in "${ALL_APPS[@]}"; do
    repo="ghcr.io/${REGISTRY_OWNER}/workflo-${app}"
    mapfile -t image_ids < <(docker image ls "$repo" --format '{{.ID}}' | awk '!seen[$0]++')
    ((${#image_ids[@]} <= keep)) && continue
    # In-use images (e.g. a kept landing) refuse removal — `|| true` keeps them.
    for image_id in "${image_ids[@]:$keep}"; do
      docker image rm "$image_id" >/dev/null 2>&1 || true
    done
  done
  docker image prune -f >/dev/null 2>&1 || true
}

wait_for_non_default_cert() {
  local host="$1" check_path="$2" attempt cert_info
  for attempt in $(seq 1 12); do
    cert_info="$(openssl s_client -connect 127.0.0.1:443 -servername "$host" </dev/null 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null || true)"
    if echo "$cert_info" | grep -Fq "DNS:${host}" && ! echo "$cert_info" | grep -Fq "TRAEFIK DEFAULT CERT"; then
      echo "TLS OK: $host"
      return 0
    fi
    curl -ksS -o /dev/null "https://${host}${check_path}" || true
    sleep 5
  done
  echo "TLS FAIL: non-default cert was not issued for ${host}"
  openssl s_client -connect 127.0.0.1:443 -servername "$host" </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -ext subjectAltName || true
  return 1
}

do_deploy() {
  : "${NEW_TAG:?}"
  local services spec

  if [[ -n "${API_HOST:-}" ]]; then
    local suffix="${ROUTER_SUFFIX:-}" legacy
    for legacy in "$ENVIRONMENT" workflo_space; do
      cleanup_legacy_project_if_conflicting "$legacy" "traefik.http.routers.workflo-api${suffix}.rule=Host(\`${API_HOST}\`)"
      cleanup_legacy_project_if_conflicting "$legacy" "traefik.http.routers.api${suffix}.rule=Host(\`${API_HOST}\`)"
    done
    cleanup_conflicting_router_containers "traefik.http.routers.workflo-api${suffix}.rule=Host(\`${API_HOST}\`)"
    cleanup_conflicting_router_containers "traefik.http.routers.api${suffix}.rule=Host(\`${API_HOST}\`)"
  fi

  # AR-05: .last_deploy only ever holds VERIFIED tags (written by `record`), so
  # .previous_deploy is always a safe rollback target.
  cat .last_deploy 2>/dev/null >.previous_deploy || echo none >.previous_deploy
  echo "Rolling out ${NEW_TAG} (${DEPLOY_APPS[*]}); previous verified: $(cat .previous_deploy)"

  export_tags "$NEW_TAG"
  read -r -a services <<<"$(target_services)"
  is_deployed api && services+=(migrate)
  pull_with_retry "${services[@]}"

  compose build postgres
  compose up -d postgres
  ensure_pg_cron_enabled
  backup_before_migrate

  echo "Applying database migrations (prisma migrate deploy)..."
  compose run --rm --no-deps migrate

  # Staging-only baseline data (count-guarded, never overwrites). Non-fatal by design.
  if [[ "${SEED:-0}" == 1 ]]; then
    echo "Seeding ${ENVIRONMENT} baseline data (idempotent)..."
    compose run --rm --no-deps api pnpm --filter @workflo/db run seed ||
      echo "WARN: seed step failed (non-fatal)"
  fi

  up_services
  cleanup_old_images

  for spec in ${TLS_HOSTS:-}; do
    wait_for_non_default_cert "${spec%%|*}" "${spec#*|}"
  done
}

do_record() {
  : "${NEW_TAG:?}"
  local app
  echo "$NEW_TAG" >.last_deploy
  echo "${DEPLOY_APPS[*]}" >.deploy_apps
  # Persist verified tags so manual `docker compose` ops use the deployed images without
  # re-exporting *_TAG. Kept apps were already persisted by export_tags during deploy.
  for app in "${DEPLOY_APPS[@]}"; do
    set_env_value "$(tag_var "$app")" "$NEW_TAG"
  done
  echo "Recorded verified deploy: $NEW_TAG"
}

do_rollback() {
  local prev app
  # A failed rollout never reaches `record`, so .last_deploy still names what ran before it
  # — even when the deploy died before its own bookkeeping (e.g. scp/SSH failure).
  if [[ -n "${ROLLBACK_TAG:-}" ]]; then
    prev="$ROLLBACK_TAG"
  elif [[ "${ROLLBACK_TO:-}" == last-verified ]]; then
    prev="$(cat .last_deploy 2>/dev/null || echo none)"
  else
    prev="$(cat .previous_deploy 2>/dev/null || echo none)"
  fi
  if [[ -z "$prev" || "$prev" == none ]]; then
    echo "FATAL: no previous verified deploy recorded — nothing to roll back to"
    return 1
  fi
  echo "Rolling back ${DEPLOY_APPS[*]} to ${prev}"
  export_tags "$prev"
  # --wait: a rollback onto crashing containers must fail loudly. The schema stays forward
  # (expand/contract discipline keeps the old image compatible); restore-from-backup
  # (scripts/restore.sh) remains the manual escape hatch.
  up_services
  # Manual rollback to an explicit tag becomes the new known-good state.
  if [[ -n "${ROLLBACK_TAG:-}" ]]; then
    cat .last_deploy 2>/dev/null >.previous_deploy || echo none >.previous_deploy
    echo "$prev" >.last_deploy
    for app in "${DEPLOY_APPS[@]}"; do
      set_env_value "$(tag_var "$app")" "$prev"
    done
  fi
  echo "Rolled back to ${prev}"
}

case "$MODE" in
  deploy) do_deploy ;;
  record) do_record ;;
  rollback) do_rollback ;;
  *)
    echo "usage: $0 deploy|record|rollback" >&2
    exit 2
    ;;
esac
