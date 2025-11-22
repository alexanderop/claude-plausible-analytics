# Filter Syntax Reference

## Operators

| Operator | Use Case | Example |
|----------|----------|---------|
| `is` | Exact match (NO wildcards!) | `["is", "event:page", ["/about/"]]` |
| `is_not` | Exact exclusion | `["is_not", "visit:source", ["spam"]]` |
| `contains` | Substring match | `["contains", "event:page", ["/posts/"]]` |
| `contains_not` | Substring exclusion | `["contains_not", "event:page", ["/admin/"]]` |
| `matches` | Regex (re2 syntax) | `["matches", "event:page", ["^/posts/.*"]]` |
| `matches_not` | Regex exclusion | `["matches_not", "event:page", ["^/api/"]]` |

## Common Patterns

```json
// Blog posts only
["contains", "event:page", ["/posts/"]]

// Specific page
["is", "event:page", ["/pricing/"]]

// Regex for post slugs
["matches", "event:page", ["^/posts/[^/]+/$"]]

// From US only
["is", "visit:country", ["US"]]

// Case-insensitive
["contains", "event:page", ["blog"], {"case_sensitive": false}]
```

## Logical Operators

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

// Complex
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

## Filterable Dimensions

**Event dimensions**: `event:page`, `event:goal`, `event:hostname`
**Visit dimensions**: `visit:source`, `visit:referrer`, `visit:country`, `visit:device`, `visit:browser`, `visit:os`
**UTM**: `visit:utm_source`, `visit:utm_medium`, `visit:utm_campaign`

Note: Time dimensions (`time:day`, etc.) cannot be filtered. Use `date_range` instead.
