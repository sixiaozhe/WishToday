import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Pause, Play, RotateCcw, Square, Timer } from 'lucide-react';
import {
  focusSummary,
  formatDurationLabel,
  type FocusSession,
  type Task,
} from '@dayline/core';
import { Select } from './controls/Select';

interface FocusViewProps {
  tasks: Task[];
  sessions: FocusSession[];
  onRecord: (input: {
    taskId: string | null;
    mode: 'pomodoro' | 'stopwatch';
    plannedSeconds: number | null;
    startedAt: number;
    durationSeconds: number;
    note: string;
  }) => void;
}

const DURATIONS = [15, 25, 45, 60];

export function FocusView({ tasks, sessions, onRecord }: FocusViewProps) {
  const [mode, setMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
  const [minutes, setMinutes] = useState(25);
  const [taskId, setTaskId] = useState('');
  const [note, setNote] = useState('');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number>(0);
  const baseElapsedRef = useRef<number>(0);
  const summary = focusSummary(sessions);
  const openTasks = tasks.filter(
    (task) => task.deletedAt === null && task.status === 'open' && task.parentId === null,
  );
  const todaySessions = sessions.filter(
    (session) =>
      session.deletedAt === null &&
      session.startedAt >= new Date().setHours(0, 0, 0, 0) &&
      session.state === 'finished',
  );

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const next = baseElapsedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(next);
    }, 500);
    return () => window.clearInterval(timer);
  }, [running]);

  const target = mode === 'pomodoro' ? minutes * 60 : null;
  const display =
    mode === 'pomodoro'
      ? Math.max(0, (target ?? 0) - elapsed)
      : elapsed;
  const minutesDisplay = String(Math.floor(display / 60)).padStart(2, '0');
  const secondsDisplay = String(display % 60).padStart(2, '0');
  const progress =
    mode === 'pomodoro' && target ? Math.min(100, Math.round((elapsed / target) * 100)) : 0;

  function start() {
    startedAtRef.current = Date.now();
    baseElapsedRef.current = elapsed;
    setRunning(true);
  }

  function pause() {
    if (!running) return;
    const next = baseElapsedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000);
    baseElapsedRef.current = next;
    setElapsed(next);
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    baseElapsedRef.current = 0;
    startedAtRef.current = 0;
  }

  function finish() {
    const duration = Math.max(
      1,
      baseElapsedRef.current +
        (running ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0),
    );
    onRecord({
      taskId: taskId || null,
      mode,
      plannedSeconds: target,
      startedAt: startedAtRef.current || Date.now() - duration * 1000,
      durationSeconds: duration,
      note,
    });
    reset();
    setNote('');
  }

  useEffect(() => {
    if (mode === 'pomodoro' && running && target !== null && elapsed >= target) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, running, target, mode]);

  return (
    <div className="focus-wrap">
      <div className="focus-main">
        <div className="focus-card">
          <div className="segmented">
            <button
              className={mode === 'pomodoro' ? 'is-active' : ''}
              onClick={() => {
                reset();
                setMode('pomodoro');
              }}
            >
              番茄钟
            </button>
            <button
              className={mode === 'stopwatch' ? 'is-active' : ''}
              onClick={() => {
                reset();
                setMode('stopwatch');
              }}
            >
              正计时
            </button>
          </div>

          <div className="focus-clock" style={{ '--focus-progress': `${progress}%` } as CSSProperties}>
            <div className="focus-clock-inner">
              <strong>
                {minutesDisplay}:{secondsDisplay}
              </strong>
              <span>{mode === 'pomodoro' ? `目标 ${minutes} 分钟` : '正计时'}</span>
            </div>
          </div>

          {mode === 'pomodoro' && (
            <div className="focus-durations">
              {DURATIONS.map((value) => (
                <button
                  key={value}
                  className={`pill ${minutes === value ? 'is-active' : ''}`}
                  onClick={() => {
                    reset();
                    setMinutes(value);
                  }}
                  disabled={running}
                >
                  {value} 分钟
                </button>
              ))}
            </div>
          )}

          <div className="focus-actions">
            {!running ? (
              <button className="button primary" onClick={start}>
                <Play size={16} />
                {elapsed > 0 ? '继续' : '开始专注'}
              </button>
            ) : (
              <button className="button ghost" onClick={pause}>
                <Pause size={16} />
                暂停
              </button>
            )}
            <button className="button ghost" onClick={finish} disabled={elapsed === 0 && !running}>
              <Square size={14} />
              结束并记录
            </button>
            <button className="button ghost" onClick={reset}>
              <RotateCcw size={14} />
              重置
            </button>
          </div>

          <section className="focus-section">
            <div className="field">
              <span>关联任务</span>
              <Select
                value={taskId}
                onChange={setTaskId}
                placeholder="不关联"
                options={[
                  { value: '', label: '不关联' },
                  ...openTasks.map((task) => ({ value: task.id, label: task.title })),
                ]}
                ariaLabel="关联任务"
              />
            </div>
            <label className="field">
              <span>备注</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="这次专注要完成什么？"
              />
            </label>
          </section>
        </div>

        <aside className="focus-side">
          <div className="stat-grid compact">
            <div>
              <strong>{summary.todayMinutes}</strong>
              <span>今日分钟</span>
            </div>
            <div>
              <strong>{summary.weekMinutes}</strong>
              <span>本周分钟</span>
            </div>
            <div>
              <strong>{summary.totalMinutes}</strong>
              <span>累计分钟</span>
            </div>
            <div>
              <strong>{summary.sessions}</strong>
              <span>累计次数</span>
            </div>
          </div>

          <h3>今日记录</h3>
          <div className="focus-log">
            {todaySessions.map((session) => {
              const task = tasks.find((item) => item.id === session.taskId);
              return (
                <div key={session.id} className="focus-log-row">
                  <Timer size={14} />
                  <div>
                    <strong>{Math.max(1, Math.round(session.durationSeconds / 60))} 分钟</strong>
                    <span>{(task?.title ?? session.note ?? '') || '未关联任务'}</span>
                  </div>
                  <em>{formatDurationLabel(session.startedAt)}</em>
                </div>
              );
            })}
            {todaySessions.length === 0 && <p className="field-hint">今天还没有专注记录。</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
