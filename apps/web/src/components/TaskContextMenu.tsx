import { useEffect } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { Task } from '@dayline/core';

interface TaskContextMenuProps {
  x: number;
  y: number;
  task: Task;
  onOpenTask: () => void;
  onAskAi: () => void;
  onClose: () => void;
}

export function TaskContextMenu({
  x,
  y,
  task,
  onOpenTask,
  onAskAi,
  onClose,
}: TaskContextMenuProps) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('.task-context-menu')) return;
      onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const left = typeof window === 'undefined' ? x : Math.min(x, window.innerWidth - 232);
  const top = typeof window === 'undefined' ? y : Math.min(y, window.innerHeight - 132);

  return (
    <div
      className="task-context-menu"
      style={{ left, top }}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="task-context-title" title={task.title}>
        {task.title}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onAskAi();
        }}
      >
        <Sparkles size={14} />
        问 AI 助手
        <span className="task-context-hint">拆解 / 建议</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onOpenTask();
        }}
      >
        <ArrowUpRight size={14} />
        打开任务
      </button>
    </div>
  );
}
