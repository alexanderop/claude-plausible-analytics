# Plausible TypeScript SDK Design

**Date:** 2025-11-20
**Status:** Approved
**Goal:** Convert bash scripts to type-safe TypeScript SDK for AI agents

## Executive Summary

Transform primitive bash scripts into a modern TypeScript SDK that gives AI agents simple, type-safe functions to query Plausible Analytics. The SDK will provide two layers: low-level query builders for flexibility and high-level SEO helpers for common tasks. All inputs/outputs validated with Zod to catch Plausible API quirks before execution.

## Architecture Overview

### Project Structure

```
.claude/skills/plausible-insights/
├── lib/                           # TypeScript SDK
│   ├── cli.ts                     # Main CLI entry point
│   ├── index.ts                   # Exports for programmatic use
│   ├── client/
│   │   ├── plausible.ts           # API client
│   │   ├── schemas.ts             # Zod schemas
│   │   └── errors.ts              # Error classes
│   ├── queries/
│   │   ├── basic.ts               # Low-level query builders
│   │   └── seo.ts                 # High-level SEO helpers
│   └── utils/
│       ├── cache.ts               # Query caching (5min TTL)
│       ├── logger.ts              # Logging (~/.plausible-agent.log)
│       └── date-ranges.ts         # Date range helpers
├── package.json
├── tsconfig.json
├── recipes/                       # Existing recipe JSONs (kept)
├── references/                    # Existing docs (will be updated)
├── seo-knowledge.md              # Existing knowledge base
└── SKILL.md                      # Updated with TypeScript examples
```

### Core Philosophy

1. **Two-layer API**: Low-level building blocks + high-level SEO helpers
2. **Strict validation**: Zod validates everything, catches API quirks early
3. **Clear errors**: When validation fails, explain WHY and HOW to fix
4. **CLI-first**: All functions exposed via `tsx lib/cli.ts <command>`
5. **JSON in/out**: Accept JSON via args or stdin, output JSON to stdout

### Key Validation Features

- Detect and prevent mixing session metrics with event dimensions
- Block wildcard usage in `is` filters (suggest `contains` or `matches`)
- Enforce pagination object format when using dimensions
- Validate metric/dimension compatibility
- Type-safe date range handling

## CLI Interface Design

### Command Structure

```bash
# Pattern: tsx lib/cli.ts <command> [options]

# Help and discovery
tsx lib/cli.ts --help                    # List all commands
tsx lib/cli.ts <command> --help          # Command-specific help

# Input methods (all commands support both)
tsx lib/cli.ts <command> --arg value     # Via flags
tsx lib/cli.ts <command> '{"key":"val"}' # Via JSON string
echo '{"key":"val"}' | tsx lib/cli.ts <command>  # Via stdin
```

### Low-Level Commands (Layer 1)

```bash
# Basic query builder - maximum flexibility
tsx lib/cli.ts query '{
  "metrics": ["visitors", "bounce_rate"],
  "dimensions": ["event:page"],
  "date_range": "7d",
  "filters": [["contains", "event:page", ["/posts/"]]],
  "pagination": {"limit": 20, "offset": 0}
}'

# Shorthand with flags
tsx lib/cli.ts query \
  --metrics visitors,bounce_rate \
  --dimensions event:page \
  --date-range 7d \
  --limit 20
```

### High-Level SEO Commands (Layer 2)

```bash
# Pre-built SEO analysis functions
tsx lib/cli.ts get-top-pages --date-range 7d --limit 50
tsx lib/cli.ts get-blog-performance --date-range 30d --path-pattern "/posts/"
tsx lib/cli.ts get-traffic-sources --date-range 7d --min-visitors 10
tsx lib/cli.ts compare-periods --current 7d --previous previous_7d
tsx lib/cli.ts analyze-entry-pages --date-range 30d
tsx lib/cli.ts get-content-decay --recent 7d --baseline 30d --threshold 30

# Extract specific values
tsx lib/cli.ts get-top-pages --date-range 7d --extract 'data[0].visitors'
# Returns: 1234
```

### Output Format

**Success:**
```json
{
  "success": true,
  "data": { /* API response or processed results */ },
  "meta": {
    "cached": false,
    "query_hash": "abc123",
    "execution_time_ms": 234,
    "timestamp": "2025-11-20T10:30:00Z"
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_METRIC_DIMENSION_MIX",
    "message": "Cannot use session metrics with event dimensions",
    "details": "Metrics [bounce_rate, visit_duration] are session-level but dimension 'event:page' is event-level",
    "suggestion": "Use 'visit:entry_page' instead of 'event:page' for session metrics"
  }
}
```

