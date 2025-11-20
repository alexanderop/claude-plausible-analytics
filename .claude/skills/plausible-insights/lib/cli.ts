#!/usr/bin/env tsx

import { Command } from 'commander';
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
  .description('Raw Plausible Analytics query interface with validation')
  .version('1.0.0');

// Global options
program
  .option('--no-cache', 'Bypass cache and fetch fresh data')
  .option('--extract <path>', 'Extract value using jq-style path (e.g., "data.results[0].metrics[0]")')
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

// Cache management
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
