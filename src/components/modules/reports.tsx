'use client';
// ماژول گزارش‌ساز — گزارش‌های داخلی آماده با پارامتر، جدول، جمع کل، اکسل و چاپ
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  BarChart3, Play, FileSpreadsheet, Printer, Loader2,
} from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, LoadingBlock } from '@/components/shared';
import { apiGet, downloadFile } from '@/lib/api-client';
import { toPersianDigits, formatMoney, normalizeDigits } from '@/lib/core/numbers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DataTable, type DtColumn } from '@/components/data-table';
import {
  TableRow, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ---------- انواع گزارش عیدی و سنوات ----------
interface EidiRow {
  personnelId: number;
  personnelCode: string;
  fullName: string;
  hireDate: string;
  jobWage: number;
  monthsWorked: number;
  daysWorked: number;
  seniorityDaysBefore: number;
  eidiRaw: number;
  eidiCapped: number;
  capApplied: boolean;
  seniority: number;
  eidUnpaid: number;
  total: number;
}
interface EidiResponse {
  fiscalYear: { id: number; jy: number; title: string };
  yearDays: number;
  minimumWage: number;
  rows: EidiRow[];
  totals: { eidi: number; seniority: number; eidUnpaid: number; total: number };
}

// ---------- انواع گزارش مراکز هزینه ----------
interface CostCenterGroup {
  costCenter: string;
  count: number;
  gross: number;
  net: number;
  tax: number;
  ins: number;
}
interface CostCenterMonth {
  periodId: number;
  jy: number;
  jm: number;
  status: string;
  groups: CostCenterGroup[];
}
interface CostCenterResponse {
  fiscalYear: { id: number; jy: number; title: string };
  months: CostCenterMonth[];
  comparison: Array<{
    costCenter: string;
    monthly: Array<{ jm: number; net: number }>;
    total: number;
    avg: number;
  }>;
}

interface ReportResult {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  moneyCols: number[];
  totals: Array<string | number> | null;
  count: number;
}

const REPORTS = [
  { type: 'payroll_summary', title: 'خلاصه حقوق پرسنل', needsPeriod: true, needsMonth: false, needsPerson: true },
  { type: 'attendance_daily', title: 'حضور روزانه پرسنل', needsPeriod: false, needsMonth: true, needsPerson: true },
  { type: 'leave_stats', title: 'آمار مرخصی', needsPeriod: false, needsMonth: false, needsPerson: true },
  { type: 'loans', title: 'لیست وام‌ها', needsPeriod: false, needsMonth: false, needsPerson: true },
  { type: 'loan_balance', title: 'مانده وام و مساعده', needsPeriod: false, needsMonth: false, needsPerson: true },
];

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export default function ReportsModule() {
  const { company, fy } = useApp();
  const [type, setType] = useState('payroll_summary');
  const [periodId, setPeriodId] = useState('');
  const [jm, setJm] = useState('');
  const [personnelId, setPersonnelId] = useState('');
  const [periods, setPeriods] = useState<Array<{ id: number; jy: number; jm: number; status: string }>>([]);
  const [months, setMonths] = useState<Array<{ jy: number; jm: number; source: string }>>([]);
  const [people, setPeople] = useState<Array<{ id: number; firstName: string; lastName: string; personnelCode: string }>>([]);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  // عیدی و سنوات
  const [eidiData, setEidiData] = useState<EidiResponse | null>(null);
  const [eidiLoading, setEidiLoading] = useState(false);

  // مراکز هزینه
  const [ccData, setCcData] = useState<CostCenterResponse | null>(null);
  const [ccLoading, setCcLoading] = useState(false);
  const [ccPeriodId, setCcPeriodId] = useState('');

  const loadEidi = async () => {
    if (!fy) return;
    setEidiLoading(true);
    setEidiData(null);
    try {
      const res = await apiGet<EidiResponse>(`/api/reports/eidi?fyId=${fy.id}`);
      setEidiData(res);
      if (!res.rows.length) toast.info('گزارش عیدی و سنوات بدون ردیف است');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در دریافت گزارش عیدی و سنوات');
    } finally {
      setEidiLoading(false);
    }
  };

  const loadCostCenters = async () => {
    if (!fy) return;
    setCcLoading(true);
    setCcData(null);
    setCcPeriodId('');
    try {
      const res = await apiGet<CostCenterResponse>(`/api/reports/cost-centers?fyId=${fy.id}`);
      setCcData(res);
      if (res.months.length) setCcPeriodId(String(res.months[res.months.length - 1].periodId));
      if (!res.comparison.length) toast.info('گزارش مراکز هزینه بدون ردیف است');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در دریافت گزارش مراکز هزینه');
    } finally {
      setCcLoading(false);
    }
  };

  const ccSelectedMonth = useMemo(
    () => ccData?.months.find((m) => String(m.periodId) === ccPeriodId) ?? null,
    [ccData, ccPeriodId],
  );

  // ماه‌های موجود در مقایسه مراکز هزینه (اجتماع ستون‌های ماهانه)
  const ccComparisonMonths = useMemo(() => {
    if (!ccData) return [];
    const set = new Set<number>();
    ccData.comparison.forEach((r) => r.monthly.forEach((m) => set.add(m.jm)));
    return Array.from(set).sort((a, b) => a - b);
  }, [ccData]);

  const eidiCols: DtColumn<EidiRow>[] = [
    { key: 'personnelCode', header: 'کد', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap' },
    { key: 'fullName', header: 'نام و نام خانوادگی', align: 'right' },
    { key: 'hireDate', header: 'تاریخ استخدام', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap' },
    { key: 'jobWage', header: 'مزد شغل', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.jobWage, cell: (r) => formatMoney(r.jobWage) },
    { key: 'monthsWorked', header: 'ماه کارکرد', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', cell: (r) => toPersianDigits(String(r.monthsWorked)) },
    { key: 'daysWorked', header: 'روز کارکرد', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', cell: (r) => toPersianDigits(String(r.daysWorked)) },
    { key: 'seniorityDaysBefore', header: 'سابقه از قبل (روز)', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', cell: (r) => toPersianDigits(String(r.seniorityDaysBefore)) },
    { key: 'eidiRaw', header: 'عیدی خام', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.eidiRaw, cell: (r) => formatMoney(r.eidiRaw) },
    { key: 'eidiCapped', header: 'عیدی پرداختی', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.eidiCapped, cell: (r) => formatMoney(r.eidiCapped) },
    { key: 'capApplied', header: 'سقف اعمال‌شده', align: 'center', headerClassName: 'text-center whitespace-nowrap', noSort: true, noFilter: true, cell: (r) => (r.capApplied ? 'بله' : '—') },
    { key: 'seniority', header: 'حق سنوات', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.seniority, cell: (r) => formatMoney(r.seniority) },
    { key: 'eidUnpaid', header: 'عیدی پرداخت‌نشده', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.eidUnpaid, cell: (r) => formatMoney(r.eidUnpaid) },
    { key: 'total', header: 'جمع', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.total, cell: (r) => formatMoney(r.total) },
  ];

  const ccGroupCols: DtColumn<CostCenterGroup>[] = [
    { key: 'costCenter', header: 'مرکز هزینه', align: 'right' },
    { key: 'count', header: 'تعداد پرسنل', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', cell: (r) => toPersianDigits(String(r.count)) },
    { key: 'gross', header: 'ناخالص', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.gross, cell: (r) => formatMoney(r.gross) },
    { key: 'net', header: 'خالص', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.net, cell: (r) => formatMoney(r.net) },
    { key: 'tax', header: 'مالیات', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.tax, cell: (r) => formatMoney(r.tax) },
    { key: 'ins', header: 'بیمه', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r) => r.ins, cell: (r) => formatMoney(r.ins) },
  ];

  const ccComparisonCols: DtColumn<CostCenterResponse['comparison'][number]>[] = useMemo(() => [
    { key: 'costCenter', header: 'مرکز هزینه', align: 'right' },
    ...ccComparisonMonths.map((jm) => ({
      key: `jm-${jm}`,
      header: MONTH_NAMES[jm - 1] ?? String(jm),
      align: 'center' as const,
      className: 'num whitespace-nowrap',
      headerClassName: 'text-center whitespace-nowrap',
      noSort: true,
      noFilter: true,
      cell: (r: CostCenterResponse['comparison'][number]) => {
        const v = r.monthly.find((m) => m.jm === jm);
        return v ? formatMoney(v.net) : '—';
      },
    })),
    { key: 'total', header: 'جمع', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r: CostCenterResponse['comparison'][number]) => r.total, cell: (r: CostCenterResponse['comparison'][number]) => formatMoney(r.total) },
    { key: 'avg', header: 'میانگین', align: 'center', className: 'num whitespace-nowrap', headerClassName: 'text-center whitespace-nowrap', sortValue: (r: CostCenterResponse['comparison'][number]) => r.avg, cell: (r: CostCenterResponse['comparison'][number]) => formatMoney(r.avg) },
  ], [ccComparisonMonths]);

  const cfg = REPORTS.find((r) => r.type === type)!;

  useEffect(() => {
    const run = async () => {
      if (!company) return;
      try {
        const p = fy
          ? await apiGet<{ periods: Array<{ id: number; jy: number; jm: number; status: string }> }>(`/api/payroll/periods?fyId=${fy.id}`)
          : { periods: [] };
        setPeriods(p.periods);
        if (p.periods.length && !periodId) setPeriodId(String(p.periods[0].id));
        const m = fy
          ? await apiGet<{ months: Array<{ jy: number; jm: number; source: string }> }>(`/api/attendance/months?fyId=${fy.id}`)
          : { months: [] };
        setMonths(m.months);
        if (m.months.length && !jm) setJm(String(m.months[m.months.length - 1].jm));
        const per = await apiGet<{ personnel: Array<{ id: number; firstName: string; lastName: string; personnelCode: string }> }>(
          `/api/personnel?companyId=${company.id}`,
        );
        setPeople(per.personnel);
      } catch {
        /* بارگذاری پارامترها اختیاری است */
      }
    };
    void run();
  }, [company, fy]);

  const buildQuery = useCallback(() => {
    const sp = new URLSearchParams();
    sp.set('type', type);
    if (company) sp.set('companyId', String(company.id));
    if (cfg.needsPeriod && periodId) sp.set('periodId', periodId);
    if (cfg.needsMonth && jm) {
      const m = months.find((x) => String(x.jm) === jm);
      sp.set('jy', String(m?.jy ?? fy?.jy ?? 1405));
      sp.set('jm', jm);
    }
    if (personnelId) sp.set('personnelId', personnelId);
    return sp.toString();
  }, [type, company, cfg.needsPeriod, cfg.needsMonth, periodId, jm, months, personnelId, fy]);

  const runReport = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await apiGet<ReportResult>(`/api/reports/builtin?${buildQuery()}`);
      setResult(res);
      if (!res.count) toast.info('گزارش بدون ردیف — پارامترها یا داده‌ها را بررسی کنید');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در تولید گزارش');
    } finally {
      setLoading(false);
    }
  };

  const exportXlsx = async () => {
    try {
      await downloadFile(`/api/reports/builtin-xlsx?${buildQuery()}`, `report-${type}.xlsx`);
      toast.success('فایل اکسل دانلود شد');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در تولید اکسل');
    }
  };

  const money = (v: string | number) =>
    typeof v === 'number' ? formatMoney(v) : String(v);
  const cellText = (cell: string | number, ci: number) => {
    if (result?.moneyCols.includes(ci)) return money(cell);
    if (typeof cell === 'number') return toPersianDigits(String(cell));
    return String(cell);
  };

  // ستون‌های پویا بر اساس هدرهای گزارش — با مرتب‌سازی/فیلتر/نمایش و مخفی‌سازی
  const reportCols: DtColumn<Array<string | number>>[] = useMemo(() => {
    if (!result) return [];
    return result.headers.map((h, i) => ({
      key: `col-${i}`,
      header: h,
      align: result.moneyCols.includes(i) || i === 0 ? 'center' : 'right',
      className: result.moneyCols.includes(i) ? 'num whitespace-nowrap' : '',
      headerClassName: result.moneyCols.includes(i) || i === 0 ? 'text-center whitespace-nowrap' : '',
      sortValue: (row) => {
        const v = row[i];
        if (typeof v === 'number') return v;
        const s = normalizeDigits(String(v)).replace(/[,٬\s]/g, '');
        return s && !Number.isNaN(parseFloat(s)) && /^[\d.\-+]+$/.test(s) ? parseFloat(s) : String(v);
      },
    }));
  }, [result]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="گزارش‌ساز"
        subtitle="گزارش‌های داخلی آماده با خروجی اکسل و چاپ"
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          result && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 no-print" onClick={() => void exportXlsx()}>
                <FileSpreadsheet className="h-4 w-4" /> خروجی اکسل
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 no-print" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> چاپ
              </Button>
            </>
          )
        }
      />

      {/* کارت پارامترها */}
      <Card className="p-4 shadow-luxe border-border/70 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">گزارش</Label>
            <Select value={type} onValueChange={(v) => { setType(v); setResult(null); }}>
              <SelectTrigger className="w-[210px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORTS.map((r) => <SelectItem key={r.type} value={r.type}>{r.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {cfg.needsPeriod && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">دوره حقوق</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="انتخاب دوره" /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {MONTH_NAMES[p.jm - 1]} {toPersianDigits(p.jy)} ({p.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {cfg.needsMonth && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">ماه حضور</Label>
              <Select value={jm} onValueChange={setJm}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="انتخاب ماه" /></SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={`${m.jy}-${m.jm}`} value={String(m.jm)}>
                      {MONTH_NAMES[m.jm - 1]} {toPersianDigits(m.jy)} ({m.source})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {cfg.needsPerson && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">پرسنل (اختیاری)</Label>
              <Select value={personnelId || 'all'} onValueChange={(v) => setPersonnelId(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">همه پرسنل</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {`${p.firstName} ${p.lastName}`.trim() || toPersianDigits(p.personnelCode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button className="h-9 gap-1.5" onClick={() => void runReport()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            اجرای گزارش
          </Button>
        </div>
      </Card>

      {/* نتیجه */}
      {loading && <LoadingBlock rows={6} />}
      {!loading && !result && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          نوع گزارش و پارامترها را انتخاب و «اجرای گزارش» را بزنید.
        </Card>
      )}
      {!loading && result && (
        <Card className="p-5 shadow-luxe border-border/70 print-sheet">
          <div className="mb-4 text-center">
            <h2 className="font-bold text-[16px]">{result.title}</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">{result.subtitle}</p>
          </div>
          {result.count === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ردیفی برای نمایش نیست.</p>
          ) : (
            <DataTable
              id={`report-${type}`}
              columns={reportCols}
              rows={result.rows}
              rowKey={(_, i) => i}
              containerClassName="max-h-[62vh]"
              footer={result.totals ? (
                <TableRow className="bg-muted/70 font-bold hover:bg-muted/70">
                  {result.totals.map((cell, ci) => (
                    <TableCell key={ci} className={result.moneyCols.includes(ci) ? 'text-center num whitespace-nowrap' : ci === 0 ? 'text-center' : ''}>
                      {cellText(cell, ci)}
                    </TableCell>
                  ))}
                </TableRow>
              ) : undefined}
            />
          )}
          <p className="mt-3 text-[11px] text-muted-foreground text-center no-print">
            {toPersianDigits(String(result.count))} ردیف — مبالغ به ریال
          </p>
        </Card>
      )}

      {/* ---------- گزارش عیدی و سنوات ---------- */}
      <Card className="p-4 shadow-luxe border-border/70 print-sheet">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-[14px]">گزارش عیدی و سنوات</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              عیدی، حق سنوات و عیدی پرداخت‌نشده به تفکیک پرسنل{fy ? ` — سال ${toPersianDigits(String(fy.jy))}` : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 no-print"
            onClick={() => void loadEidi()}
            disabled={eidiLoading || !fy}
          >
            {eidiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            بارگذاری گزارش
          </Button>
        </div>

        {eidiLoading && <LoadingBlock rows={6} />}
        {!eidiLoading && !eidiData && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            برای مشاهده، دکمه «بارگذاری گزارش» را بزنید.
          </p>
        )}
        {!eidiLoading && eidiData && (
          eidiData.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ردیفی برای نمایش نیست.</p>
          ) : (
            <>
              <DataTable
                id="report-eidi"
                columns={eidiCols}
                rows={eidiData.rows}
                rowKey={(r) => r.personnelId}
                containerClassName="max-h-[55vh]"
                defaultSort={{ key: 'personnelCode', dir: 'asc' }}
                footer={(
                  <TableRow className="bg-muted/70 font-bold hover:bg-muted/70">
                    <TableCell className="text-center">جمع کل</TableCell>
                    {Array.from({ length: 7 }, (_, i) => <TableCell key={i} />)}
                    <TableCell className="text-center num whitespace-nowrap">{formatMoney(eidiData.totals.eidi)}</TableCell>
                    <TableCell />
                    <TableCell className="text-center num whitespace-nowrap">{formatMoney(eidiData.totals.seniority)}</TableCell>
                    <TableCell className="text-center num whitespace-nowrap">{formatMoney(eidiData.totals.eidUnpaid)}</TableCell>
                    <TableCell className="text-center num whitespace-nowrap">{formatMoney(eidiData.totals.total)}</TableCell>
                  </TableRow>
                )}
              />
              <p className="mt-3 text-[11px] text-muted-foreground text-center no-print">
                {toPersianDigits(String(eidiData.rows.length))} ردیف — مبالغ به ریال
              </p>
            </>
          )
        )}
      </Card>

      {/* ---------- گزارش مراکز هزینه ---------- */}
      <Card className="p-4 shadow-luxe border-border/70 print-sheet">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-[14px]">گزارش مراکز هزینه</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              مقایسه خالص پرداختی ماه‌ها و تفکیک بر اساس مرکز هزینه{fy ? ` — سال ${toPersianDigits(String(fy.jy))}` : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 no-print"
            onClick={() => void loadCostCenters()}
            disabled={ccLoading || !fy}
          >
            {ccLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            بارگذاری گزارش
          </Button>
        </div>

        {ccLoading && <LoadingBlock rows={6} />}
        {!ccLoading && !ccData && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            برای مشاهده، دکمه «بارگذاری گزارش» را بزنید.
          </p>
        )}
        {!ccLoading && ccData && (
          ccData.comparison.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ردیفی برای نمایش نیست.</p>
          ) : (
            <div className="space-y-6">
              {/* الف) جدول مقایسه ماهانه */}
              <div>
                <h3 className="font-bold text-[13px] mb-3">مقایسه خالص پرداختی بر اساس ماه</h3>
                <DataTable
                  id="report-cost-centers-comparison"
                  columns={ccComparisonCols}
                  rows={ccData.comparison}
                  rowKey={(r) => r.costCenter}
                  containerClassName="max-h-[45vh]"
                />
                <p className="mt-3 text-[11px] text-muted-foreground text-center no-print">
                  {toPersianDigits(String(ccData.comparison.length))} مرکز هزینه — مبالغ به ریال
                </p>
              </div>

              {/* ب) تفکیک یک ماه انتخابی */}
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h3 className="font-bold text-[13px]">تفکیک مرکز هزینه در ماه</h3>
                  <Select
                    value={ccPeriodId}
                    onValueChange={setCcPeriodId}
                    disabled={!ccData.months.length}
                  >
                    <SelectTrigger className="w-[190px] h-8"><SelectValue placeholder="انتخاب ماه" /></SelectTrigger>
                    <SelectContent>
                      {ccData.months.map((m) => (
                        <SelectItem key={m.periodId} value={String(m.periodId)}>
                          {MONTH_NAMES[m.jm - 1]} {toPersianDigits(m.jy)} ({m.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {ccSelectedMonth && ccSelectedMonth.groups.length > 0 ? (
                  <DataTable
                    id="report-cost-centers-groups"
                    columns={ccGroupCols}
                    rows={ccSelectedMonth.groups}
                    rowKey={(r) => r.costCenter}
                    containerClassName="max-h-[45vh]"
                  />
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    برای این ماه گروهی برای نمایش نیست.
                  </p>
                )}
              </div>
            </div>
          )
        )}
      </Card>
    </div>
  );
}
