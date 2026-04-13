#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
REVIEWER_LOGIN="${2:-none}"

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo> [reviewer-login|none]" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required. Install: https://cli.github.com/" >&2
  exit 1
fi

gh auth status >/dev/null

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/environments/production" \
  --input - <<'JSON'
{
  "wait_timer": 0,
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
JSON

if [[ "$REVIEWER_LOGIN" == "none" ]]; then
  echo "Environment 'production' updated for $REPO (without required reviewer)"
  exit 0
fi

REVIEWER_ID="$(gh api "/users/$REVIEWER_LOGIN" --jq '.id')"

set +e
REVIEWER_OUTPUT="$(
  gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "/repos/$REPO/environments/production" \
    --input - <<JSON 2>&1
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [
    {
      "type": "User",
      "id": $REVIEWER_ID
    }
  ],
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
JSON
)"
REVIEWER_STATUS=$?
set -e

if [[ "$REVIEWER_STATUS" -ne 0 ]]; then
  if [[ "$REVIEWER_OUTPUT" == *"billing plan supports the required reviewers"* || "$REVIEWER_OUTPUT" == *"HTTP 422"* ]]; then
    cat <<EOF
Environment 'production' was created, but required reviewer is not supported for this repository plan/visibility.
Repository: $REPO
Requested reviewer: $REVIEWER_LOGIN

If you need required reviewer protection:
1) make repository public on GitHub Free, or
2) upgrade to GitHub Pro/Team for private repository support.
EOF
    exit 0
  fi

  echo "$REVIEWER_OUTPUT" >&2
  exit "$REVIEWER_STATUS"
fi

echo "Environment 'production' updated for $REPO with reviewer $REVIEWER_LOGIN"
