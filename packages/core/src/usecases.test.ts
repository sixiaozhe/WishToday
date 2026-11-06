import { describe, expect, it } from 'vitest';
import {
  addChecklistItem,
  completeTask,
  countTasks,
  createNextOccurrenceTask,
  createSeedState,
  createTask,
  deleteChecklistItem,
  localDateKey,
  queryTasks,
  restoreTask,
  toggleChecklistItem,
  toggleTaskCompletion,
  trashTask,
  uncompleteTask,
  updateTask,
} from './index';

const now = new Date(2026, 10, 5, 9, 30, 0).getTime();
const today = localDateKey(new Date(now));

function makeTask(overrides: Partial<Parameters<typeof createTask>[0]> = {}) {
  return createTask(
    {
      profileId: 'p1',
      projectId: 'inbox',
      title: '测试任务',
      ...overrides,
    },
    { now, id: `task-${Math.random().toString(36).slice(2)}` },
  );
}

describe('createTask', () => {
  it('creates an open task with defaults', () => {
    const task = makeTask();
    expect(task.status).toBe('open');
    expect(task.priority).toBe(0);
    expect(task.allDay).toBe(true);
    expect(task.completedAt).toBeNull();
    expect(task.deletedAt).toBeNull();
  });

  it('rejects empty titles', () => {
    expect(() => makeTask({ title: '   ' })).toThrow('任务标题不能为空');
  });

  it('marks a timed task as not all-day', () => {
    const task = makeTask({ startDate: today, startTime: '09:00' });
    expect(task.allDay).toBe(false);
    expect(task.startTime).toBe('09:00');
  });
});

describe('task lifecycle', () => {
  it('completes and reopens a task', () => {
    const task = makeTask();
    const completed = completeTask(task, now + 1);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(now + 1);

    const reopened = uncompleteTask(completed, now + 2);
    expect(reopened.status).toBe('open');
    expect(reopened.completedAt).toBeNull();
  });

  it('toggles completion', () => {
    const task = makeTask();
    expect(toggleTaskCompletion(task, now + 1).status).toBe('completed');
    expect(toggleTaskCompletion(completeTask(task, now + 1), now + 2).status).toBe('open');
  });

  it('trashes and restores a task without changing status', () => {
    const task = completeTask(makeTask(), now + 1);
    const trashed = trashTask(task, now + 2);
    expect(trashed.deletedAt).toBe(now + 2);
    expect(trashed.status).toBe('completed');

    const restored = restoreTask(trashed, now + 3);
    expect(restored.deletedAt).toBeNull();
    expect(restored.status).toBe('completed');
  });

  it('preserves cross-day span when creating the next occurrence', () => {
    const task = makeTask({
      startDate: today,
      endDate: '2026-11-07',
      title: '跨天任务',
    });
    const next = createNextOccurrenceTask(task, '2026-11-10', 1, {
      now,
      id: 'next-task',
    });
    expect(next.startDate).toBe('2026-11-10');
    expect(next.endDate).toBe('2026-11-12');
  });

  it('clamps end date to the new start date', () => {
    const task = makeTask({ startDate: today, endDate: today });
    const updated = updateTask(task, { startDate: '2026-11-06' }, now + 1);
    expect(updated.endDate).toBe('2026-11-06');
  });

  it('updates fields and clears time when date is cleared', () => {
    const task = makeTask({ startDate: today, startTime: '09:00' });
    const updated = updateTask(task, { startDate: null, title: '  新标题  ' }, now + 1);
    expect(updated.title).toBe('新标题');
    expect(updated.startDate).toBeNull();
    expect(updated.startTime).toBeNull();
    expect(updated.allDay).toBe(true);
  });
});

