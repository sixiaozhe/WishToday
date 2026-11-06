import { localDateKey } from './date';
import type {
  FilterCondition,
  FilterField,
  FilterOperator,
  Priority,
  Project,
  SavedFilter,
  Tag,
  Task,
} from './types';

export const FILTER_FIELDS: Array<{ value: FilterField; label: string }> = [
  { value: 'title', label: '标题' },
  { value: 'content', label: '备注' },
  { value: 'project', label: '清单' },
  { value: 'tag', label: '标签' },
  { value: 'priority', label: '优先级' },
  { value: 'status', label: '状态' },
  { value: 'due', label: '截止日期' },
  { value: 'completed', label: '完成日期' },
];

export const FILTER_OPERATORS: Record<
  FilterField,
  Array<{ value: FilterOperator; label: string }>
> = {
  title: [
    { value: 'contains', label: '包含' },
    { value: 'notContains', label: '不包含' },
    { value: 'is', label: '等于' },
    { value: 'isEmpty', label: '为空' },
  ],
  content: [
    { value: 'contains', label: '包含' },
    { value: 'notContains', label: '不包含' },
    { value: 'isEmpty', label: '为空' },
  ],
  project: [
    { value: 'is', label: '是' },
    { value: 'isNot', label: '不是' },
  ],
  tag: [
    { value: 'is', label: '包含标签' },
    { value: 'isNot', label: '不含标签' },
    { value: 'isEmpty', label: '没有标签' },
  ],
  priority: [
    { value: 'is', label: '等于' },
    { value: 'gte', label: '至少' },
    { value: 'lte', label: '至多' },
  ],
  status: [{ value: 'is', label: '是' }],
  due: [
    { value: 'is', label: '是' },
    { value: 'before', label: '早于' },
    { value: 'after', label: '晚于' },
    { value: 'isEmpty', label: '未安排' },
    { value: 'isNotEmpty', label: '已安排' },
  ],
  completed: [
    { value: 'before', label: '早于' },
    { value: 'after', label: '晚于' },
    { value: 'isEmpty', label: '未完成' },
    { value: 'isNotEmpty', label: '已完成' },
  ],
};

export const FILTER_STATUS_VALUES: Array<{ value: string; label: string }> = [
  { value: 'open', label: '未完成' },
  { value: 'completed', label: '已完成' },
  { value: 'abandoned', label: '已放弃' },
  { value: 'skipped', label: '已跳过' },
];

export const FILTER_PRIORITY_VALUES: Array<{ value: string; label: string }> = [
  { value: '0', label: '无' },
  { value: '1', label: '低' },
  { value: '3', label: '中' },
  { value: '5', label: '高' },
];

const PRIORITY_LABELS: Record<Priority, string> = {
  0: '无优先级',
  1: '低优先级',
  3: '中优先级',
  5: '高优先级',
};

export function priorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

export interface FilterContext {
  projects: Project[];
  tags: Tag[];
  now?: Date;
}

function dateKeyFromTimestamp(value: number | null): string | null {
  if (value === null) return null;
  return localDateKey(new Date(value));
}

export function matchesCondition(
  task: Task,
  condition: FilterCondition,
  context: FilterContext,
): boolean {
  const value = condition.value.trim();
  const lower = value.toLowerCase();

  switch (condition.field) {
    case 'title': {
      const title = task.title.toLowerCase();
      if (condition.operator === 'isEmpty') return title.length === 0;
      if (condition.operator === 'contains') return title.includes(lower);
      if (condition.operator === 'notContains') return !title.includes(lower);
      return title === lower;
    }
    case 'content': {
      const content = task.contentMd.toLowerCase();
      if (condition.operator === 'isEmpty') return content.length === 0;
      if (condition.operator === 'notContains') return !content.includes(lower);
      return content.includes(lower);
    }
    case 'project': {
      if (condition.operator === 'isEmpty') return !task.projectId;
      return condition.operator === 'isNot'
        ? task.projectId !== value
        : task.projectId === value;
    }
    case 'tag': {
      if (condition.operator === 'isEmpty') return task.tagIds.length === 0;
      if (condition.operator === 'isNot') return !task.tagIds.includes(value);
      return task.tagIds.includes(value);
    }
    case 'priority': {
      const target = Number(value) as Priority;
      if (condition.operator === 'gte') return task.priority >= target;
      if (condition.operator === 'lte') return task.priority <= target;
      return task.priority === target;
    }
    case 'status':
      return task.status === value;
    case 'due': {
      if (condition.operator === 'isEmpty') return task.startDate === null;
      if (condition.operator === 'isNotEmpty') return task.startDate !== null;
      if (!task.startDate) return false;
      if (condition.operator === 'before') return task.startDate < value;
      if (condition.operator === 'after') return task.startDate > value;
      return task.startDate === value;
    }
    case 'completed': {
      const completedDate = dateKeyFromTimestamp(task.completedAt);
      if (condition.operator === 'isEmpty') return completedDate === null;
      if (condition.operator === 'isNotEmpty') return completedDate !== null;
      if (!completedDate) return false;
      if (condition.operator === 'before') return completedDate < value;
      if (condition.operator === 'after') return completedDate > value;
      return completedDate === value;
    }
  }
}

export function matchesFilter(
  task: Task,
  filter: Pick<SavedFilter, 'conditions' | 'match'>,
  context: FilterContext,
): boolean {
  if (filter.conditions.length === 0) return true;
  const test = (condition: FilterCondition) => matchesCondition(task, condition, context);
  return filter.match === 'any'
    ? filter.conditions.some(test)
    : filter.conditions.every(test);
}

export function filterSummary(
  filter: Pick<SavedFilter, 'conditions' | 'match'>,
  context: FilterContext,
): string {
  if (filter.conditions.length === 0) return '全部任务';
  const pieces = filter.conditions.map((condition) => {
    const field = FILTER_FIELDS.find((item) => item.value === condition.field)?.label ?? '';
    const operator =
      FILTER_OPERATORS[condition.field].find((item) => item.value === condition.operator)
        ?.label ?? '';
    let display = condition.value;
    if (condition.field === 'project') {
      display =
        context.projects.find((project) => project.id === condition.value)?.name ?? '已删除清单';
    }
    if (condition.field === 'tag') {
      display = context.tags.find((tag) => tag.id === condition.value)?.name ?? '已删除标签';
    }
    if (condition.field === 'priority') {
      display = FILTER_PRIORITY_VALUES.find((item) => item.value === condition.value)?.label ?? display;
    }
    if (condition.field === 'status') {
      display = FILTER_STATUS_VALUES.find((item) => item.value === condition.value)?.label ?? display;
    }
    if (!display) return `${field} ${operator}`.trim();
    return `${field} ${operator} ${display}`;
  });
  return pieces.join(filter.match === 'any' ? ' 或 ' : ' 且 ');
}

export function createCondition(
  field: FilterField = 'title',
  operator: FilterOperator = 'contains',
): FilterCondition {
  return {
    id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    field,
    operator,
    value: '',
  };
}
