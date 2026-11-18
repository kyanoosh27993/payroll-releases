// موتور محاسبه حقوق و دستمزد — پورت payroll_engine.py
// مطابق قانون کار (اضافه‌کاری ۱.۴، تعطیل‌کاری ۱.۷، شب‌کاری ۳۵٪)، تامین اجتماعی (۷/۲۳/۳ + سقف) و مالیات ماده ۸۴ پله‌ای
import { parseNumberOr } from './numbers';

export interface CalcItem {
  code: string; title: string; kind: 'earning' | 'deduction' | 'employer';
  formulaKey: string; taxMode: 'none' | 'm84' | 'lump' | 'percent';
  taxPercent: number; insured: boolean; active: boolean;
}

export interface DecreeData {
  jobWage: number; seniorityWage: number; childAllowance: number; housing: number;
  food: number; adjustmentDiff: number; supervision: number; educationAid: number;
  laborMarket: number; attractionPercent: number; attractionAmount: number;
  otherBenefits: number; workerBen: number; fixedOvertime: number;
  familyAllowance: number; shiftAllowance: number;
}

export interface ContractData {
  contractType: string; hourlyRate: number; dailyRate: number;
  monthlyWage: number; projectAmount: number;
}

export interface LoanData { installment: number; active: boolean }
export interface AdvanceData { amount: number; recovered: boolean }

export interface CalcContext {
  settings: Record<string, string>;
  taxBrackets: Array<{ fromAmount: number; toAmount: number | null; ratePercent: number }>;
  decree: DecreeData;
  contract: ContractData | null;
  loans: LoanData[];
  advances: AdvanceData[];
  inputs: Record<string, number>;
  daysInMonth: number;
  paidDays: number;
  overtimeHours: number;
  holidayHours: number;
  fridayHours: number;
  /** ساعات شب‌کاری ۲۲–۰۶ (از دستگاه حضور) */
  nightHours: number;
  /** درصد حق شیفت (نوبت‌کاری) تعریف‌شده برای شیفت فرد — پیش‌فرض ۱۰ */
  premiumPct: number;
  /** نسخه ۱٫۴٫۶ — ریز ساعات مشمول حق شیفت بر حسب درصد شیفت روز (نوبت‌کاری چندگانه) */
  shiftPctHours: Array<{ pct: number; hours: number }>;
  /** نسخه ۱٫۴٫۶ — جمعه‌کاری با روز جایگزین (۴۰٪) و بدون روز جایگزین (۱۸۰٪) */
  fridayReplacedHours: number; fridayNoReplaceHours: number;
  /** وضعیت تأهل (متأهل/مجرد) — برای حق عائله‌مندی و حق اولاد (قانون ۱٫۴٫۳) */
  maritalStatus?: string;
  /** تعداد فرزند/افراد تحت تکفل — حق اولاد = مبلغ هر فرزند × این تعداد (قانون ۱٫۴٫۳) */
  dependents?: number;
  /** ساعات مشمول حق شیفت = کل کارکرد منهای شب‌کاری */
  premiumHours: number;
  leaveDays: number;
  // فیلدهای تجمعی که در طول محاسبه پر می‌شوند
  insuredBase: number;
  taxBase: number;
}

export interface CalcLine { itemCode: string; amount: number }
export interface CalcSummary {
  gross: number; insuredBase: number; workerIns: number; employerIns: number;
  unemploymentIns: number; taxBase: number; tax: number;
  totalDeductions: number; netPay: number;
}

/** قابلیت ۱٫۴٫۵ — ردپای محاسبه: فرمول + مراحل گام‌به‌گام هر قلم */
export interface CalcTraceStep { label: string; value: string }
export interface CalcTrace { formula: string; steps: CalcTraceStep[]; basis?: string; basisShort?: string }

/** نسخه ۱٫۴٫۶ — ریز کوتاه مبنای هر قلم برای ستون «مبنا» فیش حقوقی */
export function shiftBasisShort(ctx: CalcContext): string {
  if (ctx.shiftPctHours?.length) {
    return ctx.shiftPctHours.map((sp) => `${faP(sp.hours)} ساعت × ${faP(sp.pct)}٪`).join(' + ');
  }
  return ctx.premiumHours ? `${faP(ctx.premiumHours)} ساعت × ${faP(ctx.premiumPct)}٪` : '';
}
export function fridayBasisShort(ctx: CalcContext): string {
  const parts: string[] = [];
  if (ctx.fridayReplacedHours) parts.push(`${faP(ctx.fridayReplacedHours)} ساعت جمعه با جایگزین × ۱٫۴`);
  if (ctx.fridayNoReplaceHours) parts.push(`${faP(ctx.fridayNoReplaceHours)} ساعت جمعه بدون جایگزین × ۱٫۸`);
  return parts.join(' + ');
}

