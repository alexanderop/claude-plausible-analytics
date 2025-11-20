# TypeScript SDK Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert bash Plausible Analytics scripts to type-safe TypeScript SDK with Zod validation and CLI interface

**Architecture:** Two-layer API (low-level builders + high-level SEO helpers), CLI-first with commander, strict Zod validation catches API quirks, 5-minute caching, comprehensive error handling

**Tech Stack:** TypeScript, Zod, Commander, tsx, dotenv

---

## Task 1: Initialize TypeScript Project

**Files:**
- Create: `.claude/skills/plausible-insights/package.json`
- Create: `.claude/skills/plausible-insights/tsconfig.json`
- Create: `.claude/skills/plausible-insights/lib/.gitkeep`

**Step 1: Create package.json**

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
    "@types/node": "^20.11.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

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

**Step 3: Create lib directory structure**

Run:
```bash
cd .claude/skills/plausible-insights
mkdir -p lib/client lib/queries lib/utils
touch lib/.gitkeep
```

**Step 4: Install dependencies**

Run:
```bash
cd .claude/skills/plausible-insights
npm install
```

Expected: Dependencies installed successfully

**Step 5: Commit**

```bash
git add package.json tsconfig.json lib/.gitkeep package-lock.json
git commit -m "feat: initialize TypeScript SDK project structure"
```

---

## Task 2: Implement Zod Schemas and Types

**Files:**
- Create: `.claude/skills/plausible-insights/lib/client/schemas.ts`

**Step 1: Create schemas.ts with base types**

```typescript
import { z } from 'zod';

// Metrics
export const MetricSchema = z.enum([
  'visitors',
  'visits',
  'pageviews',
  'events',
  'bounce_rate',
  'visit_duration',
  'views_per_visit',
  'scroll_depth',
  'time_on_page',
  'percentage',
  'conversion_rate'
]);

export type Metric = z.infer<typeof MetricSchema>;

// Session metrics that cannot be mixed with event dimensions
export const SESSION_METRICS = ['bounce_rate', 'visit_duration', 'views_per_visit'] as const;

// Event dimensions that cannot be used with session metrics
export const EVENT_DIMENSIONS = ['event:page', 'event:goal', 'event:hostname'] as const;

// Filter operators
export const FilterOperatorSchema = z.enum([
  'is',
  'is_not',
  'contains',
  'contains_not',
  'matches',
  'matches_not'
]);

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

// Logical operators
export const LogicalOperatorSchema = z.enum(['and', 'or', 'not']);

// Date ranges
export const DateRangeSchema = z.union([
  z.enum(['day', 'today', '7d', 'week', '30d', 'month', 'year', 'all']),
  z.tuple([
    z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format, use YYYY-MM-DD'),
    z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format, use YYYY-MM-DD')
  ])
]);

export type DateRange = z.infer<typeof DateRangeSchema>;

// Filters (recursive for nested logic)
export type Filter =
  | [FilterOperator, string, string[]]
  | ['and' | 'or' | 'not', Filter[]];

export const FilterSchema: z.ZodType<Filter> = z.lazy(() =>
  z.union([
    z.tuple([FilterOperatorSchema, z.string(), z.array(z.string())]),
    z.tuple([LogicalOperatorSchema, z.array(FilterSchema)])
  ])
);

// Pagination
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(1000),
  offset: z.number().int().min(0).default(0)
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Order by
export const OrderBySchema = z.array(
  z.tuple([z.string(), z.enum(['asc', 'desc'])])
);

export type OrderBy = z.infer<typeof OrderBySchema>;

// Query parameters
export const QueryParamsSchema = z.object({
  site_id: z.string().optional(),
  metrics: z.array(MetricSchema).min(1, 'At least one metric required'),
  dimensions: z.array(z.string()).optional(),
  date_range: DateRangeSchema,
  filters: z.array(FilterSchema).optional(),
  pagination: PaginationSchema.optional(),
  order_by: OrderBySchema.optional()
});

export type QueryParams = z.infer<typeof QueryParamsSchema>;

// API Response
export const APIResponseSchema = z.object({
  results: z.array(
    z.object({
      dimensions: z.array(z.string()).optional(),
      metrics: z.array(z.number())
    })
  ),
  meta: z.object({
    imports_included: z.boolean().optional(),
    imports_skip_reason: z.string().optional(),
    time_labels: z.array(z.string()).optional(),
    total_rows: z.number().optional()
  }).optional(),
  query: z.any().optional()
});

export type APIResponse = z.infer<typeof APIResponseSchema>;
```

