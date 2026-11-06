import { useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CornerDownRight,
  Eye,
  Flag,
  Folder,
  ListChecks,
  MessageSquare,
  Paperclip,
  PenLine,
  Repeat,
  RotateCcw,
  Send,
  Tag as TagIcon,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import {
  formatDurationLabel,
  formatReminderTime,
  parseLocalDateKey,
  reminderOffsetLabel,
  REMINDER_OFFSETS,
  type AttachmentMeta,
  type Priority,
  type Project,
  type RecurrenceEndType,
  type RecurrenceFreq,
  type RecurrenceMode,
  type RecurrenceRule,
  type RecurrenceSeries,
  type Reminder,
  type Tag,
  type Task,
  type TaskComment,
  type TaskPatch,
} from '@dayline/core';
import { ruleLabel } from '@dayline/recurrence';
import { Markdown } from './Markdown';
import { AttachmentItem } from './AttachmentItem';
import { Select } from './controls/Select';
import { DatePicker } from './controls/DatePicker';
import { TimePicker } from './controls/TimePicker';

interface TaskDetailProps {
  task: Task;
  projects: Project[];
  tags: Tag[];
  series: RecurrenceSeries | null;
  hasOverride: boolean;
  subtasks: Task[];
  reminders: Reminder[];
  comments: TaskComment[];
  attachments: AttachmentMeta[];
  notificationPermission: NotificationPermission | 'unsupported';
  onClose: () => void;
  onUpdate: (task: Task, patch: TaskPatch) => void;
  onToggle: (task: Task) => void;
  onTrash: (task: Task) => void;
  onRestore: (task: Task) => void;
  onSetRecurrence: (freq: RecurrenceFreq | null) => void;
  onUpdateRecurrence: (patch: {
    rule?: Partial<RecurrenceRule>;
    mode?: RecurrenceMode;
    endType?: RecurrenceEndType;
    endDate?: string | null;
    endCount?: number | null;
  }) => void;
  onSkipOccurrence: (task: Task) => void;
  onRestoreOccurrence: (task: Task) => void;
  onAddChecklistItem: (title: string) => void;
  onToggleChecklistItem: (itemId: string) => void;
  onDeleteChecklistItem: (itemId: string) => void;
  onAddSubtask: (title: string) => void;
  onOpenSubtask: (task: Task) => void;
  onDetachSubtask: (task: Task) => void;
  onAbandon: (task: Task) => void;
  onRestart: (task: Task) => void;
  onDuplicate: () => void;
  onAddReminder: (offsetMinutes: number) => void;
  onDeleteReminder: (reminderId: string) => void;
  onAddComment: (content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onAddAttachment: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onSaveTemplate: () => void;
  onOpenTaskByTitle: (title: string) => void;
  onEnableNotifications: () => void;
}

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 0, label: '无优先级' },
  { value: 1, label: '低' },
  { value: 3, label: '中' },
  { value: 5, label: '高' },
];

