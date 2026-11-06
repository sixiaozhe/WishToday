import { addDaysKey, daysBetween, localDateKey, tomorrowKey } from './date';
import { DEFAULT_PREFERENCES } from './preferences';
import type { AppState, Priority, Project, Task } from './types';

export interface CreateTaskInput {
  profileId: string;
  projectId: string;
  parentId?: string | null;
  title: string;
  contentMd?: string;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  priority?: Priority;
  tagIds?: string[];
}

export interface CreateTaskOptions {
  id?: string;
  now?: number;
  sortKey?: string;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'contentMd'
    | 'priority'
    | 'startDate'
    | 'startTime'
    | 'endDate'
    | 'endTime'
    | 'projectId'
    | 'allDay'
    | 'tagIds'
  >
>;

export function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTask(input: CreateTaskInput, options: CreateTaskOptions = {}): Task {
  const title = input.title.trim();
  if (!title) {
    throw new Error('任务标题不能为空');
  }

  const now = options.now ?? Date.now();
  const id = options.id ?? generateId();
  const startTime = input.startTime ?? null;

  return {
    id,
    profileId: input.profileId,
    projectId: input.projectId,
    parentId: input.parentId ?? null,
    title,
    contentMd: input.contentMd ?? '',
    status: 'open',
    priority: input.priority ?? 0,
    allDay: startTime === null,
    startDate: input.startDate ?? null,
    startTime,
    endDate: input.endDate ?? null,
    endTime: input.endTime ?? null,
    completedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    sortKey: options.sortKey ?? `m${now.toString(36).padStart(10, '0')}-${id.slice(0, 8)}`,
    tagIds: input.tagIds ?? [],
    seriesId: null,
    occurrenceDate: null,
    occurrenceIndex: null,
    progress: 0,
    checklist: [],
  };
}

export function createNextOccurrenceTask(
  task: Task,
  occurrenceDate: string,
  occurrenceIndex: number,
  options: CreateTaskOptions = {},
): Task {
  const now = options.now ?? Date.now();
  const id = options.id ?? generateId();
  const timed = !task.allDay && task.startTime !== null;
  const spanDays =
    task.startDate && task.endDate ? Math.max(0, daysBetween(task.startDate, task.endDate)) : 0;
  const endDate =
    spanDays > 0
      ? addDaysKey(occurrenceDate, spanDays)
      : timed && task.endTime !== null
        ? occurrenceDate
        : null;

  return {
    ...task,
    id,
    status: 'open',
    startDate: occurrenceDate,
    endDate,
    completedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    sortKey: options.sortKey ?? `m${now.toString(36).padStart(10, '0')}-${id.slice(0, 8)}`,
    occurrenceDate,
    occurrenceIndex,
    progress: 0,
    checklist: task.checklist.map((item, index) => ({
      ...item,
      id: generateId(),
      taskId: id,
      completed: false,
      completedAt: null,
      sortKey: `m${now.toString(36)}-${index}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })),
  };
}

export function completeTask(task: Task, now: number = Date.now()): Task {
  if (task.status === 'completed') return task;
  return {
    ...task,
    status: 'completed',
    completedAt: now,
    updatedAt: now,
  };
}

export function uncompleteTask(task: Task, now: number = Date.now()): Task {
  if (task.status !== 'completed') return task;
  return {
    ...task,
    status: 'open',
    completedAt: null,
    updatedAt: now,
  };
}

export function toggleTaskCompletion(task: Task, now: number = Date.now()): Task {
  return task.status === 'completed'
    ? uncompleteTask(task, now)
    : completeTask(task, now);
}

export function trashTask(task: Task, now: number = Date.now()): Task {
  return {
    ...task,
    deletedAt: now,
    updatedAt: now,
  };
}

export function restoreTask(task: Task, now: number = Date.now()): Task {
  return {
    ...task,
    deletedAt: null,
    updatedAt: now,
  };
}

export function updateTask(task: Task, patch: TaskPatch, now: number = Date.now()): Task {
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new Error('任务标题不能为空');
  }

  const next: Task = {
    ...task,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() : task.title,
    updatedAt: now,
  };

  if (patch.startTime !== undefined) {
    next.allDay = patch.startTime === null;
    if (patch.startTime === null) {
      next.endTime = null;
    }
  }

  if (patch.startDate === null) {
    next.startTime = null;
    next.endDate = null;
    next.endTime = null;
    next.allDay = true;
  }

  if (next.startDate && next.endDate && next.endDate < next.startDate) {
    next.endDate = next.startDate;
  }

  return next;
}

export function abandonTask(task: Task, now: number = Date.now()): Task {
  return {
    ...task,
    status: 'abandoned',
    completedAt: null,
    updatedAt: now,
  };
}

export function restartTask(task: Task, now: number = Date.now()): Task {
  return {
    ...task,
    status: 'open',
    completedAt: null,
    updatedAt: now,
  };
}

export function duplicateTask(
  task: Task,
  options: { id?: string; now?: number; sortKey?: string } = {},
): Task {
  const now = options.now ?? Date.now();
  const id = options.id ?? generateId();
  return {
    ...task,
    id,
    parentId: null,
    title: `${task.title} 副本`,
    status: 'open',
    completedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    sortKey:
      options.sortKey ?? `m${now.toString(36).padStart(10, '0')}-${id.slice(0, 8)}`,
    seriesId: null,
    occurrenceDate: null,
    occurrenceIndex: null,
    progress: 0,
    checklist: task.checklist.map((item, index) => ({
      ...item,
      id: generateId(),
      taskId: id,
      completed: false,
      completedAt: null,
      sortKey: `m${now.toString(36)}-${index}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })),
  };
}

export interface ChecklistItemOptions {
  id?: string;
  now?: number;
  sortKey?: string;
}

function recomputeChecklistProgress(task: Task, now: number): Task {
  const total = task.checklist.length;
  if (total === 0) {
    return task.status === 'completed' && task.completedAt !== null
      ? task
      : { ...task, progress: 0 };
  }

  const done = task.checklist.filter((item) => item.completed).length;
  const progress = Math.round((done / total) * 100);
  if (task.status === 'open' && done === total) {
    return { ...task, progress, status: 'completed', completedAt: now, updatedAt: now };
  }
  if (task.status === 'completed' && done < total) {
    return { ...task, progress, status: 'open', completedAt: null, updatedAt: now };
  }
  return { ...task, progress };
}

export function addChecklistItem(
  task: Task,
  title: string,
  options: ChecklistItemOptions = {},
): Task {
  const value = title.trim();
  if (!value) throw new Error('检查事项不能为空');
  const now = options.now ?? Date.now();
  const id = options.id ?? generateId();
  const item = {
    id,
    taskId: task.id,
    title: value,
    completed: false,
    completedAt: null,
    sortKey:
      options.sortKey ?? `m${now.toString(36).padStart(10, '0')}-${id.slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const next = { ...task, checklist: [...task.checklist, item], updatedAt: now };
  return recomputeChecklistProgress(next, now);
}

export function toggleChecklistItem(
  task: Task,
  itemId: string,
  now: number = Date.now(),
): Task {
  const next = {
    ...task,
    checklist: task.checklist.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            completedAt: item.completed ? null : now,
            updatedAt: now,
          }
        : item,
    ),
    updatedAt: now,
  };
  return recomputeChecklistProgress(next, now);
}

export function deleteChecklistItem(
  task: Task,
  itemId: string,
  now: number = Date.now(),
): Task {
  const checklist = task.checklist.filter((item) => item.id !== itemId);
  const next = {
    ...task,
    checklist,
    progress: checklist.length === 0 ? 0 : task.progress,
    updatedAt: now,
  };
  return recomputeChecklistProgress(next, now);
}

export function findInboxProject(projects: Project[]): Project | undefined {
  return projects.find((project) => project.isInbox && project.deletedAt === null);
}

export function visibleProjects(projects: Project[]): Project[] {
  return projects
    .filter((project) => project.deletedAt === null && !project.isInbox)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export type SmartView =
  | 'today'
  | 'tomorrow'
  | 'next7days'
  | 'inbox'
  | 'all'
  | 'completed'
  | 'abandoned'
  | 'skipped'
  | 'trash';

export interface TaskQuery {
  smartView?: SmartView;
  projectId?: string;
  tagId?: string;
  inboxProjectId?: string;
  search?: string;
  includeSubtasks?: boolean;
  now?: Date;
}

function isDeleted(task: Task): boolean {
  return task.deletedAt !== null;
}

function isActive(task: Task): boolean {
  return !isDeleted(task) && task.status === 'open';
}

export function queryTasks(tasks: Task[], query: TaskQuery = {}): Task[] {
  const now = query.now ?? new Date();
  const today = localDateKey(now);
  const search = query.search?.trim().toLowerCase() ?? '';

  let result = tasks.filter((task) => {
    if (query.smartView === 'trash') {
      return isDeleted(task);
    }

    if (isDeleted(task)) {
      return false;
    }

    if (!query.includeSubtasks && task.parentId !== null) {
      return false;
    }

    if (query.projectId) {
      return isActive(task) && task.projectId === query.projectId;
    }

    if (query.tagId) {
      return isActive(task) && task.tagIds.includes(query.tagId);
    }

    switch (query.smartView) {
      case 'completed':
        return task.status === 'completed';
      case 'abandoned':
        return task.status === 'abandoned';
      case 'skipped':
        return task.status === 'skipped';
      case 'today':
        return isActive(task) && task.startDate === today;
      case 'tomorrow':
        return isActive(task) && task.startDate === tomorrowKey(now);
      case 'next7days':
        return (
          isActive(task) &&
          task.startDate !== null &&
          task.startDate >= today &&
          task.startDate <= addDaysKey(today, 6)
        );
      case 'inbox':
        return isActive(task) && task.projectId === query.inboxProjectId;
      case 'all':
      case undefined:
        return isActive(task);
      default:
        return isActive(task);
    }
  });

  if (search) {
    result = result.filter((task) => {
      const haystack = `${task.title}\n${task.contentMd}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  return sortTasks(result, query.smartView === 'completed' || query.smartView === 'trash');
}

export function sortTasks(tasks: Task[], byUpdatedAt = false): Task[] {
  return [...tasks].sort((a, b) => {
    if (byUpdatedAt) {
      return b.updatedAt - a.updatedAt;
    }

    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    const aDate = a.startDate ?? '9999-12-31';
    const bDate = b.startDate ?? '9999-12-31';
    if (aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }

    const aTime = a.startTime ?? '99:99:99';
    const bTime = b.startTime ?? '99:99:99';
    if (aTime !== bTime) {
      return aTime.localeCompare(bTime);
    }

    return a.sortKey.localeCompare(b.sortKey);
  });
}

export interface TaskCounts {
  today: number;
  tomorrow: number;
  next7days: number;
  inbox: number;
  all: number;
  completed: number;
  abandoned: number;
  skipped: number;
  trash: number;
}

export function countTasks(tasks: Task[], inboxProjectId?: string, now: Date = new Date()): TaskCounts {
  return {
    today: queryTasks(tasks, { smartView: 'today', now }).length,
    tomorrow: queryTasks(tasks, { smartView: 'tomorrow', now }).length,
    next7days: queryTasks(tasks, { smartView: 'next7days', now }).length,
    inbox: inboxProjectId
      ? queryTasks(tasks, { smartView: 'inbox', inboxProjectId, now }).length
      : 0,
    all: queryTasks(tasks, { smartView: 'all', now }).length,
    completed: queryTasks(tasks, { smartView: 'completed', now }).length,
    abandoned: queryTasks(tasks, { smartView: 'abandoned', now }).length,
    skipped: queryTasks(tasks, { smartView: 'skipped', now }).length,
    trash: queryTasks(tasks, { smartView: 'trash', now }).length,
  };
}

export function createEmptyState(
  now: number = Date.now(),
  profileName = '我的日程',
): AppState {
  const profileId = 'profile-local';
  const inboxId = 'project-inbox';

  return {
    version: 1,
    profile: {
      id: profileId,
      name: profileName,
      createdAt: now,
      updatedAt: now,
    },
    folders: [],
    projects: [
      {
        id: inboxId,
        profileId,
        folderId: null,
        name: '收集箱',
        kind: 'task',
        color: '#3b6ef6',
        isInbox: true,
        sortKey: 'a0',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    tasks: [],
    tags: [],
    filters: [],
    templates: [],
    comments: [],
    attachments: [],
    habits: [],
    habitCheckins: [],
    focusSessions: [],
    countdowns: [],
    recurrenceSeries: [],
    recurrenceExceptions: [],
    reminders: [],
    preferences: DEFAULT_PREFERENCES,
  };
}

export function createSeedState(
  now: number = Date.now(),
  profileName = '我的日程',
): AppState {
  const profileId = 'profile-local';
  const inboxId = 'project-inbox';
  const workId = 'project-work';
  const lifeId = 'project-life';
  const today = localDateKey(new Date(now));
  const tomorrow = localDateKey(new Date(now + 24 * 60 * 60 * 1000));

  return {
    version: 1,
    profile: {
      id: profileId,
      name: profileName,
      createdAt: now,
      updatedAt: now,
    },
    folders: [],
    projects: [
      {
        id: inboxId,
        profileId,
        folderId: null,
        name: '收集箱',
        kind: 'task',
        color: '#3b6ef6',
        isInbox: true,
        sortKey: 'a0',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: workId,
        profileId,
        folderId: null,
        name: '工作',
        kind: 'task',
        color: '#8b5cf6',
        isInbox: false,
        sortKey: 'a1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: lifeId,
        profileId,
        folderId: null,
        name: '生活',
        kind: 'task',
        color: '#10b981',
        isInbox: false,
        sortKey: 'a2',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    tags: [
      { id: 'tag-focus', profileId, name: '专注', color: '#f59e0b' },
      { id: 'tag-reading', profileId, name: '阅读', color: '#06b6d4' },
    ],
    filters: [],
    templates: [],
    comments: [],
    attachments: [],
    habits: [],
    habitCheckins: [],
    focusSessions: [],
    countdowns: [],
    recurrenceSeries: [],
    recurrenceExceptions: [],
    reminders: [],
    preferences: DEFAULT_PREFERENCES,
    tasks: [
      createTask(
        {
          profileId,
          projectId: inboxId,
          title: '欢迎使用 Dayline',
          contentMd: '这是本地优先的任务管理应用。数据默认只保存在本机。',
          startDate: today,
          priority: 5,
          tagIds: ['tag-focus'],
        },
        { id: 'task-welcome', now, sortKey: 'a0' },
      ),
      createTask(
        {
          profileId,
          projectId: workId,
          title: '整理本周工作计划',
          startDate: today,
          priority: 3,
        },
        { id: 'task-plan', now: now + 1, sortKey: 'a1' },
      ),
      createTask(
        {
          profileId,
          projectId: lifeId,
          title: '阅读 30 分钟',
          startDate: tomorrow,
          priority: 1,
          tagIds: ['tag-reading'],
        },
        { id: 'task-read', now: now + 2, sortKey: 'a2' },
      ),
      createTask(
        {
          profileId,
          projectId: inboxId,
          title: '购买牛奶',
        },
        { id: 'task-milk', now: now + 3, sortKey: 'a3' },
      ),
      completeTask(
        createTask(
          {
            profileId,
            projectId: workId,
            title: '完成初始化',
          },
          { id: 'task-done', now: now + 4, sortKey: 'a4' },
        ),
        now + 5,
      ),
    ],
  };
}
