'use client';
// ماژول حضور و غیاب — ایمپورت فایل دستگاه، جدول روزانه با ویرایش، بازمحاسبه و آمار ماه
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarRange, Upload, RefreshCw, Pencil, UserCheck, Clock4, TimerOff, AlarmClock, CalendarPlus,
} from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState, LoadingBlock, Fa, StatusBadge, StatCard } from '@/components/shared';
import { StarOff } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import { normalizeDigits, toPersianDigits, parseIntOr, minutesToHHMM, parseHHMM } from '@/lib/core/numbers';
import { monthDaysList, daysInMonth } from '@/lib/core/jalali';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTable, type DtColumn } from '@/components/data-table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

/** مقدار جایگزین برای «بدون مرخصی» — Radix اجازه value="" در SelectItem را نمی‌دهد */
const LEAVE_NONE = '__none__';

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const LEAVE_KINDS = ['استحقاقی', 'استعلاجی', 'بدون حقوق'];

interface AttMonth { id: number; jy: number; jm: number; source: string; dayCount: number }
interface PersonLite { id: number; personnelCode: string; firstName: string; lastName: string; status: string }
interface DailyRow {
  id: number; monthId: number; personnelId: number; day: number; status: string;
  entry1: number; exit1: number; entry2: number; exit2: number;
  lateMin: number; earlyMin: number; missingMin: number; leaveMin: number;
  missionMin: number; overtimeMin: number; workedMin: number; expectedMin: number; leaveKind: string;
  edited: boolean;
}
interface Stat {
  presentDays: number; absentDays: number; totalLateMinutes: number; overtimeMinutes: number;
  overtimeHours: number; lateMinutes: number; paidDays: number; leaveDays: number;
}
/** سطر جدول روزانه: اطلاعات روز ماه + رکورد حضور (در صورت وجود) */
type DayListItem = { jd: number; weekday: number; weekdayName: string; row: DailyRow | null };
/** روز جمعه یا تعطیل */
const isHol = (d: DayListItem) => d.weekday === 6 || (d.row?.status || '').includes('تعطیل');
interface ImportResult {
  saved: number; newEmployees: string[];
  unmatched: Array<{ card: string; name: string }>;
  period: [number, number] | null; monthId: number | null;
}

/** دقیقه ساعت شبانه‌روز یا -1 → نمایش */
const clock = (m: number) => (m === null || m === undefined || m < 0 ? '—' : toPersianDigits(minutesToHHMM(m)));
/** دقیقه مدت یا ۰ → نمایش */
const dur = (m: number) => (m ? toPersianDigits(minutesToHHMM(m)) : '—');
/** HH:MM فارسی/انگلیسی → دقیقه (خالی → def) */
const hhmm = (s: string, def: number) => {
  const t = normalizeDigits(s).trim();
  if (!t) return def;
  return parseHHMM(t, def);
};

