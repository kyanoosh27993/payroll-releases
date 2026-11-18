'use client';
// DataTable — جدول داده یکپارچه سرتاسر برنامه
// قابلیت‌ها: مرتب‌سازی (Sort) و فیلتر (Filter) روی هر ستون + نمایش/مخفی‌کردن ستون‌ها
// ردیف‌کشی سفید + خاکستری خیلی کمرنگ، هدر چسبان، پایداری ستون‌ها در localStorage
import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ArrowUp, ArrowDown, ChevronsUpDown, Filter, Columns3, RotateCcw, X, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeDigits, toPersianDigits } from '@/lib/core/numbers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface DtColumn<T> {
  /** کلید یکتای ستون (فیلد ردیف یا کلید دلخواه) */
  key: string;
  /** عنوان ستون */
  header: string;
  /** محتوای سلول — پیش‌فرض: مقدار خام row[key] */
  cell?: (row: T, visibleIndex: number) => React.ReactNode;
  /** مقدار مرتب‌سازی — پیش‌فرض: row[key] (عدد به‌صورت عددی، متن فارسی با localeCompare) */
  sortValue?: (row: T) => string | number;
  /** مقدار فیلتر — پیش‌فرض: همان sortValue */
  filterValue?: (row: T) => string | number;
  align?: 'right' | 'center' | 'left';
  className?: string;
  headerClassName?: string;
  /** بدون مرتب‌سازی (مثل ستون عملیات) */
  noSort?: boolean;
  /** بدون فیلتر */
  noFilter?: boolean;
  /** مخفی هنگام بار اول */
  defaultHidden?: boolean;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

