# Troubleshooting & Error Handling

## Common Errors

### Authentication Errors

**Error**: `401 Unauthorized` or `Invalid API key`

**Cause**: API key is missing, invalid, or expired

**Solution**:
```bash
# Check if API key is set
echo $PLAUSIBLE_API_KEY

# If empty, check .env file
cat .env | grep PLAUSIBLE_API_KEY

# Verify API key format (should start with letters/numbers, no quotes)
# Correct: PLAUSIBLE_API_KEY=abc123def456
# Wrong: PLAUSIBLE_API_KEY="abc123def456"
```

**Response to user**:
"Check `.env` file - API key may be invalid or missing. Ensure PLAUSIBLE_API_KEY is set correctly without quotes."

### No Data Returned

**Error**: Query returns empty results or `null`

**Cause 1**: No tracking data for the requested period
```bash
# Check if site has any data at all
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh '{"metrics":["visitors"],"date_range":"30d"}'

# If returns 0 or null, tracking may not be set up
```

**Response to user**:
"No data for this period - tracking may not have been active. Try a different date range or verify Plausible tracking is installed."

**Cause 2**: Date range is in the future or too far in the past
```bash
# Check if date range is valid
# Plausible only has data from when tracking was installed
```

**Response to user**:
"No data for this date range. Plausible only tracks data from when it was installed. Try a more recent period."

**Cause 3**: Filters are too restrictive
```bash
# Example: filtering for a page that doesn't exist
'{"filters":[["is","event:page",["/nonexistent-page"]]]}'
```

**Response to user**:
"No results match these filters. Double-check the page path or try broader filters."

### API Rate Limiting

**Error**: `429 Too Many Requests`

**Cause**: Exceeded API rate limit (600 requests per hour for standard plans)

**Solution**:
```bash
# plausible-quick-query.sh has 5-minute caching to reduce API calls
# Check cache hits in logs:
tail -20 ~/.plausible-agent.log | grep CACHE_HIT
```

**Response to user**:
"Approaching API limit (600/hour) - using cached data where available. Wait a few minutes before running more queries."

### Pagination Errors

**Error**: `400 Bad Request` when using dimensions

**Cause**: Missing or incorrect pagination syntax

**Wrong**:
```bash
# ❌ This will fail
'{"metrics":["visitors"],"dimensions":["event:page"],"limit":20}'
```

**Correct**:
```bash
# ✅ Use pagination object
'{"metrics":["visitors"],"dimensions":["event:page"],"pagination":{"limit":20,"offset":0}}'
```

**Response to user**:
"Pagination syntax error. When using dimensions, always use `\"pagination\":{\"limit\":N,\"offset\":0}` instead of standalone `\"limit\":N`."

### Invalid Metric Combinations

**Error**: `400 Bad Request` with message about incompatible metrics

**Cause**: Some metrics cannot be queried together or with dimensions

**Example**: `views_per_visit` cannot be queried with dimensions
```bash
# ❌ This will fail
'{"metrics":["views_per_visit"],"dimensions":["visit:source"]}'

# ✅ Query site-wide average separately
'{"metrics":["views_per_visit"],"date_range":"7d"}'
```

**Response to user**:
"This metric combination is not supported by Plausible. Query `views_per_visit` site-wide, then query other metrics by dimension separately."

### Date Calculation Errors (macOS vs Linux)

**Error**: `date: invalid date` when running scripts

**Cause**: Different date command syntax on macOS (BSD) vs Linux (GNU)

**macOS (BSD)**:
```bash
date -v-7d +%Y-%m-%d  # 7 days ago
```

**Linux (GNU)**:
```bash
date -d "7 days ago" +%Y-%m-%d
```

**Solution**: Scripts should detect OS and use appropriate syntax
```bash
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  PREV_DATE=$(date -v-7d +%Y-%m-%d)
else
  # Linux
  PREV_DATE=$(date -d "7 days ago" +%Y-%m-%d)
fi
```

### JSON Parsing Errors

**Error**: `jq: parse error` or malformed JSON

**Cause 1**: Shell variable expansion breaks JSON syntax
```bash
# ❌ Wrong - variables can break JSON
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors"],"date_range":["$START","$END"]}'

# ✅ Correct - use string concatenation outside quotes
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  "{\"metrics\":[\"visitors\"],\"date_range\":[\"$START\",\"$END\"]}"
```

**Cause 2**: Unescaped quotes in filter values
```bash
# ❌ Wrong
'{"filters":[["is","event:page",["Page with "quotes""]]]}'

# ✅ Correct
'{"filters":[["is","event:page",["Page with quotes"]]]}'
```

## Edge Cases

### Zero Visitors in a Period

**Scenario**: Comparing current period (0 visitors) vs previous period (100 visitors)

**Issue**: Percentage change calculation = -100% (correct) but might look alarming

**Handling**:
```bash
# The scripts handle this correctly, but presentation matters
if [ "$current_visitors" -eq 0 ]; then
  echo "No visitors in current period (down from $previous_visitors)"
else
  # Normal percentage calculation
fi
```

**Response to user**:
"No visitors this period (previously $X). This suggests tracking may be offline or there's a critical site issue. Check that Plausible script is still installed."

### Division by Zero

**Scenario**: Previous period had 0 visitors, current has 100

**Issue**: Cannot calculate percentage change (100/0 = undefined)

**Handling**:
```bash
if [ "$previous_visitors" -eq 0 ]; then
  echo "New traffic (0 → $current_visitors). Cannot calculate % change from zero baseline."
else
  # Normal calculation
fi
```

**Response to user**:
"Traffic went from 0 to $X visitors. This appears to be the first period with data, or tracking was recently activated."

### Very Large Numbers

**Scenario**: Site with >1M visitors per month

