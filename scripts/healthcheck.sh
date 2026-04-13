#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="staging"
STARTUP_DELAY=0
RETRIES=3
RETRY_DELAY=5

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/healthcheck.sh [--env staging|production|local] [--delay <sec>] [--retries <count>] [--retry-delay <sec>] [url ...]

Examples:
  ./scripts/healthcheck.sh --env staging --delay 15 --retries 1
  ./scripts/healthcheck.sh --env production --delay 20
  ./scripts/healthcheck.sh https://example.com/health https://api.example.com/health
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --delay)
      STARTUP_DELAY="${2:-}"
      shift 2
      ;;
    --retries)
      RETRIES="${2:-}"
      shift 2
      ;;
    --retry-delay)
      RETRY_DELAY="${2:-}"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      print_usage
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

declare -a TARGETS=("$@")

if [[ "${#TARGETS[@]}" -eq 0 ]]; then
  case "$ENVIRONMENT" in
    staging)
      TARGETS=(
        "https://dev.workflo.space"
        "https://dev-app.workflo.space/health"
        "https://dev-api.workflo.space/health"
      )
      ;;
    production)
      TARGETS=(
        "https://workflo.space"
        "https://app.workflo.space/health"
        "https://api.workflo.space/health"
      )
      ;;
    local)
      TARGETS=(
        "http://127.0.0.1:3000/api/health"
        "http://127.0.0.1:3001/health"
        "http://127.0.0.1:3002/health"
        "http://127.0.0.1:4000/health"
      )
      ;;
    *)
      echo "Unsupported environment: $ENVIRONMENT" >&2
      print_usage
      exit 1
      ;;
  esac
fi

if [[ "$STARTUP_DELAY" -gt 0 ]]; then
  echo "Waiting ${STARTUP_DELAY}s before checks..."
  sleep "$STARTUP_DELAY"
fi

check_target() {
  local target="$1"
  local status="000"

  for attempt in $(seq 1 "$RETRIES"); do
    status="$(curl -sS -o /dev/null -w "%{http_code}" "$target" || true)"
    if [[ "$status" == "200" ]]; then
      echo "OK: $target"
      return 0
    fi

    if [[ "$attempt" -lt "$RETRIES" ]]; then
      sleep "$RETRY_DELAY"
    fi
  done

  echo "FAIL: $target returned $status"
  return 1
}

failures=0
for target in "${TARGETS[@]}"; do
  if ! check_target "$target"; then
    failures=$((failures + 1))
  fi
done

if [[ "$failures" -gt 0 ]]; then
  echo "Health check failed: ${failures} endpoint(s) are not healthy."
  exit 1
fi

echo "Health check passed for ${#TARGETS[@]} endpoint(s)."
