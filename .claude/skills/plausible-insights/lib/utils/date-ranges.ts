import type { DateRange } from '../client/schemas.js';

export const dateRanges = {
  // Relative
  today(): DateRange {
    return 'day';
  },

  yesterday(): DateRange {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const dateStr = date.toISOString().split('T')[0];
    return [dateStr, dateStr];
  },

  last7Days(): DateRange {
    return '7d';
  },

  last30Days(): DateRange {
    return '30d';
  },

  thisMonth(): DateRange {
    return 'month';
  },

  thisYear(): DateRange {
    return 'year';
  },

  // Absolute
  between(start: string, end: string): DateRange {
    return [start, end];
  },

  // Comparative (for period comparisons)
  previous7Days(): DateRange {
    const end = new Date();
    end.setDate(end.getDate() - 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  },

  previous30Days(): DateRange {
    const end = new Date();
    end.setDate(end.getDate() - 30);
    const start = new Date(end);
    start.setDate(start.getDate() - 30);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  },

  // Custom relative
  lastNDays(n: number): DateRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - n);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  },

  daysAgo(startDays: number, endDays: number): DateRange {
    const start = new Date();
    start.setDate(start.getDate() - startDays);
    const end = new Date();
    end.setDate(end.getDate() - endDays);

    return [
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    ];
  }
};
