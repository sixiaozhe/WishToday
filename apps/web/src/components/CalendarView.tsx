import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Repeat,
} from 'lucide-react';
import {
  addDaysKey,
  daysBetween,
  formatTimeLabel,
  holidayInfo,
  isStatutoryHoliday,
  isStatutoryWorkday,
  localDateKey,
  parseLocalDateKey,
  type AppPreferences,
  type Project,
  type RecurrenceSeries,
  type Task,
} from '@dayline/core';
import { expandSeries } from '@dayline/recurrence';
import { loadFestivalLabels } from '../lunar';
import { AssigneeAvatars } from './AssigneeAvatars';
import { Select } from './controls/Select';

export type CalendarMode =
  | 'day'
  | 'threeDay'
  | 'week'
  | 'month'
  | 'year'
  | 'schedule'
  | 'twoWeek';

interface CalendarViewProps {
  mode: CalendarMode;
  anchor: string;
  selectedDate: string;
  tasks: Task[];
  series: RecurrenceSeries[];
  projects: Project[];
  preferences: AppPreferences;
  onPreferencesChange: (preferences: AppPreferences) => void;
  onSelectDate: (date: string) => void;
  onNavigateDate: (date: string) => void;
  onSelectTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onMoveTask: (taskId: string, date: string, time?: string | null) => void;
  onResizeTask: (taskId: string, date: string, endTime: string) => void;
  onResizeTaskStart: (taskId: string, date: string, startTime: string) => void;
  onAddTask: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onModeChange: (mode: CalendarMode) => void;
  assigneesForTask?: (task: Task) => Array<{
    deviceId: string;
    name: string;
  }>;
}

type CalendarSegment = 'single' | 'start' | 'middle' | 'end';

interface CalendarItem {
  date: string;
  task: Task;
  virtual: boolean;
  segment: CalendarSegment;
  segmentStartTime: string | null;
  segmentEndTime: string | null;
}

interface PositionedEvent {
  item: CalendarItem;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
  startMinutes: number;
  endMinutes: number;
}

type ResizeEdge = 'start' | 'end';

interface ResizePreview {
  key: string;
  taskId: string;
  startMinutes: number;
  endMinutes: number;
  edge: ResizeEdge;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const HOUR_HEIGHT = 48;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function startOfWeek(date: string): string {
  const parsed = parseLocalDateKey(date);
  return addDaysKey(date, -parsed.getDay());
}

function weekDays(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDaysKey(start, index));
}