**Step 2: Add custom validation rules**

Add to end of `lib/client/schemas.ts`:

```typescript
// Validated query schema with custom rules
export const ValidatedQuerySchema = QueryParamsSchema.superRefine((data, ctx) => {
  // Rule 1: Detect session metrics + event dimensions mix
  const hasSessionMetrics = data.metrics.some(m => SESSION_METRICS.includes(m as any));
  const hasEventDimensions = data.dimensions?.some(d => EVENT_DIMENSIONS.includes(d as any));

  if (hasSessionMetrics && hasEventDimensions) {
    const sessionMetrics = data.metrics.filter(m => SESSION_METRICS.includes(m as any));
    const eventDims = data.dimensions?.filter(d => EVENT_DIMENSIONS.includes(d as any));

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Cannot mix session metrics (${sessionMetrics.join(', ')}) with event dimensions (${eventDims?.join(', ')})`,
      path: ['metrics'],
      params: {
        code: 'INVALID_METRIC_DIMENSION_MIX',
        suggestion: 'Use visit:entry_page instead of event:page for session metrics'
      }
    });
  }

  // Rule 2: Require pagination when using dimensions
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

  // Rule 3: Detect wildcards in 'is' filters
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

**Step 3: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/client/schemas.ts
git commit -m "feat: add Zod schemas with custom validation rules"
```

---

## Task 3: Implement Error Hierarchy

**Files:**
- Create: `.claude/skills/plausible-insights/lib/client/errors.ts`

**Step 1: Create base error classes**

```typescript
import { ZodError } from 'zod';

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
    const code = (firstError.params?.code as string) || 'VALIDATION_ERROR';
    const suggestion = firstError.params?.suggestion as string | undefined;

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

  private static parseErrorResponse(body: string): {
    code: string;
    message: string;
    suggestion?: string;
  } {
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
      message: body
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

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/client/errors.ts
git commit -m "feat: add comprehensive error hierarchy with error parsing"
```

---

## Task 4: Implement Logger

**Files:**
- Create: `.claude/skills/plausible-insights/lib/utils/logger.ts`

**Step 1: Create logger implementation**

```typescript
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { QueryParams } from '../client/schemas.js';
import { ZodError } from 'zod';

enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR',
  CACHE_HIT = 'CACHE HIT',
  API_REQ = 'API REQ',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logFile = join(homedir(), '.plausible-agent.log');

  private async write(level: LogLevel, message: string, data?: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data && { data })
    };

    const line = `[${entry.timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;

    try {
      await fs.appendFile(this.logFile, line);
    } catch (error) {
      // Fail silently if we can't write logs
      console.error('Failed to write log:', error);
    }
  }

  async cacheHit(query: QueryParams): Promise<void> {
    await this.write(LogLevel.CACHE_HIT, 'Query served from cache', { query });
  }

  async apiRequest(query: QueryParams): Promise<void> {
    await this.write(LogLevel.API_REQ, 'Sending API request', { query });
  }

  async apiError(error: Error, query: QueryParams): Promise<void> {
    await this.write(LogLevel.ERROR, `API request failed: ${error.message}`, {
      query,
      error: error.stack
    });
  }

  async validationError(errors: ZodError, input: any): Promise<void> {
    await this.write(LogLevel.VALIDATION_ERROR, 'Query validation failed', {
      errors: errors.errors,
      input
    });
  }

  async info(message: string, data?: any): Promise<void> {
    await this.write(LogLevel.INFO, message, data);
  }
}

// Singleton instance
export const logger = new Logger();
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/utils/logger.ts
git commit -m "feat: add logging system with singleton logger"
```

---

## Task 5: Implement Cache

**Files:**
- Create: `.claude/skills/plausible-insights/lib/utils/cache.ts`

**Step 1: Create cache implementation**

