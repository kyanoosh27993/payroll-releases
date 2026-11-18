// گزارش‌ساز — گزارش‌های داخلی آماده (سرور) — Prisma امن بدون SQL خام
import { db } from '@/lib/db';
import {
  formatMoney, minutesToHHMM, toPersianDigits, parseIntOr, cleanText,
} from './numbers';
import { MONTH_NAMES } from './jalali';

export interface BuiltinResult {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  moneyCols: number[];
  totals: Array<string | number> | null;
  count: number;
}

type Params = {
  periodId?: number;
  jy?: number;
  jm?: number;
  personnelId?: number | null;
  companyId: number;
};

function fmtDate(jy: number, jm: number, jd: number): string {
  return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
}

export const BUILTIN_REPORTS = [
  { type: 'payroll_summary', title: 'خلاصه حقوق پرسنل', params: 'دوره حقوق' },
  { type: 'attendance_daily', title: 'حضور روزانه پرسنل', params: 'ماه + پرسنل (اختیاری)' },
  { type: 'leave_stats', title: 'آمار مرخصی', params: 'سال مالی + پرسنل (اختیاری)' },
  { type: 'loans', title: 'لیست وام‌ها', params: 'شرکت' },
  { type: 'loan_balance', title: 'مانده وام و مساعده', params: 'شرکت' },
] as const;

export function reportTitle(type: string): string {
  return BUILTIN_REPORTS.find((r) => r.type === type)?.title ?? 'گزارش';
}

// ---------------- گزارش‌های داخلی ----------------
export async function runBuiltinReport(type: string, params: Params): Promise<BuiltinResult> {
  switch (type) {
    case 'payroll_summary': return reportPayrollSummary(params);
    case 'attendance_daily': return reportAttendanceDaily(params);
    case 'leave_stats': return reportLeaveStats(params);
    case 'loans': return reportLoans(params);
    case 'loan_balance': return reportLoanBalance(params);
    default: throw new Error('نوع گزارش نامعتبر است');
  }
}

// ۱) خلاصه حقوق پرسنل — بر اساس دوره
async function reportPayrollSummary(p: Params): Promise<BuiltinResult> {
  const periodId = parseIntOr(p.periodId, 0);
  if (!periodId) throw new Error('دوره حقوق را انتخاب کنید');
  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { summaries: { include: { personnel: true } }, fiscalYear: true },
  });
  if (!period) throw new Error('دوره یافت نشد');
  const subs = period.summaries.filter((s) =>
    !p.personnelId || s.personnelId === p.personnelId);
  subs.sort((a, b) => a.personnel.personnelCode.localeCompare(b.personnel.personnelCode, 'fa'));
  const headers = ['ردیف', 'کد پرسنلی', 'نام و نام خانوادگی', 'کارکرد (روز)', 'اضافه‌کاری',
    'جمع درآمد', 'مشمول بیمه', 'بیمه ۷٪', 'مشمول مالیات', 'مالیات', 'کسورات', 'خالص'];
  const moneyCols = [5, 6, 7, 8, 9, 10, 11];
  const rows: Array<Array<string | number>> = subs.map((s, i) => [
    toPersianDigits(String(i + 1)),
    toPersianDigits(s.personnel.personnelCode),
    `${s.personnel.firstName} ${s.personnel.lastName}`.trim(),
    s.workedDays, toPersianDigits(minutesToHHMM(s.overtimeMin)),
    s.gross, s.insuredBase, s.workerIns, s.taxBase, s.tax, s.totalDeductions, s.netPay,
  ]);
  const totals: Array<string | number> = ['جمع کل', '', '', '', ''];
  for (const c of moneyCols) {
    totals.push(subs.reduce((a, s) => a + (s[['gross', 'insuredBase', 'workerIns', 'taxBase', 'tax', 'totalDeductions', 'netPay'][c - 5] as keyof typeof s] as number ?? 0), 0));
  }
  return {
    title: 'خلاصه حقوق پرسنل',
    subtitle: `${MONTH_NAMES[period.jm - 1]} ${toPersianDigits(period.jy)} — ${period.status}`,
    headers, rows, moneyCols, totals, count: rows.length,
  };
}

