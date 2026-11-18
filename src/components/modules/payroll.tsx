'use client';
// ماژول حقوق و دستمزد — محاسبه دوره، جدول خلاصه، ریز فیش، لیست بانک و چاپ فیش حقوقی
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Calculator, Plus, Play, FileSpreadsheet, Printer, Banknote, CheckCircle2, AlertTriangle, Receipt,
  Lock, LockOpen, ListChecks, Info,
} from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState, LoadingBlock, Fa, StatusBadge, StatCard } from '@/components/shared';
import { apiGet, apiPost, apiPut, downloadFile, openPrintWindow } from '@/lib/api-client';
import { toPersianDigits, parseIntOr, minutesToHHMM, formatMoney, normalizeDigits } from '@/lib/core/numbers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PAYSLIP_OPTION_DEFS, defaultPayslipOptions } from '@/lib/core/payslip-option-defs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { TableRow, TableCell } from '@/components/ui/table';
import { DataTable, type DtColumn } from '@/components/data-table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const money = (v: number) => formatMoney(v);
const PAYSLIP_CODES_KEY = 'payslip_selected_codes';

/** نشان وضعیت دوره — «قفل‌شده» با استایل مخصوص نمایش داده می‌شود */
function PeriodStatusBadge({ status }: { status: string }) {
  if (status === 'قفل‌شده') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
        <Lock size={11} /> قفل‌شده
      </span>
    );
  }
  return <StatusBadge status={status} />;
}

interface PayrollPeriodRow { id: number; fiscalYearId: number; jy: number; jm: number; status: string }
interface PersonLite { id: number; personnelCode: string; firstName: string; lastName: string; status: string }
interface SummaryRow {
  id: number; personnelId: number; workedDays: number; leaveDays: number; overtimeMin: number;
  gross: number; insuredBase: number; workerIns: number; employerIns: number; unemploymentIns: number;
  taxBase: number; tax: number; totalDeductions: number; netPay: number; prevBalance: number;
  payApproved: boolean; payPaid: boolean;
  personnel: PersonLite & { nationalId: string; bankName: string; bankAccount: string };
}
interface Totals {
  gross: number; insuredBase: number; workerIns: number; taxBase: number; tax: number;
  totalDeductions: number; netPay: number; prevBalance: number; count: number;
}
interface LineRow { itemCode: string; title: string; kind: string; amount: number }
interface CalcResult {
  count: number; totalNet: number; totalGross: number; totalTax: number; totalIns: number;
  inactiveSkipped: string[];
}

