import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  BellRing,
  CalendarDays,
  Columns3,
  GanttChart,
  Grid2X2,
  List,
  Menu,
  Moon,
  Search,
  Sun,
  Undo2,
  Redo2,
  Users,
  X,
} from 'lucide-react';
import {
  abandonTask,
  achievements,
  addChecklistItem,
  addDaysKey,
  completeTask,
  countTasks,
  daysBetween,
  deleteChecklistItem,
  duplicateTask,
  createNextOccurrenceTask,
  createTask,
  createEmptyState,
  createSeedState,
  findInboxProject,
  formatDateLabel,
  generateId,
  habitScheduledOn,
  isStatutoryHoliday,
  isStatutoryWorkday,
  localDateKey,
  matchesFilter,
  normalizePreferences,
  parseLocalDateKey,
  queryTasks,
  reminderTriggerAt,
  restartTask,
  restoreTask,
  formatReminderTime,
  sortTasks,
  todayKey,
  toggleChecklistItem,
  toggleTaskCompletion,
  trashTask,
  uncompleteTask,
  updateTask,
  type AppPreferences,
  type AppState,
  type AttachmentMeta,
  type Countdown,
  type FilterCondition,
  type FocusSession,
  type Folder,
  type Habit,
  type HabitCheckin,
  type HabitFrequency,
  type Priority,
  type Project,
  type ProjectKind,
  type RecurrenceException,
  type RecurrenceEndType,
  type RecurrenceFreq,
  type RecurrenceMode,
  type RecurrenceRule,
  type RecurrenceSeries,
  type Reminder,
  type SavedFilter,
  type Tag,
  type Task,
  type TaskComment,
  type TaskPatch,
  type TaskTemplate,
} from '@dayline/core';
import type { SqliteRepository } from '@dayline/db';
import {
  buildRule,
  nextCompletionOccurrence,
  nextOccurrence,
} from '@dayline/recurrence';
import { CalendarView, type CalendarMode } from './components/CalendarView';
import { GlobalSearch } from './components/GlobalSearch';
import { QuickAdd, type QuickAddOptions } from './components/QuickAdd';
import { Sidebar } from './components/Sidebar';
import { TaskDetail } from './components/TaskDetail';
import { TaskList } from './components/TaskList';
import { KanbanView } from './components/KanbanView';
import { TimelineView } from './components/TimelineView';
import { MatrixView } from './components/MatrixView';
import { FocusView } from './components/FocusView';
import { HabitsView } from './components/HabitsView';
import { CountdownView } from './components/CountdownView';
import { StatsView } from './components/StatsView';
import { SummaryView } from './components/SummaryView';
import { AssistantDock, type AssistantSeed } from './components/AssistantDock';
import { TaskContextMenu } from './components/TaskContextMenu';
import { CollabDialog, InvitePrompt } from './components/CollabDialog';
import { useCollab } from './collab/useCollab';
import type { AiAction, AiApplyResult } from './ai/actions';
import { loadAiSettings, saveAiSettings, type AiSettings } from './ai/settings';
import { NoteView } from './components/NoteView';
import { TagManager } from './components/TagManager';
import { ProjectDialog } from './components/ProjectDialog';
import { FilterDialog } from './components/FilterDialog';
import { BackupDialog } from './components/BackupDialog';
import { TemplateDialog } from './components/TemplateDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { UserManager } from './components/UserManager';
import { NotificationCenter } from './components/NotificationCenter';
import { BatchBar } from './components/BatchBar';
import { openAppDatabase } from './db';
import { deleteWebDatabase } from './db/opfsDriver';
import {
  maybeAutoBackup,
  setBackupStorageKey,
  writeAutoBackup,
} from './backupStore';
import {
  deleteAttachmentFile,
  migrateDataUrlAttachment,
  saveAttachmentFile,
} from './attachments';
import {
  loadState,
  loadTheme,
  saveState,
  saveTheme,
  setStateStorageKey,
} from './store';
import {
  createUser,
  getActiveUserId,
  loadUsers,
  removeUserLocalData,
  saveUsers,
  setActiveUserId,
  type LocalUser,
} from './users';
import { viewTitle, type View } from './view';

const PROJECT_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'];

type ViewMode = 'list' | 'calendar' | 'kanban' | 'timeline' | 'matrix';

