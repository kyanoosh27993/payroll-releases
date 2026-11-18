'use client';
// سلکت قابل جستجو — جستجو از هر جای نام آیتم‌ها (بخش ۱۱ درخواست کاربر)
import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronsUpDown, Search, X, Check } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  clearLabel?: string;
};

export function SearchableSelect({
  value, onValueChange, options, placeholder = 'انتخاب کنید…',
  searchPlaceholder = 'جستجو…', emptyText = 'موردی یافت نشد',
  disabled, className, allowClear, clearLabel = 'پاک کردن',
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => { document.removeEventListener('mousedown', onDoc); clearTimeout(t); };
  }, [open]);

  // جستجو از هر جای نام — نه فقط ابتدای عبارت
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => (o.label + ' ' + (o.hint || '')).toLowerCase().includes(q))
    : options;

  return (
    <div ref={rootRef} className={cn('relative', className)} dir="rtl">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setQuery(''); }}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs',
          'hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span className={cn('truncate text-right', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {selected && allowClear && (
            <X
              className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onValueChange(''); }}
            />
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  onValueChange(filtered[0].value);
                  setOpen(false);
                }
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onValueChange(o.value); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-right hover:bg-accent',
                    o.value === value && 'bg-accent',
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
          {allowClear && value && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => { onValueChange(''); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
              >
                <X className="h-4 w-4" /> {clearLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
