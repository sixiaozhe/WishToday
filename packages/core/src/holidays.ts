import { addDaysKey, parseLocalDateKey } from './date';

export type HolidayType = 'holiday' | 'workday';

export interface HolidayEntry {
  date: string;
  type: HolidayType;
  name: string;
}

function range(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDaysKey(cursor, 1);
  }
  return dates;
}

const entries: HolidayEntry[] = [];

function addRange(start: string, end: string, type: HolidayType, name: string) {
  for (const date of range(start, end)) {
    entries.push({ date, type, name });
  }
}

function addDay(date: string, type: HolidayType, name: string) {
  entries.push({ date, type, name });
}

// 国务院办公厅关于 2026 年部分节假日安排的通知
// 国办发明电〔2025〕7 号
addRange('2026-01-01', '2026-01-03', 'holiday', '元旦');
addDay('2026-01-04', 'workday', '元旦调休');

addRange('2026-02-15', '2026-02-23', 'holiday', '春节');
addDay('2026-02-14', 'workday', '春节调休');
addDay('2026-02-28', 'workday', '春节调休');

addRange('2026-04-04', '2026-04-06', 'holiday', '清明节');

addRange('2026-05-01', '2026-05-05', 'holiday', '劳动节');
addDay('2026-05-09', 'workday', '劳动节调休');

addRange('2026-06-19', '2026-06-21', 'holiday', '端午节');

addRange('2026-09-25', '2026-09-27', 'holiday', '中秋节');

addRange('2026-10-01', '2026-10-07', 'holiday', '国庆节');
addDay('2026-09-20', 'workday', '国庆调休');
addDay('2026-10-10', 'workday', '国庆调休');

export const CN_HOLIDAYS_2026: HolidayEntry[] = entries;
export const HOLIDAY_DATA_YEARS = [2026] as const;

const holidayMap = new Map(entries.map((entry) => [entry.date, entry]));

export function holidayInfo(date: string): HolidayEntry | null {
  return holidayMap.get(date) ?? null;
}

export function holidayType(date: string): HolidayType | null {
  return holidayMap.get(date)?.type ?? null;
}

export function hasHolidayData(year: number): boolean {
  return (HOLIDAY_DATA_YEARS as readonly number[]).includes(year);
}

/**
 * A working day is either a Mon-Fri day not in the holiday table, or an
 * explicit makeup workday (调休上班).
 */
export function isStatutoryWorkday(date: string): boolean {
  const info = holidayMap.get(date);
  if (info) return info.type === 'workday';
  const day = parseLocalDateKey(date).getDay();
  return day >= 1 && day <= 5;
}

/**
 * A holiday is either an explicit holiday-table date or a normal weekend day.
 */
export function isStatutoryHoliday(date: string): boolean {
  const info = holidayMap.get(date);
  if (info) return info.type === 'holiday';
  const day = parseLocalDateKey(date).getDay();
  return day === 0 || day === 6;
}