function monthDays(anchor: string): string[] {
  const parsed = parseLocalDateKey(anchor);
  const first = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-01`;
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDaysKey(start, index));
}

function rangeTitle(anchor: string, mode: CalendarMode): string {
  const parsed = parseLocalDateKey(anchor);
  if (mode === 'year') return `${parsed.getFullYear()}年`;
  return `${parsed.getMonth() + 1}月`;
}

function yearMonthDays(anchor: string, monthIndex: number): string[] {
  const parsed = parseLocalDateKey(anchor);
  const first = `${parsed.getFullYear()}-${pad(monthIndex + 1)}-01`;
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDaysKey(start, index));
}

function scheduleDays(anchor: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDaysKey(anchor, index));
}

function timeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

function eventRange(
  item: CalendarItem,
  startHour: number,
  endHour: number,
): { start: number; end: number } | null {
  if (!item.task.startTime) return null;

  const start =
    timeToMinutes(item.segmentStartTime) ??
    (item.segment === 'single' ? timeToMinutes(item.task.startTime) : 0) ??
    0;
  let end =
    timeToMinutes(item.segmentEndTime) ??
    (item.segment === 'single' ? timeToMinutes(item.task.endTime) : 24 * 60) ??
    24 * 60;

  if (item.segment === 'single' && item.segmentStartTime && !item.segmentEndTime) {
    end = start + 60;
  }
  return { start, end: Math.max(start + 15, end) };
}

function rangeLabel(item: CalendarItem, startHour: number, endHour: number): string {
  if (!item.task.startTime) return '全天';
  if (!item.segmentStartTime && !item.segmentEndTime) return '持续';
  const start = formatTimeLabel(item.segmentStartTime ?? `${pad(startHour)}:00`);
  const end = formatTimeLabel(item.segmentEndTime ?? `${pad(endHour)}:00`);
  return `${start}–${end}`;
}

function layoutDay(
  items: CalendarItem[],
  startHour: number,
  endHour: number,
): PositionedEvent[] {
  const timed = items
    .map((item) => ({ item, range: eventRange(item, startHour, endHour) }))
    .filter(
      (entry): entry is { item: CalendarItem; range: { start: number; end: number } } =>
        entry.range !== null &&
        entry.range.end > startHour * 60 &&
        entry.range.start < endHour * 60,
    )
    .sort((a, b) => a.range.start - b.range.start || b.item.task.priority - a.item.task.priority);

  const laneEnds: number[] = [];
  const positioned = timed.map(({ item, range }) => {
    let lane = laneEnds.findIndex((end) => end <= range.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(range.end);
    } else {
      laneEnds[lane] = range.end;
    }

    const start = Math.max(startHour * 60, range.start);
    const end = Math.min(endHour * 60, range.end);
    const top = ((start - startHour * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(22, ((end - start) / 60) * HOUR_HEIGHT - 2);
    return {
      item,
      top,
      height,
      lane,
      laneCount: Math.max(1, laneEnds.length),
      startMinutes: range.start,
      endMinutes: range.end,
    } satisfies PositionedEvent;
  });

  const laneCount = Math.max(1, laneEnds.length);
  return positioned.map((event) => ({ ...event, laneCount }));
}

function buildItems(
  tasks: Task[],
  series: RecurrenceSeries[],
  windowStart: string,
  windowEnd: string,
): CalendarItem[] {
  const items: CalendarItem[] = [];
  const actualKeys = new Set<string>();

  function pushSegments(
    task: Task,
    startDate: string,
    endDate: string,
    virtual: boolean,
  ) {
    const start = startDate;
    const end = endDate >= start ? endDate : start;
    const first = start < windowStart ? windowStart : start;
    const last = end > windowEnd ? windowEnd : end;
    if (first > last) return;

    let date = first;
    while (date <= last) {
      const segment: CalendarSegment =
        start === end
          ? 'single'
          : date === start
            ? 'start'
            : date === end
              ? 'end'
              : 'middle';
      items.push({
        date,
        task,
        virtual,
        segment,
        segmentStartTime: date === start ? task.startTime : null,
        segmentEndTime: date === end ? task.endTime : null,
      });
      date = addDaysKey(date, 1);
    }
  }

  for (const task of tasks) {
    if (task.deletedAt !== null) continue;
    if (task.parentId !== null) continue;
    if (task.status === 'skipped') {
      if (task.seriesId && task.occurrenceDate) {
        actualKeys.add(`${task.seriesId}:${task.occurrenceDate}`);
      }
      continue;
    }
    if (task.seriesId) {
      if (!task.occurrenceDate) continue;
      actualKeys.add(`${task.seriesId}:${task.occurrenceDate}`);
      const displayStart = task.startDate ?? task.occurrenceDate;
      const displayEnd = task.endDate ?? displayStart;
      pushSegments(task, displayStart, displayEnd, false);
      continue;
    }

    if (task.startDate) {
      pushSegments(task, task.startDate, task.endDate ?? task.startDate, false);
    }
  }

  for (const rule of series) {
    if (rule.status !== 'active' || rule.mode === 'completion') continue;
    const base =
      tasks.find(
        (task) =>
          task.seriesId === rule.id &&
          task.deletedAt === null &&
          task.status === 'open',
      ) ??
      tasks.find((task) => task.id === rule.templateTaskId && task.deletedAt === null);
    if (!base) continue;

    const currentDate = base.occurrenceDate ?? rule.dtstartDate;
    const start = currentDate > windowStart ? currentDate : windowStart;

    let occurrences;
    try {
      occurrences = expandSeries(rule, start, windowEnd, {
        isWorkday: isStatutoryWorkday,
        isHoliday: isStatutoryHoliday,
      });
    } catch {
      continue;
    }

    for (const occurrence of occurrences) {
      const key = `${rule.id}:${occurrence.occurrenceDate}`;
      if (actualKeys.has(key)) continue;
      pushSegments(base, occurrence.occurrenceDate, occurrence.occurrenceDate, true);
    }
  }

  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const aTime = a.segmentStartTime ?? a.task.startTime ?? '00:00';
    const bTime = b.segmentStartTime ?? b.task.startTime ?? '00:00';
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return b.task.priority - a.task.priority;
  });
}

interface CalendarBand {
  key: string;
  task: Task;
  virtual: boolean;
  start: string;
  end: string;
}

interface BandSpan {
  band: CalendarBand;
  offset: number;
  length: number;
  lane: number;
}

function bandKey(task: Task, virtual: boolean): string {
  return `${task.id}:${virtual ? 'virtual' : 'actual'}`;
}

/**
 * Collapses the per-day segments back into one band per task occurrence.
 * This is what lets month/week views draw a cross-day task as one bar.
 */
function buildBands(items: CalendarItem[]): CalendarBand[] {
  const map = new Map<string, CalendarBand>();
  for (const item of items) {
    const key = bandKey(item.task, item.virtual);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        task: item.task,
        virtual: item.virtual,
        start: item.date,
        end: item.date,
      });
    } else {
      if (item.date < existing.start) existing.start = item.date;
      if (item.date > existing.end) existing.end = item.date;
    }
  }
  return [...map.values()];
}

/**
 * Greedy lane allocation for bars spanning several day columns. The lane
 * index is stable inside the window, so a task stays on the same visual row
 * from its start date through its end date.
 */
function layoutBands(
  bands: CalendarBand[],
  windowStart: string,
  windowEnd: string,
): BandSpan[] {
  const spans = bands
    .filter((band) => band.start < band.end && band.start <= windowEnd && band.end >= windowStart)
    .map((band) => {
      const start = band.start < windowStart ? windowStart : band.start;
      const end = band.end > windowEnd ? windowEnd : band.end;
      return {
        band,
        offset: Math.max(0, daysBetween(windowStart, start)),
        length: Math.max(1, daysBetween(start, end) + 1),
        lane: 0,
      };
    })
    .sort((a, b) => a.offset - b.offset || b.length - a.length);

  const laneEnds: number[] = [];
  for (const span of spans) {
    let lane = laneEnds.findIndex((end) => end <= span.offset);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.offset + span.length);
    } else {
      laneEnds[lane] = span.offset + span.length;
    }
    span.lane = lane;
  }
  return spans;
}

function CalendarCheck({
  task,
  onToggleTask,
  virtual,
}: {
  task: Task;
  onToggleTask: (task: Task) => void;
  virtual: boolean;
}) {
  const completed = task.status === 'completed';
  if (virtual) return <span className="calendar-check is-virtual" aria-hidden />;
  return (
    <button
      className={`calendar-check ${completed ? 'is-checked' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggleTask(task);
      }}
      aria-label={completed ? '取消完成' : '完成任务'}
    >
      {completed && <Check size={9} strokeWidth={3} />}
    </button>
  );
}

