export type Priority = 0 | 1 | 3 | 5;

export type TaskStatus = 'open' | 'completed' | 'abandoned' | 'skipped';

export type ProjectKind = 'task' | 'note';

export type RecurrenceFreq =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'weekdays'
  | 'weekend'
  | 'statutory_workday'
  | 'statutory_holiday'
  | 'lunar_yearly'
  | 'lunar_monthly'
  | 'ebbinghaus'
  | 'selected_dates';

export type RecurrenceMode = 'due' | 'completion' | 'selected_dates';

export interface LunarRule {
  month: number;
  day: number;
  leap?: boolean;
  includeLeapMonths?: boolean;
}

export interface RecurrenceRule {
  version: 1;
  freq: RecurrenceFreq;
  interval?: number;
  byWeekday?: number[];
  byMonthDay?: number[];
  byMonth?: number[];
  weekStart?: 1 | 7;
  lunar?: LunarRule;
  selectedDates?: string[];
  ebbinghaus?: {
    offsets?: number[];
    tailDays?: number;
  };
}

export type RecurrenceEndType = 'never' | 'date' | 'count';

export type ReminderOwnerType = 'task' | 'checklist_item' | 'countdown' | 'habit';

export type ReminderState = 'pending' | 'fired' | 'snoozed' | 'dismissed' | 'cancelled';

export interface CalendarPreferences {
  /** First visible hour, 0-12. */
  startHour: number;
  /** End of the visible grid, 13-24. */
  endHour: number;
}

export interface AppPreferences {
  calendar: CalendarPreferences;
}

export interface RecurrenceException {
  id: string;
  seriesId: string;
  occurrenceDate: string;
  action: 'skip' | 'override';
  override: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface Reminder {
  id: string;
  profileId: string;
  ownerType: ReminderOwnerType;
  ownerId: string;
  kind: 'absolute' | 'relative_start' | 'relative_end';
  triggerAt: number;
  offsetMinutes: number | null;
  persistent: boolean;
  state: ReminderState;
  snoozeUntil: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RecurrenceSeries {
  id: string;
  profileId: string;
  templateTaskId: string;
  mode: RecurrenceMode;
  rule: RecurrenceRule;
  timezone: string | null;
  dtstartDate: string;
  dtstartTime: string | null;
  endType: RecurrenceEndType;
  endDate: string | null;
  endCount: number | null;
  completedCount: number;
  status: 'active' | 'paused' | 'ended';
  createdAt: number;
  updatedAt: number;
}

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  profileId: string;
  name: string;
  sortKey: string;
  collapsed: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Project {
  id: string;
  profileId: string;
  folderId: string | null;
  name: string;
  kind: ProjectKind;
  color: string;
  isInbox: boolean;
  sortKey: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Tag {
  id: string;
  profileId: string;
  name: string;
  color: string;
}

export type FilterField =
  | 'title'
  | 'content'
  | 'project'
  | 'tag'
  | 'priority'
  | 'status'
  | 'due'
  | 'completed';

export type FilterOperator =
  | 'contains'
  | 'notContains'
  | 'is'
  | 'isNot'
  | 'before'
  | 'after'
  | 'gte'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty';

export interface FilterCondition {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

export interface SavedFilter {
  id: string;
  profileId: string;
  name: string;
  conditions: FilterCondition[];
  match: 'all' | 'any';
  sortKey: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface TaskTemplate {
  id: string;
  profileId: string;
  name: string;
  title: string;
  contentMd: string;
  priority: Priority;
  tagIds: string[];
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface TaskComment {
  id: string;
  profileId: string;
  taskId: string;
  contentMd: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface AttachmentMeta {
  id: string;
  profileId: string;
  ownerType: 'task';
  ownerId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Storage locator: `opfs:...`, `idb:...`, or a legacy inline data URL. */
  storagePath: string;
  createdAt: number;
  deletedAt: number | null;
}

export interface HabitFrequency {
  type: 'daily' | 'weekly' | 'interval';
  weekdays?: number[];
  intervalDays?: number;
}

export interface Habit {
  id: string;
  profileId: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  frequency: HabitFrequency;
  goalAmount: number | null;
  unit: string | null;
  archived: boolean;
  sortKey: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface HabitCheckin {
  id: string;
  habitId: string;
  date: string;
  amount: number;
  note: string;
  checkedAt: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface FocusSession {
  id: string;
  profileId: string;
  taskId: string | null;
  mode: 'pomodoro' | 'stopwatch';
  state: 'running' | 'paused' | 'finished' | 'abandoned';
  plannedSeconds: number | null;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Countdown {
  id: string;
  profileId: string;
  name: string;
  type: 'festival' | 'birthday' | 'anniversary' | 'countdown';
  date: string;
  calendar: 'solar' | 'lunar';
  repeatYearly: boolean;
  countMode: 'countdown' | 'count_up';
  pinned: boolean;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  completedAt: number | null;
  sortKey: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Task {
  id: string;
  profileId: string;
  projectId: string;
  parentId: string | null;
  title: string;
  contentMd: string;
  status: TaskStatus;
  priority: Priority;
  allDay: boolean;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  completedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  sortKey: string;
  tagIds: string[];
  seriesId: string | null;
  occurrenceDate: string | null;
  occurrenceIndex: number | null;
  progress: number;
  checklist: ChecklistItem[];
}

export interface AppState {
  version: 1;
  profile: Profile;
  folders: Folder[];
  projects: Project[];
  tasks: Task[];
  tags: Tag[];
  filters: SavedFilter[];
  templates: TaskTemplate[];
  comments: TaskComment[];
  attachments: AttachmentMeta[];
  habits: Habit[];
  habitCheckins: HabitCheckin[];
  focusSessions: FocusSession[];
  countdowns: Countdown[];
  recurrenceSeries: RecurrenceSeries[];
  recurrenceExceptions: RecurrenceException[];
  reminders: Reminder[];
  preferences: AppPreferences;
}