export default function AttendanceModule() {
  const { company, fy, refreshContext, user } = useApp();
  const isSupervisor = !!user?.isSupervisor;
  const [months, setMonths] = useState<AttMonth[]>([]);
  const [monthId, setMonthId] = useState<string>('');
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [personId, setPersonId] = useState<string>('');
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [month, setMonth] = useState<{ jy: number; jm: number } | null>(null);
  const [stat, setStat] = useState<Stat | null>(null);
  const [loading, setLoading] = useState(true);

  // ایمپورت
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ویرایش روز
  const [editRow, setEditRow] = useState<DailyRow | null>(null);
  const [editForm, setEditForm] = useState({
    entry1: '', exit1: '', entry2: '', exit2: '',
    workedMin: '', missionMin: '', overtimeMin: '', leaveKind: '', leaveMin: '',
  });
  const [savingDay, setSavingDay] = useState(false);
  const [recalcing, setRecalcing] = useState(false);

  const loadMonths = useCallback(async (fyId: number, selectDefault = false) => {
    const d = await apiGet<{ months: AttMonth[] }>(`/api/attendance/months?fyId=${fyId}`);
    setMonths(d.months);
    if (selectDefault && d.months.length) {
      const best = [...d.months].sort((a, b) => (b.jy * 12 + b.jm) - (a.jy * 12 + a.jm))[0];
      setMonthId(String(best.id));
    }
    return d.months;
  }, []);

  useEffect(() => {
    if (!company || !fy) return;
    setLoading(true);
    Promise.all([
      loadMonths(fy.id, true),
      apiGet<{ personnel: PersonLite[] }>(`/api/personnel?companyId=${company.id}`),
    ]).then(([_, d]) => {
      setPeople(d.personnel);
      setPersonId((prev) => {
        if (prev && d.personnel.some((p) => String(p.id) === prev)) return prev;
        const active = d.personnel.find((p) => p.status === 'شاغل');
        return String(active?.id ?? d.personnel[0]?.id ?? '');
      });
    }).catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [company, fy, loadMonths]);

  const loadDaily = useCallback(async () => {
    if (!monthId || !personId) { setRows([]); setStat(null); return; }
    try {
      const [d, s] = await Promise.all([
        apiGet<{ month: { jy: number; jm: number }; rows: DailyRow[] }>(
          `/api/attendance/daily?monthId=${monthId}&personnelId=${personId}`),
        apiGet<{ stat: Stat | null }>(
          `/api/attendance/stats?monthId=${monthId}&personnelId=${personId}`),
      ]);
      setMonth(d.month);
      setRows(d.rows);
      setStat(s.stat);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [monthId, personId]);

  useEffect(() => { loadDaily(); }, [loadDaily]);

  const dayList = useMemo(() => {
    if (!month) return [];
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return monthDaysList(month.jy, month.jm).map((d) => ({
      ...d, row: byDay.get(d.jd) ?? null,
    }));
  }, [month, rows]);

  const doImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('ابتدا فایل دستگاه را انتخاب کنید'); return; }
    if (!fy) return;
    setImporting(true);
    setImportResult(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error('خطا در خواندن فایل'));
        fr.readAsDataURL(file);
      });
      const res = await apiPost<ImportResult>('/api/attendance/import', {
        fyId: fy.id, filename: file.name, fileBase64: dataUrl.split(',')[1] ?? '',
      });
      setImportResult(res);
      toast.success(`${toPersianDigits(res.saved)} پرسنل ذخیره شد`);
      await loadMonths(fy.id, false);
      if (res.monthId) setMonthId(String(res.monthId));
      await refreshContext();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const doRecalc = async () => {
    if (!monthId) return;
    setRecalcing(true);
    try {
      const res = await apiPost<{ recalced: number }>('/api/attendance/recalc', { monthId: Number(monthId) });
      toast.success(`${toPersianDigits(res.recalced)} روز بازمحاسبه شد`);
      await loadDaily();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRecalcing(false);
    }
  };

  /** نمایش ساعت + ستاره اگر دستی ویرایش شده باشد */
  const clockStar = (m: number, edited: boolean) => (
    <>
      {clock(m)}
      {edited && <span className="mr-0.5 text-amber-500" title="ویرایش دستی">★</span>}
    </>
  );

  /** برداشتن ستاره — فقط سوپروایزر (بازگشت رکورد به داده خام دستگاه) */
  const clearStar = async (r: DailyRow) => {
    try {
      await apiPut(`/api/attendance/daily/${r.id}`, { clearEdited: true });
      toast.success('ستاره برداشته شد — رکورد به داده خام بازگشت');
      await loadDaily();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openEdit = useCallback((r: DailyRow) => {
    setEditRow(r);
    setEditForm({
      entry1: r.entry1 >= 0 ? minutesToHHMM(r.entry1) : '',
      exit1: r.exit1 >= 0 ? minutesToHHMM(r.exit1) : '',
      entry2: r.entry2 >= 0 ? minutesToHHMM(r.entry2) : '',
      exit2: r.exit2 >= 0 ? minutesToHHMM(r.exit2) : '',
      workedMin: minutesToHHMM(r.workedMin),
      missionMin: minutesToHHMM(r.missionMin),
      overtimeMin: minutesToHHMM(r.overtimeMin),
      leaveKind: r.leaveKind || '',
      leaveMin: r.leaveMin ? minutesToHHMM(r.leaveMin) : '',
    });
  }, []);

  // ستون‌های جدول روزانه — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const dayCols: DtColumn<DayListItem>[] = useMemo(() => [
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'jd', header: 'روز', align: 'center', className: 'num font-medium',
      sortValue: (d) => d.jd, cell: (d) => <Fa>{d.jd}</Fa>,
    },
    {
      key: 'weekday', header: 'روز هفته', align: 'center', className: 'whitespace-nowrap',
      sortValue: (d) => d.weekday,
      cell: (d) => isHol(d) ? (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-destructive/10 text-destructive">
          {d.weekdayName}
        </span>
      ) : d.weekdayName,
    },
    {
      key: 'status', header: 'وضعیت', align: 'center',
      sortValue: (d) => d.row?.status ?? '',
      cell: (d) => (d.row ? <StatusBadge status={d.row.status} /> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: 'entry1', header: 'ورود۱', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.entry1 : -1), cell: (d) => (d.row ? clockStar(d.row.entry1, d.row.edited) : '—'),
    },
    {
      key: 'exit1', header: 'خروج۱', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.exit1 : -1), cell: (d) => (d.row ? clockStar(d.row.exit1, d.row.edited) : '—'),
    },
    {
      key: 'entry2', header: 'ورود۲', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.entry2 : -1), cell: (d) => (d.row ? clockStar(d.row.entry2, d.row.edited) : '—'),
    },
    {
      key: 'exit2', header: 'خروج۲', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.exit2 : -1), cell: (d) => (d.row ? clockStar(d.row.exit2, d.row.edited) : '—'),
    },
    {
      key: 'lateMin', header: 'تاخیر', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.lateMin : -1), cell: (d) => (d.row ? dur(d.row.lateMin) : '—'),
    },
    {
      key: 'earlyMin', header: 'تعجیل', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.earlyMin : -1), cell: (d) => (d.row ? dur(d.row.earlyMin) : '—'),
    },
    {
      key: 'missingMin', header: 'کسرکار', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.missingMin : -1), cell: (d) => (d.row ? dur(d.row.missingMin) : '—'),
    },
    {
      key: 'leaveMin', header: 'مرخصی', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.leaveMin : -1), cell: (d) => (d.row ? dur(d.row.leaveMin) : '—'),
    },
    {
      key: 'missionMin', header: 'ماموریت', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.missionMin : -1), cell: (d) => (d.row ? dur(d.row.missionMin) : '—'),
    },
    {
      key: 'overtimeMin', header: 'اضافه‌کار', align: 'center', className: 'num whitespace-nowrap',
      sortValue: (d) => (d.row ? d.row.overtimeMin : -1), cell: (d) => (d.row ? dur(d.row.overtimeMin) : '—'),
    },
    {
      key: 'workedMin', header: 'کارکرد', align: 'center', className: 'num whitespace-nowrap font-medium',
      sortValue: (d) => (d.row ? d.row.workedMin : -1), cell: (d) => (d.row ? dur(d.row.workedMin) : '—'),
    },
    {
      key: 'ops', header: '', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (d) => d.row ? (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="ویرایش روز" onClick={() => openEdit(d.row!)}>
            <Pencil size={13} />
          </Button>
          {isSupervisor && d.row.edited && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500 hover:text-amber-600"
              title="برداشتن ستاره (بازگشت به داده خام دستگاه)" onClick={() => clearStar(d.row!)}>
              <StarOff size={13} />
            </Button>
          )}
        </div>
      ) : null,
    },
  ], [openEdit, isSupervisor]);

  const saveDay = async () => {
    if (!editRow) return;
    setSavingDay(true);
    try {
      await apiPut(`/api/attendance/daily/${editRow.id}`, {
        entry1: hhmm(editForm.entry1, -1),
        exit1: hhmm(editForm.exit1, -1),
        entry2: hhmm(editForm.entry2, -1),
        exit2: hhmm(editForm.exit2, -1),
        workedMin: hhmm(editForm.workedMin, 0),
        missionMin: hhmm(editForm.missionMin, 0),
        overtimeMin: hhmm(editForm.overtimeMin, 0),
        leaveKind: editForm.leaveKind,
        leaveMin: hhmm(editForm.leaveMin, 0),
        recalc: true,
      });
      toast.success('روز با موفقیت ویرایش و بازمحاسبه شد');
      setEditRow(null);
      await loadDaily();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingDay(false);
    }
  };

  if (!company || !fy) {
    return (
      <div>
        <PageHeader title="حضور و غیاب" icon={<CalendarRange size={20} />} />
        <Card><EmptyState title="ابتدا شرکت و سال مالی را ثبت کنید" /></Card>
      </div>
    );
  }

  const selectedMonth = months.find((m) => String(m.id) === monthId);

  return (
    <div>
      <PageHeader
        title="حضور و غیاب"
        subtitle={`${company.name} — سال مالی ${toPersianDigits(fy.jy)}`}
        icon={<CalendarRange size={20} />}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => { setImportResult(null); setImportOpen(true); }}>
              <Upload size={15} /> ایمپورت فایل دستگاه
            </Button>
            <Button className="gap-1.5" onClick={doRecalc} disabled={!monthId || recalcing}>
              <RefreshCw size={15} className={recalcing ? 'animate-spin' : ''} />
              {recalcing ? 'در حال بازمحاسبه…' : 'بازمحاسبه ماه'}
            </Button>
          </>
        }
      />

      {/* نوار انتخاب ماه و پرسنل */}
      <Card className="shadow-luxe border-border/70 mb-4">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Label className="text-[12.5px] text-muted-foreground">ماه:</Label>
          <SearchableSelect
            className="w-48"
            value={monthId}
            onValueChange={setMonthId}
            placeholder="انتخاب ماه"
            searchPlaceholder="جستجوی ماه…"
            options={months.map((m) => ({
              value: String(m.id),
              label: `${MONTH_NAMES[m.jm - 1]} ${toPersianDigits(m.jy)}`,
              hint: `${toPersianDigits(m.dayCount)} رکورد`,
            }))}
          />
          <Label className="text-[12.5px] text-muted-foreground">پرسنل:</Label>
          <SearchableSelect
            className="w-60"
            value={personId}
            onValueChange={setPersonId}
            placeholder="انتخاب پرسنل"
            searchPlaceholder="جستجوی نام یا کد پرسنلی…"
            options={people.map((p) => ({
              value: String(p.id),
              label: `${p.firstName} ${p.lastName}`,
              hint: toPersianDigits(p.personnelCode),
            }))}
          />
          {selectedMonth && (
            <span className="text-[12px] text-muted-foreground mr-auto">
              منبع داده: {selectedMonth.source}
            </span>
          )}
        </div>
      </Card>

      {/* کارت‌های آمار ماه پرسنل انتخابی */}
      {stat && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard title="روزهای حاضر" value={toPersianDigits(String(stat.presentDays))} icon={<UserCheck size={18} />} tone="positive" />
          <StatCard title="روزهای غایب" value={toPersianDigits(String(stat.absentDays))} icon={<TimerOff size={18} />} tone="destructive" />
          <StatCard title="مجموع تاخیر" value={toPersianDigits(minutesToHHMM(stat.totalLateMinutes))} icon={<AlarmClock size={18} />} tone="warning" />
          <StatCard title="مجموع اضافه‌کار" value={toPersianDigits(minutesToHHMM(stat.overtimeMinutes))} icon={<Clock4 size={18} />} tone="gold" />
        </div>
      )}

      {/* جدول روزانه */}
      <Card className="shadow-luxe border-border/70">
        {loading || !month ? (
          <LoadingBlock />
        ) : !monthId || !personId ? (
          <EmptyState title="ماه و پرسنل را انتخاب کنید" hint="ابتدا ماه حضور و سپس پرسنل مورد نظر را انتخاب کنید" icon={<CalendarRange size={28} />} />
        ) : dayList.every((d) => !d.row) ? (
          <EmptyState
            title="برای این پرسنل در این ماه رکوردی ثبت نشده است"
            hint="با دکمه «ایمپورت فایل دستگاه» داده‌های دستگاه حضور و غیاب را بارگذاری کنید"
            icon={<CalendarRange size={28} />}
          />
        ) : (
          <DataTable
            id="att-daily"
            columns={dayCols}
            rows={dayList}
            rowKey={(d) => d.jd}
            containerClassName="max-h-[58vh]"
          />
        )}
        {month && !loading && (
          <div className="border-t border-border/60 px-4 py-2.5 text-[12px] text-muted-foreground">
            {MONTH_NAMES[month.jm - 1]} {toPersianDigits(month.jy)} — {toPersianDigits(daysInMonth(month.jy, month.jm))} روز
          </div>
        )}
      </Card>

      {/* دیالوگ ایمپورت فایل دستگاه */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ایمپورت فایل دستگاه حضور و غیاب</DialogTitle>
            <DialogDescription>
              فایل «گزارش روزانه فردی» دستگاه (xls/xlsx) را انتخاب کنید. پرسنل جدید به‌صورت خودکار و غیرفعال ساخته می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
              onClick={() => fileRef.current?.click()}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
            >
              <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-[13px] font-medium">فایل دستگاه را اینجا انتخاب کنید</p>
              <p className="text-[11px] text-muted-foreground mt-1">فرمت‌های مجاز: xls، xlsx</p>
              <input
                ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) toast.info(`فایل انتخاب شد: ${f.name}`);
                }}
              />
              {fileRef.current?.files?.[0] && (
                <p className="text-[12px] text-primary mt-2">{fileRef.current.files[0].name}</p>
              )}
            </div>
            {importResult && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-[13px]">
                <p>
                  <b><Fa money={false}>{importResult.saved}</Fa> پرسنل ذخیره شد</b>
                  {importResult.period && (
                    <> — دوره: <b>{MONTH_NAMES[importResult.period[1] - 1]} {toPersianDigits(importResult.period[0])}</b></>
                  )}
                </p>
                {importResult.newEmployees.length > 0 && (
                  <p className="text-warning">
                    <Fa>{importResult.newEmployees.length}</Fa> پرسنل جدید خودکار ساخته شد (غیرفعال): {importResult.newEmployees.join('، ')}
                  </p>
                )}
                {importResult.newEmployees.length === 0 && (
                  <p className="text-success">همه پرسنل با پرونده موجود تطبیق داده شدند.</p>
                )}
                {importResult.unmatched.length > 0 && (
                  <p className="text-[11.5px] text-muted-foreground">
                    برای تکمیل اطلاعات، پرسنل‌های جدید را در ماژول «پرسنل» ویرایش و فعال کنید.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>بستن</Button>
            <Button onClick={doImport} disabled={importing} className="gap-1.5 min-w-28">
              <Upload size={15} /> {importing ? 'در حال ایمپورت…' : 'ایمپورت'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ ویرایش روز */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ویرایش روز {editRow ? toPersianDigits(String(editRow.day)) : ''}</DialogTitle>
            <DialogDescription>
              ساعت‌ها را به قالب HH:MM وارد کنید. پس از ذخیره، وضعیت و تاخیر/تعجیل روز به‌صورت خودکار بازمحاسبه می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">ورود۱</Label>
              <Input className="num" placeholder="۸:۰۰" value={editForm.entry1}
                onChange={(e) => setEditForm({ ...editForm, entry1: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">خروج۱</Label>
              <Input className="num" placeholder="۱۲:۰۰" value={editForm.exit1}
                onChange={(e) => setEditForm({ ...editForm, exit1: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">ورود۲</Label>
              <Input className="num" placeholder="۱۳:۰۰" value={editForm.entry2}
                onChange={(e) => setEditForm({ ...editForm, entry2: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">خروج۲</Label>
              <Input className="num" placeholder="۱۶:۰۰" value={editForm.exit2}
                onChange={(e) => setEditForm({ ...editForm, exit2: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">کارکرد (مجموع)</Label>
              <Input className="num" placeholder="۸:۰۰" value={editForm.workedMin}
                onChange={(e) => setEditForm({ ...editForm, workedMin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">اضافه‌کار</Label>
              <Input className="num" placeholder="۱:۳۰" value={editForm.overtimeMin}
                onChange={(e) => setEditForm({ ...editForm, overtimeMin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">ماموریت</Label>
              <Input className="num" placeholder="۲:۰۰" value={editForm.missionMin}
                onChange={(e) => setEditForm({ ...editForm, missionMin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">مرخصی (دقیقه)</Label>
              <Input className="num" placeholder="۴:۰۰" value={editForm.leaveMin}
                onChange={(e) => setEditForm({ ...editForm, leaveMin: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[12.5px]">نوع مرخصی</Label>
              <Select
                value={editForm.leaveKind || LEAVE_NONE}
                onValueChange={(v) => setEditForm({ ...editForm, leaveKind: v === LEAVE_NONE ? '' : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="بدون مرخصی" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={LEAVE_NONE}>بدون مرخصی</SelectItem>
                  {LEAVE_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>انصراف</Button>
            <Button onClick={saveDay} disabled={savingDay} className="gap-1.5 min-w-28">
              <CalendarPlus size={15} /> {savingDay ? 'در حال ذخیره…' : 'ذخیره و بازمحاسبه'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
