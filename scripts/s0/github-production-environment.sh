#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
REVIEWER_LOGIN="${2:-}"

if [[ -z "$REPO" || -z "$REVIEWER_LOGIN" ]]; then
  echo "Usage: $0 <owner/repo> <reviewer-login>" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required. Install: https://cli.github.com/" >&2
  exit 1
fi

gh auth status >/dev/null

REVIEWER_ID="$(gh api "/users/$REVIEWER_LOGIN" --jq '.id')"

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/environments/production" \
  --input - <<JSON
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

echo "Environment 'production' updated for $REPO with reviewer $REVIEWER_LOGIN"
