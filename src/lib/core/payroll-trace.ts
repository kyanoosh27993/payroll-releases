// سرویس ردپای محاسبه — قابلیت ۱٫۴٫۵
// بازمحاسبه بدون نوشتن (read-only) برای یک پرسنل در یک دوره و برگرداندن
// مراحل گام‌به‌گام هر قلم + خلاصه‌ها — برای نمایش با کلیک روی هر مبلغ
import { db } from '@/lib/db';
import { calcEmployee, type CalcTrace } from './payroll-engine';
import { monthStats } from './shifts';
import { holidaySetOfMonth } from './calendar';
import { daysInMonth as jDaysInMonth } from './jalali';
import { parseJalaliDateStr } from './numbers';
import { getFySettings } from './payroll-calc';

export interface TraceResult {
  traces: Record<string, CalcTrace>;
  summaryTraces: Record<string, CalcTrace>;
  inputs: Record<string, string>; // ورودی‌های انسانی‌شده برای نمایش
  /** نسخه ۱٫۴٫۶ — آمار حضور و غیاب برای سربرگ فیش (ساعت کارکرد و ریز شیفت‌ها) */
  stat?: {
    workedHours: number; overtimeHours: number; nightHours: number;
    shiftPctHours: Array<{ pct: number; hours: number }>;
    fridayReplacedHours: number; fridayNoReplaceHours: number; holidayHours: number;
  };
}

