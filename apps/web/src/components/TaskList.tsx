import {
  CheckCircle2,
  CircleSlash,
  Inbox,
  Search,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { formatDateLabel, type Project, type Tag, type Task } from '@dayline/core';
import type { View } from '../view';
import { TaskRow } from './TaskRow';

interface TaskListProps {
  tasks: Task[];
  projects: Project[];
  tags: Tag[];
  view: View;
  search: string;
  selectedTaskId: string | null;
  selectedIds: Set<string>;
  onSelect: (task: Task) => void;
  onCheck: (task: Task) => void;
  onToggle: (task: Task) => void;
  onDropTask: (draggedId: string, target: Task) => void;
  onTrash: (task: Task) => void;
  onRestore: (task: Task) => void;
  onRestart: (task: Task) => void;
  assigneesForTask?: (task: Task) => Array<{
    deviceId: string;
    name: string;
  }>;
  canChatForTask?: (task: Task) => boolean;
  chatCountForTask?: (task: Task) => number;
  onOpenChat?: (task: Task) => void;
}

interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

function buildGroups(tasks: Task[], view: View): TaskGroup[] {
  if (
    view.kind === 'smart' &&
    (view.id === 'completed' ||
      view.id === 'abandoned' ||
      view.id === 'skipped' ||
      view.id === 'trash')
  ) {
    return [{ key: 'all', label: '', tasks }];
  }

  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = task.startDate ?? '9999-99-99';
    const label = task.startDate ? formatDateLabel(task.startDate) : '无日期';
    const group = groups.get(key) ?? { key, label, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function emptyCopy(view: View, search: string): { title: string; body: string } {
  if (search) return { title: '没有找到匹配的任务', body: '换一个关键词，或清空搜索。' };
  if (view.kind === 'smart') {
    if (view.id === 'completed') return { title: '还没有已完成的任务', body: '完成的任务会出现在这里。' };
    if (view.id === 'abandoned') return { title: '没有已放弃的任务', body: '放弃的任务会保留在这里，可重新开始。' };
    if (view.id === 'skipped') return { title: '没有跳过的周期', body: '重复任务跳过后会保留在这里，可恢复该周期。' };
    if (view.id === 'trash') return { title: '垃圾桶是空的', body: '删除的任务会先进入这里，可随时恢复。' };
    if (view.id === 'today') return { title: '今天很清爽', body: '添加一个任务，开始安排今天。' };
    if (view.id === 'inbox') return { title: '收集箱是空的', body: '把想法先收进来，之后再整理。' };
  }
  return { title: '这里还没有任务', body: '在下方输入框添加第一个任务。' };
}

function EmptyIcon({ view, search }: { view: View; search: string }) {
  if (search) return <Search size={28} />;
  if (view.kind === 'smart' && view.id === 'completed') return <CheckCircle2 size={28} />;
  if (view.kind === 'smart' && view.id === 'abandoned') return <CircleSlash size={28} />;
  if (view.kind === 'smart' && view.id === 'skipped') return <SkipForward size={28} />;
  if (view.kind === 'smart' && view.id === 'trash') return <Trash2 size={28} />;
  return <Inbox size={28} />;
}

export function TaskList({
  tasks,
  projects,
  tags,
  view,
  search,
  selectedTaskId,
  selectedIds,
  onSelect,
  onCheck,
  onToggle,
  onDropTask,
  onTrash,
  onRestore,
  onRestart,
  assigneesForTask,
  canChatForTask,
  chatCountForTask,
  onOpenChat,
}: TaskListProps) {
  if (tasks.length === 0) {
    const copy = emptyCopy(view, search);
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <EmptyIcon view={view} search={search} />
        </div>
        <h3>{copy.title}</h3>
        <p>{copy.body}</p>
      </div>
    );
  }

  const groups = buildGroups(tasks, view);
  const projectMap = new Map(projects.map((project) => [project.id, project]));

  return (
    <div className="task-groups">
      {groups.map((group) => (
        <section key={group.key} className="task-group">
          {group.label && (
            <div className="group-heading">
              <span>{group.label}</span>
              <em>{group.tasks.length}</em>
            </div>
          )}
          <div className="task-list">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                project={projectMap.get(task.projectId)}
                tags={tags}
                selected={task.id === selectedTaskId}
                checked={selectedIds.has(task.id)}
                onSelect={onSelect}
                onCheck={onCheck}
                onToggle={onToggle}
                onDropTask={onDropTask}
                onTrash={onTrash}
                onRestore={onRestore}
                onRestart={onRestart}
                assignees={assigneesForTask?.(task)}
                canChat={canChatForTask?.(task)}
                chatCount={chatCountForTask?.(task)}
                onOpenChat={onOpenChat}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
