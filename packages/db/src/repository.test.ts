import { describe, expect, it } from 'vitest';
import {
  createTask,
  type Profile,
  type Project,
  type Tag,
  type Task,
} from '@dayline/core';
import type { SqliteDriver, SqliteStatement, SqlValue } from './driver';
import { SqliteRepository } from './repository';

interface FakeResponse {
  match: string;
  rows: Array<Record<string, SqlValue>>;
}

class FakeDriver implements SqliteDriver {
  batches: SqliteStatement[][] = [];
  runs: SqliteStatement[] = [];

  constructor(private readonly responses: FakeResponse[] = []) {}

  async all<T = Record<string, SqlValue>>(sql: string): Promise<T[]> {
    const response = this.responses.find((item) => sql.includes(item.match));
    return (response?.rows ?? []) as T[];
  }

  async run(sql: string, params?: SqlValue[]): Promise<void> {
    this.runs.push({ sql, params });
  }

  async batch(statements: SqliteStatement[]): Promise<void> {
    this.batches.push(statements);
  }

  close(): void {
    // no-op
  }
}

const now = new Date(2026, 10, 5, 9, 30, 0).getTime();

const profile: Profile = {
  id: 'p1',
  name: '我的日程',
  createdAt: now,
  updatedAt: now,
};

const project: Project = {
  id: 'project-inbox',
  profileId: profile.id,
  folderId: null,
  name: '收集箱',
  kind: 'task',
  color: '#3b6ef6',
  isInbox: true,
  sortKey: 'a0',
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const tag: Tag = {
  id: 'tag-focus',
  profileId: profile.id,
  name: '专注',
  color: '#f59e0b',
};

function makeTask(overrides: Partial<Parameters<typeof createTask>[0]> = {}): Task {
  return createTask(
    {
      profileId: profile.id,
      projectId: project.id,
      title: '测试任务',
      ...overrides,
    },
    { now, id: 'task-1', sortKey: 'm1' },
  );
}

function loadResponses(task: Task): FakeResponse[] {
  return [
    {
      match: 'FROM profile',
      rows: [
        {
          id: profile.id,
          name: profile.name,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt,
        },
      ],
    },
    {
      match: 'FROM project',
      rows: [
        {
          id: project.id,
          profile_id: project.profileId,
          name: project.name,
          kind: project.kind,
          color: project.color,
          is_inbox: 1,
          sort_key: project.sortKey,
          created_at: project.createdAt,
          updated_at: project.updatedAt,
          deleted_at: null,
        },
      ],
    },
    {
      match: 'FROM tag',
      rows: [
        {
          id: tag.id,
          profile_id: tag.profileId,
          name: tag.name,
          color: tag.color,
        },
      ],
    },
    {
      match: 'FROM task\n',
      rows: [
        {
          id: task.id,
          profile_id: task.profileId,
          project_id: task.projectId,
          parent_id: task.parentId,
          title: task.title,
          content_md: task.contentMd,
          status: task.status,
          priority: task.priority,
          all_day: task.allDay ? 1 : 0,
          start_date: task.startDate,
          start_time: task.startTime,
          end_date: task.endDate,
          end_time: task.endTime,
          completed_at: task.completedAt,
          deleted_at: task.deletedAt,
          created_at: task.createdAt,
          updated_at: task.updatedAt,
          sort_key: task.sortKey,
          recurrence_series_id: task.seriesId,
          occurrence_date: task.occurrenceDate,
          occurrence_index: task.occurrenceIndex,
          progress: task.progress,
        },
      ],
    },
    {
      match: 'FROM task_tag',
      rows: [{ task_id: task.id, tag_id: tag.id }],
    },
  ];
}

describe('SqliteRepository', () => {
  it('maps rows into the domain state', async () => {
    const task = makeTask({ tagIds: [tag.id] });
    const repository = new SqliteRepository(new FakeDriver(loadResponses(task)));

    const state = await repository.loadState();

    expect(state.version).toBe(1);
    expect(state.profile).toEqual(profile);
    expect(state.projects[0]?.isInbox).toBe(true);
    expect(state.tags[0]?.name).toBe('专注');
    expect(state.tasks[0]?.tagIds).toEqual([tag.id]);
  });

  it('writes a task, its join rows, and timed fields in one batch', async () => {
    const task = makeTask({
      startDate: '2026-11-05',
      startTime: '09:30',
      tagIds: [tag.id],
    });
    const driver = new FakeDriver();
    const repository = new SqliteRepository(driver);

    await repository.saveTask(task);

    expect(driver.batches).toHaveLength(1);
    const statements = driver.batches[0] ?? [];
    expect(statements[0]?.sql).toContain('INSERT INTO task');
    expect(statements[0]?.params?.[8]).toBe(0);
    expect(typeof statements[0]?.params?.[14]).toBe('number');
    expect(statements.some((statement) => statement.sql.includes('DELETE FROM task_tag'))).toBe(
      true,
    );
    expect(
      statements.filter((statement) => statement.sql.includes('INSERT OR IGNORE INTO task_tag')),
    ).toHaveLength(1);
  });

  it('seeds a fresh database in one transaction', async () => {
    const task = makeTask();
    const driver = new FakeDriver([
      { match: 'COUNT(*) AS count', rows: [{ count: 0 }] },
      ...loadResponses(task),
    ]);
    const repository = new SqliteRepository(driver);

    await repository.initialize();

    expect(driver.batches).toHaveLength(1);
    const sql = (driver.batches[0] ?? []).map((statement) => statement.sql).join('\n');
    expect(sql).toContain('INSERT INTO profile');
    expect(sql).toContain('INSERT INTO project');
    expect(sql).toContain('INSERT INTO tag');
    expect(sql).toContain('INSERT INTO task');
  });
});
