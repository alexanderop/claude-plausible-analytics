# Detailed Workflow Examples

## Recipe Mode (Standard Queries)

### Example: Traffic Health Check

**User asks: "How's my traffic?"**

**Step 1: Read the recipe**
```bash
cat ./.claude/skills/plausible-insights/recipes/traffic-health.json
```

**Step 2: Run queries from recipe (calculate dates dynamically)**
```bash
# Calculate previous 7d dates
PREV_START=$(date -v-14d -v+1d +%Y-%m-%d)  # 14 days ago
PREV_END=$(date -v-7d +%Y-%m-%d)            # 7 days ago

# Current 7d
CURRENT=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","pageviews","bounce_rate","visit_duration","views_per_visit"],"date_range":"7d"}')

# Previous 7d
PREVIOUS=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  "{\"metrics\":[\"visitors\",\"pageviews\",\"bounce_rate\",\"visit_duration\",\"views_per_visit\"],\"date_range\":[\"$PREV_START\",\"$PREV_END\"]}")

# Today
TODAY=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","pageviews","bounce_rate"],"date_range":"day"}')
```

**Step 3: Interpret using recipe + SEO knowledge**
- Compare current vs previous using thresholds (15% = notable, 30% = significant)
- Check SEO insight conditions from recipe
- Apply knowledge base guidelines

**Step 4: Auto-investigate anomalies**

If you find a significant change (>15%), automatically dig deeper:

**Traffic spike**:
```bash
# Check which pages and sources are driving the spike
TOP_PAGES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["event:page"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')

SOURCES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors"],"dimensions":["visit:source"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')

# FETCH the spiking page to understand WHY
# Use WebFetch with prompt: "This page is receiving a traffic spike (X visitors from Y source). Analyze the content to understand what's resonating with this audience."
```

**Bounce rate increase**:
```bash
# Find which pages have highest bounce
HIGH_BOUNCE=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate","visit_duration"],"dimensions":["event:page"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')

# FETCH high-bounce pages to find specific issues
# Use WebFetch with prompt: "This page has X% bounce rate. Analyze content quality, opening hook, internal links, CTAs, and navigation. What specific issues might cause users to leave?"
```

**Duration drop**:
```bash
# Analyze by page and entry point
BY_PAGE=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visit_duration","visitors"],"dimensions":["event:page"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')

ENTRY_PAGES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visit_duration","bounce_rate"],"dimensions":["visit:entry_page"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')

# FETCH affected pages to identify content changes or issues
# Use WebFetch with prompt: "This page's engagement time dropped. Analyze content length, readability, internal linking, and user journey. What changed or what's missing?"
```

## Parallel Subagent Analysis (Comprehensive Audits)

### When to Use

✅ User requests comprehensive/full/thorough audit
✅ Multiple independent analyses needed (traffic + content + engagement + technical)
✅ Speed matters (4x faster than sequential)

### How It Works

**Step 1: Read the comprehensive-audit recipe**
```bash
cat ./.claude/skills/plausible-insights/recipes/comprehensive-audit.json
```

**Step 2: Dispatch 4 subagents in PARALLEL (single message with 4 Task tool calls)**

**CRITICAL:** You MUST send all 4 Task tool calls in a SINGLE message for true parallelization. Do NOT send them sequentially.

```markdown
I'll conduct a comprehensive site audit using 4 parallel subagents for speed and depth.

[Dispatch all 4 Task tool calls in a SINGLE message:]

Task 1 - Traffic Analysis:
{traffic_analyst prompt from recipe}

Task 2 - Content Performance:
{content_analyst prompt from recipe}

Task 3 - User Engagement:
{engagement_analyst prompt from recipe}

Task 4 - Technical Analysis:
{technical_analyst prompt from recipe}
```

**Step 3: Wait for all reports**

Each subagent will return with its analysis report. Do not synthesize until ALL 4 have reported back.