function minutesOfTime(value: string | null): number | null {
  if (!value) return null;
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(
    normalized % 60,
  ).padStart(2, '0')}`;
}

/** Moves a date/time pair by whole minutes, rolling over midnight as needed. */
function shiftDateTime(
  date: string,
  time: string,
  deltaMinutes: number,
): { date: string; time: string } {
  const total = (minutesOfTime(time) ?? 0) + deltaMinutes;
  const dayOffset = Math.floor(total / 1440);
  return {
    date: addDaysKey(date, dayOffset),
    time: timeFromMinutes(total),
  };
}

interface StorageInfo {
  storage: 'opfs' | 'memory' | 'tauri';
  sqliteVersion: string;
}

const TAURI_MIGRATION_KEY = 'dayline.tauri-migration.v1';

/**
 * Earlier desktop builds could not reach the native SQLite driver and saved to
 * localStorage instead. On the first launch with a working database, import
 * that fallback cache so tasks created in the meantime are not lost.
 */
async function migrateDesktopFallback(options: {
  repository: SqliteRepository;
  state: AppState;
  user: LocalUser;
}): Promise<AppState> {
  const { repository, state, user } = options;
  if (state.tasks.length > 0) return state;
  if (window.localStorage.getItem(TAURI_MIGRATION_KEY)) return state;

  const raw = window.localStorage.getItem(user.stateKey);
  if (!raw) {
    window.localStorage.setItem(TAURI_MIGRATION_KEY, '1');
    return state;
  }

  const cached = loadState(user.stateKey, state);
  if (cached.tasks.length === 0) {
    window.localStorage.setItem(TAURI_MIGRATION_KEY, '1');
    return state;
  }

  await repository.replaceAll({
    ...cached,
    profile: { ...state.profile, name: user.name },
  });
  window.localStorage.setItem(TAURI_MIGRATION_KEY, '1');
  return repository.loadState();
}

export default function App() {
  const [users, setUsers] = useState<LocalUser[]>(() => loadUsers());
  const [activeUserId, setActiveUserIdState] = useState<string>(() => {
    const initial = loadUsers();
    return getActiveUserId(initial);
  });
  const [userManagerOpen, setUserManagerOpen] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [repository, setRepository] = useState<SqliteRepository | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [view, setView] = useState<View>({ kind: 'smart', id: 'inbox' });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantSeed, setAssistantSeed] = useState<AssistantSeed | null>(null);
  const [collabOpen, setCollabOpen] = useState(false);
  const [taskMenu, setTaskMenu] = useState<{
    x: number;
    y: number;
    taskId: string;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week');
  const [calendarAnchor, setCalendarAnchor] = useState(() => todayKey());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => todayKey());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    reminderId?: string;
  } | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<AppState | null>(null);
  const repositoryRef = useRef<SqliteRepository | null>(null);
  const undoRef = useRef<AppState[]>([]);
  const redoRef = useRef<AppState[]>([]);
  const attachmentMigrationRef = useRef(false);

  const collab = useCollab({
    profileId: state?.profile.id ?? '',
    displayName:
      users.find((user) => user.id === activeUserId)?.name ?? '我',
    state,
    stateRef,
    repository,
    repositoryRef,
    commit,
    notify: (title, body) => setToast({ title, body }),
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    saveUsers(users);
    setActiveUserId(activeUserId);
  }, [users, activeUserId]);

  useEffect(() => {
    repositoryRef.current = repository;
  }, [repository]);

  useEffect(() => {
    if (!state || storageLoading) return;
    maybeAutoBackup(state);
  }, [state, storageLoading]);

  useEffect(() => {
    if (!historyTick) return;
    // historyTick only exists to refresh the undo/redo button state.
  }, [historyTick]);

  useEffect(() => {
    let cancelled = false;
    const activeUser = users.find((user) => user.id === activeUserId) ?? users[0];

    setStorageLoading(true);
    setStorageError(null);
    setState(null);
    setRepository(null);
    setStorageInfo(null);
    setSelectedTaskId(null);
    setSelectedIds(new Set());
    undoRef.current = [];
    redoRef.current = [];

    if (!activeUser) {
      setStorageLoading(false);
      setStorageError('没有可用用户');
      return;
    }

    setStateStorageKey(activeUser.stateKey);
    setBackupStorageKey(activeUser.backupKey);

    openAppDatabase({
      databaseName: activeUser.dbName,
      profileName: activeUser.name,
      demo: activeUser.demo,
    })
      .then(async (result) => {
        if (cancelled) {
          result.repository.close();
          return;
        }
        repositoryRef.current = result.repository;
        setRepository(result.repository);
        setStorageInfo({
          storage: result.storage,
          sqliteVersion: result.sqliteVersion,
        });
        // OPFS requires a secure context. When the app is opened over plain
        // HTTP from another device, keep the SQLite worker in memory for the
        // session but persist the state to localStorage so a refresh does not
        // lose data.
        const fallback = activeUser.demo
          ? createSeedState(Date.now(), activeUser.name)
          : createEmptyState(Date.now(), activeUser.name);
        let initialState =
          result.storage === 'memory'
            ? loadState(activeUser.stateKey, fallback)
            : result.state;
        if (result.storage === 'tauri') {
          try {
            initialState = await migrateDesktopFallback({
              repository: result.repository,
              state: initialState,
              user: activeUser,
            });
          } catch (error) {
            reportStorageError(error);
          }
          if (cancelled) return;
        }
        if (initialState.profile.name !== activeUser.name) {
          const profile = {
            ...initialState.profile,
            name: activeUser.name,
            updatedAt: Date.now(),
          };
          initialState = { ...initialState, profile };
          if (result.storage !== 'memory') {
            void result.repository.saveProfile(profile).catch(reportStorageError);
          }
        }
        stateRef.current = initialState;
        setState(initialState);
        setStorageLoading(false);
        void migrateLegacyAttachments(initialState, result.repository);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStorageError(error instanceof Error ? error.message : String(error));
        const fallback = activeUser.demo
          ? createSeedState(Date.now(), activeUser.name)
          : createEmptyState(Date.now(), activeUser.name);
        const nextState = loadState(activeUser.stateKey, fallback);
        stateRef.current = nextState;
        setState(nextState);
        setStorageLoading(false);
      });

    return () => {
      cancelled = true;
      repositoryRef.current?.close();
      repositoryRef.current = null;
    };
    // Reload only when the active user changes. The users array is a local
    // mirror; renaming a user is handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  useEffect(() => {
    if (!storageLoading && !repository && state) {
      saveState(state);
    }
  }, [state, repository, storageLoading]);

  useEffect(() => {
    if (!storageLoading && storageInfo?.storage === 'memory' && state) {
      saveState(state);
    }
  }, [state, storageInfo, storageLoading]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) void handleRedo();
        else void handleUndo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        void handleRedo();
        return;
      }

      if (!typing && !event.metaKey && !event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        quickAddRef.current?.focus();
      }

      if (event.key === 'Escape') {
        setSelectedTaskId(null);
        setSidebarOpen(false);
        setGlobalSearchOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (storageLoading) return;
    let cancelled = false;

    async function tick() {
      const current = stateRef.current;
      if (!current) return;
      const now = Date.now();
      const due: Array<{ reminder: Reminder; task: Task; triggerAt: number }> = [];

      for (const reminder of current.reminders) {
        if (reminder.ownerType !== 'task') continue;
        const task = current.tasks.find((item) => item.id === reminder.ownerId);
        if (!task || task.deletedAt !== null || task.status !== 'open') continue;
        const triggerAt =
          reminder.state === 'snoozed'
            ? reminder.snoozeUntil
            : reminder.state === 'pending'
              ? reminder.offsetMinutes !== null
                ? reminderTriggerAt(task, reminder.offsetMinutes)
                : reminder.triggerAt
              : null;
        if (triggerAt === null || triggerAt > now) continue;
        due.push({ reminder, task, triggerAt });
      }

      for (const item of due) {
        if (cancelled) return;
        const fired: Reminder = {
          ...item.reminder,
          triggerAt: item.triggerAt,
          state: 'fired',
          snoozeUntil: null,
          updatedAt: now,
        };

        if (repository) {
          try {
            await repository.saveReminder(fired);
          } catch (error) {
            reportStorageError(error);
          }
        }

        const latest = stateRef.current;
        if (latest) {
          const nextState: AppState = {
            ...latest,
            reminders: latest.reminders.map((reminder) =>
              reminder.id === fired.id ? fired : reminder,
            ),
          };
          if (!repository) saveState(nextState);
          stateRef.current = nextState;
          setState(nextState);
        }

        setToast({
          title: item.task.title,
          body: `提醒时间：${formatReminderTime(item.triggerAt)}`,
          reminderId: item.reminder.id,
        });

        if (notificationPermission === 'granted' && typeof Notification !== 'undefined') {
          try {
            const notification = new Notification('Dayline · 任务提醒', {
              body: item.task.title,
              tag: item.reminder.id,
            });
            notification.onclick = () => window.focus();
          } catch {
            // Notification may be blocked by the platform; the in-app toast
            // remains available.
          }
        }
      }
    }

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [storageLoading, notificationPermission, repository]);

  if (storageLoading || !state) {
    return (
      <div className="app-loading">
        <div className="brand-mark large">D</div>
        <strong>Dayline</strong>
        <p>正在打开本地数据库…</p>
      </div>
    );
  }

  const now = new Date();
  const inbox = findInboxProject(state.projects);
  const counts = countTasks(state.tasks, inbox?.id, now);
  const tasks = queryTasks(state.tasks, {
    smartView: view.kind === 'smart' ? view.id : undefined,
    projectId: view.kind === 'project' ? view.id : undefined,
    tagId: view.kind === 'tag' ? view.id : undefined,
    inboxProjectId: inbox?.id,
    search,
    now,
  });
  const activeFilter =
    view.kind === 'filter'
      ? state.filters.find((filter) => filter.id === view.id && filter.deletedAt === null) ?? null
      : null;
  const displayTasks = activeFilter
    ? sortTasks(
        state.tasks.filter(
          (task) =>
            task.deletedAt === null &&
            task.parentId === null &&
            matchesFilter(task, activeFilter, {
              projects: state.projects,
              tags: state.tags,
              now,
            }) &&
            (!search ||
              `${task.title}\n${task.contentMd}`.toLowerCase().includes(search.toLowerCase())),
        ),
      )
    : tasks;
  const boardTasks =
    view.kind === 'smart'
      ? sortTasks(
          state.tasks.filter(
            (task) =>
              task.deletedAt === null &&
              task.parentId === null &&
              task.status !== 'skipped',
          ),
        )
      : displayTasks;
  const selectedTask = selectedTaskId
    ? state.tasks.find((task) => task.id === selectedTaskId) ?? null
    : null;
  const selectedReminders = selectedTask
    ? state.reminders.filter(
        (reminder) =>
          reminder.ownerType === 'task' &&
          reminder.ownerId === selectedTask.id &&
          (reminder.state === 'pending' ||
            reminder.state === 'fired' ||
            reminder.state === 'snoozed'),
      )
    : [];
  const selectedComments = selectedTask
    ? state.comments.filter(
        (comment) => comment.taskId === selectedTask.id && comment.deletedAt === null,
      )
    : [];
  const selectedAttachments = selectedTask
    ? state.attachments.filter(
        (attachment) =>
          attachment.ownerId === selectedTask.id && attachment.deletedAt === null,
      )
    : [];
  const selectedOverride =
    selectedTask?.seriesId && selectedTask.occurrenceDate
      ? state.recurrenceExceptions.find(
          (exception) =>
            exception.seriesId === selectedTask.seriesId &&
            exception.occurrenceDate === selectedTask.occurrenceDate &&
            exception.action === 'override',
        ) ?? null
      : null;
  const selectedSubtasks = selectedTask
    ? state.tasks.filter(
        (task) =>
          task.parentId === selectedTask.id && task.deletedAt === null,
      )
    : [];
  const activeProject =
    view.kind === 'project'
      ? state.projects.find((project) => project.id === view.id) ?? null
      : null;
  const activeUser = users.find((user) => user.id === activeUserId) ?? users[0] ?? null;
  const quickAddProject =
    activeProject ?? inbox ?? state.projects.find((project) => project.deletedAt === null);
  const title =
    view.kind === 'filter'
      ? activeFilter?.name ?? '过滤器'
      : viewMode === 'calendar'
        ? '日历'
        : viewTitle(view, state.projects, state.tags);
  const noteProject =
    view.kind === 'project'
      ? state.projects.find((project) => project.id === view.id && project.kind === 'note') ?? null
      : null;
  const isModuleView = view.kind === 'module';
  const showTaskChrome = !isModuleView && !noteProject;
  const subtitle =
    view.kind === 'module'
      ? {
          summary: '回顾最近的完成、专注与打卡节奏',
          focus: '用番茄钟或正计时记录专注',
          habits: '连续打卡，建立稳定的日常',
          countdowns: '生日、纪念日与重要倒数日',
          stats: '任务趋势、分布与成就',
        }[view.id]
      : noteProject
        ? 'Markdown 笔记，自动保存到本机'
        : view.kind === 'filter'
          ? '由保存的条件实时筛选'
          : viewMode === 'calendar'
            ? '按日期查看和安排任务'
            : viewMode === 'kanban'
              ? '拖动卡片改变清单、优先级或状态'
              : viewMode === 'timeline'
                ? '横向查看一段时间内的任务安排'
                : viewMode === 'matrix'
                  ? '按重要与紧急四象限处理任务'
                  : view.kind === 'smart' && view.id === 'today'
                    ? '按计划推进今天的事'
                    : view.kind === 'smart' && view.id === 'trash'
                      ? '删除的任务会保留在这里'
                      : search
                        ? `搜索“${search}”`
                        : '保持清单轻量，专注下一步';
  const storageLabel = storageInfo
    ? `SQLite ${storageInfo.sqliteVersion} · ${
        storageInfo.storage === 'opfs'
          ? 'OPFS'
          : storageInfo.storage === 'tauri'
            ? '桌面 SQLite'
            : '内存 + localStorage'
      }`
    : storageError
      ? '本地缓存（回退）'
      : '正在连接…';
  const storageBanner = storageError
    ? storageInfo
      ? `本地数据库写入失败：${storageError}`
      : `SQLite 不可用，已回退到本地缓存：${storageError}`
    : storageInfo?.storage === 'memory'
      ? 'OPFS 需要 HTTPS 或 localhost。当前通过 HTTP 访问，已回退到浏览器 localStorage：数据会保留在本机，但容量有限（约 5–10 MB）。'
      : null;

  function reportStorageError(error: unknown) {
    setStorageError(error instanceof Error ? error.message : String(error));
  }

  function commit(nextState: AppState) {
    const previous = stateRef.current;
    if (previous && previous !== nextState) {
      undoRef.current.push(previous);
      if (undoRef.current.length > 40) undoRef.current.shift();
      redoRef.current = [];
      setHistoryTick((value) => value + 1);
    }
    stateRef.current = nextState;
    setState(nextState);
  }

  async function applySnapshot(snapshot: AppState) {
    if (repositoryRef.current) {
      try {
        await repositoryRef.current.replaceAll(snapshot);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    stateRef.current = snapshot;
    setState(snapshot);
    if (!repositoryRef.current) saveState(snapshot);
    setSelectedTaskId(null);
  }

  async function handleUndo() {
    if (undoRef.current.length === 0) {
      setToast({ title: '没有可撤销的操作', body: '继续编辑后再试试。' });
      return;
    }
    const current = stateRef.current;
    const previous = undoRef.current.pop();
    if (!previous || !current) return;
    redoRef.current.push(current);
    await applySnapshot(previous);
    setHistoryTick((value) => value + 1);
    setToast({ title: '已撤销', body: 'Ctrl+Shift+Z 可重做。' });
  }

  async function handleRedo() {
    if (redoRef.current.length === 0) {
      setToast({ title: '没有可重做的操作', body: '撤销后才能重做。' });
      return;
    }
    const current = stateRef.current;
    const next = redoRef.current.pop();
    if (!next || !current) return;
    undoRef.current.push(current);
    await applySnapshot(next);
    setHistoryTick((value) => value + 1);
    setToast({ title: '已重做', body: 'Ctrl+Z 可继续撤销。' });
  }

  async function applyTask(taskId: string, updater: (current: Task) => Task) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const currentTask = currentState.tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const nextTask = updater(currentTask);
    if (repository) {
      try {
        // Commit locally first, then update React state. If the user reloads
        // after seeing the change, the SQLite transaction is already durable.
        await repository.saveTask(nextTask);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latestState = stateRef.current ?? currentState;
    let reminders = latestState.reminders;
    const pendingReminder = latestState.reminders.find(
      (reminder) =>
        reminder.ownerType === 'task' &&
        reminder.ownerId === nextTask.id &&
        reminder.state === 'pending',
    );

    if (nextTask.status !== 'open' || nextTask.deletedAt !== null) {
      const stale = latestState.reminders.filter(
        (reminder) =>
          reminder.ownerType === 'task' &&
          reminder.ownerId === nextTask.id &&
          (reminder.state === 'pending' || reminder.state === 'snoozed'),
      );
      if (stale.length > 0) {
        if (repository) {
          try {
            for (const reminder of stale) {
              await repository.deleteReminder(reminder.id);
            }
          } catch (error) {
            reportStorageError(error);
          }
        }
        const staleIds = new Set(stale.map((reminder) => reminder.id));
        reminders = reminders.filter((reminder) => !staleIds.has(reminder.id));
      }
    } else if (pendingReminder) {
      if (nextTask.startDate === null) {
        if (repository) {
          try {
            await repository.deleteReminder(pendingReminder.id);
          } catch (error) {
            reportStorageError(error);
          }
        }
        reminders = reminders.filter((reminder) => reminder.id !== pendingReminder.id);
      } else if (pendingReminder.offsetMinutes !== null) {
        const triggerAt = reminderTriggerAt(nextTask, pendingReminder.offsetMinutes);
        if (triggerAt !== null && triggerAt !== pendingReminder.triggerAt) {
          const updatedReminder: Reminder = {
            ...pendingReminder,
            triggerAt,
            updatedAt: Date.now(),
          };
          if (repository) {
            try {
              await repository.saveReminder(updatedReminder);
            } catch (error) {
              reportStorageError(error);
            }
          }
          reminders = reminders.map((reminder) =>
            reminder.id === updatedReminder.id ? updatedReminder : reminder,
          );
        }
      }
    }

    const nextState: AppState = {
      ...latestState,
      tasks: latestState.tasks.map((task) =>
        task.id === nextTask.id ? nextTask : task,
      ),
      reminders,
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function completeRecurring(task: Task) {
    const currentState = stateRef.current;
    if (!currentState || !task.seriesId) return;
    const series = currentState.recurrenceSeries.find((item) => item.id === task.seriesId);
    if (!series) {
      await applyTask(task.id, (current) => completeTask(current));
      return;
    }

    const now = Date.now();
    const completed = completeTask(task, now);
    // If this occurrence was moved via an override, advance from the later of
    // its series date and displayed date to avoid creating a same-day duplicate.
    const anchorDate =
      [task.occurrenceDate, task.startDate]
        .filter((date): date is string => Boolean(date))
        .sort()
        .at(-1) ?? todayKey();
    const next =
      series.mode === 'completion'
        ? nextCompletionOccurrence(series, todayKey(), {
            afterIndex: task.occurrenceIndex ?? -1,
            isWorkday: isStatutoryWorkday,
            isHoliday: isStatutoryHoliday,
          })
        : nextOccurrence(series, anchorDate, {
            notBefore: todayKey(),
            isWorkday: isStatutoryWorkday,
            isHoliday: isStatutoryHoliday,
          });

    const existingNext = next
      ? currentState.tasks.find(
          (item) =>
            item.seriesId === series.id &&
            item.occurrenceDate === next.occurrenceDate &&
            item.deletedAt === null,
        )
      : undefined;
    const nextTask =
      next && !existingNext
        ? createNextOccurrenceTask(task, next.occurrenceDate, next.occurrenceIndex, {
            now,
          })
        : null;
    const updatedSeries: RecurrenceSeries = {
      ...series,
      completedCount: series.completedCount + 1,
      status: next ? 'active' : 'ended',
      updatedAt: now,
    };

    const sourceReminder = currentState.reminders.find(
      (reminder) =>
        reminder.ownerType === 'task' &&
        reminder.ownerId === task.id &&
        reminder.state === 'pending',
    );
    const staleReminders = currentState.reminders.filter(
      (reminder) =>
        reminder.ownerType === 'task' &&
        reminder.ownerId === task.id &&
        (reminder.state === 'pending' || reminder.state === 'snoozed' || reminder.state === 'fired'),
    );
    const nextReminder: Reminder | null =
      sourceReminder && nextTask && sourceReminder.offsetMinutes !== null
        ? {
            id: generateId(),
            profileId: sourceReminder.profileId,
            ownerType: 'task',
            ownerId: nextTask.id,
            kind: sourceReminder.kind,
            triggerAt:
              reminderTriggerAt(nextTask, sourceReminder.offsetMinutes) ??
              sourceReminder.triggerAt,
            offsetMinutes: sourceReminder.offsetMinutes,
            persistent: sourceReminder.persistent,
            state: 'pending',
            snoozeUntil: null,
            createdAt: now,
            updatedAt: now,
          }
        : null;

    if (repository) {
      try {
        await repository.saveTask(completed);
        for (const stale of staleReminders) {
          await repository.deleteReminder(stale.id);
        }
        if (nextTask) await repository.saveTask(nextTask);
        if (nextReminder) await repository.saveReminder(nextReminder);
        await repository.saveSeries(updatedSeries);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const tasks = latest.tasks.map((item) => (item.id === task.id ? completed : item));
    if (nextTask) tasks.push(nextTask);
    const staleIds = new Set(staleReminders.map((reminder) => reminder.id));
    const nextState: AppState = {
      ...latest,
      tasks,
      reminders: [
        ...latest.reminders.filter((reminder) => !staleIds.has(reminder.id)),
        ...(nextReminder ? [nextReminder] : []),
      ],
      recurrenceSeries: latest.recurrenceSeries.map((item) =>
        item.id === updatedSeries.id ? updatedSeries : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    if (nextTask) setSelectedTaskId(nextTask.id);
  }

  async function uncompleteRecurring(task: Task) {
    const currentState = stateRef.current;
    if (!currentState || !task.seriesId) return;
    const series = currentState.recurrenceSeries.find((item) => item.id === task.seriesId);
    if (!series) {
      await applyTask(task.id, (current) => uncompleteTask(current));
      return;
    }

    const now = Date.now();
    const reopened = uncompleteTask(task, now);
    const nextTask = currentState.tasks
      .filter(
        (item) =>
          item.seriesId === series.id &&
          item.id !== task.id &&
          item.deletedAt === null &&
          item.status === 'open' &&
          item.occurrenceDate !== null &&
          task.occurrenceDate !== null &&
          item.occurrenceDate > task.occurrenceDate,
      )
      .sort((a, b) => (a.occurrenceDate ?? '').localeCompare(b.occurrenceDate ?? ''))[0];
    const trashedNext = nextTask ? trashTask(nextTask, now) : null;
    const nextReminder = trashedNext
      ? currentState.reminders.find(
          (reminder) =>
            reminder.ownerType === 'task' &&
            reminder.ownerId === trashedNext.id &&
            reminder.state === 'pending',
        ) ?? null
      : null;
    const updatedSeries: RecurrenceSeries = {
      ...series,
      completedCount: Math.max(0, series.completedCount - 1),
      status: 'active',
      updatedAt: now,
    };

    if (repository) {
      try {
        await repository.saveTask(reopened);
        if (trashedNext) await repository.saveTask(trashedNext);
        if (nextReminder) await repository.deleteReminder(nextReminder.id);
        await repository.saveSeries(updatedSeries);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const tasks = latest.tasks.map((item) => {
      if (item.id === task.id) return reopened;
      if (trashedNext && item.id === trashedNext.id) return trashedNext;
      return item;
    });
    const nextState: AppState = {
      ...latest,
      tasks,
      reminders: nextReminder
        ? latest.reminders.filter((reminder) => reminder.id !== nextReminder.id)
        : latest.reminders,
      recurrenceSeries: latest.recurrenceSeries.map((item) =>
        item.id === updatedSeries.id ? updatedSeries : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  function handleToggle(task: Task) {
    if (task.seriesId) {
      if (task.status === 'completed') {
        void uncompleteRecurring(task);
      } else {
        void completeRecurring(task);
      }
      return;
    }
    void applyTask(task.id, (current) => toggleTaskCompletion(current));
  }

  async function changeRecurrence(task: Task, freq: RecurrenceFreq | null) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const existing = task.seriesId
      ? currentState.recurrenceSeries.find((item) => item.id === task.seriesId) ?? null
      : null;

    if (!freq) {
      const nextTask: Task = {
        ...task,
        seriesId: null,
        occurrenceDate: null,
        occurrenceIndex: null,
        updatedAt: now,
      };
      const updatedSeries = existing
        ? { ...existing, status: 'ended' as const, updatedAt: now }
        : null;
      const futureTasks = existing
        ? currentState.tasks
            .filter(
              (item) =>
                item.seriesId === existing.id &&
                item.id !== task.id &&
                item.deletedAt === null &&
                item.occurrenceDate !== null &&
                task.occurrenceDate !== null &&
                item.occurrenceDate > task.occurrenceDate,
            )
            .map((item) => trashTask(item, now))
        : [];

      if (repository) {
        try {
          await repository.saveTask(nextTask);
          for (const item of futureTasks) await repository.saveTask(item);
          if (updatedSeries) await repository.saveSeries(updatedSeries);
        } catch (error) {
          reportStorageError(error);
          return;
        }
      }

      const latest = stateRef.current ?? currentState;
      const replaced = new Map(futureTasks.map((item) => [item.id, item]));
      const nextState: AppState = {
        ...latest,
        tasks: latest.tasks.map((item) => {
          if (item.id === nextTask.id) return nextTask;
          return replaced.get(item.id) ?? item;
        }),
        recurrenceSeries: updatedSeries
          ? latest.recurrenceSeries.map((item) =>
              item.id === updatedSeries.id ? updatedSeries : item,
            )
          : latest.recurrenceSeries,
      };
      if (!repository) saveState(nextState);
      commit(nextState);
      return;
    }

    const startDate = task.startDate ?? todayKey();
    const startWeekday = parseLocalDateKey(startDate).getDay() || 7;
    const startDay = parseLocalDateKey(startDate).getDate();
    const rule = buildRule(freq, {
      ...(freq === 'weekly' ? { byWeekday: [startWeekday] } : {}),
      ...(freq === 'monthly' ? { byMonthDay: [startDay] } : {}),
    });
    const series: RecurrenceSeries = existing
      ? {
          ...existing,
          rule,
          status: 'active',
          dtstartTime: task.startTime,
          updatedAt: now,
        }
      : {
          id: generateId(),
          profileId: currentState.profile.id,
          templateTaskId: task.id,
          mode: 'due',
          rule,
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          dtstartDate: startDate,
          dtstartTime: task.startTime,
          endType: 'never',
          endDate: null,
          endCount: null,
          completedCount: 0,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
    const nextTask: Task = {
      ...task,
      startDate,
      allDay: task.startTime === null,
      seriesId: series.id,
      occurrenceDate: task.occurrenceDate ?? startDate,
      occurrenceIndex: task.occurrenceIndex ?? 0,
      updatedAt: now,
    };

    if (repository) {
      try {
        await repository.saveSeries(series);
        await repository.saveTask(nextTask);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const nextState: AppState = {
      ...latest,
      tasks: latest.tasks.map((item) => (item.id === nextTask.id ? nextTask : item)),
      recurrenceSeries: existing
        ? latest.recurrenceSeries.map((item) =>
            item.id === series.id ? series : item,
          )
        : [...latest.recurrenceSeries, series],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  function handleSetRecurrence(freq: RecurrenceFreq | null) {
    if (!selectedTask) return;
    void changeRecurrence(selectedTask, freq);
  }

  async function handleUpdateRecurrence(patch: {
    rule?: Partial<RecurrenceRule>;
    mode?: RecurrenceMode;
    endType?: RecurrenceEndType;
    endDate?: string | null;
    endCount?: number | null;
  }) {
    const currentState = stateRef.current;
    if (!currentState || !selectedTask?.seriesId) return;
    const series = currentState.recurrenceSeries.find(
      (item) => item.id === selectedTask.seriesId,
    );
    if (!series) return;
    const nextSeries: RecurrenceSeries = {
      ...series,
      rule: { ...series.rule, ...patch.rule },
      mode: patch.mode ?? series.mode,
      endType: patch.endType ?? series.endType,
      endDate: patch.endDate !== undefined ? patch.endDate : series.endDate,
      endCount: patch.endCount !== undefined ? patch.endCount : series.endCount,
      status: 'active',
      updatedAt: Date.now(),
    };
    if (repository) {
      try {
        await repository.saveSeries(nextSeries);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      recurrenceSeries: currentState.recurrenceSeries.map((item) =>
        item.id === nextSeries.id ? nextSeries : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleCheckHealth() {
    const repo = repositoryRef.current;
    if (!repo) {
      return {
        ok: false,
        messages: ['当前未连接 SQLite，正在使用 localStorage 回退。'],
      };
    }
    return repo.quickCheck();
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      setNotificationPermission('denied');
    }
  }

  function shiftCalendar(delta: number) {
    if (calendarMode === 'day') {
      setCalendarAnchor((current) => addDaysKey(current, delta));
      return;
    }
    if (calendarMode === 'threeDay') {
      setCalendarAnchor((current) => addDaysKey(current, delta * 3));
      return;
    }
    if (calendarMode === 'week') {
      setCalendarAnchor((current) => addDaysKey(current, delta * 7));
      return;
    }
    if (calendarMode === 'schedule' || calendarMode === 'twoWeek') {
      setCalendarAnchor((current) => addDaysKey(current, delta * 14));
      return;
    }
    setCalendarAnchor((current) => {
      const parsed = parseLocalDateKey(current);
      const target =
        calendarMode === 'year'
          ? new Date(parsed.getFullYear() + delta, parsed.getMonth(), 1)
          : new Date(parsed.getFullYear(), parsed.getMonth() + delta, 1);
      return localDateKey(target);
    });
  }

  function handleCalendarToday() {
    const today = todayKey();
    setCalendarAnchor(today);
    setSelectedCalendarDate(today);
  }

  function handleNavigateDate(date: string) {
    setCalendarAnchor(date);
    setSelectedCalendarDate(date);
  }

  async function handlePreferencesChange(next: AppPreferences) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const normalized = normalizePreferences(next);
    if (repository) {
      try {
        await repository.savePreferences(currentState.profile.id, normalized);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = { ...currentState, preferences: normalized };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  function handleResizeTask(taskId: string, date: string, endTime: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const task = currentState.tasks.find((item) => item.id === taskId);
    if (!task || task.deletedAt !== null || !task.startTime) return;
    const patch: TaskPatch = {
      endTime,
      ...(task.endDate !== null ? { endDate: date } : {}),
    };
    if (task.seriesId) {
      void overrideOccurrence(task, patch);
      return;
    }
    void applyTask(task.id, (current) => updateTask(current, patch));
  }

  function handleResizeTaskStart(taskId: string, _date: string, startTime: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const task = currentState.tasks.find((item) => item.id === taskId);
    if (!task || task.deletedAt !== null) return;
    if (task.seriesId) {
      void overrideOccurrence(task, { startTime });
      return;
    }
    void applyTask(task.id, (current) => updateTask(current, { startTime }));
  }

  function handleMoveTask(taskId: string, date: string, time?: string | null) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const task = currentState.tasks.find((item) => item.id === taskId);
    if (!task || task.deletedAt !== null) return;

    const dayDelta = task.startDate ? daysBetween(task.startDate, date) : 0;
    const patch: TaskPatch = { startDate: date };

    if (time === undefined) {
      // Date-only move (month/all-day/timeline): keep the clock times and the
      // number of days untouched.
      if (task.endDate) {
        patch.endDate = addDaysKey(task.endDate, dayDelta);
      }
    } else if (time === null) {
      // Dropping onto the all-day row intentionally removes the clock time.
      patch.startTime = null;
      patch.endTime = null;
      patch.endDate = task.endDate ? addDaysKey(task.endDate, dayDelta) : null;
    } else {
      patch.startTime = time;
      if (task.endTime) {
        const oldStartMinutes = minutesOfTime(task.startTime);
        const newStartMinutes = minutesOfTime(time) ?? 0;
        const deltaMinutes =
          dayDelta * 1440 +
          (oldStartMinutes === null ? 0 : newStartMinutes - oldStartMinutes);
        const oldEndDate = task.endDate ?? task.startDate ?? date;
        const shiftedEnd = shiftDateTime(oldEndDate, task.endTime, deltaMinutes);
        patch.endTime = shiftedEnd.time;
        patch.endDate = shiftedEnd.date > date ? shiftedEnd.date : null;
      } else if (task.endDate) {
        patch.endDate = addDaysKey(task.endDate, dayDelta);
      }
    }

    if (task.seriesId) {
      void overrideOccurrence(task, patch);
      return;
    }
    void applyTask(task.id, (current) => updateTask(current, patch));
  }

  async function restoreSkipped(task: Task) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const series = task.seriesId
      ? currentState.recurrenceSeries.find((item) => item.id === task.seriesId) ?? null
      : null;

    const earlierOpen = task.seriesId
      ? currentState.tasks.find(
          (item) =>
            item.id !== task.id &&
            item.seriesId === task.seriesId &&
            item.status === 'open' &&
            item.deletedAt === null &&
            item.occurrenceDate !== null &&
            task.occurrenceDate !== null &&
            item.occurrenceDate < task.occurrenceDate,
        )
      : null;
    if (earlierOpen) {
      setToast({
        title: '无法恢复此周期',
        body: '系列中已有更早的未完成周期，请先完成或跳过它。',
      });
      return;
    }

    const laterOpen = task.seriesId
      ? currentState.tasks.filter(
          (item) =>
            item.id !== task.id &&
            item.seriesId === task.seriesId &&
            item.status === 'open' &&
            item.deletedAt === null &&
            item.occurrenceDate !== null &&
            task.occurrenceDate !== null &&
            item.occurrenceDate > task.occurrenceDate,
        )
      : [];

    const restored: Task = {
      ...task,
      status: 'open',
      startDate: task.occurrenceDate ?? task.startDate,
      startTime: series?.dtstartTime ?? task.startTime,
      endDate: null,
      endTime: null,
      allDay: (series?.dtstartTime ?? task.startTime) === null,
      updatedAt: now,
    };
    const skipException =
      task.seriesId && task.occurrenceDate
        ? currentState.recurrenceExceptions.find(
            (exception) =>
              exception.seriesId === task.seriesId &&
              exception.occurrenceDate === task.occurrenceDate &&
              exception.action === 'skip',
          ) ?? null
        : null;
    const updatedSeries: RecurrenceSeries | null = series
      ? { ...series, status: 'active', updatedAt: now }
      : null;

    const laterSkips = laterOpen.map((item) => {
      const existing = currentState.recurrenceExceptions.find(
        (exception) =>
          exception.seriesId === item.seriesId &&
          exception.occurrenceDate === item.occurrenceDate,
      );
      const exception: RecurrenceException = existing
        ? { ...existing, action: 'skip', override: { skip: true, merged: true }, updatedAt: now }
        : {
            id: generateId(),
            seriesId: item.seriesId ?? '',
            occurrenceDate: item.occurrenceDate ?? '',
            action: 'skip',
            override: { skip: true, merged: true },
            createdAt: now,
            updatedAt: now,
          };
      return {
        task: { ...item, status: 'skipped' as const, updatedAt: now },
        exception,
      };
    });

    if (repository) {
      try {
        await repository.saveTask(restored);
        if (skipException && task.seriesId) {
          await repository.deleteException(task.seriesId, skipException.occurrenceDate);
        }
        for (const item of laterSkips) {
          await repository.saveTask(item.task);
          await repository.saveException(item.exception);
        }
        if (updatedSeries) await repository.saveSeries(updatedSeries);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const skippedById = new Map(laterSkips.map((item) => [item.task.id, item.task]));
    const laterExceptions = new Map(
      laterSkips.map((item) => [item.exception.id, item.exception]),
    );
    const nextState: AppState = {
      ...latest,
      tasks: latest.tasks.map((item) => {
        if (item.id === restored.id) return restored;
        return skippedById.get(item.id) ?? item;
      }),
      recurrenceExceptions: [
        ...latest.recurrenceExceptions
          .filter((exception) => exception.id !== skipException?.id)
          .map((exception) => laterExceptions.get(exception.id) ?? exception),
        ...laterSkips
          .filter(
            (item) =>
              !latest.recurrenceExceptions.some(
                (exception) => exception.id === item.exception.id,
              ),
          )
          .map((item) => item.exception),
      ],
      recurrenceSeries: updatedSeries
        ? latest.recurrenceSeries.map((item) =>
            item.id === updatedSeries.id ? updatedSeries : item,
          )
        : latest.recurrenceSeries,
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setToast({
      title: '已恢复此周期',
      body:
        laterSkips.length > 0
          ? `${task.title} · 已把 ${laterSkips.length} 个后续未完成周期转入“已跳过”`
          : task.title,
    });
  }

  function handleTrash(task: Task) {
    void applyTask(task.id, (current) => trashTask(current));
  }

  function handleRestore(task: Task) {
    if (task.deletedAt !== null) {
      void applyTask(task.id, (current) => restoreTask(current));
      return;
    }
    if (task.status === 'skipped') {
      void restoreSkipped(task);
      return;
    }
    void applyTask(task.id, (current) => restoreTask(current));
  }

  async function overrideOccurrence(task: Task, patch: TaskPatch) {
    const currentState = stateRef.current;
    if (!currentState || !task.seriesId || !task.occurrenceDate) return;

    const nextTask = updateTask(task, patch);
    const existing = currentState.recurrenceExceptions.find(
      (exception) =>
        exception.seriesId === task.seriesId &&
        exception.occurrenceDate === task.occurrenceDate,
    );
    const now = Date.now();
    const exception: RecurrenceException = existing
      ? {
          ...existing,
          action: 'override',
          override: { ...(existing.override ?? {}), ...patch },
          updatedAt: now,
        }
      : {
          id: generateId(),
          seriesId: task.seriesId,
          occurrenceDate: task.occurrenceDate,
          action: 'override',
          override: { ...patch },
          createdAt: now,
          updatedAt: now,
        };

    if (repository) {
      try {
        await repository.saveTask(nextTask);
        await repository.saveException(exception);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const nextState: AppState = {
      ...latest,
      tasks: latest.tasks.map((item) =>
        item.id === nextTask.id ? nextTask : item,
      ),
      recurrenceExceptions: existing
        ? latest.recurrenceExceptions.map((item) =>
            item.id === exception.id ? exception : item,
          )
        : [...latest.recurrenceExceptions, exception],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function skipOccurrence(task: Task) {
    const currentState = stateRef.current;
    if (!currentState || !task.seriesId) return;
    const series = currentState.recurrenceSeries.find((item) => item.id === task.seriesId);
    if (!series) return;

    const now = Date.now();
    const anchorDate =
      [task.occurrenceDate, task.startDate]
        .filter((date): date is string => Boolean(date))
        .sort()
        .at(-1) ?? todayKey();
    const next =
      series.mode === 'completion'
        ? nextCompletionOccurrence(series, todayKey(), {
            afterIndex: task.occurrenceIndex ?? -1,
            isWorkday: isStatutoryWorkday,
            isHoliday: isStatutoryHoliday,
          })
        : nextOccurrence(series, anchorDate, {
            notBefore: todayKey(),
            isWorkday: isStatutoryWorkday,
            isHoliday: isStatutoryHoliday,
          });
    const existingNext = next
      ? currentState.tasks.find(
          (item) =>
            item.seriesId === series.id &&
            item.occurrenceDate === next.occurrenceDate &&
            item.deletedAt === null,
        )
      : undefined;
    const nextTask =
      next && !existingNext
        ? createNextOccurrenceTask(task, next.occurrenceDate, next.occurrenceIndex, {
            now,
          })
        : null;
    const skipped: Task = { ...task, status: 'skipped', updatedAt: now };
    const existing = currentState.recurrenceExceptions.find(
      (exception) =>
        exception.seriesId === series.id &&
        exception.occurrenceDate === task.occurrenceDate,
    );
    const exception: RecurrenceException = existing
      ? {
          ...existing,
          action: 'skip',
          override: { skip: true },
          updatedAt: now,
        }
      : {
          id: generateId(),
          seriesId: series.id,
          occurrenceDate: task.occurrenceDate ?? anchorDate,
          action: 'skip',
          override: { skip: true },
          createdAt: now,
          updatedAt: now,
        };
    const updatedSeries: RecurrenceSeries = {
      ...series,
      status: next ? 'active' : 'ended',
      updatedAt: now,
    };

    if (repository) {
      try {
        await repository.saveTask(skipped);
        await repository.saveException(exception);
        if (nextTask) await repository.saveTask(nextTask);
        await repository.saveSeries(updatedSeries);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const tasks = latest.tasks.map((item) => (item.id === task.id ? skipped : item));
    if (nextTask) tasks.push(nextTask);
    const nextState: AppState = {
      ...latest,
      tasks,
      recurrenceExceptions: existing
        ? latest.recurrenceExceptions.map((item) =>
            item.id === exception.id ? exception : item,
          )
        : [...latest.recurrenceExceptions, exception],
      recurrenceSeries: latest.recurrenceSeries.map((item) =>
        item.id === updatedSeries.id ? updatedSeries : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setToast({ title: '已跳过当前周期', body: task.title });
    setSelectedTaskId(nextTask?.id ?? null);
  }

  async function restoreOccurrence(task: Task) {
    const currentState = stateRef.current;
    if (!currentState || !task.seriesId || !task.occurrenceDate) return;
    const series = currentState.recurrenceSeries.find((item) => item.id === task.seriesId);
    if (!series) return;
    const exception = currentState.recurrenceExceptions.find(
      (item) =>
        item.seriesId === task.seriesId &&
        item.occurrenceDate === task.occurrenceDate &&
        item.action === 'override',
    );
    if (!exception) return;

    const now = Date.now();
    const restored: Task = {
      ...task,
      startDate: task.occurrenceDate,
      startTime: series.dtstartTime,
      endDate: null,
      endTime: null,
      allDay: series.dtstartTime === null,
      updatedAt: now,
    };

    if (repository) {
      try {
        await repository.saveTask(restored);
        await repository.deleteException(task.seriesId, task.occurrenceDate);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const nextState: AppState = {
      ...latest,
      tasks: latest.tasks.map((item) =>
        item.id === restored.id ? restored : item,
      ),
      recurrenceExceptions: latest.recurrenceExceptions.filter(
        (item) => item.id !== exception.id,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setToast({ title: '已恢复系列时间', body: task.title });
  }

  function handleUpdate(task: Task, patch: TaskPatch) {
    if (
      task.seriesId &&
      (patch.startDate !== undefined ||
        patch.startTime !== undefined ||
        patch.endTime !== undefined)
    ) {
      void overrideOccurrence(task, patch);
      return;
    }
    void applyTask(task.id, (current) => updateTask(current, patch));
  }

  function handleAbandon(task: Task) {
    void applyTask(task.id, (current) => abandonTask(current));
  }

  function handleRestart(task: Task) {
    void applyTask(task.id, (current) => restartTask(current));
  }

  async function handleDuplicateTask() {
    const currentState = stateRef.current;
    if (!currentState || !selectedTask) return;
    const copy = duplicateTask(selectedTask);

    if (repository) {
      try {
        await repository.saveTask(copy);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const nextState: AppState = {
      ...latest,
      tasks: [...latest.tasks, copy],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setSelectedTaskId(copy.id);
  }

  async function handleAddTag(name: string, color: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    if (currentState.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
      setToast({ title: '标签已存在', body: name });
      return;
    }
    const tag: Tag = {
      id: generateId(),
      profileId: currentState.profile.id,
      name,
      color,
    };
    if (repository) {
      try {
        await repository.saveTag(tag);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = { ...currentState, tags: [...currentState.tags, tag] };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleUpdateTag(tag: Tag, patch: { name?: string; color?: string }) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const nextName = patch.name ?? tag.name;
    if (
      currentState.tags.some(
        (item) => item.id !== tag.id && item.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      setToast({ title: '标签已存在', body: nextName });
      return;
    }
    const nextTag: Tag = { ...tag, ...patch };
    if (repository) {
      try {
        await repository.saveTag(nextTag);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      tags: currentState.tags.map((item) => (item.id === tag.id ? nextTag : item)),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteTag(tag: Tag) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const affectedFilters = currentState.filters
      .filter((filter) => filter.conditions.some((condition) => condition.field === 'tag' && condition.value === tag.id))
      .map((filter) => ({
        ...filter,
        conditions: filter.conditions.filter(
          (condition) => !(condition.field === 'tag' && condition.value === tag.id),
        ),
        updatedAt: Date.now(),
      }));
    if (repository) {
      try {
        await repository.deleteTag(tag.id);
        for (const filter of affectedFilters) await repository.saveFilter(filter);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const filterMap = new Map(affectedFilters.map((filter) => [filter.id, filter]));
    const nextState: AppState = {
      ...currentState,
      tags: currentState.tags.filter((item) => item.id !== tag.id),
      tasks: currentState.tasks.map((task) =>
        task.tagIds.includes(tag.id)
          ? { ...task, tagIds: task.tagIds.filter((id) => id !== tag.id) }
          : task,
      ),
      filters: currentState.filters.map((filter) => filterMap.get(filter.id) ?? filter),
    };
    if (view.kind === 'tag' && view.id === tag.id) {
      setView({ kind: 'smart', id: 'all' });
    }
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleAddFolder(name: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const folder: Folder = {
      id: generateId(),
      profileId: currentState.profile.id,
      name,
      sortKey: `f${now.toString(36)}`,
      collapsed: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (repository) {
      try {
        await repository.saveFolder(folder);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = { ...currentState, folders: [...currentState.folders, folder] };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleToggleFolder(folder: Folder) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const nextFolder: Folder = { ...folder, collapsed: !folder.collapsed, updatedAt: Date.now() };
    if (repository) {
      try {
        await repository.saveFolder(nextFolder);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      folders: currentState.folders.map((item) =>
        item.id === folder.id ? nextFolder : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteFolder(folder: Folder) {
    const currentState = stateRef.current;
    if (!currentState) return;
    if (!confirm(`删除文件夹“${folder.name}”？其中的清单会移到根目录。`)) return;
    if (repository) {
      try {
        await repository.deleteFolder(folder.id);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      folders: currentState.folders.filter((item) => item.id !== folder.id),
      projects: currentState.projects.map((project) =>
        project.folderId === folder.id ? { ...project, folderId: null } : project,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleUpdateProject(
    project: Project,
    patch: { name: string; color: string; kind: ProjectKind; folderId: string | null },
  ) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const nextProject: Project = { ...project, ...patch, updatedAt: Date.now() };
    if (repository) {
      try {
        await repository.saveProject(nextProject);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      projects: currentState.projects.map((item) =>
        item.id === project.id ? nextProject : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteProject(project: Project) {
    if (project.isInbox) return;
    const currentState = stateRef.current;
    if (!currentState) return;
    if (!confirm(`删除清单“${project.name}”？其中的任务会移到收集箱。`)) return;
    const inboxProject = findInboxProject(currentState.projects);
    const targetId = inboxProject?.id ?? project.id;
    const now = Date.now();
    const movedTasks = currentState.tasks
      .filter((task) => task.projectId === project.id && task.deletedAt === null)
      .map((task) => ({ ...task, projectId: targetId, updatedAt: now }));
    const nextProject: Project = { ...project, deletedAt: now, updatedAt: now };

    if (repository) {
      try {
        await repository.saveProject(nextProject);
        for (const task of movedTasks) await repository.saveTask(task);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const moved = new Map(movedTasks.map((task) => [task.id, task]));
    const nextState: AppState = {
      ...currentState,
      projects: currentState.projects.map((item) =>
        item.id === project.id ? nextProject : item,
      ),
      tasks: currentState.tasks.map((task) => moved.get(task.id) ?? task),
    };
    if (view.kind === 'project' && view.id === project.id) {
      setView({ kind: 'smart', id: 'inbox' });
    }
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleSaveFilter(
    filter: Pick<SavedFilter, 'name' | 'conditions' | 'match'> & { id?: string },
  ) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const existing = filter.id
      ? currentState.filters.find((item) => item.id === filter.id) ?? null
      : null;
    const nextFilter: SavedFilter = existing
      ? {
          ...existing,
          name: filter.name,
          conditions: filter.conditions,
          match: filter.match,
          updatedAt: now,
        }
      : {
          id: generateId(),
          profileId: currentState.profile.id,
          name: filter.name,
          conditions: filter.conditions,
          match: filter.match,
          sortKey: `f${now.toString(36)}`,
          pinned: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
    if (repository) {
      try {
        await repository.saveFilter(nextFilter);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      filters: existing
        ? currentState.filters.map((item) => (item.id === nextFilter.id ? nextFilter : item))
        : [...currentState.filters, nextFilter],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setView({ kind: 'filter', id: nextFilter.id });
    setViewMode('list');
  }

  async function handleDeleteFilter(filter: SavedFilter) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const nextFilter: SavedFilter = { ...filter, deletedAt: now, updatedAt: now };
    if (repository) {
      try {
        await repository.deleteFilter(filter.id);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    if (view.kind === 'filter' && view.id === filter.id) {
      setView({ kind: 'smart', id: 'all' });
    }
    const nextState: AppState = {
      ...currentState,
      filters: currentState.filters.map((item) =>
        item.id === filter.id ? nextFilter : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleCreateTemplate(input: {
    name: string;
    title: string;
    contentMd: string;
    priority: Priority;
    projectId: string | null;
  }) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const template: TaskTemplate = {
      id: generateId(),
      profileId: currentState.profile.id,
      name: input.name,
      title: input.title,
      contentMd: input.contentMd,
      priority: input.priority,
      tagIds: [],
      projectId: input.projectId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (repository) {
      try {
        await repository.saveTemplate(template);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      templates: [...currentState.templates, template],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteTemplate(template: TaskTemplate) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    if (repository) {
      try {
        await repository.deleteTemplate(template.id);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      templates: currentState.templates.map((item) =>
        item.id === template.id ? { ...item, deletedAt: now, updatedAt: now } : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleUseTemplate(template: TaskTemplate) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const projectId =
      template.projectId ??
      (view.kind === 'project' ? view.id : quickAddProject?.id);
    if (!projectId) return;
    const task = createTask({
      profileId: currentState.profile.id,
      projectId,
      title: template.title,
      contentMd: template.contentMd,
      priority: template.priority,
      tagIds: template.tagIds,
    });
    if (repository) {
      try {
        await repository.saveTask(task);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = { ...currentState, tasks: [...currentState.tasks, task] };
    if (!repository) saveState(nextState);
    commit(nextState);
    setSelectedTaskId(task.id);
    setTemplatesOpen(false);
  }

  async function handleSaveCurrentAsTemplate() {
    if (!selectedTask) return;
    await handleCreateTemplate({
      name: selectedTask.title,
      title: selectedTask.title,
      contentMd: selectedTask.contentMd,
      priority: selectedTask.priority,
      projectId: selectedTask.projectId,
    });
    setToast({ title: '已保存为模板', body: selectedTask.title });
  }

  async function handleAddComment(content: string) {
    const currentState = stateRef.current;
    if (!currentState || !selectedTask) return;
    const now = Date.now();
    const comment: TaskComment = {
      id: generateId(),
      profileId: currentState.profile.id,
      taskId: selectedTask.id,
      contentMd: content,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (repository) {
      try {
        await repository.saveComment(comment);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      comments: [...currentState.comments, comment],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteComment(commentId: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    if (repository) {
      try {
        await repository.deleteComment(commentId);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      comments: currentState.comments.map((comment) =>
        comment.id === commentId ? { ...comment, deletedAt: now, updatedAt: now } : comment,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleAddAttachment(file: File) {
    const currentState = stateRef.current;
    if (!currentState || !selectedTask) return;
    if (file.size > 10 * 1024 * 1024) {
      setToast({ title: '附件过大', body: '请选择小于 10 MB 的文件。' });
      return;
    }
    let saved;
    try {
      saved = await saveAttachmentFile(file, currentState.profile.id);
    } catch (error) {
      reportStorageError(error);
      return;
    }
    const attachment: AttachmentMeta = {
      id: generateId(),
      profileId: currentState.profile.id,
      ownerType: 'task',
      ownerId: selectedTask.id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      storagePath: saved.storagePath,
      createdAt: Date.now(),
      deletedAt: null,
    };
    if (repository) {
      try {
        await repository.saveAttachment(attachment);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      attachments: [...currentState.attachments, attachment],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteAttachment(attachmentId: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const attachment = currentState.attachments.find((item) => item.id === attachmentId);
    if (repository) {
      try {
        await repository.deleteAttachment(attachmentId);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const stillUsed = currentState.attachments.some(
      (item) =>
        item.id !== attachmentId &&
        item.deletedAt === null &&
        item.storagePath === attachment?.storagePath,
    );
    if (attachment && !stillUsed) {
      await deleteAttachmentFile(attachment.storagePath);
    }
    const nextState: AppState = {
      ...currentState,
      attachments: currentState.attachments.filter((item) => item.id !== attachmentId),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleAddReminder(offsetMinutes: number) {
    const currentState = stateRef.current;
    if (!currentState || !selectedTask) return;
    const triggerAt = reminderTriggerAt(selectedTask, offsetMinutes);
    if (triggerAt === null) return;
    const existing = currentState.reminders.find(
      (reminder) =>
        reminder.ownerType === 'task' &&
        reminder.ownerId === selectedTask.id &&
        reminder.offsetMinutes === offsetMinutes &&
        (reminder.state === 'pending' || reminder.state === 'snoozed'),
    );
    if (existing) return;
    const now = Date.now();
    const reminder: Reminder = {
      id: generateId(),
      profileId: currentState.profile.id,
      ownerType: 'task',
      ownerId: selectedTask.id,
      kind: 'relative_start',
      triggerAt,
      offsetMinutes,
      persistent: false,
      state: 'pending',
      snoozeUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    if (repository) {
      try {
        await repository.saveReminder(reminder);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      reminders: [...currentState.reminders, reminder],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteReminder(reminderId: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    if (repository) {
      try {
        await repository.deleteReminder(reminderId);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      reminders: currentState.reminders.filter((reminder) => reminder.id !== reminderId),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleSnooze(reminder: Reminder, minutes: number) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const nextReminder: Reminder = {
      ...reminder,
      state: 'snoozed',
      snoozeUntil: now + minutes * 60_000,
      updatedAt: now,
    };
    if (repository) {
      try {
        await repository.saveReminder(nextReminder);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      reminders: currentState.reminders.map((item) =>
        item.id === reminder.id ? nextReminder : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setToast({
      title: '已稍后提醒',
      body: `${minutes} 分钟后 · ${new Date(nextReminder.snoozeUntil ?? now).toLocaleTimeString(
        'zh-CN',
        { hour: '2-digit', minute: '2-digit' },
      )}`,
    });
  }

  async function handleDismissReminder(reminder: Reminder) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const nextReminder: Reminder = {
      ...reminder,
      state: 'dismissed',
      updatedAt: Date.now(),
    };
    if (repository) {
      try {
        await repository.saveReminder(nextReminder);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      reminders: currentState.reminders.map((item) =>
        item.id === reminder.id ? nextReminder : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  function handleCheckTask(task: Task) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function runBatch(updater: (task: Task) => Task) {
    const currentState = stateRef.current;
    if (!currentState || selectedIds.size === 0) return;
    const now = Date.now();
    const updated = currentState.tasks
      .filter((task) => selectedIds.has(task.id))
      .map((task) => updater({ ...task, updatedAt: now }));
    if (repository) {
      try {
        for (const task of updated) await repository.saveTask(task);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const map = new Map(updated.map((task) => [task.id, task]));
    const nextState: AppState = {
      ...currentState,
      tasks: currentState.tasks.map((task) => map.get(task.id) ?? task),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    clearSelection();
  }

  async function handleAddHabit(input: {
    name: string;
    icon: string;
    color: string;
    frequency: HabitFrequency;
    goalAmount: number | null;
    unit: string | null;
  }) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const habit: Habit = {
      id: generateId(),
      profileId: currentState.profile.id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      description: '',
      frequency: input.frequency,
      goalAmount: input.goalAmount,
      unit: input.unit,
      archived: false,
      sortKey: `h${now.toString(36)}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (repository) {
      try {
        await repository.saveHabit(habit);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = { ...currentState, habits: [...currentState.habits, habit] };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleUpdateHabit(habit: Habit, patch: Partial<Habit>) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const nextHabit: Habit = { ...habit, ...patch, updatedAt: Date.now() };
    if (repository) {
      try {
        await repository.saveHabit(nextHabit);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      habits: currentState.habits.map((item) =>
        item.id === habit.id ? nextHabit : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteHabit(habit: Habit) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    if (repository) {
      try {
        await repository.deleteHabit(habit.id);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      habits: currentState.habits.map((item) =>
        item.id === habit.id ? { ...item, deletedAt: now, updatedAt: now } : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleCheckin(habit: Habit, date: string, amount: number) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const existing = currentState.habitCheckins.find(
      (checkin) =>
        checkin.habitId === habit.id && checkin.date === date && checkin.deletedAt === null,
    );
    const checkin: HabitCheckin = existing
      ? { ...existing, amount, checkedAt: now, updatedAt: now }
      : {
          id: generateId(),
          habitId: habit.id,
          date,
          amount,
          note: '',
          checkedAt: now,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
    if (repository) {
      try {
        await repository.saveHabitCheckin(checkin);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      habitCheckins: existing
        ? currentState.habitCheckins.map((item) =>
            item.id === checkin.id ? checkin : item,
          )
        : [...currentState.habitCheckins, checkin],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleUndoCheckin(habit: Habit, date: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const existing = currentState.habitCheckins.find(
      (checkin) =>
        checkin.habitId === habit.id && checkin.date === date && checkin.deletedAt === null,
    );
    if (!existing) return;
    if (repository) {
      try {
        await repository.deleteHabitCheckin(existing.id);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      habitCheckins: currentState.habitCheckins.filter((item) => item.id !== existing.id),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleRecordFocus(input: {
    taskId: string | null;
    mode: 'pomodoro' | 'stopwatch';
    plannedSeconds: number | null;
    startedAt: number;
    durationSeconds: number;
    note: string;
  }) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const session: FocusSession = {
      id: generateId(),
      profileId: currentState.profile.id,
      taskId: input.taskId,
      mode: input.mode,
      state: 'finished',
      plannedSeconds: input.plannedSeconds,
      startedAt: input.startedAt,
      endedAt: now,
      durationSeconds: input.durationSeconds,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (repository) {
      try {
        await repository.saveFocusSession(session);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      focusSessions: [...currentState.focusSessions, session],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setToast({
      title: '专注已记录',
      body: `${Math.max(1, Math.round(input.durationSeconds / 60))} 分钟`,
    });
  }

  async function handleAddCountdown(input: {
    name: string;
    type: Countdown['type'];
    date: string;
    calendar: Countdown['calendar'];
    repeatYearly: boolean;
    countMode: Countdown['countMode'];
  }) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const countdown: Countdown = {
      id: generateId(),
      profileId: currentState.profile.id,
      name: input.name,
      type: input.type,
      date: input.date,
      calendar: input.calendar,
      repeatYearly: input.repeatYearly,
      countMode: input.countMode,
      pinned: false,
      note: '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    if (repository) {
      try {
        await repository.saveCountdown(countdown);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      countdowns: [...currentState.countdowns, countdown],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleDeleteCountdown(countdown: Countdown) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    if (repository) {
      try {
        await repository.deleteCountdown(countdown.id);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      countdowns: currentState.countdowns.map((item) =>
        item.id === countdown.id ? { ...item, deletedAt: now, updatedAt: now } : item,
      ),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function migrateLegacyAttachments(base: AppState, repo: SqliteRepository | null) {
    if (attachmentMigrationRef.current) return;
    const legacy = base.attachments.filter(
      (item) => item.deletedAt === null && item.storagePath.startsWith('data:'),
    );
    if (legacy.length === 0) return;

    attachmentMigrationRef.current = true;
    try {
      const updates = new Map<string, AttachmentMeta>();
      for (const item of legacy) {
        const saved = await migrateDataUrlAttachment(item.storagePath, base.profile.id);
        if (!saved) continue;
        const nextItem: AttachmentMeta = { ...item, storagePath: saved.storagePath };
        if (repo) {
          try {
            await repo.saveAttachment(nextItem);
          } catch (error) {
            reportStorageError(error);
            continue;
          }
        }
        updates.set(item.id, nextItem);
      }
      if (updates.size === 0) return;
      const latest = stateRef.current;
      if (!latest) return;
      const nextState: AppState = {
        ...latest,
        attachments: latest.attachments.map((item) => updates.get(item.id) ?? item),
      };
      stateRef.current = nextState;
      setState(nextState);
      if (!repo) saveState(nextState);
    } finally {
      attachmentMigrationRef.current = false;
    }
  }

  async function handleRestoreState(nextState: AppState) {
    const activeUser = users.find((user) => user.id === activeUserId);
    const restored: AppState = activeUser
      ? {
          ...nextState,
          profile: {
            ...nextState.profile,
            name: activeUser.name,
            updatedAt: Date.now(),
          },
        }
      : nextState;
    if (stateRef.current) {
      writeAutoBackup(stateRef.current);
    }
    if (repository) {
      try {
        await repository.replaceAll(restored);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const snapshot = stateRef.current;
    if (snapshot) {
      undoRef.current.push(snapshot);
      if (undoRef.current.length > 40) undoRef.current.shift();
      redoRef.current = [];
      setHistoryTick((value) => value + 1);
    }
    stateRef.current = restored;
    setState(restored);
    if (!repository) saveState(restored);
    void migrateLegacyAttachments(restored, repository);
    setSelectedTaskId(null);
    setSelectedIds(new Set());
    setView({ kind: 'smart', id: 'inbox' });
    setViewMode('list');
  }

  async function handleImportTasks(imported: Task[]) {
    const currentState = stateRef.current;
    if (!currentState) return;
    if (repository) {
      try {
        for (const task of imported) await repository.saveTask(task);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const nextState: AppState = {
      ...currentState,
      tasks: [...currentState.tasks, ...imported],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleMoveTaskToProject(taskId: string, projectId: string) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const task = currentState.tasks.find((item) => item.id === taskId);
    if (!task || task.projectId === projectId) return;
    await applyTask(taskId, (current) => updateTask(current, { projectId }));
    setToast({ title: '已移动任务', body: '可撤销 Ctrl+Z' });
  }

  async function handleMakeSubtask(draggedId: string, target: Task) {
    const currentState = stateRef.current;
    if (!currentState || draggedId === target.id) return;
    const dragged = currentState.tasks.find((item) => item.id === draggedId);
    if (!dragged) return;

    // Prevent cycles: the target cannot be the dragged task or one of its
    // descendants.
    let cursor: Task | undefined = target;
    let depth = 0;
    while (cursor) {
      if (cursor.id === dragged.id) {
        setToast({ title: '不能这样嵌套', body: '目标任务属于被拖动任务的子任务。' });
        return;
      }
      cursor = cursor.parentId
        ? currentState.tasks.find((item) => item.id === cursor?.parentId)
        : undefined;
      depth += 1;
      if (depth > 5) break;
    }
    if (depth >= 5) {
      setToast({ title: '层级过深', body: '子任务最多支持 5 级。' });
      return;
    }

    await applyTask(draggedId, (current) => ({
      ...updateTask(current, { projectId: target.projectId }),
      parentId: target.id,
    }));
    setToast({ title: '已转为子任务', body: `${dragged.title} → ${target.title}` });
  }

  async function handleBatchComplete() {
    const currentState = stateRef.current;
    if (!currentState) return;
    const now = Date.now();
    const updated = currentState.tasks
      .filter((task) => selectedIds.has(task.id) && task.status !== 'completed')
      .map((task) => completeTask(task, now));
    if (repository) {
      try {
        for (const task of updated) await repository.saveTask(task);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }
    const map = new Map(updated.map((task) => [task.id, task]));
    const nextState: AppState = {
      ...currentState,
      tasks: currentState.tasks.map((task) => map.get(task.id) ?? task),
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    clearSelection();
  }

  async function handleBatchTrash() {
    await runBatch((task) => trashTask(task));
  }

  async function handleBatchRestore() {
    await runBatch((task) => restoreTask(task));
  }

  async function handleBatchMove(projectId: string) {
    await runBatch((task) => ({ ...task, projectId }));
  }

  async function handleBatchPriority(priority: Priority) {
    await runBatch((task) => ({ ...task, priority }));
  }

  async function handleBatchTag(tagId: string) {
    await runBatch((task) =>
      task.tagIds.includes(tagId)
        ? task
        : { ...task, tagIds: [...task.tagIds, tagId] },
    );
  }

  async function handleDetachSubtask(task: Task) {
    await applyTask(task.id, (current) => ({ ...current, parentId: null, updatedAt: Date.now() }));
    setToast({ title: '已转为独立任务', body: task.title });
  }

  function handleAddChecklistItem(title: string) {
    if (!selectedTask) return;
    void applyTask(selectedTask.id, (current) => addChecklistItem(current, title));
  }

  function handleToggleChecklistItem(itemId: string) {
    if (!selectedTask) return;
    void applyTask(selectedTask.id, (current) =>
      toggleChecklistItem(current, itemId),
    );
  }

  function handleDeleteChecklistItem(itemId: string) {
    if (!selectedTask) return;
    void applyTask(selectedTask.id, (current) =>
      deleteChecklistItem(current, itemId),
    );
  }

  async function handleAddSubtask(title: string) {
    const currentState = stateRef.current;
    if (!currentState || !selectedTask) return;
    const task = createTask({
      profileId: currentState.profile.id,
      projectId: selectedTask.projectId,
      parentId: selectedTask.id,
      title,
      startDate: selectedTask.startDate,
      startTime: selectedTask.startTime,
    });

    if (repository) {
      try {
        await repository.saveTask(task);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latest = stateRef.current ?? currentState;
    const nextState: AppState = {
      ...latest,
      tasks: [...latest.tasks, task],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
  }

  async function handleCreateTask(value: string, options?: QuickAddOptions) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const projectId = quickAddProject?.id;
    if (!projectId) return;

    const fallbackDate =
      viewMode === 'calendar'
        ? selectedCalendarDate
        : view.kind === 'smart' && view.id === 'today'
          ? todayKey()
          : null;
    const startDate = options?.startDate ?? fallbackDate;
    const startTime = startDate ? options?.startTime ?? null : null;
    const endTime = startTime ? options?.endTime ?? null : null;

    const task = createTask({
      profileId: currentState.profile.id,
      projectId,
      title: value,
      startDate,
      startTime,
      endTime,
    });

    if (repository) {
      try {
        await repository.saveTask(task);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latestState = stateRef.current ?? currentState;
    const nextState: AppState = {
      ...latestState,
      tasks: [...latestState.tasks, task],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setSelectedTaskId(task.id);
  }

  async function handleApplyAiActions(
    actions: AiAction[],
  ): Promise<AiApplyResult> {
    const currentState = stateRef.current;
    const result: AiApplyResult = { created: 0, subtasks: 0, errors: [] };
    if (!currentState) {
      result.errors.push('应用还没有加载完成');
      return result;
    }

    const projects = currentState.projects.filter(
      (project) => project.kind === 'task' && !project.deletedAt,
    );
    const inbox =
      projects.find((project) => project.isInbox) ?? projects[0] ?? null;
    if (!inbox) {
      result.errors.push('找不到可用的清单');
      return result;
    }

    const tags = currentState.tags;
    function findProject(name?: string): Project {
      const value = name?.trim().toLowerCase();
      if (!value) return inbox as Project;
      return (
        projects.find(
          (project) => project.name.trim().toLowerCase() === value,
        ) ?? (inbox as Project)
      );
    }
    function resolveTagIds(names?: string[]): string[] {
      if (!names || names.length === 0) return [];
      const ids: string[] = [];
      for (const name of names) {
        const value = name.trim().toLowerCase();
        const tag = tags.find((item) => item.name.trim().toLowerCase() === value);
        if (tag) ids.push(tag.id);
      }
      return [...new Set(ids)];
    }

    const newTasks: Task[] = [];
    try {
      for (const action of actions) {
        if (action.type === 'create_task') {
          const startDate =
            action.startDate ?? (action.startTime ? todayKey() : null);
          const task = createTask({
            profileId: currentState.profile.id,
            projectId: findProject(action.project).id,
            title: action.title,
            contentMd: action.notes ?? '',
            startDate,
            startTime: startDate ? action.startTime ?? null : null,
            endTime:
              startDate && action.startTime ? action.endTime ?? null : null,
            priority: action.priority ?? 0,
            tagIds: resolveTagIds(action.tags),
          });
          if (repository) await repository.saveTask(task);
          newTasks.push(task);
          result.created += 1;
          continue;
        }

        const key = action.taskTitle.trim().toLowerCase();
        const parent = currentState.tasks.find(
          (task) =>
            task.status === 'open' &&
            !task.deletedAt &&
            task.title.trim().toLowerCase() === key,
        );
        if (!parent) {
          result.errors.push(`未找到任务「${action.taskTitle}」`);
          continue;
        }
        for (const title of action.titles) {
          const subtask = createTask({
            profileId: currentState.profile.id,
            projectId: parent.projectId,
            parentId: parent.id,
            title,
            startDate: parent.startDate,
            startTime: parent.startTime,
            endTime: parent.endTime,
          });
          if (repository) await repository.saveTask(subtask);
          newTasks.push(subtask);
          result.subtasks += 1;
        }
      }
    } catch (error) {
      reportStorageError(error);
      result.errors.push(
        error instanceof Error ? error.message : String(error),
      );
    }

    if (newTasks.length > 0) {
      const latest = stateRef.current ?? currentState;
      const nextState: AppState = {
        ...latest,
        tasks: [...latest.tasks, ...newTasks],
      };
      if (!repository) saveState(nextState);
      commit(nextState);
    }
    return result;
  }

  function handleAiSettingsChange(next: AiSettings) {
    setAiSettings(next);
    saveAiSettings(next);
  }

  function openAssistant() {
    setAssistantSeed(null);
    setAssistantOpen(true);
  }

  function closeAssistant() {
    setAssistantOpen(false);
    setAssistantSeed(null);
  }

  function openAssistantForTask(task: Task) {
    setAssistantSeed({
      key: Date.now(),
      taskId: task.id,
      prompt: `帮我拆解这个任务：${task.title}`,
    });
    setAssistantOpen(true);
    setTaskMenu(null);
  }

  function handleAppContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest(
      '[data-task-id]',
    ) as HTMLElement | null;
    if (!target) return;
    const taskId = target.dataset.taskId;
    const task = stateRef.current?.tasks.find(
      (item) => item.id === taskId && !item.deletedAt,
    );
    if (!task) return;
    event.preventDefault();
    setTaskMenu({ x: event.clientX, y: event.clientY, taskId: task.id });
  }

  async function handleAddProject(name: string, folderId: string | null = null) {
    const currentState = stateRef.current;
    if (!currentState) return;
    const createdAt = Date.now();
    const project: Project = {
      id: generateId(),
      profileId: currentState.profile.id,
      folderId,
      name,
      kind: 'task',
      color:
        PROJECT_COLORS[currentState.projects.length % PROJECT_COLORS.length] ?? '#3b6ef6',
      isInbox: false,
      sortKey: `m${createdAt.toString(36)}`,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    };

    if (repository) {
      try {
        await repository.saveProject(project);
      } catch (error) {
        reportStorageError(error);
        return;
      }
    }

    const latestState = stateRef.current ?? currentState;
    const nextState: AppState = {
      ...latestState,
      projects: [...latestState.projects, project],
    };
    if (!repository) saveState(nextState);
    commit(nextState);
    setView({ kind: 'project', id: project.id });
    setSidebarOpen(false);
  }

  function handleSelectView(next: View) {
    setView(next);
    setViewMode('list');
    setSelectedTaskId(null);
    setSelectedIds(new Set());
    setSidebarOpen(false);
  }

  function handleSwitchUser(user: LocalUser) {
    if (user.id === activeUserId) {
      setUserManagerOpen(false);
      return;
    }
    const next = users.map((item) =>
      item.id === user.id ? { ...item, lastUsedAt: Date.now() } : item,
    );
    setUsers(next);
    saveUsers(next);
    setActiveUserId(user.id);
    setActiveUserIdState(user.id);
    setUserManagerOpen(false);
  }

  function handleCreateUser(name: string) {
    const user = createUser(name);
    const next = [...users, user];
    setUsers(next);
    saveUsers(next);
    setActiveUserId(user.id);
    setActiveUserIdState(user.id);
    setUserManagerOpen(false);
    setToast({ title: '已创建用户', body: `${user.name} · 独立本地数据` });
  }

  async function handleRenameUser(user: LocalUser, name: string) {
    const value = name.trim();
    if (!value) return;
    const next = users.map((item) =>
      item.id === user.id ? { ...item, name: value } : item,
    );
    setUsers(next);
    saveUsers(next);

    if (user.id === activeUserId) {
      const current = stateRef.current;
      if (!current) return;
      const profile = { ...current.profile, name: value, updatedAt: Date.now() };
      if (repositoryRef.current) {
        try {
          await repositoryRef.current.saveProfile(profile);
        } catch (error) {
          reportStorageError(error);
          return;
        }
      }
      const nextState: AppState = { ...current, profile };
      stateRef.current = nextState;
      setState(nextState);
      if (!repositoryRef.current) saveState(nextState);
    }
  }

  async function handleDeleteUser(user: LocalUser) {
    if (users.length <= 1) {
      setToast({ title: '至少保留一个用户', body: '请先创建另一个用户再删除。' });
      return;
    }
    const isActive = user.id === activeUserId;
    if (isActive) {
      repositoryRef.current?.close();
      repositoryRef.current = null;
      setRepository(null);
      // Give the worker a moment to release the OPFS file handle.
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    await deleteWebDatabase(user.dbName);
    removeUserLocalData(user);

    const remaining = users.filter((item) => item.id !== user.id);
    setUsers(remaining);
    saveUsers(remaining);
    if (isActive) {
      const nextUser = remaining[0];
      if (nextUser) {
        setActiveUserId(nextUser.id);
        setActiveUserIdState(nextUser.id);
      }
    }
    setToast({ title: '已删除用户', body: `${user.name} 的本地数据已删除` });
  }

  const contextTask = taskMenu
    ? state.tasks.find(
        (task) => task.id === taskMenu.taskId && !task.deletedAt,
      ) ?? null
    : null;
  const collabOnlineCount = collab.peers.filter((peer) => peer.online).length;
  const currentCollabGroup =
    view.kind === 'project' ? collab.groupForProject(view.id) : undefined;
  const pendingCollabInvite = collab.invites[0];

  return (
    <div
      className={`app ${sidebarOpen ? 'is-sidebar-open' : ''} ${
        selectedTask ? 'is-detail-open' : ''
      }`}
      onContextMenu={handleAppContextMenu}
    >
      <Sidebar
        state={state}
        view={view}
        counts={counts}
        onSelectView={handleSelectView}
        onAddProject={(name, folderId) => void handleAddProject(name, folderId)}
        onEditProject={setEditingProject}
        onDeleteProject={(project) => void handleDeleteProject(project)}
        onMoveTaskToProject={(taskId, projectId) => void handleMoveTaskToProject(taskId, projectId)}
        onAddFolder={(name) => void handleAddFolder(name)}
        onToggleFolder={(folder) => void handleToggleFolder(folder)}
        onDeleteFolder={(folder) => void handleDeleteFolder(folder)}
        onOpenTagManager={() => setTagManagerOpen(true)}
        onSelectFilter={(filter) => {
          setView({ kind: 'filter', id: filter.id });
          setViewMode('list');
          setSelectedTaskId(null);
        }}
        onOpenFilterDialog={() => {
          setEditingFilter(null);
          setFilterDialogOpen(true);
        }}
        onEditFilter={(filter) => {
          setEditingFilter(filter);
          setFilterDialogOpen(true);
        }}
        onDeleteFilter={(filter) => void handleDeleteFilter(filter)}
        onOpenBackup={() => setBackupOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        activeUserName={activeUser?.name ?? state.profile.name}
        onOpenUsers={() => setUserManagerOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        onClose={() => setSidebarOpen(false)}
        storageLabel={storageLabel}
        sharedGroupIds={new Set(collab.groups.map((group) => group.id))}
      />

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭侧边栏"
        />
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开侧边栏"
          >
            <Menu size={19} />
          </button>

          <div className="topbar-title">
            <h1>{title}</h1>
            <span>{subtitle}</span>
          </div>

          <div className="topbar-actions">
            <button
              className="search-box search-trigger"
              onClick={() => setGlobalSearchOpen(true)}
              aria-label="全局搜索"
            >
              <Search size={15} />
              <span>搜索任务、清单、标签</span>
              <kbd>Ctrl K</kbd>
            </button>

            <button
              className="icon-button"
              onClick={() => void handleUndo()}
              disabled={undoRef.current.length === 0}
              aria-label="撤销"
              title="撤销 Ctrl+Z"
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              onClick={() => void handleRedo()}
              disabled={redoRef.current.length === 0}
              aria-label="重做"
              title="重做 Ctrl+Shift+Z"
            >
              <Redo2 size={17} />
            </button>

            <button
              className="icon-button collab-trigger"
              onClick={() => setCollabOpen(true)}
              aria-label="局域网协作"
              title="局域网协作"
            >
              <Users size={17} />
              {collabOnlineCount > 0 && (
                <span className="collab-badge">{collabOnlineCount}</span>
              )}
            </button>

            <NotificationCenter
              reminders={state.reminders}
              tasks={state.tasks}
              onOpenTask={(task) => setSelectedTaskId(task.id)}
              onSnooze={(reminder, minutes) => void handleSnooze(reminder, minutes)}
              onDismiss={(reminder) => void handleDismissReminder(reminder)}
            />

            <button
              className="icon-button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {storageBanner && <div className="storage-banner">{storageBanner}</div>}

        <div className="content">
          {showTaskChrome && (
            <div className="content-heading">
              <div className="content-heading-actions">
                <span className="shortcut-hint">
                  按 <kbd>N</kbd> 快速添加
                </span>
                <div className="view-switch">
                  <button
                    className={viewMode === 'list' ? 'is-active' : ''}
                    onClick={() => setViewMode('list')}
                    title="列表"
                  >
                    <List size={14} />
                    列表
                  </button>
                  <button
                    className={viewMode === 'kanban' ? 'is-active' : ''}
                    onClick={() => setViewMode('kanban')}
                    title="看板"
                  >
                    <Columns3 size={14} />
                    看板
                  </button>
                  <button
                    className={viewMode === 'timeline' ? 'is-active' : ''}
                    onClick={() => setViewMode('timeline')}
                    title="时间线"
                  >
                    <GanttChart size={14} />
                    时间线
                  </button>
                  <button
                    className={viewMode === 'matrix' ? 'is-active' : ''}
                    onClick={() => setViewMode('matrix')}
                    title="四象限"
                  >
                    <Grid2X2 size={14} />
                    四象限
                  </button>
                  <button
                    className={viewMode === 'calendar' ? 'is-active' : ''}
                    onClick={() => {
                      setViewMode('calendar');
                      setCalendarAnchor(selectedCalendarDate);
                    }}
                    title="日历"
                  >
                    <CalendarDays size={14} />
                    日历
                  </button>
                </div>
              </div>
            </div>
          )}

          {showTaskChrome && (
            <QuickAdd
              inputRef={quickAddRef}
              placeholder={
                viewMode === 'calendar'
                  ? `添加到 ${formatDateLabel(selectedCalendarDate)}…`
                  : `添加到 ${quickAddProject?.name ?? '收集箱'}…`
              }
              onSubmit={handleCreateTask}
            />
          )}

          {currentCollabGroup && (
            <div className="collab-banner">
              <span className="collab-banner-icon">
                <Users size={15} />
              </span>
              <div className="collab-banner-main">
                <strong>{currentCollabGroup.name}</strong>
                <span>
                  {currentCollabGroup.ownerId === collab.deviceId
                    ? '我创建的群组'
                    : `群主：${currentCollabGroup.ownerName}`}
                  {' · '}
                  {currentCollabGroup.members.length} 人
                </span>
              </div>
              <div className="collab-banner-members">
                {currentCollabGroup.members.slice(0, 8).map((member) => (
                  <span key={member.deviceId} title={member.name}>
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </div>
              <button
                className="button ghost small"
                onClick={() => setCollabOpen(true)}
              >
                <Users size={14} />
                邀请成员
              </button>
            </div>
          )}

          {isModuleView ? (
            view.id === 'summary' ? (
              <SummaryView
                tasks={state.tasks}
                projects={state.projects}
                sessions={state.focusSessions}
                habits={state.habits}
                checkins={state.habitCheckins}
                onSelectTask={(task) => setSelectedTaskId(task.id)}
              />
            ) : view.id === 'focus' ? (
              <FocusView
                tasks={state.tasks}
                sessions={state.focusSessions}
                onRecord={(input) => void handleRecordFocus(input)}
              />
            ) : view.id === 'habits' ? (
              <HabitsView
                habits={state.habits}
                checkins={state.habitCheckins}
                onAdd={(input) => void handleAddHabit(input)}
                onUpdate={(habit, patch) => void handleUpdateHabit(habit, patch)}
                onDelete={(habit) => void handleDeleteHabit(habit)}
                onCheckin={(habit, date, amount) => void handleCheckin(habit, date, amount)}
                onUndoCheckin={(habit, date) => void handleUndoCheckin(habit, date)}
              />
            ) : view.id === 'countdowns' ? (
              <CountdownView
                countdowns={state.countdowns}
                onAdd={(input) => void handleAddCountdown(input)}
                onDelete={(countdown) => void handleDeleteCountdown(countdown)}
                onUpdate={async (countdown, patch) => {
                  const currentState = stateRef.current;
                  if (!currentState || !repository) return;
                  const nextCountdown = { ...countdown, ...patch, updatedAt: Date.now() };
                  await repository.saveCountdown(nextCountdown);
                  commit({
                    ...currentState,
                    countdowns: currentState.countdowns.map((item) =>
                      item.id === countdown.id ? nextCountdown : item,
                    ),
                  });
                }}
              />
            ) : (
              <StatsView state={state} projects={state.projects} tags={state.tags} />
            )
          ) : noteProject ? (
            <NoteView
              project={noteProject}
              tasks={state.tasks}
              onCreate={(noteTitle) => {
                const currentState = stateRef.current;
                if (!currentState) return;
                const task = createTask({
                  profileId: currentState.profile.id,
                  projectId: noteProject.id,
                  title: noteTitle,
                  contentMd: '',
                });
                void (async () => {
                  if (repository) await repository.saveTask(task);
                  const latest = stateRef.current ?? currentState;
                  const nextState = { ...latest, tasks: [...latest.tasks, task] };
                  if (!repository) saveState(nextState);
                  commit(nextState);
                })();
              }}
              onUpdate={(task, patch) =>
                void applyTask(task.id, (current) => updateTask(current, patch))
              }
              onDelete={(task) => void applyTask(task.id, (current) => trashTask(current))}
            />
          ) : viewMode === 'calendar' ? (
            <CalendarView
              mode={calendarMode}
              anchor={calendarAnchor}
              selectedDate={selectedCalendarDate}
              tasks={state.tasks}
              series={state.recurrenceSeries}
              projects={state.projects}
              preferences={state.preferences}
              onPreferencesChange={handlePreferencesChange}
              onSelectDate={setSelectedCalendarDate}
              onNavigateDate={handleNavigateDate}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              onToggleTask={handleToggle}
              onMoveTask={handleMoveTask}
              onResizeTask={handleResizeTask}
              onResizeTaskStart={handleResizeTaskStart}
              onAddTask={() => {
                setSelectedCalendarDate(calendarAnchor);
                quickAddRef.current?.focus();
              }}
              onPrev={() => shiftCalendar(-1)}
              onNext={() => shiftCalendar(1)}
              onToday={handleCalendarToday}
              onModeChange={setCalendarMode}
            />
          ) : viewMode === 'kanban' ? (
            <KanbanView
              tasks={boardTasks}
              projects={state.projects}
              tags={state.tags}
              selectedTaskId={selectedTaskId}
              onSelect={(task) => setSelectedTaskId(task.id)}
              onToggle={handleToggle}
              onMove={(task, patch) =>
                void applyTask(task.id, (current) => updateTask(current, patch))
              }
              onAdd={() => quickAddRef.current?.focus()}
            />
          ) : viewMode === 'timeline' ? (
            <TimelineView
              tasks={boardTasks}
              projects={state.projects}
              anchor={calendarAnchor}
              selectedTaskId={selectedTaskId}
              onSelect={(task) => setSelectedTaskId(task.id)}
              onMove={(task, date) => handleMoveTask(task.id, date)}
              onToggle={handleToggle}
              onAnchorChange={setCalendarAnchor}
            />
          ) : viewMode === 'matrix' ? (
            <MatrixView
              tasks={boardTasks}
              selectedTaskId={selectedTaskId}
              onSelect={(task) => setSelectedTaskId(task.id)}
              onToggle={handleToggle}
              onUpdate={handleUpdate}
            />
          ) : (
            <TaskList
              tasks={displayTasks}
              projects={state.projects}
              tags={state.tags}
              view={view}
              search={search}
              selectedTaskId={selectedTaskId}
              selectedIds={selectedIds}
              onSelect={(task) => setSelectedTaskId(task.id)}
              onCheck={handleCheckTask}
              onToggle={handleToggle}
              onDropTask={(draggedId, target) => void handleMakeSubtask(draggedId, target)}
              onTrash={handleTrash}
              onRestore={handleRestore}
              onRestart={handleRestart}
              assigneesForTask={(task) => collab.membersForTask(task)}
            />
          )}
        </div>
      </main>

      {selectedTask && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          projects={state.projects}
          tags={state.tags}
          series={
            selectedTask.seriesId
              ? state.recurrenceSeries.find((item) => item.id === selectedTask.seriesId) ?? null
              : null
          }
          hasOverride={Boolean(selectedOverride)}
          subtasks={selectedSubtasks}
          reminders={selectedReminders}
          comments={selectedComments}
          attachments={selectedAttachments}
          notificationPermission={notificationPermission}
          collabMembers={
            collab.groupForProject(selectedTask.projectId)?.members
          }
          assignees={collab.assigneesForTask(selectedTask)}
          onAssigneesChange={(deviceIds) => {
            const group = collab.groupForProject(selectedTask.projectId);
            if (group) {
              void collab.assignTask(group.id, selectedTask.id, deviceIds);
            }
          }}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleUpdate}
          onToggle={handleToggle}
          onTrash={handleTrash}
          onRestore={handleRestore}
          onSetRecurrence={handleSetRecurrence}
          onUpdateRecurrence={(patch) => void handleUpdateRecurrence(patch)}
          onSkipOccurrence={(task) => void skipOccurrence(task)}
          onRestoreOccurrence={(task) => void restoreOccurrence(task)}
          onAddChecklistItem={handleAddChecklistItem}
          onToggleChecklistItem={handleToggleChecklistItem}
          onDeleteChecklistItem={handleDeleteChecklistItem}
          onAddSubtask={(title) => void handleAddSubtask(title)}
          onOpenSubtask={(subtask) => setSelectedTaskId(subtask.id)}
          onDetachSubtask={(subtask) => void handleDetachSubtask(subtask)}
          onAbandon={handleAbandon}
          onRestart={handleRestart}
          onDuplicate={() => void handleDuplicateTask()}
          onAddReminder={(offset) => void handleAddReminder(offset)}
          onDeleteReminder={(reminderId) => void handleDeleteReminder(reminderId)}
          onAddComment={(content) => void handleAddComment(content)}
          onDeleteComment={(commentId) => void handleDeleteComment(commentId)}
          onAddAttachment={(file) => void handleAddAttachment(file)}
          onDeleteAttachment={(attachmentId) => void handleDeleteAttachment(attachmentId)}
          onSaveTemplate={() => void handleSaveCurrentAsTemplate()}
          onOpenTaskByTitle={(title) => {
            const match = stateRef.current?.tasks.find(
              (item) => item.deletedAt === null && item.title === title,
            );
            if (match) setSelectedTaskId(match.id);
          }}
          onEnableNotifications={() => void enableNotifications()}
        />
      )}

      {selectedIds.size > 0 && (
        <BatchBar
          count={selectedIds.size}
          projects={state.projects}
          tags={state.tags}
          onComplete={() => void handleBatchComplete()}
          onTrash={() => void handleBatchTrash()}
          onRestore={() => void handleBatchRestore()}
          onMove={(projectId) => void handleBatchMove(projectId)}
          onPriority={(priority) => void handleBatchPriority(priority)}
          onAddTag={(tagId) => void handleBatchTag(tagId)}
          onClear={clearSelection}
        />
      )}

      {globalSearchOpen && (
        <GlobalSearch
          state={state}
          onSelectTask={(task) => {
            setSelectedTaskId(task.id);
            setGlobalSearchOpen(false);
          }}
          onSelectProject={(project) => {
            setView({ kind: 'project', id: project.id });
            setViewMode('list');
            setSelectedTaskId(null);
          }}
          onSelectTag={(tag) => {
            setView({ kind: 'tag', id: tag.id });
            setViewMode('list');
            setSelectedTaskId(null);
          }}
          onClose={() => setGlobalSearchOpen(false)}
        />
      )}

      {tagManagerOpen && (
        <TagManager
          tags={state.tags}
          onAdd={(name, color) => void handleAddTag(name, color)}
          onUpdate={(tag, patch) => void handleUpdateTag(tag, patch)}
          onDelete={(tag) => void handleDeleteTag(tag)}
          onClose={() => setTagManagerOpen(false)}
        />
      )}

      {editingProject && (
        <ProjectDialog
          project={editingProject}
          folders={state.folders}
          onSave={(patch) => void handleUpdateProject(editingProject, patch)}
          onDelete={() => void handleDeleteProject(editingProject)}
          onClose={() => setEditingProject(null)}
        />
      )}

      {filterDialogOpen && (
        <FilterDialog
          projects={state.projects}
          tags={state.tags}
          initial={editingFilter}
          onSave={(filter) => void handleSaveFilter(filter)}
          onDelete={editingFilter ? (filter) => void handleDeleteFilter(filter) : undefined}
          onClose={() => {
            setFilterDialogOpen(false);
            setEditingFilter(null);
          }}
        />
      )}

      {backupOpen && (
        <BackupDialog
          state={state}
          projects={state.projects}
          defaultProjectId={
            view.kind === 'project'
              ? view.id
              : quickAddProject?.id ?? inbox?.id ?? state.projects[0]?.id ?? ''
          }
          onRestoreState={(next) => void handleRestoreState(next)}
          onImportTasks={(imported) => void handleImportTasks(imported)}
          onToast={(toastTitle, body) => setToast({ title: toastTitle, body })}
          onClose={() => setBackupOpen(false)}
        />
      )}

      {templatesOpen && (
        <TemplateDialog
          templates={state.templates.filter((template) => template.deletedAt === null)}
          projects={state.projects}
          defaultProjectId={quickAddProject?.id ?? inbox?.id ?? ''}
          onCreate={(input) => void handleCreateTemplate(input)}
          onDelete={(template) => void handleDeleteTemplate(template)}
          onUse={(template) => void handleUseTemplate(template)}
          onClose={() => setTemplatesOpen(false)}
        />
      )}

      {userManagerOpen && (
        <UserManager
          users={users}
          activeUserId={activeUserId}
          onSwitch={handleSwitchUser}
          onCreate={handleCreateUser}
          onRename={(user, name) => void handleRenameUser(user, name)}
          onDelete={(user) => void handleDeleteUser(user)}
          onClose={() => setUserManagerOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          preferences={state.preferences}
          theme={theme}
          notificationPermission={notificationPermission}
          storageLabel={storageLabel}
          aiSettings={aiSettings}
          onThemeChange={setTheme}
          onPreferencesChange={(next) => void handlePreferencesChange(next)}
          onAiSettingsChange={handleAiSettingsChange}
          onEnableNotifications={() => void enableNotifications()}
          onCheckHealth={handleCheckHealth}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && (
        <div className="reminder-toast" role="status">
          <BellRing size={18} />
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </div>
          {toast.reminderId && (
            <div className="toast-actions">
              <button
                className="button ghost tiny"
                onClick={() => {
                  const reminder = state.reminders.find(
                    (item) => item.id === toast.reminderId,
                  );
                  if (reminder) void handleSnooze(reminder, 10);
                  setToast(null);
                }}
              >
                10 分钟后
              </button>
              <button
                className="button ghost tiny"
                onClick={() => {
                  const reminder = state.reminders.find(
                    (item) => item.id === toast.reminderId,
                  );
                  if (reminder) void handleDismissReminder(reminder);
                  setToast(null);
                }}
              >
                知道了
              </button>
            </div>
          )}
          <button
            className="icon-button small"
            onClick={() => setToast(null)}
            aria-label="关闭提醒"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {contextTask && taskMenu && (
        <TaskContextMenu
          x={taskMenu.x}
          y={taskMenu.y}
          task={contextTask}
          onAskAi={() => openAssistantForTask(contextTask)}
          onOpenTask={() => {
            setSelectedTaskId(contextTask.id);
            setTaskMenu(null);
          }}
          onClose={() => setTaskMenu(null)}
        />
      )}

      {collabOpen && (
        <CollabDialog
          supported={collab.supported}
          running={collab.running}
          port={collab.port}
          error={collab.error}
          peers={collab.peers}
          groups={collab.groups}
          invites={collab.invites}
          deviceId={collab.deviceId}
          onClose={() => setCollabOpen(false)}
          onCreateGroup={collab.createGroup}
          onInvite={collab.inviteToGroup}
          onAcceptInvite={collab.acceptInvite}
          onDeclineInvite={collab.declineInvite}
          onOpenGroup={(groupId) => {
            handleSelectView({ kind: 'project', id: groupId });
            setViewMode('list');
          }}
          onConnect={collab.connectPeer}
        />
      )}

      {pendingCollabInvite && !collabOpen && (
        <InvitePrompt
          invite={pendingCollabInvite}
          onAccept={() => void collab.acceptInvite(pendingCollabInvite)}
          onDecline={() => collab.declineInvite(pendingCollabInvite)}
        />
      )}

      <AssistantDock
        open={assistantOpen}
        profileId={state.profile.id}
        settings={aiSettings}
        state={state}
        seed={assistantSeed}
        onOpen={openAssistant}
        onClose={closeAssistant}
        onClearSeed={() => setAssistantSeed(null)}
        onOpenSettings={() => setSettingsOpen(true)}
        onApplyActions={handleApplyAiActions}
      />
    </div>
  );
}
