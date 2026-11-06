import {
  addDaysKey,
  localDateKey,
  parseLocalDateKey,
  type RecurrenceRule,
  type RecurrenceSeries,
} from '@dayline/core';

export interface RecurrenceOccurrence {
  occurrenceDate: string;
  occurrenceIndex: number;
  startDate: string;
  startTime: string | null;
}

export interface RecurrenceOptions {
  maxOccurrences?: number;
  notBefore?: string;
  isWorkday?: (date: string) => boolean;
  isHoliday?: (date: string) => boolean;
}

export interface NextCompletionOptions extends RecurrenceOptions {
  afterIndex?: number;
}

const DEFAULT_MAX = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function weekday(date: string): number {
  const day = parseLocalDateKey(date).getDay();
  return day === 0 ? 7 : day;
}

function startOfWeek(date: string, weekStart: 1 | 7): string {
  const current = weekday(date);
  const diff = (current - weekStart + 7) % 7;
  return addDaysKey(date, -diff);
}

function addMonthsKey(date: string, months: number): string {
  const parsed = parseLocalDateKey(date);
  const total = parsed.getMonth() + months;
  const year = parsed.getFullYear() + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  const month = monthIndex + 1;
  const day = Math.min(parsed.getDate(), daysInMonth(year, month));
  return dateKey(year, month, day);
}

function addYearsKey(date: string, years: number): string {
  const parsed = parseLocalDateKey(date);
  const year = parsed.getFullYear() + years;
  const month = parsed.getMonth() + 1;
  const day = Math.min(parsed.getDate(), daysInMonth(year, month));
  return dateKey(year, month, day);
}

function normalizeRule(rule: RecurrenceRule): Required<
  Pick<RecurrenceRule, 'version' | 'freq'>
> &
  RecurrenceRule {
  return {
    ...rule,
    version: 1,
    freq: rule.freq,
    interval: Math.max(1, rule.interval ?? 1),
    weekStart: rule.weekStart ?? 1,
  };
}

function daysBetween(start: string, end: string): number {
  return Math.round((parseLocalDateKey(end).getTime() - parseLocalDateKey(start).getTime()) / DAY_MS);
}

function defaultByWeekday(start: string): number[] {
  return [weekday(start)];
}

function defaultByMonthDay(start: string): number[] {
  return [parseLocalDateKey(start).getDate()];
}

