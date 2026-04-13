#!/usr/bin/env bash
set -euo pipefail

check_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "OK   $file"
  else
    echo "MISS $file"
    return 1
  fi
}

fail=0

for file in \
  ".github/workflows/staging.yml" \
  ".github/workflows/production.yml" \
  "docker-compose.staging.yml" \
  "docker-compose.production.yml" \
  "infra/traefik/traefik.yml" \
  "infra/traefik/docker-compose.yml" \
  "infra/postgres/init.sql" \
  "scripts/healthcheck.sh" \
  "scripts/backup.sh" \
  "scripts/rollback.sh" \
  "scripts/s0/github-branch-protection.sh" \
  "scripts/s0/github-secrets.sh" \
  "scripts/s0/github-production-environment.sh" \
  "scripts/s0/hetzner-bootstrap.sh"; do
  check_file "$file" || fail=1
done

echo "-----"
for cmd in docker ssh curl; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "OK   command: $cmd"
  else
    echo "MISS command: $cmd"
    fail=1
  fi
done

if [[ "$fail" -eq 0 ]]; then
  echo "S0 repo readiness: PASS"
  exit 0
fi

echo "S0 repo readiness: FAIL"
exit 1
