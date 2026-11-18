// موتور بینش هوشمند (Insights) — ناهنجاری‌ها، روند و پیش‌بینی آماری
// کاملا آفلاین: آمار توصیفی + تشخیص انحراف + رگرسیون خطی سبک — بدون شبکه
// خروجی برای: داشبورد (کارت «تحلیل هوشمند»)، حضور و غیاب، ماژول‌های گزارش
import { db } from '@/lib/db';
import { MONTH_NAMES } from '@/lib/core/jalali';
import { formatMoney } from '@/lib/core/numbers';

export interface InsightParam {
  /** حد هشدار نرخ تاخیر (نسبت روز تاخیری به کل روزهای ثبت‌شده) */
  lateRateWarn: number;
  /** حد هشدار غیبت (روز در ماه برای یک نفر) */
  absenceDaysWarn: number;
  /** حد هشدار جهش اضافه‌کاری نسبت به میانگین دوره */
  overtimeSpikeRatio: number;
  /** حد هشدار کسرکار ماهانه یک نفر (دقیقه) */
  missingMinutesWarn: number;
  /** حد هشدار افت جمع خالص نسبت به دوره قبل (نسبت) */
  netDropRatio: number;
  /** حد هشدار رشد جمع خالص نسبت به دوره قبل (نسبت) */
  netJumpRatio: number;
  /** حد هشدار مالیات یک دوره (نسبت به میانگین دوره‌های قبل) */
  taxSpikeRatio: number;
  /** حداکثر بینش خروجی */
  maxInsights: number;
  /** افق پیش‌بینی (ماه) */
  forecastMonths: number;
  /** فعال/غیرفعال بودن هر گروه از بینش‌ها */
  enabledAttendance: boolean;
  enabledPayroll: boolean;
  enabledForecast: boolean;
}

export const DEFAULT_INSIGHT_PARAMS: InsightParam = {
  lateRateWarn: 0.3,
  absenceDaysWarn: 3,
  overtimeSpikeRatio: 1.6,
  missingMinutesWarn: 240,
  netDropRatio: 0.2,
  netJumpRatio: 0.3,
  taxSpikeRatio: 1.5,
  maxInsights: 12,
  forecastMonths: 1,
  enabledAttendance: true,
  enabledPayroll: true,
  enabledForecast: true,
};

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** ماژول مرتبط برای ناوبری */
  module: 'attendance' | 'payroll' | 'reports' | 'personnel';
  /** ماه مرتبط (شماره ۱..۱۲) */
  jm?: number;
  metric?: string;
}

interface PeriodAgg { jy: number; jm: number; net: number; gross: number; tax: number; ins: number; count: number; otMin: number; }

function regressionNext(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const xs = values.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (values[i] - my); den += (xs[i] - mx) ** 2; }
  if (den === 0) return null;
  const slope = num / den;
  return my + slope * (n - mx);
}

const monthName = (jm: number) => MONTH_NAMES[jm - 1] ?? String(jm);