function generateCandidates(
  series: RecurrenceSeries,
  untilDate: string,
  options: RecurrenceOptions,
): string[] {
  const rule = normalizeRule(series.rule);
  const start = series.dtstartDate;
  const limit = options.maxOccurrences ?? DEFAULT_MAX;
  const result: string[] = [];

  if (rule.freq === 'lunar_yearly' || rule.freq === 'lunar_monthly') {
    throw new Error('农历重复需要提供农历转换器，当前 Web 端尚未接入');
  }

  switch (rule.freq) {
    case 'daily': {
      const step = rule.interval ?? 1;
      for (let i = 0; result.length < limit; i += 1) {
        const date = addDaysKey(start, i * step);
        if (date > untilDate) break;
        result.push(date);
      }
      break;
    }

    case 'weekly': {
      const interval = rule.interval ?? 1;
      const byWeekday = rule.byWeekday?.length ? rule.byWeekday : defaultByWeekday(start);
      const weekStart = rule.weekStart ?? 1;
      const firstWeek = startOfWeek(start, weekStart);
      let done = false;

      for (let week = 0; !done && result.length < limit; week += 1) {
        const weekDate = addDaysKey(firstWeek, week * interval * 7);
        for (const target of byWeekday) {
          const offset = (target - weekStart + 7) % 7;
          const date = addDaysKey(weekDate, offset);
          if (date < start) continue;
          if (date > untilDate) {
            done = true;
            break;
          }
          result.push(date);
          if (result.length >= limit) break;
        }
      }
      break;
    }

    case 'monthly': {
      const interval = rule.interval ?? 1;
      const byMonthDay = rule.byMonthDay?.length ? rule.byMonthDay : defaultByMonthDay(start);
      const startDate = parseLocalDateKey(start);
      let done = false;

      for (let monthOffset = 0; !done && result.length < limit; monthOffset += interval) {
        const cursor = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, 1);
        const year = cursor.getFullYear();
        const month = cursor.getMonth() + 1;
        const monthKey = dateKey(year, month, 1);
        if (monthKey > untilDate) break;

        const maxDay = daysInMonth(year, month);
        const days = byMonthDay
          .map((value) => (value > 0 ? Math.min(value, maxDay) : Math.max(1, maxDay + value + 1)))
          .sort((a, b) => a - b);

        for (const day of days) {
          const date = dateKey(year, month, day);
          if (date < start) continue;
          if (date > untilDate) {
            done = true;
            break;
          }
          result.push(date);
          if (result.length >= limit) break;
        }
      }
      break;
    }

    case 'yearly': {
      const interval = rule.interval ?? 1;
      const byMonth = rule.byMonth?.length
        ? rule.byMonth
        : [parseLocalDateKey(start).getMonth() + 1];
      const byMonthDay = rule.byMonthDay?.length ? rule.byMonthDay : defaultByMonthDay(start);
      const startYear = parseLocalDateKey(start).getFullYear();
      let done = false;

      for (let year = startYear; !done && result.length < limit; year += interval) {
        if (dateKey(year, 1, 1) > untilDate) break;
        for (const month of byMonth) {
          const maxDay = daysInMonth(year, month);
          for (const value of byMonthDay) {
            const day = value > 0 ? Math.min(value, maxDay) : Math.max(1, maxDay + value + 1);
            const date = dateKey(year, month, day);
            if (date < start) continue;
            if (date > untilDate) {
              done = true;
              break;
            }
            result.push(date);
            if (result.length >= limit) break;
          }
          if (done || result.length >= limit) break;
        }
      }
      break;
    }

    case 'weekdays':
    case 'weekend':
    case 'statutory_workday':
    case 'statutory_holiday': {
      const end = Math.min(daysBetween(start, untilDate), limit - 1);
      for (let i = 0; i <= end; i += 1) {
        const date = addDaysKey(start, i);
        if (date > untilDate) break;
        const day = weekday(date);
        let include = false;
        if (rule.freq === 'weekdays') include = day <= 5;
        if (rule.freq === 'weekend') include = day >= 6;
        if (rule.freq === 'statutory_workday') {
          include = options.isWorkday ? options.isWorkday(date) : day <= 5;
        }
        if (rule.freq === 'statutory_holiday') {
          include = options.isHoliday ? options.isHoliday(date) : day >= 6;
        }
        if (include) result.push(date);
      }
      break;
    }

    case 'selected_dates': {
      const dates = [...new Set(rule.selectedDates ?? [])].sort();
      for (const date of dates) {
        if (date < start) continue;
        if (date > untilDate) break;
        result.push(date);
        if (result.length >= limit) break;
      }
      break;
    }

    case 'ebbinghaus': {
      const offsets = rule.ebbinghaus?.offsets ?? [0, 1, 3, 6, 14];
      const tailDays = rule.ebbinghaus?.tailDays ?? 15;
      for (const offset of offsets) {
        const date = addDaysKey(start, offset);
        if (date > untilDate) break;
        result.push(date);
        if (result.length >= limit) break;
      }
      let last = offsets[offsets.length - 1] ?? 0;
      while (result.length < limit) {
        last += tailDays;
        const date = addDaysKey(start, last);
        if (date > untilDate) break;
        result.push(date);
      }
      break;
    }

    default:
      break;
  }

  return result;
}

function occurrenceAt(
  series: RecurrenceSeries,
  date: string,
  index: number,
): RecurrenceOccurrence {
  return {
    occurrenceDate: date,
    occurrenceIndex: index,
    startDate: date,
    startTime: series.dtstartTime,
  };
}

function endReached(series: RecurrenceSeries, date: string, index: number): boolean {
  if (series.endType === 'date' && series.endDate && date > series.endDate) return true;
  if (series.endType === 'count' && series.endCount !== null && index >= series.endCount) {
    return true;
  }
  return false;
}

