'use client';

import type { LucideIcon } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');
export { cx };

// ---------------------------------------------------------------------------

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  trailing,
}: {
  tabs: Array<{
    id: T;
    label: string;
    count?: number;
    tone?: 'danger' | 'caution' | null;
  }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <div className='flex h-9 shrink-0 items-stretch gap-1 border-b border-line bg-panel px-2'>
      <div
        role='tablist'
        aria-label={label}
        className='flex items-stretch gap-1'
      >
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              role='tab'
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cx(
                'relative flex items-center gap-1.5 px-2.5 text-[13px] transition-colors',
                active
                  ? 'font-semibold text-ink'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cx(
                    'rounded-full px-1.5 text-2xs font-semibold',
                    tab.tone === 'danger'
                      ? 'bg-danger text-white'
                      : tab.tone === 'caution'
                        ? 'bg-caution-soft text-caution'
                        : 'bg-line text-ink-soft',
                  )}
                >
                  {tab.count}
                </span>
              )}
              {active && (
                <span className='absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink' />
              )}
            </button>
          );
        })}
      </div>
      {trailing && (
        <div className='ml-auto flex items-center gap-1'>{trailing}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function IconButton({
  icon: Icon,
  label,
  shortcut,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cx(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-deep hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      <Icon className='h-4 w-4' aria-hidden />
    </button>
  );
}

export function Button({
  variant = 'quiet',
  className,
  children,
  ...rest
}: ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'quiet' | 'outline';
}) {
  return (
    <button
      type='button'
      className={cx(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-ink text-white hover:bg-ink-soft',
        variant === 'outline' &&
          'border border-line-strong bg-white text-ink hover:border-ink-muted',
        variant === 'quiet' &&
          'text-ink-soft hover:bg-panel-deep hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: Array<{ id: T; label: string; title?: string }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role='radiogroup'
      aria-label={label}
      className='inline-flex rounded-md bg-panel-deep p-0.5'
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type='button'
            role='radio'
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.id)}
            className={cx(
              'rounded-[5px] font-medium transition-colors',
              size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]',
              active
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className='group inline-flex items-center gap-2 text-left'
      title={description}
    >
      <span
        className={cx(
          'relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors',
          checked ? 'bg-and' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
      <span className='text-[13px] text-ink-soft group-hover:text-ink'>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className='rounded border border-line-strong bg-white px-1 font-mono text-2xs text-ink-muted'>
      {children}
    </kbd>
  );
}

/** Popover menu anchored to a trigger; closes on outside click or Escape. */
export function Menu({
  trigger,
  children,
  align = 'right',
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root} className='relative'>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role='menu'
          aria-label={label}
          className={cx(
            'absolute top-full z-50 mt-1 min-w-[15rem] rounded-lg border border-line bg-white p-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon: Icon,
  children,
  hint,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  hint?: ReactNode;
}) {
  return (
    <button
      type='button'
      role='menuitem'
      className='flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink hover:bg-panel disabled:pointer-events-none disabled:opacity-40'
      {...rest}
    >
      {Icon && <Icon className='h-4 w-4 text-ink-muted' aria-hidden />}
      <span className='min-w-0 flex-1'>{children}</span>
      {hint && <span className='shrink-0 text-2xs text-ink-faint'>{hint}</span>}
    </button>
  );
}

/** A model node reference: "G3", coloured by what it is; click selects it. */
export function NodeChip({
  id,
  label = id,
  tone,
  onClick,
}: {
  id: string;
  /** what the chip reads (default: the id) */
  label?: string;
  tone: 'and' | 'or' | 'task' | 'plain';
  onClick?: () => void;
}) {
  const color =
    tone === 'and'
      ? 'border-and/30 bg-and-soft text-and'
      : tone === 'or'
        ? 'border-or/30 bg-or-soft text-or'
        : tone === 'task'
          ? 'border-task/25 bg-task-soft text-task'
          : 'border-line bg-white text-ink-soft';
  const className = cx(
    'inline-flex items-center rounded border px-1 font-mono text-2xs font-semibold leading-4',
    color,
    onClick && 'hover:ring-1 hover:ring-trace',
  );
  // a plain label when not clickable (it may sit inside another button)
  if (!onClick) return <span className={className}>{label}</span>;
  return (
    <button
      type='button'
      onClick={onClick}
      title={`Select ${label}`}
      className={className}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------

type CreatableOption = { value: string; hint?: string };

/**
 * A text input with a filtered list of options that also creates new values: pick an
 * option, or type a name that is not in the list and choose "Add". Arrow keys move,
 * Enter picks, Escape closes.
 */
export function CreatableSelect({
  options,
  onSelect,
  placeholder,
  label,
  createLabel = (value) => `Add "${value}"`,
  className,
}: {
  options: readonly CreatableOption[];
  /** called with the picked or new value; the input clears */
  onSelect: (value: string) => void;
  placeholder?: string;
  label: string;
  createLabel?: (value: string) => string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  const typed = query.trim();
  const matches = options.filter((o) =>
    o.value.toLowerCase().includes(typed.toLowerCase()),
  );
  const canCreate = typed !== '' && !options.some((o) => o.value === typed);
  const items: Array<{ value: string; hint?: string; create?: boolean }> = [
    ...matches,
    ...(canCreate ? [{ value: typed, create: true }] : []),
  ];
  const current = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const pick = (value: string) => {
    onSelect(value);
    setQuery('');
    setActive(0);
    setOpen(false);
  };

  return (
    <div ref={box} className={cx('relative', className)}>
      <input
        role='combobox'
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete='list'
        aria-activedescendant={
          open && items[current] ? `${listId}-${current}` : undefined
        }
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const item = items[current];
            if (open && item) pick(item.value);
            else if (typed) pick(typed);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className='w-full rounded-md border border-line-strong bg-white px-2 py-1 font-mono text-xs text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-trace focus:outline-none'
      />
      {open && items.length > 0 && (
        <ul
          id={listId}
          role='listbox'
          aria-label={label}
          className='absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border border-line bg-white py-1 shadow-lg'
        >
          {items.map((item, index) => (
            <li
              key={`${item.create ? 'create:' : ''}${item.value}`}
              id={`${listId}-${index}`}
              role='option'
              aria-selected={index === current}
              // keep the focus in the input
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(item.value)}
              className={cx(
                'flex cursor-pointer items-baseline justify-between gap-2 px-2 py-1 text-xs',
                index === current ? 'bg-trace-soft text-ink' : 'text-ink-soft',
              )}
            >
              {item.create ? (
                <span className='text-trace'>{createLabel(item.value)}</span>
              ) : (
                <span className='font-mono'>{item.value}</span>
              )}
              {item.hint && (
                <span className='shrink-0 text-2xs text-ink-muted'>
                  {item.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
