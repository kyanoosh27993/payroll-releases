// سرویس محاسبه دوره حقوق — اتصال داده‌های Prisma به موتور محاسبه
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from '@/lib/db';
import { calcEmployee, CalcItem, DecreeData } from './payroll-engine';
import { monthStats } from './shifts';
import { holidaySetOfMonth } from './calendar';
import { daysInMonth as jDaysInMonth } from './jalali';
import { parseNumberOr, parseJalaliDateStr } from './numbers';

export const FY_DEFAULTS: Record<string, string> = {
  monthly_required_hours: '176',
  // جدول ساعات موظفی سالانه (اعلان اداره کار) — مورد ۱۰ نسخه ۱٫۴٫۳
  // مقدار هر ماه؛ اگر خالی باشد monthly_required_hours ملاک است
  required_hours_m1: '', required_hours_m2: '', required_hours_m3: '',
  required_hours_m4: '', required_hours_m5: '', required_hours_m6: '',
  required_hours_m7: '', required_hours_m8: '', required_hours_m9: '',
  required_hours_m10: '', required_hours_m11: '', required_hours_m12: '',
  sso_worker_rate: '7',
  sso_employer_rate: '20', // ۲۰٪ کارفرما + ۳٪ بیکاری = ۲۳٪ کل
  sso_unemployment_rate: '3',
  sso_ceiling_30d: '1163788500',
  sso_ceiling_31d: '1202581450',
  overtime_factor: '1.4',
  holiday_work_factor: '1.7',
  friday_work_factor: '1.4',
  night_work_percent: '35',
  shift1_percent: '10', shift2_percent: '15', shift3_percent: '22.5',
  m84_monthly_exemption: '400000000',
  late_grace_minutes: '5',
  early_grace_minutes: '5',
  // سقف ماهانه مزایای قانونی اعلامی اداره کار (ریال) — ۰ = بدون سقف (گزاره ۳ نسخه ۱٫۲٫۰)
  housing_cap_monthly: '0',
  worker_ben_cap_monthly: '0',
  child_allowance_cap_monthly: '0',
  family_allowance_cap_monthly: '0',
  // حداقل دستمزد ماهانه سال (ریال) — پایه حقوق وزارت کار = حداقل دستمزد روزانه × ۳۰؛ سقف عیدی؛ ۰ = بدون سقف
  minimum_wage_monthly: '0',
  // پایه سنوات ماهانه سال (ریال) — پایه سنوات روزانه = پایه ماهانه ÷ ۳۰
  seniority_base_monthly: '0',
  // حق مسکن ماهانه سال (ریال) — وقتی حکم فرد مقدار ندارد
  housing_monthly: '0',
  // بن خواروبار ماهانه سال (ریال)
  worker_ben_monthly: '0',
  // حق عائله‌مندی (متأهل) ماهانه سال (ریال)
  family_allowance_monthly: '0',
  // حق اولاد به‌ازای هر فرزند، ماهانه سال (ریال) — در محاسبه × تعداد فرزند پرسنل
  child_allowance_monthly: '0',
  // شب‌کاری غیرموظفی (اضافه‌کار شب): درصد اضافه بر مزد ساعتی — جمعاً ۱۰۰+۷۵=۱۷۵٪
  night_ot_percent: '75',
  // جمعه‌کاری بدون تعطیلی جایگزین — جمعاً ۱٫۸ (ماده ۶۲ + ماده ۵۹)
  friday_no_replace_factor: '1.8',
  // مزد روزانه = مزد ماهانه ÷ ۳۰ و مزد ساعتی = روزانه ÷ ۷٫۳۳ (ماده ۵۹)
  daily_divisor_days: '30',
  hourly_divisor_hours: '7.33',
  // مزد مبنا شامل مزد سنوات باشد (۱ = بله)
  mizan_include_seniority: '1',
};

export const TAX_BRACKETS_1405 = [
  { seq: 1, fromAmount: 0, toAmount: 400_000_000, ratePercent: 0 },
  { seq: 2, fromAmount: 400_000_000, toAmount: 800_000_000, ratePercent: 10 },
  { seq: 3, fromAmount: 800_000_000, toAmount: 1_000_000_000, ratePercent: 15 },
  { seq: 4, fromAmount: 1_000_000_000, toAmount: 1_200_000_000, ratePercent: 20 },
  { seq: 5, fromAmount: 1_200_000_000, toAmount: 1_400_000_000, ratePercent: 25 },
  { seq: 6, fromAmount: 1_400_000_000, toAmount: null, ratePercent: 30 },
];

