import { parseLocalDateKey } from './date';
import type { Task } from './types';

export const REMINDER_OFFSETS = [0, 5, 10, 30, 60, 1440] as const;

export function reminderOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return '准时';
  if (offsetMinutes < 60) return `提前 ${offsetMinutes} 分钟`;
  if (offsetMinutes < 1440) return `提前 ${Math.round(offsetMinutes / 60)} 小时`;
  return `提前 ${Math.round(offsetMinutes / 1440)} 天`;
}

/**
 * Computes the absolute trigger time from the task date/time and an offset.
 * All-day tasks default to 09:00 local time.
 */
export function reminderTriggerAt(
  task: Pick<Task, 'startDate' | 'startTime' | 'allDay'>,
  offsetMinutes: number,
  defaultHour = 9,
): number | null {
  if (!task.startDate) return null;

  const date = parseLocalDateKey(task.startDate);
  const [hour = defaultHour, minute = 0] = task.allDay
    ? [defaultHour, 0]
    : (task.startTime ?? '')
        .split(':')
        .map(Number);

  date.setHours(hour, minute, 0, 0);
  const base = date.getTime();
  if (!Number.isFinite(base)) return null;
  return base - offsetMinutes * 60_000;
}

export function formatReminderTime(triggerAt: number): string {
  const date = new Date(triggerAt);
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
