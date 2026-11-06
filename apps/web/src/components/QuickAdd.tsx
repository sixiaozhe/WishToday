import { useState, type FormEvent, type RefObject } from 'react';
import { Plus } from 'lucide-react';
import { todayKey } from '@dayline/core';
import { DatePicker } from './controls/DatePicker';
import { TimePicker } from './controls/TimePicker';

export interface QuickAddOptions {
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface QuickAddProps {
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (title: string, options: QuickAddOptions) => void;
}

export function QuickAdd({ placeholder, inputRef, onSubmit }: QuickAddProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    onSubmit(value, { startDate: date, startTime: time, endTime: null });
    setTitle('');
    setDate(null);
    setTime(null);
    inputRef.current?.focus();
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <Plus size={18} className="quick-add-icon" />
      <input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={placeholder}
        aria-label="快速添加任务"
      />
      <div className="quick-add-fields">
        <DatePicker
          value={date}
          onChange={(value) => {
            setDate(value);
            if (!value) setTime(null);
          }}
          placeholder="日期"
          ariaLabel="快速添加日期"
          clearable
          className="quick-field"
        />
        <TimePicker
          value={time}
          onChange={(value) => {
            setTime(value);
            if (value && !date) setDate(todayKey());
          }}
          placeholder="时间"
          ariaLabel="快速添加时间"
          clearable
          className="quick-field"
        />
      </div>
      <kbd>Enter</kbd>
      <button type="submit" className="button primary small" disabled={!title.trim()}>
        添加
      </button>
    </form>
  );
}