function cellText<T>(col: DtColumn<T>, row: T): string | number {
  const v = col.filterValue ? col.filterValue(row) : col.sortValue ? col.sortValue(row) : (row as Record<string, unknown>)[col.key];
  return v == null ? '' : (v as string | number);
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  footer,
  stickyHeader = true,
  toolbarExtra,
  id,
  className,
  containerClassName,
  defaultSort,
}: {
  columns: DtColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** حالت خالیِ «بدون داده» — وقتی داده‌ای وجود ندارد */
  empty?: React.ReactNode;
  /** سطر جمع (tfoot) */
  footer?: React.ReactNode;
  stickyHeader?: boolean;
  /** دکمه‌های اضافه سمت چپ نوار ابزار */
  toolbarExtra?: React.ReactNode;
  /** شناسه جدول برای ذخیره ستون‌های مخفی */
  id?: string;
  className?: string;
  containerClassName?: string;
  /** مرتب‌سازی پیش‌فرض — کد پرسنلی صعودی */
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const lsKey = id ? `dt-cols-${id}` : null;
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (lsKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(lsKey) ?? '[]') as string[];
        return new Set(saved);
      } catch { /* ignore */ }
    }
    return new Set(columns.filter(c => c.defaultHidden).map(c => c.key));
  });
  const [sort, setSort] = useState<SortState>(defaultSort ?? null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterOpen, setFilterOpen] = useState<Set<string>>(new Set());
  const [colsOpen, setColsOpen] = useState(false);

  // اگر ستون حذف شد، از وضعیت‌ها پاک شود
  useEffect(() => {
    const keys = new Set(columns.map(c => c.key));
    setHidden(prev => new Set([...prev].filter(k => keys.has(k))));
  }, [columns]);

  useEffect(() => {
    if (lsKey) localStorage.setItem(lsKey, JSON.stringify([...hidden]));
  }, [hidden, lsKey]);

  const visibleCols = useMemo(() => columns.filter(c => !hidden.has(c.key)), [columns, hidden]);

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== '');
    if (active.length === 0) return rows;
    return rows.filter(r => active.every(([k, q]) => {
      const col = columns.find(c => c.key === k);
      if (!col) return true;
      const needle = normalizeDigits(q).trim().toLowerCase();
      const hay = normalizeDigits(String(cellText(col, r))).toLowerCase();
      return hay.includes(needle);
    }));
  }, [rows, filters, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return filtered;
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : (a as Record<string, unknown>)[col.key];
      const bv = col.sortValue ? col.sortValue(b) : (b as Record<string, unknown>)[col.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
      const as = String(av ?? ''); const bs = String(bv ?? '');
      // اگر هر دو شبیه عدد هستند، عددی مقایسه شود (اعداد با ارقام فارسی هم)
      const an = parseFloat(normalizeDigits(as).replace(/[,\u060C]/g, ''));
      const bn = parseFloat(normalizeDigits(bs).replace(/[,\u060C]/g, ''));
      if (!Number.isNaN(an) && !Number.isNaN(bn) && /^[\s\d,\u06F0-\u06F9\u0660-\u0669.\-+]+$/.test(normalizeDigits(as)) && /^[\s\d,\u06F0-\u06F9\u0660-\u0669.\-+]+$/.test(normalizeDigits(bs))) return (an - bn) * mul;
      return as.localeCompare(bs, 'fa') * mul;
    });
  }, [filtered, sort, columns]);

  const toggleSort = (key: string) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const setFilter = (key: string, v: string) =>
    setFilters(prev => ({ ...prev, [key]: v }));

  const clearFilters = () => {
    setFilters({});
    setFilterOpen(new Set());
  };

  const activeFilterCount = Object.values(filters).filter(v => v.trim() !== '').length;
  const hasData = rows.length > 0;

  const alignCls: Record<string, string> = {
    right: 'text-right', center: 'text-center', left: 'text-left',
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* نوار ابزار: شمارش + فیلترها + ستون‌ها */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span>
            {sort || activeFilterCount > 0
              ? <>نمایش <b className="text-foreground num">{toPersianDigits(sorted.length)}</b> از <b className="text-foreground num">{toPersianDigits(rows.length)}</b> سطر</>
              : <>مجموع: <b className="text-foreground num">{toPersianDigits(rows.length)}</b> سطر</>}
          </span>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
              <RotateCcw size={13} className="ml-1" /> پاک کردن فیلترها
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {toolbarExtra}
          <Popover open={colsOpen} onOpenChange={setColsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Columns3 size={14} className="ml-1.5" /> ستون‌ها
                {hidden.size > 0 && (
                  <span className="mr-1.5 rounded-full bg-primary/10 text-primary px-1.5 text-[10px] num">
                    {toPersianDigits(hidden.size)}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2" dir="rtl">
              <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                <span className="text-xs font-semibold">نمایش ستون‌ها</span>
                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5"
                  onClick={() => setHidden(new Set(columns.filter(c => c.defaultHidden).map(c => c.key)))}>
                  بازنشانی
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {columns.map(c => (
                  <label key={c.key}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={!hidden.has(c.key)}
                      onCheckedChange={(v) => {
                        setHidden(prev => {
                          const next = new Set(prev);
                          if (v) next.delete(c.key); else next.add(c.key);
                          if (next.size === columns.length) return prev; // حداقل یک ستون
                          return next;
                        });
                      }}
                    />
                    <span className="truncate">{c.header}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {!hasData && empty ? empty : (
        <div className={cn('rounded-xl border border-border/70 shadow-luxe overflow-hidden bg-card', containerClassName)}>
          <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
            <Table className="text-[13px]">
              <TableHeader className={cn(stickyHeader && 'sticky top-0 z-10')}>
                <TableRow className="bg-muted/60 hover:bg-muted/60 backdrop-blur [&>th]:border-b">
                  {visibleCols.map(col => {
                    const isSorted = sort?.key === col.key;
                    const isFiltering = filterOpen.has(col.key);
                    const active = (filters[col.key] ?? '').trim() !== '';
                    return (
                      <TableHead key={col.key}
                        className={cn('h-10 font-semibold', alignCls[col.align ?? 'right'], col.headerClassName)}>
                        {col.noSort && col.noFilter ? (
                          <span>{col.header}</span>
                        ) : (
                          <div className="flex items-center gap-1 min-w-max" dir="rtl">
                            {isFiltering && !col.noFilter ? (
                              <FilterInput
                                autoFocus
                                value={filters[col.key] ?? ''}
                                placeholder={`فیلتر ${col.header}`}
                                onChange={v => setFilter(col.key, v)}
                                onClose={() => setFilterOpen(prev => { const n = new Set(prev); n.delete(col.key); return n; })}
                              />
                            ) : (
                              <>
                                {!col.noSort ? (
                                  <button type="button"
                                    className={cn('inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent transition-colors', isSorted && 'text-primary')}
                                    onClick={() => toggleSort(col.key)} title="مرتب‌سازی">
                                    <span>{col.header}</span>
                                    {isSorted
                                      ? (sort!.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                                      : <ChevronsUpDown size={12} className="opacity-40" />}
                                  </button>
                                ) : (
                                  <span>{col.header}</span>
                                )}
                                {!col.noFilter && (
                                  <button type="button"
                                    className={cn('inline-flex rounded p-0.5 transition-colors hover:bg-accent', active ? 'text-primary' : 'opacity-40 hover:opacity-100')}
                                    onClick={() => setFilterOpen(prev => {
                                      const n = new Set(prev);
                                      if (n.has(col.key)) n.delete(col.key); else n.add(col.key);
                                      return n;
                                    })}
                                    title="فیلتر این ستون">
                                    <Filter size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleCols.length} className="py-10 text-center text-muted-foreground">
                      {hasData ? (
                        <span>
                          موردی مطابق فیلترها یافت نشد.{' '}
                          <button className="text-primary underline underline-offset-4" onClick={clearFilters}>پاک کردن فیلترها</button>
                        </span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ) : sorted.map((r, i) => (
                  <TableRow key={rowKey(r, i)} className="even:bg-muted/30 hover:bg-muted/50">
                    {visibleCols.map(col => (
                      <TableCell key={col.key} className={cn('py-2', alignCls[col.align ?? 'right'], col.className)}>
                        {col.cell ? col.cell(r, i) : String((r as Record<string, unknown>)[col.key] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {footer && (
                <tfoot className="sticky bottom-0 z-10">
                  {footer}
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/** فیلد فیلتر داخل هدر ستون */
function FilterInput({ value, placeholder, onChange, onClose, autoFocus }: {
  value: string; placeholder: string; onChange: (v: string) => void; onClose: () => void; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <div className="relative flex-1 min-w-[110px]">
      <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); }}
        placeholder={placeholder}
        className="h-7 text-xs pr-7 pl-6 bg-card"
      />
      <button type="button" onClick={() => { onChange(''); onClose(); }}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" title="بستن">
        <X size={12} />
      </button>
    </div>
  );
}