const faN = (v: number) => String(Math.round(v || 0).toLocaleString('en-US')).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const faM = (v: number) => `${faN(v)} ریال`;
const faP = (v: number | string) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** فرمول و مراحل هر قلم از روی داده واقعی — برای نمایش با کلیک روی مبلغ */
export function traceLine(item: CalcItem, ctx: CalcContext, amount: number): CalcTrace {
  const mizan = baseWage(ctx);
  const dDaily = dailyWage(ctx);
  const hRate = hourlyRate(ctx);
  const S: CalcTraceStep[] = [];
  const basis = () => `مزد مبنا ماهانه ${faM(mizan)} — روزمزد ${faM(dDaily)} (÷۳۰) — ساعتی ${faM(hRate)} (÷۷٫۳۳، ماده ۵۹)`;
  switch (item.formulaKey) {
    case 'decree_job_wage':
      S.push({ label: 'مزد شغل ماهانه حکم', value: faM(ctx.decree.jobWage) },
        { label: 'روزهای کارکرد ماه', value: `${faP(ctx.paidDays)} از ${faP(ctx.daysInMonth)} روز` },
        { label: 'نتیجه = مزد شغل × کارکرد ÷ روزهای ماه', value: faM(amount) });
      return { formula: 'مزد شغل حکم × (کارکرد ÷ روزهای ماه)', steps: S, basis: basis(), basisShort: `${faP(ctx.paidDays)} روز × روزمزد ${faM(dDaily)}` };
    case 'decree_field:seniority_wage': {
      const perMonth = Number(ctx.decree.seniorityWage) || parseNumberOr(ctx.settings['seniority_base_monthly'], 0);
      S.push({ label: 'مزد سنوات ماهانه (حکم یا پیش‌فرض سال)', value: faM(perMonth) },
        { label: 'روزمزد سنوات = مبلغ ÷ ۳۰', value: faM(perMonth / 30) },
        { label: 'روزهای کارکرد', value: `${faP(ctx.paidDays)} روز` },
        { label: 'نتیجه', value: faM(amount) });
      return { formula: 'مزد سنوات به نسبت روزهای کارکرد', steps: S, basis: 'مزد سنوات جزء مزد ثابت است', basisShort: `${faP(ctx.paidDays)} روز × روزمزد سنوات ${faM(perMonth / 30)}` };
    }
    case 'decree_field:housing':
    case 'decree_field:worker_ben': {
      const field = item.formulaKey.endsWith('housing') ? 'حق مسکن' : 'بن کارگری';
      const raw = item.formulaKey.endsWith('housing') ? ctx.decree.housing : ctx.decree.workerBen;
      S.push({ label: `${field} ماهانه (حکم یا پیش‌فرض سال)`, value: faM(raw) },
        { label: 'روزهای کارکرد', value: `${faP(ctx.paidDays)} از ${faP(ctx.daysInMonth)} روز` },
        ...(ctx.paidDays < ctx.daysInMonth ? [{ label: 'نتیجه به نسبت کارکرد', value: faM(amount) }] : [{ label: 'نتیجه', value: faM(amount) }]));
      return { formula: `${field} به نسبت روزهای کارکرد`, steps: S, basis: `${field} مشمول عیدی و سنوات نیست`, basisShort: `${faP(ctx.paidDays)} روز × (مبلغ ÷ ${faP(ctx.daysInMonth)})` };
    }
    case 'decree_field:child_allowance':
      S.push({ label: 'حق اولاد هر فرزند', value: faM(ctx.decree.childAllowance) },
        { label: 'تعداد فرزند', value: faP(ctx.dependents ?? 0) },
        { label: 'وضعیت تأهل', value: (ctx.maritalStatus ?? 'مجرد') === 'متأهل' ? 'متأهل' : 'مجرد — حق اولاد ندارد' },
        { label: 'نتیجه = هر فرزند × تعداد × نسبت کارکرد', value: faM(amount) });
      const perChild = Number(ctx.decree.childAllowance) || parseNumberOr(ctx.settings['child_allowance_monthly'], 0);
      const kids = ctx.dependents ?? 0;
      return { formula: 'حق اولاد = مبلغ هر فرزند × تعداد فرزند (فقط متأهل)', steps: S, basis: 'حق اولاد فقط برای متأهل و بدون مالیات', basisShort: `${faP(perChild)} × ${faP(kids)} فرزند × ${faP(ctx.paidDays)} روز` };
    case 'decree_field:family_allowance':
      S.push({ label: 'حق عائله‌مندی ماهانه', value: faM(ctx.decree.familyAllowance) },
        { label: 'وضعیت تأهل', value: (ctx.maritalStatus ?? 'مجرد') === 'متأهل' ? 'متأهل' : 'مجرد — تعلق نمی‌گیرد' },
        { label: 'نتیجه', value: faM(amount) });
      return { formula: 'حق عائله‌مندی (فقط متأهل)', steps: S, basis: 'حق عائله‌مندی فقط برای افراد متأهل', basisShort: `${faP(ctx.paidDays)} روز × مبلغ ماهانه` };
    case 'overtime_140':
      S.push(...base(), { label: 'ساعات اضافه‌کاری ماه', value: `${faP(ctx.overtimeHours)} ساعت` },
        { label: 'نتیجه = ساعتی × ۱٫۴ × ساعات', value: faM(amount) });
      return { formula: 'اضافه‌کاری = نرخ ساعتی × ۱٫۴ × ساعات اضافه‌کار', steps: S, basis: 'ماده ۵۹ قانون کار — ۴۰٪ اضافه', basisShort: `${faP(ctx.overtimeHours)} ساعت × ۱٫۴` };
    case 'holiday_work_170':
      S.push(...base(), { label: 'ساعات تعطیل‌کاری', value: `${faP(ctx.holidayHours)} ساعت` },
        { label: 'نتیجه = ساعتی × ۱٫۷ × ساعات', value: faM(amount) });
      return { formula: 'تعطیل‌کاری = نرخ ساعتی × ۱٫۷ × ساعات تعطیل‌کاری', steps: S, basis: 'ماده ۶۲ قانون کار — ۷۰٪ اضافه', basisShort: `${faP(ctx.holidayHours)} ساعت × ۱٫۷` };
    case 'friday_work_140': {
      const noRepl = parseNumberOr(ctx.settings['friday_no_replace_factor'], 1.8);
      const repH = ctx.fridayReplacedHours ?? 0;
      const noH = ctx.fridayNoReplaceHours ?? 0;
      const hasSplit = (ctx.fridayReplacedHours !== undefined || ctx.fridayNoReplaceHours !== undefined);
      if (hasSplit) {
        S.push(...base(),
          { label: 'جمعه‌کاری با روز جایگزین (۴۰٪)', value: `${faP(repH)} ساعت` },
          { label: 'جمعه‌کاری بدون روز جایگزین (۱٫۸)', value: `${faP(noH)} ساعت` },
          { label: 'نتیجه = ساعتی × (۱٫۴ × با جایگزین + ۱٫۸ × بدون جایگزین)', value: faM(amount) });
        return { formula: 'جمعه‌کاری = ساعتی × ۱٫۴ × با جایگزین + ساعتی × ۱٫۸ × بدون جایگزین', steps: S, basis: 'ماده ۶۲ و ۶۳ قانون کار — با روز جایگزین ۴۰٪، بدون جایگزین ۸۰٪ اضافه', basisShort: fridayBasisShort(ctx) };
      }
      S.push(...base(), { label: 'ساعات جمعه‌کاری', value: `${faP(ctx.fridayHours)} ساعت` },
        { label: 'نتیجه = ساعتی × ۱٫۴ × ساعات', value: faM(amount) });
      return { formula: 'جمعه‌کاری = نرخ ساعتی × ۱٫۴ × ساعات جمعه‌کاری', steps: S, basis: 'ماده ۶۲ قانون کار', basisShort: `${faP(ctx.fridayHours)} ساعت جمعه‌کاری × ۱٫۴` };
    }
    case 'night_work_35':
      S.push(...base(), { label: 'ساعات شب‌کاری (۲۲–۰۶)', value: `${faP(ctx.nightHours)} ساعت` },
        { label: 'نتیجه = ساعتی × ۳۵٪ × ساعات', value: faM(amount) });
      return { formula: 'شب‌کاری = نرخ ساعتی × ۳۵٪ × ساعات شب', steps: S, basis: 'ماده ۵۸ قانون کار — ۳۵٪ اضافه', basisShort: `${faP(ctx.nightHours)} ساعت شب × ۳۵٪` };
    case 'shift_premium_percent': {
      const parts = shiftBasisShort(ctx);
      S.push(...base());
      if (ctx.shiftPctHours?.length) {
        for (const sp of ctx.shiftPctHours) {
          S.push({ label: `شیفت ${faP(sp.pct)}٪ — ساعات کارکرد غیرشب`, value: `${faP(sp.hours)} ساعت` });
        }
      } else {
        S.push({ label: 'درصد حق شیفت', value: `${faP(ctx.premiumPct)}٪` },
          { label: 'ساعات مشمول شیفت (کارکرد غیرشب)', value: `${faP(ctx.premiumHours)} ساعت` });
      }
      S.push({ label: 'نتیجه', value: faM(amount) });
      return { formula: 'حق شیفت = نرخ ساعتی × درصد شیفت × ساعات غیرشب', steps: S, basis: 'فوق‌العاده نوبت‌کاری', basisShort: parts };
    }
    case 'worker_insurance':
      S.push({ label: 'مشمول بیمه ماه', value: faM(ctx.insuredBase) },
        { label: 'نرخ سهم کارگر', value: `${faP(ctx.settings['sso_worker_rate'] ?? '7')}٪` },
        { label: 'نتیجه', value: faM(amount) });
      return { formula: 'بیمه سهم کارگر = نرخ٪ × مشمول بیمه', steps: S, basis: 'قانون تامین اجتماعی — سهم کارگر ۷٪' };
    case 'employer_insurance':
      S.push({ label: 'مشمول بیمه ماه', value: faM(ctx.insuredBase) },
        { label: 'نرخ سهم کارفرما (۲۰٪ + ۳٪ بیکاری)', value: `${faP(ctx.settings['sso_employer_rate'] ?? '20')}٪` },
        { label: 'نتیجه', value: faM(amount) });
      return { formula: 'بیمه سهم کارفرما = نرخ٪ × مشمول بیمه', steps: S, basis: 'سهم کارفرما ۲۰٪ + بیکاری ۳٪' };
    case 'unemployment_insurance':
      S.push({ label: 'مشمول بیمه ماه', value: faM(ctx.insuredBase) },
        { label: 'نرخ بیکاری', value: `${faP(ctx.settings['sso_unemployment_rate'] ?? '3')}٪` },
        { label: 'نتیجه', value: faM(amount) });
      return { formula: 'بیمه بیکاری = نرخ٪ × مشمول بیمه', steps: S, basis: 'بیمه بیکاری ۳٪' };
    case 'salary_tax':
      S.push({ label: 'مشمول مالیات ماه (پس از کسر بیمه سهم کارگر — ماده ۱۳۷)', value: faM(ctx.taxBase) },
        { label: 'محاسبه پله‌ای بر جدول مالیات سال مالی', value: faM(amount) });
      return { formula: 'مالیات پله‌ای ماده ۸۴ بر جدول سال مالی', steps: S, basis: 'ماده ۸۴ ق.م.م — پله‌ای سالانه تقسیم بر ماه' };
    case 'loan_installment':
      S.push({ label: 'قسط وام‌های فعال', value: faM(amount) });
      return { formula: 'قسط وام فعال پرسنل', steps: S, basis: 'طبق جدول وام‌های پرسنل' };
    case 'advance_amount':
      S.push({ label: 'مساعده بازپرداخت‌نشده', value: faM(amount) });
      return { formula: 'مساعده‌های بازپرداخت‌نشده', steps: S, basis: 'طبق جدول مساعده‌ها' };
    case 'manual':
      S.push({ label: 'مقدار دستی ثبت‌شده در جدول ورود دستی', value: faM(amount) });
      return { formula: 'ثابت — مقدار دستی', steps: S, basis: 'ورود دستی ماه' };
    default: {
      const title = getFormula(item.formulaKey)?.title ?? item.formulaKey;
      S.push({ label: 'فرمول قلم', value: title }, { label: 'نتیجه', value: faM(amount) });
      return { formula: title, steps: S, basis: basis() };
    }
  }
  function base(): CalcTraceStep[] {
    return [
      { label: 'مزد مبنا ماهانه', value: faM(mizan) },
      { label: 'مزد روزانه = مبنا ÷ ۳۰', value: faM(dDaily) },
      { label: 'مزد ساعتی = روزانه ÷ ۷٫۳۳', value: faM(hRate) },
    ];
  }
}

