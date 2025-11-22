# Quick Reference

## Common Commands

```bash
# Top pages with engagement
npx tsx lib/cli.ts top-pages --range 7d --limit 20

# Traffic sources ranked by quality
npx tsx lib/cli.ts sources --range 30d

# Week-over-week comparison
npx tsx lib/cli.ts compare --current 7d --previous 30d

# Find decaying content (>30% drop)
npx tsx lib/cli.ts decay --threshold 30

# Blog performance
npx tsx lib/cli.ts blog --range 7d --pattern "/posts/"
```

## Raw Query Patterns

```bash
# Top pages by visitors
npx tsx lib/cli.ts '{
  "metrics": ["visitors", "pageviews"],
  "dimensions": ["event:page"],
  "date_range": "7d",
  "pagination": {"limit": 50, "offset": 0},
  "order_by": [["visitors", "desc"]]
}'

# Landing page bounce rates
npx tsx lib/cli.ts '{
  "metrics": ["visitors", "bounce_rate", "visit_duration"],
  "dimensions": ["visit:entry_page"],
  "date_range": "7d",
  "pagination": {"limit": 50, "offset": 0}
}'

# Traffic sources
npx tsx lib/cli.ts '{
  "metrics": ["visitors", "bounce_rate", "visit_duration"],
  "dimensions": ["visit:source"],
  "date_range": "30d",
  "pagination": {"limit": 20, "offset": 0}
}'

# Filter by path pattern
npx tsx lib/cli.ts '{
  "metrics": ["visitors", "pageviews"],
  "dimensions": ["event:page"],
  "filters": [["contains", "event:page", ["/posts/"]]],
  "date_range": "30d",
  "pagination": {"limit": 50, "offset": 0}
}'
```

## Date Ranges

- `"day"` - Today
- `"7d"` - Last 7 days
- `"30d"` - Last 30 days
- `["2025-01-01", "2025-01-31"]` - Custom range

## Output Options

```bash
--format json    # Default, structured output
--format csv     # Pipe-friendly, comma-separated
--format table   # Human-readable table
--no-cache       # Bypass 5-minute cache
--extract path   # Extract specific value (e.g., "data.results[0]")
```