**Step 4: Synthesize findings**

Once all reports are in, create unified report:

```markdown
# Comprehensive Site Audit - {site_name}

## Executive Summary
[3-5 most critical findings across all reports]

## Traffic Health
[Key insights from traffic_analyst]

## Content Performance
[Key insights from content_analyst]

## Engagement Quality
[Key insights from engagement_analyst]

## Technical Issues
[Key insights from technical_analyst]

## Priority Action Plan

### 🔴 Critical (Do Now)
1. [Most urgent issue with specific action]

### 🟡 High Priority (This Week)
2. [Important improvement]
3. [Another important item]

### 🟢 Medium Priority (This Month)
4. [Optimization opportunity]
5. [Enhancement idea]
```

### Cross-Analysis Patterns to Look For

- Traffic growing but engagement declining = lower quality sources
- High mobile bounce vs desktop = mobile UX issues
- Top pages with high bounce = missing CTAs/internal links
- Organic traffic declining = SEO/technical problem

## Autonomous Mode Patterns

### Pattern: Specific Page Investigation

**User asks: "Why is bounce rate high on /pricing?"**

```bash
# 1. Start with the specific page metrics
PRICING=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate","time_on_page"],"date_range":"7d","filters":[["is","event:page",["/pricing"]]]}')

# 2. Compare to site average
AVG=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["bounce_rate"],"date_range":"7d"}')

# 3. Check traffic sources to /pricing
SOURCES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["visit:source"],"date_range":"7d","filters":[["is","visit:entry_page",["/pricing"]]],"pagination":{"limit":10,"offset":0}}')

# 4. CRITICAL: Fetch the actual /pricing page
# Use WebFetch to read the page content and identify specific issues
# Prompt: "This pricing page has X% bounce rate vs Y% site average. Analyze content, CTAs, value proposition, pricing clarity, trust signals, and navigation. What might cause the high bounce?"

# 5. For context, fetch homepage or a lower-bounce page for comparison
# Prompt: "This page has Z% bounce rate (better than /pricing). What does it do differently in terms of structure, CTAs, and user journey?"
```

Analyze results combining analytics data + actual page content, apply SEO knowledge, present specific findings with actionable recommendations based on what you read.

### Pattern: Content Performance Analysis

**User asks: "Which of my blog posts are performing well?"**

```bash
# 1. Get top pages by traffic
TOP_PAGES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate","visit_duration"],"dimensions":["event:page"],"date_range":"30d","pagination":{"limit":20,"offset":0}}')

# 2. Filter for blog posts (if needed, use jq)
BLOG_POSTS=$(echo "$TOP_PAGES" | jq '.results[] | select(.dimensions[0] | contains("/blog/") or contains("/posts/"))')

# 3. Identify patterns
# - High traffic + low bounce = success pattern
# - High traffic + high bounce = hook/content issue
# - Low traffic + low bounce = hidden gem (needs promotion)

# 4. FETCH 3-5 pages in parallel
# - Top performer (highest traffic)
# - Success pattern (low bounce, good engagement)
# - Problem page (high bounce despite traffic)
# - Entry page (where users land first)

# 5. Analyze fetched content
# Compare what works vs what doesn't:
# - Opening hooks
# - Content structure
# - Internal linking
# - CTAs and next steps

# 6. Provide specific recommendations
# - Replicate success patterns ("Your post X has 30% bounce because it [specific pattern]. Apply this to posts Y and Z.")
# - Fix problem pages ("Post A bounces at 80% because [specific issue]. Change [this specific element].")
# - Promote hidden gems ("Post B has 20% bounce but only 50 visitors. Share on [specific channels].")
```

### Pattern: Traffic Source Quality

**User asks: "Which traffic sources are best for my site?"**

