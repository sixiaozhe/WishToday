import { localDateKey, parseLocalDateKey } from './date';
import { normalizePreferences } from './preferences';
import { createTask, completeTask, generateId } from './usecases';
import type { AppState, Priority, Project, Task, TaskStatus } from './types';

const BACKUP_VERSION = 1;

function normalizeTask(task: Task): Task {
  return {
    ...task,
    parentId: task.parentId ?? null,
    seriesId: task.seriesId ?? null,
    occurrenceDate: task.occurrenceDate ?? null,
    occurrenceIndex: task.occurrenceIndex ?? null,
    progress: task.progress ?? 0,
    checklist: Array.isArray(task.checklist) ? task.checklist : [],
    tagIds: Array.isArray(task.tagIds) ? task.tagIds : [],
  };
}

export interface BackupPayload {
  app: 'dayline';
  version: number;
  exportedAt: number;
  state: AppState;
}

export function serializeBackup(state: AppState, now: number = Date.now()): string {
  const payload: BackupPayload = {
    app: 'dayline',
    version: BACKUP_VERSION,
    exportedAt: now,
    state,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseBackup(raw: string): AppState {
  const parsed = JSON.parse(raw) as Partial<BackupPayload> & Partial<AppState>;
  const candidate =
    parsed && typeof parsed === 'object' && 'state' in parsed && parsed.state
      ? parsed.state
      : (parsed as Partial<AppState>);

  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !candidate.profile ||
    !Array.isArray(candidate.projects) ||
    !Array.isArray(candidate.tasks)
  ) {
    throw new Error('备份文件格式不正确');
  }

  return {
    version: 1,
    profile: candidate.profile,
    folders: candidate.folders ?? [],
    projects: candidate.projects.map((project) => ({
      ...project,
      folderId: project.folderId ?? null,
      deletedAt: project.deletedAt ?? null,
    })),
    tasks: candidate.tasks.map(normalizeTask),
    tags: candidate.tags ?? [],
    filters: candidate.filters ?? [],
    templates: candidate.templates ?? [],
    comments: candidate.comments ?? [],
    attachments: candidate.attachments ?? [],
    habits: candidate.habits ?? [],
    habitCheckins: candidate.habitCheckins ?? [],
    focusSessions: candidate.focusSessions ?? [],
    countdowns: candidate.countdowns ?? [],
    recurrenceSeries: candidate.recurrenceSeries ?? [],
    recurrenceExceptions: candidate.recurrenceExceptions ?? [],
    reminders: candidate.reminders ?? [],
    preferences: normalizePreferences(candidate.preferences),
  };
}

function escapeCsv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvDate(timestamp: number | null): string {
  return timestamp === null ? '' : localDateKey(new Date(timestamp));
}

export function tasksToCsv(tasks: Task[], projects: Project[]): string {
  const projectById = new Map(projects.map((project) => [project.id, project.name]));
  const header = [
    'id',
    'title',
    'content',
    'project',
    'status',
    'priority',
    'start_date',
    'start_time',
    'end_date',
    'end_time',
    'tags',
    'completed_at',
    'created_at',
  ];
  const rows = tasks.map((task) =>
    [
      task.id,
      task.title,
      task.contentMd,
      projectById.get(task.projectId) ?? '',
      task.status,
      task.priority,
      task.startDate ?? '',
      task.startTime ?? '',
      task.endDate ?? '',
      task.endTime ?? '',
      task.tagIds.join('|'),
      csvDate(task.completedAt),
      csvDate(task.createdAt),
    ]
      .map(escapeCsv)
      .join(','),
  );
  return `\uFEFF${[header.join(','), ...rows].join('\r\n')}`;
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export interface ImportCsvOptions {
  profileId: string;
  defaultProjectId: string;
  projects: Project[];
  now?: number;
}

export function parseTasksCsv(raw: string, options: ImportCsvOptions): Task[] {
  const text = raw.replace(/^\uFEFF/, '');
  const records = parseCsvRecords(text).filter((record) =>
    record.some((value) => value.trim().length > 0),
  );
  if (records.length === 0) return [];
  const header = (records[0] ?? []).map((value) => value.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name);
  const titleIndex = indexOf('title');
  if (titleIndex === -1) {
    throw new Error('CSV 缺少 title 列');
  }

  const now = options.now ?? Date.now();
  const projectByName = new Map(
    options.projects.map((project) => [project.name.toLowerCase(), project.id]),
  );
  const result: Task[] = [];

  for (const values of records.slice(1)) {
    const read = (name: string): string => {
      const index = indexOf(name);
      return index === -1 ? '' : (values[index] ?? '').trim();
    };
    const title = values[titleIndex]?.trim() ?? '';
    if (!title) continue;

    const projectName = read('project').toLowerCase();
    const projectId = projectByName.get(projectName) ?? options.defaultProjectId;
    const priority = Number(read('priority'));
    const task = createTask(
      {
        profileId: options.profileId,
        projectId,
        title,
        contentMd: read('content'),
        startDate: read('start_date') || null,
        startTime: read('start_time') || null,
        endDate: read('end_date') || null,
        endTime: read('end_time') || null,
        priority: ([0, 1, 3, 5].includes(priority) ? priority : 0) as Priority,
      },
      { now: now + result.length },
    );

    const status = read('status');
    if (status === 'completed') {
      result.push(completeTask(task, now));
    } else if (status === 'abandoned' || status === 'skipped') {
      result.push({ ...task, status: status as TaskStatus });
    } else {
      result.push(task);
    }
  }

  return result;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function icsDate(value: string): string {
  return value.replace(/-/g, '');
}

function icsTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
    date.getUTCDate(),
  )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
    date.getUTCSeconds(),
  )}Z`;
}

function icsTime(time: string | null): string {
  if (!time) return '';
  const [hour = '09', minute = '00'] = time.split(':');
  return `${hour}${minute}00`;
}

export function tasksToIcs(tasks: Task[], projects: Project[], now: number = Date.now()): string {
  const projectById = new Map(projects.map((project) => [project.id, project.name]));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dayline//Local Task Calendar//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const task of tasks) {
    if (task.deletedAt !== null) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@dayline.local`);
    lines.push(`DTSTAMP:${icsTimestamp(now)}`);
    if (task.startDate) {
      if (task.startTime) {
        lines.push(`DTSTART:${icsDate(task.startDate)}T${icsTime(task.startTime)}`);
        if (task.endTime) {
          lines.push(
            `DTEND:${icsDate(task.endDate ?? task.startDate)}T${icsTime(task.endTime)}`,
          );
        }
      } else {
        lines.push(`DTSTART;VALUE=DATE:${icsDate(task.startDate)}`);
        const endDate = task.endDate ?? task.startDate;
        const next = parseLocalDateKey(endDate);
        next.setDate(next.getDate() + 1);
        lines.push(`DTEND;VALUE=DATE:${icsDate(localDateKey(next))}`);
      }
    }
    lines.push(`SUMMARY:${escapeIcs(task.title)}`);
    const description = [
      task.contentMd,
      `优先级：${task.priority}`,
      `清单：${projectById.get(task.projectId) ?? ''}`,
    ]
      .filter(Boolean)
      .join('\n');
    lines.push(`DESCRIPTION:${escapeIcs(description)}`);
    if (task.status === 'completed') {
      lines.push('STATUS:COMPLETED');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
}

