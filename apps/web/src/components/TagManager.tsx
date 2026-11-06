import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Tag } from '@dayline/core';
import { Modal } from './Modal';

const TAG_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b6ef6', '#8b5cf6', '#ec4899', '#64748b'];

interface TagManagerProps {
  tags: Tag[];
  onAdd: (name: string, color: string) => void;
  onUpdate: (tag: Tag, patch: { name?: string; color?: string }) => void;
  onDelete: (tag: Tag) => void;
  onClose: () => void;
}

export function TagManager({ tags, onAdd, onUpdate, onDelete, onClose }: TagManagerProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0] ?? '#3b6ef6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    onAdd(value, color);
    setName('');
  }

  return (
    <Modal
      title="标签管理"
      subtitle="标签可跨清单组织任务；删除标签不会删除任务。"
      onClose={onClose}
    >
      <form className="manager-add" onSubmit={submit}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="新标签名称"
          aria-label="新标签名称"
        />
        <div className="color-picker">
          {TAG_COLORS.map((item) => (
            <button
              key={item}
              type="button"
              className={`color-dot ${color === item ? 'is-active' : ''}`}
              style={{ background: item }}
              onClick={() => setColor(item)}
              aria-label={`选择颜色 ${item}`}
            >
              {color === item && <Check size={10} />}
            </button>
          ))}
        </div>
        <button className="button primary" type="submit">
          <Plus size={14} />
          添加
        </button>
      </form>

      <div className="manager-list">
        {tags.map((tag) => (
          <div key={tag.id} className="manager-row">
            {editingId === tag.id ? (
              <>
                <input
                  className="manager-name"
                  value={editingName}
                  autoFocus
                  onChange={(event) => setEditingName(event.target.value)}
                />
                <div className="color-picker">
                  {TAG_COLORS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`color-dot ${editingColor === item ? 'is-active' : ''}`}
                      style={{ background: item }}
                      onClick={() => setEditingColor(item)}
                      aria-label={`选择颜色 ${item}`}
                    />
                  ))}
                </div>
                <button
                  className="icon-button small"
                  onClick={() => {
                    const value = editingName.trim();
                    if (value) onUpdate(tag, { name: value, color: editingColor });
                    setEditingId(null);
                  }}
                  aria-label="保存标签"
                >
                  <Check size={15} />
                </button>
                <button
                  className="icon-button small"
                  onClick={() => setEditingId(null)}
                  aria-label="取消编辑"
                >
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <span className="project-dot" style={{ background: tag.color }} />
                <span className="manager-name">{tag.name}</span>
                <button
                  className="icon-button small"
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditingName(tag.name);
                    setEditingColor(tag.color);
                  }}
                  aria-label={`编辑标签${tag.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button small"
                  onClick={() => onDelete(tag)}
                  aria-label={`删除标签${tag.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}
        {tags.length === 0 && <p className="field-hint">还没有标签，先创建一个吧。</p>}
      </div>
    </Modal>
  );
}