export const DEFAULT_PAYROLL_ITEMS: Array<{
  code: string; title: string; kind: 'earning' | 'deduction' | 'employer';
  formulaKey: string; taxMode: string; insured: boolean; sort: number; systemLocked: boolean;
}> = [
  { code: 'base_wage', title: 'حقوق (مزد شغل)', kind: 'earning', formulaKey: 'decree_job_wage', taxMode: 'm84', insured: true, sort: 10, systemLocked: true },
  { code: 'seniority', title: 'مزد سنوات', kind: 'earning', formulaKey: 'decree_field:seniority_wage', taxMode: 'm84', insured: true, sort: 20, systemLocked: true },
  { code: 'housing', title: 'حق مسکن', kind: 'earning', formulaKey: 'decree_field:housing', taxMode: 'm84', insured: true, sort: 30, systemLocked: true },
  { code: 'food', title: 'خواروبار', kind: 'earning', formulaKey: 'decree_field:food', taxMode: 'm84', insured: true, sort: 40, systemLocked: true },
  { code: 'child_allow', title: 'حق اولاد', kind: 'earning', formulaKey: 'decree_field:child_allowance', taxMode: 'none', insured: false, sort: 50, systemLocked: true },
  { code: 'worker_ben', title: 'بن کارگری', kind: 'earning', formulaKey: 'decree_field:worker_ben', taxMode: 'none', insured: true, sort: 60, systemLocked: true },
  { code: 'overtime', title: 'اضافه‌کاری', kind: 'earning', formulaKey: 'overtime_140', taxMode: 'm84', insured: true, sort: 70, systemLocked: true },
  { code: 'holiday_work', title: 'تعطیل‌کاری', kind: 'earning', formulaKey: 'holiday_work_170', taxMode: 'm84', insured: true, sort: 80, systemLocked: true },
  { code: 'friday_work', title: 'جمعه‌کاری', kind: 'earning', formulaKey: 'friday_work_140', taxMode: 'm84', insured: true, sort: 90, systemLocked: true },
  { code: 'night_work', title: 'شب‌کاری', kind: 'earning', formulaKey: 'night_work_35', taxMode: 'm84', insured: true, sort: 100, systemLocked: true },
  { code: 'shift_allow', title: 'حق شیفت (درصد شیفت × ساعات غیرشب)', kind: 'earning', formulaKey: 'shift_premium_percent', taxMode: 'm84', insured: true, sort: 110, systemLocked: true },
  { code: 'attraction', title: 'حق جذب', kind: 'earning', formulaKey: 'decree_field:attraction_amount', taxMode: 'm84', insured: true, sort: 120, systemLocked: true },
  { code: 'family_allow', title: 'حق عائله‌مندی', kind: 'earning', formulaKey: 'decree_field:family_allowance', taxMode: 'none', insured: false, sort: 130, systemLocked: true },
  { code: 'adjustment', title: 'تفاوت تطبیق', kind: 'earning', formulaKey: 'decree_field:adjustment_diff', taxMode: 'm84', insured: true, sort: 140, systemLocked: true },
  { code: 'supervision', title: 'حق سرپرستی', kind: 'earning', formulaKey: 'decree_field:supervision', taxMode: 'm84', insured: true, sort: 150, systemLocked: true },
  { code: 'labor_market', title: 'فوق‌العاده بازار کار', kind: 'earning', formulaKey: 'decree_field:labor_market', taxMode: 'm84', insured: true, sort: 160, systemLocked: true },
  { code: 'education_aid', title: 'کمک‌هزینه تحصیلی', kind: 'earning', formulaKey: 'decree_field:education_aid', taxMode: 'm84', insured: true, sort: 170, systemLocked: true },
  { code: 'fixed_ot', title: 'اضافه‌کار ثابت', kind: 'earning', formulaKey: 'decree_field:fixed_overtime', taxMode: 'm84', insured: true, sort: 180, systemLocked: true },
  { code: 'other_ben', title: 'سایر مزایا (با بیمه و مالیات)', kind: 'earning', formulaKey: 'decree_field:other_benefits', taxMode: 'm84', insured: true, sort: 190, systemLocked: true },
  { code: 'tax_free_other', title: 'سایر مزایا (بدون بیمه و مالیات)', kind: 'earning', formulaKey: 'manual', taxMode: 'none', insured: false, sort: 200, systemLocked: false },
  { code: 'ob_ins', title: 'مانده‌های اولیه (مشمول بیمه و مالیات)', kind: 'earning', formulaKey: 'ob_earning_ins', taxMode: 'm84', insured: true, sort: 195, systemLocked: true },
  { code: 'ob_free', title: 'مانده‌های اولیه (بدون بیمه و مالیات)', kind: 'earning', formulaKey: 'ob_earning_free', taxMode: 'none', insured: false, sort: 205, systemLocked: true },
  { code: 'worker_ins', title: 'بیمه سهم کارگر (۷٪)', kind: 'deduction', formulaKey: 'worker_insurance', taxMode: 'none', insured: false, sort: 500, systemLocked: true },
  { code: 'tax', title: 'مالیات حقوق', kind: 'deduction', formulaKey: 'salary_tax', taxMode: 'none', insured: false, sort: 510, systemLocked: true },
  { code: 'loan_install', title: 'قسط وام', kind: 'deduction', formulaKey: 'loan_installment', taxMode: 'none', insured: false, sort: 520, systemLocked: false },
  { code: 'advance', title: 'مساعده', kind: 'deduction', formulaKey: 'advance_amount', taxMode: 'none', insured: false, sort: 530, systemLocked: false },
  { code: 'other_deduct', title: 'سایر کسورات', kind: 'deduction', formulaKey: 'manual', taxMode: 'none', insured: false, sort: 540, systemLocked: false },
  { code: 'ob_deduct', title: 'کسور مانده‌های اولیه', kind: 'deduction', formulaKey: 'ob_deduction', taxMode: 'none', insured: false, sort: 545, systemLocked: true },
  { code: 'employer_ins', title: 'بیمه سهم کارفرما (۲۰٪)', kind: 'employer', formulaKey: 'employer_insurance', taxMode: 'none', insured: false, sort: 900, systemLocked: true },
  { code: 'unemployment', title: 'بیمه بیکاری (۳٪)', kind: 'employer', formulaKey: 'unemployment_insurance', taxMode: 'none', insured: false, sort: 910, systemLocked: true },
];