type FormulaFn = (ctx: CalcContext, item: CalcItem) => number;
const formulas = new Map<string, { title: string; fn: FormulaFn }>();

function register(key: string, title: string, fn: FormulaFn) {
  formulas.set(key, { title, fn });
}

export function getFormula(key: string) { return formulas.get(key); }
export function availableFormulas(): Array<[string, string]> {
  return [...formulas.entries()].map(([k, v]) => [k, v.title]);
}

const r0 = (v: number) => Math.round(v || 0);

/** مزد مبنا (ماهانه) — قانون ۱٫۴٫۳:
 *  «مزد ماهانه = کل حقوق و مزایای مستمر ماهانه به جز حق مسکن، بن کارگری، حق اولاد،
 *  حق تاهل، حق ناهار، حق لباس، ایاب و ذهاب»
 *  شامل مزد شغل + مزد سنوات (قابل تغییر با کلید mizan_include_seniority) */
function baseWage(ctx: CalcContext): number {
  const c = ctx.contract;
  if (c && c.contractType === 'ساعتی' && c.hourlyRate) {
    return c.hourlyRate * parseNumberOr(ctx.settings['monthly_required_hours'], 176);
  }
  if (c && c.contractType === 'روزانه' && c.dailyRate) {
    return c.dailyRate * 30; // مزد روزانه قراردادی × ۳۰ روز
  }
  const includeSeniority = (ctx.settings['mizan_include_seniority'] ?? '1') !== '0';
  return (ctx.decree.jobWage || 0) + (includeSeniority ? (ctx.decree.seniorityWage || 0) : 0);
}