export function TaskDetail({
  task,
  projects,
  tags,
  series,
  hasOverride,
  subtasks,
  reminders,
  comments,
  attachments,
  notificationPermission,
  onClose,
  onUpdate,
  onToggle,
  onTrash,
  onRestore,
  onSetRecurrence,
  onUpdateRecurrence,
  onSkipOccurrence,
  onRestoreOccurrence,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onAddSubtask,
  onOpenSubtask,
  onDetachSubtask,
  onAbandon,
  onRestart,
  onDuplicate,
  onAddReminder,
  onDeleteReminder,
  onAddComment,
  onDeleteComment,
  onAddAttachment,
  onDeleteAttachment,
  onSaveTemplate,
  onOpenTaskByTitle,
  onEnableNotifications,
}: TaskDetailProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.contentMd);
  const [preview, setPreview] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [comment, setComment] = useState('');
  const checklistDone = task.checklist.filter((item) => item.completed).length;
  const completed = task.status === 'completed';
  const skipped = task.status === 'skipped';
  const deleted = task.deletedAt !== null;
  const selectableProjects = projects
    .filter((project) => project.deletedAt === null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  function commitTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(task.title);
      return;
    }
    if (next !== task.title) onUpdate(task, { title: next });
  }

  function commitNotes() {
    if (notes !== task.contentMd) onUpdate(task, { contentMd: notes });
  }

  function toggleTag(tagId: string) {
    const next = task.tagIds.includes(tagId)
      ? task.tagIds.filter((id) => id !== tagId)
      : [...task.tagIds, tagId];
    onUpdate(task, { tagIds: next });
  }

  return (
    <aside className="detail-panel">
      <div className="detail-head">
        <span>任务详情</span>
        <button className="icon-button small" onClick={onClose} aria-label="关闭详情">
          <X size={17} />
        </button>
      </div>

      {deleted && <div className="detail-banner">此任务在垃圾桶中，可恢复后继续编辑。</div>}
      {skipped && <div className="detail-banner">此周期已跳过，可恢复为未完成状态。</div>}

      <div className="detail-body">
        <input
          className="detail-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          aria-label="任务标题"
        />

        <div className="notes-header">
          <span>备注</span>
          <div className="segmented tiny">
            <button className={!preview ? 'is-active' : ''} onClick={() => setPreview(false)}>
              <PenLine size={12} />
              编辑
            </button>
            <button className={preview ? 'is-active' : ''} onClick={() => setPreview(true)}>
              <Eye size={12} />
              预览
            </button>
          </div>
        </div>
        {preview ? (
          <div className="detail-notes preview">
            <Markdown value={notes} onLinkTask={onOpenTaskByTitle} />
            {!notes.trim() && <span className="field-hint">还没有备注内容。</span>}
          </div>
        ) : (
          <textarea
            className="detail-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={commitNotes}
            placeholder="添加备注、链接或下一步行动… 支持 Markdown"
            rows={6}
            aria-label="任务备注"
          />
        )}

        <div className="detail-grid">
          <div className="field">
            <span>
              <CalendarDays size={14} />
              日期
            </span>
            <DatePicker
              value={task.startDate}
              onChange={(value) => onUpdate(task, { startDate: value })}
              ariaLabel="任务日期"
              clearable
            />
          </div>

          <div className="field">
            <span>
              <CalendarDays size={14} />
              结束日期
            </span>
            <DatePicker
              value={task.endDate}
              min={task.startDate}
              disabled={!task.startDate}
              onChange={(value) => onUpdate(task, { endDate: value })}
              ariaLabel="任务结束日期"
              clearable
            />
          </div>

          <div className="field">
            <span>
              <Clock size={14} />
              时间
            </span>
            <TimePicker
              value={task.startTime}
              disabled={!task.startDate}
              onChange={(value) => onUpdate(task, { startTime: value })}
              ariaLabel="任务时间"
              placeholder="全天"
              clearable
            />
          </div>

          <div className="field">
            <span>
              <Clock size={14} />
              结束
            </span>
            <TimePicker
              value={task.endTime}
              disabled={!task.startTime}
              onChange={(value) => onUpdate(task, { endTime: value })}
              ariaLabel="任务结束时间"
              placeholder="未设置"
              clearable
            />
          </div>

          <div className="field">
            <span>
              <Flag size={14} />
              优先级
            </span>
            <Select
              value={String(task.priority)}
              onChange={(value) =>
                onUpdate(task, { priority: Number(value) as Priority })
              }
              options={PRIORITIES.map((priority) => ({
                value: String(priority.value),
                label: priority.label,
              }))}
              ariaLabel="优先级"
            />
          </div>

          <div className="field">
            <span>
              <Folder size={14} />
              清单
            </span>
            <Select
              value={task.projectId}
              onChange={(value) => onUpdate(task, { projectId: value })}
              options={selectableProjects.map((project) => ({
                value: project.id,
                label: project.name,
                icon: (
                  <span
                    className="project-dot small"
                    style={{ background: project.color }}
                  />
                ),
              }))}
              ariaLabel="所属清单"
            />
          </div>
        </div>

        <div className="detail-section">
          <span className="detail-label">
            <ListChecks size={14} />
            检查事项
            {task.checklist.length > 0 && (
              <em>
                {checklistDone}/{task.checklist.length}
              </em>
            )}
          </span>
          {task.checklist.length > 0 && (
            <div className="progress-track">
              <span style={{ width: `${task.progress}%` }} />
            </div>
          )}
          <div className="checklist-list">
            {task.checklist.map((item) => (
              <div key={item.id} className="checklist-row">
                <button
                  type="button"
                  className={`check small ${item.completed ? 'is-checked' : ''}`}
                  onClick={() => onToggleChecklistItem(item.id)}
                  aria-label={item.completed ? '取消勾选检查事项' : '完成检查事项'}
                >
                  {item.completed && <Check size={10} strokeWidth={3} />}
                </button>
                <span className={item.completed ? 'is-done' : ''}>{item.title}</span>
                <button
                  type="button"
                  className="icon-button small"
                  onClick={() => onDeleteChecklistItem(item.id)}
                  aria-label="删除检查事项"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="inline-add"
            onSubmit={(event) => {
              event.preventDefault();
              const value = checklistTitle.trim();
              if (!value) return;
              onAddChecklistItem(value);
              setChecklistTitle('');
            }}
          >
            <input
              value={checklistTitle}
              onChange={(event) => setChecklistTitle(event.target.value)}
              placeholder="添加检查事项，回车确认"
            />
          </form>
        </div>

        <div className="detail-section">
          <span className="detail-label">
            <CornerDownRight size={14} />
            子任务
            {subtasks.length > 0 && <em>{subtasks.length}</em>}
          </span>
          <div className="subtask-list">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="subtask-row"
                onClick={() => onOpenSubtask(subtask)}
              >
                <button
                  type="button"
                  className={`check small ${
                    subtask.status === 'completed' ? 'is-checked' : ''
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(subtask);
                  }}
                  aria-label={subtask.status === 'completed' ? '取消完成子任务' : '完成子任务'}
                >
                  {subtask.status === 'completed' && <Check size={10} strokeWidth={3} />}
                </button>
                <span className={subtask.status === 'completed' ? 'is-done' : ''}>
                  {subtask.title}
                </span>
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDetachSubtask(subtask);
                  }}
                  aria-label="转为独立任务"
                  title="转为独立任务"
                >
                  <Unlink size={12} />
                </button>
                <ChevronRight size={14} className="subtask-arrow" />
              </div>
            ))}
          </div>
          <form
            className="inline-add"
            onSubmit={(event) => {
              event.preventDefault();
              const value = subtaskTitle.trim();
              if (!value) return;
              onAddSubtask(value);
              setSubtaskTitle('');
            }}
          >
            <input
              value={subtaskTitle}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              placeholder="添加子任务，回车确认"
            />
          </form>
        </div>

        <div className="detail-section">
          <span className="detail-label">
            <Repeat size={14} />
            重复
          </span>
          <div className="recurrence-row">
            <Select
              value={series?.rule.freq ?? ''}
              disabled={!task.startDate}
              onChange={(value) =>
                onSetRecurrence((value || null) as RecurrenceFreq | null)
              }
              options={[
                { value: '', label: '不重复' },
                { value: 'daily', label: '每天' },
                { value: 'weekly', label: '每周' },
                { value: 'monthly', label: '每月' },
                { value: 'yearly', label: '每年' },
                { value: 'weekdays', label: '每个工作日' },
                { value: 'weekend', label: '每周末' },
                { value: 'statutory_workday', label: '法定工作日' },
                { value: 'statutory_holiday', label: '法定节假日' },
                { value: 'ebbinghaus', label: '艾宾浩斯复习' },
                { value: 'selected_dates', label: '自选日期' },
              ]}
              ariaLabel="重复规则"
              className="recurrence-select"
            />
            {series && <span className="recurrence-hint">{ruleLabel(series.rule)}</span>}
          </div>
          {series && (
            <div className="recurrence-advanced">
              {['daily', 'weekly', 'monthly', 'yearly'].includes(series.rule.freq) && (
                <label className="field">
                  <span>间隔</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={series.rule.interval ?? 1}
                    onChange={(event) =>
                      onUpdateRecurrence({
                        rule: { interval: Math.max(1, Number(event.target.value) || 1) },
                      })
                    }
                  />
                </label>
              )}

              {series.rule.freq === 'weekly' && (
                <div className="field">
                  <span>重复星期</span>
                  <div className="weekday-picker">
                    {[
                      { value: 1, label: '一' },
                      { value: 2, label: '二' },
                      { value: 3, label: '三' },
                      { value: 4, label: '四' },
                      { value: 5, label: '五' },
                      { value: 6, label: '六' },
                      { value: 7, label: '日' },
                    ].map((day) => {
                      const active = (series.rule.byWeekday ?? []).includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={active ? 'is-active' : ''}
                          onClick={() => {
                            const current = new Set(
                              series.rule.byWeekday?.length
                                ? series.rule.byWeekday
                                : [parseLocalDateKey(series.dtstartDate).getDay() || 7],
                            );
                            if (current.has(day.value)) current.delete(day.value);
                            else current.add(day.value);
                            if (current.size > 0) {
                              onUpdateRecurrence({
                                rule: { byWeekday: [...current].sort() },
                              });
                            }
                          }}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {series.rule.freq === 'monthly' && (
                <label className="field">
                  <span>每月几号</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={series.rule.byMonthDay?.[0] ?? parseLocalDateKey(series.dtstartDate).getDate()}
                    onChange={(event) =>
                      onUpdateRecurrence({
                        rule: { byMonthDay: [Math.max(1, Math.min(31, Number(event.target.value) || 1))] },
                      })
                    }
                  />
                </label>
              )}

              {series.rule.freq === 'selected_dates' && (
                <label className="field">
                  <span>自选日期（每行或逗号分隔）</span>
                  <textarea
                    rows={3}
                    value={(series.rule.selectedDates ?? []).join('\n')}
                    onChange={(event) =>
                      onUpdateRecurrence({
                        rule: {
                          selectedDates: event.target.value
                            .split(/[\n,，]/)
                            .map((value) => value.trim())
                            .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
                        },
                      })
                    }
                    placeholder={'2026-11-06\n2026-11-20'}
                  />
                </label>
              )}

              <div className="form-row">
                <div className="field">
                  <span>重复方式</span>
                  <Select
                    value={series.mode}
                    onChange={(value) =>
                      onUpdateRecurrence({ mode: value as RecurrenceMode })
                    }
                    options={[
                      { value: 'due', label: '按到期日' },
                      { value: 'completion', label: '完成后重复' },
                    ]}
                    ariaLabel="重复方式"
                  />
                </div>
                <div className="field">
                  <span>结束条件</span>
                  <Select
                    value={series.endType}
                    onChange={(value) =>
                      onUpdateRecurrence({ endType: value as RecurrenceEndType })
                    }
                    options={[
                      { value: 'never', label: '永不结束' },
                      { value: 'date', label: '指定日期' },
                      { value: 'count', label: '指定次数' },
                    ]}
                    ariaLabel="重复结束条件"
                  />
                </div>
              </div>

              {series.endType === 'date' && (
                <div className="field">
                  <span>结束日期</span>
                  <DatePicker
                    value={series.endDate}
                    min={series.dtstartDate}
                    onChange={(value) => onUpdateRecurrence({ endDate: value })}
                    ariaLabel="重复结束日期"
                    clearable
                  />
                </div>
              )}

              {series.endType === 'count' && (
                <label className="field">
                  <span>结束次数</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={series.endCount ?? 10}
                    onChange={(event) =>
                      onUpdateRecurrence({
                        endCount: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </label>
              )}
            </div>
          )}
          {series && (
            <p className="field-hint">
              修改日期/时间只影响当前周期；修改重复规则会影响后续周期。
            </p>
          )}
          {!task.startDate && <p className="field-hint">先设置日期才能添加重复规则。</p>}
          {series &&
            (series.rule.freq === 'statutory_workday' ||
              series.rule.freq === 'statutory_holiday') && (
              <p className="field-hint">
                当前内置 2026 年法定节假日/调休数据；其他年份按周一至周五/周末计算。
              </p>
            )}
          {series && (task.status === 'open' || hasOverride) && (
            <div className="recurrence-actions">
              {task.status === 'open' && (
                <button
                  className="button ghost small"
                  onClick={() => onSkipOccurrence(task)}
                >
                  跳过此周期
                </button>
              )}
              {hasOverride && (
                <button
                  className="button ghost small"
                  onClick={() => onRestoreOccurrence(task)}
                >
                  恢复默认时间
                </button>
              )}
            </div>
          )}
        </div>

        <div className="detail-section">
          <span className="detail-label">
            <Bell size={14} />
            提醒
            {reminders.length > 0 && <em>{reminders.length}</em>}
          </span>
          <div className="reminder-list">
            {reminders.map((reminder) => (
              <div key={reminder.id} className="reminder-row">
                <BellRing size={13} />
                <span>{formatReminderTime(reminder.triggerAt)}</span>
                <em>
                  {reminder.offsetMinutes !== null
                    ? reminderOffsetLabel(reminder.offsetMinutes)
                    : reminder.state}
                </em>
                <button
                  className="icon-button tiny"
                  onClick={() => onDeleteReminder(reminder.id)}
                  aria-label="删除提醒"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <Select
            value=""
            disabled={!task.startDate}
            onChange={(value) => {
              if (!value) return;
              onAddReminder(Number(value));
            }}
            options={REMINDER_OFFSETS.map((offset) => ({
              value: String(offset),
              label: reminderOffsetLabel(offset),
            }))}
            placeholder="+ 添加提醒"
            ariaLabel="添加提醒"
          />
          {!task.startDate && <p className="field-hint">先设置日期才能添加提醒。</p>}
          {notificationPermission !== 'granted' &&
            notificationPermission !== 'unsupported' &&
            task.startDate && (
              <button
                className="button ghost small reminder-permission"
                onClick={onEnableNotifications}
              >
                <BellRing size={14} />
                开启系统通知
              </button>
            )}
          {notificationPermission === 'denied' && (
            <p className="field-hint">
              浏览器已拒绝通知权限，可在站点设置中重新开启；应用内仍会提示。
            </p>
          )}
        </div>

        {tags.length > 0 && (
          <div className="detail-section">
            <span className="detail-label">
              <TagIcon size={14} />
              标签
            </span>
            <div className="tag-picker">
              {tags.map((tag) => {
                const active = task.tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    className={`tag-option ${active ? 'is-active' : ''}`}
                    onClick={() => toggleTag(tag.id)}
                    type="button"
                  >
                    <span className="tag-dot" style={{ background: tag.color }} />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="detail-section">
          <span className="detail-label">
            <Paperclip size={14} />
            附件
            {attachments.length > 0 && <em>{attachments.length}</em>}
          </span>
          <div className="attachment-list">
            {attachments.map((attachment) => (
              <AttachmentItem
                key={attachment.id}
                attachment={attachment}
                onDelete={onDeleteAttachment}
              />
            ))}
          </div>
          <label className="button ghost small file-button">
            <Paperclip size={14} />
            添加附件
            <input
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAddAttachment(file);
                event.target.value = '';
              }}
            />
          </label>
          <p className="field-hint">
            附件保存在本机 OPFS / IndexedDB 中，单个文件建议小于 10 MB。
          </p>
        </div>

        <div className="detail-section">
          <span className="detail-label">
            <MessageSquare size={14} />
            评论与动态
            {comments.length > 0 && <em>{comments.length}</em>}
          </span>
          <div className="comment-list">
            {comments.map((item) => (
              <div key={item.id} className="comment-row">
                <div className="comment-bubble">
                  <Markdown value={item.contentMd} onLinkTask={onOpenTaskByTitle} />
                  <span>{formatDurationLabel(item.createdAt)}</span>
                </div>
                <button
                  className="icon-button tiny"
                  onClick={() => onDeleteComment(item.id)}
                  aria-label="删除评论"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="comment-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = comment.trim();
              if (!value) return;
              onAddComment(value);
              setComment('');
            }}
          >
            <textarea
              value={comment}
              rows={2}
              onChange={(event) => setComment(event.target.value)}
              placeholder="添加评论，支持 Markdown…"
              aria-label="添加评论"
            />
            <button className="button primary small" type="submit">
              <Send size={13} />
              发送
            </button>
          </form>
        </div>

        <div className="detail-meta">
          创建于 {formatDurationLabel(task.createdAt)} · 更新于{' '}
          {formatDurationLabel(task.updatedAt)}
        </div>
      </div>

      <div className="detail-actions">
        {task.status === 'abandoned' && (
          <button className="button primary" onClick={() => onRestart(task)}>
            <RotateCcw size={16} />
            重新开始
          </button>
        )}
        {skipped && (
          <button className="button primary" onClick={() => onRestore(task)}>
            <RotateCcw size={16} />
            恢复此周期
          </button>
        )}
        {!deleted && !skipped && task.status !== 'abandoned' && (
          <button className="button primary" onClick={() => onToggle(task)}>
            <CheckCircle2 size={16} />
            {completed ? '重新打开' : '完成任务'}
          </button>
        )}
        {!deleted && task.status === 'open' && (
          <button className="button ghost" onClick={() => onAbandon(task)}>
            放弃
          </button>
        )}
        {!deleted && (
          <button className="button ghost" onClick={onDuplicate}>
            创建副本
          </button>
        )}
        {!deleted && (
          <button className="button ghost" onClick={onSaveTemplate}>
            保存为模板
          </button>
        )}
        {deleted ? (
          <button className="button ghost" onClick={() => onRestore(task)}>
            <RotateCcw size={16} />
            恢复
          </button>
        ) : (
          <button className="button danger-ghost" onClick={() => onTrash(task)}>
            <Trash2 size={16} />
            删除
          </button>
        )}
      </div>
    </aside>
  );
}