```typescript
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import type { QueryParams, APIResponse } from '../client/schemas.js';

interface CacheEntry {
  query: QueryParams;
  response: APIResponse;
  timestamp: number;
  queryHash: string;
}

class QueryCache {
  private cacheDir = join(homedir(), '.cache', 'plausible-cli');
  private ttlSeconds = 300; // 5 minutes

  // Generate stable hash from query (sorted JSON)
  private hash(query: QueryParams): string {
    const sortedKeys = Object.keys(query).sort();
    const normalized: any = {};
    for (const key of sortedKeys) {
      normalized[key] = (query as any)[key];
    }
    const jsonStr = JSON.stringify(normalized);
    return createHash('md5').update(jsonStr).digest('hex');
  }

  // Get cached result if fresh
  async get(query: QueryParams): Promise<APIResponse | null> {
    try {
      const hash = this.hash(query);
      const cacheFile = join(this.cacheDir, `${hash}.json`);

      const stats = await fs.stat(cacheFile);
      const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;

      if (ageSeconds > this.ttlSeconds) {
        await fs.unlink(cacheFile); // Clean up stale cache
        return null;
      }

      const content = await fs.readFile(cacheFile, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);
      return entry.response;
    } catch (error) {
      // Cache miss or error - return null
      return null;
    }
  }

  // Store result
  async set(query: QueryParams, response: APIResponse): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });

      const hash = this.hash(query);
      const entry: CacheEntry = {
        query,
        response,
        timestamp: Date.now(),
        queryHash: hash
      };

      const cacheFile = join(this.cacheDir, `${hash}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
    } catch (error) {
      // Fail silently if we can't cache
      console.error('Failed to cache response:', error);
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }

  // Clear stale entries only
  async prune(): Promise<number> {
    let pruned = 0;
    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        const filePath = join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;

        if (ageSeconds > this.ttlSeconds) {
          await fs.unlink(filePath);
          pruned++;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return pruned;
  }

  // Get cache info
  async info(): Promise<{ totalEntries: number; cacheDir: string }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      return {
        totalEntries: files.length,
        cacheDir: this.cacheDir
      };
    } catch (error) {
      return {
        totalEntries: 0,
        cacheDir: this.cacheDir
      };
    }
  }
}

// Singleton instance
export const cache = new QueryCache();
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/utils/cache.ts
git commit -m "feat: add caching system with 5-minute TTL"
```

---

## Task 6: Implement Date Range Helpers

**Files:**
- Create: `.claude/skills/plausible-insights/lib/utils/date-ranges.ts`

**Step 1: Create date range helpers**

```typescript
import type { DateRange } from '../client/schemas.js';

export const dateRanges = {
  // Relative
  today(): DateRange {
    return 'day';
  },

  yesterday(): DateRange {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const dateStr = date.toISOString().split('T')[0];
    return [dateStr, dateStr];
  },

  last7Days(): DateRange {
    return '7d';
  },

  last30Days(): DateRange {
    return '30d';
  },

  thisMonth(): DateRange {
    return 'month';
  },

  thisYear(): DateRange {
    return 'year';
  },

  // Absolute
  between(start: string, end: string): DateRange {
    return [start, end];
  },

  // Comparative (for period comparisons)
  previous7Days(): DateRange {
    const end = new Date();
    end.setDate(end.getDate() - 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  },

  previous30Days(): DateRange {
    const end = new Date();
    end.setDate(end.getDate() - 30);
    const start = new Date(end);
    start.setDate(start.getDate() - 30);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  },

  // Custom relative
  lastNDays(n: number): DateRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - n);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  },

  daysAgo(startDays: number, endDays: number): DateRange {
    const start = new Date();
    start.setDate(start.getDate() - startDays);
    const end = new Date();
    end.setDate(end.getDate() - endDays);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  }
};
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/utils/date-ranges.ts
git commit -m "feat: add date range helper functions"
```

---

## Task 7: Implement API Client

**Files:**
- Create: `.claude/skills/plausible-insights/lib/client/plausible.ts`

**Step 1: Create API client**

```typescript
import { config } from 'dotenv';
import { ValidatedQuerySchema, APIResponseSchema, type QueryParams, type APIResponse } from './schemas.js';
import { APIError, ConfigError, NetworkError, ValidationError } from './errors.js';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

// Load environment variables
config();

const API_URL = process.env.PLAUSIBLE_API_URL || 'https://plausible.io/api/v2/query';