function CalendarChip({
  item,
  project,
  draggable,
  assignees,
  onSelectTask,
  onToggleTask,
}: {
  item: CalendarItem;
  project?: Project;
  draggable: boolean;
  assignees?: Array<{ deviceId: string; name: string }>;
  onSelectTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
}) {
  return (
    <div
      data-task-id={item.task.id}
      className={`calendar-chip segment-${item.segment} ${
        item.task.status === 'completed' ? 'is-completed' : ''
      } ${item.virtual ? 'is-virtual' : ''} ${draggable ? 'is-draggable' : ''}`}
      style={{ '--task-color': project?.color ?? '#3b6ef6' } as CSSProperties}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData('text/plain', item.task.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectTask(item.task);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTask(item.task);
        }
      }}
      title={`${item.task.title} · ${item.date}${draggable ? '（可拖动）' : ''}`}
    >
      <CalendarCheck task={item.task} onToggleTask={onToggleTask} virtual={item.virtual} />
      <span className="calendar-chip-title">{item.task.title}</span>
      {item.task.seriesId && <Repeat size={10} className="calendar-chip-repeat" />}
      {item.task.startTime && (
        <span className="calendar-chip-time">{formatTimeLabel(item.task.startTime)}</span>
      )}
      {assignees && assignees.length > 0 && (
        <AssigneeAvatars
          people={assignees}
          size="xs"
          max={2}
          className="calendar-chip-assignees"
        />
      )}
    </div>
  );
}

function CalendarSpan({
  band,
  project,
  startsHere,
  endsHere,
  assignees,
  onSelectTask,
  onToggleTask,
}: {
  band: CalendarBand;
  project?: Project;
  startsHere: boolean;
  endsHere: boolean;
  assignees?: Array<{ deviceId: string; name: string }>;
  onSelectTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
}) {
  return (
    <div
      data-task-id={band.task.id}
      className={`calendar-span ${startsHere ? 'is-start' : ''} ${
        endsHere ? 'is-end' : ''
      } ${band.task.status === 'completed' ? 'is-completed' : ''} ${
        band.virtual ? 'is-virtual' : ''
      }`}
      style={{ '--task-color': project?.color ?? '#3b6ef6' } as CSSProperties}
      role="button"
      tabIndex={0}
      draggable={!band.virtual}
      onDragStart={(event) => {
        if (band.virtual) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData('text/plain', band.task.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectTask(band.task);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTask(band.task);
        }
      }}
      title={`${band.task.title} · ${band.start} → ${band.end}`}
    >
      <CalendarCheck task={band.task} onToggleTask={onToggleTask} virtual={band.virtual} />
      <span className="calendar-chip-title">{band.task.title}</span>
      {band.task.seriesId && <Repeat size={10} className="calendar-chip-repeat" />}
      {assignees && assignees.length > 0 && (
        <AssigneeAvatars
          people={assignees}
          size="xs"
          max={2}
          className="calendar-chip-assignees"
        />
      )}
    </div>
  );
}

