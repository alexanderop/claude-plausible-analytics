# Plausible SEO Consultant for Claude Code

Your personal SEO consultant powered by Plausible Analytics. Ask questions in natural language and get comprehensive analysis, pattern detection, and actionable SEO recommendations.

## What Makes This Different

This isn't just a query tool - it's an **SEO consultant that thinks**:

- 🔍 **Proactive Investigation**: Automatically digs deeper when it spots anomalies
- 📊 **Pattern Detection**: Identifies traffic spikes, engagement shifts, and content performance issues
- 🎯 **SEO Expertise**: Interprets metrics through an SEO lens with actionable recommendations
- ⚡ **Fast Analysis**: Optimized queries with no file I/O overhead
- 🧠 **Conversational**: Presents findings like a real consultant, not raw data dumps

### Example Interaction

**You ask:** "How many visitors today?"

**Traditional tool would say:** "283 visitors"

**This SEO consultant analyzes:**
- ✅ Traffic trends: Down 16% week-over-week (notable decrease)
- ✅ Engagement quality: Up 35% in visit duration (significant improvement!)
- ✅ Root cause: Reddit traffic crashed 63%, Google down 30%
- ✅ SEO interpretation: Trading quantity for quality - more engaged visitors
- ✅ Action items: Investigate Google rankings, capitalize on Twitter momentum

## Prerequisites

