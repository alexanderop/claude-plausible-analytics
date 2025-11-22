# Plausible SEO Consultant for Claude Code

Your personal SEO consultant powered by Plausible Analytics. Ask questions in natural language and get **specific, actionable recommendations** based on your actual page content.

**Quick Start:** Ask "how did my blog perform this week" and get diagnosis with specific fixes, not just metrics.

## What Makes This Different

An **SEO consultant that thinks**, not just a query tool:

- **Proactive Investigation**: Automatically digs deeper when it spots anomalies
- **Content Analysis**: Fetches and reads your actual pages to understand root causes
- **SEO Expertise**: Interprets metrics through an SEO lens with actionable recommendations
- **Fast Analysis**: Optimized queries with no file I/O overhead
- **Parallel Subagents**: Comprehensive audits run 4 analyses simultaneously

## Setup

**Prerequisites:**
- Plausible Analytics account with Stats API key ([create here](https://plausible.io/settings#api-keys))
- Node.js >= 18, `tsx` installed

**Install:**
1. Copy `.env.example` to `.env`
2. Add your API key and site ID to `.env`
3. Test: `npx tsx .claude/skills/plausible-insights/lib/cli.ts top-pages --range 7d`

## CLI Commands

### High-Level Commands (Recommended)

```bash
# Top pages with engagement metrics
npx tsx lib/cli.ts top-pages --range 7d --limit 20

# Traffic sources ranked by quality
npx tsx lib/cli.ts sources --range 30d

# Compare time periods
npx tsx lib/cli.ts compare --current 7d --previous 30d

# Find decaying content
npx tsx lib/cli.ts decay --threshold 30 --pattern "/posts/"

# Blog performance
npx tsx lib/cli.ts blog --range 7d --pattern "/posts/"
```

### Raw Queries

```bash
# Execute raw API query
npx tsx lib/cli.ts '{"metrics":["visitors"],"date_range":"7d"}'

# With dimensions
npx tsx lib/cli.ts '{
  "metrics": ["visitors", "pageviews"],
  "dimensions": ["event:page"],
  "date_range": "7d",
  "pagination": {"limit": 50, "offset": 0}
}'
```

### Output Options

```bash
--format json    # Default, structured output
--format csv     # Pipe-friendly, comma-separated
--format table   # Human-readable table
--no-cache       # Bypass 5-minute cache
--extract path   # Extract specific value (e.g., "data.results[0]")
```

### Bash Wrapper

```bash
# Even simpler invocation
./.claude/skills/plausible-insights/scripts/plausible top-pages --range 7d
```

## Natural Language Usage

Ask questions naturally in Claude Code:

```
"how did my blog perform this week"
→ Full analysis: metrics, page content review, specific fixes

"How's my traffic?"
→ 7-day comparison with source investigation

"Which pages are performing well?"
→ Top pages with actual content analysis and optimization opportunities

"Run a comprehensive audit"
→ Parallel analysis (Traffic + Content + Engagement + Technical)
```

## Architecture

The skill follows Mario Zechner's CLI-first principles for minimal token usage:

```
.claude/skills/plausible-insights/
├── SKILL.md                    # ~500 tokens (was ~2,000)
├── lib/
│   ├── cli.ts                  # 7 commands: top-pages, sources, compare, decay, blog, query, cache
│   ├── client/                 # API client with Zod validation
│   └── queries/                # Query builders (basic + SEO helpers)
├── references/
│   ├── quick-ref.md            # Common patterns (~300 tokens)
│   ├── api/
│   │   ├── filters.md          # Filter syntax
│   │   └── errors.md           # Error solutions
│   └── seo/
│       └── thresholds.md       # Interpretation guidelines
├── recipes/                    # Analysis patterns
└── scripts/
    └── plausible               # Bash wrapper
```

**Token Efficiency:**
- Minimum load: ~500 tokens (SKILL.md only)
- Simple queries: ~800 tokens (+ quick-ref.md)
- Full context: ~8,000 tokens (on-demand loading)

## Key Principles

1. **CLI-first**: High-level commands for common tasks, raw queries for complex ones
2. **Progressive disclosure**: Load context only when needed
3. **Composable outputs**: JSON/CSV/table formats for piping and chaining
4. **Always fetch pages**: Data shows symptoms, content shows causes

## Troubleshooting

**Environment Variables Not Loading** - Use the bash wrapper or `source .env`

**Session metrics + event:page error** - Use `visit:entry_page` for bounce_rate

**Invalid pagination** - Use `{"pagination": {"limit": N, "offset": 0}}` with dimensions

See `references/api/errors.md` for more solutions.

## License

MIT License - Built with Claude Code Skills Framework, powered by Plausible Analytics API