/** مزد روزانه = مزد ماهانه ÷ ۳۰ (قانون ۱٫۴٫۳ — تعداد روزهای ماه ثابت ۳۰) */
export function dailyWage(ctx: CalcContext): number {
  const div = parseNumberOr(ctx.settings['daily_divisor_days'], 30) || 30;
  return baseWage(ctx) / div;
}

/** مزد ساعتی = مزد روزانه ÷ ۷٫۳۳ (ماده ۵۹ — معادل ۱/۲۲۰ مزد ماهانه) */
function hourlyRate(ctx: CalcContext): number {
  const div = parseNumberOr(ctx.settings['hourly_divisor_hours'], 7.33) || 7.33;
  return dailyWage(ctx) / div;
}

function prorate(ctx: CalcContext, amount: number): number {
  if (ctx.daysInMonth <= 0) return amount;
  return amount * ctx.paidDays / ctx.daysInMonth;
}

// ---------------- فرمول‌های اقلام درآمد ----------------
register('decree_job_wage', 'مزد شغل حکم × (کارکرد ÷ روزهای ماه)', (ctx) => r0(prorate(ctx, ctx.decree.jobWage)));
register('decree_job_wage_full', 'مزد شغل حکم (بدون تناسب)', (ctx) => r0(ctx.decree.jobWage));
register('contract_hourly', 'نرخ ساعتی قرارداد × ساعات کارکرد', (ctx) => r0((ctx.contract?.hourlyRate || 0) * ctx.paidDays * 8));
register('contract_daily', 'نرخ روزانه قرارداد × روزهای کارکرد', (ctx) => r0((ctx.contract?.dailyRate || 0) * ctx.paidDays));
register('contract_peyman', 'مبلغ پیمان قرارداد', (ctx) => r0(ctx.contract?.projectAmount || 0));