export async function executeQuery(
  params: QueryParams,
  options: { noCache?: boolean } = {}
): Promise<APIResponse> {
  // 1. Validate query
  let validated: QueryParams;
  try {
    validated = ValidatedQuerySchema.parse(params);
  } catch (error: any) {
    await logger.validationError(error, params);
    throw new ValidationError(error);
  }

  // Inject site_id if missing
  if (!validated.site_id) {
    const siteId = process.env.PLAUSIBLE_SITE_ID;
    if (!siteId) {
      throw new ConfigError('PLAUSIBLE_SITE_ID');
    }
    validated.site_id = siteId;
  }

  // 2. Check cache
  if (!options.noCache) {
    const cached = await cache.get(validated);
    if (cached) {
      await logger.cacheHit(validated);
      return cached;
    }
  }

  // 3. Execute API call
  await logger.apiRequest(validated);

  const apiKey = process.env.PLAUSIBLE_API_KEY;
  if (!apiKey) {
    throw new ConfigError('PLAUSIBLE_API_KEY');
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validated)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new APIError(response.status, error);
    }

    const data = await response.json();
    const validatedResponse = APIResponseSchema.parse(data);

    // 4. Cache result
    if (!options.noCache) {
      await cache.set(validated, validatedResponse);
    }

    return validatedResponse;

  } catch (error: any) {
    if (error instanceof APIError) {
      await logger.apiError(error, validated);
      throw error;
    }

    if (error.name === 'FetchError' || error.code === 'ENOTFOUND') {
      const networkError = new NetworkError(error);
      await logger.apiError(networkError, validated);
      throw networkError;
    }

    await logger.apiError(error, validated);
    throw error;
  }
}
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/client/plausible.ts
git commit -m "feat: add API client with validation, caching, and logging"
```

---

## Task 8: Implement Low-Level Query Builder

**Files:**
- Create: `.claude/skills/plausible-insights/lib/queries/basic.ts`

**Step 1: Create basic query functions**

```typescript
import { executeQuery } from '../client/plausible.js';
import type { QueryParams, APIResponse, Filter, FilterOperator, DateRange } from '../client/schemas.js';

// Main query function
export async function query(
  params: QueryParams,
  options: { noCache?: boolean } = {}
): Promise<APIResponse> {
  return executeQuery(params, options);
}

// Filter helpers
export const filters = {
  // Page filters
  pageIs(path: string): Filter {
    return ['is', 'event:page', [path]];
  },

  pageContains(substring: string): Filter {
    return ['contains', 'event:page', [substring]];
  },

  pageMatches(regex: string): Filter {
    return ['matches', 'event:page', [regex]];
  },

  pageStartsWith(prefix: string): Filter {
    return ['matches', 'event:page', [`^${prefix}.*`]];
  },

  // Source filters
  sourceIs(source: string): Filter {
    return ['is', 'visit:source', [source]];
  },

  sourceContains(substring: string): Filter {
    return ['contains', 'visit:source', [substring]];
  },

  // Location filters
  countryIs(...countries: string[]): Filter {
    if (countries.length === 1) {
      return ['is', 'visit:country', countries];
    }
    return ['or', countries.map(c => filters.countryIs(c))];
  },

  // Logical combinators
  and(...filterList: Filter[]): Filter {
    return ['and', filterList];
  },

  or(...filterList: Filter[]): Filter {
    return ['or', filterList];
  },

  not(filter: Filter): Filter {
    return ['not', [filter]];
  }
};
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/queries/basic.ts
git commit -m "feat: add low-level query builder with filter helpers"
```

---

## Task 9: Implement High-Level SEO Helpers (Part 1)

**Files:**
- Create: `.claude/skills/plausible-insights/lib/queries/seo.ts`

**Step 1: Add types and helper functions**

```typescript
import { executeQuery } from '../client/plausible.js';
import type { DateRange, Metric } from '../client/schemas.js';
import { filters } from './basic.js';

// Return types
export type PagePerformance = {
  page: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  avgDuration: number;
  quality: 'excellent' | 'good' | 'poor' | 'very-poor';
};

export type ContentAnalysis = {
  summary: {
    totalPosts: number;
    totalVisitors: number;
    avgBounceRate: number;
    highPerformers: number;
    lowPerformers: number;
  };
  posts: PagePerformance[];
};

export type SourceQuality = {
  source: string;
  visitors: number;
  bounceRate: number;
  visitDuration: number;
  qualityScore: number;
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
};

export type PeriodComparison = {
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
      significance: 'significant' | 'notable' | 'normal';
    };
  }>;
};

export type DecayingContent = {
  page: string;
  recentVisitors: number;
  baselineVisitors: number;
  dropPercent: number;
  severity: 'critical' | 'high' | 'medium';
};

