'use client';
// ماژول تقویم و تعطیلات — گرید ماه شنبه‌شروع + رویدادها + افزودن/حذف
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays, Plus, Trash2, RefreshCw, Sun,
} from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, LoadingBlock } from '@/components/shared';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { normalizeDigits, parseIntOr, toPersianDigits } from '@/lib/core/numbers';
import { MONTH_NAMES, WEEKDAY_NAMES } from '@/lib/core/jalali';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTable, type DtColumn } from '@/components/data-table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface CalEvent { id: number; kind: string; title: string; source: string }
/** سطر جدول رویدادها: رویداد + روز ماه */
type CalEventRow = CalEvent & { jd: number };
interface CalDay {
  jd: number; weekday: number; weekdayName: string; isFriday: boolean; holiday: boolean;
  events: CalEvent[];
}
interface CalData {
  jy: number; jm: number; daysInMonth: number; days: CalDay[]; events: Array<CalEvent & { jd: number }>;
  today: { jy: number; jm: number; jd: number };
}

export default function CalendarModule() {
  const { fy } = useApp();
  const [jy, setJy] = useState<number>(1405);
  const [jm, setJm] = useState<number>(1);
  const [data, setData] = useState<CalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ jd: '1', kind: 'holiday', title: '' });

  useEffect(() => {
    if (fy) { setJy(fy.jy); setJm(1); }
  }, [fy]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<CalData>(`/api/calendar?jy=${jy}&jm=${jm}`);
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری تقویم');
    } finally {
      setLoading(false);
    }
  }, [jy, jm]);

  useEffect(() => { void load(); }, [load]);

  const addEvent = async () => {
    const jd = parseIntOr(form.jd, 0);
    if (!form.title.trim()) { toast.error('عنوان رویداد الزامی است'); return; }
    if (!(jd >= 1 && jd <= (data?.daysInMonth ?? 31))) { toast.error('روز نامعتبر است'); return; }
    try {
      await apiPost('/api/calendar', { jy, jm, jd, kind: form.kind, title: normalizeDigits(form.title) });
      toast.success('رویداد افزوده شد');
      setAddOpen(false);
      setForm({ jd: '1', kind: 'holiday', title: '' });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در افزودن');
    }
  };

  const delEvent = useCallback(async (id: number) => {
    try {
      await apiDelete(`/api/calendar/${id}`);
      toast.success('رویداد حذف شد');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در حذف');
    }
  }, [load]);

  const years = Array.from({ length: 97 }, (_, i) => 1404 + i);
  const today = data?.today;

  // ستون‌های جدول رویدادها — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const eventCols: DtColumn<CalEventRow>[] = useMemo(() => [
    {
      key: 'jd', header: 'روز', align: 'center', headerClassName: 'w-20', className: 'num font-medium',
      sortValue: (e) => e.jd, cell: (e) => toPersianDigits(e.jd),
    },
    {
      key: 'kind', header: 'نوع', align: 'center', headerClassName: 'w-28',
      sortValue: (e) => e.kind,
      cell: (e) => (
        <Badge className={cn('text-[10.5px]', e.kind === 'holiday' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
          {e.kind === 'holiday' ? 'تعطیل رسمی' : 'مناسبت'}
        </Badge>
      ),
    },
    {
      key: 'title', header: 'عنوان', className: 'text-[13px]',
      sortValue: (e) => e.title, cell: (e) => e.title,
    },
    {
      key: 'source', header: 'منبع', align: 'center', className: 'text-[11.5px] text-muted-foreground',
      sortValue: (e) => e.source, cell: (e) => e.source,
    },
    {
      key: 'ops', header: 'حذف', align: 'center', noSort: true, noFilter: true,
      headerClassName: 'w-16 no-print', className: 'no-print',
      cell: (e) => (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => void delEvent(e.id)} title="حذف رویداد">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [delEvent]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="تقویم و تعطیلات"
        subtitle="تقویم شمسی با تعطیلات رسمی و مناسبت‌ها تا سال ۱۵۰۰ — جمعه‌ها همیشه تعطیل"
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5 no-print">
              <RefreshCw className="h-3.5 w-3.5" /> به‌روزرسانی
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 no-print">
              <Plus className="h-4 w-4" /> افزودن رویداد
            </Button>
          </>
        }
      />

      {/* انتخاب دوره */}
      <Card className="p-4 shadow-luxe border-border/70 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">ماه</Label>
            <SearchableSelect
              className="w-[150px]"
              value={String(jm)}
              onValueChange={(v) => setJm(Number(v))}
              searchPlaceholder="جستجوی ماه…"
              options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">سال</Label>
            <SearchableSelect
              className="w-[110px]"
              value={String(jy)}
              onValueChange={(v) => setJy(Number(v))}
              searchPlaceholder="جستجوی سال…"
              options={years.map((y) => ({ value: String(y), label: toPersianDigits(y) }))}
            />
          </div>
          <p className="text-[11.5px] text-muted-foreground pb-2">
            {fy && jy === fy.jy ? `سال مالی فعال: ${toPersianDigits(fy.jy)}` : `سال آزاد (خارج از سال مالی فعال)`}
          </p>
        </div>
      </Card>

      {loading ? (
        <LoadingBlock rows={5} />
      ) : !data ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">تقویم بارگذاری نشد.</Card>
      ) : (
        <>
          {/* گرید ماه */}
          <Card className="p-4 shadow-luxe border-border/70 overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {WEEKDAY_NAMES.map((w) => (
                  <div key={w} className="text-center text-[12px] font-bold text-muted-foreground py-1.5">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: data.days[0]?.weekday ?? 0 }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[92px] rounded-lg bg-muted/20" />
                ))}
                {data.days.map((d) => {
                  const isToday = today && today.jy === jy && today.jm === jm && today.jd === d.jd;
                  return (
                    <div
                      key={d.jd}
                      className={cn(
                        'min-h-[92px] rounded-lg border p-2 flex flex-col gap-1 transition-colors',
                        d.holiday ? 'bg-destructive/5 border-destructive/25' : 'bg-background border-border/60 hover:border-primary/30',
                        isToday && 'ring-2 ring-primary ring-offset-1',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn('text-[14px] font-bold num', d.holiday ? 'text-destructive' : 'text-foreground')}>
                          {toPersianDigits(d.jd)}
                        </span>
                        {isToday && <Badge className="h-4 px-1.5 text-[9px] bg-primary text-primary-foreground">امروز</Badge>}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {d.events.map((e) => (
                          <p
                            key={e.id}
                            title={e.title}
                            className={cn(
                              'text-[9.5px] leading-3.5 truncate',
                              e.kind === 'holiday' ? 'text-destructive font-medium' : 'text-muted-foreground',
                            )}
                          >
                            {e.title}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* جدول رویدادها */}
          <Card className="p-5 shadow-luxe border-border/70">
            <div className="flex items-center gap-2 mb-4">
              <Sun className="h-4 w-4 text-gold" />
              <h2 className="font-bold text-[15px]">
                رویدادهای {MONTH_NAMES[jm - 1]} {toPersianDigits(jy)}
              </h2>
              <Badge variant="outline" className="text-[10.5px]">
                {toPersianDigits(String(data.events.length))} رویداد
              </Badge>
            </div>
            <DataTable
              id="calendar-events"
              columns={eventCols}
              rows={data.events}
              rowKey={(e) => e.id}
              containerClassName="max-h-96"
              empty={
                <p className="py-6 text-center text-sm text-muted-foreground">
                  رویداد ثبت‌شده‌ای برای این ماه نیست (جمعه‌ها به‌صورت خودکار تعطیل محسوب می‌شوند).
                </p>
              }
            />
          </Card>
        </>
      )}

      {/* دیالوگ افزودن */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>افزودن رویداد تقویم</DialogTitle>
            <DialogDescription>
              رویداد دستی در {MONTH_NAMES[jm - 1]} {toPersianDigits(jy)} — برای اصلاح تعطیلات قمری تقریبی هم کاربرد دارد.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">روز ماه</Label>
                <Input className="num" value={toPersianDigits(form.jd)}
                  onChange={(e) => setForm({ ...form, jd: normalizeDigits(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">نوع</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">تعطیل رسمی</SelectItem>
                    <SelectItem value="occasion">مناسبت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">عنوان</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: عید سعید فطر" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>انصراف</Button>
            <Button onClick={() => void addEvent()}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
