import { Check, Folder, Hash, Trash2, X } from 'lucide-react';
import type { Priority, Project, Tag } from '@dayline/core';
import { Select } from './controls/Select';

interface BatchBarProps {
  count: number;
  projects: Project[];
  tags: Tag[];
  onComplete: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onMove: (projectId: string) => void;
  onPriority: (priority: Priority) => void;
  onAddTag: (tagId: string) => void;
  onClear: () => void;
}

export function BatchBar({
  count,
  projects,
  tags,
  onComplete,
  onTrash,
  onRestore,
  onMove,
  onPriority,
  onAddTag,
  onClear,
}: BatchBarProps) {
  return (
    <div className="batch-bar" role="toolbar" aria-label="批量操作">
      <span className="batch-count">已选择 {count} 项</span>
      <button className="button ghost small" onClick={onComplete}>
        <Check size={14} />
        完成
      </button>
      <button className="button ghost small" onClick={onRestore}>
        恢复
      </button>
      <button className="button danger-ghost small" onClick={onTrash}>
        <Trash2 size={14} />
        删除
      </button>
      <div className="batch-select">
        <Folder size={14} />
        <Select
          value=""
          onChange={(value) => {
            if (value) onMove(value);
          }}
          placeholder="移动到清单…"
          options={projects
            .filter((project) => project.deletedAt === null)
            .map((project) => ({ value: project.id, label: project.name }))}
          ariaLabel="移动到清单"
        />
      </div>
      <div className="batch-select">
        <Select
          value=""
          onChange={(value) => {
            if (value !== '') onPriority(Number(value) as Priority);
          }}
          placeholder="设置优先级…"
          options={[
            { value: '0', label: '无' },
            { value: '1', label: '低' },
            { value: '3', label: '中' },
            { value: '5', label: '高' },
          ]}
          ariaLabel="设置优先级"
        />
      </div>
      <div className="batch-select">
        <Hash size={14} />
        <Select
          value=""
          onChange={(value) => {
            if (value) onAddTag(value);
          }}
          placeholder="添加标签…"
          options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
          ariaLabel="添加标签"
        />
      </div>
      <button className="icon-button small" onClick={onClear} aria-label="取消选择">
        <X size={15} />
      </button>
    </div>
  );
}
