#!/usr/bin/env bash
#
# test-cms-git.sh - verify the full Phase 2 server chain end to end:
#   Auth0 token -> role check -> GitHub App installation token -> GitHub read.
#
# It reads a file from the repo *through the proxy*. An HTTP 200 with the file's
# JSON metadata proves the GitHub App token works and the proxy forwards
# correctly. (This exercises the server without needing Decap wired up yet.)
#
# Get an access token the same way as test-cms-whoami.sh: log into /admin/, then
# run `await window.TreatmentAuth.getTokenOrLogin()` in the devtools console.
#
# Usage:
#   ./scripts/test-cms-git.sh <BASE_URL> <ACCESS_TOKEN> [GITHUB_API_PATH]
#
# Example:
#   ./scripts/test-cms-git.sh \
#     https://deploy-preview-113--dancing-sundae-a531d3.netlify.app/cms-git \
#     eyJhbGciOi...
#
# The default path reads index.qmd; pass a different GitHub API path as arg 3.

set -euo pipefail

BASE="${1:-}"
TOKEN="${2:-}"
RPATH="${3:-repos/NYSIPM/cornell-ipm-guidelines-demo/contents/index.qmd}"

if [ -z "$BASE" ] || [ -z "$TOKEN" ]; then
  echo "Usage: $0 <BASE_URL e.g. https://<preview>/cms-git> <ACCESS_TOKEN> [github-api-path]" >&2
  exit 1
fi

URL="${BASE%/}/${RPATH}"
echo "GET $URL"
echo "---"

tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "$URL")"

echo "HTTP $code"
echo "---"

# On success, summarize the file metadata; otherwise print the raw body.
if command -v jq >/dev/null 2>&1 && head -c1 "$tmp" | grep -q '{'; then
  jq 'if .path then {name, path, sha, size} else . end' "$tmp"
else
  cat "$tmp"
  echo
fi

rm -f "$tmp"
