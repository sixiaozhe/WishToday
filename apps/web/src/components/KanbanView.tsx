import { useState } from 'react';
import { Check, MoreHorizontal, Plus } from 'lucide-react';
import {
  formatDateLabel,
  priorityLabel,
  sortTasks,
  type Priority,
  type Project,
  type Tag,
  type Task,
} from '@dayline/core';

interface KanbanViewProps {
  tasks: Task[];
  projects: Project[];
  tags: Tag[];
  selectedTaskId: string | null;
  onSelect: (task: Task) => void;
  onToggle: (task: Task) => void;
  onMove: (task: Task, patch: { projectId?: string; priority?: Priority }) => void;
  onAdd: (projectId: string | null) => void;
}

type GroupBy = 'project' | 'priority' | 'status';

interface Column {
  id: string;
  title: string;
  color?: string;
  projectId?: string;
  priority?: Priority;
  status?: Task['status'];
}

const PRIORITY_COLUMNS: Column[] = [
  { id: 'p5', title: '高优先级', priority: 5, color: '#ef4444' },
  { id: 'p3', title: '中优先级', priority: 3, color: '#f59e0b' },
  { id: 'p1', title: '低优先级', priority: 1, color: '#06b6d4' },
  { id: 'p0', title: '无优先级', priority: 0, color: '#94a3b8' },
];

const STATUS_COLUMNS: Column[] = [
  { id: 'open', title: '未完成', status: 'open' },
  { id: 'completed', title: '已完成', status: 'completed' },
  { id: 'abandoned', title: '已放弃', status: 'abandoned' },
];

export function KanbanView({
  tasks,
  projects,
  tags,
  selectedTaskId,
  onSelect,
  onToggle,
  onMove,
  onAdd,
}: KanbanViewProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  const columns: Column[] =
    groupBy === 'project'
      ? projects
          .filter((project) => project.deletedAt === null)
          .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
          .map((project) => ({
            id: project.id,
            title: project.name,
            color: project.color,
            projectId: project.id,
          }))
      : groupBy === 'priority'
        ? PRIORITY_COLUMNS
        : STATUS_COLUMNS;

  function columnTasks(column: Column): Task[] {
    const visible = tasks.filter((task) => task.deletedAt === null);
    let filtered = visible;
    if (column.projectId) filtered = visible.filter((task) => task.projectId === column.projectId);
    if (column.priority !== undefined) {
      filtered = visible.filter(
        (task) => task.priority === column.priority && task.status === 'open',
      );
    }
    if (column.status) filtered = visible.filter((task) => task.status === column.status);
    return sortTasks(filtered);
  }

  function handleDrop(column: Column, taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (column.projectId) onMove(task, { projectId: column.projectId });
    else if (column.priority !== undefined) onMove(task, { priority: column.priority });
    else if (column.status === 'completed' && task.status !== 'completed') onToggle(task);
    else if (column.status === 'open' && task.status !== 'open') onToggle(task);
  }

  return (
    <div className="kanban-wrap">
      <div className="view-toolbar">
        <div className="segmented small">
          <button className={groupBy === 'project' ? 'is-active' : ''} onClick={() => setGroupBy('project')}>
            按清单
          </button>
          <button className={groupBy === 'priority' ? 'is-active' : ''} onClick={() => setGroupBy('priority')}>
            按优先级
          </button>
          <button className={groupBy === 'status' ? 'is-active' : ''} onClick={() => setGroupBy('status')}>
            按状态
          </button>
        </div>
        <span className="shortcut-hint">拖动卡片可修改{groupBy === 'project' ? '清单' : groupBy === 'priority' ? '优先级' : '状态'}</span>
      </div>

      <div className="kanban-board">
        {columns.map((column) => {
          const items = columnTasks(column);
          return (
            <section
              key={column.id}
              className="kanban-column"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(column, event.dataTransfer.getData('text/plain'));
              }}
            >
              <header className="kanban-column-head">
                {column.color && (
                  <span className="project-dot" style={{ background: column.color }} />
                )}
                <h3>{column.title}</h3>
                <em>{items.length}</em>
                {column.projectId && (
                  <button
                    className="icon-button tiny"
                    onClick={() => onAdd(column.projectId ?? null)}
                    aria-label={`在${column.title}中添加任务`}
                  >
                    <Plus size={13} />
                  </button>
                )}
              </header>

              <div className="kanban-cards">
                {items.map((task) => (
                  <article
                    key={task.id}
                    data-task-id={task.id}
                    className={`kanban-card ${
                      selectedTaskId === task.id ? 'is-selected' : ''
                    } ${task.status === 'completed' ? 'is-completed' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', task.id);
                    }}
                    onClick={() => onSelect(task)}
                  >
                    <div className="kanban-card-head">
                      <button
                        className={`check small ${task.status === 'completed' ? 'is-checked' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggle(task);
                        }}
                        aria-label={task.status === 'completed' ? '取消完成' : '完成任务'}
                      >
                        {task.status === 'completed' && <Check size={10} strokeWidth={3} />}
                      </button>
                      <span className="kanban-title">{task.title}</span>
                    </div>
                    <div className="kanban-card-meta">
                      {task.startDate && <span>{formatDateLabel(task.startDate)}</span>}
                      {task.priority > 0 && (
                        <span className={`priority-tag p${task.priority}`}>
                          {priorityLabel(task.priority)}
                        </span>
                      )}
                      {task.tagIds.slice(0, 2).map((tagId) => {
                        const tag = tagById.get(tagId);
                        if (!tag) return null;
                        return (
                          <span key={tagId} className="mini-tag" style={{ color: tag.color }}>
                            #{tag.name}
                          </span>
                        );
                      })}
                      {task.checklist.length > 0 && (
                        <span>
                          ☑ {task.checklist.filter((item) => item.completed).length}/
                          {task.checklist.length}
                        </span>
                      )}
                    </div>
                    <MoreHorizontal size={13} className="kanban-more" />
                  </article>
                ))}
                {items.length === 0 && (
                  <button className="kanban-empty" onClick={() => onAdd(column.projectId ?? null)}>
                    暂无任务，添加一个
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
