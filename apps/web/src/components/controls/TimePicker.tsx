import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  ariaLabel?: string;
  className?: string;
}

interface Position {
  left: number;
  top: number;
  dropUp: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function TimePicker({
  value,
  onChange,
  placeholder = '设置时间',
  disabled = false,
  clearable = true,
  ariaLabel,
  className = '',
}: TimePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const normalized = value?.slice(0, 5) ?? '';
  const [hour = '09', minute = '00'] = normalized
    ? normalized.split(':')
    : ['09', '00'];
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);

  function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    setDraftHour(hour ?? '09');
    setDraftMinute(minute ?? '00');
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 234;
    const height = 284;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const dropUp = spaceBelow < height && rect.top > spaceBelow;
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
    window.requestAnimationFrame(() => {
      const current = panelRef.current?.querySelector<HTMLElement>('[data-current="true"]');
      current?.scrollIntoView({ block: 'center' });
    });

    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function choose(nextHour: string, nextMinute: string, close = false) {
    setDraftHour(nextHour);
    setDraftMinute(nextMinute);
    onChange(`${nextHour}:${nextMinute}`);
    if (close) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`timepicker-trigger ${className} ${open ? 'is-open' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <Clock size={14} />
        <span className={normalized ? '' : 'is-placeholder'}>
          {normalized || placeholder}
        </span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className={`timepicker-popover ${position.dropUp ? 'is-drop-up' : ''}`}
            style={{
              left: position.left,
              top: position.top,
              transform: position.dropUp ? 'translateY(-100%)' : undefined,
            }}
            role="dialog"
            aria-label="选择时间"
          >
            <div className="timepicker-quick">
              {['09:00', '12:00', '18:00', '21:00'].map((time) => (
                <button
                  key={time}
                  type="button"
                  className={`pill ${normalized === time ? 'is-active' : ''}`}
                  onClick={() => choose(time.slice(0, 2), time.slice(3), true)}
                >
                  {time}
                </button>
              ))}
            </div>

            <div className="timepicker-columns">
              <div className="timepicker-column">
                <span>时</span>
                <div className="timepicker-scroll">
                  {Array.from({ length: 24 }, (_, index) => {
                    const candidate = pad(index);
                    return (
                      <button
                        key={candidate}
                        type="button"
                        className={`timepicker-option ${
                          candidate === draftHour ? 'is-selected' : ''
                        }`}
                        data-current={candidate === draftHour}
                        onClick={() => choose(candidate, draftMinute)}
                      >
                        {candidate}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="timepicker-column">
                <span>分</span>
                <div className="timepicker-scroll">
                  {Array.from({ length: 60 }, (_, index) => {
                    const candidate = pad(index);
                    return (
                      <button
                        key={candidate}
                        type="button"
                        className={`timepicker-option ${
                          candidate === draftMinute ? 'is-selected' : ''
                        }`}
                        data-current={candidate === draftMinute}
                        onClick={() => choose(draftHour, candidate, true)}
                      >
                        {candidate}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="timepicker-foot">
              <button
                type="button"
                className="button ghost small"
                onClick={() => {
                  const now = new Date();
                  choose(pad(now.getHours()), pad(now.getMinutes()), true);
                }}
              >
                现在
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
          </div>,
          document.body,
        )}
    </>
  );
}
