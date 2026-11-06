import { useEffect, useState } from 'react';
import { CalendarHeart, Cake, PartyPopper, Plus, Star, Trash2 } from 'lucide-react';
import {
  daysBetween,
  localDateKey,
  nextCountdownOccurrence,
  todayKey,
  type Countdown,
} from '@dayline/core';
import { Select } from './controls/Select';
import { DatePicker } from './controls/DatePicker';

interface CountdownViewProps {
  countdowns: Countdown[];
  onAdd: (input: {
    name: string;
    type: Countdown['type'];
    date: string;
    calendar: Countdown['calendar'];
    repeatYearly: boolean;
    countMode: Countdown['countMode'];
  }) => void;
  onDelete: (countdown: Countdown) => void;
  onUpdate: (countdown: Countdown, patch: Partial<Countdown>) => void;
}

interface LunarOccurrence {
  date: string;
  days: number;
  years: number | null;
}

const TYPE_META: Record<Countdown['type'], { label: string; icon: typeof Star }> = {
  festival: { label: '节日', icon: PartyPopper },
  birthday: { label: '生日', icon: Cake },
  anniversary: { label: '纪念日', icon: CalendarHeart },
  countdown: { label: '倒数', icon: Star },
};

export function CountdownView({ countdowns, onAdd, onDelete }: CountdownViewProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Countdown['type']>('countdown');
  const [calendar, setCalendar] = useState<Countdown['calendar']>('solar');
  const [date, setDate] = useState(todayKey());
  const [lunarMonth, setLunarMonth] = useState('1');
  const [lunarDay, setLunarDay] = useState('1');
  const [repeatYearly, setRepeatYearly] = useState(true);
  const [countMode, setCountMode] = useState<Countdown['countMode']>('countdown');
  const [lunarMap, setLunarMap] = useState<Record<string, LunarOccurrence | null>>({});

  useEffect(() => {
    let cancelled = false;
    const lunar = countdowns.filter((item) => item.calendar === 'lunar' && item.deletedAt === null);
    if (lunar.length === 0) return;

    void (async () => {
      const { Lunar } = await import('lunar-typescript');
      if (cancelled) return;
      const now = new Date();
      const today = todayKey(now);
      const result: Record<string, LunarOccurrence | null> = {};
      for (const item of lunar) {
        const [month, day] = item.date.split('-').map(Number);
        if (!month || !day) {
          result[item.id] = null;
          continue;
        }
        let found: { date: string; years: number } | null = null;
        for (let offset = 0; offset <= 2; offset += 1) {
          try {
            const solar = Lunar.fromYmd(now.getFullYear() + offset, month, day).getSolar();
            const key = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(
              solar.getDay(),
            ).padStart(2, '0')}`;
            if (key >= today) {
              found = { date: key, years: solar.getYear() - now.getFullYear() + offset };
              break;
            }
          } catch {
            // Some lunar dates (leap month edge cases) may be invalid.
          }
        }
        result[item.id] = found
          ? {
              date: found.date,
              days: daysBetween(today, found.date),
              years: item.repeatYearly ? found.years : null,
            }
          : null;
      }
      setLunarMap(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [countdowns]);

  const cards = countdowns
    .filter((item) => item.deletedAt === null)
    .map((item) => {
      const occurrence =
        item.calendar === 'lunar'
          ? lunarMap[item.id] ?? null
          : nextCountdownOccurrence(item);
      return { item, occurrence };
    })
    .sort((a, b) => (a.occurrence?.days ?? 99999) - (b.occurrence?.days ?? 99999));

  function submit() {
    const value = name.trim();
    if (!value) return;
    const finalDate =
      calendar === 'lunar'
        ? `${String(Number(lunarMonth)).padStart(2, '0')}-${String(Number(lunarDay)).padStart(2, '0')}`
        : date;
    onAdd({ name: value, type, date: finalDate, calendar, repeatYearly, countMode });
    setName('');
  }

  return (
    <div className="countdown-wrap">
      <div className="countdown-grid">
        {cards.map(({ item, occurrence }) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          return (
            <article key={item.id} className={`countdown-card ${item.pinned ? 'is-pinned' : ''}`}>
              <header>
                <Icon size={16} />
                <span>{meta.label}</span>
                {item.calendar === 'lunar' && <em>农历</em>}
                <button
                  className="icon-button tiny"
                  onClick={() => onDelete(item)}
                  aria-label={`删除${item.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </header>
              <strong className="countdown-name">{item.name}</strong>
              {occurrence ? (
                <div className="countdown-days">
                  <strong>{occurrence.days === 0 ? '今天' : occurrence.days}</strong>
                  {occurrence.days !== 0 && <span>{item.countMode === 'count_up' ? '天前' : '天后'}</span>}
                  <em>{occurrence.date}</em>
                  {occurrence.years !== null && occurrence.years > 0 && (
                    <small>{occurrence.years} 周年</small>
                  )}
                </div>
              ) : (
                <div className="countdown-days">
                  <span className="field-hint">日期待计算</span>
                </div>
              )}
              {item.note && <p>{item.note}</p>}
            </article>
          );
        })}
        {cards.length === 0 && (
          <div className="empty-panel">
            <strong>还没有纪念日</strong>
            <p>记录生日、纪念日或重要的倒数日。</p>
          </div>
        )}
      </div>

      <aside className="countdown-side">
        <h3>新建纪念日</h3>
        <label className="field">
          <span>名称</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：妈妈的生日" />
        </label>
        <div className="form-row">
          <div className="field">
            <span>类型</span>
            <Select
              value={type}
              onChange={(value) => setType(value as Countdown['type'])}
              options={[
                { value: 'countdown', label: '倒数日' },
                { value: 'birthday', label: '生日' },
                { value: 'anniversary', label: '纪念日' },
                { value: 'festival', label: '节日' },
              ]}
              ariaLabel="纪念日类型"
            />
          </div>
          <div className="field">
            <span>历法</span>
            <Select
              value={calendar}
              onChange={(value) => setCalendar(value as Countdown['calendar'])}
              options={[
                { value: 'solar', label: '公历' },
                { value: 'lunar', label: '农历' },
              ]}
              ariaLabel="纪念日历法"
            />
          </div>
        </div>
        {calendar === 'solar' ? (
          <div className="field">
            <span>日期</span>
            <DatePicker
              value={date}
              onChange={(value) => setDate(value ?? todayKey())}
              ariaLabel="纪念日日期"
              clearable={false}
            />
          </div>
        ) : (
          <div className="form-row">
            <label className="field">
              <span>农历月</span>
              <input
                type="number"
                min={1}
                max={12}
                value={lunarMonth}
                onChange={(event) => setLunarMonth(event.target.value)}
              />
            </label>
            <label className="field">
              <span>农历日</span>
              <input
                type="number"
                min={1}
                max={30}
                value={lunarDay}
                onChange={(event) => setLunarDay(event.target.value)}
              />
            </label>
          </div>
        )}
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={repeatYearly}
            onChange={(event) => setRepeatYearly(event.target.checked)}
          />
          <span>每年重复（忽略年份）</span>
        </label>
        <div className="segmented small">
          <button
            className={countMode === 'countdown' ? 'is-active' : ''}
            onClick={() => setCountMode('countdown')}
          >
            倒数
          </button>
          <button
            className={countMode === 'count_up' ? 'is-active' : ''}
            onClick={() => setCountMode('count_up')}
          >
            正数
          </button>
        </div>
        <button className="button primary" onClick={submit}>
          <Plus size={14} />
          添加纪念日
        </button>
        <p className="field-hint">
          当前本地日期：{localDateKey(new Date())}。农历日期会自动换算为下一次公历日期。
        </p>
      </aside>
    </div>
  );
}
