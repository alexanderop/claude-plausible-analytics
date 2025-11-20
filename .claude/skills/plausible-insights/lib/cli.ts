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
