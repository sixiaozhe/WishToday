import { describe, expect, it } from 'vitest';
import {
  achievements,
  createSeedState,
  createTask,
  dailyStats,
  habitStreak,
  nextCountdownOccurrence,
  taskStats,
  type Habit,
  type HabitCheckin,
} from './index';

const now = new Date(2026, 10, 6, 12, 0, 0);

const habit: Habit = {
  id: 'h1',
  profileId: 'u1',
  name: '喝水',
  icon: '✅',
  color: '#3b6ef6',
  description: '',
  frequency: { type: 'daily' },
  goalAmount: 1,
  unit: '次',
  archived: false,
  sortKey: 'h1',
  createdAt: now.getTime() - 10 * 86_400_000,
  updatedAt: now.getTime(),
  deletedAt: null,
};

function checkin(date: string): HabitCheckin {
  return {
    id: `c-${date}`,
    habitId: 'h1',
    date,
    amount: 1,
    note: '',
    checkedAt: now.getTime(),
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    deletedAt: null,
  };
}

describe('analytics', () => {
  it('computes habit streaks from consecutive check-ins', () => {
    const checkins = [checkin('2026-11-04'), checkin('2026-11-05'), checkin('2026-11-06')];
    const streak = habitStreak(checkins, habit, now);
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(3);
    expect(streak.total).toBe(3);
  });

  it('reports task completion and daily trend', () => {
    const state = createSeedState(now.getTime());
    const extra = createTask(
      {
        profileId: state.profile.id,
        projectId: state.projects[0]?.id ?? 'p',
        title: '已完成任务',
        startDate: '2026-11-06',
      },
      { now: now.getTime(), id: 'extra' },
    );
    const tasks = [
      ...state.tasks,
      { ...extra, status: 'completed' as const, completedAt: now.getTime() },
    ];
    const stats = taskStats(tasks, now);
    expect(stats.completed).toBeGreaterThanOrEqual(2);
    expect(stats.todayCompleted).toBeGreaterThanOrEqual(1);
    expect(dailyStats(tasks, 7, now)).toHaveLength(7);
  });

  it('unlocks the first achievement and computes countdowns', () => {
    const state = createSeedState(now.getTime());
    const result = achievements(state, now);
    expect(result.list.find((item) => item.id === 'first-task')?.unlocked).toBe(true);
    expect(result.score).toBeGreaterThan(0);

    const countdown = {
      id: 'c1',
      profileId: state.profile.id,
      name: '生日',
      type: 'birthday' as const,
      date: '1990-11-10',
      calendar: 'solar' as const,
      repeatYearly: true,
      countMode: 'countdown' as const,
      pinned: false,
      note: '',
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
      deletedAt: null,
    };
    const occurrence = nextCountdownOccurrence(countdown, now);
    expect(occurrence?.date).toBe('2026-11-10');
    expect(occurrence?.days).toBe(4);
  });
});
