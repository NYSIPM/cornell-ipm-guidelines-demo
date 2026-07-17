#!/usr/bin/env bash
#
# test-cms-whoami.sh - verify the Phase 1 broker endpoint.
#
# It sends an Auth0 access token to the cms-whoami function and prints what the
# server sees: your sub, email, roles, and whether you can edit/publish.
#
# How to get an access token:
#   1. Open the site's /admin/ page and log in with Auth0.
#   2. Open the browser devtools console and run:
#        await window.TreatmentAuth.getTokenOrLogin()
#   3. Copy the printed token string (without quotes).
#
# Usage:
#   ./scripts/test-cms-whoami.sh <ENDPOINT_URL> <ACCESS_TOKEN>
#
# Example (Netlify branch preview):
#   ./scripts/test-cms-whoami.sh \
#     https://feature-cms-auth0-broker--dancing-sundae-a531d3.netlify.app/.netlify/functions/cms-whoami \
#     eyJhbGciOi...

set -euo pipefail

URL="${1:-}"
TOKEN="${2:-}"

if [ -z "$URL" ] || [ -z "$TOKEN" ]; then
  echo "Usage: $0 <ENDPOINT_URL> <ACCESS_TOKEN>" >&2
  exit 1
fi

echo "GET $URL"
echo "---"

# Capture body + HTTP status separately so a non-JSON (e.g. 404 HTML) response
# is still readable instead of crashing jq.
tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "$URL")"

echo "HTTP $code"
echo "---"

# Pretty-print only if the body actually looks like JSON.
if command -v jq >/dev/null 2>&1 && head -c1 "$tmp" | grep -q '{'; then
  jq . "$tmp"
else
  cat "$tmp"
  echo
fi

rm -f "$tmp"
