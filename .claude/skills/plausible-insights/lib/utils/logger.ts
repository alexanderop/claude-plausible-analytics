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