describe('checklist', () => {
  it('tracks progress and auto-completes when all items are done', () => {
    let task = makeTask();
    task = addChecklistItem(task, '第一步', { id: 'c1', now });
    task = addChecklistItem(task, '第二步', { id: 'c2', now });
    expect(task.progress).toBe(0);

    task = toggleChecklistItem(task, 'c1', now + 1);
    expect(task.progress).toBe(50);
    expect(task.status).toBe('open');

    task = toggleChecklistItem(task, 'c2', now + 2);
    expect(task.progress).toBe(100);
    expect(task.status).toBe('completed');

    task = toggleChecklistItem(task, 'c1', now + 3);
    expect(task.progress).toBe(50);
    expect(task.status).toBe('open');
  });

  it('reopens a completed task when a new item is added', () => {
    let task = addChecklistItem(makeTask(), '唯一事项', { id: 'c1', now });
    task = toggleChecklistItem(task, 'c1', now + 1);
    expect(task.status).toBe('completed');

    task = addChecklistItem(task, '新事项', { id: 'c2', now: now + 2 });
    expect(task.status).toBe('open');
    expect(task.progress).toBe(50);
  });

  it('deletes items and recalculates progress', () => {
    let task = addChecklistItem(makeTask(), 'A', { id: 'a', now });
    task = addChecklistItem(task, 'B', { id: 'b', now });
    task = toggleChecklistItem(task, 'a', now + 1);
    task = deleteChecklistItem(task, 'b', now + 2);
    expect(task.checklist).toHaveLength(1);
    expect(task.progress).toBe(100);
  });
});

describe('queries', () => {
  it('filters today, inbox, completed and trash', () => {
    const todayTask = makeTask({ startDate: today, projectId: 'work' });
    const inboxTask = makeTask();
    const completedTask = completeTask(makeTask({ title: '完成' }), now + 1);
    const trashedTask = trashTask(makeTask({ title: '删除' }), now + 2);

    const tasks = [todayTask, inboxTask, completedTask, trashedTask];

    expect(queryTasks(tasks, { smartView: 'today', now: new Date(now) })).toEqual([todayTask]);
    expect(
      queryTasks(tasks, { smartView: 'inbox', inboxProjectId: 'inbox', now: new Date(now) }),
    ).toEqual([inboxTask]);
    expect(
      queryTasks(tasks, { smartView: 'completed', now: new Date(now) }),
    ).toEqual([completedTask]);
    expect(queryTasks(tasks, { smartView: 'trash', now: new Date(now) })).toEqual([trashedTask]);
  });

  it('searches title and content', () => {
    const matching = makeTask({ title: '写周报', contentMd: '包含项目复盘' });
    const other = makeTask({ title: '买菜' });
    expect(queryTasks([matching, other], { search: '复盘' })).toEqual([matching]);
    expect(queryTasks([matching, other], { search: '周报' })).toEqual([matching]);
  });

  it('sorts by priority then date', () => {
    const low = makeTask({ title: '低', priority: 1, startDate: today });
    const high = makeTask({ title: '高', priority: 5, startDate: today });
    const laterHigh = makeTask({ title: '高但晚', priority: 5, startDate: '2026-12-01' });
    const result = queryTasks([low, high, laterHigh], { smartView: 'all', now: new Date(now) });
    expect(result.map((task) => task.title)).toEqual(['高', '高但晚', '低']);
  });

  it('lists skipped occurrences separately', () => {
    const skipped = { ...makeTask({ title: '跳过的周期' }), status: 'skipped' as const };
    const active = makeTask({ title: '正常任务' });
    expect(queryTasks([skipped, active], { smartView: 'skipped', now: new Date(now) })).toEqual([
      skipped,
    ]);
    expect(queryTasks([skipped, active], { smartView: 'all', now: new Date(now) })).toEqual([
      active,
    ]);
  });

  it('counts sidebar buckets', () => {
    const tasks = [
      makeTask({ startDate: today, projectId: 'work' }),
      makeTask(),
      completeTask(makeTask({ title: '完成' }), now + 1),
      trashTask(makeTask({ title: '删除' }), now + 2),
    ];
    expect(countTasks(tasks, 'inbox', new Date(now))).toEqual({
      today: 1,
      tomorrow: 0,
      next7days: 1,
      inbox: 1,
      all: 2,
      completed: 1,
      abandoned: 0,
      skipped: 0,
      trash: 1,
    });
  });
});

describe('seed state', () => {
  it('is internally consistent', () => {
    const state = createSeedState(now);
    const inbox = state.projects.find((project) => project.isInbox);
    expect(inbox).toBeDefined();
    expect(state.tasks.length).toBeGreaterThan(0);
    expect(state.tasks.every((task) => task.profileId === state.profile.id)).toBe(true);
    expect(state.tasks.every((task) => state.projects.some((p) => p.id === task.projectId))).toBe(true);
    expect(countTasks(state.tasks, inbox?.id, new Date(now)).trash).toBe(0);
  });
});
