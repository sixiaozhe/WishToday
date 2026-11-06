export type AiPriority = 0 | 1 | 3 | 5;

export interface CreateTaskAction {
  type: 'create_task';
  title: string;
  notes?: string;
  startDate?: string;
  startTime?: string;
  endTime?: string;
  priority?: AiPriority;
  project?: string;
  tags?: string[];
}

export interface AddSubtasksAction {
  type: 'add_subtasks';
  taskTitle: string;
  titles: string[];
}

export type AiAction = CreateTaskAction | AddSubtasksAction;

export interface AiApplyResult {
  created: number;
  subtasks: number;
  errors: string[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readTime(value: unknown): string | undefined {
  const text = readString(value);
  if (!text) return undefined;
  const match = /^(\d{1,2}):(\d{2})/.exec(text);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function readPriority(value: unknown): AiPriority | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  return numeric === 0 || numeric === 1 || numeric === 3 || numeric === 5
    ? (numeric as AiPriority)
    : undefined;
}

function sanitizeAction(value: unknown): AiAction | null {
  const record = asRecord(value);
  if (!record) return null;
  const type = readString(record.type);
  if (type === 'create_task') {
    const title = readString(record.title);
    if (!title) return null;
    const date = readString(record.startDate ?? record.start_date);
    const tags = Array.isArray(record.tags)
      ? [
          ...new Set(
            record.tags
              .map((tag) => readString(tag))
              .filter((tag): tag is string => Boolean(tag)),
          ),
        ].slice(0, 8)
      : undefined;
    return {
      type: 'create_task',
      title: title.slice(0, 200),
      notes: readString(record.notes ?? record.content ?? record.contentMd),
      startDate: date && DATE_PATTERN.test(date) ? date : undefined,
      startTime: readTime(record.startTime ?? record.start_time),
      endTime: readTime(record.endTime ?? record.end_time),
      priority: readPriority(record.priority),
      project: readString(record.project ?? record.projectName),
      tags: tags && tags.length > 0 ? tags : undefined,
    };
  }
  if (type === 'add_subtasks') {
    const taskTitle = readString(record.taskTitle ?? record.task_title);
    const titles = Array.isArray(record.titles)
      ? record.titles
          .map((title) => readString(title))
          .filter((title): title is string => Boolean(title))
          .slice(0, 20)
      : [];
    if (!taskTitle || titles.length === 0) return null;
    return { type: 'add_subtasks', taskTitle, titles };
  }
  return null;
}

/**
 * Splits an assistant reply into display text and executable actions. Actions
 * are carried in fenced ```json blocks so plain prose stays readable.
 */
export function parseAiReply(content: string): {
  text: string;
  actions: AiAction[];
} {
  let text = content;
  const actions: AiAction[] = [];
  const pattern = /```json\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1] ?? '') as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : asRecord(parsed)?.actions
          ? (asRecord(parsed)?.actions as unknown[])
          : [parsed];
      for (const item of list) {
        const action = sanitizeAction(item);
        if (action) actions.push(action);
      }
      text = text.replace(match[0], '');
    } catch {
      // Keep the block visible: the model produced something we cannot apply.
    }
  }

  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), actions };
}
