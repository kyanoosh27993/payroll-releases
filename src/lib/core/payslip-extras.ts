// اقلام تکمیلی فیش حقوقی — گزاره ۵ نسخه ۱٫۲٫۰
// فهرست اقلام قابل انتخاب برای نمایش در فیش + محاسبه هر قلم از داده‌های واقعی
import { db } from '@/lib/db';
import { monthStats } from './shifts';
import { holidaySetOfMonth } from './calendar';
import { parseNumberOr } from './numbers';
import { getFySettings, requiredHoursOfMonth } from './payroll-calc';

export { PAYSLIP_OPTION_DEFS, defaultPayslipOptions } from './payslip-option-defs';
import { PAYSLIP_OPTION_DEFS, defaultPayslipOptions } from './payslip-option-defs';

export const PAYSLIP_OPTIONS_KEY = 'payslip_options';

export async function getPayslipOptions(fyId: number): Promise<Record<string, boolean>> {
  const row = await db.fySetting.findFirst({ where: { fiscalYearId: fyId, key: PAYSLIP_OPTIONS_KEY } });
  if (!row?.value) return defaultPayslipOptions();
  try {
    return { ...defaultPayslipOptions(), ...JSON.parse(row.value) };
  } catch {
    return defaultPayslipOptions();
  }
}

export async function savePayslipOptions(fyId: number, opts: Record<string, boolean>) {
  const clean: Record<string, boolean> = {};
  for (const o of PAYSLIP_OPTION_DEFS) clean[o.key] = Boolean(opts[o.key]);
  // FySetting کلید ترکیبی دارد (fiscalYearId + key) — update با کلید ترکیبی
  await db.fySetting.upsert({
    where: { fiscalYearId_key: { fiscalYearId: fyId, key: PAYSLIP_OPTIONS_KEY } },
    update: { value: JSON.stringify(clean) },
    create: { fiscalYearId: fyId, key: PAYSLIP_OPTIONS_KEY, value: JSON.stringify(clean) },
  });
}

const toFa = (v: number | string) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const money = (v: number) => toFa(Math.round(v || 0).toLocaleString('en-US'));

/** دسته‌بندی نوع شیفت روز از روی برنامه شیفت JSON: {"0":[480,960],...} */
function classifyDay(schedule: string | null, dow: number): 'night' | 'full' | 'half' | null {
  if (!schedule) return null;
  try {
    const map = JSON.parse(schedule) as Record<string, [number, number] | null>;
    const win = map[String(dow)] ?? map[String(dow === 6 ? 0 : dow)];
    if (!win || !Array.isArray(win)) return null;
    const [s, e] = win;
    const span = e > s ? e - s : 1440 - s + e;
    // شیفت شب: شروع از ۲۰ عصر به بعد یا عبور از نیمه‌شب
    if (s >= 1200 || e <= 420) return 'night';
    if (span >= 660) return 'full'; // ۱۱ ساعت به بالا = شیفت عادی تمام‌روز
    return 'half'; // صبح یا عصر
  } catch {
    return null;
  }
}

export interface PayslipExtrasRow { label: string; value: string }

