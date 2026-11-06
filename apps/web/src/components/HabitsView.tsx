import { useState } from 'react';
import { Check, Flame, Plus, Trash2 } from 'lucide-react';
import {
  addDaysKey,
  habitHeatmap,
  habitScheduledOn,
  habitStreak,
  todayKey,
  type Habit,
  type HabitCheckin,
  type HabitFrequency,
} from '@dayline/core';
import { Select } from './controls/Select';

interface HabitsViewProps {
  habits: Habit[];
  checkins: HabitCheckin[];
  onAdd: (habit: {
    name: string;
    icon: string;
    color: string;
    frequency: HabitFrequency;
    goalAmount: number | null;
    unit: string | null;
  }) => void;
  onUpdate: (habit: Habit, patch: Partial<Habit>) => void;
  onDelete: (habit: Habit) => void;
  onCheckin: (habit: Habit, date: string, amount: number) => void;
  onUndoCheckin: (habit: Habit, date: string) => void;
}

const HABIT_COLORS = ['#3b6ef6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
const WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
];

export function HabitsView({
  habits,
  checkins,
  onAdd,
  onUpdate,
  onDelete,
  onCheckin,
  onUndoCheckin,
}: HabitsViewProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✅');
  const [color, setColor] = useState(HABIT_COLORS[0] ?? '#3b6ef6');
  const [frequencyType, setFrequencyType] = useState<HabitFrequency['type']>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [goal, setGoal] = useState('');
  const [unit, setUnit] = useState('');
  const today = todayKey();
  const activeHabits = habits.filter((habit) => habit.deletedAt === null && !habit.archived);

  function submit() {
    const value = name.trim();
    if (!value) return;
    onAdd({
      name: value,
      icon,
      color,
      frequency:
        frequencyType === 'weekly'
          ? { type: 'weekly', weekdays }
          : frequencyType === 'interval'
            ? { type: 'interval', intervalDays: 2 }
            : { type: 'daily' },
      goalAmount: goal ? Number(goal) : null,
      unit: unit.trim() || null,
    });
    setName('');
    setGoal('');
    setUnit('');
  }

  return (
    <div className="habits-wrap">
      <div className="habits-main">
        {activeHabits.map((habit) => {
          const streak = habitStreak(checkins, habit);
          const days = habitHeatmap(checkins, habit.id, 49);
          const doneToday = checkins.some(
            (checkin) => checkin.habitId === habit.id && checkin.date === today && checkin.deletedAt === null,
          );
          return (
            <article key={habit.id} className="habit-card">
              <header className="habit-head">
                <span className="habit-icon" style={{ background: `${habit.color}22`, color: habit.color }}>
                  {habit.icon}
                </span>
                <div className="habit-title">
                  <strong>{habit.name}</strong>
                  <span>
                    {habit.frequency.type === 'daily'
                      ? '每天'
                      : habit.frequency.type === 'weekly'
                        ? `每周 ${(habit.frequency.weekdays ?? []).map((day) => WEEKDAYS.find((item) => item.value === day)?.label ?? '').join('、')}`
                        : `每 ${habit.frequency.intervalDays ?? 2} 天`}
                    {habit.goalAmount ? ` · 目标 ${habit.goalAmount}${habit.unit ?? ''}` : ''}
                  </span>
                </div>
                <div className="habit-streak">
                  <Flame size={15} />
                  <strong>{streak.current}</strong>
                  <span>连续</span>
                </div>
                <button
                  className={`habit-check ${doneToday ? 'is-done' : ''}`}
                  onClick={() => {
                    if (doneToday) {
                      onUndoCheckin(habit, today);
                    } else {
                      onCheckin(habit, today, habit.goalAmount ?? 1);
                    }
                  }}
                  aria-label={doneToday ? '撤销今日打卡' : '今日打卡'}
                >
                  <Check size={18} strokeWidth={3} />
                </button>
                <button
                  className="icon-button small"
                  onClick={() => {
                    if (confirm(`删除习惯“${habit.name}”？`)) onDelete(habit);
                  }}
                  aria-label={`删除习惯${habit.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </header>

              <div className="habit-week">
                {Array.from({ length: 7 }, (_, index) => addDaysKey(today, index - 6)).map((date) => {
                  const checked = checkins.some(
                    (checkin) =>
                      checkin.habitId === habit.id &&
                      checkin.date === date &&
                      checkin.deletedAt === null,
                  );
                  return (
                    <button
                      key={date}
                      className={`habit-day ${checked ? 'is-done' : ''} ${
                        date === today ? 'is-today' : ''
                      } ${!habitScheduledOn(habit, date) ? 'is-off' : ''}`}
                      onClick={() => {
                        if (checked) onUndoCheckin(habit, date);
                        else onCheckin(habit, date, habit.goalAmount ?? 1);
                      }}
                      title={date}
                      aria-label={`${date} ${checked ? '已打卡' : '未打卡'}`}
                    />
                  );
                })}
              </div>

              <div className="habit-heatmap" aria-hidden="true">
                {days.map((day) => (
                  <span
                    key={day.date}
                    className={`heat-cell ${day.count > 0 ? 'is-on' : ''}`}
                    style={{
                      background: day.count > 0 ? habit.color : undefined,
                      opacity: day.count > 0 ? 0.35 + Math.min(0.65, day.count * 0.2) : undefined,
                    }}
                    title={`${day.date}：${day.count}`}
                  />
                ))}
              </div>

              <div className="habit-footer">
                <span>最长连续 {streak.longest} 天</span>
                <span>累计 {streak.total} 次</span>
                <button
                  className="button ghost tiny"
                  onClick={() => onUpdate(habit, { archived: true })}
                >
                  归档
                </button>
              </div>
            </article>
          );
        })}
        {activeHabits.length === 0 && (
          <div className="empty-panel">
            <strong>还没有习惯</strong>
            <p>用右侧表单创建第一个习惯，开始连续打卡。</p>
          </div>
        )}
      </div>

      <aside className="habits-side">
        <h3>新建习惯</h3>
        <label className="field">
          <span>名称</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="阅读 30 分钟" />
        </label>
        <div className="form-row">
          <label className="field">
            <span>图标</span>
            <input value={icon} maxLength={2} onChange={(event) => setIcon(event.target.value)} />
          </label>
          <div className="field">
            <span>频率</span>
            <Select
              value={frequencyType}
              onChange={(value) => setFrequencyType(value as HabitFrequency['type'])}
              options={[
                { value: 'daily', label: '每天' },
                { value: 'weekly', label: '每周指定' },
                { value: 'interval', label: '间隔天数' },
              ]}
              ariaLabel="习惯频率"
            />
          </div>
        </div>
        {frequencyType === 'weekly' && (
          <div className="weekday-picker">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                className={weekdays.includes(day.value) ? 'is-active' : ''}
                onClick={() =>
                  setWeekdays((current) =>
                    current.includes(day.value)
                      ? current.filter((item) => item !== day.value)
                      : [...current, day.value],
                  )
                }
              >
                {day.label}
              </button>
            ))}
          </div>
        )}
        <div className="form-row">
          <label className="field">
            <span>目标量</span>
            <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="可留空" />
          </label>
          <label className="field">
            <span>单位</span>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="页/次" />
          </label>
        </div>
        <div className="color-picker">
          {HABIT_COLORS.map((item) => (
            <button
              key={item}
              className={`color-dot ${color === item ? 'is-active' : ''}`}
              style={{ background: item }}
              onClick={() => setColor(item)}
              aria-label={`选择颜色 ${item}`}
            />
          ))}
        </div>
        <button className="button primary" onClick={submit}>
          <Plus size={14} />
          创建习惯
        </button>
      </aside>
    </div>
  );
}
