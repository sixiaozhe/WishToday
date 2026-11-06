import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  addDaysKey,
  formatDateLabel,
  isOverdue,
  todayKey,
  type Priority,
  type Task,
  type TaskPatch,
} from '@dayline/core';

interface MatrixViewProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelect: (task: Task) => void;
  onToggle: (task: Task) => void;
  onUpdate: (task: Task, patch: TaskPatch) => void;
}

type QuadrantId = 'do' | 'plan' | 'delegate' | 'later';

const QUADRANTS: Array<{
  id: QuadrantId;
  title: string;
  hint: string;
  color: string;
}> = [
  { id: 'do', title: '重要且紧急', hint: '立即做', color: '#ef4444' },
  { id: 'plan', title: '重要不紧急', hint: '安排时间做', color: '#3b6ef6' },
  { id: 'delegate', title: '紧急不重要', hint: '尽快处理或委托', color: '#f59e0b' },
  { id: 'later', title: '不重要不紧急', hint: '有空再做', color: '#94a3b8' },
];

export function MatrixView({
  tasks,
  selectedTaskId,
  onSelect,
  onToggle,
  onUpdate,
}: MatrixViewProps) {
  const today = todayKey();

  function quadrantOf(task: Task): QuadrantId {
    const urgent =
      task.startDate !== null &&
      (task.startDate <= today || isOverdue(task.startDate));
    const important = task.priority >= 3;
    if (important && urgent) return 'do';
    if (important) return 'plan';
    if (urgent) return 'delegate';
    return 'later';
  }

  function moveTo(task: Task, quadrant: QuadrantId) {
    const patch: TaskPatch = {};
    if (quadrant === 'do') {
      patch.priority = 5 as Priority;
      patch.startDate = today;
    } else if (quadrant === 'plan') {
      patch.priority = 3 as Priority;
      patch.startDate = task.startDate && task.startDate > today ? task.startDate : addDaysKey(today, 7);
    } else if (quadrant === 'delegate') {
      patch.priority = 1 as Priority;
      patch.startDate = today;
    } else {
      patch.priority = 1 as Priority;
      patch.startDate = null;
    }
    onUpdate(task, patch);
  }

  const open = tasks.filter(
    (task) => task.deletedAt === null && task.status === 'open' && task.parentId === null,
  );

  return (
    <div className="matrix-wrap">
      <p className="field-hint matrix-hint">
        按“优先级 ≥ 中”视为重要，“今天或已过期”视为紧急；拖动任务到其他象限会自动调整属性和日期。
      </p>
      <div className="matrix-grid">
        {QUADRANTS.map((quadrant) => {
          const items = open.filter((task) => quadrantOf(task) === quadrant.id);
          return (
            <section
              key={quadrant.id}
              className="matrix-quadrant"
              style={{ '--quadrant-color': quadrant.color } as CSSProperties}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData('text/plain');
                const task = open.find((item) => item.id === taskId);
                if (task) moveTo(task, quadrant.id);
              }}
            >
              <header>
                <div>
                  <h3>{quadrant.title}</h3>
                  <span>{quadrant.hint}</span>
                </div>
                <em>{items.length}</em>
              </header>
              <div className="matrix-list">
                {items.map((task) => (
                  <article
                    key={task.id}
                    className={`matrix-card ${selectedTaskId === task.id ? 'is-selected' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', task.id);
                    }}
                    onClick={() => onSelect(task)}
                  >
                    <button
                      className="check small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(task);
                      }}
                      aria-label="完成任务"
                    >
                      <Check size={10} strokeWidth={3} className="matrix-check-icon" />
                    </button>
                    <div>
                      <strong>{task.title}</strong>
                      <div className="matrix-card-meta">
                        {task.startDate ? <span>{formatDateLabel(task.startDate)}</span> : <span>未安排</span>}
                        {task.priority > 0 && <span>优先级 {task.priority}</span>}
                      </div>
                    </div>
                  </article>
                ))}
                {items.length === 0 && <div className="matrix-empty">拖动任务到这里</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