/** محاسبه همه اقلام تکمیلی یک پرسنل در یک دوره — از داده واقعی حضور و حقوق */
export async function computePayslipExtras(periodId: number, personnelId: number): Promise<PayslipExtrasRow[]> {
  const period = await db.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) return [];
  const { jy, jm, fiscalYearId } = period;
  const p = await db.personnel.findUnique({ where: { id: personnelId } });
  if (!p) return [];
  const summary = await db.payrollSummary.findFirst({ where: { periodId, personnelId } });

  // حضور ماه + آمار شیفت
  const attMonth = await db.attendanceMonth.findUnique({ where: { fiscalYearId_jy_jm: { fiscalYearId, jy, jm } } });
  const holidays = await holidaySetOfMonth(jy, jm);
  const stats = attMonth ? await monthStats(attMonth.id, holidays) : {};
  const st = stats[personnelId];
  const dim = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29][jm - 1] || 30; // تقریبی — با jDaysInMonth جایگزین در صورت نیاز
  const daysInMonth = summary ? (jm === 12 ? 29 : jm <= 6 ? 31 : 30) : daysInMonthOf(jy, jm);

  // کسر کار تأخیر/تعجیل از حضور روزانه
  let lateMin = 0, earlyMin = 0;
  if (attMonth) {
    const agg = await db.attendanceDaily.aggregate({
      where: { monthId: attMonth.id, personnelId },
      _sum: { lateMin: true, earlyMin: true },
    });
    lateMin = agg._sum.lateMin ?? 0;
    earlyMin = agg._sum.earlyMin ?? 0;
  }

  // نوع شیفت‌ها — از انتساب ماه یا شیفت پیش‌فرض پرونده
  const asg = await db.shiftAssignment.findFirst({ where: { personnelId, jy, jm } });
  const shiftId = asg?.shiftId ?? p.shiftId;
  const shift = shiftId ? await db.shift.findUnique({ where: { id: shiftId } }) : null;
  let nightShifts = 0, fullShifts = 0, halfShifts = 0;
  if (shift && attMonth) {
    const days = await db.attendanceDaily.findMany({ where: { monthId: attMonth.id, personnelId }, select: { day: true } });
    for (const d of days) {
      const dow = jalaliDow(jy, jm, d.day);
      const kind = classifyDay(shift.schedule, dow);
      if (kind === 'night') nightShifts++;
      else if (kind === 'full') fullShifts++;
      else if (kind === 'half') halfShifts++;
    }
  }

  // حکم مؤثر + نرخ ساعتی مطابق موتور محاسبه
  const lastOfJm = `${jy}/${String(jm).padStart(2, '0')}/31`;
  const decreeRows = await db.decree.findMany({ where: { personnelId }, orderBy: { effectiveDate: 'desc' } });
  const decree = decreeRows.find((d) => d.effectiveDate <= lastOfJm) ?? decreeRows[0];
  const contract = await db.contract.findFirst({ where: { personnelId }, orderBy: { createdAt: 'desc' } });
  // قانون ۱٫۴٫۳: مزد روزانه = مزد ماهانه ÷ ۳۰ و مزد ساعتی = مزد روزانه ÷ ۷٫۳۳
  // ساعات موظفی از جدول سالانه (مورد ۱۰) خوانده می‌شود
  const settings = await getFySettings(fiscalYearId);
  const reqH = requiredHoursOfMonth(settings, jm);
  const dailyDiv = parseNumberOr(settings['daily_divisor_days'], 30) || 30;
  const hourlyDiv = parseNumberOr(settings['hourly_divisor_hours'], 7.33) || 7.33;
  let baseWage = (decree?.jobWage ?? 0) + (decree?.seniorityWage ?? 0);
  if (contract?.contractType === 'ساعتی' && contract.hourlyRate) baseWage = contract.hourlyRate * reqH;
  else if (contract?.contractType === 'روزانه' && contract.dailyRate) baseWage = contract.dailyRate * 30;
  const hourly = (baseWage / dailyDiv) / hourlyDiv;
  const otFactor = parseNumberOr(settings['overtime_factor'], 1.4);
  const holFactor = parseNumberOr(settings['holiday_work_factor'], 1.7);
  const friFactor = parseNumberOr(settings['friday_work_factor'], 1.4);

  // ردیف‌های حقوق از ابتدای سال — پاداش/جریمه/سنوات
  const fyPeriods = await db.payrollPeriod.findMany({ where: { fiscalYearId, jy }, select: { id: true, jm: true } });
  const fyPeriodIds = fyPeriods.map((x) => x.id);
  const prevPeriodIds = fyPeriods.filter((x) => x.jm < jm).map((x) => x.id);
  let ytdBonus = 0, ytdPenalty = 0, seniorityAccum = 0, ytdInsuredDays = 0;
  if (fyPeriodIds.length) {
    const lines = await db.payrollLine.findMany({
      where: { periodId: { in: fyPeriodIds }, personnelId },
      select: { itemCode: true, amount: true, periodId: true },
    });
    for (const l of lines) {
      if (l.itemCode === 'other_ben' || l.itemCode === 'tax_free_other') ytdBonus += l.amount;
      if (l.itemCode === 'other_deduct') ytdPenalty += l.amount;
      if (l.itemCode === 'seniority' && prevPeriodIds.includes(l.periodId)) seniorityAccum += l.amount;
    }
    const insured = await db.payrollSummary.findMany({
      where: { periodId: { in: fyPeriodIds }, personnelId },
      select: { workedDays: true, insuredBase: true },
    });
    ytdInsuredDays = insured.filter((s) => s.insuredBase > 0).reduce((a, s) => a + s.workedDays, 0);
  }

  // عیدی تا پایان ماه قبل — روزانه (مصوبه ۱۳۷۰: ۶۰ روز مزد مبنا در سال کامل)
  // عیدی = روزمزد مبنا × ۶۰ ÷ ۳۶۵ × روزهای کارکرد امسال — سقف ۹۰ روز حداقل مزد روزانه به نسبت کارکرد
  // عیدی: مبنای مزد مبنا = مزد شغل + مزد سنوات (حق مسکن/بن و سایر مزایا جزء مبنا نیست)
  const monthlyFixed = (decree?.jobWage ?? 0) + (decree?.seniorityWage ?? 0);
  const mizanDaily = Math.round(monthlyFixed / 30);
  const minWage = parseNumberOr(settings['minimum_wage_monthly'], 0);
  const workedDaysYtd = ytdInsuredDays || prevPeriodIds.length * 30; // روزهای کارکرد واقعی امسال
  let eidiYtd = Math.round(mizanDaily * (60 / 365) * workedDaysYtd);
  if (minWage > 0) {
    const cap = Math.round((minWage / 30) * (90 / 365) * workedDaysYtd);
    if (cap > 0) eidiYtd = Math.min(eidiYtd, cap);
  }

  const rows: PayslipExtrasRow[] = [];
  const add = (key: string, label: string, value: string) => rows.push({ label, value });
  add('month_days', 'تعداد روزهای ماه', toFa(daysInMonth));
  add('worked_days', 'روزهای کارکرد', toFa(summary?.workedDays ?? st?.paidDays ?? 0));
  add('ot_rate', 'مبلغ هر ساعت اضافه‌کاری', money(hourly * otFactor) + ' ریال');
  add('friday_amount', 'مبلغ جمعه‌کاری', money(hourly * friFactor * (st?.fridayHours ?? 0)) + ' ریال');
  add('leave_days', 'مرخصی رفته', toFa(summary?.leaveDays ?? st?.leaveDays ?? 0) + ' روز');
  add('late_min', 'کسر کار تأخیر', toFa(lateMin) + ' دقیقه');
  add('early_min', 'کسر کار تعجیل', toFa(earlyMin) + ' دقیقه');
  add('ot_hours', 'ساعات اضافه‌کاری', toFa(Math.round((st?.overtimeHours ?? 0) * 10) / 10) + ' ساعت');
  add('night_shifts', 'تعداد شیفت شب', toFa(nightShifts));
  add('regular_shifts', 'تعداد شیفت عادی', toFa(fullShifts));
  add('morning_evening_shifts', 'تعداد شیفت صبح/عصر', toFa(halfShifts));
  add('holiday_work_count', 'تعداد تعطیل‌کاری', toFa(Math.round(st?.holidayHours ?? 0) / 8 || 0));
  add('holiday_work_amount', 'مبلغ تعطیل‌کاری', money(hourly * holFactor * (st?.holidayHours ?? 0)) + ' ریال');
  add('ytd_bonus', 'پاداش/اضافه‌پرداختی از ابتدای سال', money(ytdBonus) + ' ریال');
  add('ytd_penalty', 'جریمه/خسارت از ابتدای سال', money(ytdPenalty) + ' ریال');
  add('ytd_insured_days', 'روزهای بیمه‌شده از ابتدای سال', toFa(ytdInsuredDays));
  add('seniority_accum', 'سنوات انباشته تا پایان ماه قبل', money(seniorityAccum) + ' ریال');
  add('eidi_ytd', 'عیدی تا پایان ماه قبل', money(eidiYtd) + ' ریال');
  void dim;
  return rows;
}

function daysInMonthOf(jy: number, jm: number): number {
  return jm <= 6 ? 31 : jm <= 11 ? 30 : (((jy + 1) % 33) % 4 === 1 ? 30 : 29);
}

// روز هفته جلالی: ۰=شنبه ... ۶=جمعه (تقریب: ۱۳۵۶/۱/۱ = شنبه)
function jalaliDow(jy: number, jm: number, d: number): number {
  const leapYears = (y: number) => Math.floor((y - 1356) * 365.2422 / 365);
  void leapYears;
  // محاسبه دقیق با تاریخ میلادی
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, d);
  const dt = new Date(Date.UTC(gy, gm - 1, gd));
  const gDow = dt.getUTCDay(); // ۰=یکشنبه
  return (gDow + 1) % 7; // ۰=شنبه
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy > 979 ? 1600 : 621;
  const jy2 = jy > 979 ? jy - 979 : jy;
  let days = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}
