import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatDateLabel,
  localDateKey,
  parseLocalDateKey,
  todayKey,
} from '@dayline/core';

interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string | null;
  max?: string | null;
  clearable?: boolean;
  ariaLabel?: string;
  className?: string;
}

interface Position {
  left: number;
  top: number;
  dropUp: boolean;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

type DatePickerView = 'days' | 'months' | 'years';

function yearBlockStart(year: number): number {
  return Math.floor(year / 12) * 12;
}

function buildDays(anchor: Date): Array<{ date: string; day: number; outside: boolean }> {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date: localDateKey(date),
      day: date.getDate(),
      outside: date.getMonth() !== month,
    };
  });
}

export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  disabled = false,
  min = null,
  max = null,
  clearable = true,
  ariaLabel,
  className = '',
}: DatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [view, setView] = useState<DatePickerView>('days');
  const [yearPage, setYearPage] = useState(() =>
    yearBlockStart(value ? parseLocalDateKey(value).getFullYear() : new Date().getFullYear()),
  );
  const [anchor, setAnchor] = useState<Date>(() =>
    value ? parseLocalDateKey(value) : new Date(),
  );

  function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 292;
    const height = 360;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const dropUp = spaceBelow < height && rect.top > spaceBelow;
    const next = value ? parseLocalDateKey(value) : new Date();
    setAnchor(next);
    setView('days');
    setYearPage(yearBlockStart(next.getFullYear()));
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: dropUp ? rect.top - 4 : rect.bottom + 4,
      dropUp,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function onOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onScroll(event: Event) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }

    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const today = todayKey();
  const days = buildDays(anchor);

  function disabledDate(date: string): boolean {
    if (min && date < min) return true;
    if (max && date > max) return true;
    return false;
  }

  function pick(date: string) {
    if (disabledDate(date)) return;
    onChange(date);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`datepicker-trigger ${className} ${open ? 'is-open' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <CalendarDays size={14} />
        <span className={value ? '' : 'is-placeholder'}>
          {value ? formatDateLabel(value) : placeholder}
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className={`datepicker-popover ${position.dropUp ? 'is-drop-up' : ''}`}
            style={{
              left: position.left,
              top: position.top,
              transform: position.dropUp ? 'translateY(-100%)' : undefined,
            }}
            role="dialog"
            aria-label="选择日期"
          >
            {view === 'days' && (
              <>
                <div className="datepicker-head">
                  <button
                    type="button"
                    className="icon-button small"
                    onClick={() =>
                      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
                    }
                    aria-label="上个月"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <div className="datepicker-title">
                    <button
                      type="button"
                      onClick={() => {
                        setYearPage(yearBlockStart(anchor.getFullYear()));
                        setView('years');
                      }}
                    >
                      {anchor.getFullYear()} 年
                    </button>
                    <button type="button" onClick={() => setView('months')}>
                      {anchor.getMonth() + 1} 月
                    </button>
                  </div>
                  <button
                    type="button"
                    className="icon-button small"
                    onClick={() =>
                      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
                    }
                    aria-label="下个月"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="datepicker-weekdays">
                  {WEEKDAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="datepicker-grid">
                  {days.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      className={`datepicker-cell ${day.outside ? 'is-outside' : ''} ${
                        day.date === value ? 'is-selected' : ''
                      } ${day.date === today ? 'is-today' : ''}`}
                      disabled={disabledDate(day.date)}
                      onClick={() => pick(day.date)}
                    >
                      {day.day}
                    </button>
                  ))}
                </div>

                <div className="datepicker-foot">
                  <button type="button" className="button ghost small" onClick={() => pick(today)}>
                    今天
                  </button>
                  {clearable && (
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => {
                        onChange(null);
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                    >
                      清除
                    </button>
                  )}
                </div>
              </>
            )}

            {view === 'months' && (
              <>
                <div className="datepicker-head">
                  <button
                    type="button"
                    className="icon-button small"
                    onClick={() =>
                      setAnchor(new Date(anchor.getFullYear() - 1, anchor.getMonth(), 1))
                    }
                    aria-label="上一年"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className="datepicker-period"
                    onClick={() => {
                      setYearPage(yearBlockStart(anchor.getFullYear()));
                      setView('years');
                    }}
                  >
                    {anchor.getFullYear()} 年
                  </button>
                  <button
                    type="button"
                    className="icon-button small"
                    onClick={() =>
                      setAnchor(new Date(anchor.getFullYear() + 1, anchor.getMonth(), 1))
                    }
                    aria-label="下一年"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="datepicker-month-grid">
                  {Array.from({ length: 12 }, (_, month) => (
                    <button
                      key={month}
                      type="button"
                      className={`datepicker-period-cell ${
                        month === anchor.getMonth() ? 'is-current' : ''
                      }`}
                      onClick={() => {
                        setAnchor(new Date(anchor.getFullYear(), month, 1));
                        setView('days');
                      }}
                    >
                      {month + 1} 月
                    </button>
                  ))}
                </div>
              </>
            )}

            {view === 'years' && (
              <>
                <div className="datepicker-head">
                  <button
                    type="button"
                    className="icon-button small"
                    onClick={() => setYearPage((current) => current - 12)}
                    aria-label="上一组年份"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <strong className="datepicker-period">
                    {yearPage}–{yearPage + 11}
                  </strong>
                  <button
                    type="button"
                    className="icon-button small"
                    onClick={() => setYearPage((current) => current + 12)}
                    aria-label="下一组年份"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="datepicker-year-grid">
                  {Array.from({ length: 12 }, (_, index) => {
                    const year = yearPage + index;
                    return (
                      <button
                        key={year}
                        type="button"
                        className={`datepicker-period-cell ${
                          year === anchor.getFullYear() ? 'is-current' : ''
                        }`}
                        onClick={() => {
                          setAnchor(new Date(year, anchor.getMonth(), 1));
                          setView('months');
                        }}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
