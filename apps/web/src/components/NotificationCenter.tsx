import { useState } from 'react';
import { AlarmClock, Bell, Check, Clock3 } from 'lucide-react';
import { formatReminderTime, type Reminder, type Task } from '@dayline/core';

interface NotificationCenterProps {
  reminders: Reminder[];
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onSnooze: (reminder: Reminder, minutes: number) => void;
  onDismiss: (reminder: Reminder) => void;
}

export function NotificationCenter({
  reminders,
  tasks,
  onOpenTask,
  onSnooze,
  onDismiss,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const pending = reminders.filter((reminder) => {
    if (reminder.ownerType !== 'task') return false;
    if (!['pending', 'snoozed', 'fired'].includes(reminder.state)) return false;
    const task = tasks.find((item) => item.id === reminder.ownerId);
    return Boolean(task && task.deletedAt === null && task.status === 'open');
  });

  return (
    <div className="notification-center">
      <button
        className={`icon-button ${pending.length > 0 ? 'has-badge' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-label="提醒中心"
      >
        <Bell size={18} />
        {pending.length > 0 && <span className="badge">{pending.length}</span>}
      </button>

      {open && (
        <>
          <button className="popover-backdrop" onClick={() => setOpen(false)} aria-label="关闭提醒中心" />
          <div className="notification-popover">
            <header>
              <h3>提醒中心</h3>
              <span>{pending.length} 条</span>
            </header>
            <div className="notification-list">
              {pending.map((reminder) => {
                const task = tasks.find((item) => item.id === reminder.ownerId);
                if (!task) return null;
                return (
                  <div key={reminder.id} className="notification-row">
                    <button className="notification-main" onClick={() => onOpenTask(task)}>
                      <AlarmClock size={14} />
                      <div>
                        <strong>{task.title}</strong>
                        <span>
                          {formatReminderTime(reminder.snoozeUntil ?? reminder.triggerAt)}
                          {reminder.state === 'snoozed' ? ' · 稍后提醒' : ''}
                          {reminder.state === 'fired' ? ' · 已提醒' : ''}
                        </span>
                      </div>
                    </button>
                    <div className="notification-actions">
                      <button
                        className="button ghost tiny"
                        onClick={() => onSnooze(reminder, 10)}
                        title="10 分钟后提醒"
                      >
                        <Clock3 size={12} />
                        10 分
                      </button>
                      <button
                        className="button ghost tiny"
                        onClick={() => onSnooze(reminder, 60)}
                        title="1 小时后提醒"
                      >
                        1 小时
                      </button>
                      <button
                        className="icon-button tiny"
                        onClick={() => onDismiss(reminder)}
                        aria-label="忽略提醒"
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {pending.length === 0 && <p className="field-hint">没有待处理的提醒。</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
