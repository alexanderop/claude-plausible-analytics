#!/usr/bin/env bash
set -uo pipefail

# --- CONFIGURATION ---
CACHE_DIR="${HOME}/.cache/plausible-cli"
LOG_FILE="${HOME}/.plausible-agent.log"
CACHE_TTL_SECONDS=300 # 5 minutes cache
API_URL="${PLAUSIBLE_API_URL:-https://plausible.io/api/v2/query}"

# --- DEPENDENCY CHECK ---
for cmd in jq curl md5sum date; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "{\"error\": \"Missing dependency: $cmd\"}" >&2
    exit 1
  fi
done

# --- HELP HELPERS ---
show_help() {
  echo "Usage: $0 [JSON_STRING] [OPTIONS]"
  echo "  --no-cache    Force fresh data"
  echo "  --extract     JQ path to extract (e.g., 'results[0].visitors')"
  echo ""
  echo "Examples:"
  echo "  $0 '{\"metrics\":[\"visitors\"],\"date_range\":\"7d\"}'"
  echo "  echo '...' | $0 --no-cache"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

# --- INPUT HANDLING ---
# Detect if input is coming from a pipe or argument
if [ -p /dev/stdin ]; then
  QUERY_JSON="$(cat)"
  # If an argument is also present, it might be flags
else
  if [ -n "${1:-}" ] && [[ "$1" != -* ]]; then
    QUERY_JSON="$1"
    shift
  else
    echo "{\"error\": \"No input JSON provided via stdin or argument.\"}" >&2
    exit 1
  fi
fi

# --- FLAG PARSING ---
USE_CACHE=1
EXTRACT_PATH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-cache) USE_CACHE=0; shift ;;
    --extract)  EXTRACT_PATH="$2"; shift 2 ;;
    *) echo "{\"error\": \"Unknown flag: $1\"}" >&2; exit 1 ;;
  esac
done

# --- JSON VALIDATION & NORMALIZATION ---
# We normalize the JSON (sort keys) so valid cache hits happen 
# regardless of key order (e.g. {"a":1,"b":2} == {"b":2,"a":1})
if ! CLEAN_JSON=$(echo "$QUERY_JSON" | jq -S . 2>/dev/null); then
  echo "{\"error\": \"Invalid JSON input\", \"details\": \"Ensure quotes are escaped or use stdin.\"}" >&2
  exit 1
fi

# Inject Site ID if missing
if ! echo "$CLEAN_JSON" | jq -e '.site_id' >/dev/null 2>&1; then
  if [ -n "${PLAUSIBLE_SITE_ID:-}" ]; then
    CLEAN_JSON=$(echo "$CLEAN_JSON" | jq --arg s "$PLAUSIBLE_SITE_ID" '.site_id = $s')
  else
    echo "{\"error\": \"Missing site_id in JSON and PLAUSIBLE_SITE_ID env var.\"}" >&2
    exit 1
  fi
fi

# --- CACHING LOGIC ---
mkdir -p "$CACHE_DIR"
QUERY_HASH=$(echo "$CLEAN_JSON" | md5sum | cut -d' ' -f1)
CACHE_FILE="$CACHE_DIR/$QUERY_HASH.json"
NOW=$(date +%s)

# Check if cache exists and is fresh
if [ "$USE_CACHE" -eq 1 ] && [ -f "$CACHE_FILE" ]; then
  FILE_TIME=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || stat -f %m "$CACHE_FILE")
  AGE=$((NOW - FILE_TIME))
  
  if [ "$AGE" -lt "$CACHE_TTL_SECONDS" ]; then
    # LOGGING: Log cache hit
    echo "[$(date -Iseconds)] [CACHE HIT] $CLEAN_JSON" >> "$LOG_FILE"
    
    RESPONSE=$(cat "$CACHE_FILE")
    # Jump to output
    if [ -n "$EXTRACT_PATH" ]; then
       echo "$RESPONSE" | jq -r ".${EXTRACT_PATH#.}"
    else
       echo "$RESPONSE"
    fi
    exit 0
  fi
fi

# --- EXECUTION ---
if [ -z "${PLAUSIBLE_API_KEY:-}" ]; then
  echo "{\"error\": \"PLAUSIBLE_API_KEY not set.\"}" >&2
  exit 1
fi

# Log the attempt
echo "[$(date -Iseconds)] [API REQ] $CLEAN_JSON" >> "$LOG_FILE"

# Curl request
RESPONSE=$(curl --silent --show-error --fail-with-body \
  --request POST \
  --header "Authorization: Bearer ${PLAUSIBLE_API_KEY}" \
  --header "Content-Type: application/json" \
  --url "$API_URL" \
  --data "$CLEAN_JSON")
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "[$(date -Iseconds)] [ERROR $EXIT_CODE] $RESPONSE" >> "$LOG_FILE"
  echo "{\"error\": \"API Request Failed\", \"code\": $EXIT_CODE, \"body\": $RESPONSE}" >&2
  exit $EXIT_CODE
fi

# Save to Cache
echo "$RESPONSE" > "$CACHE_FILE"

# --- OUTPUT ---
if [ -n "$EXTRACT_PATH" ]; then
  # Remove leading dot if present to allow "results" or ".results"
  CLEAN_PATH="${EXTRACT_PATH#.}"
  echo "$RESPONSE" | jq -r ".$CLEAN_PATH"
else
  echo "$RESPONSE"
fi