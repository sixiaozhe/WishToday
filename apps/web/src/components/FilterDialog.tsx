import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  FILTER_FIELDS,
  FILTER_OPERATORS,
  FILTER_PRIORITY_VALUES,
  FILTER_STATUS_VALUES,
  createCondition,
  type FilterCondition,
  type FilterField,
  type FilterOperator,
  type Project,
  type SavedFilter,
  type Tag,
} from '@dayline/core';
import { Modal } from './Modal';
import { Select } from './controls/Select';
import { DatePicker } from './controls/DatePicker';

interface FilterDialogProps {
  projects: Project[];
  tags: Tag[];
  initial: SavedFilter | null;
  onSave: (
    filter: Pick<SavedFilter, 'name' | 'conditions' | 'match'> & { id?: string },
  ) => void;
  onDelete?: (filter: SavedFilter) => void;
  onClose: () => void;
}

export function FilterDialog({ projects, tags, initial, onSave, onDelete, onClose }: FilterDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [match, setMatch] = useState<'all' | 'any'>(initial?.match ?? 'all');
  const [conditions, setConditions] = useState<FilterCondition[]>(
    initial?.conditions.length ? initial.conditions : [createCondition()],
  );

  function updateCondition(id: string, patch: Partial<FilterCondition>) {
    setConditions((current) =>
      current.map((condition) => (condition.id === id ? { ...condition, ...patch } : condition)),
    );
  }

  function changeField(id: string, field: FilterField) {
    const operator = FILTER_OPERATORS[field][0]?.value ?? 'contains';
    updateCondition(id, { field, operator, value: '' });
  }

  function changeOperator(id: string, field: FilterField, operator: FilterOperator) {
    updateCondition(id, { operator, value: '' });
    void field;
  }

  function renderValue(condition: FilterCondition) {
    const hasDate = condition.field === 'due' || condition.field === 'completed';
    if (
      condition.operator === 'isEmpty' ||
      condition.operator === 'isNotEmpty'
    ) {
      return <span className="field-hint inline">无需填写值</span>;
    }
    if (condition.field === 'project') {
      return (
        <Select
          value={condition.value}
          onChange={(value) => updateCondition(condition.id, { value })}
          options={[
            { value: '', label: '选择清单' },
            ...projects.map((project) => ({ value: project.id, label: project.name })),
          ]}
          ariaLabel="筛选清单"
        />
      );
    }
    if (condition.field === 'tag') {
      return (
        <Select
          value={condition.value}
          onChange={(value) => updateCondition(condition.id, { value })}
          options={[
            { value: '', label: '选择标签' },
            ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
          ]}
          ariaLabel="筛选标签"
        />
      );
    }
    if (condition.field === 'priority') {
      return (
        <Select
          value={condition.value}
          onChange={(value) => updateCondition(condition.id, { value })}
          options={[
            { value: '', label: '选择优先级' },
            ...FILTER_PRIORITY_VALUES.map((item) => ({
              value: item.value,
              label: item.label,
            })),
          ]}
          ariaLabel="筛选优先级"
        />
      );
    }
    if (condition.field === 'status') {
      return (
        <Select
          value={condition.value}
          onChange={(value) => updateCondition(condition.id, { value })}
          options={[
            { value: '', label: '选择状态' },
            ...FILTER_STATUS_VALUES.map((item) => ({
              value: item.value,
              label: item.label,
            })),
          ]}
          ariaLabel="筛选状态"
        />
      );
    }
    if (hasDate) {
      return (
        <DatePicker
          value={condition.value || null}
          onChange={(value) => updateCondition(condition.id, { value: value ?? '' })}
          ariaLabel="筛选日期"
          clearable
        />
      );
    }
    return (
      <input
        value={condition.value}
        placeholder="输入关键词"
        onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
      />
    );
  }

  return (
    <Modal
      title={initial ? '编辑过滤器' : '新建过滤器'}
      subtitle="过滤器会实时匹配任务，可保存到侧边栏反复使用。"
      onClose={onClose}
      wide
      footer={
        <>
          {initial && onDelete && (
            <button
              className="button danger-ghost"
              onClick={() => {
                onDelete(initial);
                onClose();
              }}
            >
              删除过滤器
            </button>
          )}
          <button
            className="button primary"
            onClick={() => {
              const value = name.trim();
              if (!value) return;
              const cleaned = conditions.filter((condition) => {
                const noValue =
                  condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty';
                return noValue || condition.value.trim().length > 0;
              });
              onSave({ id: initial?.id, name: value, conditions: cleaned, match });
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
        <input
          value={name}
          autoFocus
          placeholder="例如：本周高优先级"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className="segmented">
        <button
          className={match === 'all' ? 'is-active' : ''}
          onClick={() => setMatch('all')}
        >
          满足全部条件
        </button>
        <button
          className={match === 'any' ? 'is-active' : ''}
          onClick={() => setMatch('any')}
        >
          满足任一条件
        </button>
      </div>

      <div className="condition-list">
        {conditions.map((condition) => (
          <div key={condition.id} className="condition-row">
            <Select
              value={condition.field}
              onChange={(value) => changeField(condition.id, value as FilterField)}
              options={FILTER_FIELDS.map((field) => ({
                value: field.value,
                label: field.label,
              }))}
              ariaLabel="筛选字段"
            />
            <Select
              value={condition.operator}
              onChange={(value) =>
                changeOperator(condition.id, condition.field, value as FilterOperator)
              }
              options={FILTER_OPERATORS[condition.field].map((operator) => ({
                value: operator.value,
                label: operator.label,
              }))}
              ariaLabel="筛选条件"
            />
            <div className="condition-value">{renderValue(condition)}</div>
            <button
              className="icon-button small"
              onClick={() =>
                setConditions((current) =>
                  current.length === 1
                    ? current
                    : current.filter((item) => item.id !== condition.id),
                )
              }
              aria-label="删除条件"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        className="button ghost"
        onClick={() => setConditions((current) => [...current, createCondition()])}
      >
        <Plus size={14} />
        添加条件
      </button>
    </Modal>
  );
}