## Zod Schema Design

### Core Type Safety Strategy

**Three validation layers:**
1. **Input validation** - Validate what agents provide
2. **API quirk protection** - Catch Plausible-specific issues before API call
3. **Response validation** - Ensure API returned expected structure

### Schema Structure

```typescript
// lib/client/schemas.ts

// Enums and constants
const MetricSchema = z.enum([
  'visitors', 'visits', 'pageviews', 'events',
  'bounce_rate', 'visit_duration', 'views_per_visit',
  'scroll_depth', 'time_on_page', 'percentage', 'conversion_rate'
]);

const SessionMetrics = ['bounce_rate', 'visit_duration', 'views_per_visit'] as const;
const EventDimensions = ['event:page', 'event:goal', 'event:hostname'] as const;

// Filter operators
const FilterOperatorSchema = z.enum([
  'is', 'is_not', 'contains', 'contains_not', 'matches', 'matches_not'
]);

// Date ranges
const DateRangeSchema = z.union([
  z.enum(['day', 'today', '7d', 'week', '30d', 'month', 'year', 'all']),
  z.tuple([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.string().regex(/^\d{4}-\d{2}-\d{2}/)])
]);

// Filters with validation
const FilterSchema = z.array(z.union([
  z.tuple([FilterOperatorSchema, z.string(), z.array(z.string())]),
  z.tuple([z.enum(['and', 'or', 'not']), z.array(z.any())]) // Nested logic
]));

// Main query schema
const QuerySchema = z.object({
  site_id: z.string().optional(),
  metrics: z.array(MetricSchema).min(1),
  dimensions: z.array(z.string()).optional(),
  date_range: DateRangeSchema,
  filters: FilterSchema.optional(),
  pagination: z.object({
    limit: z.number().int().min(1).max(1000),
    offset: z.number().int().min(0)
  }).optional(),
  order_by: z.array(z.tuple([z.string(), z.enum(['asc', 'desc'])])).optional()
});
```

### Custom Validation Rules (refinements)

