#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="staging"
STARTUP_DELAY=0
RETRIES=3
RETRY_DELAY=5

print_usage() {
  cat <<'EOF'
Usage:
  ./scripts/healthcheck.sh [--env staging|production|local] [--delay <sec>] [--retries <count>] [--retry-delay <sec>] [url[|expected_codes] ...]

Examples:
  ./scripts/healthcheck.sh --env staging --delay 15 --retries 1
  ./scripts/healthcheck.sh --env production --delay 20
  ./scripts/healthcheck.sh https://example.com/health https://api.example.com/health
  ./scripts/healthcheck.sh https://dev-work.workflo.space/health\|200,401,403
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

declare -a TARGET_SPECS=("$@")

if [[ "${#TARGET_SPECS[@]}" -eq 0 ]]; then
  case "$ENVIRONMENT" in
    staging)
      TARGET_SPECS=(
        "https://dev.workflo.space|200"
        "https://dev-portal.workflo.space/health|200"
        "https://dev-work.workflo.space/health|200,401,403"
        "https://dev-api.workflo.space/health|200"
      )
      ;;
    production)
      TARGET_SPECS=(
        "https://workflo.space|200"
        "https://portal.workflo.space/health|200"
        "https://work.workflo.space/health|200,401,403"
        "https://api.workflo.space/health|200"
      )
      ;;
    local)
      TARGET_SPECS=(
        "http://127.0.0.1:3000/api/health|200"
        "http://127.0.0.1:3001/health|200"
        "http://127.0.0.1:3002/health|200"
        "http://127.0.0.1:4000/health|200"
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
  local expected_csv="$2"
  local status="000"
  local expected_str="${expected_csv//,/|}"

  for attempt in $(seq 1 "$RETRIES"); do
    status="$(curl -sS -o /dev/null -w "%{http_code}" "$target" || true)"
    if [[ "$status" =~ ^(${expected_str})$ ]]; then
      echo "OK: $target ($status)"
      return 0
    fi

    if [[ "$attempt" -lt "$RETRIES" ]]; then
      sleep "$RETRY_DELAY"
    fi
  done

  echo "FAIL: $target returned $status (expected: ${expected_csv})"
  return 1
}

failures=0
for spec in "${TARGET_SPECS[@]}"; do
  target="$spec"
  expected_csv="200"
  if [[ "$spec" == *"|"* ]]; then
    target="${spec%%|*}"
    expected_csv="${spec#*|}"
  fi

  if ! check_target "$target" "$expected_csv"; then
    failures=$((failures + 1))
  fi
done

if [[ "$failures" -gt 0 ]]; then
  echo "Health check failed: ${failures} endpoint(s) are not healthy."
  exit 1
fi

echo "Health check passed for ${#TARGET_SPECS[@]} endpoint(s)."