function decreeField(field: keyof DecreeData, prorated = false) {
  return (ctx: CalcContext) => r0(prorated ? prorate(ctx, Number(ctx.decree[field]) || 0) : Number(ctx.decree[field]) || 0);
}

/** فیلد حکم با سقف قانونی ماهانه (گزاره ۳ نسخه ۱٫۲٫۰)
 *  مبلغ = نسبت کارکرد به طول واقعی ماه (۲۹/۳۰/۳۱) — هرگز بیشتر از سقف اعلامی
 *  اداره کار در تنظیمات سال مالی (سقف ۰ = بدون سقف) */
function cappedDecreeField(field: keyof DecreeData, capKey: string, fyDefaultKey?: string) {
  return (ctx: CalcContext) => {
    const cap = parseNumberOr(ctx.settings[capKey], 0);
    // قانون ۱٫۴٫۳: اگر حکم فرد فاقد مبلغ بود، مقدار پیش‌فرض پارامترهای سال مالی ملاک است
    let raw = Number(ctx.decree[field]) || 0;
    if (!raw && fyDefaultKey) raw = parseNumberOr(ctx.settings[fyDefaultKey], 0);
    let amount = prorate(ctx, raw);
    if (cap > 0) amount = Math.min(amount, cap);
    return r0(amount);
  };
}
register('decree_field:job_wage', 'فیلد حکم: مزد شغل', decreeField('jobWage'));
register('decree_field:seniority_wage', 'فیلد حکم: مزد سنوات (پایه روزانه = پایه ماهانه ÷ ۳۰)', (ctx) => {
  const perMonth = Number(ctx.decree.seniorityWage) || parseNumberOr(ctx.settings['seniority_base_monthly'], 0);
  const daily = perMonth / (parseNumberOr(ctx.settings['daily_divisor_days'], 30) || 30); // پایه سنوات روزانه
  return r0(prorate(ctx, daily * 30)); // متناسب با روزهای کارکرد ماه
});
register('decree_field:housing', 'فیلد حکم: حق مسکن (با سقف قانونی و پیش‌فرض سال مالی)', cappedDecreeField('housing', 'housing_cap_monthly', 'housing_monthly'));
register('decree_field:food', 'فیلد حکم: خواروبار (پیش‌فرض سال مالی)', cappedDecreeField('food', 'worker_ben_cap_monthly', 'worker_ben_monthly'));
register('decree_field:child_allowance', 'فیلد حکم: حق اولاد (مبلغ هر فرزند × تعداد فرزند)', (ctx) => {
  const cap = parseNumberOr(ctx.settings['child_allowance_cap_monthly'], 0);
  const perChild = Number(ctx.decree.childAllowance) || parseNumberOr(ctx.settings['child_allowance_monthly'], 0);
  const kids = ctx.dependents ?? 0;
  const married = (ctx.maritalStatus ?? 'مجرد') === 'متأهل';
  let amount = perChild > 0 && married ? perChild * Math.max(kids, 0) : 0; // حق اولاد فقط برای متأهل
  amount = prorate(ctx, amount);
  if (cap > 0) amount = Math.min(amount, cap);
  return r0(amount);
});
register('decree_field:worker_ben', 'فیلد حکم: بن کارگری (با پیش‌فرض سال مالی)', cappedDecreeField('workerBen', 'worker_ben_cap_monthly', 'worker_ben_monthly'));
register('decree_field:shift_allowance', 'فیلد حکم: حق شیفت', decreeField('shiftAllowance'));
register('decree_field:attraction_amount', 'فیلد حکم: مبلغ حق جذب', decreeField('attractionAmount'));
register('decree_field:family_allowance', 'فیلد حکم: حق عائله‌مندی (فقط متأهل — با پیش‌فرض سال مالی)', (ctx) => {
  const cap = parseNumberOr(ctx.settings['family_allowance_cap_monthly'], 0);
  const married = (ctx.maritalStatus ?? 'مجرد') === 'متأهل';
  const raw = Number(ctx.decree.familyAllowance) || (married ? parseNumberOr(ctx.settings['family_allowance_monthly'], 0) : 0);
  let amount = married ? raw : 0; // حق عائله‌مندی فقط به افراد متأهل
  amount = prorate(ctx, amount);
  if (cap > 0) amount = Math.min(amount, cap);
  return r0(amount);
});
register('decree_field:adjustment_diff', 'فیلد حکم: تفاوت تطبیق', decreeField('adjustmentDiff'));
register('decree_field:supervision', 'فیلد حکم: حق سرپرستی', decreeField('supervision'));
register('decree_field:labor_market', 'فیلد حکم: بازار کار', decreeField('laborMarket'));
register('decree_field:education_aid', 'فیلد حکم: کمک‌هزینه تحصیلی', decreeField('educationAid'));
register('decree_field:fixed_overtime', 'فیلد حکم: اضافه‌کار ثابت', decreeField('fixedOvertime'));
register('decree_field:other_benefits', 'فیلد حکم: سایر مزایا', decreeField('otherBenefits'));

