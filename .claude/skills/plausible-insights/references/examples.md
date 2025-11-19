# Complete End-to-End Examples

## Example 1: Blog Performance Analysis

**User asks: "How's my blog performing this week?"**

### Step-by-Step Walkthrough

**1. Load SEO knowledge base**
```bash
cat ./.claude/skills/plausible-insights/seo-knowledge.md
```

**2. Run traffic-health recipe queries**
```bash
# Current 7d metrics
CURRENT=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","pageviews","bounce_rate","visit_duration","views_per_visit"],"date_range":"7d"}')

# Previous 7d metrics (calculate dates dynamically)
PREV_START=$(date -v-14d -v+1d +%Y-%m-%d)  # 14 days ago
PREV_END=$(date -v-7d +%Y-%m-%d)            # 7 days ago

PREVIOUS=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  "{\"metrics\":[\"visitors\",\"pageviews\",\"bounce_rate\",\"visit_duration\",\"views_per_visit\"],\"date_range\":[\"$PREV_START\",\"$PREV_END\"]}")

# Today's metrics
TODAY=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","pageviews","bounce_rate"],"date_range":"day"}')
```

**3. Analyze results**
- Visitors: 1,962 vs 2,239 (-12% decline)
- Bounce rate: 74% (concerning)
- Identify this decline is approaching "notable" threshold

**4. Investigate deeper**
```bash
# Query top pages by traffic
TOP_PAGES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["event:page"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')

# Query traffic sources (current vs previous week)
SOURCES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors"],"dimensions":["visit:source"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')

# Query entry pages
ENTRY=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["visit:entry_page"],"date_range":"7d","pagination":{"limit":10,"offset":0}}')
```

**5. Discover insights**
- Reddit traffic collapsed 66% (temporary spike ended)
- Google organic down 18% (concerning)
- One TIL page has 98% bounce rate

**6. FETCH REAL PAGES (3-5 in parallel)**

Use WebFetch to read actual content:

```markdown
WebFetch calls:
1. /tils/claude-code-slash-commands/ (98% bounce - find issue)
   Prompt: "This TIL has 98% bounce rate with 1,400 words. Analyze opening hook, content structure, internal links, CTAs. Why might users bounce immediately?"

2. /posts/understanding-claude-code/ (top traffic - check linking)
   Prompt: "This is your highest traffic post. Analyze internal linking strategy, CTAs, and user journey. How could it be improved?"

3. /posts/ index (29% bounce - understand success)
   Prompt: "This index page has exceptional 29% bounce rate. What makes it engaging? Analyze layout, structure, and UX patterns."

4. / homepage (50% bounce - compare to posts)
   Prompt: "Compare this homepage's structure and CTAs to other pages. What patterns work well here?"
```

**7. Analyze fetched content**
- TIL page: Good content, but opening is too technical ("Explore Claude Code's slash commands feature...")
- Top posts: Already have internal links (initial assumption wrong!)
- Index page: Chronological layout, newsletter CTA, excellent UX
- Homepage: Clear value prop ("I'm a developer from Germany..."), multiple entry points

**8. Present findings with specific recommendations**

"Your traffic is down 12% this week (1,962 vs 2,239 visitors). Let me break down what's happening:

**The Good News:**
- Your site structure is actually excellent. I read your posts and they already have internal links and CTAs.
- Your /posts/ index has 29% bounce rate - that's exceptional. The chronological layout with newsletter CTA works well.

**The Issues:**
1. **Reddit spike ended** (-66% from Reddit): This is normal volatility after a viral post. Not concerning.

2. **Google organic declining** (-18%): This needs investigation. Check Google Search Console for ranking changes on these posts: [list specific posts that lost traffic]

3. **TIL page needs better hook** (/tils/claude-code-slash-commands/):
   - Current: 98% bounce rate
   - Problem: Opens with 'Explore Claude Code's slash commands feature...' (too technical, no hook)
   - Fix: Change opening to:

   ```markdown
   Save 20% of your coding time with 3 keystrokes. Claude Code's slash commands let you automate repetitive tasks—here's how I use them daily.
   ```

   This mirrors your homepage's successful pattern of leading with concrete benefits.

**Action Plan:**
1. Fix TIL opening hook (5 minutes, high impact)
2. Investigate Google rankings in Search Console (focus on posts that lost traffic)
3. Double down on Twitter (62% bounce, 110 visitors - decent engagement)
4. Don't worry about Reddit decline - temporary spikes are normal"

### Key Difference

**Generic advice (before WebFetch):**
"Add CTAs to your blog posts to improve engagement."

**Specific recommendations (after WebFetch):**
"I read your TIL page with 98% bounce rate. The content is good (1,400 words), but the opening jumps into technical jargon without a hook. Your homepage has 50% bounce because it starts with a clear value prop. Change the TIL opening from [current text] to [specific rewrite]. This mirrors your homepage's successful pattern."

## Example 2: Investigating High Bounce Rate

**User asks: "Why is bounce rate high on /pricing?"**

**1. Start with specific page metrics**
```bash
PRICING=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate","time_on_page"],"date_range":"7d","filters":[["is","event:page",["/pricing"]]]}')
```

**2. Compare to site average**
```bash
AVG=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["bounce_rate"],"date_range":"7d"}')
```

**3. Check traffic sources to /pricing**
```bash
SOURCES=$(./.claude/skills/plausible-insights/scripts/plausible-quick-query.sh \
  '{"metrics":["visitors","bounce_rate"],"dimensions":["visit:source"],"date_range":"7d","filters":[["is","visit:entry_page",["/pricing"]]],"pagination":{"limit":10,"offset":0}}')
```

**4. CRITICAL: Fetch the actual /pricing page**
```markdown
WebFetch: https://yoursite.com/pricing
Prompt: "This pricing page has 75% bounce rate vs 50% site average. Analyze content, CTAs, value proposition, pricing clarity, trust signals, and navigation. What specific elements might cause the high bounce?"
```

**5. For context, fetch a comparison page**
```markdown
WebFetch: https://yoursite.com/ (homepage with better bounce rate)
Prompt: "This page has 50% bounce rate (better than /pricing). What does it do differently in terms of structure, CTAs, and user journey?"
```

**6. Present specific findings**

"Your /pricing page has 75% bounce vs 50% site average. I read both pages - here's what I found:

**The Problem:**
- Pricing page jumps straight to pricing table without context
- No trust signals (testimonials, logos, guarantees)
- CTA is 'Buy Now' (too aggressive for first visit)
- Missing feature comparison to help users choose right tier

**What Works (from homepage):**
- Clear value prop in first paragraph
- Social proof (customer logos, testimonial)
- Soft CTA ('Start Free Trial' not 'Buy Now')

**Specific Fix:**
Add this section BEFORE the pricing table:

```markdown
## Trusted by 1,000+ Companies
[Customer logos]

'This tool saved us 20 hours per week' - John, CTO at Acme

## Choose Your Plan
All plans include our core features. Upgrade anytime as you grow.

[Pricing table]
```

This gives context before asking for commitment, matching your homepage's successful pattern."
