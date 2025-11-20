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
