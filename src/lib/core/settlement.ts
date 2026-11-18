// محاسبه تسویه‌حساب و پایان کار پرسنل — نسخه ۱٫۴٫۵ (محاسبه کاملاً روزانه + اقلام تک‌به‌تک)
// مبانی قانونی: ماده ۲۴ و ۲۷ و ۲۹ قانون کار (سنوات)، ماده ۶۴ (مرخصی)، ماده واحده مصوب ۱۳۷۰/۱۲/۰۶ (عیدی)
// تغییر ۱٫۴٫۵ به درخواست کاربر:
//  ۱) عیدی و پاداش، سنوات پایان کار و مانده مرخصی به‌صورت «روزانه» محاسبه می‌شوند (نه ماهانه)
//     عیدی: روزمزد مبنا × ۶۰ روز ÷ ۳۶۵ × روزهای کارکرد سال (سقف ۹۰ روز حداقل مزد روزانه به نسبت کارکرد)
//     سنوات: روزمزد ثابت × ۳۰ روز ÷ ۳۶۵ × کل روزهای کارکرد
//     مرخصی: روزمزد مبنا × مانده روز مرخصی
//  ۲) اقلام تسویه تک‌به‌تک: حق مسکن، بن کارگری، حق اولاد و سایر مزایا جداگانه (نه جمع‌شده)
//  ۳) هر قلم steps (مراحل محاسبه) دارد — برای نمایش جزئیات با کلیک (قابلیت جدید ۱٫۴٫۵)
import { db } from '@/lib/db';
import { escapeHtml as esc, isSafeImageDataUrl } from './sanitize';
import { toJalaali, toGregorian } from './jalali';
import { parseJalaliDateStr, parseNumberOr } from './numbers';

const toFa = (v: number | string) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const money = (v: number) => `${toFa(Math.round(v || 0).toLocaleString('en-US'))} ریال`;

export interface SettlementLine {
  title: string; detail: string; amount: number; sign: 1 | -1;
  /** مراحل محاسبه برای نمایش با کلیک (قابلیت ۱٫۴٫۵) */
  steps?: Array<{ label: string; value: string }>;
  basis?: string;
}

export interface SettlementResult {
  personnel: { id: number; fullName: string; personnelCode: string; nationalId: string; jobTitle: string; department: string; hireDate: string; endWorkDate: string };
  toDate: string;
  serviceYears: number;
  /** کل روزهای کارکرد (از استخدام تا تاریخ تسویه) — مبنای روزانه سنوات */
  serviceDays: number;
  /** روزهای کارکرد سال مالی جاری (از ابتدای سال یا استخدام تا تسویه) — مبنای روزانه عیدی */
  daysThisYear: number;
  lines: SettlementLine[];
  totalDue: number;
  totalDeduct: number;
  net: number;
  decreeUsed: string;
  dailyWage: number;
  /** روزمزد مبنا (مزد شغل + مزد سنوات) — مبنای مرخصی/عیدی */
  mizanDaily: number;
}