function parseIcsDateValue(raw: string): { date: string | null; time: string | null } {
  const value = raw.trim();
  if (!value) return { date: null, time: null };
  if (/^\d{8}$/.test(value)) {
    return {
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      time: null,
    };
  }
  const match = /^(\d{8})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) return { date: null, time: null };
  const [, day, hour, minute, second, utc] = match;
  const date = `${day?.slice(0, 4)}-${day?.slice(4, 6)}-${day?.slice(6, 8)}`;

  if (utc) {
    const utcDate = new Date(
      Date.UTC(
        Number(day?.slice(0, 4)),
        Number(day?.slice(4, 6)) - 1,
        Number(day?.slice(6, 8)),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    );
    return {
      date: localDateKey(utcDate),
      time: `${String(utcDate.getHours()).padStart(2, '0')}:${String(
        utcDate.getMinutes(),
      ).padStart(2, '0')}`,
    };
  }

  return { date, time: `${hour}:${minute}` };
}

export function parseIcs(raw: string): IcsEvent[] {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events: IcsEvent[] = [];
  let current: Partial<IcsEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { uid: generateId(), summary: '', description: '' };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.startDate) {
        events.push({
          uid: current.uid ?? generateId(),
          summary: current.summary ?? '',
          description: current.description ?? '',
          startDate: current.startDate,
          startTime: current.startTime ?? null,
          endDate: current.endDate ?? null,
          endTime: current.endTime ?? null,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const rawKey = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/\\n/gi, '\n').replace(/\\,/g, ',');
    const key = rawKey.split(';')[0]?.toUpperCase() ?? '';

    if (key === 'UID') current.uid = value.trim();
    else if (key === 'SUMMARY') current.summary = value.trim();
    else if (key === 'DESCRIPTION') current.description = value;
    else if (key === 'DTSTART') {
      const parsed = parseIcsDateValue(value);
      current.startDate = parsed.date ?? undefined;
      current.startTime = parsed.time;
    } else if (key === 'DTEND') {
      const parsed = parseIcsDateValue(value);
      current.endDate = parsed.date ?? null;
      current.endTime = parsed.time;
    }
  }

  return events;
}

export interface ImportIcsOptions {
  profileId: string;
  projectId: string;
  now?: number;
}

export function icsToTasks(events: IcsEvent[], options: ImportIcsOptions): Task[] {
  const now = options.now ?? Date.now();
  return events.map((event, index) =>
    createTask(
      {
        profileId: options.profileId,
        projectId: options.projectId,
        title: event.summary || '未命名日程',
        contentMd: event.description,
        startDate: event.startDate,
        startTime: event.startTime,
        endDate: event.endDate,
        endTime: event.endTime,
      },
      { id: `ics-${event.uid}`, now: now + index },
    ),
  );
}
