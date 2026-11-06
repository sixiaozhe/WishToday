import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Hash, Search, X } from 'lucide-react';
import type { AppState, Project, Tag, Task } from '@dayline/core';

interface GlobalSearchProps {
  state: AppState;
  onSelectTask: (task: Task) => void;
  onSelectProject: (project: Project) => void;
  onSelectTag: (tag: Tag) => void;
  onClose: () => void;
}

export function GlobalSearch({
  state,
  onSelectTask,
  onSelectProject,
  onSelectTag,
  onClose,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const value = query.trim().toLowerCase();
  const tasks = value
    ? state.tasks
        .filter(
          (task) =>
            task.deletedAt === null &&
            `${task.title}\n${task.contentMd}`.toLowerCase().includes(value),
        )
        .slice(0, 10)
    : [];
  const projects = value
    ? state.projects
        .filter(
          (project) =>
            project.deletedAt === null && project.name.toLowerCase().includes(value),
        )
        .slice(0, 6)
    : [];
  const tags = value
    ? state.tags.filter((tag) => tag.name.toLowerCase().includes(value)).slice(0, 6)
    : [];

  return (
    <div
      className="search-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-panel">
        <div className="search-panel-input">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
            }}
            placeholder="搜索任务、清单、标签…"
            aria-label="全局搜索"
          />
          <button className="icon-button small" onClick={onClose} aria-label="关闭搜索">
            <X size={16} />
          </button>
        </div>

        {!value && (
          <div className="search-hint">
            输入关键词搜索所有任务、清单和标签；也可以按 Esc 关闭。
          </div>
        )}

        {value && tasks.length === 0 && projects.length === 0 && tags.length === 0 && (
          <div className="search-hint">没有找到匹配内容。</div>
        )}

        {tasks.length > 0 && (
          <section className="search-group">
            <h3>任务</h3>
            {tasks.map((task) => (
              <button
                key={task.id}
                data-task-id={task.id}
                className="search-result"
                onClick={() => {
                  onSelectTask(task);
                  onClose();
                }}
              >
                <CheckCircle2 size={15} />
                <span>{task.title}</span>
                <em>
                  {task.status === 'completed'
                    ? '已完成'
                    : task.status === 'abandoned'
                      ? '已放弃'
                      : task.startDate ?? ''}
                </em>
              </button>
            ))}
          </section>
        )}

        {projects.length > 0 && (
          <section className="search-group">
            <h3>清单</h3>
            {projects.map((project) => (
              <button
                key={project.id}
                className="search-result"
                onClick={() => {
                  onSelectProject(project);
                  onClose();
                }}
              >
                <span className="project-dot" style={{ background: project.color }} />
                <span>{project.name}</span>
              </button>
            ))}
          </section>
        )}

        {tags.length > 0 && (
          <section className="search-group">
            <h3>标签</h3>
            {tags.map((tag) => (
              <button
                key={tag.id}
                className="search-result"
                onClick={() => {
                  onSelectTag(tag);
                  onClose();
                }}
              >
                <Hash size={14} style={{ color: tag.color }} />
                <span>{tag.name}</span>
              </button>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