// ---------------- پشتیبان‌گیری خودکار و بی‌صدا ----------------
// پس از هر محاسبهٔ موفق دوره، یک کپی از دیتابیس با پسوند تاریخ در پوشهٔ پشتیبان ذخیره می‌شود
// و نسخه‌های قدیمی‌تر از ۳۰ روز خودکار حذف می‌گردند. هیچ‌گاه جلوی محاسبه را نمی‌گیرد.
const BACKUP_DIR = path.join(os.homedir(), '.payroll-backups');
/** پشتیبان‌گیری با VACUUM INTO — اسنپ‌شات تمیز و یکپارچه SQLite سازگار با WAL
 *  در صورت خطا به کپی ساده برمی‌گردد؛ هیچ‌گاه خطای پشتیبان‌گیری به محاسبه آسیب نمی‌زند */
async function autoBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '');
    if (!dbPath || !fs.existsSync(dbPath)) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const dest = path.join(BACKUP_DIR, `backup-${dateStr}.db`);
    try {
      fs.rmSync(dest, { force: true });
      await db.$executeRawUnsafe(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    } catch {
      try { fs.copyFileSync(dbPath, dest); } catch { /* بی‌صدا */ }
    }
    // حذف فایل‌های قدیمی‌تر از ۳۰ روز
    const cutoff = Date.now() - 30 * 86400000;
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (!f.startsWith('backup-')) continue;
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      if (stat.mtimeMs < cutoff) fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
  } catch {
    /* اگر پشتیبان‌گیری ممکن نبود، برنامه نباید متوقف شود */
  }
}

