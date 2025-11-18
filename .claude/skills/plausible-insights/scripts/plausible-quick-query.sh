#!/usr/bin/env bash
set -euo pipefail

# Fast Plausible query without file I/O
# Usage: plausible-quick-query.sh '{"metrics":["visitors"],"date_range":"day"}'
# Usage: plausible-quick-query.sh '{"metrics":["visitors"],"date_range":"day"}' --extract 'results[0].metrics[0]'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# Load .env
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Check dependencies
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

if [ -z "${PLAUSIBLE_API_KEY:-}" ]; then
  echo "Error: PLAUSIBLE_API_KEY is not set in the environment." >&2
  exit 1
fi

API_URL="${PLAUSIBLE_API_URL:-https://plausible.io/api/v2/query}"

# Parse arguments
QUERY_JSON="$1"
EXTRACT_PATH="${2:-}"

# Inject site_id if not present
if ! echo "$QUERY_JSON" | jq -e '.site_id // empty' >/dev/null 2>&1; then
  if [ -n "${PLAUSIBLE_SITE_ID:-}" ]; then
    QUERY_JSON="$(printf '%s' "$QUERY_JSON" | jq --arg site_id "$PLAUSIBLE_SITE_ID" '.site_id = $site_id')"
  else
    echo "Error: No site_id provided." >&2
    exit 1
  fi
fi

# Call Plausible API
RESPONSE=$(curl --fail-with-body \
  --request POST \
  --header "Authorization: Bearer ${PLAUSIBLE_API_KEY}" \
  --header "Content-Type: application/json" \
  --silent \
  --show-error \
  --url "$API_URL" \
  --data "$QUERY_JSON")

# Extract specific value if requested
if [ "$EXTRACT_PATH" = "--extract" ] && [ -n "${3:-}" ]; then
  echo "$RESPONSE" | jq -r ".$3"
else
  echo "$RESPONSE"
fi
