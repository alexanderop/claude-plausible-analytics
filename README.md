# Plausible SEO Consultant for Claude Code

SEO consultant powered by Plausible Analytics. Ask natural language questions and get actionable insights based on your actual page content and analytics data.

## Setup

**Prerequisites:**
- Plausible Analytics account with Stats API key ([create here](https://plausible.io/settings#api-keys))
- [Bun](https://bun.sh) runtime

**Install:**
1. Copy `.env.example` to `.env`
2. Add your API key and site ID
3. Test: `npm run cli top-pages --range 7d`

## Usage

Ask natural language questions in Claude Code:
```
"How did my blog perform this week?"
"Which pages are performing well?"
"Run a comprehensive audit"
```

Or use CLI commands directly:
```bash
npm run cli top-pages --range 7d
npm run cli sources --range 30d
npm run cli compare --current 7d --previous 30d
npm run cli blog --range 7d --pattern "/posts/"

# Raw API queries
npm run cli '{"metrics":["visitors"],"date_range":"7d"}'
```

### Output Formats
```bash
--format json    # Default
--format csv     # CSV output
--format table   # Human-readable table
--no-cache       # Bypass cache
```

## License

MIT License - Built with Claude Code Skills Framework, powered by Plausible Analytics API
