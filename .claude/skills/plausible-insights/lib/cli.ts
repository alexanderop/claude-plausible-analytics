#!/usr/bin/env tsx

import { Command } from 'commander';
import * as basic from './queries/basic.js';
import * as seo from './queries/seo.js';
import { logger } from './utils/logger.js';
import { cache } from './utils/cache.js';
import { ValidationError, PlausibleError } from './client/errors.js';
import { config } from 'dotenv';
import type { DateRange } from './client/schemas.js';

// Load environment
config();

const program = new Command();

program
  .name('plausible')
  .description('Plausible Analytics CLI - raw queries and high-level SEO commands')
  .version('2.0.0');

// Global options
program
  .option('--no-cache', 'Bypass cache and fetch fresh data')
  .option('--extract <path>', 'Extract value using jq-style path (e.g., "data.results[0].metrics[0]")')
  .option('--format <type>', 'Output format: json (default), csv, table', 'json')
  .option('--debug', 'Enable debug output');

// Output formatters
function formatOutput(data: any, format: string): string {
  if (format === 'csv') {
    return formatCSV(data);
  } else if (format === 'table') {
    return formatTable(data);
  }
  return JSON.stringify({ success: true, data, meta: { timestamp: new Date().toISOString() } }, null, 2);
}

function formatCSV(data: any): string {
  if (!Array.isArray(data) || data.length === 0) {
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h];
    if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }).join(','));

  return [headers.join(','), ...rows].join('\n');
}

function formatTable(data: any): string {
  if (!Array.isArray(data) || data.length === 0) {
    return typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
  }

  const headers = Object.keys(data[0]);
  const widths = headers.map(h => Math.max(h.length, ...data.map(r => String(r[h]).length)));

  const separator = widths.map(w => '-'.repeat(w + 2)).join('+');
  const headerRow = headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('|');
  const dataRows = data.map(row =>
    headers.map((h, i) => ` ${String(row[h]).padEnd(widths[i])} `).join('|')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}

// Helper to handle command execution
async function executeCommand(
  fn: () => Promise<any>,
  options: { cache?: boolean; extract?: string; format?: string; debug?: boolean }
) {
  try {
    const result = await fn();

    // Extract specific value if requested
    if (options.extract) {
      const extracted = extractPath(result, options.extract);
      console.log(JSON.stringify(extracted, null, 2));
      return;
    }

    // Format output
    console.log(formatOutput(result, options.format || 'json'));

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

    await logger.apiError(error, { metrics: ['visitors'], date_range: 'day' });
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

// Utility: parse date range
function parseDateRange(range: string): DateRange {
  if (range.includes(',')) {
    const [start, end] = range.split(',');
    return [start.trim(), end.trim()];
  }
  return range as DateRange;
}

// ============================================================================
// HIGH-LEVEL SEO COMMANDS
// ============================================================================

// Top pages command
program
  .command('top-pages')
  .description('Get top performing pages with engagement metrics')
  .option('-r, --range <range>', 'Date range (e.g., "7d", "30d", "2025-01-01,2025-01-31")', '7d')
  .option('-l, --limit <n>', 'Number of pages to return', '20')
  .option('-m, --min-visitors <n>', 'Minimum visitors threshold', '0')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getTopPages({
        dateRange: parseDateRange(options.range),
        limit: parseInt(options.limit),
        minVisitors: parseInt(options.minVisitors)
      }),
      command.optsWithGlobals()
    );
  });

// Traffic sources command
program
  .command('sources')
  .description('Get traffic sources ranked by quality (bounce rate + duration)')
  .option('-r, --range <range>', 'Date range', '30d')
  .option('-m, --min-visitors <n>', 'Minimum visitors threshold', '10')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getTrafficSources({
        dateRange: parseDateRange(options.range),
        minVisitors: parseInt(options.minVisitors)
      }),
      command.optsWithGlobals()
    );
  });

// Period comparison command
program
  .command('compare')
  .description('Compare metrics between two time periods')
  .option('-c, --current <range>', 'Current period (e.g., "7d")', '7d')
  .option('-p, --previous <range>', 'Previous period (e.g., "30d" or "2025-01-01,2025-01-07")', '30d')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.comparePeriods({
        current: parseDateRange(options.current),
        previous: parseDateRange(options.previous)
      }),
      command.optsWithGlobals()
    );
  });

// Content decay command
program
  .command('decay')
  .description('Find content with declining traffic')
  .option('-t, --threshold <percent>', 'Minimum drop percentage to report', '30')
  .option('--recent <range>', 'Recent period to compare', '7d')
  .option('--baseline <range>', 'Baseline period', '30d')
  .option('--pattern <path>', 'Filter by path pattern (e.g., "/posts/")')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getContentDecay({
        compareWindows: {
          recent: parseDateRange(options.recent),
          baseline: parseDateRange(options.baseline)
        },
        threshold: parseInt(options.threshold),
        pathPattern: options.pattern
      }),
      command.optsWithGlobals()
    );
  });

// Blog performance command
program
  .command('blog')
  .description('Analyze blog/content performance')
  .option('-r, --range <range>', 'Date range', '7d')
  .option('-p, --pattern <path>', 'Path pattern for blog posts', '/posts/')
  .option('-l, --limit <n>', 'Number of posts to return', '50')
  .action(async (options, command) => {
    await executeCommand(
      () => seo.getBlogPerformance({
        dateRange: parseDateRange(options.range),
        pathPattern: options.pattern,
        limit: parseInt(options.limit)
      }),
      command.optsWithGlobals()
    );
  });

// ============================================================================
// RAW QUERY COMMAND
// ============================================================================

// Raw query command (default command)
program
  .command('query', { isDefault: true })
  .description('Execute raw Plausible API query with validation')
  .argument('[json]', 'Query as JSON string (or pipe via stdin)')
  .action(async (json, options, command) => {
    const input = json || await readStdin();

    try {
      const query = JSON.parse(input);

      await executeCommand(
        () => basic.query(query, { noCache: !command.optsWithGlobals().cache }),
        command.optsWithGlobals()
      );
    } catch (parseError: any) {
      console.error(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Failed to parse JSON input',
          details: parseError.message
        }
      }, null, 2));
      process.exit(1);
    }
  });

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

program
  .command('cache')
  .description('Manage query cache')
  .argument('<action>', 'Action: clear, prune, info')
  .action(async (action) => {
    if (action === 'clear') {
      await cache.clear();
      console.log(JSON.stringify({ success: true, message: 'Cache cleared' }, null, 2));
    } else if (action === 'prune') {
      const pruned = await cache.prune();
      console.log(JSON.stringify({ success: true, message: `Pruned ${pruned} stale entries` }, null, 2));
    } else if (action === 'info') {
      const info = await cache.info();
      console.log(JSON.stringify({ success: true, data: info }, null, 2));
    } else {
      console.error(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: `Unknown cache action: ${action}. Use: clear, prune, or info`
        }
      }, null, 2));
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
