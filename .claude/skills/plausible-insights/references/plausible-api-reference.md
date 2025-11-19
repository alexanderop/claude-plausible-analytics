# Plausible API Reference & Quirks

## API Endpoint
- **Base URL**: `https://plausible.io/api/v2/query`
- **Method**: POST
- **Authentication**: Bearer token in `Authorization` header
- **Rate Limit**: 600 requests/hour (default)

## Critical Query Structure Rules

### 1. Pagination Syntax (CRITICAL!)

**❌ WRONG - Will return 400 error:**
```json
{
  "metrics": ["visitors"],
  "dimensions": ["event:page"],
  "limit": 20
}
```

**✅ CORRECT - Use pagination object:**
```json
{
  "metrics": ["visitors"],
  "dimensions": ["event:page"],
  "pagination": {"limit": 20, "offset": 0}
}
```

**Rule**: When using `dimensions`, you MUST use the `pagination` object format. Never use standalone `limit`.

### 2. Filter Operators & Limitations

#### Available Operators
- `is` - Exact match (NO wildcards!)
- `is_not` - Exact exclusion
- `contains` - Substring match
- `contains_not` - Substring exclusion
- `matches` - Regex (re2 syntax)
- `matches_not` - Regex exclusion

#### Filter Examples

**✅ CORRECT - Exact match:**
```json
["is", "event:page", ["/posts/specific-post/"]]
```

**✅ CORRECT - Contains (substring):**
```json
["contains", "event:page", ["/posts/"]]
```

**✅ CORRECT - Regex:**
```json
["matches", "event:page", ["^/posts/.*"]]
```

**❌ WRONG - Wildcards not supported in `is`:**
```json
["is", "event:page", ["/posts/*"]]
```

#### Workarounds for Filtering Blog Posts

**Option 1: Use `contains` operator**
```bash
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"date_range":"7d","filters":[["contains","event:page",["/posts/"]]],"pagination":{"limit":50,"offset":0}}'
```

**Option 2: Fetch all data and filter client-side (recommended for complex patterns)**
```bash
# Get all pages
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["event:page"],"date_range":"7d","pagination":{"limit":200,"offset":0}}'

# Then filter with jq or Python
jq '.results[] | select(.dimensions[0] | startswith("/posts/"))'
```

**Option 3: Use regex with `matches`**
```bash
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors"],"date_range":"7d","filters":[["matches","event:page",["^/posts/[^/]+/$"]]],"pagination":{"limit":50,"offset":0}}'
```

### 3. Logical Operators

```json
// AND (implicit at top level)
"filters": [
  ["is", "visit:country", ["US"]],
  ["contains", "event:page", ["/blog"]]
]

// OR
"filters": [
  ["or", [
    ["is", "visit:country", ["US"]],
    ["is", "visit:country", ["CA"]]
  ]]
]

// NOT
"filters": [
  ["not", ["is", "visit:country", ["US"]]]
]

// Complex combination
"filters": [
  ["and", [
    ["contains", "event:page", ["/posts/"]],
    ["or", [
      ["is", "visit:country", ["US"]],
      ["is", "visit:country", ["CA"]]
    ]]
  ]]
]
```

### 4. Date Ranges

```json
// Relative
"date_range": "day"      // Today
"date_range": "7d"       // Last 7 days
"date_range": "30d"      // Last 30 days
"date_range": "month"    // Since start of current month
"date_range": "year"     // Since start of current year
"date_range": "all"      // All time

// Absolute (ISO8601)
"date_range": ["2025-01-01", "2025-12-31"]
"date_range": ["2025-01-01T00:00:00+01:00", "2025-01-01T23:59:59+01:00"]
```

### 5. Metrics

#### Available Metrics
- `visitors` - Unique visitors
- `visits` - Sessions
- `pageviews` - Page views
- `events` - All events (pageviews + custom events)
- `bounce_rate` - Bounce rate percentage (0-100)
- `visit_duration` - Average visit duration in seconds
- `views_per_visit` - Pages per session
- `scroll_depth` - Page scroll depth (requires `event:page` dimension)
- `time_on_page` - Time on page in seconds (requires `event:page` dimension)
- `percentage` - Percentage of total (requires dimensions)
- `conversion_rate` - Goal conversion rate (requires `event:goal`)

#### Metric Requirements & Restrictions

**⚠️ Cannot mix session metrics with event dimensions:**
```json
// ❌ WRONG - session metrics with event dimension
{
  "metrics": ["bounce_rate", "visit_duration"],
  "dimensions": ["event:page"]
}
```

**Session metrics**: `bounce_rate`, `views_per_visit`, `visit_duration`

**Event dimensions**: `event:goal`, `event:page`, `event:hostname`

Use **visit dimensions** instead when querying session metrics.

### 6. Dimensions

#### Event Dimensions (cannot use with session metrics!)
- `event:page` - Page pathname
- `event:goal` - Goal name
- `event:hostname` - Hostname
- `event:props:<property>` - Custom properties