/** محاسبه بینش‌های یک سال مالی — fyId الزامی؛ companyId برای فیلتر پرسنل */
export async function computeInsights(
  fyId: number,
  companyId: number,
  paramOverrides: Partial<InsightParam> = {},
): Promise<{ insights: Insight[]; params: InsightParam; period: { jy: number; jm: number } | null }> {
  const P: InsightParam = { ...DEFAULT_INSIGHT_PARAMS, ...paramOverrides };
  const insights: Insight[] = [];

  const periods = await db.payrollPeriod.findMany({
    where: { fiscalYearId: fyId },
    orderBy: [{ jy: 'asc' }, { jm: 'asc' }],
    select: { id: true, jy: true, jm: true },
  });
  if (!periods.length) return { insights, params: P, period: null };

  const periodIds = periods.map((p) => p.id);
  const summaries = await db.payrollSummary.findMany({
    where: { periodId: { in: periodIds } },
    select: {
      periodId: true, personnelId: true, netPay: true, gross: true, tax: true,
      workerIns: true, overtimeMin: true, workedDays: true, leaveDays: true, payPaid: true,
    },
  });
  const people = await db.personnel.findMany({
    where: { companyId },
    select: { id: true, firstName: true, lastName: true, status: true },
  });
  const nameOf = new Map(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]));

  // تجمیع دوره‌ای
  const byPeriod = new Map<number, PeriodAgg>();
  const periodJm = new Map<number, { jy: number; jm: number }>();
  for (const p of periods) periodJm.set(p.id, { jy: p.jy, jm: p.jm });
  for (const s of summaries) {
    const meta = periodJm.get(s.periodId);
    if (!meta) continue;
    const agg = byPeriod.get(s.periodId) ?? { jy: meta.jy, jm: meta.jm, net: 0, gross: 0, tax: 0, ins: 0, count: 0, otMin: 0 };
    agg.net += s.netPay; agg.gross += s.gross; agg.tax += s.tax; agg.ins += s.workerIns;
    agg.count += 1; agg.otMin += s.overtimeMin;
    byPeriod.set(s.periodId, agg);
  }
  const series = [...byPeriod.values()].sort((a, b) => (a.jy - b.jy) || (a.jm - b.jm));
  const latest = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;

  // ---------- بینش‌های حقوق ----------
  if (P.enabledPayroll && latest) {
    if (prev && prev.net > 0) {
      const delta = (latest.net - prev.net) / prev.net;
      if (delta <= -P.netDropRatio) {
        insights.push({
          id: `net-drop-${latest.jm}`, severity: Math.abs(delta) > P.netDropRatio * 2 ? 'critical' : 'warning',
          title: `افت ${formatMoney(Math.abs(latest.net - prev.net))} ریالی خالص حقوق`,
          detail: `جمع خالص ${monthName(latest.jm)} نسبت به ${monthName(prev.jm)} ${Math.round(Math.abs(delta) * 100)}٪ کاهش یافته است (${formatMoney(prev.net)} → ${formatMoney(latest.net)}). علت احتمالی: کاهش کارکرد، مرخصی/غیبت بیشتر یا حکم جدید.`,
          module: 'payroll', jm: latest.jm, metric: `${Math.round(delta * 100)}%`,
        });
      } else if (delta >= P.netJumpRatio) {
        insights.push({
          id: `net-jump-${latest.jm}`, severity: 'info',
          title: `رشد ${Math.round(delta * 100)}٪ جمع خالص`,
          detail: `جمع خالص ${monthName(latest.jm)} نسبت به ${monthName(prev.jm)} افزایش یافته (${formatMoney(prev.net)} → ${formatMoney(latest.net)}). اگر افزایش غیرمنتظره است، احکام جدید یا اقلام دستی را بررسی کنید.`,
          module: 'payroll', jm: latest.jm, metric: `+${Math.round(delta * 100)}%`,
        });
      }
    }
    if (prev && prev.tax > 0 && latest.tax > prev.tax * P.taxSpikeRatio) {
      insights.push({
        id: `tax-spike-${latest.jm}`, severity: 'warning',
        title: `جهش مالیات در ${monthName(latest.jm)}`,
        detail: `مالیات دوره ${formatMoney(latest.tax)} ریال است — ${Math.round((latest.tax / prev.tax) * 100)}٪ دوره قبل (${formatMoney(prev.tax)}). پله‌های مالیاتی و مبالغ اضافه‌کاری را بازبینی کنید.`,
        module: 'payroll', jm: latest.jm,
      });
    }
    if (latest.count > 0) {
      const unpaid = summaries.filter((s) => s.periodId === periods[periods.length - 1].id && !s.payPaid);
      if (unpaid.length >= Math.max(1, Math.round(latest.count * 0.15))) {
        insights.push({
          id: `unpaid-${latest.jm}`, severity: 'warning',
          title: `${unpaid.length} فیش پرداخت‌نشده`,
          detail: `${Math.round((unpaid.length / latest.count) * 100)}٪ فیش‌های ${monthName(latest.jm)} هنوز «پرداخت‌شده» علامت نخورده‌اند؛ جمع ${formatMoney(unpaid.reduce((a, b) => a + b.netPay, 0))} ریال.`,
          module: 'payroll', jm: latest.jm,
        });
      }
    }
    // جهش اضافه‌کاری فردی
    const cur = summaries.filter((s) => s.periodId === periods[periods.length - 1].id);
    const prevByPerson = new Map<number, number>();
    if (prev) {
      const prevId = periods[series.length - 2]?.id;
      for (const s of summaries) if (s.periodId === prevId) prevByPerson.set(s.personnelId, s.overtimeMin);
    }
    const avgOt = cur.length ? cur.reduce((a, b) => a + b.overtimeMin, 0) / cur.length : 0;
    if (avgOt > 60) {
      for (const r of cur.filter((r) => r.overtimeMin > avgOt * P.overtimeSpikeRatio).sort((a, b) => b.overtimeMin - a.overtimeMin).slice(0, 4)) {
        const pv = prevByPerson.get(r.personnelId);
        insights.push({
          id: `ot-spike-${latest.jm}-${r.personnelId}`, severity: 'info',
          title: `اضافه‌کاری بالای ${nameOf.get(r.personnelId) ?? '؟'}`,
          detail: `${Math.round(r.overtimeMin / 60)} ساعت در ${monthName(latest.jm)} — میانگین دوره ${Math.round(avgOt / 60)} ساعت${pv !== undefined ? `؛ ماه قبل ${Math.round(pv / 60)} ساعت` : ''}.`,
          module: 'attendance', jm: latest.jm,
        });
      }
    }
  }

  // ---------- بینش‌های حضور و غیاب ----------
  if (P.enabledAttendance && latest) {
    const am = await db.attendanceMonth.findFirst({
      where: { fiscalYearId: fyId, jy: latest.jy, jm: latest.jm }, select: { id: true },
    });
    if (am) {
      const absences = await db.attendanceDaily.groupBy({
        by: ['personnelId'], where: { monthId: am.id, status: 'غایب' }, _count: { _all: true },
      });
      for (const a of absences.filter((x) => x._count._all >= P.absenceDaysWarn).sort((x, y) => y._count._all - x._count._all).slice(0, 3)) {
        insights.push({
          id: `abs-${am.id}-${a.personnelId}`, severity: a._count._all >= P.absenceDaysWarn * 2 ? 'critical' : 'warning',
          title: `غیبت ${a._count._all} روزه — ${nameOf.get(a.personnelId) ?? '؟'}`,
          detail: `در ${monthName(latest.jm)} این فرد ${a._count._all} روز با وضعیت «غایب» ثبت شده است. صحت رکوردها و مرخصی‌های ثبت‌نشده را بررسی کنید.`,
          module: 'attendance', jm: latest.jm, metric: `${a._count._all} روز`,
        });
      }
      const missing = await db.attendanceDaily.groupBy({
        by: ['personnelId'], where: { monthId: am.id }, _sum: { missingMin: true },
      });
      for (const m of missing.filter((x) => (x._sum.missingMin ?? 0) >= P.missingMinutesWarn).sort((x, y) => (y._sum.missingMin ?? 0) - (x._sum.missingMin ?? 0)).slice(0, 3)) {
        const mins = m._sum.missingMin ?? 0;
        insights.push({
          id: `miss-${am.id}-${m.personnelId}`, severity: mins >= P.missingMinutesWarn * 2 ? 'warning' : 'info',
          title: `کسرکار بالا — ${nameOf.get(m.personnelId) ?? '؟'}`,
          detail: `جمع کسرکار ${monthName(latest.jm)}: ${Math.floor(mins / 60)} ساعت و ${mins % 60} دقیقه (حد هشدار: ${Math.floor(P.missingMinutesWarn / 60)} ساعت).`,
          module: 'attendance', jm: latest.jm,
        });
      }
      const late = await db.attendanceDaily.findMany({
        where: { monthId: am.id, lateMin: { gt: 0 } },
        select: { lateMin: true, status: true },
      });
      const workdays = await db.attendanceDaily.count({ where: { monthId: am.id, expectedMin: { gt: 0 } } });
      if (workdays > 0 && late.length / workdays > P.lateRateWarn) {
        insights.push({
          id: `late-${am.id}`, severity: 'warning',
          title: `نرخ تاخیر ${Math.round((late.length / workdays) * 100)}٪`,
          detail: `${late.length} روز از ${workdays} روز کاریِ ثبت‌شده ${monthName(latest.jm)} دارای تاخیر است. گزینه «گرِیس تاخیر» در تنظیمات را هم می‌توانید بازبینی کنید.`,
          module: 'attendance', jm: latest.jm,
        });
      }
    }
  }

  // ---------- پیش‌بینی ----------
  if (P.enabledForecast && series.length >= 3) {
    const nets = series.map((s) => s.net);
    const nextNet = regressionNext(nets);
    if (nextNet !== null && latest) {
      const nm = latest.jm % 12 + 1;
      insights.push({
        id: `forecast-net-${nm}`, severity: 'info',
        title: `پیش‌بینی خالص ${monthName(nm)}: حدود ${formatMoney(Math.max(0, Math.round(nextNet)))} ریال`,
        detail: `بر اساس روند ${series.length} دوره اخیر (رگرسیون خطی). این برآورد صرفا آماری است و به تغییر احکام/مرخصی‌ها حساس است.`,
        module: 'reports', jm: nm,
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  insights.sort((a, b) => order[a.severity] - order[b.severity]);
  return { insights: insights.slice(0, P.maxInsights), params: P, period: latest ? { jy: latest.jy, jm: latest.jm } : null };
}