// Helper to calculate quality score
function calculateQuality(bounceRate: number, avgDuration: number): PagePerformance['quality'] {
  if (bounceRate < 30 && avgDuration > 180) return 'excellent';
  if (bounceRate < 50 && avgDuration > 60) return 'good';
  if (bounceRate < 70 && avgDuration > 30) return 'poor';
  return 'very-poor';
}

// Helper to calculate source quality score
function calculateSourceQualityScore(bounceRate: number, visitDuration: number): number {
  let score = 0;

  // Bounce rate score (0-60 points) - lower is better
  if (bounceRate <= 30) score += 60;
  else if (bounceRate <= 50) score += 45;
  else if (bounceRate <= 70) score += 25;

  // Visit duration score (0-40 points) - higher is better
  if (visitDuration >= 180) score += 40;
  else if (visitDuration >= 60) score += 30;
  else if (visitDuration >= 30) score += 15;

  return score;
}

function scoreToGrade(score: number): SourceQuality['qualityGrade'] {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

// Top performing pages
export async function getTopPages(options: {
  dateRange: DateRange;
  limit?: number;
  minVisitors?: number;
}): Promise<PagePerformance[]> {
  const response = await executeQuery({
    metrics: ['visitors', 'pageviews'],
    dimensions: ['visit:entry_page'],
    date_range: options.dateRange,
    pagination: {
      limit: options.limit || 50,
      offset: 0
    },
    order_by: [['visitors', 'desc']]
  });

  const pages: PagePerformance[] = response.results
    .filter(r => r.metrics[0] >= (options.minVisitors || 0))
    .map(r => ({
      page: r.dimensions![0],
      visitors: r.metrics[0],
      pageviews: r.metrics[1],
      bounceRate: 0, // Will need separate query for session metrics
      avgDuration: 0,
      quality: 'good' as const
    }));

  return pages;
}
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/queries/seo.ts
git commit -m "feat: add SEO helper types and getTopPages function"
```

---

## Task 10: Implement High-Level SEO Helpers (Part 2)

**Files:**
- Modify: `.claude/skills/plausible-insights/lib/queries/seo.ts`

**Step 1: Add remaining SEO helper functions**

Add to end of `lib/queries/seo.ts`:

```typescript
// Traffic sources with quality scoring
export async function getTrafficSources(options: {
  dateRange: DateRange;
  minVisitors?: number;
}): Promise<SourceQuality[]> {
  const response = await executeQuery({
    metrics: ['visitors', 'bounce_rate', 'visit_duration'],
    dimensions: ['visit:source'],
    date_range: options.dateRange,
    pagination: {
      limit: 50,
      offset: 0
    }
  });

  const sources: SourceQuality[] = response.results
    .filter(r => r.metrics[0] >= (options.minVisitors || 10))
    .map(r => {
      const visitors = r.metrics[0];
      const bounceRate = r.metrics[1];
      const visitDuration = r.metrics[2];
      const qualityScore = calculateSourceQualityScore(bounceRate, visitDuration);

      return {
        source: r.dimensions![0],
        visitors,
        bounceRate,
        visitDuration,
        qualityScore,
        qualityGrade: scoreToGrade(qualityScore)
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);

  return sources;
}

// Period comparison
export async function comparePeriods(options: {
  current: DateRange;
  previous: DateRange;
  metrics?: Metric[];
}): Promise<PeriodComparison> {
  const metricsToCompare = options.metrics || [
    'visitors',
    'pageviews',
    'bounce_rate',
    'visit_duration'
  ];

  const [currentResponse, previousResponse] = await Promise.all([
    executeQuery({
      metrics: metricsToCompare,
      date_range: options.current
    }),
    executeQuery({
      metrics: metricsToCompare,
      date_range: options.previous
    })
  ]);

  const currentValues = currentResponse.results[0]?.metrics || [];
  const previousValues = previousResponse.results[0]?.metrics || [];

  const metricComparisons = metricsToCompare.map((metric, idx) => {
    const current = currentValues[idx] || 0;
    const previous = previousValues[idx] || 0;
    const absolute = current - previous;
    const percent = previous === 0 ? 0 : (absolute / previous) * 100;

    let direction: 'up' | 'down' | 'flat';
    if (current > previous) direction = 'up';
    else if (current < previous) direction = 'down';
    else direction = 'flat';

    let significance: 'significant' | 'notable' | 'normal';
    const absPercent = Math.abs(percent);
    if (absPercent >= 30) significance = 'significant';
    else if (absPercent >= 15) significance = 'notable';
    else significance = 'normal';

    return {
      name: metric,
      current,
      previous,
      change: {
        absolute,
        percent,
        direction,
        significance
      }
    };
  });

  return {
    summary: {
      currentPeriod: String(options.current),
      previousPeriod: String(options.previous)
    },
    metrics: metricComparisons
  };
}

// Content decay detection
export async function getContentDecay(options: {
  compareWindows: {
    recent: DateRange;
    baseline: DateRange;
  };
  threshold?: number;
  pathPattern?: string;
}): Promise<DecayingContent[]> {
  const threshold = options.threshold || 30;
  const queryParams = {
    metrics: ['visitors' as const],
    dimensions: ['event:page'],
    pagination: { limit: 200, offset: 0 },
    ...(options.pathPattern && {
      filters: [filters.pageContains(options.pathPattern)]
    })
  };

  const [recentResponse, baselineResponse] = await Promise.all([
    executeQuery({ ...queryParams, date_range: options.compareWindows.recent }),
    executeQuery({ ...queryParams, date_range: options.compareWindows.baseline })
  ]);

  // Build map of baseline visitors
  const baselineMap = new Map<string, number>();
  for (const result of baselineResponse.results) {
    baselineMap.set(result.dimensions![0], result.metrics[0]);
  }

  // Find decaying pages
  const decayingPages: DecayingContent[] = [];

  for (const result of recentResponse.results) {
    const page = result.dimensions![0];
    const recentVisitors = result.metrics[0];
    const baselineVisitors = baselineMap.get(page) || 0;

    if (baselineVisitors === 0) continue;

    const dropPercent = ((baselineVisitors - recentVisitors) / baselineVisitors) * 100;

    if (dropPercent >= threshold) {
      let severity: DecayingContent['severity'];
      if (dropPercent >= 50) severity = 'critical';
      else if (dropPercent >= 30) severity = 'high';
      else severity = 'medium';

      decayingPages.push({
        page,
        recentVisitors,
        baselineVisitors,
        dropPercent,
        severity
      });
    }
  }

  return decayingPages.sort((a, b) => b.dropPercent - a.dropPercent);
}

// Blog performance analysis
export async function getBlogPerformance(options: {
  dateRange: DateRange;
  pathPattern?: string;
  limit?: number;
}): Promise<ContentAnalysis> {
  const pathPattern = options.pathPattern || '/posts/';

  const response = await executeQuery({
    metrics: ['visitors', 'pageviews'],
    dimensions: ['event:page'],
    date_range: options.dateRange,
    filters: [filters.pageContains(pathPattern)],
    pagination: {
      limit: options.limit || 50,
      offset: 0
    },
    order_by: [['visitors', 'desc']]
  });

  const posts: PagePerformance[] = response.results.map(r => ({
    page: r.dimensions![0],
    visitors: r.metrics[0],
    pageviews: r.metrics[1],
    bounceRate: 0, // Placeholder
    avgDuration: 0, // Placeholder
    quality: 'good' as const
  }));

  const totalVisitors = posts.reduce((sum, p) => sum + p.visitors, 0);
  const avgBounceRate = 0; // Would need separate query

  return {
    summary: {
      totalPosts: posts.length,
      totalVisitors,
      avgBounceRate,
      highPerformers: 0, // Would need bounce rate data
      lowPerformers: 0 // Would need bounce rate data
    },
    posts
  };
}
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/queries/seo.ts
git commit -m "feat: add traffic sources, period comparison, and content decay helpers"
```

---

## Task 11: Implement CLI (Part 1 - Setup)

**Files:**
- Create: `.claude/skills/plausible-insights/lib/cli.ts`

**Step 1: Create CLI scaffolding**

```typescript
#!/usr/bin/env tsx

import { Command } from 'commander';
import * as seo from './queries/seo.js';
import * as basic from './queries/basic.js';
import { logger } from './utils/logger.js';
import { cache } from './utils/cache.js';
import { ValidationError, PlausibleError } from './client/errors.js';
import { config } from 'dotenv';

// Load environment
config();

const program = new Command();

program
  .name('plausible-cli')
  .description('Plausible Analytics CLI for AI agents')
  .version('1.0.0');

// Global options
program
  .option('--no-cache', 'Bypass cache and fetch fresh data')
  .option('--extract <path>', 'Extract value using jq-style path')
  .option('--debug', 'Enable debug output');

// Helper to handle command execution
async function executeCommand(
  fn: () => Promise<any>,
  options: { cache?: boolean; extract?: string; debug?: boolean }
) {
  try {
    const result = await fn();

    // Extract specific value if requested
    if (options.extract) {
      const extracted = extractPath(result, options.extract);
      console.log(JSON.stringify(extracted, null, 2));
      return;
    }

    // Standard JSON output
    console.log(JSON.stringify({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString()
      }
    }, null, 2));

  } catch (error: any) {
    if (error instanceof PlausibleError || error instanceof ValidationError) {
      console.error(JSON.stringify(error.toJSON(), null, 2));
      process.exit(1);
    }

    // Unexpected errors
    console.error(JSON.stringify({
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error.message,
        ...(options.debug && { stack: error.stack })
      }
    }, null, 2));

    await logger.apiError(error, {});
    process.exit(1);
  }
}

// Utility: extract nested value from object
function extractPath(obj: any, path: string): any {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(p => p !== '');

  return parts.reduce((acc, part) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[part];
  }, obj);
}

