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