**Issue**: JSON numbers may lose precision, percentage calculations may overflow in bash

**Handling**:
```bash
# Use jq for large number calculations
CHANGE=$(echo "$current $previous" | jq -n --argjson cur "$1" --argjson prev "$2" \
  '(($cur - $prev) / $prev * 100)')
```

**Response to user**: Handle normally, but format large numbers with commas for readability
- Bad: "1523847 visitors"
- Good: "1,523,847 visitors"

### Invalid Date Ranges

**Scenario**: User asks for "last week" but it's Monday (previous week incomplete)

**Issue**: Ambiguous date ranges

**Handling**: Use AskUserQuestion to clarify
```markdown
AskUserQuestion:
"Do you want:
1. Last 7 days (Monday-Sunday, complete week)
2. Current week so far (Monday-Today)
3. Previous calendar week (Last Monday-Sunday)"
```

### Missing Pages (404s)

**Scenario**: Analytics shows traffic to `/old-page` but page no longer exists

**Issue**: WebFetch will fail to fetch the page

**Handling**:
```bash
# WebFetch will return error
# Check if page exists before making recommendations
```

**Response to user**:
"This page received $X visitors but returned 404 when I tried to fetch it. Either:
1. Set up a 301 redirect to the new location
2. Restore the page if it was deleted accidentally
3. Check if the URL in analytics is correct"

### Ambiguous Questions

**Scenario**: User asks "How's my site doing?"

**Issue**: Too broad - could mean traffic, SEO, content, technical, or all of above

**Handling**: Use AskUserQuestion to clarify before querying
```markdown
AskUserQuestion:
"What aspect would you like me to analyze?
1. Traffic health (visitors, trends, sources)
2. Content performance (which pages/posts work best)
3. SEO performance (organic traffic, rankings)
4. Comprehensive audit (all of the above)"
```

## Script-Specific Issues

### plausible-quick-query.sh

**Issue**: Cache directory not writable
```bash
# Error: Cannot write to ~/.plausible-cache/
# Solution: Create directory with correct permissions
mkdir -p ~/.plausible-cache
chmod 755 ~/.plausible-cache
```

**Issue**: `jq` not installed
```bash
# Error: command not found: jq
# Solution: Install jq
# macOS: brew install jq
# Linux: apt-get install jq / yum install jq
```

**Issue**: `curl` fails with SSL error
```bash
# Error: SSL certificate problem
# Solution: Update curl or use --insecure flag (not recommended)
curl --insecure ...
```

### plausible-compare-periods.sh

**Issue**: Date aliases not recognized
```bash
# Error: Unknown period: "last_week"
# Solution: Use supported aliases: day, yesterday, 7d, previous_7d, 30d, previous_30d
```

**Issue**: Metrics parameter format
```bash
# ❌ Wrong: Space-separated
./plausible-compare-periods.sh "visitors pageviews" "7d" "previous_7d"

# ✅ Correct: Comma-separated
./plausible-compare-periods.sh "visitors,pageviews" "7d" "previous_7d"
```

### plausible-source-quality.sh

**Issue**: No sources meet minimum visitor threshold
```bash
# All sources filtered out due to high threshold
# Solution: Lower the threshold
./plausible-source-quality.sh "7d" 5  # Instead of 50
```

**Response to user**:
"No traffic sources had at least $X visitors. Try a longer period or lower threshold."

## Debugging Tips

### Enable Verbose Logging

Check script execution:
```bash
# View recent queries
tail -50 ~/.plausible-agent.log

# Watch logs in real-time
tail -f ~/.plausible-agent.log

# Check for errors
grep ERROR ~/.plausible-agent.log
```

### Test API Connection

Verify basic connectivity:
```bash
# Test simplest possible query
./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh '{"metrics":["visitors"],"date_range":"day"}'

# Should return JSON like:
# {"results":[{"metrics":[284]}]}
```

### Validate JSON Syntax

Before sending complex queries:
```bash
# Test JSON is valid
echo '{"metrics":["visitors"],"date_range":"7d"}' | jq .

# If jq parses it without error, JSON is valid
```

### Check Environment Variables

```bash
# Verify all required env vars are set
echo "API Key: ${PLAUSIBLE_API_KEY:0:10}..."  # First 10 chars only
echo "Site ID: $PLAUSIBLE_SITE_ID"
echo "API URL: ${PLAUSIBLE_API_URL:-https://plausible.io/api/v2/query}"  # Shows default if not set
```

## When to Escalate to User

If these situations occur, ask the user for help:

1. **API authentication fails** - User needs to provide valid API key
2. **Site ID unknown** - User needs to specify which site to query
3. **No data for extended period** - May indicate tracking setup issue
4. **Ambiguous question** - Use AskUserQuestion to clarify intent
5. **Required tool missing** - User needs to install jq, curl, etc.

## Performance Optimization

### Reduce API Calls

**Problem**: Running same query multiple times wastes API quota

**Solution**: Cache is automatic in plausible-quick-query.sh (5-minute TTL)

**Best Practice**:
```bash
# Store result once, reuse multiple times
RESULT=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh '...')

# Extract different values from same result
VISITORS=$(echo "$RESULT" | jq '.results[0].metrics[0]')
BOUNCE=$(echo "$RESULT" | jq '.results[0].metrics[1]')
```

### Parallel WebFetch

**Problem**: Fetching pages sequentially is slow

**Solution**: Fetch 3-5 pages in parallel using multiple WebFetch calls in single message

**Best Practice**:
```markdown
[Send all WebFetch calls in ONE message, not separately]

WebFetch(url1, prompt1)
WebFetch(url2, prompt2)
WebFetch(url3, prompt3)
```

This is 3x faster than sequential fetching.
