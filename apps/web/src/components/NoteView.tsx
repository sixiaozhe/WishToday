import { useEffect, useRef, useState } from 'react';
import { Eye, FileText, PenLine, Plus, Trash2 } from 'lucide-react';
import type { Project, Task, TaskPatch } from '@dayline/core';
import { Markdown } from './Markdown';

interface NoteViewProps {
  project: Project;
  tasks: Task[];
  onCreate: (title: string) => void;
  onUpdate: (task: Task, patch: TaskPatch) => void;
  onDelete: (task: Task) => void;
}

export function NoteView({ project, tasks, onCreate, onUpdate, onDelete }: NoteViewProps) {
  const notes = tasks
    .filter((task) => task.deletedAt === null && task.projectId === project.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
  const [preview, setPreview] = useState(false);
  const knownIds = useRef(new Set(notes.map((note) => note.id)));
  const selected = notes.find((note) => note.id === selectedId) ?? notes[0] ?? null;

  useEffect(() => {
    const fresh = notes.find((note) => !knownIds.current.has(note.id));
    knownIds.current = new Set(notes.map((note) => note.id));
    if (fresh) setSelectedId(fresh.id);
  }, [notes]);

  return (
    <div className="note-wrap">
      <aside className="note-list">
        <header>
          <h3>笔记</h3>
          <button
            className="icon-button small"
            onClick={() => onCreate('无标题笔记')}
            aria-label="新建笔记"
          >
            <Plus size={15} />
          </button>
        </header>
        {notes.map((note) => (
          <button
            key={note.id}
            className={`note-item ${selected?.id === note.id ? 'is-active' : ''}`}
            onClick={() => setSelectedId(note.id)}
          >
            <FileText size={14} />
            <div>
              <strong>{note.title}</strong>
              <span>{note.contentMd.slice(0, 48) || '空白笔记'}</span>
            </div>
          </button>
        ))}
        {notes.length === 0 && <p className="field-hint">还没有笔记。</p>}
      </aside>

      <section className="note-editor">
        {selected ? (
          <>
            <div className="note-toolbar">
              <input
                className="note-title-input"
                value={selected.title}
                onChange={(event) => onUpdate(selected, { title: event.target.value })}
                aria-label="笔记标题"
              />
              <div className="segmented small">
                <button className={!preview ? 'is-active' : ''} onClick={() => setPreview(false)}>
                  <PenLine size={13} />
                  编辑
                </button>
                <button className={preview ? 'is-active' : ''} onClick={() => setPreview(true)}>
                  <Eye size={13} />
                  预览
                </button>
              </div>
              <button
                className="icon-button small"
                onClick={() => {
                  if (confirm(`删除笔记“${selected.title}”？`)) onDelete(selected);
                }}
                aria-label="删除笔记"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {preview ? (
              <div className="note-preview">
                <Markdown value={selected.contentMd} />
              </div>
            ) : (
              <textarea
                className="note-textarea"
                value={selected.contentMd}
                onChange={(event) => onUpdate(selected, { contentMd: event.target.value })}
                placeholder={'# 开始写笔记\n\n支持 Markdown：**加粗**、- 列表、[链接](https://example.com)'}
                aria-label="笔记内容"
              />
            )}
          </>
        ) : (
          <div className="empty-panel">
            <strong>选择或新建一条笔记</strong>
            <p>笔记清单里的每一条记录都可以独立编辑。</p>
          </div>
        )}
      </section>
    </div>
  );
}
