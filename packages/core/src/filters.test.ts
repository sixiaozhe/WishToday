import { describe, expect, it } from 'vitest';
import {
  createCondition,
  createTask,
  filterSummary,
  matchesFilter,
  priorityLabel,
  type CreateTaskInput,
} from './index';
import type { Project, SavedFilter, Tag } from './types';

const projects: Project[] = [
  {
    id: 'p1',
    profileId: 'u1',
    folderId: null,
    name: '工作',
    kind: 'task',
    color: '#000',
    isInbox: false,
    sortKey: 'a1',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
  },
];
const tags: Tag[] = [{ id: 't1', profileId: 'u1', name: '重要', color: '#f00' }];

function task(overrides: Partial<CreateTaskInput> = {}) {
  return createTask(
    {
      profileId: 'u1',
      projectId: 'p1',
      title: '默认任务',
      ...overrides,
    },
    { now: new Date(2026, 10, 6, 9, 0, 0).getTime() },
  );
}

function filter(conditions: SavedFilter['conditions'], match: 'all' | 'any' = 'all') {
  return { conditions, match };
}

describe('saved filters', () => {
  it('matches text, project, tag, priority, status and dates', () => {
    const item = task({
      title: '写周报',
      contentMd: '包含项目进展',
      tagIds: ['t1'],
      priority: 5,
      startDate: '2026-11-06',
    });

    const condition = (field: Parameters<typeof createCondition>[0], operator: Parameters<typeof createCondition>[1], value: string) => ({
      ...createCondition(field, operator),
      value,
    });

    expect(matchesFilter(item, filter([condition('title', 'contains', '周报')]), { projects, tags })).toBe(true);
    expect(matchesFilter(item, filter([condition('content', 'contains', '进展')]), { projects, tags })).toBe(true);
    expect(matchesFilter(item, filter([condition('project', 'is', 'p1')]), { projects, tags })).toBe(true);
    expect(matchesFilter(item, filter([condition('tag', 'is', 't1')]), { projects, tags })).toBe(true);
    expect(matchesFilter(item, filter([condition('priority', 'gte', '3')]), { projects, tags })).toBe(true);
    expect(matchesFilter(item, filter([condition('status', 'is', 'open')]), { projects, tags })).toBe(true);
    expect(matchesFilter(item, filter([condition('due', 'is', '2026-11-06')]), { projects, tags })).toBe(true);
    expect(matchesFilter(item, filter([condition('due', 'isEmpty', '')]), { projects, tags })).toBe(false);
  });

  it('supports all/any matching and produces a readable summary', () => {
    const item = task({ title: '写周报', priority: 5 });
    const conditions = [
      { ...createCondition('title', 'contains'), value: '周报' },
      { ...createCondition('priority', 'is'), value: '3' },
    ];
    expect(matchesFilter(item, filter(conditions, 'all'), { projects, tags })).toBe(false);
    expect(matchesFilter(item, filter(conditions, 'any'), { projects, tags })).toBe(true);
    expect(filterSummary(filter(conditions), { projects, tags })).toContain('标题');
    expect(priorityLabel(5)).toBe('高优先级');
  });
});