function TimeEvent({
  event,
  project,
  onSelectTask,
  onToggleTask,
  draggable,
  preview,
  canResize,
  startHour,
  assignees,
  onResizeStart,
}: {
  event: PositionedEvent;
  project?: Project;
  onSelectTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  draggable: boolean;
  assignees?: Array<{ deviceId: string; name: string }>;
  preview: ResizePreview | null;
  canResize: boolean;
  startHour: number;
  onResizeStart: (
    event: ReactPointerEvent<HTMLSpanElement>,
    item: CalendarItem,
    edge: ResizeEdge,
    originalStart: number,
    originalEnd: number,
  ) => void;
}) {
  const { item } = event;
  const width = 100 / event.laneCount;
  const completed = item.task.status === 'completed';
  const displayStart = preview?.startMinutes ?? event.startMinutes;
  const displayEnd = preview?.endMinutes ?? event.endMinutes;
  const top = preview
    ? ((displayStart - startHour * 60) / 60) * HOUR_HEIGHT
    : event.top;
  const height = preview
    ? Math.max(22, ((displayEnd - displayStart) / 60) * HOUR_HEIGHT - 2)
    : event.height;
  const range =
    !item.segmentStartTime &&
    !item.segmentEndTime &&
    item.segment !== 'single'
      ? '持续'
      : `${minutesToTime(displayStart)}–${minutesToTime(displayEnd)}`;
  const canResizeStart = canResize && (item.segment === 'single' || item.segment === 'start');
  const canResizeEnd = canResize && (item.segment === 'single' || item.segment === 'end');

  return (
    <div
      className={`time-event segment-${item.segment} ${
        completed ? 'is-completed' : ''
      } ${item.virtual ? 'is-virtual' : ''} ${
        draggable ? 'is-draggable' : ''
      } ${preview ? 'is-resizing' : ''}`}
      style={
        {
          '--task-color': project?.color ?? '#3b6ef6',
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${event.lane * width}% + 2px)`,
          width: `calc(${width}% - 4px)`,
        } as CSSProperties
      }
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(dragEvent) => {
        if (!draggable) {
          dragEvent.preventDefault();
          return;
        }
        dragEvent.dataTransfer.setData('text/plain', item.task.id);
        const rect = dragEvent.currentTarget.getBoundingClientRect();
        const grabOffset = Math.max(
          0,
          ((dragEvent.clientY - rect.top) / HOUR_HEIGHT) * 60,
        );
        dragEvent.dataTransfer.setData(
          'application/x-dayline-grab-offset',
          String(grabOffset),
        );
        dragEvent.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelectTask(item.task);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTask(item.task);
        }
      }}
      title={item.task.title}
    >
      <div className="time-event-title">
        <CalendarCheck task={item.task} onToggleTask={onToggleTask} virtual={item.virtual} />
        <span>{item.task.title}</span>
        {item.task.seriesId && <Repeat size={10} />}
        {assignees && assignees.length > 0 && (
          <AssigneeAvatars
            people={assignees}
            size="xs"
            max={2}
            className="time-event-assignees"
          />
        )}
      </div>
      <div className="time-event-range">{range}</div>
      {canResizeStart && (
        <span
          className="time-event-resize is-start"
          onPointerDown={(pointerEvent) =>
            onResizeStart(
              pointerEvent,
              item,
              'start',
              event.startMinutes,
              event.endMinutes,
            )
          }
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          aria-label="拖动调整开始时间"
        />
      )}
      {canResizeEnd && (
        <span
          className="time-event-resize is-end"
          onPointerDown={(pointerEvent) =>
            onResizeStart(
              pointerEvent,
              item,
              'end',
              event.startMinutes,
              event.endMinutes,
            )
          }
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          aria-label="拖动调整结束时间"
        />
      )}
    </div>
  );
}

export function CalendarView({
  mode,
  anchor,
  selectedDate,
  tasks,
  series,
  projects,
  preferences,
  onPreferencesChange,
  onSelectDate,
  onNavigateDate,
  onSelectTask,
  onToggleTask,
  onMoveTask,
  onResizeTask,
  onResizeTaskStart,
  onAddTask,
  onPrev,
  onNext,
  onToday,
  onModeChange,
  assigneesForTask,
}: CalendarViewProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [festivalLabels, setFestivalLabels] = useState<Record<string, string | null>>({});
  const startHour = preferences.calendar.startHour;
  const endHour = preferences.calendar.endHour;
  const days =
    mode === 'day'
      ? [anchor]
      : mode === 'threeDay'
        ? scheduleDays(anchor, 3)
        : mode === 'week'
          ? weekDays(anchor)
          : mode === 'month'
            ? monthDays(anchor)
            : mode === 'schedule'
              ? scheduleDays(anchor, 14)
              : mode === 'twoWeek'
                ? scheduleDays(startOfWeek(anchor), 14)
                : [];
  const year = parseLocalDateKey(anchor).getFullYear();
  const windowStart =
    mode === 'year' ? `${year}-01-01` : days[0] ?? localDateKey(new Date());
  const windowEnd =
    mode === 'year' ? `${year}-12-31` : days[days.length - 1] ?? windowStart;
  const items = buildItems(tasks, series, windowStart, windowEnd);
  const itemsByDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.date) ?? [];
    list.push(item);
    itemsByDate.set(item.date, list);
  }
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const bands = buildBands(items);

  // Keep the configured window as the default, but expand it when a timed task
  // starts earlier or ends later. Tasks before 08:00 are then fully visible
  // without changing the saved preference.
  let earliestMinute = startHour * 60;
  let latestMinute = endHour * 60;
  for (const item of items) {
    if (!item.task.startTime) continue;
    if (item.segment === 'single' || item.segment === 'start') {
      const start = timeToMinutes(item.segmentStartTime ?? item.task.startTime);
      if (start !== null) earliestMinute = Math.min(earliestMinute, start);
    }
    if (item.segment === 'single') {
      const end = timeToMinutes(item.segmentEndTime ?? item.task.endTime);
      if (end !== null) {
        latestMinute = Math.max(latestMinute, end);
      } else {
        const start = timeToMinutes(item.task.startTime) ?? 0;
        latestMinute = Math.max(latestMinute, start + 60);
      }
    } else if (item.segment === 'end') {
      const end = timeToMinutes(item.segmentEndTime);
      if (end !== null) latestMinute = Math.max(latestMinute, end);
    }
  }
  const gridStartHour = Math.max(
    0,
    Math.min(startHour, Math.floor(earliestMinute / 60)),
  );
  const gridEndHour = Math.min(
    24,
    Math.max(endHour, Math.ceil(latestMinute / 60)),
  );
  const totalHeight = (gridEndHour - gridStartHour) * HOUR_HEIGHT;

  const monthWeeks =
    mode === 'month'
      ? Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7)).map(
          (week) => {
            const start = week[0] ?? windowStart;
            const end = week[week.length - 1] ?? start;
            const spans = layoutBands(bands, start, end);
            const laneCount = spans.length
              ? Math.max(...spans.map((span) => span.lane)) + 1
              : 0;
            const multiKeys = new Set(spans.map((span) => span.band.key));
            return { week, start, end, spans, laneCount, multiKeys };
          },
        )
      : [];
  const today = localDateKey(new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    if (!resizePreview) return;
    const task = tasks.find((item) => item.id === resizePreview.taskId);
    if (!task) return;
    if (
      resizePreview.edge === 'start' &&
      timeToMinutes(task.startTime) === resizePreview.startMinutes
    ) {
      setResizePreview(null);
    } else if (
      resizePreview.edge === 'end' &&
      timeToMinutes(task.endTime) === resizePreview.endMinutes
    ) {
      setResizePreview(null);
    }
  }, [tasks, resizePreview]);

  useEffect(() => {
    if (mode !== 'month') return;
    let cancelled = false;
    const anchorMonth = parseLocalDateKey(anchor).getMonth();
    const dates = days.filter(
      (date) => parseLocalDateKey(date).getMonth() === anchorMonth,
    );
    void loadFestivalLabels(dates).then((labels) => {
      if (!cancelled) setFestivalLabels(labels);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, anchor, windowStart, windowEnd]);

  function drop(event: DragEvent, date: string, time?: string | null) {
    event.preventDefault();
    setDragOverKey(null);
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) onMoveTask(taskId, date, time);
  }

  function dropAtPosition(event: DragEvent, date: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const pointerMinutes = gridStartHour * 60 + (y / HOUR_HEIGHT) * 60;
    const rawOffset = Number(
      event.dataTransfer.getData('application/x-dayline-grab-offset') || 0,
    );
    const grabOffset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
    const snapped = Math.round((pointerMinutes - grabOffset) / 15) * 15;
    const clamped = Math.max(
      gridStartHour * 60,
      Math.min(gridEndHour * 60 - 15, snapped),
    );
    drop(event, date, minutesToTime(clamped));
  }

  function dragOver(event: DragEvent, key: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) setDragOverKey(key);
  }

  function startResize(
    event: ReactPointerEvent<HTMLSpanElement>,
    item: CalendarItem,
    edge: ResizeEdge,
    originalStart: number,
    originalEnd: number,
  ) {
    if (item.virtual || !item.task.startTime) return;
    event.preventDefault();
    event.stopPropagation();

    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = null;
    }

    const handle = event.currentTarget;
    const startY = event.clientY;
    const minStart = gridStartHour * 60;
    const maxStart = Math.max(minStart, originalEnd - 15);
    const minEnd = originalStart + 15;
    const maxEnd = gridEndHour * 60;
    const key = `${item.task.id}:${item.date}`;
    let finalStart = originalStart;
    let finalEnd = originalEnd;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; handle listeners still keep the drag.
    }

    function move(moveEvent: PointerEvent) {
      const delta =
        Math.round((((moveEvent.clientY - startY) / HOUR_HEIGHT) * 60) / 15) * 15;
      if (edge === 'start') {
        finalStart = Math.max(minStart, Math.min(maxStart, originalStart + delta));
      } else {
        finalEnd = Math.max(minEnd, Math.min(maxEnd, originalEnd + delta));
      }
      setResizePreview({
        key,
        taskId: item.task.id,
        startMinutes: finalStart,
        endMinutes: finalEnd,
        edge,
      });
    }

    function finish(commit: boolean) {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', cancel);

      const changed =
        commit &&
        (edge === 'start' ? finalStart !== originalStart : finalEnd !== originalEnd);

      if (!changed) {
        setResizePreview(null);
        return;
      }

      // Keep the preview on screen until the parent task update arrives. This
      // avoids the brief jump back to the old time after releasing the pointer.
      if (edge === 'start') {
        onResizeTaskStart(item.task.id, item.date, minutesToTime(finalStart));
      } else {
        onResizeTask(item.task.id, item.date, minutesToTime(finalEnd));
      }
      resizeTimerRef.current = window.setTimeout(() => {
        resizeTimerRef.current = null;
        setResizePreview((current) => (current?.key === key ? null : current));
      }, 2500);
    }

    function up() {
      finish(true);
    }

    function cancel() {
      finish(false);
    }

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', cancel);
  }

  function renderChip(item: CalendarItem) {
    return (
      <CalendarChip
        key={`${item.task.id}:${item.date}:${item.virtual ? 'v' : 'a'}`}
        item={item}
        project={projectMap.get(item.task.projectId)}
        draggable={!item.virtual}
        assignees={assigneesForTask?.(item.task)}
        onSelectTask={onSelectTask}
        onToggleTask={onToggleTask}
      />
    );
  }

  function renderTimeGrid(gridDays: string[]) {
    const gridTemplate = { gridTemplateColumns: `64px repeat(${gridDays.length}, minmax(0, 1fr))` };
    const gridStart = gridDays[0] ?? windowStart;
    const gridEnd = gridDays[gridDays.length - 1] ?? windowEnd;
    const allDaySpans = layoutBands(
      bands.filter((band) => !band.task.startTime),
      gridStart,
      gridEnd,
    );
    const allDayLaneCount = allDaySpans.length
      ? Math.max(...allDaySpans.map((span) => span.lane)) + 1
      : 0;
    const multiDayKeys = new Set(allDaySpans.map((span) => span.band.key));

    return (
      <div className="time-scroll">
        <div className="time-header" style={gridTemplate}>
          <div className="time-axis-spacer" />
          {gridDays.map((date) => {
            const parsed = parseLocalDateKey(date);
            return (
              <div
                key={date}
                className={`time-head ${date === today ? 'is-today' : ''}`}
                data-date={date}
                onClick={() => onSelectDate(date)}
              >
                <span>{WEEKDAY_LABELS[parsed.getDay()]}</span>
                <strong>{parsed.getDate()}</strong>
              </div>
            );
          })}
        </div>

        <div className="time-allday" style={gridTemplate}>
          <div className="time-axis-allday">全天</div>
          <div
            className="time-allday-main"
            style={{ gridColumn: `span ${gridDays.length}` }}
          >
            <div
              className="time-allday-days"
              style={{ gridTemplateColumns: `repeat(${gridDays.length}, minmax(0, 1fr))` }}
            >
              {gridDays.map((date) => (
                <div
                  key={date}
                  className={`time-allday-cell ${dragOverKey === `allday-${date}` ? 'is-drag-over' : ''}`}
                  data-date={date}
                  style={{ paddingTop: 3 + allDayLaneCount * 20 }}
                  onDragOver={(event) => dragOver(event, `allday-${date}`)}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(event) => drop(event, date, null)}
                  onClick={() => onSelectDate(date)}
                >
                  {(itemsByDate.get(date) ?? [])
                    .filter(
                      (item) =>
                        !item.task.startTime &&
                        !multiDayKeys.has(bandKey(item.task, item.virtual)),
                    )
                    .map(renderChip)}
                </div>
              ))}
            </div>

            {allDaySpans.length > 0 && (
              <div
                className="time-allday-spans"
                style={{
                  gridTemplateColumns: `repeat(${gridDays.length}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${allDayLaneCount}, 20px)`,
                }}
              >
                {allDaySpans.map((span) => (
                  <div
                    key={span.band.key}
                    className="time-allday-span-slot"
                    style={{
                      gridColumn: `${span.offset + 1} / span ${span.length}`,
                      gridRow: span.lane + 1,
                    }}
                  >
                    <CalendarSpan
                      band={span.band}
                      project={projectMap.get(span.band.task.projectId)}
                      startsHere={span.band.start >= gridStart}
                      endsHere={span.band.end <= gridEnd}
                      assignees={assigneesForTask?.(span.band.task)}
                      onSelectTask={onSelectTask}
                      onToggleTask={onToggleTask}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="time-body">
          <div className="time-axis" style={{ height: totalHeight }}>
            {Array.from({ length: gridEndHour - gridStartHour }, (_, index) => {
              const hour = gridStartHour + index;
              return (
                <span
                  key={hour}
                  className="time-axis-label"
                  style={{ top: index * HOUR_HEIGHT }}
                >
                  {hour === 12 ? '正午' : `${pad(hour)}:00`}
                </span>
              );
            })}
          </div>

          <div
            className="time-columns"
            style={{
              height: totalHeight,
              gridTemplateColumns: `repeat(${gridDays.length}, minmax(0, 1fr))`,
            }}
          >
            {gridDays.map((date) => {
              const dayItems = itemsByDate.get(date) ?? [];
              const positioned = layoutDay(dayItems, gridStartHour, gridEndHour);
              return (
                <div
                  key={date}
                  className={`time-column ${date === selectedDate ? 'is-selected' : ''} ${
                    dragOverKey === date ? 'is-drag-over' : ''
                  }`}
                  data-date={date}
                  style={{ height: totalHeight }}
                  onDragOver={(event) => dragOver(event, date)}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(event) => dropAtPosition(event, date)}
                  onClick={() => onSelectDate(date)}
                >
                  {positioned.map((event) => (
                    <TimeEvent
                      key={`${event.item.task.id}:${event.item.date}:${event.item.virtual ? 'v' : 'a'}`}
                      event={event}
                      project={projectMap.get(event.item.task.projectId)}
                      onSelectTask={onSelectTask}
                      onToggleTask={onToggleTask}
                      draggable={!event.item.virtual}
                      preview={
                        resizePreview?.key === `${event.item.task.id}:${event.item.date}`
                          ? resizePreview
                          : null
                      }
                      canResize={
                        !event.item.virtual && event.item.task.startTime !== null
                      }
                      startHour={gridStartHour}
                      assignees={assigneesForTask?.(event.item.task)}
                      onResizeStart={startResize}
                    />
                  ))}
                  {date === today &&
                    nowMinutes >= gridStartHour * 60 &&
                    nowMinutes < gridEndHour * 60 && (
                      <div
                        className="time-now-line"
                        style={{
                          top: `${((nowMinutes - gridStartHour * 60) / 60) * HOUR_HEIGHT}px`,
                        }}
                      />
                    )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderTwoWeek() {
    return (
      <div className="two-week-grid">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="two-week-weekday">
            {label}
          </div>
        ))}
        {days.map((date) => {
          const parsed = parseLocalDateKey(date);
          const dayItems = itemsByDate.get(date) ?? [];
          return (
            <div
              key={date}
              className={`two-week-cell ${date === selectedDate ? 'is-selected' : ''} ${
                date === today ? 'is-today' : ''
              } ${dragOverKey === date ? 'is-drag-over' : ''}`}
              onClick={() => onSelectDate(date)}
              onDragOver={(event) => dragOver(event, date)}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={(event) => drop(event, date)}
            >
              <div className="two-week-day">{parsed.getDate()}</div>
              <div className="two-week-items">
                {dayItems.slice(0, 4).map(renderChip)}
                {dayItems.length > 4 && (
                  <span className="calendar-more">+{dayItems.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderSchedule() {
    const visibleDays = days.filter((date) => (itemsByDate.get(date)?.length ?? 0) > 0);
    if (visibleDays.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <CalendarDays size={28} />
          </div>
          <h3>这段时间没有安排</h3>
          <p>用上方输入框添加任务，或切换到其他日期。</p>
        </div>
      );
    }

    return (
      <div className="schedule-view">
        {visibleDays.map((date) => {
          const parsed = parseLocalDateKey(date);
          const dayItems = itemsByDate.get(date) ?? [];
          return (
            <div key={date} className="schedule-day">
              <div className="schedule-date">
                <strong>{parsed.getDate()}</strong>
                <span>{WEEKDAY_LABELS[parsed.getDay()]}</span>
              </div>
              <div className="schedule-items">
                {dayItems.map((item) => (
                  <div
                    key={`${item.task.id}:${item.date}:${item.virtual ? 'v' : 'a'}`}
                    className={`schedule-event ${item.task.status === 'completed' ? 'is-completed' : ''} ${
                      item.virtual ? 'is-virtual' : ''
                    }`}
                    style={{ '--task-color': projectMap.get(item.task.projectId)?.color ?? '#3b6ef6' } as CSSProperties}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectTask(item.task)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectTask(item.task);
                      }
                    }}
                  >
                    <div className="schedule-event-head">
                      <CalendarCheck
                        task={item.task}
                        onToggleTask={onToggleTask}
                        virtual={item.virtual}
                      />
                      <span>{item.task.title}</span>
                      {item.task.seriesId && <Repeat size={11} />}
                    </div>
                    <div className="schedule-event-meta">
                      {item.task.startTime
                        ? rangeLabel(item, gridStartHour, gridEndHour)
                        : '全天'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderYear() {
    return (
      <div className="year-grid">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const monthDate = `${year}-${pad(monthIndex + 1)}-01`;
          const cells = yearMonthDays(anchor, monthIndex);
          return (
            <section key={monthIndex} className="year-month">
              <button
                className="year-month-title"
                onClick={() => {
                  onNavigateDate(monthDate);
                  onModeChange('month');
                }}
              >
                {monthIndex + 1}月
              </button>
              <div className="mini-weekdays">
                {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="mini-grid">
                {cells.map((date) => {
                  const parsed = parseLocalDateKey(date);
                  const outside = parsed.getMonth() !== monthIndex;
                  const count = itemsByDate.get(date)?.length ?? 0;
                  const heat = Math.min(4, count);
                  return (
                    <button
                      key={date}
                      className={`mini-day ${outside ? 'is-outside' : ''} ${
                        date === today && !outside ? 'is-today' : ''
                      } heat-${heat}`}
                      onClick={() => {
                        if (outside) return;
                        onNavigateDate(date);
                        onSelectDate(date);
                        onModeChange('day');
                      }}
                      title={count > 0 ? `${count} 个任务` : undefined}
                    >
                      {parsed.getDate()}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <section className="calendar">
      <div className="calendar-toolbar">
        <div className="calendar-title">
          <CalendarDays size={18} />
          <strong>{rangeTitle(anchor, mode)}</strong>
        </div>
        <div className="calendar-actions">
          <button className="icon-button" onClick={onAddTask} aria-label="添加任务">
            <Plus size={18} />
          </button>
          <Select
            className="calendar-view-select"
            value={mode}
            onChange={(value) => onModeChange(value as CalendarMode)}
            options={[
              { value: 'year', label: '年视图' },
              { value: 'month', label: '月视图' },
              { value: 'week', label: '周视图' },
              { value: 'day', label: '日视图' },
              { value: 'schedule', label: '日程视图' },
              { value: 'threeDay', label: '多日视图' },
              { value: 'twoWeek', label: '多周视图' },
            ]}
            ariaLabel="日历视图"
          />
          <div className="calendar-nav">
            <button className="icon-button small" onClick={onPrev} aria-label="上一段时间">
              <ChevronLeft size={17} />
            </button>
            <button className="button ghost small" onClick={onToday}>
              今天
            </button>
            <button className="icon-button small" onClick={onNext} aria-label="下一段时间">
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="calendar-settings-wrap">
            <button
              className="icon-button small"
              onClick={() => setShowSettings((current) => !current)}
              aria-label="日历显示设置"
              aria-expanded={showSettings}
            >
              <MoreHorizontal size={17} />
            </button>
            {showSettings && (
              <div className="calendar-settings-popover">
                <strong>显示时段</strong>
                <div className="calendar-setting-row">
                  <span>开始</span>
                  <Select
                    value={String(startHour)}
                    onChange={(value) =>
                      onPreferencesChange({
                        calendar: {
                          startHour: Number(value),
                          endHour,
                        },
                      })
                    }
                    options={Array.from({ length: 24 }, (_, hour) => ({
                      value: String(hour),
                      label: `${pad(hour)}:00`,
                    }))}
                    ariaLabel="日历开始小时"
                  />
                </div>
                <div className="calendar-setting-row">
                  <span>结束</span>
                  <Select
                    value={String(endHour)}
                    onChange={(value) =>
                      onPreferencesChange({
                        calendar: {
                          startHour,
                          endHour: Number(value),
                        },
                      })
                    }
                    options={Array.from({ length: 24 }, (_, index) => {
                      const hour = index + 1;
                      return {
                        value: String(hour),
                        label: `${pad(hour)}:00`,
                      };
                    })}
                    ariaLabel="日历结束小时"
                  />
                </div>
                <span className="field-hint">
                  超出时段的任务会自动扩展时间轴，不会修改任务时间。
                </span>
                <button className="button ghost small" onClick={() => setShowSettings(false)}>
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === 'year' ? (
        renderYear()
      ) : mode === 'schedule' ? (
        renderSchedule()
      ) : mode === 'twoWeek' ? (
        renderTwoWeek()
      ) : mode === 'month' ? (
        <div className="month-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="month-weekday">
              {label}
            </div>
          ))}
          {monthWeeks.map(({ week, start, end, spans, laneCount, multiKeys }) => (
            <div className="month-week" key={week[0]}>
              <div className="month-week-days">
                {week.map((date) => {
                  const dayItems = (itemsByDate.get(date) ?? []).filter(
                    (item) => !multiKeys.has(bandKey(item.task, item.virtual)),
                  );
                  const parsed = parseLocalDateKey(date);
                  const outside =
                    parsed.getMonth() !== parseLocalDateKey(anchor).getMonth();
                  const festival = outside ? null : festivalLabels[date] ?? null;
                  const holiday = outside ? null : holidayInfo(date);
                  const limit = laneCount > 0 ? 4 : 5;
                  return (
                    <div
                      key={date}
                      className={`month-cell ${outside ? 'is-outside' : ''} ${
                        date === selectedDate ? 'is-selected' : ''
                      } ${date === today && !outside ? 'is-today' : ''} ${
                        dragOverKey === date ? 'is-drag-over' : ''
                      }`}
                      data-date={date}
                      onClick={() => onSelectDate(date)}
                      onDragOver={(event) => dragOver(event, date)}
                      onDragLeave={() => setDragOverKey(null)}
                      onDrop={(event) => drop(event, date)}
                    >
                      <div className="month-day-head">
                        <div className="month-day-number">{parsed.getDate()}</div>
                        <div className="month-day-tags">
                          {festival && <span className="month-festival">{festival}</span>}
                          {holiday && (
                            <span className={`month-holiday ${holiday.type}`}>
                              {holiday.type === 'holiday' ? '休' : '班'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className="month-items"
                        style={laneCount > 0 ? { paddingTop: laneCount * 20 } : undefined}
                      >
                        {dayItems.slice(0, limit).map(renderChip)}
                        {dayItems.length > limit && (
                          <span className="calendar-more">
                            +{dayItems.length - limit}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {spans.length > 0 && (
                <div
                  className="month-week-spans"
                  style={{ gridTemplateRows: `repeat(${laneCount}, 20px)` }}
                >
                  {spans.map((span) => (
                    <div
                      key={span.band.key}
                      className="month-span-slot"
                      style={{
                        gridColumn: `${span.offset + 1} / span ${span.length}`,
                        gridRow: span.lane + 1,
                      }}
                    >
                      <CalendarSpan
                        band={span.band}
                        project={projectMap.get(span.band.task.projectId)}
                        startsHere={span.band.start >= start}
                        endsHere={span.band.end <= end}
                        assignees={assigneesForTask?.(span.band.task)}
                        onSelectTask={onSelectTask}
                        onToggleTask={onToggleTask}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        renderTimeGrid(days)
      )}

      <div className="calendar-view-switcher">
        {(
          [
            ['year', '年视图'],
            ['month', '月视图'],
            ['week', '周视图'],
            ['day', '日视图'],
            ['schedule', '日程视图'],
            ['threeDay', '多日视图'],
            ['twoWeek', '多周视图'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={mode === value ? 'is-active' : ''}
            onClick={() => onModeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