export default function PayrollModule() {
  const { company, fy, periods, refreshContext } = useApp();
  const [periodId, setPeriodId] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newMonth, setNewMonth] = useState('');
  const [creating, setCreating] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calcWarn, setCalcWarn] = useState<string[] | null>(null);

  const [summary, setSummary] = useState<{ rows: SummaryRow[]; totals: Totals; period: PayrollPeriodRow } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // ریز فیش
  const [slipOpen, setSlipOpen] = useState(false);
  const [slipPerson, setSlipPerson] = useState<SummaryRow | null>(null);
  const [slipLines, setSlipLines] = useState<LineRow[]>([]);
  const [manualTaxFree, setManualTaxFree] = useState('');
  const [manualOtherDeduct, setManualOtherDeduct] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // لیست بانک
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [bankSel, setBankSel] = useState<Set<number>>(new Set());

  // فیش حقوقی
  const [printPersonId, setPrintPersonId] = useState('all');
  const [itemsOpen, setItemsOpen] = useState(false);
  // گزاره ۵ نسخه ۱٫۲٫۰ — تنظیم اقلام تکمیلی فیش
  const [slipOptsOpen, setSlipOptsOpen] = useState(false);
  const [slipOpts, setSlipOpts] = useState<Record<string, boolean>>(defaultPayslipOptions());
  const [slipOptsBusy, setSlipOptsBusy] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemMap, setItemMap] = useState<Record<string, string>>({});
  const [selCodes, setSelCodes] = useState<string[]>([]);
  const [statusBusy, setStatusBusy] = useState(false);
  // فیکس ۱.۴.۳ — دیالوگ دلیل بازگشایی قفل دوره (جایگزین window.prompt ناسازگار با الکترون)
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  useEffect(() => {
    if (!periodId && periods.length) {
      const t = setTimeout(() => setPeriodId(String(periods[0].id)), 0);
      return () => clearTimeout(t);
    }
  }, [periods, periodId]);

  const period = periods.find((p) => String(p.id) === periodId) ?? null;
  // اتوماسیون دستیار هوشمند (مورد ۷): «پرینت فیش فلانی» → انتخاب دوره + بازکردن فیش فرد
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string; personnelCode?: string; jm?: number; jy?: number }>).detail;
      if (!detail?.personnelCode) return;
      // یافتن دوره ماه هدف (یا آخرین دوره موجود)
      const target = detail.jm
        ? periods.find((p) => p.jm === detail.jm && (!detail.jy || p.jy === detail.jy))
        : periods[0];
      if (target) setPeriodId(String(target.id));
      const code = String(detail.personnelCode);
      const t = setTimeout(() => {
        apiGet<{ rows: SummaryRow[] }>(`/api/payroll/summary?periodId=${target?.id ?? ''}`)
          .then((d) => {
            const row = d.rows.find((r) => String(r.personnel.personnelCode) === code);
            if (row) void openSlipRef.current?.(row);
            else toast.warning(`پرسنل با کد ${code} در این دوره محاسبه نشده است`);
          })
          .catch(() => {});
      }, 400);
      return () => clearTimeout(t);
    };
    window.addEventListener('payroll-assistant-command', handler);
    return () => window.removeEventListener('payroll-assistant-command', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods]);

  // بازیابی اقلام انتخابی فیش از localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PAYSLIP_CODES_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSelCodes(arr.filter((x) => typeof x === 'string'));
      }
    } catch { /* بی‌اهمیت */ }
  }, []);

  const loadSummary = useCallback(async () => {
    if (!periodId) { setSummary(null); return; }
    setLoadingSummary(true);
    try {
      const d = await apiGet<{ rows: SummaryRow[]; totals: Totals; period: PayrollPeriodRow }>(
        `/api/payroll/summary?periodId=${periodId}`);
      setSummary(d);
      setBankSel(new Set());
    } catch (e) {
      toast.error((e as Error).message);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [periodId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const createPeriod = async () => {
    if (!fy || !newMonth) { toast.error('ماه دوره را انتخاب کنید'); return; }
    setCreating(true);
    try {
      const res = await apiPost<{ period: PayrollPeriodRow }>('/api/payroll/periods', {
        fyId: fy.id, jy: fy.jy, jm: parseIntOr(newMonth, 0),
      });
      toast.success(`دوره ${MONTH_NAMES[res.period.jm - 1]} ${toPersianDigits(res.period.jy)} آماده شد`);
      setNewOpen(false);
      setNewMonth('');
      await refreshContext();
      setPeriodId(String(res.period.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const doCalculate = async () => {
    if (!periodId) { toast.error('ابتدا یک دوره انتخاب یا ایجاد کنید'); return; }
    setCalculating(true);
    try {
      const res = await apiPost<CalcResult>('/api/payroll/calculate', { periodId: Number(periodId) });
      toast.success(
        `محاسبه انجام شد: ${toPersianDigits(res.count)} پرسنل — خالص ${money(res.totalNet)} ریال`,
      );
      if (res.inactiveSkipped?.length) setCalcWarn(res.inactiveSkipped);
      await Promise.all([loadSummary(), refreshContext()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCalculating(false);
    }
  };

  // ثبت کد/عنوان اقلام دیده‌شده برای دیالوگ «انتخاب اقلام فیش»
  const mergeItems = useCallback((lines: LineRow[]) => {
    setItemMap((m) => {
      const next = { ...m };
      for (const l of lines) if (l.itemCode && !next[l.itemCode]) next[l.itemCode] = l.title;
      return next;
    });
  }, []);

  // ارجاع پایدار به openSlip برای شنونده فرمان دستیار (بدون وابستگی به رندر)
  const openSlipRef = useRef<(row: SummaryRow) => void>(null);
  const openSlip = useCallback(async (row: SummaryRow) => {
    setSlipPerson(row);
    setSlipOpen(true);
    setManualTaxFree('');
    setManualOtherDeduct('');
    try {
      const d = await apiGet<{ lines: LineRow[]; summary: SummaryRow }>(
        `/api/payroll/lines?periodId=${periodId}&personnelId=${row.personnelId}`);
      setSlipLines(d.lines);
      mergeItems(d.lines);
      const tf = d.lines.find((l) => l.itemCode === 'tax_free_other')?.amount ?? 0;
      const od = d.lines.find((l) => l.itemCode === 'other_deduct')?.amount ?? 0;
      setManualTaxFree(tf ? String(tf) : '');
      setManualOtherDeduct(od ? String(od) : '');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [periodId, mergeItems]);
  openSlipRef.current = openSlip;

  const toggleSelCode = (code: string, on: boolean) => {
    const next = on ? [...selCodes, code] : selCodes.filter((c) => c !== code);
    setSelCodes(next);
    try { localStorage.setItem(PAYSLIP_CODES_KEY, JSON.stringify(next)); } catch { /* بی‌اهمیت */ }
  };

  const resetSelCodes = () => {
    setSelCodes([]);
    try { localStorage.setItem(PAYSLIP_CODES_KEY, JSON.stringify([])); } catch { /* بی‌اهمیت */ }
  };

  const saveManual = async (itemCode: string, value: string) => {
    if (!periodId || !slipPerson) return;
    setSavingManual(true);
    try {
      const num = Math.max(0, Math.round(parseIntOr(value, 0)));
      await apiPut('/api/payroll/manual', {
        periodId: Number(periodId), personnelId: slipPerson.personnelId, itemCode, amount: num,
      });
      toast.success('مبلغ دستی ذخیره شد — برای اعمال، دوره را بازمحاسبه کنید');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingManual(false);
    }
  };

  const toggleApprove = async (row: SummaryRow) => {
    if (!periodId) return;
    try {
      await apiPut('/api/payroll/approve', {
        periodId: Number(periodId), personnelId: row.personnelId, payApproved: !row.payApproved,
      });
      await loadSummary();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const payGroup = async () => {
    if (!periodId) return;
    const ids = [...bankSel];
    if (!ids.length) { toast.error('ابتدا افراد مورد نظر را تیک بزنید'); return; }
    try {
      const res = await apiPut<{ updated: number }>('/api/payroll/paid', {
        periodId: Number(periodId), ids, payPaid: true,
      });
      toast.success(`پرداخت ${toPersianDigits(res.updated)} نفر ثبت شد`);
      await loadSummary();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const changePeriodStatus = async (next: 'پیش‌نویس' | 'نهایی' | 'قفل‌شده', reason?: string) => {
    if (!periodId) return;
    const cur = period?.status ?? summary?.period.status ?? '';
    // فیکس ۱.۴.۳ — window.prompt در الکترون پشتیبانی نمی‌شود (خطا می‌دهد) و دکمه بازگشایی قفل کار نمی‌کرد؛
    // دلیل بازگشایی حالا از دیالوگ «دلیل بازگشایی قفل» گرفته می‌شود
    if (cur === 'قفل‌شده' && next !== 'قفل‌شده') {
      const r = (reason ?? '').trim();
      if (r.length < 5) {
        toast.error('ثبت دلیل با حداقل ۵ نویسه برای بازگشایی قفل دوره الزامی است');
        return;
      }
    }
    setStatusBusy(true);
    try {
      await apiPut('/api/payroll/status', {
        periodId: Number(periodId), status: next, ...(reason ? { reason } : {}),
      });
      toast.success(next === 'قفل‌شده' ? 'دوره قفل شد' : `وضعیت دوره به «${next}» تغییر کرد`);
      await Promise.all([refreshContext(), loadSummary()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  // بازکردن صفحه چاپ فیش در تب جدید
  const openPayslip = async (query: string) => {
    if (!periodId) { toast.error('ابتدا یک دوره انتخاب کنید'); return; }
    await openPrintWindow(`/api/exports/payslip?periodId=${encodeURIComponent(periodId)}${query}`, { filename: 'payslip.html' });
  };

  // گزاره ۵ — دیالوگ اقلام تکمیلی فیش (ذخیره به‌ازای سال مالی)
  const openSlipOptsDialog = async () => {
    setSlipOptsOpen(true);
    if (!fy?.id) { toast.error('ابتدا سال مالی را انتخاب کنید'); return; }
    try {
      const res = await apiGet<{ defs: Array<{ key: string; label: string }>; options: Record<string, boolean> }>(`/api/payslip-extras?fyId=${fy.id}`);
      if (res.options) setSlipOpts(res.options);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const toggleSlipOpt = (key: string, v: boolean) => setSlipOpts((prev) => ({ ...prev, [key]: v }));
  const saveSlipOpts = async () => {
    if (!fy?.id) return;
    setSlipOptsBusy(true);
    try {
      await apiPost('/api/payslip-extras', { fyId: fy.id, options: slipOpts });
      toast.success('اقلام تکمیلی فیش ذخیره شد — از این به بعد در چاپ فیش اعمال می‌شود');
      setSlipOptsOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSlipOptsBusy(false);
    }
  };

  // اقلام انتخابی فیش — در صورت انتخاب به همه دکمه‌های چاپ اضافه می‌شود
  const codesQ = selCodes.length ? `&codes=${encodeURIComponent(selCodes.join(','))}` : '';

  // چاپ فیش: شخص انتخابی A5 افقی / همه پرسنل A4 گروهی
  const printSlips = () => {
    if (printPersonId === 'all') openPayslip(`&paper=a4${codesQ}`);
    else openPayslip(`&personnelId=${encodeURIComponent(printPersonId)}&paper=a5l${codesQ}`);
  };

  // چاپ گروهی افراد انتخاب‌شده (تیک‌خورده لیست بانک) یا همه ردیف‌های فعلی — A4
  const printGroupA4 = () => {
    const ids = bankSel.size ? [...bankSel] : (summary?.rows ?? []).map((r) => r.personnelId);
    if (!ids.length) { toast.error('فردی برای چاپ فیش یافت نشد'); return; }
    openPayslip(`&ids=${encodeURIComponent(ids.join(','))}&paper=a4${codesQ}`);
  };

  // چاپ فیش همه پرسنل دوره — A4
  const printAllA4 = () => openPayslip(`&paper=a4${codesQ}`);

  const openItemsDialog = () => {
    setItemsOpen(true);
    if (!Object.keys(itemMap).length && periodId && summary?.rows.length) {
      setItemsLoading(true);
      apiGet<{ lines: LineRow[] }>(
        `/api/payroll/lines?periodId=${periodId}&personnelId=${summary.rows[0].personnelId}`)
        .then((d) => mergeItems(d.lines))
        .catch((e) => toast.error((e as Error).message))
        .finally(() => setItemsLoading(false));
    }
  };

  const bankRows = useMemo(() => {
    if (!summary) return [];
    return summary.rows.filter((r) => (onlyApproved ? r.payApproved : true));
  }, [summary, onlyApproved]);

  // سلول‌های جدول خلاصه با کلیک، فیش را باز می‌کنند (معادل کلیک روی سطر در جدول قبلی)
  const withSlipClick = (r: SummaryRow, node: ReactNode) => (
    <span className="cursor-pointer" onClick={() => openSlip(r)}>{node}</span>
  );

  // قابلیت ۱٫۴٫۵ — مراحل محاسبه هر پرسنل
  const [trace, setTrace] = useState<{
    name: string; inputs: Record<string, string>; traces: Record<string, TraceRowData>;
  } | null>(null);
  const [traceBusy, setTraceBusy] = useState<string>('');
  const loadTrace = async (r: SummaryRow) => {
    setTraceBusy(String(r.personnelId));
    try {
      const res = await apiGet<{ inputs: Record<string, string>; traces: Record<string, TraceRowData> }>(
        `/api/payroll/trace?periodId=${periodId}&personnelId=${r.personnelId}`);
      setTrace({ name: `${r.personnel.firstName} ${r.personnel.lastName}`, inputs: res.inputs, traces: res.traces });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTraceBusy('');
    }
  };

  // ستون‌های جدول خلاصه پرسنل — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const summaryCols: DtColumn<SummaryRow>[] = useMemo(() => {
    const moneyCol = (
      key: 'gross' | 'insuredBase' | 'workerIns' | 'taxBase' | 'tax' | 'totalDeductions' | 'prevBalance' | 'netPay',
      header: string,
      bold = false,
    ): DtColumn<SummaryRow> => ({
      key,
      header,
      align: 'left',
      className: bold ? 'num whitespace-nowrap font-bold' : 'num whitespace-nowrap',
      sortValue: (r) => r[key],
      cell: (r) => withSlipClick(r, <Fa money>{r[key]}</Fa>),
    });
    return [
      {
        key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
        cell: (r, i) => withSlipClick(r, <Fa>{i + 1}</Fa>),
      },
      {
        key: 'code', header: 'کد', className: 'num',
        sortValue: (r) => Number(normalizeDigits(String(r.personnel.personnelCode))) || 0,
        filterValue: (r) => r.personnel.personnelCode,
        cell: (r) => withSlipClick(r, <Fa>{r.personnel.personnelCode}</Fa>),
      },
      {
        key: 'name', header: 'نام و نام خانوادگی', className: 'font-medium whitespace-nowrap',
        sortValue: (r) => `${r.personnel.firstName} ${r.personnel.lastName}`.trim(),
        filterValue: (r) => `${r.personnel.firstName} ${r.personnel.lastName}`.trim(),
        cell: (r) => withSlipClick(r, <>{r.personnel.firstName} {r.personnel.lastName}</>),
      },
      {
        key: 'workedDays', header: 'کارکرد', align: 'center', className: 'num',
        sortValue: (r) => r.workedDays,
        cell: (r) => withSlipClick(r, <Fa>{r.workedDays}</Fa>),
      },
      {
        key: 'overtime', header: 'اضافه‌کار', align: 'center', className: 'num whitespace-nowrap',
        sortValue: (r) => r.overtimeMin,
        cell: (r) => withSlipClick(r, toPersianDigits(minutesToHHMM(r.overtimeMin))),
      },
      moneyCol('gross', 'درآمد'),
      moneyCol('insuredBase', 'مشمول بیمه'),
      moneyCol('workerIns', 'بیمه ۷٪'),
      moneyCol('taxBase', 'مشمول مالیات'),
      moneyCol('tax', 'مالیات'),
      moneyCol('totalDeductions', 'کسورات'),
      moneyCol('prevBalance', 'مانده قبلی'),
      moneyCol('netPay', 'خالص قابل پرداخت', true),
      {
        key: 'calcTrace', header: 'جزئیات محاسبه', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-20',
        cell: (r) => (
          <button
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
            title="نمایش مراحل محاسبه این پرسنل"
            onClick={() => loadTrace(r)}>
            <Info size={13} /> {traceBusy === String(r.personnelId) ? '…' : 'محاسبه'}
          </button>
        ),
      },
      {
        key: 'pay', header: 'پرداخت', align: 'center',
        sortValue: (r) => (r.payPaid ? 1 : 0),
        filterValue: (r) => (r.payPaid ? 'پرداخت شده' : 'در انتظار'),
        cell: (r) => withSlipClick(r, r.payPaid
          ? <Badge className="bg-success/10 text-success border-0">پرداخت شده</Badge>
          : <Badge variant="outline">در انتظار</Badge>),
      },
    ];
  }, [openSlip, loadTrace, traceBusy]);

  // ستون‌های جدول لیست بانک
  const bankCols: DtColumn<SummaryRow>[] = useMemo(() => [
    {
      key: 'sel', header: '', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-10',
      cell: (r) => (
        <Checkbox
          checked={bankSel.has(r.personnelId)}
          onCheckedChange={(v) => {
            const s = new Set(bankSel);
            if (v) s.add(r.personnelId); else s.delete(r.personnelId);
            setBankSel(s);
          }}
          aria-label={`انتخاب ${r.personnel.firstName} ${r.personnel.lastName}`}
        />
      ),
    },
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'code', header: 'کد پرسنلی', className: 'num',
      sortValue: (r) => Number(normalizeDigits(String(r.personnel.personnelCode))) || 0,
      filterValue: (r) => r.personnel.personnelCode,
      cell: (r) => <Fa>{r.personnel.personnelCode}</Fa>,
    },
    {
      key: 'name', header: 'نام و نام خانوادگی', className: 'font-medium whitespace-nowrap',
      sortValue: (r) => `${r.personnel.firstName} ${r.personnel.lastName}`.trim(),
      cell: (r) => `${r.personnel.firstName} ${r.personnel.lastName}`.trim(),
    },
    {
      key: 'nationalId', header: 'کد ملی', className: 'num',
      sortValue: (r) => r.personnel.nationalId || '',
      cell: (r) => <Fa>{r.personnel.nationalId || '—'}</Fa>,
    },
    {
      key: 'bankAccount', header: 'شماره حساب', className: 'num',
      sortValue: (r) => r.personnel.bankAccount || '',
      cell: (r) => <Fa>{r.personnel.bankAccount || '—'}</Fa>,
    },
    {
      key: 'bankName', header: 'بانک',
      sortValue: (r) => r.personnel.bankName || '',
      cell: (r) => r.personnel.bankName || '—',
    },
    {
      key: 'prevBalance', header: 'مانده قبلی', align: 'left', className: 'num whitespace-nowrap',
      sortValue: (r) => r.prevBalance, cell: (r) => <Fa money>{r.prevBalance}</Fa>,
    },
    {
      key: 'netPay', header: 'خالص', align: 'left', className: 'num whitespace-nowrap',
      sortValue: (r) => r.netPay, cell: (r) => <Fa money>{r.netPay}</Fa>,
    },
    {
      key: 'payable', header: 'جمع قابل پرداخت', align: 'left', className: 'num whitespace-nowrap font-bold',
      sortValue: (r) => r.netPay + r.prevBalance,
      filterValue: (r) => r.netPay + r.prevBalance,
      cell: (r) => <Fa money>{r.netPay + r.prevBalance}</Fa>,
    },
    {
      key: 'approve', header: 'تایید', align: 'center',
      sortValue: (r) => (r.payApproved ? 1 : 0),
      filterValue: (r) => (r.payApproved ? 'تایید شده' : 'تایید نشده'),
      cell: (r) => (
        <Checkbox checked={r.payApproved} onCheckedChange={() => toggleApprove(r)} aria-label="تایید پرداخت" />
      ),
    },
    {
      key: 'paid', header: 'پرداخت', align: 'center',
      sortValue: (r) => (r.payPaid ? 1 : 0),
      filterValue: (r) => (r.payPaid ? 'پرداخت شده' : 'در انتظار'),
      cell: (r) => (r.payPaid
        ? <Badge className="bg-success/10 text-success border-0">پرداخت شده</Badge>
        : <Badge variant="outline">در انتظار</Badge>),
    },
  ], [bankSel, periodId]);

  // ستون‌های جدول ریز فیش (دیالوگ)
  const slipCols: DtColumn<LineRow>[] = useMemo(() => [
    {
      key: 'title', header: 'شرح قلم',
      sortValue: (l) => l.title, cell: (l) => l.title,
    },
    {
      key: 'kind', header: 'گروه', align: 'center',
      sortValue: (l) => l.kind,
      filterValue: (l) => (l.kind === 'earning' ? 'درآمد' : l.kind === 'deduction' ? 'کسر' : 'کارفرما'),
      cell: (l) => (l.kind === 'earning' ? (
        <Badge variant="outline" className="text-success border-success/30">درآمد</Badge>
      ) : l.kind === 'deduction' ? (
        <Badge variant="outline" className="text-destructive border-destructive/30">کسر</Badge>
      ) : (
        <Badge variant="outline">کارفرما</Badge>
      )),
    },
    {
      key: 'amount', header: 'مبلغ (ریال)', align: 'left', className: 'num',
      sortValue: (l) => l.amount, cell: (l) => <Fa money>{l.amount}</Fa>,
    },
  ], []);

  // ترتیب اقلام ریز فیش: درآمد، کسر، کارفرما (مانند جدول قبلی)
  const slipRows = useMemo(() => [
    ...slipLines.filter((l) => l.kind === 'earning'),
    ...slipLines.filter((l) => l.kind === 'deduction'),
    ...slipLines.filter((l) => l.kind === 'employer'),
  ], [slipLines]);

  if (!company || !fy) {
    return (
      <div>
        <PageHeader title="حقوق و دستمزد" icon={<Calculator size={20} />} />
        <Card><EmptyState title="ابتدا شرکت و سال مالی را ثبت کنید" /></Card>
      </div>
    );
  }

  const t = summary?.totals;

  return (
    <div>
      <PageHeader
        title="حقوق و دستمزد"
        subtitle={`${company.name} — سال مالی ${toPersianDigits(fy.jy)}`}
        icon={<Calculator size={20} />}
        actions={
          <>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="انتخاب دوره" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {MONTH_NAMES[p.jm - 1]} {toPersianDigits(p.jy)} — {p.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1 h-9" onClick={() => setNewOpen(true)}>
              <Plus size={14} /> دوره جدید
            </Button>
            <Button size="sm" className="gap-1.5 h-9 px-4" onClick={doCalculate} disabled={!periodId || calculating}>
              <Play size={15} className={calculating ? 'animate-pulse' : ''} />
              {calculating ? 'در حال محاسبه…' : 'محاسبه دوره'}
            </Button>
            {period && <PeriodStatusBadge status={period.status} />}
            {period?.status !== 'قفل‌شده' && (
              <Button variant="outline" size="sm" className="gap-1 h-9" disabled={statusBusy}
                onClick={() => changePeriodStatus(period?.status === 'نهایی' ? 'پیش‌نویس' : 'نهایی')}>
                <CheckCircle2 size={14} />
                {period?.status === 'نهایی' ? 'بازگشت به پیش‌نویس' : 'نهایی کردن دوره'}
              </Button>
            )}
            {period && period.status !== 'قفل‌شده' && (
              <Button variant="outline" size="sm" className="gap-1 h-9" disabled={statusBusy}
                onClick={() => changePeriodStatus('قفل‌شده')}>
                <Lock size={14} /> قفل کردن دوره
              </Button>
            )}
            {period && period.status === 'قفل‌شده' && (
              <Button variant="outline" size="sm" className="gap-1 h-9" disabled={statusBusy}
                onClick={() => setUnlockOpen(true)}>
                <LockOpen size={14} /> بازگشایی قفل
              </Button>
            )}
          </>
        }
      />

      {!periodId ? (
        <Card>
          <EmptyState
            title="دوره‌ای انتخاب نشده است"
            hint="با دکمه «دوره جدید» یک ماه برای حقوق ایجاد کنید یا از فهرست بالا دوره موجود را انتخاب کنید"
            icon={<Calculator size={28} />}
          />
        </Card>
      ) : loadingSummary && !summary ? (
        <Card><LoadingBlock /></Card>
      ) : !summary || !summary.rows.length ? (
        <Card>
          <EmptyState
            title="این دوره هنوز محاسبه نشده است"
            hint="با دکمه «محاسبه دوره» حقوق همه پرسنل شاغل بر اساس حکم، حضور و تنظیمات سال محاسبه می‌شود"
            icon={<Calculator size={28} />}
          />
        </Card>
      ) : (
        <Tabs defaultValue="summary" dir="rtl">
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-4">
            <TabsTrigger value="summary">خلاصه پرسنل</TabsTrigger>
            <TabsTrigger value="bank">لیست بانک</TabsTrigger>
            <TabsTrigger value="payslip">فیش حقوقی</TabsTrigger>
          </TabsList>

          {/* تب خلاصه */}
          <TabsContent value="summary" className="mt-0 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard title="جمع خالص + مانده قبلی" value={money(t!.netPay + t!.prevBalance)} hint="ریال" icon={<Banknote size={18} />} tone="positive" />
              <StatCard title="جمع درآمد" value={money(t!.gross)} hint="ریال" icon={<Receipt size={18} />} />
              <StatCard title="جمع بیمه کارگر" value={money(t!.workerIns)} hint="ریال" icon={<CheckCircle2 size={18} />} tone="warning" />
              <StatCard title="جمع مالیات" value={money(t!.tax)} hint="ریال" icon={<Calculator size={18} />} tone="destructive" />
              <StatCard title="تعداد پرسنل" value={toPersianDigits(String(t!.count))} icon={<Receipt size={18} />} tone="gold" />
            </div>
            <Card className="shadow-luxe border-border/70">
              <DataTable
                id="payroll-summary"
                columns={summaryCols}
                rows={summary.rows}
                rowKey={(r) => r.personnelId}
                containerClassName="max-h-[56vh]"
                defaultSort={{ key: 'code', dir: 'asc' }}
                footer={(
                  <TableRow className="bg-muted/40 font-bold">
                    <TableCell colSpan={5} className="text-center">جمع کل</TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.gross}</Fa></TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.insuredBase}</Fa></TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.workerIns}</Fa></TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.taxBase}</Fa></TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.tax}</Fa></TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.totalDeductions}</Fa></TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.prevBalance}</Fa></TableCell>
                    <TableCell className="text-left num whitespace-nowrap"><Fa money>{t!.netPay}</Fa></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              />
            </Card>
          </TabsContent>

          {/* تب لیست بانک */}
          <TabsContent value="bank" className="mt-0 space-y-4">
            <Card className="shadow-luxe border-border/70">
              <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Switch id="onlyapp" checked={onlyApproved} onCheckedChange={setOnlyApproved} />
                  <Label htmlFor="onlyapp" className="text-[12.5px] cursor-pointer">فقط تاییدشده‌ها</Label>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 mr-auto"
                  onClick={() => downloadFile(`/api/exports/bank?periodId=${periodId}`, 'bank-list.xlsx')}>
                  <FileSpreadsheet size={14} /> خروجی اکسل لیست بانک
                </Button>
                <Button size="sm" className="gap-1.5 h-8" onClick={payGroup} disabled={!bankSel.size}>
                  <Banknote size={14} /> ثبت پرداخت گروهی ({toPersianDigits(String(bankSel.size))} نفر)
                </Button>
              </div>
              <DataTable
                id="payroll-bank"
                columns={bankCols}
                rows={bankRows}
                rowKey={(r) => r.personnelId}
                containerClassName="max-h-[56vh]"
                defaultSort={{ key: 'code', dir: 'asc' }}
                empty={<div className="py-8 text-center text-[13px] text-muted-foreground">ردیفی یافت نشد</div>}
              />
            </Card>
          </TabsContent>

          {/* تب فیش حقوقی */}
          <TabsContent value="payslip" className="mt-0">
            <Card className="shadow-luxe border-border/70 p-6">
              <div className="flex flex-wrap items-end gap-4 max-w-xl">
                <div className="space-y-1.5 flex-1 min-w-52">
                  <Label className="text-[12.5px]">پرسنل</Label>
                  <Select value={printPersonId} onValueChange={setPrintPersonId}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه پرسنل</SelectItem>
                      {summary.rows.map((r) => (
                        <SelectItem key={r.personnelId} value={String(r.personnelId)}>
                          {r.personnel.firstName} {r.personnel.lastName} — {toPersianDigits(r.personnel.personnelCode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="gap-1.5" onClick={printSlips}>
                  <Printer size={15} /> چاپ فیش (A5)
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={printGroupA4}>
                  <Printer size={15} /> چاپ فیش ۲نفره (A4)
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={printAllA4}>
                  <Printer size={15} /> چاپ فیش همه (A4)
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={openItemsDialog}>
                  <ListChecks size={15} /> انتخاب اقلام فیش
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={openSlipOptsDialog}>
                  <ListChecks size={15} /> اقلام تکمیلی فیش
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground mt-4 leading-relaxed">
                فیش در پنجره جدید باز می‌شود؛ از دکمه چاپ مرورگر می‌توانید آن را چاپ یا با «ذخیره به‌صورت PDF» خروجی بگیرید.
                اقلام صفر در فیش نمایش داده نمی‌شوند.
                {' '}{selCodes.length
                  ? `اقلام انتخابی چاپ: ${toPersianDigits(String(selCodes.length))} قلم`
                  : 'همه اقلام در فیش چاپ می‌شوند.'}
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* دیالوگ دوره جدید */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ایجاد دوره حقوق جدید</DialogTitle>
            <DialogDescription>ماه دوره را در سال مالی {toPersianDigits(fy.jy)} انتخاب کنید.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">ماه</Label>
            <Select value={newMonth} onValueChange={setNewMonth}>
              <SelectTrigger className="w-full"><SelectValue placeholder="انتخاب ماه" /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>انصراف</Button>
            <Button onClick={createPeriod} disabled={creating || !newMonth}>
              {creating ? 'در حال ایجاد…' : 'ایجاد دوره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ اقلام تکمیلی فیش — گزاره ۵ نسخه ۱٫۲٫۰ */}
      <Dialog open={slipOptsOpen} onOpenChange={setSlipOptsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>اقلام تکمیلی فیش حقوقی</DialogTitle>
            <DialogDescription>
              انتخاب کنید کدام اطلاعات تکمیلی کارکرد در فیش چاپ شود (روزهای ماه، کسر کار، شیفت‌ها، عیدی و سنوات سال و...). تنظیمات برای سال مالی فعلی ذخیره می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-80 overflow-y-auto">
            {PAYSLIP_OPTION_DEFS.map((o) => (
              <label key={o.key} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-[12.5px] cursor-pointer hover:bg-muted/40">
                <Checkbox checked={slipOpts[o.key] !== false} onCheckedChange={(v) => toggleSlipOpt(o.key, !!v)} aria-label={o.label} />
                <span className="whitespace-nowrap">{o.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlipOpts(defaultPayslipOptions())}>همه موارد</Button>
            <Button onClick={saveSlipOpts} disabled={slipOptsBusy}>{slipOptsBusy ? 'در حال ذخیره…' : 'ذخیره'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ هشدار پرسنل بدون حکم */}
      <Dialog open={!!calcWarn} onOpenChange={(o) => !o && setCalcWarn(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" /> پرسنل بدون حکم حقوقی
            </DialogTitle>
            <DialogDescription>
              برای پرسنل زیر حکم حقوقی ثبت نشده است و اقلام حکمی‌شان صفر محاسبه شد:
            </DialogDescription>
          </DialogHeader>
          <ul className="text-[13px] space-y-1.5 max-h-60 overflow-y-auto list-disc pr-5">
            {calcWarn?.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <DialogFooter>
            <Button onClick={() => setCalcWarn(null)}>متوجه شدم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ انتخاب اقلام فیش */}
      <Dialog open={itemsOpen} onOpenChange={setItemsOpen}>
        <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>انتخاب اقلام فیش</DialogTitle>
            <DialogDescription>
              اقلام انتخاب‌شده در فیش چاپ می‌شوند؛ بدون انتخاب، همه اقلام چاپ می‌شود.
            </DialogDescription>
          </DialogHeader>
          {itemsLoading ? (
            <LoadingBlock />
          ) : !Object.keys(itemMap).length ? (
            <EmptyState title="قلمی برای انتخاب یافت نشد" hint="ابتدا دوره را محاسبه کنید" />
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {Object.entries(itemMap).map(([code, title]) => (
                <label key={code} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-[13px] cursor-pointer hover:bg-muted/40">
                  <Checkbox
                    checked={selCodes.includes(code)}
                    onCheckedChange={(v) => toggleSelCode(code, !!v)}
                    aria-label={title}
                  />
                  <span className="whitespace-nowrap">{title}</span>
                  <span className="mr-auto text-[11px] text-muted-foreground num">{code}</span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={resetSelCodes}>همه اقلام</Button>
            <Button onClick={() => setItemsOpen(false)}>تایید</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ ریز فیش */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ریز فیش — {slipPerson?.personnel.firstName} {slipPerson?.personnel.lastName}</DialogTitle>
            <DialogDescription>اقلام محاسبه‌شده دوره. مقادیر دستی پس از بازمحاسبه دوره اعمال می‌شوند.</DialogDescription>
          </DialogHeader>
          <DataTable
            id="payroll-slip"
            columns={slipCols}
            rows={slipRows}
            rowKey={(l) => l.itemCode}
            containerClassName="max-h-80"
          />
          {/* ورود دستی اقلام */}
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">سایر مزایا (بدون بیمه و مالیات)</Label>
              <div className="flex gap-2">
                <Input className="num" value={manualTaxFree}
                  onChange={(e) => setManualTaxFree(e.target.value)}
                  onBlur={() => saveManual('tax_free_other', manualTaxFree)}
                  placeholder="مبلغ به ریال" />
                <Button size="sm" variant="outline" disabled={savingManual}
                  onClick={() => saveManual('tax_free_other', manualTaxFree)}>ذخیره</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">سایر کسورات</Label>
              <div className="flex gap-2">
                <Input className="num" value={manualOtherDeduct}
                  onChange={(e) => setManualOtherDeduct(e.target.value)}
                  onBlur={() => saveManual('other_deduct', manualOtherDeduct)}
                  placeholder="مبلغ به ریال" />
                <Button size="sm" variant="outline" disabled={savingManual}
                  onClick={() => saveManual('other_deduct', manualOtherDeduct)}>ذخیره</Button>
              </div>
            </div>
          </div>
          <DialogFooter className="items-center">
            <Button variant="outline" onClick={() => setSlipOpen(false)}>بستن</Button>
            <Button className="gap-1.5" onClick={doCalculate} disabled={calculating}>
              <Play size={14} /> {calculating ? 'در حال محاسبه…' : 'بازمحاسبه این دوره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* فیکس ۱.۴.۳ — دیالوگ دلیل بازگشایی قفل دوره (جایگزین window.prompt که در الکترون خطا می‌داد) */}
      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>دلیل بازگشایی قفل دوره</DialogTitle>
            <DialogDescription>
              دوره در وضعیت «قفل‌شده» است. برای ثبت بازگشایی قفل، دلیل خود را وارد کنید (حداقل ۵ نویسه).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>دلیل بازگشایی</Label>
            <Textarea
              rows={3}
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="مثال: اصلاح حضور و غیاب فروردین به درخواست مدیر" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>انصراف</Button>
            <Button
              disabled={unlockReason.trim().length < 5 || statusBusy}
              onClick={async () => {
                await changePeriodStatus('پیش‌نویس', unlockReason.trim());
                setUnlockOpen(false);
                setUnlockReason('');
              }}>
              <LockOpen size={14} /> بازگشایی قفل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ مراحل محاسبه — قابلیت ۱٫۴٫۵ */}
      <Dialog open={!!trace} onOpenChange={(o) => !o && setTrace(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base">مراحل محاسبه حقوق — {trace?.name}</DialogTitle>
            <DialogDescription>روی هر قلم در جدول زیر، فرمول و مراحل محاسبه آن نمایش داده می‌شود.</DialogDescription>
          </DialogHeader>
          {trace?.inputs && (
            <div className="text-[11px] text-muted-foreground bg-muted/50 border rounded p-2 leading-relaxed">
              {Object.entries(trace.inputs).map(([k, v]) => <span key={k} className="inline-block mr-3"><b>{k}:</b> {v}</span>)}
            </div>
          )}
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-muted text-xs"><th className="border p-2 text-right">قلم</th><th className="border p-2 text-right">فرمول</th></tr></thead>
            <tbody>
              {trace && Object.entries(trace.traces).map(([code, tr]) => (
                <TraceRow key={code} code={code} tr={tr as TraceRowData} />
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TraceRowData { formula: string; steps: Array<{ label: string; value: string }>; basis?: string }

/** عنوان فارسی اقلام پیش‌فرض — برای دیالوگ مراحل محاسبه */
const ITEM_TITLE_FA: Record<string, string> = {
  base_wage: 'حقوق (مزد شغل)', seniority: 'مزد سنوات', housing: 'حق مسکن', food: 'خواروبار',
  child_allow: 'حق اولاد', worker_ben: 'بن کارگری', overtime: 'اضافه‌کاری', holiday_work: 'تعطیل‌کاری',
  friday_work: 'جمعه‌کاری', night_work: 'شب‌کاری', shift_allow: 'حق شیفت', attraction: 'حق جذب',
  family_allow: 'حق عائله‌مندی', adjustment: 'تفاوت تطبیق', supervision: 'حق سرپرستی',
  labor_market: 'فوق‌العاده بازار کار', education_aid: 'کمک‌هزینه تحصیلی', fixed_ot: 'اضافه‌کار ثابت',
  other_ben: 'سایر مزایا (با بیمه و مالیات)', tax_free_other: 'سایر مزایا (بدون بیمه و مالیات)',
  ob_ins: 'مانده‌های اولیه (مشمول)', ob_free: 'مانده‌های اولیه (بدون بیمه)',
  worker_ins: 'بیمه سهم کارگر (۷٪)', tax: 'مالیات حقوق', loan_install: 'قسط وام', advance: 'مساعده',
  other_deduct: 'سایر کسورات', ob_deduct: 'کسور مانده‌های اولیه',
  employer_ins: 'بیمه سهم کارفرما (۲۰٪)', unemployment: 'بیمه بیکاری (۳٪)',
};

function TraceRow({ code, tr }: { code: string; tr: TraceRowData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="hover:bg-muted/50">
        <td className="border p-2 font-medium">
          <button className="underline decoration-dotted underline-offset-4 cursor-pointer" onClick={() => setOpen(!open)}>
            <Fa>{ITEM_TITLE_FA[code] ?? code}</Fa>
          </button>
        </td>
        <td className="border p-2 text-xs text-muted-foreground"><Fa>{tr.formula}</Fa></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={2} className="border bg-muted/30 p-0">
            <table className="w-full text-xs border-collapse">
              <tbody>
                {tr.steps.map((s, i) => (
                  <tr key={i}><td className="border p-1.5" style={{ width: '60%' }}>{s.label}</td><td className="border p-1.5 text-left font-mono"><Fa>{s.value}</Fa></td></tr>
                ))}
              </tbody>
            </table>
            {tr.basis && <p className="p-2 text-[10px] text-muted-foreground">مبنای قانونی: {tr.basis}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
