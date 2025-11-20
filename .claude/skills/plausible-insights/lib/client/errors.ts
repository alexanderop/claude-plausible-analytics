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
    const params = (firstError as any).params;
    const code = (params?.code as string) || 'VALIDATION_ERROR';
    const suggestion = params?.suggestion as string | undefined;

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