export async function computeTraceForPerson(periodId: number, personnelId: number): Promise<TraceResult | null> {
  const period = await db.payrollPeriod.findUnique({ where: { id: periodId }, select: { jy: true, jm: true, fiscalYearId: true } });
  if (!period) return null;
  const { jy, jm, fiscalYearId } = period;
  const p = await db.personnel.findUnique({
    where: { id: personnelId },
    include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 }, loans: { where: { active: true } }, advances: { where: { recovered: false } } },
  });
  if (!p) return null;

  const [settings, brackets, itemsCfg] = await Promise.all([
    getFySettings(fiscalYearId),
    db.taxBracket.findMany({ where: { fiscalYearId }, orderBy: { seq: 'asc' } }),
    db.payrollItemConfig.findMany({ where: { active: true }, orderBy: { sort: 'asc' } }),
  ]);

  const attMonth = await db.attendanceMonth.findUnique({ where: { fiscalYearId_jy_jm: { fiscalYearId, jy, jm } } });
  const holidays = await holidaySetOfMonth(jy, jm);
  const stats = attMonth ? await monthStats(attMonth.id, holidays) : {};
  const stat = stats[personnelId] ?? {
    paidDays: jDaysInMonth(jy, jm), leaveDays: 0, overtimeHours: 0, holidayHours: 0,
    fridayHours: 0, unpaidDays: 0, nightHours: 0, workedHours: 0,
  };

  const lastOfJm = `${jy}/${String(jm).padStart(2, '0')}/31`;
  const decreeRows = await db.decree.findMany({ where: { personnelId }, orderBy: { effectiveDate: 'desc' } });
  const decreeRow = decreeRows.find((d) => d.effectiveDate <= lastOfJm) ?? decreeRows[0] ?? null;
  const decree = {
    jobWage: decreeRow?.jobWage ?? 0, seniorityWage: decreeRow?.seniorityWage ?? 0,
    childAllowance: decreeRow?.childAllowance ?? 0, housing: decreeRow?.housing ?? 0,
    food: decreeRow?.food ?? 0, adjustmentDiff: decreeRow?.adjustmentDiff ?? 0,
    supervision: decreeRow?.supervision ?? 0, educationAid: decreeRow?.educationAid ?? 0,
    laborMarket: decreeRow?.laborMarket ?? 0, attractionPercent: decreeRow?.attractionPercent ?? 0,
    attractionAmount: decreeRow?.attractionAmount ?? 0, otherBenefits: decreeRow?.otherBenefits ?? 0,
    workerBen: decreeRow?.workerBen ?? 0, fixedOvertime: decreeRow?.fixedOvertime ?? 0,
    familyAllowance: decreeRow?.familyAllowance ?? 0, shiftAllowance: decreeRow?.shiftAllowance ?? 0,
  };

  const manuals = await db.payrollManual.findMany({ where: { periodId, personnelId } });
  const inputs: Record<string, number> = {};
  for (const m of manuals) inputs[m.itemCode] = m.amount;
  const opens = await db.openingBalance.findMany({ where: { personnelId } });
  for (const o of opens) {
    if (o.consumed || o.unit !== 'amount' || o.effect === 'none') continue;
    if (o.effect === 'earning_ins') inputs.ob_ins = (inputs.ob_ins ?? 0) + o.amount;
    else if (o.effect === 'earning_free') inputs.ob_free = (inputs.ob_free ?? 0) + o.amount;
    else if (o.effect === 'deduction') inputs.ob_deduct = (inputs.ob_deduct ?? 0) + o.amount;
  }

  const asg = await db.shiftAssignment.findFirst({ where: { personnelId, jy, jm } });
  const sid = asg?.shiftId ?? p.shiftId;
  const shift = sid ? await db.shift.findUnique({ where: { id: sid } }) : null;
  const premiumPct = shift?.premiumPct ?? 0;
  const nightH = stat.nightHours || 0;
  const premiumH = Math.max(0, (stat.workedHours || 0) - nightH);

  const dim = jDaysInMonth(jy, jm);
  const contract = p.contracts[0] ?? null;
  const ctx = {
    settings,
    taxBrackets: brackets.map((b) => ({ fromAmount: b.fromAmount, toAmount: b.toAmount, ratePercent: b.ratePercent })),
    decree,
    contract: contract ? {
      contractType: contract.contractType, hourlyRate: contract.hourlyRate,
      dailyRate: contract.dailyRate, monthlyWage: contract.monthlyWage, projectAmount: contract.projectAmount,
    } : null,
    loans: p.loans.map((l) => ({ installment: l.installment, active: l.active })),
    advances: p.advances.map((a) => ({ amount: a.amount, recovered: a.recovered })),
    inputs,
    daysInMonth: dim,
    paidDays: Math.min(stat.paidDays, dim),
    overtimeHours: stat.overtimeHours || 0,
    holidayHours: stat.holidayHours || 0,
    fridayHours: stat.fridayHours || 0,
    nightHours: nightH,
    premiumPct,
    premiumHours: premiumH,
    shiftPctHours: stat.shiftPctHours || [],
    fridayReplacedHours: stat.fridayReplacedHours ?? 0,
    fridayNoReplaceHours: stat.fridayNoReplaceHours ?? 0,
    maritalStatus: p.maritalStatus,
    dependents: p.dependents,
    leaveDays: stat.leaveDays || 0,
    insuredBase: 0,
    taxBase: 0,
  };
  const items = itemsCfg.map((i) => ({
    code: i.code, title: i.title, kind: i.kind as 'earning' | 'deduction' | 'employer',
    formulaKey: i.formulaKey, taxMode: i.taxMode as 'none' | 'm84' | 'lump' | 'percent',
    taxPercent: i.taxPercent, insured: i.insured, active: i.active,
  }));
  const { traces, summaryTraces } = calcEmployee(ctx, items);

  const humanInputs: Record<string, string> = {
    'دوره': `${toFa(jy)}/${toFa(String(jm).padStart(2, '0'))}`,
    'حکم مبنای محاسبه': decreeRow ? `مورخ ${toFa(decreeRow.effectiveDate)}` : 'حکم ثبت نشده',
    'روزهای کارکرد ماه': `${toFa(ctx.paidDays)} از ${toFa(dim)} روز`,
    'ساعات کارکرد ماه': `${toFa(stat.workedHours || 0)} ساعت`,
    'مرخصی ماه': `${toFa(ctx.leaveDays)} روز`,
    'ساعات اضافه‌کاری': `${toFa(ctx.overtimeHours)} ساعت`,
    'ساعات جمعه‌کاری': `${toFa(ctx.fridayHours)} ساعت${(stat.fridayReplacedHours || stat.fridayNoReplaceHours) ? ` (با جایگزین ${toFa(stat.fridayReplacedHours || 0)} + بدون جایگزین ${toFa(stat.fridayNoReplaceHours || 0)})` : ''}`,
    'ساعات تعطیل‌کاری': `${toFa(ctx.holidayHours)} ساعت`,
    'ساعات شب‌کاری': `${toFa(ctx.nightHours)} ساعت`,
    ...(stat.shiftPctHours?.length ? { 'ریز حق شیفت': stat.shiftPctHours.map((sp) => `${toFa(sp.hours)} ساعت × ${toFa(sp.pct)}٪`).join(' + ') } : {}),
    'قرارداد': contract ? contract.contractType : 'بدون قرارداد',
  };
  return { traces, summaryTraces, inputs: humanInputs,
    stat: {
      workedHours: Math.round((stat.workedHours || 0) * 100) / 100,
      overtimeHours: Math.round((stat.overtimeHours || 0) * 100) / 100,
      nightHours: Math.round((stat.nightHours || 0) * 100) / 100,
      shiftPctHours: stat.shiftPctHours || [],
      fridayReplacedHours: stat.fridayReplacedHours ?? 0,
      fridayNoReplaceHours: stat.fridayNoReplaceHours ?? 0,
      holidayHours: Math.round((stat.holidayHours || 0) * 100) / 100,
    } };
}

function toFa(v: number | string): string {
  return String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}
