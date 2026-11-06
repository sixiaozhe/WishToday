import { useState } from 'react';
import { BellRing, Database, Moon, Sun } from 'lucide-react';
import type { AppPreferences } from '@dayline/core';
import { Modal } from './Modal';

interface SettingsDialogProps {
  preferences: AppPreferences;
  theme: 'light' | 'dark';
  notificationPermission: NotificationPermission | 'unsupported';
  storageLabel?: string;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onPreferencesChange: (preferences: AppPreferences) => void;
  onEnableNotifications: () => void;
  onCheckHealth?: () => Promise<{ ok: boolean; messages: string[] }>;
  onClose: () => void;
}

export function SettingsDialog({
  preferences,
  theme,
  notificationPermission,
  storageLabel,
  onThemeChange,
  onPreferencesChange,
  onEnableNotifications,
  onCheckHealth,
  onClose,
}: SettingsDialogProps) {
  const { calendar } = preferences;
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; messages: string[] } | null>(null);

  return (
    <Modal
      title="设置"
      subtitle="所有设置保存在本机；不会上传到任何服务器。"
      onClose={onClose}
      wide
    >
      <section className="backup-section">
        <h3>外观</h3>
        <div className="segmented">
          <button
            className={theme === 'light' ? 'is-active' : ''}
            onClick={() => onThemeChange('light')}
          >
            <Sun size={14} />
            浅色
          </button>
          <button
            className={theme === 'dark' ? 'is-active' : ''}
            onClick={() => onThemeChange('dark')}
          >
            <Moon size={14} />
            深色
          </button>
        </div>
      </section>

      <section className="backup-section">
        <h3>日历显示时段</h3>
        <div className="form-row">
          <label className="field">
            <span>开始小时</span>
            <input
              type="number"
              min={0}
              max={23}
              value={calendar.startHour}
              onChange={(event) =>
                onPreferencesChange({
                  calendar: {
                    ...calendar,
                    startHour: Math.max(0, Math.min(23, Number(event.target.value) || 0)),
                  },
                })
              }
            />
          </label>
          <label className="field">
            <span>结束小时</span>
            <input
              type="number"
              min={1}
              max={24}
              value={calendar.endHour}
              onChange={(event) =>
                onPreferencesChange({
                  calendar: {
                    ...calendar,
                    endHour: Math.max(1, Math.min(24, Number(event.target.value) || 24)),
                  },
                })
              }
            />
          </label>
        </div>
        <p className="field-hint">用于日/周/日程视图中时间网格的可见范围。</p>
      </section>

      <section className="backup-section">
        <h3>提醒</h3>
        <p className="field-hint">
          系统通知权限：
          {notificationPermission === 'granted'
            ? '已开启'
            : notificationPermission === 'denied'
              ? '已被浏览器拒绝（应用内提示仍可用）'
              : notificationPermission === 'unsupported'
                ? '当前环境不支持'
                : '尚未开启'}
        </p>
        {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
          <button className="button ghost" onClick={onEnableNotifications}>
            <BellRing size={14} />
            请求通知权限
          </button>
        )}
        <p className="field-hint">
          任务可添加多条提醒；提醒触发后可在提醒中心或提示条中稍后提醒。
        </p>
      </section>

      <section className="backup-section">
        <h3>数据健康</h3>
        <p className="field-hint">
          存储：{storageLabel ?? '本地数据库'}
        </p>
        <div className="button-row">
          <button
            className="button ghost"
            disabled={checking || !onCheckHealth}
            onClick={() => {
              if (!onCheckHealth) return;
              setChecking(true);
              void onCheckHealth()
                .then((result) => setHealth(result))
                .finally(() => setChecking(false));
            }}
          >
            <Database size={14} />
            {checking ? '检查中…' : '检查数据库完整性'}
          </button>
        </div>
        {health && (
          <div className={`health-result ${health.ok ? 'is-ok' : 'is-error'}`}>
            <strong>{health.ok ? 'SQLite 完整性检查通过' : '检查发现问题'}</strong>
            {!health.ok &&
              health.messages.map((message) => <span key={message}>{message}</span>)}
          </div>
        )}
        <p className="field-hint">
          写入遇到临时 I/O 或锁错误时会自动重试；恢复备份前也会自动创建一份本地快照。
        </p>
      </section>

      <section className="backup-section">
        <h3>快捷键</h3>
        <div className="shortcut-list">
          <span><kbd>N</kbd> 快速添加任务</span>
          <span><kbd>Ctrl</kbd> + <kbd>K</kbd> 全局搜索</span>
          <span><kbd>Ctrl</kbd> + <kbd>Z</kbd> 撤销</span>
          <span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> 重做</span>
          <span><kbd>Esc</kbd> 关闭详情 / 弹窗</span>
        </div>
      </section>
    </Modal>
  );
}
