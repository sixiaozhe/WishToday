import { useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import type { Priority, Project, TaskTemplate } from '@dayline/core';
import { Modal } from './Modal';
import { Select } from './controls/Select';

interface TemplateDialogProps {
  templates: TaskTemplate[];
  projects: Project[];
  defaultProjectId: string;
  onCreate: (template: {
    name: string;
    title: string;
    contentMd: string;
    priority: Priority;
    projectId: string | null;
  }) => void;
  onDelete: (template: TaskTemplate) => void;
  onUse: (template: TaskTemplate) => void;
  onClose: () => void;
}

export function TemplateDialog({
  templates,
  projects,
  defaultProjectId,
  onCreate,
  onDelete,
  onUse,
  onClose,
}: TemplateDialogProps) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [projectId, setProjectId] = useState(defaultProjectId);

  return (
    <Modal
      title="任务模板"
      subtitle="把重复使用的任务结构保存下来，一键创建到当前清单。"
      onClose={onClose}
      wide
    >
      <form
        className="template-form"
        onSubmit={(event) => {
          event.preventDefault();
          const value = name.trim() || title.trim();
          if (!value) return;
          onCreate({ name: value, title: title.trim() || value, contentMd, priority, projectId });
          setName('');
          setTitle('');
          setContentMd('');
          setPriority(0);
        }}
      >
        <div className="form-row">
          <label className="field">
            <span>模板名称</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="周报模板" />
          </label>
          <div className="field">
            <span>优先级</span>
            <Select
              value={String(priority)}
              onChange={(value) => setPriority(Number(value) as Priority)}
              options={[
                { value: '0', label: '无' },
                { value: '1', label: '低' },
                { value: '3', label: '中' },
                { value: '5', label: '高' },
              ]}
              ariaLabel="模板优先级"
            />
          </div>
        </div>
        <label className="field">
          <span>任务标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="写周报" />
        </label>
        <label className="field">
          <span>任务备注（支持 Markdown）</span>
          <textarea
            value={contentMd}
            rows={4}
            onChange={(event) => setContentMd(event.target.value)}
            placeholder={'## 本周进展\n- [ ] 项目 A\n- [ ] 项目 B'}
          />
        </label>
        <div className="field">
          <span>默认清单</span>
          <Select
            value={projectId}
            onChange={setProjectId}
            options={projects
              .filter((project) => project.deletedAt === null)
              .map((project) => ({ value: project.id, label: project.name }))}
            ariaLabel="模板默认清单"
          />
        </div>
        <button className="button primary" type="submit">
          <Plus size={14} />
          保存模板
        </button>
      </form>

      <div className="manager-list">
        {templates.map((template) => (
          <div key={template.id} className="manager-row template-row">
            <div className="template-copy">
              <strong>{template.name}</strong>
              <span>{template.title}</span>
            </div>
            <button className="button ghost small" onClick={() => onUse(template)}>
              <Wand2 size={13} />
              使用
            </button>
            <button
              className="icon-button small"
              onClick={() => onDelete(template)}
              aria-label={`删除模板${template.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {templates.length === 0 && <p className="field-hint">还没有模板。</p>}
      </div>
    </Modal>
  );
}
