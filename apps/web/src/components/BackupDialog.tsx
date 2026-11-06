import { useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import {
  downloadTextFile,
  icsToTasks,
  parseBackup,
  parseIcs,
  parseTasksCsv,
  serializeBackup,
  tasksToCsv,
  tasksToIcs,
  type AppState,
  type Project,
  type Task,
} from '@dayline/core';
import { maybeAutoBackup, readAutoBackup, writeAutoBackup } from '../backupStore';
import { hydrateAttachmentDataUrls } from '../attachments';
import { Modal } from './Modal';

interface BackupDialogProps {
  state: AppState;
  defaultProjectId: string;
  projects: Project[];
  onRestoreState: (state: AppState) => void;
  onImportTasks: (tasks: Task[]) => void;
  onClose: () => void;
  onToast: (title: string, body: string) => void;
}

function stamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
}

export function BackupDialog({
  state,
  defaultProjectId,
  projects,
  onRestoreState,
  onImportTasks,
  onClose,
  onToast,
}: BackupDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autoBackupAt, setAutoBackupAt] = useState(() => readAutoBackup()?.at ?? null);
  const [pending, setPending] = useState<{ name: string; kind: 'json' | 'csv' | 'ics'; text: string } | null>(null);

  const auto = readAutoBackup();

  async function handleFile(file: File) {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.json') || text.trimStart().startsWith('{')) {
      setPending({ name: file.name, kind: 'json', text });
    } else if (lower.endsWith('.ics') || text.includes('BEGIN:VCALENDAR')) {
      setPending({ name: file.name, kind: 'ics', text });
    } else {
      setPending({ name: file.name, kind: 'csv', text });
    }
  }

  function confirmImport() {
    if (!pending) return;
    try {
      if (pending.kind === 'json') {
        onRestoreState(parseBackup(pending.text));
        onToast('恢复完成', '已用备份替换当前数据，可刷新页面确认。');
      } else if (pending.kind === 'ics') {
        const tasks = icsToTasks(parseIcs(pending.text), {
          profileId: state.profile.id,
          projectId: defaultProjectId,
        });
        onImportTasks(tasks);
        onToast('导入完成', `已导入 ${tasks.length} 个日程。`);
      } else {
        const tasks = parseTasksCsv(pending.text, {
          profileId: state.profile.id,
          defaultProjectId,
          projects,
        });
        onImportTasks(tasks);
        onToast('导入完成', `已导入 ${tasks.length} 个任务。`);
      }
      setPending(null);
      onClose();
    } catch (error) {
      onToast('导入失败', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Modal
      title="备份与恢复"
      subtitle="所有导出都在本地浏览器完成；建议定期下载 JSON 备份。"
      onClose={onClose}
      wide
    >
      <section className="backup-section">
        <h3>导出</h3>
        <div className="button-row">
          <button
            className="button primary"
            onClick={() => {
              void (async () => {
                try {
                  const portable = await hydrateAttachmentDataUrls(state);
                  downloadTextFile(
                    serializeBackup(portable),
                    `dayline-backup-${stamp()}.json`,
                    'application/json',
                  );
                  onToast(
                    '已导出 JSON',
                    '包含任务、清单、标签、习惯、专注、附件等全部数据。',
                  );
                } catch (error) {
                  onToast(
                    '导出失败',
                    error instanceof Error ? error.message : String(error),
                  );
                }
              })();
            }}
          >
            <Download size={15} />
            JSON 完整备份
          </button>
          <button
            className="button ghost"
            onClick={() => {
              downloadTextFile(
                tasksToCsv(
                  state.tasks.filter((task) => task.deletedAt === null),
                  state.projects,
                ),
                `dayline-tasks-${stamp()}.csv`,
                'text/csv;charset=utf-8',
              );
            }}
          >
            <Download size={15} />
            CSV 任务表
          </button>
          <button
            className="button ghost"
            onClick={() => {
              downloadTextFile(
                tasksToIcs(state.tasks, state.projects),
                `dayline-${stamp()}.ics`,
                'text/calendar;charset=utf-8',
              );
            }}
          >
            <Download size={15} />
            ICS 日历
          </button>
        </div>
      </section>

      <section className="backup-section">
        <h3>导入</h3>
        <p className="field-hint">
          JSON 会替换全部本地数据；CSV 与 ICS 会把条目追加到指定清单。
        </p>
        <div className="button-row">
          <button className="button ghost" onClick={() => inputRef.current?.click()}>
            <Upload size={15} />
            选择备份文件
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.csv,.ics,application/json,text/csv,text/calendar"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
        </div>
        {pending && (
          <div className="import-preview">
            <strong>{pending.name}</strong>
            <span>
              {pending.kind === 'json'
                ? '将替换当前全部数据'
                : pending.kind === 'ics'
                  ? '将作为日程导入当前清单'
                  : '将作为任务导入当前清单'}
            </span>
            <div className="button-row">
              <button className="button primary small" onClick={confirmImport}>
                确认导入
              </button>
              <button className="button ghost small" onClick={() => setPending(null)}>
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="backup-section">
        <h3>自动备份</h3>
        <p className="field-hint">
          自动备份保存在浏览器本地存储（非 SQLite 文件），每天最多生成一次。
          {autoBackupAt
            ? ` 上次：${new Date(autoBackupAt).toLocaleString('zh-CN')}`
            : ' 尚未生成。'}
        </p>
        <div className="button-row">
          <button
            className="button ghost"
            onClick={() => {
              const snapshot = writeAutoBackup(state);
              setAutoBackupAt(snapshot.at);
              onToast('已创建自动备份', new Date(snapshot.at).toLocaleString('zh-CN'));
            }}
          >
            立即备份
          </button>
          <button
            className="button ghost"
            disabled={!auto}
            onClick={() => {
              if (!auto) return;
              onRestoreState(auto.state);
              onToast('已从自动备份恢复', new Date(auto.at).toLocaleString('zh-CN'));
              onClose();
            }}
          >
            <RotateCcw size={14} />
            恢复自动备份
          </button>
          <button
            className="button ghost"
            onClick={() => {
              const snapshot = maybeAutoBackup(state, true);
              setAutoBackupAt(snapshot?.at ?? null);
            }}
          >
            刷新自动备份
          </button>
        </div>
      </section>

      <section className="backup-section">
        <h3>当前数据量</h3>
        <div className="stat-grid compact">
          <div>
            <strong>{state.tasks.filter((task) => task.deletedAt === null).length}</strong>
            <span>任务</span>
          </div>
          <div>
            <strong>{state.projects.filter((project) => project.deletedAt === null).length}</strong>
            <span>清单</span>
          </div>
          <div>
            <strong>{state.tags.length}</strong>
            <span>标签</span>
          </div>
          <div>
            <strong>{state.habits.length}</strong>
            <span>习惯</span>
          </div>
          <div>
            <strong>{state.focusSessions.length}</strong>
            <span>专注记录</span>
          </div>
          <div>
            <strong>{state.attachments.length}</strong>
            <span>附件</span>
          </div>
        </div>
      </section>
    </Modal>
  );
}
