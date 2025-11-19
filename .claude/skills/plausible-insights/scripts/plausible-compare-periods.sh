#!/usr/bin/env bash
set -euo pipefail

# Compare two periods and calculate percent changes
# Usage: ./plausible-compare-periods.sh METRICS CURRENT_RANGE PREVIOUS_RANGE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUERY_SCRIPT="${SCRIPT_DIR}/plausible-quick-query.sh"

# Parse arguments
METRICS="${1:-visitors,pageviews,bounce_rate,visit_duration,views_per_visit}"
CURRENT_RANGE="${2:-7d}"
PREVIOUS_RANGE="${3:-previous_7d}"

# Convert date range shorthand to actual dates
convert_date_range() {
  local range="$1"

  case "$range" in
    "day"|"today")
      echo '"day"'
      ;;
    "7d"|"week")
      echo '"7d"'
      ;;
    "30d"|"month")
      echo '"30d"'
      ;;
    "previous_7d"|"last_week")
      # Calculate 14 days ago to 7 days ago
      if [[ "$OSTYPE" == "darwin"* ]]; then
        START=$(date -v-14d -v+1d +%Y-%m-%d)
        END=$(date -v-7d +%Y-%m-%d)
      else
        START=$(date -d "14 days ago" +%Y-%m-%d)
        END=$(date -d "7 days ago" +%Y-%m-%d)
      fi
      echo "[\"$START\",\"$END\"]"
      ;;
    "previous_30d"|"last_month")
      # Calculate 60 days ago to 30 days ago
      if [[ "$OSTYPE" == "darwin"* ]]; then
        START=$(date -v-60d -v+1d +%Y-%m-%d)
        END=$(date -v-30d +%Y-%m-%d)
      else
        START=$(date -d "60 days ago" +%Y-%m-%d)
        END=$(date -d "30 days ago" +%Y-%m-%d)
      fi
      echo "[\"$START\",\"$END\"]"
      ;;
    "yesterday")
      if [[ "$OSTYPE" == "darwin"* ]]; then
        DATE=$(date -v-1d +%Y-%m-%d)
      else
        DATE=$(date -d "yesterday" +%Y-%m-%d)
      fi
      echo "[\"$DATE\",\"$DATE\"]"
      ;;
    *)
      # Assume it's already a valid range (quote it as a string)
      echo "\"$range\""
      ;;
  esac
}

# Convert metrics to JSON array
METRICS_ARRAY=$(echo "$METRICS" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$";""))')

# Get current period data
CURRENT_RANGE_JSON=$(convert_date_range "$CURRENT_RANGE")
CURRENT_DATA=$("$QUERY_SCRIPT" "{\"metrics\":$METRICS_ARRAY,\"date_range\":$CURRENT_RANGE_JSON}")

# Get previous period data
PREVIOUS_RANGE_JSON=$(convert_date_range "$PREVIOUS_RANGE")
PREVIOUS_DATA=$("$QUERY_SCRIPT" "{\"metrics\":$METRICS_ARRAY,\"date_range\":$PREVIOUS_RANGE_JSON}")

# Calculate changes
jq -n \
  --argjson current "$CURRENT_DATA" \
  --argjson previous "$PREVIOUS_DATA" \
  --argjson metrics "$METRICS_ARRAY" \
  --arg current_range "$CURRENT_RANGE" \
  --arg previous_range "$PREVIOUS_RANGE" \
  '
  {
    summary: {
      current_period: $current_range,
      previous_period: $previous_range
    },
    metrics: (
      $metrics | to_entries | map({
        name: .value,
        current: $current.results[0].metrics[.key],
        previous: $previous.results[0].metrics[.key],
        change: {
          absolute: ($current.results[0].metrics[.key] - $previous.results[0].metrics[.key]),
          percent: (
            if $previous.results[0].metrics[.key] == 0 then 0
            else (
              (($current.results[0].metrics[.key] - $previous.results[0].metrics[.key]) /
               $previous.results[0].metrics[.key]) * 100
            )
            end
          ),
          direction: (
            if ($current.results[0].metrics[.key] > $previous.results[0].metrics[.key]) then "up"
            elif ($current.results[0].metrics[.key] < $previous.results[0].metrics[.key]) then "down"
            else "flat"
            end
          ),
          significance: (
            if (
              (($current.results[0].metrics[.key] - $previous.results[0].metrics[.key]) /
               $previous.results[0].metrics[.key] * 100) | abs
            ) >= 30 then "significant"
            elif (
              (($current.results[0].metrics[.key] - $previous.results[0].metrics[.key]) /
               $previous.results[0].metrics[.key] * 100) | abs
            ) >= 15 then "notable"
            else "normal"
            end
          )
        }
      })
    )
  }
  '
