const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysKey(value: string, days: number): string {
  return localDateKey(addDays(parseLocalDateKey(value), days));
}

export function daysBetween(start: string, end: string): number {
  return Math.round(
    (parseLocalDateKey(end).getTime() - parseLocalDateKey(start).getTime()) / DAY_MS,
  );
}

export function todayKey(now: Date = new Date()): string {
  return localDateKey(now);
}

export function tomorrowKey(now: Date = new Date()): string {
  return localDateKey(addDays(now, 1));
}

export function isToday(value: string | null, now: Date = new Date()): boolean {
  return value === localDateKey(now);
}

export function isOverdue(value: string | null, now: Date = new Date()): boolean {
  return value !== null && value < localDateKey(now);
}

export function formatDateLabel(value: string, now: Date = new Date()): string {
  const today = localDateKey(now);
  if (value === today) return '今天';
  if (value === localDateKey(addDays(now, 1))) return '明天';
  if (value === localDateKey(addDays(now, -1))) return '昨天';

  const date = parseLocalDateKey(value);
  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatTimeLabel(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 5);
}

export function formatDurationLabel(startAt: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - startAt);
  const days = Math.floor(diff / DAY_MS);
  if (days > 0) return `${days} 天前`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours > 0) return `${hours} 小时前`;
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes} 分钟前`;
}