```bash
# 1. Use the source quality script
SOURCE_QUALITY=$(./.claude/skills/plausible-insights/scripts/plausible-source-quality.sh "30d" 50)

# 2. Analyze results
# - Grade A/B sources = double down (high engagement)
# - Grade D/F sources = investigate or deprioritize
# - Compare bounce rate + duration across sources

# 3. For each major source, check what pages they visit
# Example for Google:
GOOGLE_PAGES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["event:page"],"filters":[["is","visit:source",["Google"]]],"date_range":"30d","pagination":{"limit":10,"offset":0}}')

# Example for Twitter:
TWITTER_PAGES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["event:page"],"filters":[["is","visit:source",["Twitter"]]],"date_range":"30d","pagination":{"limit":10,"offset":0}}')

# 4. FETCH top pages from each source
# Prompt: "This page gets most of its traffic from [source]. Analyze how the content appeals to [source audience]. What makes it resonate?"

# 5. Provide source-specific recommendations
# - "Google visitors prefer long-form guides like [example]. Create more content like this."
# - "Twitter visitors engage with quick takes and controversial opinions. Your [specific post] works because [reason]."
# - "Reddit traffic bounces at 80% because [specific mismatch]. Either adjust content or skip Reddit promotion."
```

## Presenting Insights Conversationally

### Good Example

"Your traffic is up 25% this week (850 → 1,063 visitors). Let me check what's driving this...

[*Fetches and reads /blog/new-post*]

The spike is from /blog/new-post (320 visitors from Hacker News). I read the post - it's well-written with 2-3 minute read time, but has 68% bounce rate.

Here's the issue: The post ends abruptly without guiding readers anywhere. Your homepage has 50% bounce because it offers clear next steps (Posts, TILs, Projects). This post doesn't.

**Specific fix**: Add this section before your conclusion:

```markdown
## Related Articles
- [Link to related post 1]
- [Link to related post 2]

Want more content like this? [Subscribe to my newsletter](#)
```

This mirrors your homepage's successful navigation pattern."

### Bad Example (Don't Do This)

"Visitors: 1063. Previous: 850. Change: +25%. Add CTAs to posts."

### Why the Good Example Works

1. **Conversational**: Explains findings like talking to a colleague
2. **Investigative**: Proactively digs deeper when finding something interesting
3. **Evidence-based**: Actually fetched and read the pages
4. **Specific**: Provides exact text to add, not generic advice
5. **Comparative**: Shows what works elsewhere on the site
6. **Actionable**: Clear next step with implementation details

## Common Workflow Patterns

### Traffic Question Workflow

1. Load SEO knowledge base
2. Run traffic-health recipe queries
3. Compare periods, calculate % changes
4. If >15% change → investigate cause (sources, pages, timing)
5. **Fetch top 3-5 pages** (highest traffic, highest bounce, entry pages)
6. Apply SEO knowledge to interpret analytics + actual content
7. Provide specific, actionable recommendations based on real page analysis

### Content Question Workflow

1. Load SEO knowledge base
2. Run content-performance recipe
3. Identify top performers and problem pages
4. **Fetch 3-5 pages in parallel** (problems, successes, entry pages)
5. Read actual content to understand patterns (what works, what doesn't)
6. Apply SEO insights from knowledge base
7. Recommend specific content improvements with examples from actual pages

### Specific Page Question Workflow

1. Load SEO knowledge base
2. Query that page's metrics
3. Compare to site average
4. Check traffic sources and user behavior
5. **Fetch the actual page** to read content, structure, CTAs
6. If bounce rate differs from average, **fetch a comparison page** (homepage or similar page with better metrics)
7. Identify specific issue using SEO knowledge + actual content analysis
8. Suggest specific fixes with examples ("change opening from X to Y")

### Time-based Analysis Workflow

1. Load SEO knowledge base
2. Query with time dimensions (day, week, month)
3. Spot trends and anomalies
4. Correlate with events/changes if possible
5. If specific pages are affected, **fetch those pages**
6. Forecast implications based on trends
7. Recommend timing strategies