/** تاریخ جلالی امروزی */
export function todayJalali(): string {
  const now = new Date();
  const t = new Date(now.getTime() + 3.5 * 3600 * 1000);
  const j = toJalaali(t.getFullYear(), t.getMonth() + 1, t.getDate());
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

/** فاصله دقیق روزها بین دو تاریخ جلالی (تبدیل به میلادی و اختلاف روز) */
export function daysBetweenJalali(from: string, to: string): number {
  const a = parseJalaliDateStr(from), b = parseJalaliDateStr(to);
  if (!a || !b) return 0;
  const ga = toGregorian(a[0], a[1], a[2]);
  const gb = toGregorian(b[0], b[1], b[2]);
  const ta = Date.UTC(ga.gy, ga.gm - 1, ga.gd);
  const tb = Date.UTC(gb.gy, gb.gm - 1, gb.gd);
  return Math.max(0, Math.round((tb - ta) / 86400000));
}

/** حکم مؤثر در تاریخ داده‌شده */
export async function effectiveDecreeAt(personnelId: number, dateStr: string) {
  const rows = await db.decree.findMany({
    where: { personnelId, effectiveDate: { lte: dateStr } },
    orderBy: { effectiveDate: 'desc' }, take: 1,
  });
  if (rows.length) return rows[0];
  const any = await db.decree.findMany({ where: { personnelId }, orderBy: { effectiveDate: 'desc' }, take: 1 });
  return any[0] ?? null;
}

/** مزد مبنا ماهانه (مزد شغل + مزد سنوات) — مبنای مرخصی/عیدی (ماده ۶۴ و مصوبه ۱۳۷۰) */
export function mizanMonthly(d: { jobWage: number; seniorityWage: number } | null): number {
  if (!d) return 0;
  return (d.jobWage || 0) + (d.seniorityWage || 0);
}

/** مزد ثابت ماهانه (مزد مبنا + مسکن + خواروبار) — مبنای سنوات و اقلام ماه تسویه */
export function fixedMonthlyWage(d: { jobWage: number; seniorityWage: number; housing: number; food: number } | null): number {
  if (!d) return 0;
  return mizanMonthly(d) + (d.housing || 0) + (d.food || 0);
}

export async function computeSettlement(personnelId: number, toDate: string): Promise<SettlementResult> {
  const p = await db.personnel.findUnique({ where: { id: personnelId } });
  if (!p) throw new Error('پرسنل یافت نشد');
  const to = toDate || todayJalali();
  const toParsed = parseJalaliDateStr(to);
  if (!toParsed) throw new Error('تاریخ تسویه نامعتبر است');
  const [jy, jm, jd] = toParsed;

  const decree = await effectiveDecreeAt(personnelId, to);
  const mizanMonth = mizanMonthly(decree);
  const fixedMonth = fixedMonthlyWage(decree);
  const mizanDaily = Math.round(mizanMonth / 30); // روزمزد مبنا = مزد مبنا ÷ ۳۰
  const fixedDaily = fixedMonth / 30; // روزمزد ثابت (برای اقلام ماه تسویه: مسکن/بن به نسبت روز)

  // روزهای کارکرد
  const hire = parseJalaliDateStr(p.hireDate || '');
  const yearStart = `${jy}/01/01`;
  // روزهای کارکرد امسال: از ابتدای سال مالی (یا تاریخ استخدام اگر در همان سال باشد) تا تاریخ تسویه
  const daysThisYearEff = hire && hire[0] === jy ? daysBetweenJalali(p.hireDate, to) : Math.max(0, daysBetweenJalali(yearStart, to));
  const serviceDays = hire ? daysBetweenJalali(p.hireDate, to) : 0;
  const serviceYears = Math.round((serviceDays / 365) * 100) / 100;

  const lines: SettlementLine[] = [];
  const fmtDays = (n: number) => toFa(Math.round(n * 100) / 100);

  // ۱) مزد شغل ماه تسویه — روزانه: روزمزد شغل × روزهای کارکرد ماه
  const jobDaily = (decree?.jobWage ?? 0) / 30;
  lines.push({
    title: 'مزد شغل ماه تسویه',
    detail: `${fmtDays(jd)} روز × روزمزد شغل ${money(jobDaily)}`,
    amount: Math.round(jobDaily * jd), sign: 1,
    steps: [
      { label: 'مزد شغل ماهانه حکم', value: money(decree?.jobWage ?? 0) },
      { label: 'روزمزد شغل = مزد ماهانه ÷ ۳۰', value: money(jobDaily) },
      { label: 'روزهای کارکرد تا تاریخ تسویه', value: `${fmtDays(jd)} روز` },
      { label: 'نتیجه', value: money(Math.round(jobDaily * jd)) },
    ],
    basis: 'ماده ۳۴ قانون کار — مزد به نسبت روزهای کارکرد ماه',
  });

  // ۲) مزد سنوات ماه تسویه — روزانه
  const senDaily = (decree?.seniorityWage ?? 0) / 30;
  if (decree?.seniorityWage) {
    lines.push({
      title: 'مزد سنوات ماه تسویه',
      detail: `${fmtDays(jd)} روز × روزمزد سنوات ${money(senDaily)}`,
      amount: Math.round(senDaily * jd), sign: 1,
      steps: [
        { label: 'مزد سنوات ماهانه حکم', value: money(decree.seniorityWage) },
        { label: 'روزمزد سنوات = مزد ماهانه ÷ ۳۰', value: money(senDaily) },
        { label: 'روزهای کارکرد تا تاریخ تسویه', value: `${fmtDays(jd)} روز` },
        { label: 'نتیجه', value: money(Math.round(senDaily * jd)) },
      ],
      basis: 'مزد سنوات جزء مزد ثابت کارگر است',
    });
  }

  // ۳) حق مسکن ماه تسویه — جداگانه (تفکیک اقلام — درخواست کاربر ۱٫۴٫۵)
  const housingDaily = (decree?.housing ?? 0) / 30;
  if (decree?.housing) {
    lines.push({
      title: 'حق مسکن ماه تسویه',
      detail: `${fmtDays(jd)} روز × روزمزد مسکن ${money(housingDaily)}`,
      amount: Math.round(housingDaily * jd), sign: 1,
      steps: [
        { label: 'حق مسکن ماهانه حکم', value: money(decree.housing) },
        { label: 'سهم روزانه = حق مسکن ÷ ۳۰', value: money(housingDaily) },
        { label: 'روزهای کارکرد', value: `${fmtDays(jd)} روز` },
        { label: 'نتیجه', value: money(Math.round(housingDaily * jd)) },
      ],
      basis: 'حق مسکن مشمول عیدی/سنوات نیست — فقط به نسبت کارکرد ماه',
    });
  }

  // ۴) بن کارگری ماه تسویه — جداگانه
  const benDaily = (decree?.workerBen ?? 0) / 30;
  if (decree?.workerBen) {
    lines.push({
      title: 'بن کارگری (خواروبار) ماه تسویه',
      detail: `${fmtDays(jd)} روز × روزمزد بن ${money(benDaily)}`,
      amount: Math.round(benDaily * jd), sign: 1,
      steps: [
        { label: 'بن کارگری ماهانه حکم', value: money(decree.workerBen) },
        { label: 'سهم روزانه = بن ÷ ۳۰', value: money(benDaily) },
        { label: 'روزهای کارکرد', value: `${fmtDays(jd)} روز` },
        { label: 'نتیجه', value: money(Math.round(benDaily * jd)) },
      ],
      basis: 'بن کارگری مشمول عیدی/سنوات نیست — فقط به نسبت کارکرد ماه',
    });
  }

  // ۵) حق اولاد ماه تسویه — جداگانه (فقط متأهل × تعداد فرزند)
  if (decree?.childAllowance && p.maritalStatus === 'متأهل') {
    const kids = p.dependents ?? 0;
    const monthly = decree.childAllowance * Math.max(kids, 1);
    const daily = monthly / 30;
    lines.push({
      title: 'حق اولاد ماه تسویه',
      detail: `${fmtDays(jd)} روز × روزمزد اولاد ${money(daily)} (${toFa(kids)} فرزند)`,
      amount: Math.round(daily * jd), sign: 1,
      steps: [
        { label: 'حق اولاد هر فرزند (حکم)', value: money(decree.childAllowance) },
        { label: 'تعداد فرزند', value: toFa(kids) },
        { label: 'حق اولاد ماهانه = هر فرزند × تعداد', value: money(monthly) },
        { label: 'سهم روزانه = حق اولاد ÷ ۳۰', value: money(daily) },
        { label: 'روزهای کارکرد', value: `${fmtDays(jd)} روز` },
        { label: 'نتیجه', value: money(Math.round(daily * jd)) },
      ],
      basis: 'حق اولاد فقط برای متأهل و به‌ازای هر فرزند تحت تکفل',
    });
  }

  // ۶) حق عائله‌مندی ماه تسویه — جداگانه (فقط متأهل)
  if (decree?.familyAllowance && p.maritalStatus === 'متأهل') {
    const daily = decree.familyAllowance / 30;
    lines.push({
      title: 'حق عائله‌مندی ماه تسویه',
      detail: `${fmtDays(jd)} روز × روزمزد عائله‌مندی ${money(daily)}`,
      amount: Math.round(daily * jd), sign: 1,
      steps: [
        { label: 'حق عائله‌مندی ماهانه حکم', value: money(decree.familyAllowance) },
        { label: 'سهم روزانه = مبلغ ÷ ۳۰', value: money(daily) },
        { label: 'روزهای کارکرد', value: `${fmtDays(jd)} روز` },
        { label: 'نتیجه', value: money(Math.round(daily * jd)) },
      ],
      basis: 'حق عائله‌مندی فقط برای افراد متأهل',
    });
  }

  // ۷) سایر مزایای ثابت حکم ماه تسویه (تفاوت تطبیق، سرپرستی، تحصیلی، بازار کار، جذب، شیفت، اضافه‌کار ثابت، سایر)
  const otherMonth = (decree?.adjustmentDiff ?? 0) + (decree?.supervision ?? 0) + (decree?.educationAid ?? 0)
    + (decree?.laborMarket ?? 0) + (decree?.attractionAmount ?? 0) + (decree?.otherBenefits ?? 0)
    + (decree?.shiftAllowance ?? 0) + (decree?.fixedOvertime ?? 0);
  if (otherMonth > 0) {
    const daily = otherMonth / 30;
    lines.push({
      title: 'سایر مزایای ثابت حکم ماه تسویه',
      detail: `${fmtDays(jd)} روز × روزمزد سایر مزایا ${money(daily)}`,
      amount: Math.round(daily * jd), sign: 1,
      steps: [
        { label: 'جمع سایر مزایای ثابت ماهانه حکم', value: money(otherMonth) },
        { label: 'سهم روزانه = جمع ÷ ۳۰', value: money(daily) },
        { label: 'روزهای کارکرد', value: `${fmtDays(jd)} روز` },
        { label: 'نتیجه', value: money(Math.round(daily * jd)) },
      ],
      basis: 'تفاوت تطبیق، حق سرپرستی، کمک‌هزینه تحصیلی، بازار کار، جذب، شیفت، اضافه‌کار ثابت، سایر مزایا',
    });
  }

  // ۸) مانده مرخصی — روزانه (ماده ۶۴): روزمزد مبنا × مانده روز مرخصی
  const fy = await db.fiscalYear.findFirst({ where: { companyId: p.companyId, jy } });
  let openingLeave = 0;
  if (fy) {
    const ob = await db.openingBalance.findMany({ where: { personnelId, kind: 'leave_balance', unit: 'days' } });
    openingLeave = ob.reduce((s, o) => s + o.amount, 0);
    const fyMonths = await db.attendanceMonth.findMany({ where: { fiscalYearId: fy.id, jm: { lte: jm } }, select: { id: true } });
    if (fyMonths.length) {
      const used = await db.attendanceDaily.groupBy({
        by: ['personnelId'],
        where: { monthId: { in: fyMonths.map((m) => m.id) }, personnelId, leaveMin: { gt: 0 } },
        _sum: { leaveMin: true },
      });
      const usedDays = (used.find((u) => u.personnelId === personnelId)?._sum.leaveMin ?? 0) / 480;
      openingLeave += 2.5 * (jm) - usedDays; // حق امسال − مصرف امسال
    }
  }
  const leaveBalance = Math.max(0, Math.round(openingLeave * 100) / 100);
  lines.push({
    title: 'مانده مرخصی (ماده ۶۴)',
    detail: `${fmtDays(leaveBalance)} روز × روزمزد مبنا ${money(mizanDaily)}`,
    amount: Math.round(leaveBalance * mizanDaily), sign: 1,
    steps: [
      { label: 'مانده مرخصی انباشته (حق ۲٫۵ روز در ماه − مصرفی)', value: `${fmtDays(leaveBalance)} روز` },
      { label: 'مزد مبنا ماهانه = مزد شغل + مزد سنوات', value: money(mizanMonth) },
      { label: 'روزمزد مبنا = مزد مبنا ÷ ۳۰', value: money(mizanDaily) },
      { label: 'نتیجه = روزها × روزمزد مبنا', value: money(Math.round(leaveBalance * mizanDaily)) },
    ],
    basis: 'ماده ۶۴ قانون کار — مزد مرخصی بر مبنای مزد مبنا و به‌صورت روزانه',
  });

  // ۹) عیدی و پاداش — روزانه (مصوبه ۱۳۷۰/۱۲/۰۶): ۶۰ روز مزد مبنا در سال کامل
  //    عیدی = روزمزد مبنا × ۶۰ ÷ ۳۶۵ × روزهای کارکرد از ابتدای سال — سقف: ۹۰ روز حداقل مزد روزانه به نسبت کارکرد
  const eidiRaw = Math.round(mizanDaily * (60 / 365) * daysThisYearEff);
  const minWageMonthly = fy ? await db.fySetting.findFirst({ where: { fiscalYearId: fy.id, key: 'minimum_wage_monthly' } }) : null;
  const minWage = parseNumberOr(minWageMonthly?.value ?? '0', 0);
  const eidiCap = minWage > 0 ? Math.round((minWage / 30) * (90 / 365) * daysThisYearEff) : 0;
  const eidi = eidiCap > 0 ? Math.min(eidiRaw, eidiCap) : eidiRaw;
  lines.push({
    title: 'عیدی و پاداش به نسبت کارکرد (روزانه)',
    detail: `${fmtDays(daysThisYearEff)} روز کارکرد امسال × روزمزد مبنا ${money(mizanDaily)} × ۶۰ ÷ ۳۶۵${eidiCap > 0 && eidiRaw > eidiCap ? ' (محدود به سقف قانونی)' : ''}`,
    amount: eidi, sign: 1,
    steps: [
      { label: 'روزهای کارکرد از ابتدای سال مالی تا تاریخ تسویه', value: `${fmtDays(daysThisYearEff)} روز` },
      { label: 'مزد مبنا ماهانه = مزد شغل + مزد سنوات', value: money(mizanMonth) },
      { label: 'روزمزد مبنا = مزد مبنا ÷ ۳۰', value: money(mizanDaily) },
      { label: 'سهم روزانه عیدی = روزمزد × ۶۰ ÷ ۳۶۵ (۶۰ روز در سال کامل)', value: money(Math.round(mizanDaily * 60 / 365)) },
      { label: 'نتیجه اولیه = روزهای کارکرد × سهم روزانه', value: money(eidiRaw) },
      ...(eidiCap > 0 ? [
        { label: 'سقف قانونی = حداقل مزد روزانه × ۹۰ ÷ ۳۶۵ × روزهای کارکرد', value: money(eidiCap) },
        { label: 'نتیجه نهایی (حد سقف)', value: money(eidi) },
      ] : []),
    ],
    basis: 'ماده واحده قانون عیدی مصوب ۱۳۷۰/۱۲/۰۶ — سال کامل ۶۰ روز مزد مبنا تا سقف ۹۰ روز حداقل مزد روزانه؛ محاسبه به‌صورت روزانه',
  });

  // ۱۰) سنوات (مزایای پایان کار) — روزانه (مواد ۲۴ و ۲۷): هر سال کامل یک ماه آخرین مزد ثابت
  //     سنوات = روزمزد ثابت × ۳۰ ÷ ۳۶۵ × کل روزهای کارکرد
  if (serviceDays > 0) {
    const seniority = Math.round(fixedDaily * (30 / 365) * serviceDays);
    lines.push({
      title: 'سنوات (مزایای پایان کار) — روزانه',
      detail: `${toFa(serviceDays)} روز کارکرد کل × روزمزد ثابت ${money(Math.round(fixedDaily))} × ۳۰ ÷ ۳۶۵`,
      amount: seniority, sign: 1,
      steps: [
        { label: 'کل روزهای کارکرد از تاریخ استخدام تا تسویه', value: `${toFa(serviceDays)} روز (${toFa(serviceYears)} سال)` },
        { label: 'مزد ثابت ماهانه = مزد مبنا + مسکن + بن', value: money(fixedMonth) },
        { label: 'روزمزد ثابت = مزد ثابت ÷ ۳۰', value: money(Math.round(fixedDaily)) },
        { label: 'سهم روزانه سنوات = روزمزد ثابت × ۳۰ ÷ ۳۶۵ (یک ماه مزد در سال کامل)', value: money(Math.round(fixedDaily * 30 / 365)) },
        { label: 'نتیجه = کل روزهای کارکرد × سهم روزانه', value: money(seniority) },
      ],
      basis: 'مواد ۲۴ و ۲۷ قانون کار — سنوات شاغل = یک ماه آخرین مزد ثابت به ازای هر سال؛ محاسبه به‌صورت روزانه (تناسب روزهای کارکرد)',
    });
  }

  // ۱۱) کسور وام
  const loans = await db.loan.findMany({ where: { personnelId, active: true } });
  for (const l of loans) {
    const remain = l.remaining ?? Math.max(0, l.totalAmount - l.installment * l.paidCount);
    if (remain > 0) lines.push({
      title: `مانده وام — ${l.title}`, detail: `${toFa(l.installmentsCount - l.paidCount)} قسط باقیمانده`, amount: remain, sign: -1,
      steps: [
        { label: 'مبلغ کل وام', value: money(l.totalAmount) },
        { label: 'قسط پرداخت‌شده', value: `${toFa(l.paidCount)} از ${toFa(l.installmentsCount)}` },
        { label: 'مانده باقیمانده', value: money(remain) },
      ],
    });
  }

  // ۱۲) کسور مساعده
  const advances = await db.advance.findMany({ where: { personnelId, recovered: false } });
  for (const a of advances) {
    lines.push({
      title: 'مساعده دریافتی', detail: `تاریخ: ${a.payDate || '—'}`, amount: a.amount, sign: -1,
      steps: [{ label: 'مبلغ مساعده پرداختی', value: money(a.amount) }, { label: 'تاریخ پرداخت', value: toFa(a.payDate || '—') }],
    });
  }

  // ۱۳) مانده حقوق پرداخت‌نشده ماه قبل
  if (fy) {
    const prevJm = jm === 1 ? 12 : jm - 1;
    const prevJy = jm === 1 ? jy - 1 : jy;
    const prevFy = prevJm === 12 ? await db.fiscalYear.findFirst({ where: { companyId: p.companyId, jy: prevJy } }) : fy;
    if (prevFy) {
      const prevPeriod = await db.payrollPeriod.findUnique({
        where: { fiscalYearId_jy_jm: { fiscalYearId: prevFy.id, jy: prevJy, jm: prevJm } },
        include: { summaries: { where: { personnelId } } },
      });
      const prevSum = prevPeriod?.summaries[0];
      if (prevSum && !prevSum.payPaid) {
        lines.push({
          title: 'حقوق پرداخت‌نشده ماه قبل', detail: `دوره ${toFa(prevJy)}/${toFa(String(prevJm).padStart(2, '0'))} — خالص + مانده`,
          amount: prevSum.netPay + prevSum.prevBalance, sign: 1,
          steps: [
            { label: `خالص حقوق دوره ${toFa(prevJy)}/${toFa(String(prevJm).padStart(2, '0'))}`, value: money(prevSum.netPay) },
            { label: 'مانده قبلی', value: money(prevSum.prevBalance) },
            { label: 'نتیجه', value: money(prevSum.netPay + prevSum.prevBalance) },
          ],
        });
      }
    }
  }

  const totalDue = lines.filter((l) => l.sign === 1).reduce((s, l) => s + l.amount, 0);
  const totalDeduct = lines.filter((l) => l.sign === -1).reduce((s, l) => s + l.amount, 0);
  return {
    personnel: {
      id: p.id, fullName: `${p.firstName} ${p.lastName}`.trim(), personnelCode: p.personnelCode,
      nationalId: p.nationalId, jobTitle: p.jobTitle, department: p.department || 'عمومی',
      hireDate: p.hireDate, endWorkDate: p.endWorkDate || to,
    },
    toDate: to,
    serviceYears,
    serviceDays,
    daysThisYear: daysThisYearEff,
    lines,
    totalDue,
    totalDeduct,
    net: totalDue - totalDeduct,
    decreeUsed: decree?.effectiveDate ?? '—',
    dailyWage: Math.round(fixedDaily),
    mizanDaily,
  };
}

/** HTML فرم تسویه‌حساب استاندارد — چاپ A4 با امضا
 *  ۱٫۴٫۵: هر مبلغ کلیک‌پذیر است و مراحل محاسبه را نشان می‌دهد (calcTrace داخل صفحه) */
export interface SettlementExtra { photo?: string; bankName?: string; bankAccount?: string; bankSheba?: string }
export function settlementHtml(r: SettlementResult, companyName: string, logoData?: Buffer, extra?: SettlementExtra): string {
  const logoMime = logoData ? (logoData[0] === 0xff && logoData[1] === 0xd8 ? 'image/jpeg' : 'image/png') : 'image/png';
  const logo = logoData ? `<img src="data:${logoMime};base64,${logoData.toString('base64')}" style="height:56px" />` : '';
  const imgStyle = 'width:23mm;height:29mm;object-fit:cover;border:1px solid #999;border-radius:4px';
  const asIs = isSafeImageDataUrl(extra?.photo);
  const wrapped = !asIs && extra?.photo && !extra.photo.includes(':') ? isSafeImageDataUrl(`data:image/png;base64,${extra.photo}`) : undefined;
  const photoData = asIs ?? wrapped;
  const photo = photoData ? `<img src="${photoData}" style="${imgStyle}" alt="عکس پرسنلی" />` : '';
  const rows = r.lines.map((l, i) => `
    <tr>
      <td style="text-align:center">${toFa(i + 1)}</td>
      <td>${esc(l.title)}</td>
      <td style="font-size:10.5px;color:#333">${esc(l.detail)}</td>
      <td class="amt" data-line="${i}" style="text-align:center;font-weight:${l.sign === 1 ? 'bold' : 'normal'};color:${l.sign === 1 ? '#14532d' : '#7f1d1d'};cursor:pointer;text-decoration:underline dotted">${l.sign === 1 ? '+' : '−'} ${money(l.amount)}</td>
    </tr>`).join('');
  const traceData = JSON.stringify(r.lines.map((l) => ({ title: l.title, steps: l.steps ?? [], basis: l.basis ?? '' })));
  const totalsTrace = JSON.stringify({
    due: { title: 'جمع مطالبات همکار', steps: r.lines.filter((l) => l.sign === 1).map((l) => ({ label: l.title, value: money(l.amount) })) },
    deduct: { title: 'جمع بدهی همکار', steps: r.lines.filter((l) => l.sign === -1).map((l) => ({ label: l.title, value: money(l.amount) })) },
    net: { title: 'خالص قابل پرداخت', steps: [
      { label: 'جمع مطالبات', value: money(r.totalDue) },
      { label: 'منهای: جمع بدهی', value: '− ' + money(r.totalDeduct) },
      { label: 'نتیجه', value: money(r.net) },
    ] },
  });
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="UTF-8" />
<title>فرم تسویه حساب — ${r.personnel.fullName}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: 'Vazirmatn', 'Tahoma', sans-serif; font-size: 12px; color: #111; }
  .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1f3a5f; padding-bottom: 6px; }
  .title { font-size: 16px; font-weight: 800; text-align: center; flex: 1; }
  .box { border: 1px solid #999; border-radius: 6px; padding: 8px 10px; margin-top: 10px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 14px; font-size: 11.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
  th, td { border: 1px solid #888; padding: 5px 7px; }
  th { background: #eef2f7; font-size: 11px; }
  .totals td { font-weight: 800; background: #f6f8fa; }
  .law { font-size: 10.5px; line-height: 1.9; text-align: justify; margin-top: 10px; background:#fbfaf7; border:1px dashed #b9a77c; padding:8px 10px; border-radius:6px; }
  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
  .sign-box { border: 1px solid #888; border-radius: 6px; padding: 8px; text-align: center; min-height: 118px; }
  .sign-box .lbl { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
  .sign-box .sub { font-size: 10px; color: #555; }
  .fp { margin-top: 6px; width: 92px; height: 52px; border: 1.2px dashed #666; border-radius: 4px; display: inline-flex; align-items: flex-end; justify-content: center; font-size: 9px; color: #777; }
  @media print { .noprint { display: none; } #traceBox { display: none !important; } }
  .noprint { position: fixed; top: 8px; left: 8px; }
  #traceBox { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: none; z-index: 999; align-items: center; justify-content: center; }
  #traceCard { background: #fff; border-radius: 10px; max-width: 640px; width: 92%; max-height: 80vh; overflow: auto; padding: 16px 18px; }
  #traceCard h3 { margin: 0 0 8px; font-size: 15px; color: #0f5c5a; }
  #traceCard table { font-size: 12px; margin-top: 0; }
  #traceCard th { background: #0f5c5a; color: #fff; }
  #traceCard .basis { font-size: 11px; color: #555; background: #fbfaf7; border: 1px dashed #b9a77c; border-radius: 6px; padding: 6px 8px; margin-top: 8px; }
  #traceClose { float: left; cursor: pointer; border: 1px solid #999; background: #f6f8fa; border-radius: 6px; padding: 2px 10px; }
</style></head>
<body>
  <button class="noprint" onclick="window.print()">چاپ (Ctrl+P)</button>
  <div class="head">
    ${logo}
    <div class="title">فرم تسویه حساب و پایان کار<br /><span style="font-size:11px;font-weight:400">${companyName}</span></div>
    <div style="font-size:10.5px;min-width:120px">شماره فرم: TS-01<br />تاریخ تنظیم: ${toFa(r.toDate)}</div>
  </div>

  <div class="box" style="display:flex;gap:12px;align-items:flex-start">
    ${photo ? `<div style="flex-shrink:0">${photo}</div>` : ''}
    <div class="grid" style="flex:1">
      <div><b>نام و نام خانوادگی:</b> ${esc(toFa(r.personnel.fullName))}</div>
      <div><b>کد پرسنلی:</b> ${toFa(r.personnel.personnelCode)}</div>
      <div><b>کد ملی:</b> ${toFa(r.personnel.nationalId || '—')}</div>
      <div><b>عنوان شغل:</b> ${esc(toFa(r.personnel.jobTitle || '—'))}</div>
      <div><b>بخش:</b> ${esc(toFa(r.personnel.department))}</div>
      <div><b>تاریخ استخدام:</b> ${toFa(r.personnel.hireDate || '—')}</div>
      <div><b>تاریخ پایان کار:</b> ${toFa(r.personnel.endWorkDate)}</div>
      <div><b>کل روزهای کارکرد:</b> ${toFa(r.serviceDays)} روز (${toFa(r.serviceYears)} سال)</div>
      <div><b>مبنا: حکم مورخ:</b> ${toFa(r.decreeUsed)}</div>
    </div>
  </div>

  <div class="box" style="background:#f8fafc">
    <div class="grid">
      <div><b>بانک پرداخت:</b> ${esc(toFa(extra?.bankName || '—'))}</div>
      <div><b>شماره حساب همکار:</b> ${esc(toFa(extra?.bankAccount || '—'))}</div>
      <div><b>شماره شبا:</b> ${esc(toFa(extra?.bankSheba || '—'))}</div>
    </div>
    <p style="font-size:10.5px;color:#333;margin:8px 4px 0;line-height:1.8">
      <b>توضیح پرداخت:</b> مبلغ خالص قابل پرداخت (${money(r.net)} ریال) بابت تسویه‌حساب و پایان کار همکار، طبق جدول فوق به شماره حساب/شبا اعلام‌شده در همین فرم واریز می‌گردد. تاریخ واریز و شماره سند بانکی در بخش امضاها ثبت می‌شود.
    </p>
  </div>

  <table>
    <thead><tr><th style="width:28px">ردیف</th><th style="width:170px">شرح</th><th>محاسبه / جزئیات</th><th style="width:150px">مبلغ</th></tr></thead>
    <tbody>${rows}
      <tr class="totals"><td colspan="3">جمع مطالبات همکار (طلبکار)</td><td class="amt" data-total="due" style="cursor:pointer;text-decoration:underline dotted">${money(r.totalDue)}</td></tr>
      <tr class="totals"><td colspan="3">جمع بدهی همکار (وام و مساعده)</td><td class="amt" data-total="deduct" style="cursor:pointer;text-decoration:underline dotted">${money(r.totalDeduct)}</td></tr>
      <tr class="totals"><td colspan="3">خالص قابل پرداخت هنگام تسویه</td><td class="amt" data-total="net" style="cursor:pointer;text-decoration:underline dotted">${money(r.net)}</td></tr>
    </tbody>
  </table>

  <div class="law">
    <b>اقرارنامه تسویه حساب:</b> ایجانب ${esc(toFa(r.personnel.fullName))}، کارگر/کارمند شرکت ${esc(companyName)} با سمت ${esc(toFa(r.personnel.jobTitle || '—'))}، از تاریخ ${toFa(r.personnel.hireDate || '—')} لغایت ${toFa(r.personnel.endWorkDate)} در شرکت مذکور انجام وظیفه می‌نمودم. بدین‌وسیله گواهی و تأیید می‌نمایم که کلیه حقوق و مزایای پایان کار خود اعم از حقوق و مزایای معوقه، حق مسکن، بن خواروبار و بن کارگری، حق اولاد، عیدی و پاداش، سنوات (مزایای پایان کار موضوع مواد ۲۴ و ۲۷ قانون کار)، اضافه‌کاری، جمعه‌کاری و مانده مرخصی موضوع ماده ۶۴ قانون کار و سایر مزایای متعلقه، منطبق با مقررات قانون کار و آیین‌نامه‌های مربوطه به شرح جدول فوق محاسبه گردید و مبلغ خالص ${money(r.net)} ریال به شماره حساب/شبا اعلام‌شده در همین فرم واریز و کامل دریافت نموده‌ام و با شرکت قطع همکاری نموده‌ام و من بعد حق هرگونه ادعا و شکایتی بابت کارکرد و مزایای دوره همکاری خود نسبت به شرکت مذکور را از خود سلب می‌نمایم. تسویه حساب بانکی، امانات و لوازم شرکت نیز انجام شده است و این فرم به‌همراه فیش پرداخت و سند بانکی ضمیمه می‌باشد.
  </div>

  <div class="signs">
    <div class="sign-box">
      <div class="lbl">امضا و اثر انگشت همکار (تسویه‌کننده)</div>
      <div class="sub">نام: ${esc(toFa(r.personnel.fullName))} — کد پرسنلی: ${toFa(r.personnel.personnelCode)}</div>
      <div class="fp">اثر انگشت</div>
    </div>
    <div class="sign-box">
      <div class="lbl">امضا و مهر کارفرما / مدیرعامل</div>
      <div class="sub">${esc(companyName)}</div>
      <div style="margin-top:26px"></div>
    </div>
  </div>

  <div id="traceBox" onclick="if(event.target===this)this.style.display='none'">
    <div id="traceCard">
      <button id="traceClose" onclick="document.getElementById('traceBox').style.display='none'">بستن</button>
      <h3 id="traceTitle"></h3>
      <table width="100%" cellspacing="0"><thead><tr><th style="width:52%">مرحله محاسبه</th><th>مقدار</th></tr></thead><tbody id="traceBody"></tbody></table>
      <div class="basis" id="traceBasis"></div>
    </div>
  </div>
  <script>
    var LINES = ${traceData};
    var TOTALS = ${totalsTrace};
    function showTrace(t) {
      document.getElementById('traceTitle').textContent = t.title;
      document.getElementById('traceBody').innerHTML = t.steps.map(function(s){
        return '<tr><td style="border:1px solid #888;padding:4px 8px">' + s.label + '</td><td style="border:1px solid #888;padding:4px 8px;text-align:left;white-space:nowrap">' + s.value + '</td></tr>';
      }).join('') || '<tr><td colspan="2">مرحله‌ای ثبت نشده است</td></tr>';
      document.getElementById('traceBasis').textContent = t.basis ? 'مبنای قانونی: ' + t.basis : '';
      document.getElementById('traceBox').style.display = 'flex';
    }
    document.querySelectorAll('.amt').forEach(function(el) {
      el.addEventListener('click', function() {
        if (el.dataset.line !== undefined) { var l = LINES[Number(el.dataset.line)]; if (l) showTrace(l); }
        else if (el.dataset.total) showTrace(TOTALS[el.dataset.total]);
      });
    });
  </script>
</body></html>`;
}
