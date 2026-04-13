#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
APPROVALS="${APPROVALS:-1}"

if [[ "${2:-}" == "--approvals" ]]; then
  APPROVALS="${3:-1}"
fi

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo> [--approvals <0|1|2...>]" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required. Install: https://cli.github.com/" >&2
  exit 1
fi

gh auth status >/dev/null

IS_PRIVATE="$(gh api "/repos/$REPO" --jq '.private')"
REQUIRE_CODEOWNERS="true"

if [[ "$APPROVALS" == "0" ]]; then
  REQUIRE_CODEOWNERS="false"
fi

apply_protection() {
  local branch="$1"
  local output
  local status

  set +e
  output="$(
    gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "/repos/$REPO/branches/$branch/protection" \
    --input - <<JSON 2>&1
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["check"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": $REQUIRE_CODEOWNERS,
    "required_approving_review_count": $APPROVALS,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false
}
JSON
  )"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    if [[ "$output" == *"Upgrade to GitHub Pro"* || "$output" == *"HTTP 403"* ]]; then
      cat <<EOF >&2
Branch protection is not available for private repositories on GitHub Free.
Repository: $REPO
Current visibility: private

Options:
1) Make repository public:
   gh repo edit $REPO --visibility public
2) Upgrade account plan to GitHub Pro/Team and retry.
EOF
      exit 2
    fi

    echo "$output" >&2
    exit "$status"
  fi
}

if [[ "$IS_PRIVATE" == "true" ]]; then
  echo "Detected private repository: $REPO"
  echo "If your plan is GitHub Free, branch protection will fail. Public repo is required."
fi

apply_protection "main"
apply_protection "dev"

echo "Branch protection rules updated for main and dev in $REPO"