// ۲) حضور روزانه پرسنل — بر اساس ماه + پرسنل اختیاری
async function reportAttendanceDaily(p: Params): Promise<BuiltinResult> {
  const jm = parseIntOr(p.jm, 0);
  const jy = parseIntOr(p.jy, 0);
  const month = await db.attendanceMonth.findFirst({
    where: { ...(jy ? { jy } : {}), ...(jm ? { jm } : {}) },
    orderBy: [{ jy: 'desc' }, { jm: 'desc' }, { id: 'desc' }],
    include: { fiscalYear: { include: { company: true } } },
  });
  if (!month) throw new Error('ماه حضور و غیابی یافت نشد — ابتدا فایل دستگاه را ایمپورت کنید');
  const dailies = await db.attendanceDaily.findMany({
    where: {
      monthId: month.id,
      ...(p.personnelId ? { personnelId: p.personnelId } : {}),
    },
    include: { personnel: true },
    orderBy: [{ personnelId: 'asc' }, { day: 'asc' }],
  });
  const headers = ['ردیف', 'تاریخ', 'کد', 'نام و نام خانوادگی', 'وضعیت',
    'ورود', 'خروج', 'تاخیر', 'تعجیل', 'اضافه‌کاری', 'کارکرد'];
  const rows = dailies.map((d, i) => [
    toPersianDigits(String(i + 1)),
    fmtDate(month.jy, month.jm, d.day),
    toPersianDigits(d.personnel.personnelCode),
    `${d.personnel.firstName} ${d.personnel.lastName}`.trim(),
    d.status,
    d.entry1 >= 0 ? toPersianDigits(minutesToHHMM(d.entry1)) : '—',
    d.exit1 >= 0 ? toPersianDigits(minutesToHHMM(d.exit1)) : '—',
    toPersianDigits(minutesToHHMM(d.lateMin)),
    toPersianDigits(minutesToHHMM(d.earlyMin)),
    toPersianDigits(minutesToHHMM(d.overtimeMin)),
    toPersianDigits(minutesToHHMM(d.workedMin)),
  ]);
  const totals: Array<string | number> = ['جمع', '', '', '', `${toPersianDigits(String(rows.length))} رکورد`, '', '', '', '', '', ''];
  return {
    title: 'حضور روزانه پرسنل',
    subtitle: `${MONTH_NAMES[month.jm - 1]} ${toPersianDigits(month.jy)} — منبع: ${month.source}`,
    headers, rows, moneyCols: [], totals, count: rows.length,
  };
}

// ۳) آمار مرخصی — رکوردهای Leave به تفکیک پرسنل و نوع
async function reportLeaveStats(p: Params): Promise<BuiltinResult> {
  const leaves = await db.leave.findMany({
    where: {
      personnel: { companyId: p.companyId },
      ...(p.personnelId ? { personnelId: p.personnelId } : {}),
    },
    include: { personnel: true },
    orderBy: [{ personnelId: 'asc' }, { fromDate: 'asc' }],
  });
  // تجمیع به تفکیک پرسنل و نوع
  const map = new Map<string, { name: string; code: string; kind: string; days: number; count: number }>();
  for (const l of leaves) {
    const key = `${l.personnelId}|${l.leaveKind}`;
    const cur = map.get(key) ?? {
      name: `${l.personnel.firstName} ${l.personnel.lastName}`.trim(),
      code: l.personnel.personnelCode, kind: l.leaveKind, days: 0, count: 0,
    };
    cur.days += l.days;
    cur.count += 1;
    map.set(key, cur);
  }
  const headers = ['ردیف', 'کد پرسنلی', 'نام و نام خانوادگی', 'نوع مرخصی', 'تعداد دفعات', 'جمع روز'];
  const rows = [...map.values()].sort((a, b) => a.code.localeCompare(b.code, 'fa')).map((r, i) => [
    toPersianDigits(String(i + 1)),
    toPersianDigits(r.code), r.name, r.kind,
    toPersianDigits(String(r.count)), r.days,
  ]);
  const totalDays = rows.reduce((a, r) => a + Number(r[5] ?? 0), 0);
  const totalCount = rows.reduce((a, r) => a + Number(r[4] ?? 0), 0);
  const totals: Array<string | number> = ['جمع کل', '', '', '', totalCount, totalDays];
  return {
    title: 'آمار مرخصی پرسنل',
    subtitle: leaves.length ? `${toPersianDigits(String(leaves.length))} رکورد مرخصی ثبت‌شده` : 'بدون رکورد',
    headers, rows, moneyCols: [5], totals, count: rows.length,
  };
}