export function expandSeries(
  series: RecurrenceSeries,
  windowStart: string,
  windowEnd: string,
  options: RecurrenceOptions = {},
): RecurrenceOccurrence[] {
  if (series.status !== 'active' || series.mode === 'completion') return [];

  const candidates = generateCandidates(series, windowEnd, options);
  const occurrences: RecurrenceOccurrence[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const date = candidates[index];
    if (!date) continue;
    if (endReached(series, date, index)) break;
    if (date < windowStart) continue;
    if (date > windowEnd) break;
    occurrences.push(occurrenceAt(series, date, index));
  }

  return occurrences;
}

export function nextOccurrence(
  series: RecurrenceSeries,
  afterDate: string,
  options: RecurrenceOptions = {},
): RecurrenceOccurrence | null {
  if (series.status !== 'active') return null;

  const horizon = addDaysKey(afterDate, 36600);
  const candidates = generateCandidates(series, horizon, options);

  for (let index = 0; index < candidates.length; index += 1) {
    const date = candidates[index];
    if (!date) continue;
    if (endReached(series, date, index)) return null;
    if (date <= afterDate) continue;
    if (options.notBefore && date < options.notBefore) continue;
    return occurrenceAt(series, date, index);
  }

  return null;
}

function matchesWeekday(series: RecurrenceSeries, date: string): boolean {
  const rule = normalizeRule(series.rule);
  if (rule.freq === 'weekdays') return weekday(date) <= 5;
  if (rule.freq === 'weekend') return weekday(date) >= 6;
  const byWeekday = rule.byWeekday ?? defaultByWeekday(series.dtstartDate);
  return byWeekday.includes(weekday(date));
}

export function nextCompletionOccurrence(
  series: RecurrenceSeries,
  completedDate: string,
  options: NextCompletionOptions = {},
): RecurrenceOccurrence | null {
  if (series.status !== 'active') return null;

  const rule = normalizeRule(series.rule);
  const interval = rule.interval ?? 1;
  const index = (options.afterIndex ?? -1) + 1;

  if (series.endType === 'count' && series.endCount !== null && index >= series.endCount) {
    return null;
  }

  let nextDate: string;
  switch (rule.freq) {
    case 'daily':
      nextDate = addDaysKey(completedDate, interval);
      break;
    case 'weekly':
      nextDate = addDaysKey(completedDate, interval * 7);
      break;
    case 'monthly':
      nextDate = addMonthsKey(completedDate, interval);
      break;
    case 'yearly':
      nextDate = addYearsKey(completedDate, interval);
      break;
    case 'weekdays':
    case 'weekend':
    case 'statutory_workday':
    case 'statutory_holiday': {
      nextDate = addDaysKey(completedDate, 1);
      for (let i = 0; i < 14; i += 1) {
        const candidate = addDaysKey(completedDate, i + 1);
        if (matchesWeekday(series, candidate)) {
          nextDate = candidate;
          break;
        }
      }
      break;
    }
    case 'selected_dates':
      return null;
    default:
      nextDate = addDaysKey(completedDate, interval);
      break;
  }

  if (series.endType === 'date' && series.endDate && nextDate > series.endDate) {
    return null;
  }

  return occurrenceAt(series, nextDate, index);
}

export function isOccurrenceDate(
  series: RecurrenceSeries,
  date: string,
  options: RecurrenceOptions = {},
): boolean {
  return expandSeries(series, date, date, options).length > 0;
}

export function buildRule(freq: RecurrenceRule['freq'], overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    version: 1,
    freq,
    interval: 1,
    ...overrides,
  };
}

export function ruleLabel(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return '不重复';
  switch (rule.freq) {
    case 'daily':
      return rule.interval && rule.interval > 1 ? `每 ${rule.interval} 天` : '每天';
    case 'weekly':
      return '每周';
    case 'monthly':
      return '每月';
    case 'yearly':
      return '每年';
    case 'weekdays':
      return '每个工作日';
    case 'weekend':
      return '每周末';
    case 'statutory_workday':
      return '法定工作日';
    case 'statutory_holiday':
      return '法定节假日';
    case 'lunar_yearly':
      return '农历每年';
    case 'lunar_monthly':
      return '农历每月';
    case 'ebbinghaus':
      return '艾宾浩斯';
    case 'selected_dates':
      return '自选日期';
    default:
      return '重复';
  }
}

export { localDateKey };