```typescript
// Anti-quirk validations
const ValidatedQuerySchema = QuerySchema.superRefine((data, ctx) => {

  // 1. Detect session metrics + event dimensions mix
  const hasSessionMetrics = data.metrics.some(m => SessionMetrics.includes(m));
  const hasEventDimensions = data.dimensions?.some(d => EventDimensions.includes(d));

  if (hasSessionMetrics && hasEventDimensions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Cannot mix session metrics (${data.metrics.filter(m => SessionMetrics.includes(m))}) with event dimensions (${data.dimensions?.filter(d => EventDimensions.includes(d))})`,
      path: ['metrics'],
      params: {
        code: 'INVALID_METRIC_DIMENSION_MIX',
        suggestion: 'Use visit:entry_page instead of event:page for session metrics'
      }
    });
  }

  // 2. Require pagination when using dimensions
  if (data.dimensions && data.dimensions.length > 0 && !data.pagination) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pagination is required when using dimensions',
      path: ['pagination'],
      params: {
        code: 'MISSING_PAGINATION',
        suggestion: 'Add: "pagination": {"limit": 20, "offset": 0}'
      }
    });
  }

  // 3. Detect wildcards in 'is' filters
  if (data.filters) {
    data.filters.forEach((filter, idx) => {
      if (Array.isArray(filter) && filter[0] === 'is') {
        const values = filter[2] as string[];
        values.forEach(val => {
          if (val.includes('*') || val.includes('%')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Wildcards not supported in 'is' filter: "${val}"`,
              path: ['filters', idx],
              params: {
                code: 'WILDCARD_IN_IS_FILTER',
                suggestion: `Use ["contains", "${filter[1]}", ["${val.replace(/\*/g, '')}"]] instead`
              }
            });
          }
        });
      }
    });
  }
});
```

### Response Schema

```typescript
const APIResponseSchema = z.object({
  results: z.array(z.object({
    dimensions: z.array(z.string()).optional(),
    metrics: z.array(z.number())
  })),
  meta: z.object({
    imports_included: z.boolean().optional(),
    imports_skip_reason: z.string().optional(),
    time_labels: z.array(z.string()).optional(),
    total_rows: z.number().optional()
  }).optional(),
  query: z.any().optional()
});
```

## High-Level SEO Helper Functions

### Design Pattern

Each helper function:
1. **Accepts simple, typed parameters** (no raw API knowledge needed)
2. **Constructs validated query** using the low-level builder
3. **Returns typed, processed results** (not just raw API response)
4. **Includes smart defaults** from SEO knowledge base

### Helper Functions (lib/queries/seo.ts)

```typescript
// Top performing pages
export async function getTopPages(options: {
  dateRange: DateRange;
  limit?: number;
  minVisitors?: number;
}): Promise<PagePerformance[]>

// Returns:
type PagePerformance = {
  page: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  avgDuration: number;
  quality: 'excellent' | 'good' | 'poor' | 'very-poor';  // Auto-calculated
}

// Blog/content performance
export async function getBlogPerformance(options: {
  dateRange: DateRange;
  pathPattern?: string;  // Default: "/posts/"
  limit?: number;
}): Promise<ContentAnalysis>

// Returns:
type ContentAnalysis = {
  summary: {
    totalPosts: number;
    totalVisitors: number;
    avgBounceRate: number;
    highPerformers: number;  // bounce < 50%
    lowPerformers: number;   // bounce > 70%
  };
  posts: PagePerformance[];
}

// Traffic sources with quality scoring
export async function getTrafficSources(options: {
  dateRange: DateRange;
  minVisitors?: number;  // Default: 10
}): Promise<SourceQuality[]>

// Returns (matches bash script logic):
type SourceQuality = {
  source: string;
  visitors: number;
  bounceRate: number;
  visitDuration: number;
  qualityScore: number;     // 0-100
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// Period comparison
export async function comparePeriods(options: {
  current: DateRange;
  previous: DateRange;
  metrics?: Metric[];  // Default: visitors, pageviews, bounce_rate, visit_duration
}): Promise<PeriodComparison>

// Returns:
type PeriodComparison = {
  summary: {
    currentPeriod: string;
    previousPeriod: string;
  };
  metrics: Array<{
    name: string;
    current: number;
    previous: number;
    change: {
      absolute: number;
      percent: number;
      direction: 'up' | 'down' | 'flat';
      significance: 'significant' | 'notable' | 'normal';  // 30%, 15%, <15%
    };
  }>;
}

// Entry page analysis
export async function analyzeEntryPages(options: {
  dateRange: DateRange;
  limit?: number;
}): Promise<EntryPageAnalysis[]>

// Content decay detection
export async function getContentDecay(options: {
  compareWindows: {
    recent: DateRange;
    baseline: DateRange;
  };
  threshold?: number;  // Default: 30 (percent drop)
  pathPattern?: string;
}): Promise<DecayingContent[]>

// Returns:
type DecayingContent = {
  page: string;
  recentVisitors: number;
  baselineVisitors: number;
  dropPercent: number;
  severity: 'critical' | 'high' | 'medium';  // >50%, >30%, >15%
}

// Device performance breakdown
export async function getDevicePerformance(options: {
  dateRange: DateRange;
}): Promise<DeviceBreakdown>

// Geographic analysis
export async function getTopCountries(options: {
  dateRange: DateRange;
  limit?: number;
  metric?: 'visitors' | 'conversion_rate';
}): Promise<GeoAnalysis[]>
```

### Smart Defaults from SEO Knowledge

- Quality thresholds: bounce <30% = excellent, <50% = good, <70% = acceptable
- Duration thresholds: >180s = excellent, >60s = good, >30s = acceptable
- Significance: >30% = significant, >15% = notable
- Min visitors filter: 10 (configurable)

## Low-Level Query Builder

### Design Pattern

The low-level layer provides **type-safe building blocks** that:
1. **Map 1:1 to Plausible API concepts** (metrics, dimensions, filters)
2. **Still validate** but give maximum flexibility
3. **Are composable** - agents can chain methods or pass raw objects

### Query Builder API (lib/queries/basic.ts)

```typescript
// Main query function - accepts fully formed query
export async function query(params: QueryParams): Promise<APIResponse>

// Builder pattern (optional, for chaining)
export class QueryBuilder {
  private query: Partial<QueryParams> = {};

  metrics(...metrics: Metric[]): this
  dimensions(...dimensions: string[]): this
  dateRange(range: DateRange): this
  filter(operator: FilterOperator, dimension: string, values: string[]): this
  andFilter(operator: FilterOperator, dimension: string, values: string[]): this
  orFilter(operator: FilterOperator, dimension: string, values: string[]): this
  paginate(limit: number, offset?: number): this
  orderBy(metric: string, direction: 'asc' | 'desc'): this

  async execute(): Promise<APIResponse>
}

// Usage examples:
// Raw object style:
await query({
  metrics: ['visitors', 'bounce_rate'],
  dimensions: ['event:page'],
  date_range: '7d',
  filters: [['contains', 'event:page', ['/posts/']]],
  pagination: { limit: 20, offset: 0 }
});

// Builder style:
await new QueryBuilder()
  .metrics('visitors', 'bounce_rate')
  .dimensions('event:page')
  .dateRange('7d')
  .filter('contains', 'event:page', ['/posts/'])
  .paginate(20)
  .execute();
```

### Filter Helpers

```typescript
// Convenient filter construction with validation
export const filters = {
  // Page filters
  pageIs(path: string): Filter
  pageContains(substring: string): Filter
  pageMatches(regex: string): Filter
  pageStartsWith(prefix: string): Filter  // Auto-converts to regex ^prefix

  // Source filters
  sourceIs(source: string): Filter
  sourceContains(substring: string): Filter

  // Location filters
  countryIs(...countries: string[]): Filter

  // Logical combinators
  and(...filters: Filter[]): Filter
  or(...filters: Filter[]): Filter
  not(filter: Filter): Filter
};

// Usage:
import { filters as f } from './lib/queries/basic';

await query({
  metrics: ['visitors'],
  date_range: '7d',
  filters: [
    f.and(
      f.pageStartsWith('/posts/'),
      f.or(f.countryIs('US'), f.countryIs('CA'))
    )
  ]
});
```

### Date Range Helpers

```typescript
// lib/utils/date-ranges.ts

export const dateRanges = {
  // Relative
  today(): DateRange
  yesterday(): DateRange
  last7Days(): DateRange
  last30Days(): DateRange
  thisMonth(): DateRange
  thisYear(): DateRange

  // Absolute
  between(start: string, end: string): DateRange

  // Comparative (for period comparisons)
  previous7Days(): DateRange  // 14 days ago to 7 days ago
  previous30Days(): DateRange // 60 days ago to 30 days ago

  // Custom relative
  lastNDays(n: number): DateRange
  daysAgo(start: number, end: number): DateRange
};

// Usage:
import { dateRanges as dr } from './lib/utils/date-ranges';

await query({
  metrics: ['visitors'],
  date_range: dr.last7Days()
});
```

## Caching and Logging

### Caching Strategy (lib/utils/cache.ts)

**Philosophy**: Identical queries within 5 minutes return cached results

```typescript
interface CacheEntry {
  query: QueryParams;
  response: APIResponse;
  timestamp: number;
  queryHash: string;
}

class QueryCache {
  private cacheDir = path.join(os.homedir(), '.cache', 'plausible-cli');
  private ttlSeconds = 300; // 5 minutes

  // Generate stable hash from query (sorted JSON)
  private hash(query: QueryParams): string {
    const normalized = JSON.stringify(query, Object.keys(query).sort());
    return createHash('md5').update(normalized).digest('hex');
  }

  // Get cached result if fresh
  async get(query: QueryParams): Promise<APIResponse | null>

  // Store result
  async set(query: QueryParams, response: APIResponse): Promise<void>

  // Clear all cache
  async clear(): Promise<void>

  // Clear stale entries only
  async prune(): Promise<number>
}

// CLI support for cache management
tsx lib/cli.ts cache clear          # Clear all
tsx lib/cli.ts cache prune          # Remove stale only
tsx lib/cli.ts query --no-cache ... # Bypass cache for single query
```

### Logging Strategy (lib/utils/logger.ts)

**Philosophy**: All API activity logged to `~/.plausible-agent.log` for debugging and audit trail

```typescript
enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR',
  CACHE_HIT = 'CACHE HIT',
  API_REQ = 'API REQ',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

interface LogEntry {
  timestamp: string; // ISO8601
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logFile = path.join(os.homedir(), '.plausible-agent.log');

  async cacheHit(query: QueryParams): Promise<void>
  async apiRequest(query: QueryParams): Promise<void>
  async apiError(error: Error, query: QueryParams): Promise<void>
  async validationError(errors: ZodError, input: any): Promise<void>
  async info(message: string, data?: any): Promise<void>
}

// Singleton instance
export const logger = new Logger();
```

### Integration in Query Flow

```typescript
// lib/client/plausible.ts

export async function executeQuery(params: QueryParams): Promise<APIResponse> {
  // 1. Validate
  const validated = ValidatedQuerySchema.parse(params); // Throws on error

  // 2. Check cache
  const cached = await cache.get(validated);
  if (cached) {
    await logger.cacheHit(validated);
    return cached;
  }

  // 3. Execute API call
  await logger.apiRequest(validated);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PLAUSIBLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validated)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new APIError(response.status, error);
    }

    const data = await response.json();
    const validated_response = APIResponseSchema.parse(data);

    // 4. Cache result
    await cache.set(validated, validated_response);

    return validated_response;

  } catch (error) {
    await logger.apiError(error, validated);
    throw error;
  }
}
```

## Error Handling

### Error Hierarchy

```typescript
// lib/client/errors.ts

// Base error class
export class PlausibleError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PlausibleError';
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.suggestion && { suggestion: this.suggestion }),
        ...(this.details && { details: this.details })
      }
    };
  }
}

// Validation errors (from Zod)
export class ValidationError extends PlausibleError {
  constructor(zodError: ZodError) {
    const firstError = zodError.errors[0];
    const message = firstError.message;
    const code = firstError.params?.code || 'VALIDATION_ERROR';
    const suggestion = firstError.params?.suggestion;

    super(message, code, suggestion, zodError.errors);
    this.name = 'ValidationError';
  }
}

// API errors with intelligent parsing
export class APIError extends PlausibleError {
  constructor(
    public statusCode: number,
    responseBody: string
  ) {
    const parsed = APIError.parseErrorResponse(responseBody);
    super(parsed.message, parsed.code, parsed.suggestion);
    this.name = 'APIError';
  }

  private static parseErrorResponse(body: string) {
    // Handle common Plausible API errors
    if (body.includes('Invalid filter')) {
      return {
        code: 'INVALID_FILTER',
        message: 'API rejected filter syntax',
        suggestion: 'Check filter operators - no wildcards in "is", use "contains" instead'
      };
    }

    if (body.includes('Invalid request body')) {
      return {
        code: 'INVALID_REQUEST',
        message: 'API rejected request structure',
        suggestion: 'Ensure pagination uses object format: {"limit": N, "offset": 0}'
      };
    }

    if (body.includes('Unauthorized') || body.includes('401')) {
      return {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
        suggestion: 'Check PLAUSIBLE_API_KEY in .env file'
      };
    }

    return {
      code: 'API_ERROR',
      message: body,
      suggestion: undefined
    };
  }
}

// Configuration errors
export class ConfigError extends PlausibleError {
  constructor(missing: string) {
    super(
      `Missing required configuration: ${missing}`,
      'CONFIG_ERROR',
      `Set ${missing} in .env file`
    );
    this.name = 'ConfigError';
  }
}

// Network errors
export class NetworkError extends PlausibleError {
  constructor(originalError: Error) {
    super(
      `Network request failed: ${originalError.message}`,
      'NETWORK_ERROR',
      'Check your internet connection and Plausible API status'
    );
    this.name = 'NetworkError';
  }
}
```

### Example Error Output

```bash
# Validation error
$ tsx lib/cli.ts query '{"metrics":["bounce_rate"],"dimensions":["event:page"]}'
{
  "success": false,
  "error": {
    "code": "INVALID_METRIC_DIMENSION_MIX",
    "message": "Cannot mix session metrics [bounce_rate] with event dimensions [event:page]",
    "suggestion": "Use visit:entry_page instead of event:page for session metrics"
  }
}

# API error
$ tsx lib/cli.ts query '{"metrics":["visitors"],"filters":[["is","event:page",["/posts/*"]]]}'
{
  "success": false,
  "error": {
    "code": "INVALID_FILTER",
    "message": "API rejected filter syntax",
    "suggestion": "Check filter operators - no wildcards in \"is\", use \"contains\" instead"
  }
}
```

## Package Configuration

### package.json

```json
{
  "name": "@plausible/agent-sdk",
  "version": "1.0.0",
  "description": "Type-safe Plausible Analytics SDK for AI agents",
  "type": "module",
  "main": "./lib/index.ts",
  "bin": {
    "plausible-cli": "./lib/cli.ts"
  },
  "scripts": {
    "cli": "tsx lib/cli.ts",
    "dev": "tsx watch lib/cli.ts",
    "test": "vitest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4",
    "commander": "^11.1.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0",
    "@types/node": "^20.11.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],

    "outDir": "./dist",
    "rootDir": "./lib",

    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "types": ["node"]
  },
  "include": ["lib/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Skill Integration

### Update SKILL.md

Replace bash script examples with TypeScript CLI examples:

```markdown
## Tools Available

### TypeScript CLI

All commands return JSON with standardized structure:
```json
{
  "success": true,
  "data": { /* results */ },
  "meta": {
    "cached": false,
    "timestamp": "2025-11-20T10:30:00Z"
  }
}
```

**High-level SEO commands:**
```bash
tsx lib/cli.ts get-top-pages --date-range 7d --limit 50
tsx lib/cli.ts get-blog-performance --date-range 30d --path-pattern "/posts/"
tsx lib/cli.ts get-traffic-sources --date-range 7d --min-visitors 10
tsx lib/cli.ts compare-periods --current 7d --previous previous_7d
tsx lib/cli.ts get-content-decay --recent 7d --baseline 30d --threshold 30
```

**Low-level query for custom analysis:**
```bash
tsx lib/cli.ts query '{
  "metrics": ["visitors", "bounce_rate"],
  "dimensions": ["event:page"],
  "date_range": "7d",
  "filters": [["contains", "event:page", ["/posts/"]]],
  "pagination": {"limit": 50, "offset": 0}
}'
```

**Extract specific values:**
```bash
tsx lib/cli.ts get-top-pages --date-range 7d --extract 'data[0].visitors'
# Returns: 1234
```

**Errors include actionable suggestions:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_METRIC_DIMENSION_MIX",
    "message": "Cannot mix session metrics with event dimensions",
    "suggestion": "Use visit:entry_page instead of event:page for session metrics"
  }
}
```
```

## Migration Path

### Phase 1: Implementation (Immediate)
1. Install dependencies: `npm install` in `.claude/skills/plausible-insights/`
2. Create TypeScript SDK files in `lib/` directory
3. Implement core functionality:
   - Zod schemas with validation
   - API client with caching/logging
   - Low-level query builders
   - High-level SEO helpers
   - CLI interface
4. Test with existing workflows

### Phase 2: Integration (After validation)
1. Update SKILL.md with TypeScript examples
2. Update workflow documentation in `references/`
3. Test all recipes with new CLI
4. Remove bash scripts entirely

### Phase 3: Enhancement (Future)
- Add more high-level helpers based on agent usage patterns
- Recipe JSON files could auto-generate CLI commands
- Add interactive mode for debugging
- Performance optimizations

## Benefits Summary

### For AI Agents
- ✅ Simple, typed function calls instead of raw API construction
- ✅ Automatic validation with helpful error messages
- ✅ No need to memorize API quirks (pagination syntax, filter operators, etc.)
- ✅ High-level helpers match common SEO tasks
- ✅ Low-level builders for custom analysis
- ✅ Consistent JSON I/O

### For Development
- ✅ Type safety catches errors before API calls
- ✅ Zod validation prevents malformed queries
- ✅ Logging for debugging and audit trail
- ✅ Caching reduces API calls and speeds up queries
- ✅ Clear error messages guide agents to fixes

### For Maintenance
- ✅ All logic in one language (TypeScript vs bash + jq + curl)
- ✅ Testable with standard TypeScript tooling
- ✅ Easy to extend with new helpers
- ✅ Self-documenting with TypeScript types

## Implementation Checklist

- [ ] Initialize npm project with dependencies
- [ ] Create directory structure (`lib/client/`, `lib/queries/`, `lib/utils/`)
- [ ] Implement Zod schemas with custom validations
- [ ] Implement error hierarchy
- [ ] Implement caching layer
- [ ] Implement logging layer
- [ ] Implement API client
- [ ] Implement low-level query builders
- [ ] Implement high-level SEO helpers
- [ ] Implement CLI with commander
- [ ] Add date range helpers
- [ ] Add filter helpers
- [ ] Update SKILL.md
- [ ] Update workflow documentation
- [ ] Test all existing use cases
- [ ] Remove bash scripts
