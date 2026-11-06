import {
  createEmptyState,
  createSeedState,
  normalizePreferences,
  type AppPreferences,
  type AppState,
  type AttachmentMeta,
  type ChecklistItem,
  type Countdown,
  type FilterCondition,
  type FocusSession,
  type Folder,
  type Habit,
  type HabitCheckin,
  type HabitFrequency,
  type Priority,
  type Profile,
  type Project,
  type RecurrenceEndType,
  type RecurrenceException,
  type RecurrenceMode,
  type RecurrenceRule,
  type RecurrenceSeries,
  type Reminder,
  type ReminderOwnerType,
  type ReminderState,
  type SavedFilter,
  type Tag,
  type Task,
  type TaskComment,
  type TaskStatus,
  type TaskTemplate,
} from '@dayline/core';
import type { SqliteDriver, SqliteStatement, SqlValue } from './driver';

interface ProfileRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

interface FolderRow {
  id: string;
  profile_id: string;
  name: string;
  sort_key: string;
  collapsed: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface ProjectRow {
  id: string;
  profile_id: string;
  folder_id: string | null;
  name: string;
  kind: string;
  color: string | null;
  is_inbox: number;
  sort_key: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface TagRow {
  id: string;
  profile_id: string;
  name: string;
  color: string | null;
}

interface FilterRow {
  id: string;
  profile_id: string;
  name: string;
  query_json: string;
  sort_key: string;
  pinned: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface TemplateRow {
  id: string;
  profile_id: string;
  name: string;
  content_md: string;
  tags_json: string;
  sort_key: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface CommentRow {
  id: string;
  profile_id: string;
  task_id: string;
  content_md: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface AttachmentRow {
  id: string;
  profile_id: string;
  owner_type: string;
  owner_id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_path: string;
  created_at: number;
  deleted_at: number | null;
}

interface HabitRow {
  id: string;
  profile_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string;
  frequency_json: string;
  goal_amount: number | null;
  unit: string | null;
  checkin_mode: string;
  archived: number;
  sort_key: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface HabitCheckinRow {
  id: string;
  habit_id: string;
  date: string;
  amount: number;
  note: string;
  checked_at: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface FocusSessionRow {
  id: string;
  profile_id: string;
  task_id: string | null;
  mode: string;
  state: string;
  planned_seconds: number | null;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number;
  note: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface CountdownRow {
  id: string;
  profile_id: string;
  name: string;
  type: string;
  date: string;
  calendar: string;
  ignore_year: number;
  count_mode: string;
  note: string;
  pinned: number;
  archived: number;
  sort_key: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface TaskRow {
  id: string;
  profile_id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content_md: string;
  status: string;
  priority: number;
  all_day: number;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  completed_at: number | null;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
  sort_key: string;
  recurrence_series_id: string | null;
  occurrence_date: string | null;
  occurrence_index: number | null;
  progress: number;
}

interface ChecklistItemRow {
  id: string;
  task_id: string;
  title: string;
  completed: number;
  completed_at: number | null;
  sort_key: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface TaskTagRow {
  task_id: string;
  tag_id: string;
}

interface ReminderRow {
  id: string;
  profile_id: string;
  owner_type: string;
  owner_id: string;
  kind: string;
  trigger_at: number;
  offset_minutes: number | null;
  persistent: number;
  state: string;
  snooze_until: number | null;
  created_at: number;
  updated_at: number;
}

interface RecurrenceExceptionRow {
  id: string;
  series_id: string;
  occurrence_date: string;
  action: string;
  override_json: string | null;
  created_at: number;
  updated_at: number;
}

interface SettingRow {
  key: string;
  value_json: string;
}

interface RecurrenceSeriesRow {
  id: string;
  profile_id: string;
  template_task_id: string;
  mode: string;
  rule_json: string;
  timezone: string | null;
  dtstart_date: string;
  dtstart_time: string | null;
  end_type: string;
  end_date: string | null;
  end_count: number | null;
  completed_count: number;
  status: string;
  created_at: number;
  updated_at: number;
}

function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function toUtc(date: string | null, time: string | null): number | null {
  if (!date || !time) return null;
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const local = new Date(`${date}T00:00:00`);
  local.setHours(hour, minute, 0, 0);
  const value = local.getTime();
  return Number.isFinite(value) ? value : null;
}

function profileStatement(profile: Profile): SqliteStatement {
  return {
    sql: `
      INSERT INTO profile (id, name, avatar_json, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `,
    params: [profile.id, profile.name, profile.createdAt, profile.updatedAt],
  };
}

function projectStatement(project: Project): SqliteStatement {
  return {
    sql: `
      INSERT INTO project (
        id, profile_id, folder_id, name, kind, color, icon, background_json,
        is_inbox, pinned, sort_key, view_config_json, group_config_json,
        sort_config_json, show_in_smart, notification_config_json,
        created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 0, ?, '{}', '{}', '{}', 1, '{}', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        folder_id = excluded.folder_id,
        name = excluded.name,
        kind = excluded.kind,
        color = excluded.color,
        is_inbox = excluded.is_inbox,
        sort_key = excluded.sort_key,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      project.id,
      project.profileId,
      project.folderId,
      project.name,
      project.kind,
      project.color,
      project.isInbox ? 1 : 0,
      project.sortKey,
      project.createdAt,
      project.updatedAt,
      project.deletedAt,
    ],
  };
}

function tagStatement(tag: Tag): SqliteStatement {
  const now = Date.now();
  return {
    sql: `
      INSERT INTO tag (id, profile_id, name, color, parent_id, sort_key, pinned, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, NULL, ?, 0, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        color = excluded.color,
        updated_at = excluded.updated_at
    `,
    params: [tag.id, tag.profileId, tag.name, tag.color, tag.name, now, now],
  };
}

function folderStatement(folder: Folder): SqliteStatement {
  return {
    sql: `
      INSERT INTO folder (id, profile_id, name, sort_key, collapsed, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        sort_key = excluded.sort_key,
        collapsed = excluded.collapsed,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      folder.id,
      folder.profileId,
      folder.name,
      folder.sortKey,
      folder.collapsed ? 1 : 0,
      folder.createdAt,
      folder.updatedAt,
      folder.deletedAt,
    ],
  };
}

function filterStatement(filter: SavedFilter): SqliteStatement {
  return {
    sql: `
      INSERT INTO filter (id, profile_id, name, query_json, sort_key, pinned, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        query_json = excluded.query_json,
        sort_key = excluded.sort_key,
        pinned = excluded.pinned,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      filter.id,
      filter.profileId,
      filter.name,
      JSON.stringify({ conditions: filter.conditions, match: filter.match }),
      filter.sortKey,
      filter.pinned ? 1 : 0,
      filter.createdAt,
      filter.updatedAt,
      filter.deletedAt,
    ],
  };
}

function templateStatement(template: TaskTemplate): SqliteStatement {
  return {
    sql: `
      INSERT INTO template (id, profile_id, type, name, content_md, tags_json, sort_key, created_at, updated_at, deleted_at)
      VALUES (?, ?, 'task', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        content_md = excluded.content_md,
        tags_json = excluded.tags_json,
        sort_key = excluded.sort_key,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      template.id,
      template.profileId,
      template.name,
      template.contentMd,
      JSON.stringify({ title: template.title, priority: template.priority, tagIds: template.tagIds, projectId: template.projectId }),
      template.id,
      template.createdAt,
      template.updatedAt,
      template.deletedAt,
    ],
  };
}

function commentStatement(comment: TaskComment): SqliteStatement {
  return {
    sql: `
      INSERT INTO comment (id, profile_id, task_id, author_id, content_md, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content_md = excluded.content_md,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      comment.id,
      comment.profileId,
      comment.taskId,
      comment.contentMd,
      comment.createdAt,
      comment.updatedAt,
      comment.deletedAt,
    ],
  };
}

function attachmentStatement(attachment: AttachmentMeta): SqliteStatement {
  return {
    sql: `
      INSERT INTO attachment (id, profile_id, owner_type, owner_id, file_name, mime_type,
        size_bytes, sha256, storage_path, created_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        storage_path = excluded.storage_path,
        deleted_at = excluded.deleted_at
    `,
    params: [
      attachment.id,
      attachment.profileId,
      attachment.ownerType,
      attachment.ownerId,
      attachment.fileName,
      attachment.mimeType,
      attachment.sizeBytes,
      attachment.id,
      attachment.storagePath,
      attachment.createdAt,
      attachment.deletedAt,
    ],
  };
}

function habitStatement(habit: Habit): SqliteStatement {
  return {
    sql: `
      INSERT INTO habit (id, profile_id, section_id, name, icon, color, description,
        frequency_json, goal_amount, unit, checkin_mode, archived, sort_key,
        created_at, updated_at, deleted_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        icon = excluded.icon,
        color = excluded.color,
        description = excluded.description,
        frequency_json = excluded.frequency_json,
        goal_amount = excluded.goal_amount,
        unit = excluded.unit,
        archived = excluded.archived,
        sort_key = excluded.sort_key,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      habit.id,
      habit.profileId,
      habit.name,
      habit.icon,
      habit.color,
      habit.description,
      JSON.stringify(habit.frequency),
      habit.goalAmount,
      habit.unit,
      habit.archived ? 1 : 0,
      habit.sortKey,
      habit.createdAt,
      habit.updatedAt,
      habit.deletedAt,
    ],
  };
}

function habitCheckinStatement(checkin: HabitCheckin): SqliteStatement {
  return {
    sql: `
      INSERT INTO habit_checkin (id, habit_id, date, amount, mood, note, source,
        checked_at, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, NULL, ?, 'manual', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        amount = excluded.amount,
        note = excluded.note,
        checked_at = excluded.checked_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      checkin.id,
      checkin.habitId,
      checkin.date,
      checkin.amount,
      checkin.note,
      checkin.checkedAt,
      checkin.createdAt,
      checkin.updatedAt,
      checkin.deletedAt,
    ],
  };
}

function focusStatement(session: FocusSession): SqliteStatement {
  return {
    sql: `
      INSERT INTO focus_session (id, profile_id, task_id, habit_id, common_focus_id,
        mode, state, planned_seconds, started_at, ended_at, duration_seconds, note,
        source, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, 'timer', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        mode = excluded.mode,
        state = excluded.state,
        planned_seconds = excluded.planned_seconds,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        duration_seconds = excluded.duration_seconds,
        note = excluded.note,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      session.id,
      session.profileId,
      session.taskId,
      session.mode,
      session.state,
      session.plannedSeconds,
      session.startedAt,
      session.endedAt,
      session.durationSeconds,
      session.note,
      session.createdAt,
      session.updatedAt,
      session.deletedAt,
    ],
  };
}

function countdownStatement(countdown: Countdown): SqliteStatement {
  return {
    sql: `
      INSERT INTO countdown (id, profile_id, name, icon, type, date, calendar,
        lunar_json, ignore_year, repeat_rule_json, count_mode, include_first_day,
        show_age, style_json, note, pinned, archived, sort_key, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, 0, 0, '{}', ?, ?, 0, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        date = excluded.date,
        calendar = excluded.calendar,
        ignore_year = excluded.ignore_year,
        repeat_rule_json = excluded.repeat_rule_json,
        count_mode = excluded.count_mode,
        note = excluded.note,
        pinned = excluded.pinned,
        sort_key = excluded.sort_key,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `,
    params: [
      countdown.id,
      countdown.profileId,
      countdown.name,
      countdown.type,
      countdown.date,
      countdown.calendar,
      countdown.repeatYearly ? 1 : 0,
      countdown.repeatYearly ? JSON.stringify({ freq: 'yearly' }) : null,
      countdown.countMode,
      countdown.note,
      countdown.pinned ? 1 : 0,
      countdown.id,
      countdown.createdAt,
      countdown.updatedAt,
      countdown.deletedAt,
    ],
  };
}

function seriesStatement(series: RecurrenceSeries): SqliteStatement {
  return {
    sql: `
      INSERT INTO recurrence_series (
        id, profile_id, template_task_id, mode, rule_json, timezone,
        dtstart_date, dtstart_time, end_type, end_date, end_count,
        completed_count, status, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET
        template_task_id = excluded.template_task_id,
        mode = excluded.mode,
        rule_json = excluded.rule_json,
        timezone = excluded.timezone,
        dtstart_date = excluded.dtstart_date,
        dtstart_time = excluded.dtstart_time,
        end_type = excluded.end_type,
        end_date = excluded.end_date,
        end_count = excluded.end_count,
        completed_count = excluded.completed_count,
        status = excluded.status,
        updated_at = excluded.updated_at
    `,
    params: [
      series.id,
      series.profileId,
      series.templateTaskId,
      series.mode,
      JSON.stringify(series.rule),
      series.timezone,
      series.dtstartDate,
      series.dtstartTime,
      series.endType,
      series.endDate,
      series.endCount,
      series.completedCount,
      series.status,
      series.createdAt,
      series.updatedAt,
    ],
  };
}

function exceptionStatement(exception: RecurrenceException): SqliteStatement {
  return {
    sql: `
      INSERT INTO recurrence_exception (
        id, series_id, occurrence_date, action, override_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id, occurrence_date) DO UPDATE SET
        action = excluded.action,
        override_json = excluded.override_json,
        updated_at = excluded.updated_at
    `,
    params: [
      exception.id,
      exception.seriesId,
      exception.occurrenceDate,
      exception.action,
      exception.override ? JSON.stringify(exception.override) : null,
      exception.createdAt,
      exception.updatedAt,
    ],
  };
}

function preferenceStatement(
  profileId: string,
  preferences: AppPreferences,
  now: number,
): SqliteStatement {
  return {
    sql: `
      INSERT INTO app_setting (profile_id, key, value_json, updated_at)
      VALUES (?, 'calendar', ?, ?)
      ON CONFLICT(profile_id, key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `,
    params: [profileId, JSON.stringify(preferences.calendar), now],
  };
}

function reminderStatement(reminder: Reminder): SqliteStatement {
  return {
    sql: `
      INSERT INTO reminder (
        id, profile_id, owner_type, owner_id, kind, trigger_at,
        offset_minutes, persistent, state, snooze_until, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_type = excluded.owner_type,
        owner_id = excluded.owner_id,
        kind = excluded.kind,
        trigger_at = excluded.trigger_at,
        offset_minutes = excluded.offset_minutes,
        persistent = excluded.persistent,
        state = excluded.state,
        snooze_until = excluded.snooze_until,
        updated_at = excluded.updated_at
    `,
    params: [
      reminder.id,
      reminder.profileId,
      reminder.ownerType,
      reminder.ownerId,
      reminder.kind,
      reminder.triggerAt,
      reminder.offsetMinutes,
      reminder.persistent ? 1 : 0,
      reminder.state,
      reminder.snoozeUntil,
      reminder.createdAt,
      reminder.updatedAt,
    ],
  };
}

function taskStatements(task: Task): SqliteStatement[] {
  const timed = !task.allDay && task.startDate !== null && task.startTime !== null;
  const allDay = timed ? 0 : 1;
  const startTime = timed ? task.startTime : null;
  const endTime = timed ? task.endTime : null;
  const startAt = timed ? toUtc(task.startDate, task.startTime) : null;
  const endAt = timed ? toUtc(task.endDate ?? task.startDate, task.endTime) : null;
  const timezone = currentTimezone();

  const statements: SqliteStatement[] = [
    {
      sql: `
        INSERT INTO task (
          id, profile_id, project_id, section_id, parent_id, title, content_md,
          kind, status, priority, all_day, start_date, end_date, start_time,
          end_time, timezone, time_mode, start_at, end_at, recurrence_series_id,
          occurrence_date, occurrence_index, progress, pinned, sort_key,
          estimated_pomodoros, estimated_minutes, assignee_id, created_by,
          created_at, updated_at, completed_at, abandoned_at, deleted_at
        )
        VALUES (
          ?, ?, ?, NULL, ?, ?, ?, 'task', ?, ?, ?, ?, ?, ?, ?, ?, 'floating',
          ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          parent_id = excluded.parent_id,
          title = excluded.title,
          content_md = excluded.content_md,
          status = excluded.status,
          priority = excluded.priority,
          all_day = excluded.all_day,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          timezone = excluded.timezone,
          start_at = excluded.start_at,
          end_at = excluded.end_at,
          recurrence_series_id = excluded.recurrence_series_id,
          occurrence_date = excluded.occurrence_date,
          occurrence_index = excluded.occurrence_index,
          progress = excluded.progress,
          sort_key = excluded.sort_key,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at,
          deleted_at = excluded.deleted_at
      `,
      params: [
        task.id,
        task.profileId,
        task.projectId,
        task.parentId,
        task.title,
        task.contentMd,
        task.status,
        task.priority,
        allDay,
        task.startDate,
        task.endDate,
        startTime,
        endTime,
        timezone,
        startAt,
        endAt,
        task.seriesId,
        task.occurrenceDate,
        task.occurrenceIndex,
        task.progress,
        task.sortKey,
        task.createdAt,
        task.updatedAt,
        task.completedAt,
        task.deletedAt,
      ],
    },
    {
      sql: 'DELETE FROM task_tag WHERE task_id = ?',
      params: [task.id],
    },
    {
      sql: 'DELETE FROM checklist_item WHERE task_id = ?',
      params: [task.id],
    },
  ];

  for (const item of task.checklist) {
    statements.push({
      sql: `
        INSERT INTO checklist_item (
          id, task_id, title, completed, completed_at, sort_key,
          created_at, updated_at, deleted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        item.id,
        task.id,
        item.title,
        item.completed ? 1 : 0,
        item.completedAt,
        item.sortKey,
        item.createdAt,
        item.updatedAt,
        item.deletedAt,
      ],
    });
  }

  for (const tagId of task.tagIds) {
    statements.push({
      sql: 'INSERT OR IGNORE INTO task_tag (task_id, tag_id, created_at) VALUES (?, ?, ?)',
      params: [task.id, tagId, task.updatedAt],
    });
  }

  return statements;
}

function orderTasksByParent(tasks: Task[]): Task[] {
  const result: Task[] = [];
  const seen = new Set<string>();
  let remaining = [...tasks];
  while (remaining.length > 0) {
    const ready = remaining.filter((task) => !task.parentId || seen.has(task.parentId));
    if (ready.length === 0) {
      result.push(...remaining);
      break;
    }
    for (const task of ready) {
      result.push(task);
      seen.add(task.id);
    }
    remaining = remaining.filter((task) => !seen.has(task.id));
  }
  return result;
}

export interface InitializeOptions {
  profileName?: string;
  /** Seed the demo lists/tasks. New users start with an empty inbox. */
  demo?: boolean;
}

/**
 * SQLite implementation of the local store.
 *
 * The repository owns SQL and row mapping; the driver owns transport
 * (Web Worker + OPFS today, Tauri SQLite later).
 */
export class SqliteRepository {
  constructor(private readonly driver: SqliteDriver) {}

  async initialize(options: InitializeOptions = {}): Promise<AppState> {
    await this.seedIfEmpty(options);
    return this.loadState();
  }

  close(): void {
    this.driver.close();
  }

  async quickCheck(): Promise<{ ok: boolean; messages: string[] }> {
    try {
      const rows = await this.driver.all<Record<string, SqlValue>>('PRAGMA quick_check');
      const messages = rows
        .map((row) => String(Object.values(row)[0] ?? ''))
        .filter((value) => value.length > 0);
      return {
        ok: messages.length === 1 && messages[0] === 'ok',
        messages: messages.length === 0 ? ['没有返回检查结果'] : messages,
      };
    } catch (error) {
      return {
        ok: false,
        messages: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  async databaseSize(): Promise<number> {
    try {
      const pageCount = Number(
        (await this.driver.all<Record<string, SqlValue>>('PRAGMA page_count'))[0]?.page_count ?? 0,
      );
      const pageSize = Number(
        (await this.driver.all<Record<string, SqlValue>>('PRAGMA page_size'))[0]?.page_size ?? 0,
      );
      return pageCount * pageSize;
    } catch {
      return 0;
    }
  }

  /**
   * Developer helper: wipe the local database and reseed the demo state.
   * Exposed through `?reset=1` in dev builds only.
   */
  async reset(options: InitializeOptions = {}): Promise<AppState> {
    await this.driver.batch([
      { sql: 'DELETE FROM task_tag' },
      { sql: 'DELETE FROM reminder' },
      { sql: 'DELETE FROM attachment' },
      { sql: 'DELETE FROM comment' },
      { sql: 'DELETE FROM task' },
      { sql: 'DELETE FROM recurrence_exception' },
      { sql: 'DELETE FROM recurrence_series' },
      { sql: 'DELETE FROM habit_checkin' },
      { sql: 'DELETE FROM habit' },
      { sql: 'DELETE FROM focus_session' },
      { sql: 'DELETE FROM countdown' },
      { sql: 'DELETE FROM filter' },
      { sql: 'DELETE FROM template' },
      { sql: 'DELETE FROM project' },
      { sql: 'DELETE FROM folder' },
      { sql: 'DELETE FROM tag' },
      { sql: 'DELETE FROM app_setting' },
      { sql: 'DELETE FROM profile' },
    ]);
    return this.initialize(options);
  }

  async loadState(): Promise<AppState> {
    const profileRows = await this.driver.all<ProfileRow>(
      'SELECT id, name, created_at, updated_at FROM profile ORDER BY created_at LIMIT 1',
    );
    const profileRow = profileRows[0];
    if (!profileRow) {
      throw new Error('本地数据库缺少 profile');
    }

    const projectRows = await this.driver.all<ProjectRow>(
      `SELECT id, profile_id, folder_id, name, kind, color, is_inbox, sort_key, created_at, updated_at, deleted_at
       FROM project
       WHERE deleted_at IS NULL
       ORDER BY sort_key`,
    );
    const folderRows = await this.driver.all<FolderRow>(
      `SELECT id, profile_id, name, sort_key, collapsed, created_at, updated_at, deleted_at
       FROM folder
       WHERE deleted_at IS NULL
       ORDER BY sort_key`,
    );
    const tagRows = await this.driver.all<TagRow>(
      'SELECT id, profile_id, name, color FROM tag WHERE deleted_at IS NULL ORDER BY sort_key',
    );
    const taskRows = await this.driver.all<TaskRow>(
      `SELECT id, profile_id, project_id, parent_id, title, content_md, status, priority,
              all_day, start_date, start_time, end_date, end_time, completed_at, deleted_at,
              created_at, updated_at, sort_key, recurrence_series_id, occurrence_date,
              occurrence_index, progress
       FROM task
       ORDER BY sort_key`,
    );
    const taskTagRows = await this.driver.all<TaskTagRow>(
      'SELECT task_id, tag_id FROM task_tag',
    );
    const checklistRows = await this.driver.all<ChecklistItemRow>(
      `SELECT id, task_id, title, completed, completed_at, sort_key,
              created_at, updated_at, deleted_at
       FROM checklist_item
       WHERE deleted_at IS NULL
       ORDER BY sort_key`,
    );
    const seriesRows = await this.driver.all<RecurrenceSeriesRow>(
      `SELECT id, profile_id, template_task_id, mode, rule_json, timezone,
              dtstart_date, dtstart_time, end_type, end_date, end_count,
              completed_count, status, created_at, updated_at
       FROM recurrence_series
       WHERE deleted_at IS NULL
       ORDER BY created_at`,
    );
    const reminderRows = await this.driver.all<ReminderRow>(
      `SELECT id, profile_id, owner_type, owner_id, kind, trigger_at,
              offset_minutes, persistent, state, snooze_until, created_at, updated_at
       FROM reminder
       ORDER BY trigger_at`,
    );
    const exceptionRows = await this.driver.all<RecurrenceExceptionRow>(
      `SELECT id, series_id, occurrence_date, action, override_json, created_at, updated_at
       FROM recurrence_exception
       ORDER BY occurrence_date`,
    );
    const settingRows = await this.driver.all<SettingRow>(
      `SELECT key, value_json FROM app_setting WHERE profile_id = ?`,
      [profileRow.id],
    );
    const filterRows = await this.driver.all<FilterRow>(
      `SELECT id, profile_id, name, query_json, sort_key, pinned, created_at, updated_at, deleted_at
       FROM filter WHERE deleted_at IS NULL ORDER BY sort_key`,
    );
    const templateRows = await this.driver.all<TemplateRow>(
      `SELECT id, profile_id, name, content_md, tags_json, sort_key, created_at, updated_at, deleted_at
       FROM template WHERE deleted_at IS NULL ORDER BY sort_key`,
    );
    const commentRows = await this.driver.all<CommentRow>(
      `SELECT id, profile_id, task_id, content_md, created_at, updated_at, deleted_at
       FROM comment WHERE deleted_at IS NULL ORDER BY created_at`,
    );
    const attachmentRows = await this.driver.all<AttachmentRow>(
      `SELECT id, profile_id, owner_type, owner_id, file_name, mime_type, size_bytes,
              storage_path, created_at, deleted_at
       FROM attachment WHERE deleted_at IS NULL ORDER BY created_at`,
    );
    const habitRows = await this.driver.all<HabitRow>(
      `SELECT id, profile_id, name, icon, color, description, frequency_json,
              goal_amount, unit, checkin_mode, archived, sort_key, created_at, updated_at, deleted_at
       FROM habit WHERE deleted_at IS NULL ORDER BY sort_key`,
    );
    const checkinRows = await this.driver.all<HabitCheckinRow>(
      `SELECT id, habit_id, date, amount, note, checked_at, created_at, updated_at, deleted_at
       FROM habit_checkin WHERE deleted_at IS NULL ORDER BY date`,
    );
    const focusRows = await this.driver.all<FocusSessionRow>(
      `SELECT id, profile_id, task_id, mode, state, planned_seconds, started_at, ended_at,
              duration_seconds, note, created_at, updated_at, deleted_at
       FROM focus_session WHERE deleted_at IS NULL ORDER BY started_at DESC`,
    );
    const countdownRows = await this.driver.all<CountdownRow>(
      `SELECT id, profile_id, name, type, date, calendar, ignore_year, count_mode,
              note, pinned, archived, sort_key, created_at, updated_at, deleted_at
       FROM countdown WHERE deleted_at IS NULL ORDER BY sort_key`,
    );

    const tagsByTask = new Map<string, string[]>();
    for (const row of taskTagRows) {
      const existing = tagsByTask.get(row.task_id) ?? [];
      existing.push(row.tag_id);
      tagsByTask.set(row.task_id, existing);
    }

    const checklistByTask = new Map<string, ChecklistItem[]>();
    for (const row of checklistRows) {
      const list = checklistByTask.get(row.task_id) ?? [];
      list.push({
        id: row.id,
        taskId: row.task_id,
        title: row.title,
        completed: row.completed === 1,
        completedAt: row.completed_at,
        sortKey: row.sort_key,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      });
      checklistByTask.set(row.task_id, list);
    }

    const folders: Folder[] = folderRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      name: row.name,
      sortKey: row.sort_key,
      collapsed: row.collapsed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));

    const filters: SavedFilter[] = filterRows.map((row) => {
      let parsed: { conditions?: FilterCondition[]; match?: 'all' | 'any' } = {};
      try {
        parsed = JSON.parse(row.query_json) as typeof parsed;
      } catch {
        parsed = {};
      }
      return {
        id: row.id,
        profileId: row.profile_id,
        name: row.name,
        conditions: parsed.conditions ?? [],
        match: parsed.match === 'any' ? 'any' : 'all',
        sortKey: row.sort_key,
        pinned: row.pinned === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      };
    });

    const templates: TaskTemplate[] = templateRows.map((row) => {
      let extra: {
        title?: string;
        priority?: Priority;
        tagIds?: string[];
        projectId?: string | null;
      } = {};
      try {
        extra = JSON.parse(row.tags_json) as typeof extra;
      } catch {
        extra = {};
      }
      return {
        id: row.id,
        profileId: row.profile_id,
        name: row.name,
        title: extra.title ?? row.name,
        contentMd: row.content_md,
        priority: extra.priority ?? 0,
        tagIds: extra.tagIds ?? [],
        projectId: extra.projectId ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      };
    });

    const comments: TaskComment[] = commentRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      taskId: row.task_id,
      contentMd: row.content_md,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));

    const attachments: AttachmentMeta[] = attachmentRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      ownerType: 'task',
      ownerId: row.owner_id,
      fileName: row.file_name,
      mimeType: row.mime_type ?? '',
      sizeBytes: row.size_bytes,
      storagePath: row.storage_path,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
    }));

    const habits: Habit[] = habitRows.map((row) => {
      let frequency: HabitFrequency = { type: 'daily' };
      try {
        frequency = JSON.parse(row.frequency_json) as HabitFrequency;
      } catch {
        frequency = { type: 'daily' };
      }
      return {
        id: row.id,
        profileId: row.profile_id,
        name: row.name,
        icon: row.icon ?? '✅',
        color: row.color ?? '#3b6ef6',
        description: row.description,
        frequency,
        goalAmount: row.goal_amount,
        unit: row.unit,
        archived: row.archived === 1,
        sortKey: row.sort_key,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      };
    });

    const habitCheckins: HabitCheckin[] = checkinRows.map((row) => ({
      id: row.id,
      habitId: row.habit_id,
      date: row.date,
      amount: row.amount,
      note: row.note,
      checkedAt: row.checked_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));

    const focusSessions: FocusSession[] = focusRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      taskId: row.task_id,
      mode: row.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
      state: row.state as FocusSession['state'],
      plannedSeconds: row.planned_seconds,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));

    const countdowns: Countdown[] = countdownRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      name: row.name,
      type: row.type as Countdown['type'],
      date: row.date,
      calendar: row.calendar === 'lunar' ? 'lunar' : 'solar',
      repeatYearly: row.ignore_year === 1,
      countMode: row.count_mode === 'count_up' ? 'count_up' : 'countdown',
      pinned: row.pinned === 1,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));

    const profile: Profile = {
      id: profileRow.id,
      name: profileRow.name,
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    };

    const projects: Project[] = projectRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      folderId: row.folder_id,
      name: row.name,
      kind: row.kind === 'note' ? 'note' : 'task',
      color: row.color ?? '#3b6ef6',
      isInbox: row.is_inbox === 1,
      sortKey: row.sort_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));

    const tags: Tag[] = tagRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      name: row.name,
      color: row.color ?? '#8b929e',
    }));

    const tasks: Task[] = taskRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      projectId: row.project_id,
      parentId: row.parent_id,
      title: row.title,
      contentMd: row.content_md,
      status: row.status as TaskStatus,
      priority: row.priority as Priority,
      allDay: row.all_day === 1,
      startDate: row.start_date,
      startTime: row.start_time,
      endDate: row.end_date,
      endTime: row.end_time,
      completedAt: row.completed_at,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sortKey: row.sort_key,
      tagIds: tagsByTask.get(row.id) ?? [],
      seriesId: row.recurrence_series_id,
      occurrenceDate: row.occurrence_date,
      occurrenceIndex: row.occurrence_index,
      progress: row.progress,
      checklist: checklistByTask.get(row.id) ?? [],
    }));

    const recurrenceSeries: RecurrenceSeries[] = seriesRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      templateTaskId: row.template_task_id,
      mode: row.mode as RecurrenceMode,
      rule: JSON.parse(row.rule_json) as RecurrenceRule,
      timezone: row.timezone,
      dtstartDate: row.dtstart_date,
      dtstartTime: row.dtstart_time,
      endType: row.end_type as RecurrenceEndType,
      endDate: row.end_date,
      endCount: row.end_count,
      completedCount: row.completed_count,
      status: row.status as RecurrenceSeries['status'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const exceptions: RecurrenceException[] = exceptionRows.map((row) => ({
      id: row.id,
      seriesId: row.series_id,
      occurrenceDate: row.occurrence_date,
      action: row.action as RecurrenceException['action'],
      override: row.override_json
        ? (JSON.parse(row.override_json) as Record<string, unknown>)
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    let preferences = normalizePreferences(null);
    const calendarSetting = settingRows.find((row) => row.key === 'calendar');
    if (calendarSetting) {
      try {
        preferences = normalizePreferences({
          calendar: JSON.parse(calendarSetting.value_json) as AppPreferences['calendar'],
        });
      } catch {
        preferences = normalizePreferences(null);
      }
    }

    const reminders: Reminder[] = reminderRows.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      ownerType: row.owner_type as ReminderOwnerType,
      ownerId: row.owner_id,
      kind: row.kind as Reminder['kind'],
      triggerAt: row.trigger_at,
      offsetMinutes: row.offset_minutes,
      persistent: row.persistent === 1,
      state: row.state as ReminderState,
      snoozeUntil: row.snooze_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      version: 1,
      profile,
      folders,
      projects,
      tags,
      tasks,
      filters,
      templates,
      comments,
      attachments,
      habits,
      habitCheckins,
      focusSessions,
      countdowns,
      recurrenceSeries,
      recurrenceExceptions: exceptions,
      reminders,
      preferences,
    };
  }

  async saveProfile(profile: Profile): Promise<void> {
    const statement = profileStatement(profile);
    await this.driver.run(statement.sql, statement.params);
  }

  async saveProject(project: Project): Promise<void> {
    const statement = projectStatement(project);
    await this.driver.run(statement.sql, statement.params);
  }

  async saveTag(tag: Tag): Promise<void> {
    const statement = tagStatement(tag);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteTag(id: string): Promise<void> {
    await this.driver.batch([
      { sql: 'DELETE FROM task_tag WHERE tag_id = ?', params: [id] },
      {
        sql: 'UPDATE tag SET deleted_at = ?, updated_at = ? WHERE id = ?',
        params: [Date.now(), Date.now(), id],
      },
    ]);
  }

  async saveFolder(folder: Folder): Promise<void> {
    const statement = folderStatement(folder);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteFolder(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.batch([
      {
        sql: 'UPDATE project SET folder_id = NULL, updated_at = ? WHERE folder_id = ?',
        params: [now, id],
      },
      {
        sql: 'UPDATE folder SET deleted_at = ?, updated_at = ? WHERE id = ?',
        params: [now, now, id],
      },
    ]);
  }

  async deleteProject(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run(
      'UPDATE project SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id],
    );
  }

  async saveFilter(filter: SavedFilter): Promise<void> {
    const statement = filterStatement(filter);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteFilter(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run('UPDATE filter SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ]);
  }

  async saveTemplate(template: TaskTemplate): Promise<void> {
    const statement = templateStatement(template);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteTemplate(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run('UPDATE template SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ]);
  }

  async saveComment(comment: TaskComment): Promise<void> {
    const statement = commentStatement(comment);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteComment(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run('UPDATE comment SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ]);
  }

  async saveAttachment(attachment: AttachmentMeta): Promise<void> {
    const statement = attachmentStatement(attachment);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteAttachment(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run('UPDATE attachment SET deleted_at = ? WHERE id = ?', [now, id]);
  }

  async saveHabit(habit: Habit): Promise<void> {
    const statement = habitStatement(habit);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteHabit(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run('UPDATE habit SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ]);
  }

  async saveHabitCheckin(checkin: HabitCheckin): Promise<void> {
    const statement = habitCheckinStatement(checkin);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteHabitCheckin(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run(
      'UPDATE habit_checkin SET deleted_at = ?, updated_at = ? WHERE id = ?',
      [now, now, id],
    );
  }

  async saveFocusSession(session: FocusSession): Promise<void> {
    const statement = focusStatement(session);
    await this.driver.run(statement.sql, statement.params);
  }

  async saveCountdown(countdown: Countdown): Promise<void> {
    const statement = countdownStatement(countdown);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteCountdown(id: string): Promise<void> {
    const now = Date.now();
    await this.driver.run('UPDATE countdown SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      id,
    ]);
  }

  /**
   * Replaces the whole local database from an imported backup. Used by restore
   * and undo; the dataset is small enough that a transactional rewrite is
   * simpler and safer than diffing every entity.
   */
  async replaceAll(state: AppState): Promise<void> {
    const now = Date.now();
    const statements: SqliteStatement[] = [
      { sql: 'DELETE FROM task_tag' },
      { sql: 'DELETE FROM reminder' },
      { sql: 'DELETE FROM attachment' },
      { sql: 'DELETE FROM comment' },
      { sql: 'DELETE FROM task' },
      { sql: 'DELETE FROM recurrence_exception' },
      { sql: 'DELETE FROM recurrence_series' },
      { sql: 'DELETE FROM habit_checkin' },
      { sql: 'DELETE FROM habit' },
      { sql: 'DELETE FROM focus_session' },
      { sql: 'DELETE FROM countdown' },
      { sql: 'DELETE FROM filter' },
      { sql: 'DELETE FROM template' },
      { sql: 'DELETE FROM project' },
      { sql: 'DELETE FROM folder' },
      { sql: 'DELETE FROM tag' },
      { sql: 'DELETE FROM app_setting' },
      { sql: 'DELETE FROM profile' },
      profileStatement({ ...state.profile, updatedAt: now }),
      ...state.folders.map(folderStatement),
      ...state.projects.map(projectStatement),
      ...state.tags.map(tagStatement),
      ...state.filters.map(filterStatement),
      ...state.templates.map(templateStatement),
      ...state.habits.map(habitStatement),
      ...state.habitCheckins.map(habitCheckinStatement),
      ...state.countdowns.map(countdownStatement),
      ...state.recurrenceSeries.map(seriesStatement),
      ...state.recurrenceExceptions.map(exceptionStatement),
      ...orderTasksByParent(state.tasks).flatMap(taskStatements),
      ...state.comments.map(commentStatement),
      ...state.attachments.map(attachmentStatement),
      ...state.focusSessions.map(focusStatement),
      ...state.reminders.map(reminderStatement),
      preferenceStatement(state.profile.id, state.preferences, now),
    ];
    await this.driver.batch(statements);
  }

  async saveTask(task: Task): Promise<void> {
    await this.driver.batch(taskStatements(task));
  }

  async saveSeries(series: RecurrenceSeries): Promise<void> {
    const statement = seriesStatement(series);
    await this.driver.run(statement.sql, statement.params);
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    const statement = reminderStatement(reminder);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteReminder(id: string): Promise<void> {
    await this.driver.run('DELETE FROM reminder WHERE id = ?', [id]);
  }

  async saveException(exception: RecurrenceException): Promise<void> {
    const statement = exceptionStatement(exception);
    await this.driver.run(statement.sql, statement.params);
  }

  async deleteException(seriesId: string, occurrenceDate: string): Promise<void> {
    await this.driver.run(
      'DELETE FROM recurrence_exception WHERE series_id = ? AND occurrence_date = ?',
      [seriesId, occurrenceDate],
    );
  }

  async savePreferences(profileId: string, preferences: AppPreferences): Promise<void> {
    const statement = preferenceStatement(profileId, preferences, Date.now());
    await this.driver.run(statement.sql, statement.params);
  }

  private async seedIfEmpty(options: InitializeOptions): Promise<void> {
    const rows = await this.driver.all<{ count: number }>('SELECT COUNT(*) AS count FROM profile');
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) return;

    const seed =
      options.demo === false
        ? createEmptyState(Date.now(), options.profileName ?? '我的日程')
        : createSeedState(Date.now(), options.profileName ?? '我的日程');
    const statements: SqliteStatement[] = [
      profileStatement(seed.profile),
      ...seed.projects.map(projectStatement),
      ...seed.tags.map(tagStatement),
      ...seed.recurrenceSeries.map(seriesStatement),
      ...seed.tasks.flatMap(taskStatements),
    ];

    await this.driver.batch(statements);
  }
}

export type { SqlValue };