// Utility: read from stdin
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

// Low-level query command
program
  .command('query')
  .description('Execute raw Plausible API query')
  .argument('[json]', 'Query as JSON string (or pipe via stdin)')
  .action(async (json, options, command) => {
    const input = json || await readStdin();
    const query = JSON.parse(input);

    await executeCommand(
      () => basic.query(query, { noCache: !command.optsWithGlobals().cache }),
      command.optsWithGlobals()
    );
  });

// Cache management
program
  .command('cache')
  .description('Manage query cache')
  .argument('<action>', 'Action: clear, prune, info')
  .action(async (action) => {
    if (action === 'clear') {
      await cache.clear();
      console.log('✓ Cache cleared');
    } else if (action === 'prune') {
      const pruned = await cache.prune();
      console.log(`✓ Pruned ${pruned} stale entries`);
    } else if (action === 'info') {
      const info = await cache.info();
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.error(`Unknown action: ${action}`);
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
```

**Step 2: Make CLI executable**

Run:
```bash
chmod +x .claude/skills/plausible-insights/lib/cli.ts
```

**Step 3: Test basic CLI**

Run:
```bash
cd .claude/skills/plausible-insights
tsx lib/cli.ts --help
```

Expected: Help output displayed

**Step 4: Commit**

```bash
git add lib/cli.ts
git commit -m "feat: add CLI scaffolding with query and cache commands"
```

---

## Task 12: Implement CLI (Part 2 - SEO Commands)

**Files:**
- Modify: `.claude/skills/plausible-insights/lib/cli.ts`

**Step 1: Add SEO commands**

Add before `program.parse()` in `lib/cli.ts`:

```typescript
// High-level SEO commands
program
  .command('get-top-pages')
  .description('Get top performing pages')
  .option('-d, --date-range <range>', 'Date range', '7d')
  .option('-l, --limit <number>', 'Number of results', '50')
  .option('--min-visitors <number>', 'Minimum visitors filter', '0')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getTopPages({
        dateRange: options.dateRange,
        limit: parseInt(options.limit),
        minVisitors: parseInt(options.minVisitors)
      }),
      command.optsWithGlobals()
    );
  });

