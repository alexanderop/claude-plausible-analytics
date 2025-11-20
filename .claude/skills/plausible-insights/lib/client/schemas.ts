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
