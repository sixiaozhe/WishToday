import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckSquare,
  Flag,
  Repeat,
  RotateCcw,
  SkipForward,
  Square,
  Trash2,
} from 'lucide-react';
import {
  formatDateLabel,
  formatTimeLabel,
  type Project,
  type Tag,
  type Task,
} from '@dayline/core';

interface TaskRowProps {
  task: Task;
  project?: Project;
  tags: Tag[];
  selected: boolean;
  checked: boolean;
  onSelect: (task: Task) => void;
  onCheck: (task: Task) => void;
  onToggle: (task: Task) => void;
  onDropTask: (draggedId: string, target: Task) => void;
  onTrash: (task: Task) => void;
  onRestore: (task: Task) => void;
  onRestart: (task: Task) => void;
}

const PRIORITY_LABEL: Record<number, string> = {
  0: '无优先级',
  1: '低优先级',
  3: '中优先级',
  5: '高优先级',
};

export function TaskRow({
  task,
  project,
  tags,
  selected,
  checked,
  onSelect,
  onCheck,
  onToggle,
  onDropTask,
  onTrash,
  onRestore,
  onRestart,
}: TaskRowProps) {
  const taskTags = tags.filter((tag) => task.tagIds.includes(tag.id));
  const completed = task.status === 'completed';
  const abandoned = task.status === 'abandoned';
  const skipped = task.status === 'skipped';
  const deleted = task.deletedAt !== null;
  const [completing, setCompleting] = useState(false);
  const completeTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current);
      }
    },
    [],
  );

  function handleCompleteClick() {
    if (skipped) {
      onRestore(task);
      return;
    }
    if (abandoned) {
      onRestart(task);
      return;
    }
    if (completing) return;
    if (completed) {
      onToggle(task);
      return;
    }
    // Match the calendar-style completion beat: the check fills immediately,
    // the row fades for a moment, then the task leaves the open list.
    setCompleting(true);
    completeTimerRef.current = window.setTimeout(() => {
      completeTimerRef.current = null;
      onToggle(task);
      // Keep the completing style until the task actually leaves the list.
      // If the write fails and the row stays open, clear it after a fallback.
      completeTimerRef.current = window.setTimeout(() => {
        completeTimerRef.current = null;
        setCompleting(false);
      }, 1500);
    }, 170);
  }

  useEffect(() => {
    if (task.status === 'completed' && completing) {
      setCompleting(false);
    }
  }, [task.status, completing]);

  return (
    <div
      className={`task-row ${selected ? 'is-selected' : ''} ${completed ? 'is-completed' : ''} ${
        skipped ? 'is-skipped' : ''
      } ${abandoned ? 'is-abandoned' : ''} ${deleted ? 'is-deleted' : ''} ${
        completing ? 'is-completing' : ''
      }`}
      data-task-id={task.id}
      onClick={() => onSelect(task)}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', task.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === task.id) return;
        onDropTask(draggedId, task);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(task);
        }
      }}
    >
      <button
        className={`select-check ${checked ? 'is-checked' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          onCheck(task);
        }}
        aria-label={checked ? '取消选择任务' : '选择任务'}
        title="多选"
      >
        {checked ? <CheckSquare size={15} /> : <Square size={15} />}
      </button>

      <button
        className={`check ${completed || completing ? 'is-checked' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          handleCompleteClick();
        }}
        aria-label={
          skipped
            ? '恢复此周期'
            : abandoned
              ? '重新开始'
              : completed
                ? '取消完成'
                : '完成任务'
        }
      >
        {skipped ? (
          <SkipForward size={11} />
        ) : (
          (completed || completing) && <Check size={13} strokeWidth={3} />
        )}
      </button>

      <div className="task-main">
        <div className="task-title-line">
          {task.priority > 0 && (
            <Flag
              size={14}
              className={`priority-flag priority-${task.priority}`}
              aria-label={PRIORITY_LABEL[task.priority]}
            />
          )}
          <span className="task-title">{task.title}</span>
          {task.seriesId && <Repeat size={12} className="repeat-indicator" aria-label="重复任务" />}
        </div>

        <div className="task-meta">
          {task.startDate && (
            <span className="meta-item">
              <CalendarDays size={13} />
              {formatDateLabel(task.startDate)}
              {task.startTime ? ` ${formatTimeLabel(task.startTime)}` : ''}
            </span>
          )}
          {project && !project.isInbox && (
            <span className="meta-item">
              <span className="project-dot small" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {taskTags.map((tag) => (
            <span key={tag.id} className="tag-chip small">
              <span className="tag-dot" style={{ background: tag.color }} />
              {tag.name}
            </span>
          ))}
          {abandoned && <span className="meta-item">已放弃</span>}
          {skipped && <span className="meta-item">已跳过</span>}
          {deleted && <span className="meta-item danger">已删除</span>}
        </div>
      </div>

      <div className="task-actions">
        {deleted || skipped ? (
          <button
            className="icon-button small"
            onClick={(event) => {
              event.stopPropagation();
              onRestore(task);
            }}
            aria-label="恢复任务"
          >
            <RotateCcw size={15} />
          </button>
        ) : (
          <button
            className="icon-button small"
            onClick={(event) => {
              event.stopPropagation();
              onTrash(task);
            }}
            aria-label="删除任务"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