#### Visit Dimensions (use with session metrics)
- `visit:entry_page` - Landing page
- `visit:exit_page` - Exit page
- `visit:source` - Traffic source
- `visit:referrer` - Referrer
- `visit:utm_medium`, `visit:utm_source`, `visit:utm_campaign`, etc.
- `visit:device` - Desktop/Mobile/Tablet
- `visit:browser`, `visit:os`
- `visit:country`, `visit:region`, `visit:city`
- `visit:country_name`, `visit:region_name`, `visit:city_name`

#### Time Dimensions
- `time` - Auto-bucket based on date range
- `time:hour`, `time:day`, `time:week`, `time:month`

**Note**: Time dimensions cannot be used in filters. Use `date_range` instead.

### 7. Ordering

```json
"order_by": [["visitors", "desc"], ["bounce_rate", "asc"]]
```

**Default ordering**:
- If time dimension present: `[time_dimension, "asc"]`
- Otherwise: `[first_metric, "desc"]`

### 8. Include Options

```json
"include": {
  "imports": true,          // Try to include imported data
  "time_labels": true,      // Include all time labels for range
  "total_rows": true        // Include total row count (for pagination)
}
```

## API Quirks & Limitations

### 1. No Wildcard Support in `is` Operator
- The `is` operator only supports **exact matches**
- Use `contains` for substring matching
- Use `matches` with regex for pattern matching
- Or fetch all data and filter client-side

### 2. Metric Values May Vary
When requesting different metric combinations, values may slightly differ (<1%) due to different database tables and heuristics being used.

### 3. Imported Data Limitations
Imported data from Google Analytics may not be included for certain metric/dimension combinations. Check `meta.imports_included` and `meta.imports_skip_reason` in response.

### 4. Empty Time Buckets Not Returned
If no data exists for a time bucket, it won't be in results. Use `include.time_labels` to get all expected labels.

### 5. Case Sensitivity
Filters are case-sensitive by default. Use modifier for case-insensitive:
```json
["contains", "event:page", ["blog"], {"case_sensitive": false}]
```

## Common Query Patterns

### Get Top Pages
```json
{
  "site_id": "example.com",
  "metrics": ["visitors", "pageviews", "bounce_rate"],
  "dimensions": ["event:page"],
  "date_range": "30d",
  "pagination": {"limit": 50, "offset": 0},
  "order_by": [["visitors", "desc"]]
}
```

### Get Blog Posts Only (using contains)
```json
{
  "site_id": "example.com",
  "metrics": ["visitors", "bounce_rate"],
  "date_range": "7d",
  "filters": [["contains", "event:page", ["/posts/"]]],
  "dimensions": ["event:page"],
  "pagination": {"limit": 50, "offset": 0}
}
```

### Compare Time Periods
```bash
# Current period
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors"],"date_range":"7d"}'

# Previous period (calculate dates dynamically)
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors"],"date_range":["2025-01-01","2025-01-07"]}'
```

### Traffic Sources Analysis
```json
{
  "site_id": "example.com",
  "metrics": ["visitors", "bounce_rate", "visit_duration"],
  "dimensions": ["visit:source"],
  "date_range": "30d",
  "pagination": {"limit": 20, "offset": 0},
  "order_by": [["visitors", "desc"]]
}
```

### Goal Conversions
```json
{
  "site_id": "example.com",
  "metrics": ["visitors", "conversion_rate"],
  "dimensions": ["event:goal"],
  "date_range": "30d",
  "pagination": {"limit": 10, "offset": 0}
}
```

## Error Handling

### Common Errors

**400 Bad Request: Invalid filter**
```json
{"error":"#/filters/0: Invalid filter [\"is\", \"event:page\", \"/posts/*\"]"}
```
**Solution**: Don't use wildcards with `is`. Use `contains` or `matches` instead.

**400 Bad Request: Invalid pagination**
```json
{"error": "Invalid request body"}
```
**Solution**: Use `"pagination": {"limit": N, "offset": 0}` not `"limit": N`

**401 Unauthorized**
**Solution**: Check `PLAUSIBLE_API_KEY` in `.env`

**429 Rate Limit**
**Solution**: Wait. Default limit is 600 requests/hour. Our script has 5-minute caching.

## Best Practices

1. **Always use pagination object** when querying with dimensions
2. **Fetch and filter client-side** for complex patterns (faster than multiple API calls)
3. **Use `contains`** for substring matching, not `is` with wildcards
4. **Cache aggressively** - our script caches for 5 minutes automatically
5. **Request only needed metrics** to avoid performance issues
6. **Use appropriate dimensions** - visit dimensions for session metrics, event dimensions for event metrics
7. **Check `meta` field** for warnings about imports or metric calculations
8. **Use `include.total_rows`** for pagination to know total count

## Response Structure

```json
{
  "results": [
    {
      "dimensions": ["value1", "value2"],
      "metrics": [100, 50, 75]
    }
  ],
  "meta": {
    "imports_included": false,
    "imports_skip_reason": "...",
    "time_labels": [...],
    "total_rows": 342
  },
  "query": {
    // Processed query that was executed
  }
}
```

## References

- [Official Plausible Stats API Docs](https://plausible.io/docs/stats-api)
- [API Playground](https://plausible.io/docs/stats-api-playground)
- [Events API](https://plausible.io/docs/events-api) (for recording events, not stats)