register('overtime_140', 'اضافه‌کاری = نرخ ساعتی × ۱.۴ × ساعات اضافه‌کار', (ctx) =>
  r0(hourlyRate(ctx) * parseNumberOr(ctx.settings['overtime_factor'], 1.4) * ctx.overtimeHours));
register('holiday_work_170', 'تعطیل‌کاری = نرخ ساعتی × ۱.۷ × ساعات تعطیل‌کاری', (ctx) =>
  r0(hourlyRate(ctx) * parseNumberOr(ctx.settings['holiday_work_factor'], 1.7) * ctx.holidayHours));
register('friday_work_140', 'جمعه‌کاری = نرخ ساعتی × ۱٫۴ (با روز جایگزین) / ۱٫۸ (بدون جایگزین) × ساعات جمعه', (ctx) => {
  const noRepl = parseNumberOr(ctx.settings['friday_no_replace_factor'], 1.8);
  if (ctx.fridayReplacedHours !== undefined || ctx.fridayNoReplaceHours !== undefined) {
    return r0(hourlyRate(ctx) * 1.4 * (ctx.fridayReplacedHours || 0) + hourlyRate(ctx) * noRepl * (ctx.fridayNoReplaceHours || 0));
  }
  return r0(hourlyRate(ctx) * parseNumberOr(ctx.settings['friday_work_factor'], 1.4) * ctx.fridayHours);
});
register('night_work_35', 'شب‌کاری = نرخ ساعتی × ۳۵٪ × ساعات شب‌کاری (۲۲–۰۶)', (ctx) =>
  r0(hourlyRate(ctx) * (parseNumberOr(ctx.settings['night_work_percent'], 35) / 100) * ctx.nightHours));
register('night_ot_175', 'شب‌کاری غیرموظفی (اضافه‌کار شب) = نرخ ساعتی × ۱۷۵٪ × ساعات شب', (ctx) =>
  r0(hourlyRate(ctx) * (1 + parseNumberOr(ctx.settings['night_ot_percent'], 75) / 100) * ctx.nightHours));
register('friday_work_180', 'جمعه‌کاری بدون تعطیلی جایگزین = نرخ ساعتی × ۱٫۸ × ساعات جمعه', (ctx) =>
  r0(hourlyRate(ctx) * parseNumberOr(ctx.settings['friday_no_replace_factor'], 1.8) * ctx.fridayHours));
register('shift_premium_percent', 'حق شیفت = نرخ ساعتی × درصد شیفت × ساعات کارکرد غیرشب (تفکیک درصد شیفت هر روز)', (ctx) => {
  if (ctx.shiftPctHours?.length) {
    return r0(ctx.shiftPctHours.reduce((s, sp) => s + hourlyRate(ctx) * (sp.pct / 100) * sp.hours, 0));
  }
  return r0(hourlyRate(ctx) * ((ctx.premiumPct || 0) / 100) * (ctx.premiumHours || 0));
});
register('manual', 'ثابت - مقدار دستی (از جدول ورود دستی)', (ctx, item) => r0(ctx.inputs[item.code] ?? 0));
// مانده‌های اولیه (از قبل) — مبالغ در سرویس محاسبه در inputs جمع می‌شوند
register('ob_earning_ins', 'مانده‌های اولیه مشمول بیمه و مالیات (از جدول مانده‌ها)', (ctx, item) => r0(ctx.inputs[item.code] ?? 0));
register('ob_earning_free', 'مانده‌های اولیه بدون بیمه و مالیات (از جدول مانده‌ها)', (ctx, item) => r0(ctx.inputs[item.code] ?? 0));
register('ob_deduction', 'کسور مانده‌های اولیه (از جدول مانده‌ها)', (ctx, item) => r0(ctx.inputs[item.code] ?? 0));

