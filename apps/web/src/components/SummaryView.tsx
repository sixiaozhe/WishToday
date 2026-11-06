import { useState } from 'react';
import { CheckCircle2, Clock3, Flame, PlusCircle } from 'lucide-react';
import {
  addDaysKey,
  daysBetween,
  focusSecondsInRange,
  formatDateLabel,
  localDateKey,
  todayKey,
  type Habit,
  type HabitCheckin,
  type FocusSession,
  type Project,
  type Task,
} from '@dayline/core';

interface SummaryViewProps {
  tasks: Task[];
  projects: Project[];
  sessions: FocusSession[];
  habits: Habit[];
  checkins: HabitCheckin[];
  onSelectTask: (task: Task) => void;
}

export function SummaryView({
  tasks,
  projects,
  sessions,
  habits,
  checkins,
  onSelectTask,
}: SummaryViewProps) {
  const [range, setRange] = useState<7 | 14 | 30>(7);
  const today = todayKey();
  const start = addDaysKey(today, -(range - 1));
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const completed = tasks.filter(
    (task) =>
      task.completedAt !== null &&
      localDateKey(new Date(task.completedAt)) >= start &&
      localDateKey(new Date(task.completedAt)) <= today,
  );
  const created = tasks.filter(
    (task) => localDateKey(new Date(task.createdAt)) >= start && task.deletedAt === null,
  );
  const focusSeconds = focusSecondsInRange(
    sessions,
    new Date(`${start}T00:00:00`).getTime(),
    new Date(`${addDaysKey(today, 1)}T00:00:00`).getTime(),
  );
  const checkinCount = checkins.filter(
    (checkin) => checkin.date >= start && checkin.date <= today && checkin.deletedAt === null,
  ).length;

  const perDay = Array.from({ length: range }, (_, index) => {
    const date = addDaysKey(start, index);
    return {
      date,
      completed: completed.filter(
        (task) => task.completedAt !== null && localDateKey(new Date(task.completedAt)) === date,
      ).length,
      created: created.filter(
        (task) => localDateKey(new Date(task.createdAt)) === date,
      ).length,
      focus: Math.round(
        focusSecondsInRange(
          sessions,
          new Date(`${date}T00:00:00`).getTime(),
          new Date(`${addDaysKey(date, 1)}T00:00:00`).getTime(),
        ) / 60,
      ),
    };
  });

  const projectBreakdown = projects
    .filter((project) => project.deletedAt === null)
    .map((project) => ({
      project,
      count: completed.filter((task) => task.projectId === project.id).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="summary-wrap">
      <div className="view-toolbar">
        <div className="segmented small">
          {[7, 14, 30].map((value) => (
            <button
              key={value}
              className={range === value ? 'is-active' : ''}
              onClick={() => setRange(value as 7 | 14 | 30)}
            >
              近 {value} 天
            </button>
          ))}
        </div>
        <span className="shortcut-hint">
          {formatDateLabel(start)} – {formatDateLabel(today)}
        </span>
      </div>

      <div className="stat-grid">
        <div>
          <strong>{completed.length}</strong>
          <span><CheckCircle2 size={13} /> 完成任务</span>
        </div>
        <div>
          <strong>{created.length}</strong>
          <span><PlusCircle size={13} /> 新建任务</span>
        </div>
        <div>
          <strong>{Math.round(focusSeconds / 60)}</strong>
          <span><Clock3 size={13} /> 专注分钟</span>
        </div>
        <div>
          <strong>{checkinCount}</strong>
          <span><Flame size={13} /> 习惯打卡</span>
        </div>
      </div>

      <section className="stats-section">
        <h3>每日节奏</h3>
        <div className="summary-days">
          {perDay.map((day) => (
            <div key={day.date} className="summary-day">
              <strong>{day.date.slice(5)}</strong>
              <span>{day.completed} 完成</span>
              <span>{day.created} 新建</span>
              <em>{day.focus} 分钟专注</em>
            </div>
          ))}
        </div>
      </section>

      <div className="stats-columns">
        <section className="stats-section">
          <h3>完成的任务</h3>
          <div className="summary-list">
            {completed.slice(0, 30).map((task) => (
              <button
                key={task.id}
                data-task-id={task.id}
                className="summary-row"
                onClick={() => onSelectTask(task)}
              >
                <CheckCircle2 size={14} />
                <span>{task.title}</span>
                <em>{projectById.get(task.projectId)?.name ?? ''}</em>
              </button>
            ))}
            {completed.length === 0 && <p className="field-hint">这段时间还没有完成记录。</p>}
          </div>
        </section>

        <section className="stats-section">
          <h3>清单贡献</h3>
          <div className="distribution">
            {projectBreakdown.map(({ project, count }) => (
              <div key={project.id} className="distribution-row">
                <span>{project.name}</span>
                <div className="distribution-track">
                  <i
                    style={{
                      width: `${completed.length === 0 ? 0 : (count / completed.length) * 100}%`,
                      background: project.color,
                    }}
                  />
                </div>
                <em>{count}</em>
              </div>
            ))}
            {projectBreakdown.length === 0 && <p className="field-hint">暂无数据。</p>}
          </div>
        </section>

        <section className="stats-section">
          <h3>习惯打卡</h3>
          <div className="summary-list">
            {habits
              .filter((habit) => habit.deletedAt === null)
              .map((habit) => {
                const count = checkins.filter(
                  (checkin) =>
                    checkin.habitId === habit.id &&
                    checkin.date >= start &&
                    checkin.date <= today &&
                    checkin.deletedAt === null,
                ).length;
                return (
                  <div key={habit.id} className="summary-row">
                    <span>{habit.icon}</span>
                    <span>{habit.name}</span>
                    <em>{count} / {daysBetween(start, today) + 1} 天</em>
                  </div>
                );
              })}
            {habits.length === 0 && <p className="field-hint">还没有习惯。</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
