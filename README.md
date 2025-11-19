# Plausible SEO Consultant for Claude Code

Your personal SEO consultant powered by Plausible Analytics. Ask questions in natural language and get **specific, actionable recommendations** based on your actual page content.

**Quick Start:** Ask "how did my blog perform this week" and get diagnosis with specific fixes, not just metrics.

## What Makes This Different

An **SEO consultant that thinks**, not just a query tool:

- 🔍 **Proactive Investigation**: Automatically digs deeper when it spots anomalies
- 📄 **Content Analysis**: Fetches and reads your actual pages to understand root causes
- 🎯 **SEO Expertise**: Interprets metrics through an SEO lens with actionable recommendations
- ⚡ **Fast Analysis**: Optimized queries with no file I/O overhead
- 🤖 **Parallel Subagents**: Comprehensive audits run 4 analyses simultaneously

### Example

**Asked:** "how did my blog perform this week"

**Delivered:**
1. Analyzed metrics (3 parallel queries) - spotted 74% bounce rate as the real issue
2. Fetched and read 4 pages - found homepage has 50% bounce, blog posts have 80%
3. Root cause: Homepage has clear pathways immediately; blog posts have internal links only at bottom
4. Specific fixes with exact copy: Add internal links in first 3 paragraphs, move newsletter CTA from 100% scroll to 30%
5. Expected impact: 74% → 60% bounce improvement

## Setup

**Prerequisites:**
- Plausible Analytics account with Stats API key ([create here](https://plausible.io/settings#api-keys))
- `jq` installed (`brew install jq` on macOS)

**Install:**
1. Copy `.env.example` to `.env`
2. Add your API key and site ID to `.env`
3. Test: `bash -c 'set -a && source .env && set +a && ./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh "{\"metrics\":[\"visitors\"],\"date_range\":\"day\"}"'`

## Usage

Ask questions naturally:

```
"how did my blog perform this week"
→ Full analysis: metrics, page content review, specific fixes, saved report

"How's my traffic?"
→ 7-day comparison with source investigation

"Which pages are performing well?"
→ Top pages with actual content analysis and optimization opportunities

"Run a comprehensive audit"
→ Parallel analysis (Traffic + Content + Engagement + Technical)
```

The consultant automatically:
- Compares periods and identifies real issues
- Fetches and reads actual pages to find root causes
- Provides specific fixes with expected impact
- Saves detailed reports to `reports/` folder

## How It Works

**SEO Knowledge Base** - Comprehensive guidelines for metric interpretation, SEO patterns, investigation playbooks, and action thresholds

**Analysis Recipes** - Pre-built patterns triggered by keywords:
- `traffic-health.json` - Site health (triggers: "traffic", "visitors", "overview")
- `content-performance.json` - Page analysis (triggers: "content", "pages", "blog")
- `seo-health.json` - Organic search (triggers: "SEO", "organic", "search traffic")
- `traffic-decay.json` - Content decay (triggers: "decay", "declining")
- `weekly-performance-parallel.json` - Comprehensive audit (triggers: "comprehensive", "full audit")

**Autonomous Investigation** - When changes >15% detected, automatically runs follow-up queries, applies SEO expertise, and provides recommendations

**Page Content Analysis** - Fetches and reads actual pages to compare success vs problem patterns. Traditional tool says "Add CTAs to reduce bounce". This consultant says "Your blog posts have 80% bounce because internal links appear after 2,000 words. Add this navigation box in first 3 paragraphs: [exact copy]. Expected impact: 80% → 65% bounce."

## Advanced Usage

**Direct CLI Queries:**
```bash
bash -c 'set -a && source .env && set +a && \
  ./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  "{\"metrics\":[\"visitors\"],\"dimensions\":[\"visit:source\"],\"date_range\":\"30d\"}"'
```

**Query Structure:** Metrics (`visitors`, `pageviews`, `bounce_rate`, `visit_duration`), Dimensions (`event:page`, `visit:source`, `visit:entry_page`), Date ranges (`"7d"`, `"30d"`, `["2024-01-01", "2024-01-31"]`)

Full API docs: https://plausible.io/docs/stats-api

## Troubleshooting

**Environment Variables Not Loading** - Use `bash -c 'set -a && source .env && set +a && ./script.sh'`

**Missing jq** - `brew install jq` (macOS) or `apt install jq` (Linux)

**Empty Results** - Check site_id in `.env`, verify API key access, confirm data exists in Plausible dashboard

**Rate Limiting** - 600 requests/hour limit. Responses cached within conversations, queries batched automatically.

## File Structure

```
.claude/skills/plausible-insights/
├── SKILL.md                    # Main skill definition
├── seo-knowledge.md            # SEO expertise knowledge base
├── recipes/                    # Analysis patterns (traffic-health, content-performance, etc.)
├── scripts/                    # Query utilities (plausible-quick-query.sh, etc.)
├── references/                 # Workflows, examples, troubleshooting
└── reports/                    # Generated analysis reports
```

## Contributing

Improvements welcome! Add new analysis recipes, expand SEO knowledge base, create utility scripts, optimize query patterns. See `references/` for detailed documentation (workflows, examples, troubleshooting).

## License

MIT License - Built with Claude Code Skills Framework, powered by Plausible Analytics API
