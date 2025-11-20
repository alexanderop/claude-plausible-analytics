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