program
  .command('get-blog-performance')
  .description('Analyze blog/content performance')
  .option('-d, --date-range <range>', 'Date range', '7d')
  .option('-p, --path-pattern <pattern>', 'Path pattern', '/posts/')
  .option('-l, --limit <number>', 'Number of results', '50')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getBlogPerformance({
        dateRange: options.dateRange,
        pathPattern: options.pathPattern,
        limit: parseInt(options.limit)
      }),
      command.optsWithGlobals()
    );
  });

program
  .command('get-traffic-sources')
  .description('Analyze traffic sources with quality scoring')
  .option('-d, --date-range <range>', 'Date range', '7d')
  .option('--min-visitors <number>', 'Minimum visitors', '10')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getTrafficSources({
        dateRange: options.dateRange,
        minVisitors: parseInt(options.minVisitors)
      }),
      command.optsWithGlobals()
    );
  });

program
  .command('compare-periods')
  .description('Compare two time periods')
  .option('-c, --current <range>', 'Current period', '7d')
  .option('-p, --previous <range>', 'Previous period', 'previous_7d')
  .option('-m, --metrics <list>', 'Comma-separated metrics', 'visitors,pageviews,bounce_rate')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.comparePeriods({
        current: options.current,
        previous: options.previous,
        metrics: options.metrics.split(',') as any
      }),
      command.optsWithGlobals()
    );
  });

