import { describe, expect, it } from 'vitest';
import {
  createSeedState,
  createTask,
  icsToTasks,
  parseBackup,
  parseIcs,
  parseTasksCsv,
  serializeBackup,
  tasksToCsv,
  tasksToIcs,
} from './index';

const project = {
  id: 'p1',
  profileId: 'u1',
  folderId: null,
  name: '工作',
  kind: 'task' as const,
  color: '#000',
  isInbox: false,
  sortKey: 'a1',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

describe('backup', () => {
  it('round-trips a JSON backup and tolerates missing optional arrays', () => {
    const state = createSeedState(new Date(2026, 10, 6).getTime());
    const restored = parseBackup(serializeBackup(state));
    expect(restored.profile.id).toBe(state.profile.id);
    expect(restored.tasks).toHaveLength(state.tasks.length);
    expect(restored.folders).toEqual([]);

    const minimal = JSON.parse(serializeBackup(state));
    delete minimal.state.habits;
    const tolerant = parseBackup(JSON.stringify(minimal));
    expect(tolerant.habits).toEqual([]);
  });

  it('exports and imports CSV tasks', () => {
    const task = createTask(
      {
        profileId: 'u1',
        projectId: 'p1',
        title: '写周报, 含逗号',
        contentMd: '第一行\n第二行',
        priority: 3,
        startDate: '2026-11-06',
      },
      { now: 1 },
    );
    const csv = tasksToCsv([task], [project]);
    const imported = parseTasksCsv(csv, {
      profileId: 'u1',
      defaultProjectId: 'p1',
      projects: [project],
    });
    expect(imported).toHaveLength(1);
    expect(imported[0]?.title).toBe('写周报, 含逗号');
    expect(imported[0]?.priority).toBe(3);
    expect(imported[0]?.startDate).toBe('2026-11-06');
  });

  it('exports and parses ICS events', () => {
    const task = createTask(
      {
        profileId: 'u1',
        projectId: 'p1',
        title: '评审会',
        startDate: '2026-11-06',
        startTime: '10:00',
        endTime: '11:00',
      },
      { now: 1 },
    );
    const ics = tasksToIcs([task], [project]);
    expect(ics).toContain('BEGIN:VEVENT');
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0]?.summary).toBe('评审会');
    expect(events[0]?.startDate).toBe('2026-11-06');
    expect(events[0]?.startTime).toBe('10:00');

    const imported = icsToTasks(events, { profileId: 'u1', projectId: 'p1' });
    expect(imported[0]?.title).toBe('评审会');
  });
});