// ---------------- کسورات و سهم کارفرما ----------------
register('worker_insurance', 'بیمه سهم کارگر = نرخ٪ × مشمول بیمه', (ctx) => r0(ctx.insuredBase * parseNumberOr(ctx.settings['sso_worker_rate'], 7) / 100));
register('employer_insurance', 'بیمه سهم کارفرما = نرخ٪ × مشمول بیمه', (ctx) => r0(ctx.insuredBase * parseNumberOr(ctx.settings['sso_employer_rate'], 20) / 100));
register('unemployment_insurance', 'بیمه بیکاری = نرخ٪ × مشمول بیمه', (ctx) => r0(ctx.insuredBase * parseNumberOr(ctx.settings['sso_unemployment_rate'], 3) / 100));
register('salary_tax', 'مالیات پله‌ای ماده ۸۴ (جدول سال مالی)', (ctx) => calcProgressiveTax(ctx.taxBase, ctx.taxBrackets));
register('loan_installment', 'قسط وام فعال پرسنل', (ctx) => r0(ctx.loans.filter((l) => l.active).reduce((s, l) => s + l.installment, 0)));
register('advance_amount', 'مساعده‌های بازپرداخت‌نشده', (ctx) => r0(ctx.advances.filter((a) => !a.recovered).reduce((s, a) => s + a.amount, 0)));

/** محاسبه مالیات پله‌ای ماده ۸۴ */
export function calcProgressiveTax(
  amount: number,
  brackets: Array<{ fromAmount: number; toAmount: number | null; ratePercent: number }>,
): number {
  if (amount <= 0 || !brackets.length) return 0;
  let tax = 0;
  for (const b of brackets) {
    const lo = b.fromAmount || 0;
    const hi = b.toAmount === null || b.toAmount === undefined ? null : b.toAmount;
    const rate = (b.ratePercent || 0) / 100;
    if (hi === null) {
      if (amount > lo) tax += (amount - lo) * rate;
    } else if (amount > lo) {
      tax += (Math.min(amount, hi) - lo) * rate;
    }
  }
  return r0(Math.max(tax, 0));
}