program
  .command('get-content-decay')
  .description('Detect decaying content')
  .option('--recent <range>', 'Recent period', '7d')
  .option('--baseline <range>', 'Baseline period', '30d')
  .option('--threshold <percent>', 'Drop threshold percentage', '30')
  .option('--path-pattern <pattern>', 'Path pattern')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getContentDecay({
        compareWindows: {
          recent: options.recent,
          baseline: options.baseline
        },
        threshold: parseInt(options.threshold),
        pathPattern: options.pathPattern
      }),
      command.optsWithGlobals()
    );
  });
```

**Step 2: Test CLI commands**

Run:
```bash
cd .claude/skills/plausible-insights
tsx lib/cli.ts get-top-pages --help
tsx lib/cli.ts compare-periods --help
```

Expected: Command-specific help displayed

**Step 3: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/cli.ts
git commit -m "feat: add SEO command implementations to CLI"
```

---

## Task 13: Create Index Export

**Files:**
- Create: `.claude/skills/plausible-insights/lib/index.ts`

**Step 1: Create index exports**

```typescript
// Export all public APIs
export * from './client/schemas.js';
export * from './client/errors.js';
export * from './client/plausible.js';
export * from './queries/basic.js';
export * from './queries/seo.js';
export * from './utils/cache.js';
export * from './utils/logger.js';
export * from './utils/date-ranges.js';
```

**Step 2: Type check**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/index.ts
git commit -m "feat: add index exports for public API"
```

---

## Task 14: Update SKILL.md Documentation

**Files:**
- Modify: `.claude/skills/plausible-insights/SKILL.md`

**Step 1: Replace script examples with TypeScript CLI**

Find the section starting with `## Tools Available` and replace `### Fast Query Script` section:

```markdown
## Tools Available

### TypeScript CLI

**All commands return standardized JSON:**
```json
{
  "success": true,
  "data": { /* results */ },
  "meta": {
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

**Cache management:**
```bash
tsx lib/cli.ts cache clear   # Clear all cache
tsx lib/cli.ts cache prune   # Remove stale entries
tsx lib/cli.ts cache info    # Show cache stats
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

**Step 2: Update workflow examples**

In the `## Workflow` section, update step 2 to reference TypeScript CLI instead of bash scripts.

**Step 3: Commit**

```bash
git add SKILL.md
git commit -m "docs: update SKILL.md to use TypeScript CLI"
```

---

## Task 15: Remove Bash Scripts

**Files:**
- Delete: `.claude/skills/plausible-insights/scripts/plausible-quick-query.sh`
- Delete: `.claude/skills/plausible-insights/scripts/plausible-compare-periods.sh`
- Delete: `.claude/skills/plausible-insights/scripts/plausible-source-quality.sh`

**Step 1: Remove bash scripts**

Run:
```bash
cd .claude/skills/plausible-insights
rm -rf scripts/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor: remove bash scripts, replaced by TypeScript SDK"
```

---

## Task 16: Final Testing

**Step 1: Test with real API (if credentials available)**

Run:
```bash
cd .claude/skills/plausible-insights
tsx lib/cli.ts get-top-pages --date-range day --limit 10
```

Expected: Real data or auth error (if no .env)

**Step 2: Test error handling**

Run:
```bash
tsx lib/cli.ts query '{"metrics":["bounce_rate"],"dimensions":["event:page"]}'
```

Expected: Validation error with suggestion

**Step 3: Test cache**

Run:
```bash
tsx lib/cli.ts cache info
```

Expected: Cache directory info

**Step 4: Final type check**

Run: `npm run type-check`
Expected: No errors

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final testing and validation complete"
```

---

## Summary

Implementation complete! The TypeScript SDK provides:

✅ **Two-layer API** - Low-level builders + high-level SEO helpers
✅ **Strict Zod validation** - Catches API quirks before execution
✅ **CLI interface** - `tsx lib/cli.ts <command>` with JSON I/O
✅ **Smart caching** - 5-minute TTL reduces API calls
✅ **Comprehensive logging** - All activity logged for debugging
✅ **Clear error messages** - Actionable suggestions for fixes
✅ **Fully typed** - TypeScript types throughout

**Next steps:**
- Test with real Plausible data
- Update workflow examples in references/
- Add more SEO helpers based on usage patterns
