import { describe, expect, it } from 'vitest';
import {
  addDaysKey,
  isStatutoryHoliday,
  isStatutoryWorkday,
  type RecurrenceRule,
  type RecurrenceSeries,
} from '@dayline/core';
import {
  buildRule,
  expandSeries,
  nextCompletionOccurrence,
  nextOccurrence,
} from './index';

const now = new Date(2026, 10, 5, 9, 0, 0).getTime();

function makeSeries(
  rule: RecurrenceRule,
  dtstartDate = '2026-11-05',
  overrides: Partial<RecurrenceSeries> = {},
): RecurrenceSeries {
  return {
    id: 'series-1',
    profileId: 'profile-1',
    templateTaskId: 'task-1',
    mode: 'due',
    rule,
    timezone: 'Asia/Shanghai',
    dtstartDate,
    dtstartTime: null,
    endType: 'never',
    endDate: null,
    endCount: null,
    completedCount: 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function dates(occurrences: Array<{ occurrenceDate: string }>): string[] {
  return occurrences.map((occurrence) => occurrence.occurrenceDate);
}

describe('expandSeries', () => {
  it('expands daily rules', () => {
    const series = makeSeries(buildRule('daily'));
    expect(dates(expandSeries(series, '2026-11-05', '2026-11-08'))).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('expands every N days', () => {
    const series = makeSeries(buildRule('daily', { interval: 2 }));
    expect(dates(expandSeries(series, '2026-11-05', '2026-11-11'))).toEqual([
      '2026-11-05',
      '2026-11-07',
      '2026-11-09',
      '2026-11-11',
    ]);
  });

  it('expands weekly rules on selected weekdays', () => {
    const series = makeSeries(buildRule('weekly', { byWeekday: [1, 3, 5] }));
    expect(dates(expandSeries(series, '2026-11-05', '2026-11-15'))).toEqual([
      '2026-11-06',
      '2026-11-09',
      '2026-11-11',
      '2026-11-13',
    ]);
  });

  it('clamps monthly 31 to the last day', () => {
    const series = makeSeries(buildRule('monthly', { byMonthDay: [31] }), '2026-01-31');
    expect(dates(expandSeries(series, '2026-01-31', '2026-03-31'))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('clamps yearly Feb 29 to Feb 28', () => {
    const series = makeSeries(buildRule('yearly'), '2024-02-29');
    expect(dates(expandSeries(series, '2024-02-29', '2026-03-01'))).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
    ]);
  });

  it('expands weekdays and weekends', () => {
    const weekdays = makeSeries(buildRule('weekdays'), '2026-11-06');
    expect(dates(expandSeries(weekdays, '2026-11-06', '2026-11-10'))).toEqual([
      '2026-11-06',
      '2026-11-09',
      '2026-11-10',
    ]);

    const weekend = makeSeries(buildRule('weekend'), '2026-11-06');
    expect(dates(expandSeries(weekend, '2026-11-06', '2026-11-15'))).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  it('uses custom workday and holiday predicates', () => {
    const series = makeSeries(buildRule('statutory_workday'), '2026-11-06');
    const workdays = new Set(['2026-11-06', '2026-11-07', '2026-11-10']);
    expect(
      dates(
        expandSeries(series, '2026-11-06', '2026-11-11', {
          isWorkday: (date) => workdays.has(date),
        }),
      ),
    ).toEqual(['2026-11-06', '2026-11-07', '2026-11-10']);
  });

  it('expands 2026 statutory workdays around National Day', () => {
    const series = makeSeries(buildRule('statutory_workday'), '2026-09-30');
    expect(
      dates(
        expandSeries(series, '2026-09-30', '2026-10-12', {
          isWorkday: isStatutoryWorkday,
          isHoliday: isStatutoryHoliday,
        }),
      ),
    ).toEqual([
      '2026-09-30',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-12',
    ]);
  });

  it('expands 2026 statutory holidays around National Day', () => {
    const series = makeSeries(buildRule('statutory_holiday'), '2026-09-30');
    expect(
      dates(
        expandSeries(series, '2026-09-30', '2026-10-12', {
          isWorkday: isStatutoryWorkday,
          isHoliday: isStatutoryHoliday,
        }),
      ),
    ).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-11',
    ]);
  });

  it('expands selected dates', () => {
    const series = makeSeries(
      buildRule('selected_dates', {
        selectedDates: ['2026-11-10', '2026-11-05', '2026-11-10', '2026-11-20'],
      }),
    );
    expect(dates(expandSeries(series, '2026-11-05', '2026-11-15'))).toEqual([
      '2026-11-05',
      '2026-11-10',
    ]);
  });

  it('expands Ebbinghaus day numbers', () => {
    const series = makeSeries(buildRule('ebbinghaus'));
    expect(dates(expandSeries(series, '2026-11-05', '2026-12-20'))).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-08',
      '2026-11-11',
      '2026-11-19',
      '2026-12-04',
      '2026-12-19',
    ]);
  });

  it('honors end count and end date', () => {
    const byCount = makeSeries(buildRule('daily'), '2026-11-05', {
      endType: 'count',
      endCount: 3,
    });
    expect(dates(expandSeries(byCount, '2026-11-05', '2026-11-20'))).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);

    const byDate = makeSeries(buildRule('daily'), '2026-11-05', {
      endType: 'date',
      endDate: '2026-11-07',
    });
    expect(dates(expandSeries(byDate, '2026-11-05', '2026-11-20'))).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);
  });

  it('skips window start while keeping occurrence indexes', () => {
    const series = makeSeries(buildRule('daily'));
    const occurrences = expandSeries(series, '2026-11-08', '2026-11-09');
    expect(occurrences.map((occurrence) => occurrence.occurrenceIndex)).toEqual([3, 4]);
  });

  it('does not project completion-based series', () => {
    const series = makeSeries(buildRule('daily'), '2026-11-05', { mode: 'completion' });
    expect(expandSeries(series, '2026-11-05', '2026-11-10')).toEqual([]);
  });
});

describe('nextOccurrence', () => {
  it('finds the next occurrence after a date', () => {
    const series = makeSeries(buildRule('weekly', { byWeekday: [1, 3, 5] }));
    expect(nextOccurrence(series, '2026-11-06')?.occurrenceDate).toBe('2026-11-09');
  });

  it('supports catch-up with notBefore', () => {
    const series = makeSeries(buildRule('daily'));
    expect(
      nextOccurrence(series, '2026-11-05', { notBefore: '2026-11-20' })?.occurrenceDate,
    ).toBe('2026-11-20');
  });

  it('stops at the end', () => {
    const series = makeSeries(buildRule('daily'), '2026-11-05', {
      endType: 'count',
      endCount: 2,
    });
    expect(nextOccurrence(series, '2026-11-06')).toBeNull();
  });
});

describe('nextCompletionOccurrence', () => {
  it('anchors the next occurrence to the completion date', () => {
    const series = makeSeries(buildRule('daily', { interval: 3 }), '2026-11-05', {
      mode: 'completion',
    });
    expect(nextCompletionOccurrence(series, '2026-11-06')?.occurrenceDate).toBe(
      addDaysKey('2026-11-06', 3),
    );
  });

  it('adds months and clamps the day', () => {
    const series = makeSeries(buildRule('monthly'), '2026-01-31', {
      mode: 'completion',
    });
    expect(nextCompletionOccurrence(series, '2026-01-31')?.occurrenceDate).toBe(
      '2026-02-28',
    );
  });

  it('stops at end count', () => {
    const series = makeSeries(buildRule('daily'), '2026-11-05', {
      mode: 'completion',
      endType: 'count',
      endCount: 1,
    });
    expect(nextCompletionOccurrence(series, '2026-11-05', { afterIndex: 0 })).toBeNull();
  });
});
