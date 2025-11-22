# Common API Errors & Solutions

## Error: Cannot mix session metrics with event dimensions

```
INVALID_METRIC_DIMENSION_MIX: Cannot mix session metrics with event dimensions
```

**Cause**: Using `bounce_rate`/`visit_duration` with `event:page`

**Fix**: Use `visit:entry_page` instead of `event:page` for session metrics

```json
// WRONG
{"metrics": ["bounce_rate"], "dimensions": ["event:page"]}

// CORRECT
{"metrics": ["bounce_rate"], "dimensions": ["visit:entry_page"]}
```

## Error: Invalid pagination

```
Invalid request body
```

**Cause**: Using `"limit": N` instead of pagination object

**Fix**: Use `"pagination": {"limit": N, "offset": 0}` with dimensions

```json
// WRONG
{"dimensions": ["event:page"], "limit": 20}

// CORRECT
{"dimensions": ["event:page"], "pagination": {"limit": 20, "offset": 0}}
```

## Error: Invalid filter

```
Invalid filter ["is", "event:page", "/posts/*"]
```

**Cause**: Using wildcards with `is` operator

**Fix**: Use `contains` for substring or `matches` for regex

```json
// WRONG
["is", "event:page", ["/posts/*"]]

// CORRECT
["contains", "event:page", ["/posts/"]]
// OR
["matches", "event:page", ["^/posts/.*"]]
```

## Error: 401 Unauthorized

**Fix**: Check `PLAUSIBLE_API_KEY` in `.env`

## Error: 429 Rate Limited

**Fix**: Wait (600 requests/hour limit). CLI has 5-minute cache.

## Error: pageviews + visit:entry_page

```
Cannot mix event metrics with visit dimensions
```

**Cause**: `pageviews` is an event metric, `visit:entry_page` is a visit dimension

**Fix**: Use `event:page` for pageviews, or `visitors` with visit dimensions

```json
// WRONG
{"metrics": ["pageviews"], "dimensions": ["visit:entry_page"]}

// CORRECT
{"metrics": ["pageviews"], "dimensions": ["event:page"]}
// OR
{"metrics": ["visitors"], "dimensions": ["visit:entry_page"]}
```
