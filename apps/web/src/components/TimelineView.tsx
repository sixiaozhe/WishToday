import { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDaysKey,
  daysBetween,
  formatDateLabel,
  localDateKey,
  parseLocalDateKey,
  todayKey,
  type Project,
  type Task,
} from '@dayline/core';
import { AssigneeAvatars } from './AssigneeAvatars';

interface TimelineViewProps {
  tasks: Task[];
  projects: Project[];
  anchor: string;
  days?: number;
  selectedTaskId: string | null;
  onSelect: (task: Task) => void;
  onMove: (task: Task, date: string) => void;
  onToggle: (task: Task) => void;
  onAnchorChange: (date: string) => void;
  assigneesForTask?: (task: Task) => Array<{
    deviceId: string;
    name: string;
  }>;
}

const DAY_WIDTH = 58;

export function TimelineView({
  tasks,
  projects,
  anchor,
  days = 14,
  selectedTaskId,
  onSelect,
  onMove,
  onToggle,
  onAnchorChange,
  assigneesForTask,
}: TimelineViewProps) {
  const start = addDaysKey(anchor, -2);
  const dateKeys = useMemo(
    () => Array.from({ length: days }, (_, index) => addDaysKey(start, index)),
    [start, days],
  );
  const end = dateKeys[dateKeys.length - 1] ?? anchor;
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const visible = tasks
    .filter(
      (task) =>
        task.deletedAt === null &&
        task.parentId === null &&
        task.startDate !== null &&
        task.startDate <= end &&
        (task.endDate ?? task.startDate) >= start,
    )
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  const unscheduled = tasks.filter(
    (task) => task.deletedAt === null && task.parentId === null && task.startDate === null,
  );

  function span(task: Task): { offset: number; length: number } {
    const taskStart = task.startDate ?? start;
    const taskEnd = task.endDate ?? task.startDate ?? taskStart;
    const offset = Math.max(0, daysBetween(start, taskStart));
    const length = Math.max(1, daysBetween(taskStart, taskEnd) + 1);
    return { offset, length: Math.min(length, days - offset) };
  }

  return (
    <div className="timeline-wrap">
      <div className="view-toolbar">
        <div className="timeline-nav">
          <button
            className="icon-button small"
            onClick={() => onAnchorChange(addDaysKey(anchor, -7))}
            aria-label="上一周"
          >
            <ChevronLeft size={16} />
          </button>
          <button className="button ghost small" onClick={() => onAnchorChange(todayKey())}>
            <CalendarDays size={14} />
            今天
          </button>
          <button
            className="icon-button small"
            onClick={() => onAnchorChange(addDaysKey(anchor, 7))}
            aria-label="下一周"
          >
            <ChevronRight size={16} />
          </button>
          <span className="timeline-range">
            {formatDateLabel(start)} – {formatDateLabel(end)}
          </span>
        </div>
        <span className="shortcut-hint">拖动任务条可改期</span>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-table" style={{ width: 180 + dateKeys.length * DAY_WIDTH }}>
          <div className="timeline-head">
            <div className="timeline-label-cell">任务</div>
            {dateKeys.map((date) => {
              const parsed = parseLocalDateKey(date);
              const today = date === todayKey();
              return (
                <div
                  key={date}
                  className={`timeline-day-head ${today ? 'is-today' : ''}`}
                  style={{ width: DAY_WIDTH }}
                >
                  <span>{parsed.getMonth() + 1}/{parsed.getDate()}</span>
                  <em>{'日一二三四五六'[parsed.getDay()]}</em>
                </div>
              );
            })}
          </div>

          <div className="timeline-body">
            {visible.map((task) => {
              const { offset, length } = span(task);
              const project = projectById.get(task.projectId);
              return (
                <div key={task.id} className="timeline-row">
                  <button
                    data-task-id={task.id}
                    className={`timeline-label ${selectedTaskId === task.id ? 'is-selected' : ''}`}
                    onClick={() => onSelect(task)}
                  >
                    <span
                      className={`check tiny ${task.status === 'completed' ? 'is-checked' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(task);
                      }}
                    >
                      {task.status === 'completed' ? '✓' : ''}
                    </span>
                    <span className="timeline-label-text">{task.title}</span>
                  </button>
                  <div className="timeline-track" style={{ width: dateKeys.length * DAY_WIDTH }}>
                    {dateKeys.map((date) => (
                      <div
                        key={date}
                        className="timeline-grid-cell"
                        style={{ width: DAY_WIDTH }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const taskId = event.dataTransfer.getData('text/plain');
                          const dropped = tasks.find((item) => item.id === taskId);
                          if (dropped) onMove(dropped, date);
                        }}
                      />
                    ))}
                    <button
                      data-task-id={task.id}
                      className={`timeline-bar ${task.status === 'completed' ? 'is-completed' : ''}`}
                      style={{
                        left: offset * DAY_WIDTH + 3,
                        width: length * DAY_WIDTH - 6,
                        background: project?.color ?? 'var(--accent)',
                      }}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', task.id);
                      }}
                      onClick={() => onSelect(task)}
                      title={task.title}
                    >
                      <span className="timeline-bar-title">{task.title}</span>
                      {assigneesForTask && (
                        <AssigneeAvatars
                          people={assigneesForTask(task)}
                          size="xs"
                          max={2}
                          className="timeline-assignees"
                        />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="timeline-empty">这段时间没有已安排的任务。</div>
            )}
          </div>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="unscheduled">
          <h3>未安排</h3>
          <div className="unscheduled-list">
            {unscheduled.map((task) => (
              <button
                key={task.id}
                className="unscheduled-chip"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', task.id);
                }}
                onClick={() => onSelect(task)}
              >
                {task.title}
              </button>
            ))}
          </div>
          <p className="field-hint">把未安排任务拖到上方日期即可排期。</p>
        </div>
      )}
    </div>
  );
}
