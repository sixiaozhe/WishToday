import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface PopoverPosition {
  left: number;
  top: number;
  width: number;
  dropUp: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className = '',
  ariaLabel,
}: SelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const selected = options.find((option) => option.value === value);

  function place() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(178, Math.min(rect.width, window.innerWidth - 16));
    const maxHeight = 270;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const dropUp = spaceBelow < maxHeight && rect.top > spaceBelow;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: dropUp ? rect.top - 4 : rect.bottom + 4,
      width,
      dropUp,
    });
  }

  function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function onOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
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
      if (listRef.current?.contains(target)) return;
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
      const current = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
      current?.focus();
      current?.scrollIntoView({ block: 'nearest' });
    });

    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function handleTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) toggle();
    }
  }

  function handleListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('.themed-option:not(:disabled)') ?? [],
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`themed-select ${className} ${open ? 'is-open' : ''}`}
        onClick={toggle}
        onKeyDown={handleTriggerKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={`themed-select-value ${selected ? '' : 'is-placeholder'}`}>
          {selected?.icon}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className="themed-select-arrow" />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            className={`themed-select-popover ${position.dropUp ? 'is-drop-up' : ''}`}
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              transform: position.dropUp ? 'translateY(-100%)' : undefined,
            }}
            role="listbox"
            onKeyDown={handleListKey}
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || '__empty'}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-selected={active}
                  className={`themed-option ${active ? 'is-selected' : ''}`}
                  disabled={option.disabled}
                  onClick={() => choose(option)}
                >
                  {option.icon}
                  <span className="themed-option-label">{option.label}</span>
                  {active && <Check size={13} />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
