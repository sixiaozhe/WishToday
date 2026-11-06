import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { todayKey, type AppState, type Task } from '@dayline/core';
import type { AiAction, AiApplyResult } from '../ai/actions';
import { parseAiReply } from '../ai/actions';
import { chatComplete } from '../ai/client';
import type { ChatMessage } from '../ai/client';
import { isAiConfigured, type AiSettings } from '../ai/settings';
import { Markdown } from './Markdown';

export interface AssistantSeed {
  key: number;
  taskId: string;
  prompt: string;
}

interface AssistantDockProps {
  open: boolean;
  profileId: string;
  settings: AiSettings;
  state: AppState;
  seed: AssistantSeed | null;
  onOpen: () => void;
  onClose: () => void;
  onClearSeed: () => void;
  onOpenSettings: () => void;
  onApplyActions: (actions: AiAction[]) => Promise<AiApplyResult>;
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  actions?: AiAction[];
  applied?: boolean;
  appliedSummary?: string;
}

const PRIORITY_LABEL: Record<number, string> = {
  0: '无优先级',
  1: '低优先级',
  3: '中优先级',
  5: '高优先级',
};

const SUGGESTIONS = [
  '帮我规划今天',
  '这周还有哪些重点？',
  '把今天没完成的任务整理一下',
  '给我一个 25 分钟的专注建议',
];

function chatStorageKey(profileId: string): string {
  return `dayline.ai.chat.v1.${profileId}`;
}

function loadChat(profileId: string): ChatEntry[] {
  try {
    const raw = window.localStorage.getItem(chatStorageKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is ChatEntry => {
        const record = entry as ChatEntry;
        return (
          Boolean(record) &&
          (record.role === 'user' ||
            record.role === 'assistant' ||
            record.role === 'error') &&
          typeof record.content === 'string'
        );
      })
      .slice(-40);
  } catch {
    return [];
  }
}

function saveChat(profileId: string, entries: ChatEntry[]): void {
  try {
    window.localStorage.setItem(
      chatStorageKey(profileId),
      JSON.stringify(entries.slice(-40)),
    );
  } catch {
    // Chat history is a convenience; the app keeps working without it.
  }
}

function taskLine(task: Task, state: AppState): string {
  const bits: string[] = [];
  bits.push(task.startDate ?? '无日期');
  if (task.startTime) {
    bits.push(task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime);
  }
  if (task.priority > 0) bits.push(PRIORITY_LABEL[task.priority] ?? '');
  const project = state.projects.find((item) => item.id === task.projectId);
  if (project) bits.push(project.name);
  return bits.filter(Boolean).join(' · ');
}

function buildSystemPrompt(
  settings: AiSettings,
  state: AppState,
  focusTask: Task | null,
): string {
  const now = new Date();
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  const today = todayKey();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;
  const projects = state.projects
    .filter((project) => project.kind === 'task' && !project.deletedAt)
    .map((project) => project.name);
  const tags = state.tags.map((tag) => tag.name);
  const openTasks = state.tasks.filter((task) => task.status === 'open');
  const focusTasks = settings.includeContext
    ? openTasks
        .filter(
          (task) =>
            task.startDate === today ||
            (task.startDate !== null && task.startDate < today) ||
            !task.startDate,
        )
        .slice(0, 25)
    : [];

  const lines = [
    '你是 WishToday（Dayline）的 AI 助手。这是一个本地优先的任务与时间管理应用。',
    `今天是 ${today}（星期${weekday}），当前时间 ${time}。`,
    '用简洁、可执行的中文回答。不要编造用户没有的数据。',
    '你可以帮助用户：规划日程、整理待办、拆解任务、给出时间安排建议。',
    '当前版本只能创建任务和给已有任务添加子任务，不能修改或删除已有任务；如果用户要求修改，请提示他在界面上操作。',
    '',
    `可用清单：${projects.length > 0 ? projects.join('、') : '收集箱'}`,
    `可用标签：${tags.length > 0 ? tags.join('、') : '无'}`,
  ];

  if (focusTasks.length > 0) {
    lines.push('', '用户当前的任务（标题、日期、时间、优先级、清单）：');
    for (const task of focusTasks) {
      lines.push(`- ${task.title}（${taskLine(task, state)}）`);
    }
  }

  if (focusTask) {
    const project = state.projects.find((item) => item.id === focusTask.projectId);
    const subtasks = state.tasks.filter(
      (task) => task.parentId === focusTask.id && !task.deletedAt,
    );
    lines.push(
      '',
      '用户正在针对下面这个任务提问，请优先结合它回答：',
      `- 标题：${focusTask.title}`,
      `- 日期：${taskLine(focusTask, state)}`,
      `- 状态：${focusTask.status}`,
      `- 清单：${project?.name ?? '收集箱'}`,
    );
    if (focusTask.contentMd.trim()) {
      lines.push(`- 备注：${focusTask.contentMd.slice(0, 1200)}`);
    }
    if (focusTask.checklist.length > 0) {
      lines.push(
        `- 检查事项：${focusTask.checklist
          .map((item) => `${item.completed ? '✓' : '○'} ${item.title}`)
          .join('；')}`,
      );
    }
    if (subtasks.length > 0) {
      lines.push(`- 已有子任务：${subtasks.map((task) => task.title).join('、')}`);
    }
    lines.push(
      '如果用户要拆解这个任务，优先使用 add_subtasks，taskTitle 必须使用上面的完整标题。',
    );
  }

  lines.push(
    '',
    '当用户要求创建任务或拆解任务时，在回复的最后附上一个 ```json 代码块，格式如下：',
    '```json',
    '{"actions":[{"type":"create_task","title":"任务标题","startDate":"YYYY-MM-DD","startTime":"09:00","endTime":"10:00","priority":3,"project":"工作","tags":["专注"],"notes":"补充说明"},{"type":"add_subtasks","taskTitle":"已有任务标题","titles":["子任务 1","子任务 2"]}]}',
    '```',
    '规则：',
    '- startDate 必须是 YYYY-MM-DD；startTime/endTime 必须是 HH:MM；priority 只能是 0、1、3、5。',
    '- project 和 tags 只能使用上面列出的名称；不确定的字段直接省略。',
    '- 只有用户明确说了时间才设置 startTime；没有日期就不要猜日期。',
    '- add_subtasks 的 taskTitle 必须来自上面的任务列表；找不到就不要使用这个动作。',
    '- 普通聊天不要输出 JSON 代码块。',
    '- 代码块之外的文字是给用户看的回复。',
  );

  return lines.join('\n');
}

