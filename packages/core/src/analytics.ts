import { addDaysKey, daysBetween, localDateKey, parseLocalDateKey, todayKey } from './date';
import type {
  AppState,
  Countdown,
  FocusSession,
  Habit,
  HabitCheckin,
  Task,
} from './types';

export function habitScheduledOn(habit: Habit, date: string): boolean {
  if (habit.frequency.type === 'daily') return true;
  if (habit.frequency.type === 'weekly') {
    const weekday = parseLocalDateKey(date).getDay();
    return (habit.frequency.weekdays ?? [1, 2, 3, 4, 5]).includes(weekday);
  }
  if (habit.frequency.type === 'interval') {
    const start = localDateKey(new Date(habit.createdAt));
    const interval = Math.max(1, habit.frequency.intervalDays ?? 1);
    return daysBetween(start, date) % interval === 0;
  }
  return true;
}

export function habitStreak(
  checkins: HabitCheckin[],
  habit: Habit,
  now: Date = new Date(),
): { current: number; longest: number; total: number } {
  const done = new Set(
    checkins
      .filter((checkin) => checkin.habitId === habit.id && checkin.deletedAt === null)
      .map((checkin) => checkin.date),
  );

  let longest = 0;
  let run = 0;
  const sorted = [...done].sort();
  for (let index = 0; index < sorted.length; index += 1) {
    const date = sorted[index];
    if (!date) continue;
    const previous = sorted[index - 1];
    if (previous && daysBetween(previous, date) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  let cursor = todayKey(now);
  if (!done.has(cursor) && habitScheduledOn(habit, cursor)) {
    cursor = addDaysKey(cursor, -1);
  }
  let current = 0;
  while (done.has(cursor)) {
    current += 1;
    cursor = addDaysKey(cursor, -1);
  }

  return { current, longest, total: done.size };
}

export function habitHeatmap(
  checkins: HabitCheckin[],
  habitId: string,
  days: number,
  now: Date = new Date(),
): Array<{ date: string; count: number }> {
  const byDate = new Map<string, number>();
  for (const checkin of checkins) {
    if (checkin.habitId !== habitId || checkin.deletedAt !== null) continue;
    byDate.set(checkin.date, (byDate.get(checkin.date) ?? 0) + checkin.amount);
  }
  const today = todayKey(now);
  const result: Array<{ date: string; count: number }> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDaysKey(today, -offset);
    result.push({ date, count: byDate.get(date) ?? 0 });
  }
  return result;
}

export function focusSecondsInRange(
  sessions: FocusSession[],
  startAt: number,
  endAt: number,
): number {
  return sessions
    .filter(
      (session) =>
        session.deletedAt === null &&
        session.state === 'finished' &&
        session.startedAt >= startAt &&
        session.startedAt < endAt,
    )
    .reduce((total, session) => total + session.durationSeconds, 0);
}

export function focusSummary(
  sessions: FocusSession[],
  now: Date = new Date(),
): { todayMinutes: number; weekMinutes: number; totalMinutes: number; sessions: number } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  const weekday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - weekday);

  const finished = sessions.filter(
    (session) => session.deletedAt === null && session.state === 'finished',
  );
  return {
    todayMinutes: Math.round(
      focusSecondsInRange(finished, startOfToday.getTime(), now.getTime()) / 60,
    ),
    weekMinutes: Math.round(
      focusSecondsInRange(finished, startOfWeek.getTime(), now.getTime()) / 60,
    ),
    totalMinutes: Math.round(
      finished.reduce((total, session) => total + session.durationSeconds, 0) / 60,
    ),
    sessions: finished.length,
  };
}

export interface DailyStat {
  date: string;
  created: number;
  completed: number;
}

export function dailyStats(tasks: Task[], days: number, now: Date = new Date()): DailyStat[] {
  const today = todayKey(now);
  const result: DailyStat[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDaysKey(today, -offset);
    result.push({ date, created: 0, completed: 0 });
  }
  const byDate = new Map(result.map((item) => [item.date, item]));
  for (const task of tasks) {
    const created = byDate.get(localDateKey(new Date(task.createdAt)));
    if (created) created.created += 1;
    if (task.completedAt !== null) {
      const completed = byDate.get(localDateKey(new Date(task.completedAt)));
      if (completed) completed.completed += 1;
    }
  }
  return result;
}

export interface TaskStats {
  total: number;
  open: number;
  completed: number;
  abandoned: number;
  overdue: number;
  completionRate: number;
  byPriority: Array<{ priority: number; count: number }>;
  byProject: Array<{ projectId: string; count: number }>;
  byTag: Array<{ tagId: string; count: number }>;
  todayCompleted: number;
  weekCompleted: number;
}