// ۴) لیست وام‌ها
async function reportLoans(p: Params): Promise<BuiltinResult> {
  const loans = await db.loan.findMany({
    where: {
      personnel: { companyId: p.companyId },
      ...(p.personnelId ? { personnelId: p.personnelId } : {}),
    },
    include: { personnel: true },
    orderBy: { id: 'asc' },
  });
  const headers = ['ردیف', 'کد پرسنلی', 'نام و نام خانوادگی', 'عنوان', 'مبلغ کل',
    'قسط ماهانه', 'تعداد اقساط', 'پرداخت‌شده', 'مانده', 'وضعیت'];
  const moneyCols = [4, 5, 8];
  const rows = loans.map((l, i) => [
    toPersianDigits(String(i + 1)),
    toPersianDigits(l.personnel.personnelCode),
    `${l.personnel.firstName} ${l.personnel.lastName}`.trim(),
    cleanText(l.title) || 'وام',
    l.totalAmount, l.installment,
    toPersianDigits(String(l.installmentsCount)),
    toPersianDigits(String(l.paidCount)),
    l.remaining,
    l.active ? 'فعال' : 'تسویه',
  ]);
  const totals: Array<string | number> = ['جمع کل', '', '', '', '', '', '', '', '', ''];
  for (const c of moneyCols) {
    totals[c] = rows.reduce((a, r) => a + Number(r[c] ?? 0), 0);
  }
  return {
    title: 'لیست وام‌های پرسنل',
    subtitle: loans.length ? `${toPersianDigits(String(loans.length))} وام` : 'وامی ثبت نشده است',
    headers, rows, moneyCols, totals, count: rows.length,
  };
}

// ۵) مانده وام و مساعده
async function reportLoanBalance(p: Params): Promise<BuiltinResult> {
  const [loans, advances] = await Promise.all([
    db.loan.findMany({
      where: {
        personnel: { companyId: p.companyId }, active: true,
        ...(p.personnelId ? { personnelId: p.personnelId } : {}),
      },
      include: { personnel: true },
    }),
    db.advance.findMany({
      where: {
        personnel: { companyId: p.companyId }, recovered: false,
        ...(p.personnelId ? { personnelId: p.personnelId } : {}),
      },
      include: { personnel: true },
    }),
  ]);
  interface Row { name: string; code: string; loanRem: number; advRem: number }
  const map = new Map<number, Row>();
  for (const l of loans) {
    const cur = map.get(l.personnelId) ?? {
      name: `${l.personnel.firstName} ${l.personnel.lastName}`.trim(),
      code: l.personnel.personnelCode, loanRem: 0, advRem: 0,
    };
    cur.loanRem += l.remaining;
    map.set(l.personnelId, cur);
  }
  for (const a of advances) {
    const cur = map.get(a.personnelId) ?? {
      name: `${a.personnel.firstName} ${a.personnel.lastName}`.trim(),
      code: a.personnel.personnelCode, loanRem: 0, advRem: 0,
    };
    cur.advRem += a.amount;
    map.set(a.personnelId, cur);
  }
  const rows = [...map.values()].sort((a, b) => a.code.localeCompare(b.code, 'fa')).map((r, i) => [
    toPersianDigits(String(i + 1)),
    toPersianDigits(r.code), r.name, r.loanRem, r.advRem, r.loanRem + r.advRem,
  ]);
  const headers = ['ردیف', 'کد پرسنلی', 'نام و نام خانوادگی', 'مانده وام', 'مانده مساعده', 'جمع مطالبات'];
  const moneyCols = [3, 4, 5];
  const totals: Array<string | number> = ['جمع کل', '', '', 0, 0, 0];
  for (const c of moneyCols) totals[c] = rows.reduce((a, r) => a + Number(r[c] ?? 0), 0);
  return {
    title: 'مانده وام و مساعده پرسنل',
    subtitle: rows.length ? `${toPersianDigits(String(rows.length))} نفر بدهکار` : 'مانده‌ای وجود ندارد',
    headers, rows, moneyCols, totals, count: rows.length,
  };
}

export { formatMoney };
