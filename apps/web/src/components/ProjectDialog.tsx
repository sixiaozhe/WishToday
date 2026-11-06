import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Folder, Project, ProjectKind } from '@dayline/core';
import { Modal } from './Modal';
import { Select } from './controls/Select';

const PROJECT_COLORS = ['#3b6ef6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#64748b'];

interface ProjectDialogProps {
  project: Project;
  folders: Folder[];
  onSave: (patch: { name: string; color: string; kind: ProjectKind; folderId: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ProjectDialog({ project, folders, onSave, onDelete, onClose }: ProjectDialogProps) {
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  const [kind, setKind] = useState<ProjectKind>(project.kind);
  const [folderId, setFolderId] = useState(project.folderId ?? '');

  return (
    <Modal
      title="编辑清单"
      subtitle={project.isInbox ? '收集箱是系统清单，不能删除。' : '清单可以放进文件夹，也可以切换为笔记。'}
      onClose={onClose}
      footer={
        <>
          {!project.isInbox && (
            <button
              className="button danger-ghost"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              删除清单
            </button>
          )}
          <button
            className="button primary"
            onClick={() => {
              const value = name.trim();
              if (!value) return;
              onSave({ name: value, color, kind, folderId: folderId || null });
              onClose();
            }}
          >
            保存
          </button>
        </>
      }
    >
      <label className="field">
        <span>名称</span>
        <input value={name} autoFocus onChange={(event) => setName(event.target.value)} />
      </label>

      <div className="field">
        <span>类型</span>
        <Select
          value={kind}
          disabled={project.isInbox}
          onChange={(value) => setKind(value as ProjectKind)}
          options={[
            { value: 'task', label: '任务清单' },
            { value: 'note', label: '笔记' },
          ]}
          ariaLabel="清单类型"
        />
      </div>

      <div className="field">
        <span>文件夹</span>
        <Select
          value={folderId}
          onChange={setFolderId}
          options={[
            { value: '', label: '不放入文件夹' },
            ...folders
              .filter((folder) => folder.deletedAt === null)
              .map((folder) => ({ value: folder.id, label: folder.name })),
          ]}
          ariaLabel="所属文件夹"
        />
      </div>

      <div className="field">
        <span>颜色</span>
        <div className="color-picker">
          {PROJECT_COLORS.map((item) => (
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
      </div>
    </Modal>
  );
}