export function taskStats(tasks: Task[], now: Date = new Date()): TaskStats {
  const active = tasks.filter((task) => task.deletedAt === null);
  const today = todayKey(now);
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const total = active.length;
  const completed = active.filter((task) => task.status === 'completed').length;

  const byPriority = [0, 1, 3, 5].map((priority) => ({
    priority,
    count: active.filter((task) => task.priority === priority && task.status === 'open').length,
  }));
  const projectMap = new Map<string, number>();
  const tagMap = new Map<string, number>();
  for (const task of active) {
    if (task.status !== 'open') continue;
    projectMap.set(task.projectId, (projectMap.get(task.projectId) ?? 0) + 1);
    for (const tagId of task.tagIds) {
      tagMap.set(tagId, (tagMap.get(tagId) ?? 0) + 1);
    }
  }

  return {
    total,
    open: active.filter((task) => task.status === 'open').length,
    completed,
    abandoned: active.filter((task) => task.status === 'abandoned').length,
    overdue: active.filter(
      (task) => task.status === 'open' && task.startDate !== null && task.startDate < today,
    ).length,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    byPriority,
    byProject: [...projectMap.entries()]
      .map(([projectId, count]) => ({ projectId, count }))
      .sort((a, b) => b.count - a.count),
    byTag: [...tagMap.entries()]
      .map(([tagId, count]) => ({ tagId, count }))
      .sort((a, b) => b.count - a.count),
    todayCompleted: active.filter(
      (task) =>
        task.completedAt !== null && localDateKey(new Date(task.completedAt)) === today,
    ).length,
    weekCompleted: active.filter(
      (task) => task.completedAt !== null && task.completedAt >= weekAgo,
    ).length,
  };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
  icon: string;
}

export function achievements(state: AppState, now: Date = new Date()): {
  score: number;
  level: number;
  list: Achievement[];
} {
  const stats = taskStats(state.tasks, now);
  const focus = focusSummary(state.focusSessions, now);
  const habitCheckins = state.habitCheckins.filter((item) => item.deletedAt === null);
  const maxHabitStreak = state.habits.reduce((best, habit) => {
    const streak = habitStreak(state.habitCheckins, habit, now);
    return Math.max(best, streak.longest);
  }, 0);

  const list: Achievement[] = [
    {
      id: 'first-task',
      name: '第一步',
      description: '完成第一个任务',
      unlocked: stats.completed >= 1,
      progress: Math.min(stats.completed, 1),
      target: 1,
      icon: '🌱',
    },
    {
      id: 'ten-tasks',
      name: '渐入佳境',
      description: '完成 10 个任务',
      unlocked: stats.completed >= 10,
      progress: stats.completed,
      target: 10,
      icon: '🔥',
    },
    {
      id: 'fifty-tasks',
      name: '稳定输出',
      description: '完成 50 个任务',
      unlocked: stats.completed >= 50,
      progress: stats.completed,
      target: 50,
      icon: '🏆',
    },
    {
      id: 'focus-hour',
      name: '专注一小时',
      description: '累计专注 60 分钟',
      unlocked: focus.totalMinutes >= 60,
      progress: focus.totalMinutes,
      target: 60,
      icon: '⏱️',
    },
    {
      id: 'focus-ten-hours',
      name: '深度工作',
      description: '累计专注 10 小时',
      unlocked: focus.totalMinutes >= 600,
      progress: focus.totalMinutes,
      target: 600,
      icon: '🧠',
    },
    {
      id: 'habit-week',
      name: '习惯养成中',
      description: '任一习惯连续打卡 7 天',
      unlocked: maxHabitStreak >= 7,
      progress: maxHabitStreak,
      target: 7,
      icon: '📅',
    },
    {
      id: 'habit-month',
      name: '习惯大师',
      description: '任一习惯连续打卡 30 天',
      unlocked: maxHabitStreak >= 30,
      progress: maxHabitStreak,
      target: 30,
      icon: '💎',
    },
    {
      id: 'checkin-ten',
      name: '坚持记录',
      description: '累计打卡 10 次',
      unlocked: habitCheckins.length >= 10,
      progress: habitCheckins.length,
      target: 10,
      icon: '✅',
    },
  ];

  const score =
    stats.completed * 10 +
    Math.floor(focus.totalMinutes / 10) * 5 +
    habitCheckins.length * 5 +
    maxHabitStreak * 8;
  const level = Math.max(1, Math.floor(score / 100) + 1);

  return { score, level, list };
}

export interface CountdownOccurrence {
  date: string;
  days: number;
  years: number | null;
}

/**
 * Next solar occurrence for a countdown. Lunar countdowns are resolved in the
 * web layer where the lunar library is available; this fallback keeps the
 * feature usable without loading it.
 */
export function nextCountdownOccurrence(
  countdown: Countdown,
  now: Date = new Date(),
): CountdownOccurrence | null {
  if (countdown.calendar !== 'solar') return null;
  const parsed = parseLocalDateKey(countdown.date);
  if (!Number.isFinite(parsed.getTime())) return null;

  const today = parseLocalDateKey(todayKey(now));
  if (countdown.countMode === 'count_up') {
    const days = Math.max(0, Math.round((today.getTime() - parsed.getTime()) / 86_400_000));
    return {
      date: countdown.date,
      days,
      years: Math.floor(days / 365),
    };
  }

  let target = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate());
  if (!countdown.repeatYearly) {
    const days = Math.round((parsed.getTime() - today.getTime()) / 86_400_000);
    return { date: countdown.date, days, years: null };
  }
  if (target.getTime() < today.getTime()) {
    target = new Date(today.getFullYear() + 1, parsed.getMonth(), parsed.getDate());
  }
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return {
    date: localDateKey(target),
    days,
    years: target.getFullYear() - parsed.getFullYear(),
  };
}
