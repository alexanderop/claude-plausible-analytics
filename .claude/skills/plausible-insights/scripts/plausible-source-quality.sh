#!/usr/bin/env bash
set -euo pipefail

# Analyze traffic source quality by combining volume + engagement metrics
# Usage: ./plausible-source-quality.sh [DATE_RANGE] [MIN_VISITORS]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUERY_SCRIPT="${SCRIPT_DIR}/plausible-quick-query.sh"

DATE_RANGE="${1:-7d}"
MIN_VISITORS="${2:-10}"

# Query traffic sources with engagement metrics
# Note: views_per_visit cannot be queried with dimensions in Plausible API
SOURCES_DATA=$("$QUERY_SCRIPT" "{
  \"metrics\":[\"visitors\",\"bounce_rate\",\"visit_duration\"],
  \"dimensions\":[\"visit:source\"],
  \"date_range\":\"$DATE_RANGE\",
  \"pagination\":{\"limit\":50,\"offset\":0}
}")

# Analyze and score each source
echo "$SOURCES_DATA" | jq \
  --argjson min_visitors "$MIN_VISITORS" \
  '
  # SEO knowledge-based scoring
  def quality_score:
    . as $metrics |
    (
      # Bounce rate score (0-60 points) - lower is better
      (if $metrics.bounce_rate <= 30 then 60
       elif $metrics.bounce_rate <= 50 then 45
       elif $metrics.bounce_rate <= 70 then 25
       else 0
       end) +

      # Visit duration score (0-40 points) - higher is better
      (if $metrics.visit_duration >= 180 then 40
       elif $metrics.visit_duration >= 60 then 30
       elif $metrics.visit_duration >= 30 then 15
       else 0
       end)
    );

  def quality_grade:
    if . >= 80 then "A - Excellent"
    elif . >= 60 then "B - Good"
    elif . >= 40 then "C - Acceptable"
    elif . >= 20 then "D - Poor"
    else "F - Very Poor"
    end;

  .results
  | map({
      source: .dimensions[0],
      visitors: .metrics[0],
      bounce_rate: .metrics[1],
      visit_duration: .metrics[2],
      quality_score: ({
        bounce_rate: .metrics[1],
        visit_duration: .metrics[2]
      } | quality_score),
    })
  | map(. + {quality_grade: (.quality_score | quality_grade)})
  | map(select(.visitors >= $min_visitors))
  | sort_by(-.quality_score)
  | {
      period: "'$DATE_RANGE'",
      min_visitors_filter: $min_visitors,
      summary: {
        total_sources: length,
        excellent: [.[] | select(.quality_score >= 80)] | length,
        good: [.[] | select(.quality_score >= 60 and .quality_score < 80)] | length,
        poor: [.[] | select(.quality_score < 40)] | length
      },
      sources: .
    }
  '