export function AssistantDock({
  open,
  profileId,
  settings,
  state,
  seed,
  onOpen,
  onClose,
  onClearSeed,
  onOpenSettings,
  onApplyActions,
}: AssistantDockProps) {
  const [entries, setEntries] = useState<ChatEntry[]>(() => loadChat(profileId));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const configured = isAiConfigured(settings);
  const seedTask = seed
    ? state.tasks.find((task) => task.id === seed.taskId) ?? null
    : null;

  useEffect(() => {
    setEntries(loadChat(profileId));
  }, [profileId]);

  useEffect(() => {
    saveChat(profileId, entries);
  }, [entries, profileId]);

  useEffect(() => {
    if (!open) return;
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
    inputRef.current?.focus();
  }, [open, entries, busy]);

  useEffect(() => {
    if (!open || !seed) return;
    setInput(seed.prompt);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, seed]);

  async function send(value?: string) {
    const text = (value ?? input).trim();
    if (!text || busy || !configured) return;

    const userEntry: ChatEntry = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: text,
    };
    const history: ChatMessage[] = [...entries, userEntry]
      .filter((entry) => entry.role !== 'error')
      .slice(-16)
      .map((entry) => ({
        role: entry.role === 'assistant' ? 'assistant' : 'user',
        content: entry.content,
      }));

    setEntries((previous) => [...previous, userEntry]);
    setInput('');
    setBusy(true);
    try {
      const reply = await chatComplete(
        settings,
        [
          {
            role: 'system',
            content: buildSystemPrompt(settings, state, seedTask),
          },
          ...history,
        ],
        { timeoutMs: 120_000 },
      );
      const parsed = parseAiReply(reply);
      setEntries((previous) => [
        ...previous,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content:
            parsed.text ||
            (parsed.actions.length > 0
              ? '我准备了下面这些操作，确认后即可添加：'
              : '（模型没有返回文本内容）'),
          actions: parsed.actions.length > 0 ? parsed.actions : undefined,
          applied: false,
        },
      ]);
    } catch (error) {
      setEntries((previous) => [
        ...previous,
        {
          id: `e-${Date.now()}`,
          role: 'error',
          content: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function apply(entry: ChatEntry) {
    if (!entry.actions || applyingId) return;
    setApplyingId(entry.id);
    try {
      const result = await onApplyActions(entry.actions);
      const summary = [
        result.created > 0 ? `添加 ${result.created} 个任务` : '',
        result.subtasks > 0 ? `添加 ${result.subtasks} 个子任务` : '',
        ...result.errors,
      ]
        .filter(Boolean)
        .join('；');
      setEntries((previous) =>
        previous.map((item) =>
          item.id === entry.id
            ? { ...item, applied: true, appliedSummary: summary || '已应用' }
            : item,
        ),
      );
    } finally {
      setApplyingId(null);
    }
  }

  function clearChat() {
    if (busy) return;
    setEntries([]);
    saveChat(profileId, []);
  }

  return (
    <>
      {!open && (
        <button
          className="assistant-fab"
          onClick={onOpen}
          aria-label="打开 AI 助手"
          title="AI 助手"
        >
          <Sparkles size={21} />
        </button>
      )}

      {open && (
        <section className="assistant-panel" role="dialog" aria-label="AI 助手">
          <header className="assistant-panel-head">
            <div className="assistant-title">
              <span className="assistant-avatar small">
                <Sparkles size={14} />
              </span>
              <strong>AI 助手</strong>
              <em title={settings.model || '未配置模型'}>
                {settings.provider === 'ollama'
                  ? 'Ollama'
                  : settings.provider === 'openai'
                    ? 'OpenAI'
                    : settings.provider === 'custom'
                      ? '自定义'
                      : 'DeepSeek'}
              </em>
            </div>
            <div className="assistant-head-actions">
              <button
                className="icon-button small"
                onClick={onOpenSettings}
                aria-label="模型设置"
                title="模型设置"
              >
                <Settings2 size={15} />
              </button>
              <button
                className="icon-button small"
                onClick={clearChat}
                disabled={entries.length === 0 || busy}
                aria-label="清空对话"
                title="清空对话"
              >
                <Trash2 size={15} />
              </button>
              <button
                className="icon-button small"
                onClick={onClose}
                aria-label="关闭 AI 助手"
                title="关闭"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {seedTask && (
            <div className="assistant-context">
              <Sparkles size={13} />
              <span>正在询问：{seedTask.title}</span>
              <button
                className="assistant-context-close"
                onClick={() => {
                  if (input === seed?.prompt) setInput('');
                  onClearSeed();
                }}
                aria-label="取消任务上下文"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="assistant-log" ref={logRef}>
            {entries.length === 0 && (
              <div className="assistant-empty">
                <span className="assistant-avatar">
                  <Sparkles size={22} />
                </span>
                <h2>AI 助手</h2>
                <p>
                  用自然语言安排任务。比如「明天上午 10 点准备客户演示」，
                  我会生成任务，确认后写入本地数据库。
                </p>
                {!configured && (
                  <div className="assistant-warning">
                    <AlertCircle size={15} />
                    <span>还没有配置模型服务。API Key 只保存在本机。</span>
                    <button
                      className="button primary small"
                      onClick={onOpenSettings}
                    >
                      去设置
                    </button>
                  </div>
                )}
                <div className="assistant-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="assistant-chip"
                      disabled={!configured}
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`assistant-message assistant-${entry.role}`}
              >
                <div className="assistant-bubble">
                  {entry.role === 'assistant' ? (
                    <Markdown value={entry.content} />
                  ) : (
                    <p>{entry.content}</p>
                  )}

                  {entry.role === 'assistant' && entry.actions && (
                    <div className="assistant-actions">
                      {entry.actions.map((action, index) => (
                        <div className="assistant-action" key={index}>
                          {action.type === 'create_task' ? (
                            <>
                              <div className="assistant-action-head">
                                <strong>{action.title}</strong>
                                {action.priority !== undefined && (
                                  <span className="assistant-pill">
                                    {PRIORITY_LABEL[action.priority]}
                                  </span>
                                )}
                              </div>
                              <div className="assistant-action-meta">
                                {[
                                  action.startDate,
                                  action.startTime
                                    ? action.endTime
                                      ? `${action.startTime}–${action.endTime}`
                                      : action.startTime
                                    : '',
                                  action.project,
                                  ...(action.tags ?? []),
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || '收集箱 · 无日期'}
                              </div>
                              {action.notes && (
                                <p className="assistant-action-note">
                                  {action.notes}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="assistant-action-head">
                                <strong>拆解「{action.taskTitle}」</strong>
                              </div>
                              <div className="assistant-action-meta">
                                {action.titles.join(' · ')}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      <div className="assistant-apply-row">
                        <button
                          className="button primary small"
                          disabled={entry.applied || applyingId === entry.id}
                          onClick={() => void apply(entry)}
                        >
                          {applyingId === entry.id ? (
                            <>
                              <Loader2 size={13} className="spin" />
                              添加中…
                            </>
                          ) : entry.applied ? (
                            <>
                              <Check size={13} />
                              {entry.appliedSummary || '已添加'}
                            </>
                          ) : (
                            '确认添加'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="assistant-message assistant-assistant">
                <div className="assistant-bubble assistant-typing">
                  <Loader2 size={15} className="spin" />
                  正在思考…
                </div>
              </div>
            )}
          </div>

          <form
            className="assistant-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              placeholder={
                configured
                  ? '描述任务或提问，Enter 发送'
                  : '请先在设置里配置模型服务'
              }
              disabled={!configured || busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              className="button primary"
              disabled={!configured || busy || !input.trim()}
            >
              <Send size={15} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