/** محاسبه همه آیتم‌های فعال برای یک پرسنل → (lines, summary, traces) — traces برای نمایش جزئیات با کلیک (۱٫۴٫۵) */
export function calcEmployee(ctx: CalcContext, itemsConfig: CalcItem[]): { lines: CalcLine[]; summary: CalcSummary; traces: Record<string, CalcTrace>; summaryTraces: Record<string, CalcTrace> } {
  const lines: CalcLine[] = [];
  let earnings = 0;
  const ceiling30 = parseNumberOr(ctx.settings['sso_ceiling_30d'], 1163788500);
  const ceiling31 = parseNumberOr(ctx.settings['sso_ceiling_31d'], 1202581450);
  ctx.insuredBase = 0;
  ctx.taxBase = 0;

  for (const item of itemsConfig) {
    if (!item.active) continue;
    const reg = formulas.get(item.formulaKey);
    if (!reg) continue;
    let amount = 0;
    try { amount = reg.fn(ctx, item); } catch { amount = 0; }
    if (amount < 0) amount = 0;
    amount = r0(amount);
    lines.push({ itemCode: item.code, amount });
    if (item.kind === 'earning') {
      earnings += amount;
      if (item.insured) ctx.insuredBase += amount;
      if (item.taxMode === 'm84') ctx.taxBase += amount;
    }
  }

  // سقف مشمول بیمه (بر اساس روزهای ماه) — به نسبت روزهای کارکرد: ماه ناقص سقف کوچکتر دارد
  let ceiling = ctx.daysInMonth === 31 ? ceiling31 : ceiling30;
  if (ctx.daysInMonth === 29) ceiling = ceiling30 * 29 / 30;
  if (ctx.daysInMonth > 0 && ctx.paidDays < ctx.daysInMonth) {
    ceiling = ceiling * Math.min(1, Math.max(0, ctx.paidDays) / ctx.daysInMonth);
  }
  if (ctx.insuredBase > ceiling) ctx.insuredBase = ceiling;

  // ماده ۱۳۷ ق.م.م: حق بیمه سهم کارگر از مزایای مشمول مالیات کسر می‌شود
  const workerInsPct = parseNumberOr(ctx.settings['sso_worker_rate'], 7);
  const workerInsForTax = r0(ctx.insuredBase * workerInsPct / 100);
  ctx.taxBase = Math.max(0, ctx.taxBase - workerInsForTax);

  // مالیات: پله‌ای + اقلام مقطوع/درصدی
  let lumpTax = 0;
  for (const item of itemsConfig) {
    if (!item.active || item.kind !== 'earning') continue;
    if (item.taxMode === 'lump') {
      let pct = parseNumberOr(ctx.settings['lump_tax_' + item.code], 0);
      if (pct <= 0 && item.taxPercent) pct = item.taxPercent;
      const amt = lines.find((l) => l.itemCode === item.code)?.amount ?? 0;
      lumpTax += amt * pct / 100;
    } else if (item.taxMode === 'percent') {
      const amt = lines.find((l) => l.itemCode === item.code)?.amount ?? 0;
      lumpTax += amt * (item.taxPercent || 0) / 100;
    }
  }
  const tax = calcProgressiveTax(ctx.taxBase, ctx.taxBrackets) + r0(lumpTax);

  // کسورات نهایی بعد از سقف‌گذاری بیمه — همه اقلام از نوع کسر (نه فقط لیست ثابت)
  const workerIns = r0(ctx.insuredBase * parseNumberOr(ctx.settings['sso_worker_rate'], 7) / 100);
  const employerIns = r0(ctx.insuredBase * parseNumberOr(ctx.settings['sso_employer_rate'], 20) / 100);
  const unemployment = r0(ctx.insuredBase * parseNumberOr(ctx.settings['sso_unemployment_rate'], 3) / 100);
  for (const l of lines) {
    if (l.itemCode === 'worker_ins') l.amount = workerIns;
    else if (l.itemCode === 'employer_ins') l.amount = employerIns;
    else if (l.itemCode === 'unemployment') l.amount = unemployment;
    else if (l.itemCode === 'tax') l.amount = tax;
  }
  // کسر = هر قلمی که در پیکربندی از نوع deduction است (وام، مساعده، سایر، مانده‌های اولیه و هر آیتم سفارشی آینده)
  const deductionCodes = new Set(itemsConfig.filter((i) => i.kind === 'deduction' && i.active).map((i) => i.code));
  const deductions = lines
    .filter((l) => deductionCodes.has(l.itemCode))
    .reduce((s, l) => s + l.amount, 0);

  // ردپای محاسبه هر قلم + خلاصه‌ها (قابلیت ۱٫۴٫۵)
  const traces: Record<string, CalcTrace> = {};
  for (const item of itemsConfig) {
    if (!item.active) continue;
    const line = lines.find((l) => l.itemCode === item.code);
    if (!line) continue;
    try { traces[item.code] = traceLine(item, ctx, line.amount); } catch { /* ردپا اختیاری است */ }
  }
  const ceilingApplied = ctx.insuredBase >= ceiling && ceiling > 0;
  const summaryTraces: Record<string, CalcTrace> = {
    gross: { formula: 'جمع درآمد', steps: lines.filter((l) => itemsConfig.find((i) => i.code === l.itemCode)?.kind === 'earning' && l.amount > 0).map((l) => ({ label: itemsConfig.find((i) => i.code === l.itemCode)?.title ?? l.itemCode, value: faM(l.amount) })), basis: 'جمع همه اقلام درآمد فعال' },
    insuredBase: { formula: 'مشمول بیمه', steps: [
      { label: 'جمع اقلام مشمول بیمه', value: faM(ctx.insuredBase) },
      ...(ceilingApplied ? [{ label: 'سقف مشمول بیمه ماه (به نسبت روزهای کارکرد)', value: faM(ceiling) }, { label: 'مبلغ نهایی = حد سقف', value: faM(ctx.insuredBase) }] : [{ label: 'سقف اعمال نشد', value: 'زیر سقف قانونی' }]),
    ], basis: 'ماده ۳۴ قانون تامین اجتماعی + سقف حقوق مشمول بیمه' },
    workerIns: { formula: 'بیمه سهم کارگر', steps: [
      { label: 'مشمول بیمه نهایی', value: faM(ctx.insuredBase) },
      { label: 'نرخ سهم کارگر', value: `${faP(ctx.settings['sso_worker_rate'] ?? '7')}٪` },
      { label: 'نتیجه', value: faM(workerIns) },
    ], basis: 'قانون تامین اجتماعی — ۷٪ سهم کارگر' },
    tax: { formula: 'مالیات حقوق', steps: [
      { label: 'مشمول مالیات قبل از ماده ۱۳۷', value: faM(ctx.taxBase + workerInsForTax) },
      { label: 'منهای بیمه سهم کارگر (ماده ۱۳۷ ق.م.م)', value: `− ${faM(workerInsForTax)}` },
      { label: 'مشمول مالیات نهایی', value: faM(ctx.taxBase) },
      ...(lumpTax > 0 ? [{ label: 'مالیات مقطوع/درصدی اقلام ویژه', value: faM(lumpTax) }] : []),
      { label: 'محاسبه پله‌ای بر جدول سال مالی', value: faM(tax) },
    ], basis: 'ماده ۸۴ و ماده ۱۳۷ ق.م.م — پله‌ای' },
    totalDeductions: { formula: 'جمع کسورات', steps: lines.filter((l) => deductionCodes.has(l.itemCode) && l.amount > 0).map((l) => ({ label: itemsConfig.find((i) => i.code === l.itemCode)?.title ?? l.itemCode, value: faM(l.amount) })), basis: 'جمع همه اقلام کسر فعال' },
    netPay: { formula: 'خالص قابل پرداخت', steps: [
      { label: 'جمع درآمد', value: faM(earnings) },
      { label: 'منهای جمع کسورات', value: `− ${faM(deductions)}` },
      { label: 'نتیجه', value: faM(r0(earnings - deductions)) },
    ], basis: 'خالص = درآمد − کسورات' },
  };

  return {
    lines,
    summary: {
      gross: r0(earnings), insuredBase: r0(ctx.insuredBase), workerIns, employerIns,
      unemploymentIns: unemployment, taxBase: r0(ctx.taxBase), tax,
      totalDeductions: r0(deductions), netPay: r0(earnings - deductions),
    },
    traces,
    summaryTraces,
  };
}