/** ساعات موظفی یک ماه مشخص از جدول سالانه — خالی بودن مقدار ماه = ساعات عمومی سال (مورد ۱۰) */
export function requiredHoursOfMonth(settings: Record<string, string>, jm: number): number {
  const v = parseNumberOr(settings[`required_hours_m${jm}`] ?? '', 0);
  if (v > 0) return v;
  return parseNumberOr(settings['monthly_required_hours'], 176) || 176;
}

export async function getFySettings(fyId: number): Promise<Record<string, string>> {
  const rows = await db.fySetting.findMany({ where: { fiscalYearId: fyId } });
  const out = { ...FY_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function ensureFySettings(fyId: number) {
  const c = await db.fySetting.count({ where: { fiscalYearId: fyId } });
  if (c === 0) {
    await db.fySetting.createMany({
      data: Object.entries(FY_DEFAULTS).map(([key, value]) => ({ fiscalYearId: fyId, key, value })),
    });
  }
  const b = await db.taxBracket.count({ where: { fiscalYearId: fyId } });
  if (b === 0) {
    await db.taxBracket.createMany({
      data: TAX_BRACKETS_1405.map((t) => ({ ...t, fiscalYearId: fyId })),
    });
  }
}

/** حکم مؤثر پرسنل در ماه: آخرین حکم با تاریخ اجرا <= آخر ماه */
type AnyDb = typeof db;
export async function effectiveDecree(personnelId: number, jy: number, jm: number, dbc: AnyDb = db) {
  const last = `${jy}/${String(jm).padStart(2, '0')}/31`;
  const rows = await dbc.decree.findMany({
    where: { personnelId, effectiveDate: { lte: last } },
    orderBy: { effectiveDate: 'desc' },
    take: 1,
  });
  if (rows.length) return rows[0];
  // اگر حکمی در ماه نبود، آخرین حکم قبل‌تر
  const any = await dbc.decree.findMany({
    where: { personnelId }, orderBy: { effectiveDate: 'desc' }, take: 1,
  });
  return any[0] ?? null;
}

export interface CalcResult {
  periodId: number;
  count: number;
  inactiveSkipped: string[];
  totalNet: number;
  totalGross: number;
  totalTax: number;
  totalIns: number;
}

/** محاسبه کامل یک دوره حقوق برای همه پرسنل شاغل
 *  - دوره «نهایی» قفل است و بدون بازگشت به پیش‌نویس محاسبه مجدد نمی‌شود
 *  - کل نوشتاری محاسبه داخل یک تراکنش (transaction) انجام می‌شود
 *  - وام/مساعده بعد از کسر بسته می‌شود تا ماه بعد دوباره کسر نشود
 */
export async function calculatePeriod(periodId: number): Promise<CalcResult> {
  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { fiscalYear: true },
  });
  if (!period) throw new Error('دوره یافت نشد');
  if (['نهایی', 'پرداخت‌شده', 'قفل‌شده'].includes(period.status)) {
    throw new Error('این دوره تأیید/نهایی/قفل شده است — برای محاسبه مجدد، ابتدا وضعیت دوره را به «پیش‌نویس» برگردانید');
  }
  const { jy, jm, fiscalYearId } = period;
  const companyId = period.fiscalYear.companyId;

  const [settings, bracketsRaw, itemsRaw] = await Promise.all([
    getFySettings(fiscalYearId),
    db.taxBracket.findMany({ where: { fiscalYearId }, orderBy: { seq: 'asc' } }),
    db.payrollItemConfig.findMany({ where: { active: true }, orderBy: { sort: 'asc' } }),
  ]);
  const brackets = bracketsRaw.map((b) => ({ fromAmount: b.fromAmount, toAmount: b.toAmount, ratePercent: b.ratePercent }));
  const items: CalcItem[] = itemsRaw.map((i) => ({
    code: i.code, title: i.title,
    kind: i.kind as CalcItem['kind'],
    formulaKey: i.formulaKey, taxMode: i.taxMode as CalcItem['taxMode'],
    taxPercent: i.taxPercent, insured: i.insured, active: i.active,
  }));

  // حضور ماه (اگر ایمپورت شده باشد)
  const attMonth = await db.attendanceMonth.findUnique({ where: { fiscalYearId_jy_jm: { fiscalYearId, jy, jm } } });
  const holidays = await holidaySetOfMonth(jy, jm);
  const stats = attMonth ? await monthStats(attMonth.id, holidays) : {};

  const people = await db.personnel.findMany({
    where: { companyId, status: { in: ['شاغل'] } },
    include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 }, loans: { where: { active: true } }, advances: { where: { recovered: false } } },
    orderBy: { personnelCode: 'asc' } // قانون ۱٫۴٫۳: کد پرسنلی صعودی
  });
  const peopleIds = people.map((p) => p.id);

  // --- واکشی دسته‌ای قبل از تراکنش (حذف کوئری‌های N+1 داخل تراکنش) ---
  // احکام همه پرسنل یک‌جا
  const allDecrees = peopleIds.length
    ? await db.decree.findMany({ where: { personnelId: { in: peopleIds } }, orderBy: { effectiveDate: 'desc' } })
    : [];
  const decreesByPerson = new Map<number, typeof allDecrees>();
  for (const d of allDecrees) {
    const arr = decreesByPerson.get(d.personnelId) ?? [];
    arr.push(d);
    decreesByPerson.set(d.personnelId, arr);
  }
  // انتساب شیفت ماه + خود شیفت‌ها یک‌جا
  const assignments = peopleIds.length
    ? await db.shiftAssignment.findMany({ where: { personnelId: { in: peopleIds }, jy, jm } })
    : [];
  const asgByPerson = new Map<number, number>();
  for (const a of assignments) if (!asgByPerson.has(a.personnelId)) asgByPerson.set(a.personnelId, a.shiftId);
  const shiftIds = [...new Set([...asgByPerson.values(), ...people.map((p) => p.shiftId).filter((v): v is number => v !== null)])];
  const shifts = shiftIds.length ? await db.shift.findMany({ where: { id: { in: shiftIds } } }) : [];
  const shiftPct = new Map<number, number>(shifts.map((s) => [s.id, s.premiumPct ?? 0]));
  // مانده‌های اولیه (از قبل) پرسنل — منابع مانده مرخصی و اقلام اثرگذار در حقوق
  const openings = peopleIds.length ? await db.openingBalance.findMany({ where: { personnelId: { in: peopleIds } } }) : [];
  const openByPerson = new Map<number, typeof openings>();
  for (const o of openings) {
    const arr = openByPerson.get(o.personnelId) ?? [];
    arr.push(o);
    openByPerson.set(o.personnelId, arr);
  }
  // مرخصی مصرفی سال مالی تا قبل از این ماه — برای مانده مرخصی واقعی
  const fyMonths = await db.attendanceMonth.findMany({ where: { fiscalYearId, jm: { lt: jm } }, select: { id: true } });
  const prevMonthIds = fyMonths.map((m) => m.id);
  const leaveUsedPrev = new Map<number, number>();
  if (prevMonthIds.length) {
    const leaveRows = await db.attendanceDaily.groupBy({
      by: ['personnelId'],
      where: { monthId: { in: prevMonthIds }, leaveMin: { gt: 0 } },
      _sum: { leaveMin: true },
    });
    for (const r of leaveRows) leaveUsedPrev.set(r.personnelId, (r._sum.leaveMin ?? 0) / 480);
  }

  // مانده حقوق ماه قبل — فروردین از اسفند سال مالی قبل
  let prevFyId = fiscalYearId;
  let prevJm = jm === 1 ? 12 : jm - 1;
  if (jm === 1) {
    const prevFy = await db.fiscalYear.findFirst({ where: { companyId, jy: jy - 1 } });
    if (prevFy) prevFyId = prevFy.id;
  }
  const prevPeriod = await db.payrollPeriod.findUnique({
    where: { fiscalYearId_jy_jm: { fiscalYearId: prevFyId, jy: jm === 1 ? jy - 1 : jy, jm: prevJm } },
    include: { summaries: true },
  });

  const dim = jDaysInMonth(jy, jm);
  const manuals = await db.payrollManual.findMany({ where: { periodId } });

  // برای جلوگیری از بستن دوباره وام/مساعده در محاسبه مجدد:
  // فقط افرادی که هنوز سطر محاسبه‌شده ندارند، وام/مساعده‌شان بسته می‌شود
  const existing = await db.payrollSummary.findMany({ where: { periodId }, select: { personnelId: true } });
  const alreadyCalculated = new Set(existing.map((e) => e.personnelId));

  // انتخاب حکم مؤثر از لیست ازپیش‌واکشی‌شده (اولین حکم با تاریخ اجرا <= آخر ماه، وگرنه آخرین حکم)
  const lastOfJm = `${jy}/${String(jm).padStart(2, '0')}/31`;
  const pickDecree = (list: typeof allDecrees) => list.find((d) => d.effectiveDate <= lastOfJm) ?? list[0] ?? null;

  let totalNet = 0, totalGross = 0, totalTax = 0, totalIns = 0;
  const inactiveSkipped: string[] = [];

  await db.$transaction(async (tx) => {
    await tx.payrollLine.deleteMany({ where: { periodId } });
    await tx.payrollSummary.deleteMany({ where: { periodId } });

    for (const p of people) {
      const stat = stats[p.id] ?? {
        paidDays: dim, leaveDays: 0, overtimeHours: 0, holidayHours: 0, fridayHours: 0,
        unpaidDays: 0, nightHours: 0, workedHours: 0,
      };
      const decreeRow = pickDecree(decreesByPerson.get(p.id) ?? []);
      const decree: DecreeData = {
        jobWage: decreeRow?.jobWage ?? 0, seniorityWage: decreeRow?.seniorityWage ?? 0,
        childAllowance: decreeRow?.childAllowance ?? 0, housing: decreeRow?.housing ?? 0,
        food: decreeRow?.food ?? 0, adjustmentDiff: decreeRow?.adjustmentDiff ?? 0,
        supervision: decreeRow?.supervision ?? 0, educationAid: decreeRow?.educationAid ?? 0,
        laborMarket: decreeRow?.laborMarket ?? 0, attractionPercent: decreeRow?.attractionPercent ?? 0,
        attractionAmount: decreeRow?.attractionAmount ?? 0, otherBenefits: decreeRow?.otherBenefits ?? 0,
        workerBen: decreeRow?.workerBen ?? 0, fixedOvertime: decreeRow?.fixedOvertime ?? 0,
        familyAllowance: decreeRow?.familyAllowance ?? 0, shiftAllowance: decreeRow?.shiftAllowance ?? 0,
      };
      if (!decreeRow) inactiveSkipped.push(`${p.firstName} ${p.lastName} (حکم ندارد)`);
      const contract = p.contracts[0] ?? null;
      // ورودی‌های دستی + مانده‌های اولیه با اثر در حقوق (هر اثر یک‌جا جمع می‌شود)
      const inputs: Record<string, number> = {};
      for (const m of manuals.filter((m) => m.personnelId === p.id)) {
        inputs[m.itemCode] = m.amount;
      }
      const pOpen = openByPerson.get(p.id) ?? [];
      for (const o of pOpen) {
        if (o.consumed || o.unit !== 'amount' || o.effect === 'none') continue;
        if (o.effect === 'earning_ins') inputs.ob_ins = (inputs.ob_ins ?? 0) + o.amount;
        else if (o.effect === 'earning_free') inputs.ob_free = (inputs.ob_free ?? 0) + o.amount;
        else if (o.effect === 'deduction') inputs.ob_deduct = (inputs.ob_deduct ?? 0) + o.amount;
      }
      // درصد حق شیفت: از انتساب ماه، بعد شیفت پیش‌فرض پرونده (واکشی‌شده از Map)
      const sid = asgByPerson.get(p.id) ?? p.shiftId;
      const premiumPct = sid ? (shiftPct.get(sid) ?? 0) : 0;
      const nightH = stat.nightHours || 0;
      const premiumH = Math.max(0, (stat.workedHours || 0) - nightH);
      // نرخ‌های فردی بیمه — روی کپی تنظیمات تا ماده ۱۳۷ (مالیات) هم با نرخ درست محاسبه شود
      const hasPersonalRate = p.ssoWorkerPct !== null || p.ssoEmployerPct !== null || p.ssoUnempPct !== null;
      const personSettings = hasPersonalRate ? { ...settings } : settings;
      if (p.ssoWorkerPct !== null) personSettings.sso_worker_rate = String(p.ssoWorkerPct);
      if (p.ssoEmployerPct !== null) personSettings.sso_employer_rate = String(p.ssoEmployerPct);
      if (p.ssoUnempPct !== null) personSettings.sso_unemployment_rate = String(p.ssoUnempPct);
      const ctx = {
        settings: personSettings,
        taxBrackets: brackets,
        decree,
        contract: contract ? {
          contractType: contract.contractType, hourlyRate: contract.hourlyRate,
          dailyRate: contract.dailyRate, monthlyWage: contract.monthlyWage,
          projectAmount: contract.projectAmount,
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
      const { lines, summary } = calcEmployee(ctx, items);
      // مانده مرخصی واقعی = مانده از قبل + حق مرخصی انباشته (۲/۵ روز در ماه) − مرخصی مصرفی سال مالی
      const openingLeave = (openByPerson.get(p.id) ?? [])
        .filter((o) => o.kind === 'leave_balance' && o.unit === 'days')
        .reduce((s, o) => s + o.amount, 0);
      let monthsElapsed = jm;
      const hire = parseJalaliDateStr(p.hireDate);
      if (hire && hire[0] === jy) monthsElapsed = Math.max(0, jm - hire[1] + 1);
      else if (hire && hire[0] > jy) monthsElapsed = 0;
      const leaveUsed = (leaveUsedPrev.get(p.id) ?? 0) + (stat.leaveDays || 0);
      const leaveBalance = Math.round((openingLeave + 2.5 * monthsElapsed - leaveUsed) * 100) / 100;
      const prev = prevPeriod?.summaries.find((s) => s.personnelId === p.id);
      const prevBalance = (prev && !prev.payPaid) ? prev.netPay : 0;
      await tx.payrollLine.createMany({
        data: lines.map((l) => ({ periodId, personnelId: p.id, itemCode: l.itemCode, amount: l.amount })),
      });
      await tx.payrollSummary.create({
        data: {
          periodId, personnelId: p.id,
          workedDays: stat.paidDays, leaveDays: stat.leaveDays,
          leaveBalance, overtimeMin: Math.round((stat.overtimeHours || 0) * 60),
          gross: summary.gross, insuredBase: summary.insuredBase,
          workerIns: summary.workerIns, employerIns: summary.employerIns,
          unemploymentIns: summary.unemploymentIns, taxBase: summary.taxBase,
          tax: summary.tax, totalDeductions: summary.totalDeductions,
          netPay: summary.netPay, prevBalance,
        },
      });

      // بستن وام/مساعده پس از کسر — فقط بار اول (محاسبه مجدد دوباره نمی‌بندد)
      if (!alreadyCalculated.has(p.id)) {
        const loanLine = lines.find((l) => l.itemCode === 'loan_install')?.amount ?? 0;
        if (loanLine > 0) {
          for (const l of p.loans) {
            if (!l.active || l.installment <= 0) continue;
            const paidCount = l.paidCount + 1;
            const finished = l.installmentsCount > 0 && paidCount >= l.installmentsCount;
            await tx.loan.update({
              where: { id: l.id },
              data: {
                paidCount,
                remaining: Math.max(0, (l.remaining ?? l.totalAmount) - l.installment),
                active: finished ? false : l.active,
              },
            });
          }
        }
        const advLine = lines.find((l) => l.itemCode === 'advance')?.amount ?? 0;
        if (advLine > 0) {
          await tx.advance.updateMany({
            where: { personnelId: p.id, recovered: false },
            data: { recovered: true, period: `${jy}-${String(jm).padStart(2, '0')}` },
          });
        }
      }

      totalNet += summary.netPay + prevBalance;
      totalGross += summary.gross;
      totalTax += summary.tax;
      totalIns += summary.workerIns + summary.employerIns + summary.unemploymentIns;
    }

    await tx.payrollPeriod.update({
      where: { id: periodId },
      data: { calculatedAt: new Date() },
    });
  }, { timeout: 180000, maxWait: 15000 });

  // پشتیبان‌گیری خودکار پس از محاسبهٔ موفق دوره
  await autoBackup();

  return { periodId, count: people.length, inactiveSkipped, totalNet, totalGross, totalTax, totalIns };
}
