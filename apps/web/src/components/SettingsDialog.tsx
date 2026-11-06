import { useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Database,
  Moon,
  Sparkles,
  Sun,
  XCircle,
} from 'lucide-react';
import type { AppPreferences } from '@dayline/core';
import {
  AI_PRESETS,
  AI_PROVIDER_ORDER,
  applyAiPreset,
  type AiProvider,
  type AiSettings,
} from '../ai/settings';
import { testAiConnection } from '../ai/client';
import { Modal } from './Modal';

interface SettingsDialogProps {
  preferences: AppPreferences;
  theme: 'light' | 'dark';
  notificationPermission: NotificationPermission | 'unsupported';
  storageLabel?: string;
  aiSettings: AiSettings;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onPreferencesChange: (preferences: AppPreferences) => void;
  onAiSettingsChange: (settings: AiSettings) => void;
  onEnableNotifications: () => void;
  onCheckHealth?: () => Promise<{ ok: boolean; messages: string[] }>;
  onClose: () => void;
}

export function SettingsDialog({
  preferences,
  theme,
  notificationPermission,
  storageLabel,
  aiSettings,
  onThemeChange,
  onPreferencesChange,
  onAiSettingsChange,
  onEnableNotifications,
  onCheckHealth,
  onClose,
}: SettingsDialogProps) {
  const { calendar } = preferences;
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTest, setAiTest] = useState<{ ok: boolean; message: string } | null>(null);

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
        <h3>
          <Sparkles size={13} /> AI 助手
        </h3>
        <div className="form-row">
          <label className="field">
            <span>模型服务</span>
            <select
              value={aiSettings.provider}
              onChange={(event) => {
                setAiTest(null);
                onAiSettingsChange(
                  applyAiPreset(aiSettings, event.target.value as AiProvider),
                );
              }}
            >
              {AI_PROVIDER_ORDER.map((provider) => (
                <option key={provider} value={provider}>
                  {AI_PRESETS[provider].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>模型名称</span>
            <input
              value={aiSettings.model}
              placeholder="deepseek-chat"
              onChange={(event) => {
                setAiTest(null);
                onAiSettingsChange({ ...aiSettings, model: event.target.value });
              }}
            />
          </label>
        </div>
        <label className="field">
          <span>API 地址</span>
          <input
            value={aiSettings.baseUrl}
            placeholder="https://api.deepseek.com/v1"
            onChange={(event) => {
              setAiTest(null);
              onAiSettingsChange({ ...aiSettings, baseUrl: event.target.value });
            }}
          />
        </label>
        <label className="field">
          <span>API Key</span>
          <input
            type="password"
            value={aiSettings.apiKey}
            placeholder={
              AI_PRESETS[aiSettings.provider].requiresKey
                ? '只保存在本机'
                : '本地模型通常留空'
            }
            autoComplete="off"
            onChange={(event) => {
              setAiTest(null);
              onAiSettingsChange({ ...aiSettings, apiKey: event.target.value });
            }}
          />
        </label>
        <div className="form-row">
          <label className="field">
            <span>温度（0–2）</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={aiSettings.temperature}
              onChange={(event) => {
                setAiTest(null);
                onAiSettingsChange({
                  ...aiSettings,
                  temperature: Math.max(
                    0,
                    Math.min(2, Number(event.target.value) || 0),
                  ),
                });
              }}
            />
          </label>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={aiSettings.includeContext}
              onChange={(event) =>
                onAiSettingsChange({
                  ...aiSettings,
                  includeContext: event.target.checked,
                })
              }
            />
            <span>发送今日任务作为上下文</span>
          </label>
        </div>
        <div className="button-row">
          <button
            className="button ghost"
            disabled={testingAi}
            onClick={() => {
              setTestingAi(true);
              setAiTest(null);
              void testAiConnection(aiSettings)
                .then((result) => setAiTest(result))
                .finally(() => setTestingAi(false));
            }}
          >
            <Sparkles size={14} />
            {testingAi ? '测试中…' : '测试连接'}
          </button>
        </div>
        {aiTest && (
          <div className={`health-result ${aiTest.ok ? 'is-ok' : 'is-error'}`}>
            {aiTest.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            <span>{aiTest.message}</span>
          </div>
        )}
        <p className="field-hint">
          密钥只保存在本机，不写入备份，也不会上传到其他服务器。发送消息时，任务上下文会传给上面配置的模型服务；使用 Ollama 时不会离开本机。
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
