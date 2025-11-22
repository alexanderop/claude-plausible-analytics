import { config } from 'dotenv';
import { ValidatedQuerySchema, APIResponseSchema, type QueryParams, type APIResponse } from './schemas.js';
import { APIError, ConfigError, NetworkError, ValidationError } from './errors.js';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

// Load environment variables
config();

const API_URL = process.env.PLAUSIBLE_API_URL || 'https://plausible.io/api/v2/query';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface ExecuteOptions {
  noCache?: boolean;
  timeout?: number;
  verbose?: boolean;
}

export async function executeQuery(
  params: QueryParams,
  options: ExecuteOptions = {}
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
      body: JSON.stringify(validated),
      // Bun-specific options
      signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
      verbose: options.verbose,
    } as RequestInit);

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

    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      const timeoutError = new NetworkError(new Error(`Request timed out after ${options.timeout ?? DEFAULT_TIMEOUT_MS}ms`));
      await logger.apiError(timeoutError, validated);
      throw timeoutError;
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