1. **Plausible Analytics Account**
   - Active account with tracked site(s)
   - Stats API key ([create here](https://plausible.io/settings#api-keys))

2. **System Dependencies**
   - `curl` (pre-installed on macOS/Linux)
   - `jq` - JSON processor
     ```bash
     # macOS
     brew install jq

     # Ubuntu/Debian
     apt install jq
     ```

3. **Claude Code**
   - This skill works with Claude Code CLI

## Setup

### 1. Get Your Plausible API Key

1. Log in to [Plausible Analytics](https://plausible.io)
2. Settings → API Keys
3. Create new **Stats API** key
4. Copy the key

### 2. Configure `.env` File

Copy the example and add your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
PLAUSIBLE_API_KEY="your-stats-api-key-here"
PLAUSIBLE_SITE_ID="your-site.com"  # Optional, can override per query

# Optional: For self-hosted Plausible
# PLAUSIBLE_API_URL="https://your-plausible-instance.com/api/v2/query"
```

### 3. Verify Installation

Test the fast query script:

```bash
# Make script executable (if not already)
chmod +x ./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh

# Test query (requires sourcing .env)
bash -c 'set -a && source .env && set +a && \
  ./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  "{\"metrics\":[\"visitors\"],\"date_range\":\"day\"}" \
  --extract "results[0].metrics[0]"'
```

Should return your visitor count for today (e.g., `284`).

## Usage with Claude Code

Simply ask questions naturally - the consultant will analyze and investigate automatically:

### Traffic Analysis
```
"How's my traffic?"
"What happened to my visitors this week?"
"Traffic overview"
```

**What you get:**
- 7-day comparison with previous period
- Traffic volume and engagement trends
- Automatic source investigation if anomalies detected
- SEO interpretation and recommendations

### Content Performance
```
"Which pages are performing well?"
"Show me my top content"
"Why is bounce rate high on /pricing?"
```

**What you get:**
- Top performing pages analysis
- High bounce rate investigations
- Entry page optimization opportunities
- Content quality insights with SEO context

### Specific Questions
```
"Why did traffic drop yesterday?"
"What's driving my engagement improvement?"
"Where are my visitors coming from?"
```

**What you get:**
- Targeted investigation of your specific question
- Multi-query drill-down analysis
- Pattern recognition and root cause analysis
- Actionable next steps

## How It Works

### SEO Knowledge Base

The consultant uses a comprehensive SEO knowledge base (`.claude/skills/plausible-insights/seo-knowledge.md`) that includes:

- **Metric interpretation guidelines** (what's "good" vs "poor" for bounce rate, duration, etc.)
- **SEO patterns** (viral content, intent mismatch, quality traffic signatures)
- **Investigation playbooks** (what to check when traffic drops, engagement improves, etc.)
- **Action thresholds** (when a change is notable vs significant)

### Analysis Recipes

Pre-built analysis patterns for common questions:

**`traffic-health.json`** - Overall site health
- Triggers: "traffic", "visitors", "overview", "health"
- Analyzes: 7-day trends, engagement quality, period comparison
- Auto-investigates: Source changes if traffic shifts >15%

**`content-performance.json`** - Page/content analysis
- Triggers: "content", "pages", "blog", "top pages"
- Analyzes: Top performers, high bounce pages, entry pages
- Identifies: Engagement patterns and optimization opportunities

### Autonomous Investigation

When the consultant spots something significant (>15% change), it automatically:
1. Runs follow-up queries to find the cause
2. Applies SEO expertise to interpret findings
3. Provides context-aware recommendations
4. Presents everything conversationally

## Advanced Usage

### Direct CLI Queries

For custom analysis, use the fast query script directly:

```bash
# Simple query with value extraction
bash -c 'set -a && source .env && set +a && \
  ./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  "{\"metrics\":[\"visitors\",\"pageviews\"],\"date_range\":\"7d\"}"'

# Complex query with dimensions
bash -c 'set -a && source .env && set +a && \
  ./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  "{\"metrics\":[\"visitors\"],\"dimensions\":[\"visit:source\"],\"date_range\":\"30d\",\"order_by\":[[\"visitors\",\"desc\"]]}"'
```

### Query Structure

```json
{
  "metrics": ["visitors", "pageviews", "bounce_rate", "visit_duration"],
  "date_range": "7d",
  "dimensions": ["event:page"],
  "filters": [["is", "visit:country", ["US", "CA"]]],
  "order_by": [["visitors", "desc"]],
  "pagination": {"limit": 20, "offset": 0}
}
```

**Common Metrics:**
- `visitors` - Unique visitors
- `pageviews` - Total pageviews
- `bounce_rate` - Single-page visit percentage
- `visit_duration` - Average session time (seconds)
- `views_per_visit` - Pages per session
- `time_on_page` - Average time per page (requires page filter/dimension)

**Common Dimensions:**
- `event:page` - Page URLs
- `visit:source` - Traffic sources (Google, Reddit, Direct, etc.)
- `visit:country_name` - Visitor countries
- `visit:entry_page` - Landing pages
- `visit:device` - Desktop, Mobile, Tablet
- `time:day` - Daily time series

**Date Ranges:**
- Shortcuts: `"day"`, `"7d"`, `"30d"`, `"month"`, `"6mo"`, `"year"`
- Custom: `["2024-01-01", "2024-01-31"]`
- Real-time: `["2024-01-01T12:00:00+02:00", "2024-01-01T12:05:00+02:00"]`

Full API docs: https://plausible.io/docs/stats-api

## File Structure

```
.claude/skills/plausible-insights/
├── SKILL.md                    # Main skill definition (SEO consultant behavior)
├── seo-knowledge.md           # SEO expertise knowledge base
├── recipes/
│   ├── traffic-health.json    # Traffic analysis recipe
│   └── content-performance.json  # Content analysis recipe
└── scripts/
    ├── plausible-quick-query.sh   # Fast query script (no file I/O)
    └── plausible-query.sh         # Legacy query script
```

## Troubleshooting

### Environment Variables Not Loading

**Error:** `PLAUSIBLE_API_KEY is not set in the environment`

**Fix:** The `.env` file needs to be sourced. When using the scripts directly, use:
```bash
bash -c 'set -a && source .env && set +a && ./script.sh ...'
```

When using with Claude Code, the skill handles this automatically.

### Missing `.env` File

**Error:** File not found

**Fix:**
```bash
cp .env.example .env
# Edit .env with your actual API key
```

### jq Not Installed

**Error:** `jq is required but not installed`

**Fix:**
```bash
brew install jq        # macOS
apt install jq         # Ubuntu/Debian
```

### Empty Results

**Possible causes:**
- Wrong site_id (check `.env` or query)
- API key doesn't have access to site
- Date range has no data
- Verify data exists in your Plausible dashboard

### Rate Limiting

Plausible limits to **600 requests/hour** per API key. The consultant is efficient but if you hit limits:
- Responses are cached within conversations
- Batch queries combine multiple metrics
- Consider spacing out heavy analysis sessions

## Performance

**Old approach (file-based):**
- Write query → Run script → Write result → Read result
- 3-4 file operations per query
- ~200-300ms overhead

**New approach (in-memory):**
- Direct query execution
- No file I/O
- ~50ms overhead
- Results returned directly or extracted with jq

## Examples

See real usage in action by asking:

```
"How's my traffic?"
→ Full traffic health analysis with period comparison

"Which content is performing best?"
→ Top pages with engagement metrics and SEO insights

"Why did traffic drop?"
→ Autonomous investigation with root cause analysis

"Show me traffic sources"
→ Source breakdown with quality assessment
```

## Contributing

Improvements welcome! This skill demonstrates:
- Recipe-based analysis patterns
- SEO knowledge integration
- Autonomous investigation
- Fast query optimization

Feel free to:
- Add new analysis recipes
- Expand SEO knowledge base
- Optimize query patterns
- Improve interpretation logic

## License

MIT License - Use freely with Claude Code and Plausible Analytics

---

**Built with:** Claude Code Skills Framework
**Powers:** SEO analysis through conversational AI
**Backed by:** Plausible Analytics API
