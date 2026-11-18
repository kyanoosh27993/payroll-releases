// بدنه WordprocessingML حکم پرسنلی و تسویه‌حساب روی سربرگ رسمی کاربر — نسخه ۱٫۴٫۵
// حکم و تسویه داخل خود فایل ورد سربرگ شرکت جانمایی می‌شوند (هدر سربرگ همه صفحات تکرار می‌شود)
import { wP, wTable, wSpacer, faMoneyDot, type WTRow } from './docx-template';

const toFa = (v: number | string) => String(v ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export interface HokmPerson {
  fullName: string; fatherName: string; nationalId: string; personnelCode: string;
  jobTitle: string; department: string;
}
export interface HokmDecree { effectiveDate: string; notes?: string }
export interface HokmItem { title: string; amount: number }

const DECREE_ROWS_HOKM: Array<[string, string]> = [
  ['مزد شغل (حقوق پایه)', 'jobWage'],
  ['مزد سنوات', 'seniorityWage'],
  ['حق مسکن', 'housing'],
  ['بن خواروبار', 'food'],
  ['حق اولاد', 'childAllowance'],
  ['حق عائله‌مندی', 'familyAllowance'],
  ['تفاوت تطبیق', 'adjustmentDiff'],
  ['حق سرپرستی', 'supervision'],
  ['کمک‌هزینه تحصیلی', 'educationAid'],
  ['فوق‌العاده بازار کار', 'laborMarket'],
  ['حق جذب (مبلغ)', 'attractionAmount'],
  ['سایر مزایا', 'otherBenefits'],
  ['بن کارگری', 'workerBen'],
  ['اضافه‌کار ثابت', 'fixedOvertime'],
  ['حق شیفت', 'shiftAllowance'],
];

/** بدنه حکم پرسنلی برای سربرگ — نسخه ۱٫۴٫۶: پیوست قرارداد + چیدمان باز‌تر + امضا بدون کادر */
export function hokmWordBody(p: HokmPerson, decree: Record<string, unknown>, managerName: string): string {
  const rows: Array<[string, number]> = [];
  for (const [title, key] of DECREE_ROWS_HOKM) {
    const v = Number(decree[key] ?? 0);
    if (v > 0) rows.push([title, v]);
  }
  const sum = rows.reduce((s, [, v]) => s + v, 0);

  const title = wP('حکم پرسنلی حقوق و مزایا', { bold: true, size: 16, align: 'center', font: 'B Koodak', spacing: 300 });
  const attached = wP('(پیوست قرارداد کار)', { bold: true, size: 12, align: 'center' });
  // نسخه ۱.۴.۷ — عرض جدول‌ها دقیقاً برابر عرض متن سربرگ (۹۶۳۸ twips) تا همه با هم و با خطوط متن الاین باشند
  // ارقام تاریخ با فونت B Koodak و رقم فارسی
  const KD = 'B Koodak';
  const meta = wTable([
    { cells: [{ text: 'شماره حکم', bold: true, shade: true }, { text: toFa(String((decree as { decreeNumber?: string }).decreeNumber ?? (decree as { id?: number }).id ?? '')), bold: true, font: KD }, { text: 'شماره پرسنلی', bold: true, shade: true }, { text: toFa(p.personnelCode), bold: true, font: KD }, { text: 'تاریخ صدور', bold: true, shade: true }, { text: toFa(String((decree as { issuedDate?: string }).issuedDate ?? '')), bold: true, font: KD }, { text: 'تاریخ اجرا', bold: true, shade: true }, { text: toFa(decree.effectiveDate as string), bold: true, font: KD }], header: true },
  ], [1140, 1300, 1140, 1300, 1030, 1400, 1030, 1298]);
  const intro = wP(
    `جناب/سرکار آقای/خانم ${p.fullName} فرزند ${p.fatherName} — کدملی ${toFa(p.nationalId)} — شاغل در بخش ${p.department} به عنوان ${p.jobTitle}، ` +
    `با توجه به صلاحدید مدیریت و مطابق مفاد قانون کار، حقوق و مزایای حکمی شما با تاریخ اجرای ${toFa(decree.effectiveDate as string)} به شرح جدول زیر تعیین و ابلاغ می‌گردد. ` +
    `تمامی محاسبات حقوق و دستمزد (اضافه‌کاری، شب‌کاری، نوبت‌کاری، جمعه‌کاری، مرخصی، عیدی و سنوات) بر مبنای همین حکم و پارامترهای قانونی سال مالی انجام می‌شود.`,
    { size: 12.5, align: 'both', spacing: 400 },
  );
  const tableRows: WTRow[] = [
    { cells: [{ text: 'ردیف', bold: true, shade: true }, { text: 'شرح قلم حقوقی', bold: true, shade: true }, { text: 'مبلغ ماهانه (ریال)', bold: true, shade: true }] },
    ...rows.map(([t, v], i) => ({ cells: [{ text: toFa(i + 1) }, { text: t, align: 'right' as const }, { text: faMoneyDot(v), bold: true }] })),
    // نسخه ۱.۴.۷ — سلول شرح با سلول خالی کناری مرج می‌شود تا متن نشکند و ارتفاع سطر آخر طبیعی باشد
    { cells: [{ text: 'جمع کل حقوق ثابت و مزایای حکم', bold: true, shade: true, span: 2, noWrap: true, align: 'right' }, { text: faMoneyDot(sum), bold: true, shade: true }] },
  ];
  const wageTable = wTable(tableRows, [930, 5365, 3343]);
  const notes = decree.notes ? wP(`ملاحظات: ${String(decree.notes)}`, { size: 11, align: 'both', spacing: 340 }) : '';
  const law = wP(
    'این حکم مطابق قانون کار صادر و به اطلاع همکار رسید؛ هرگونه تغییر در مبالغ فوق صرفاً با صدور حکم جدید با تاریخ اجرای مشخص امکان‌پذیر است. ' +
    'حق اولاد فقط برای افراد متأهل و به‌ازای هر فرزند مندرج در پرونده پرسنلی تعلق می‌گیرد و حق عائله‌مندی مخصوص افراد متأهل است. ' +
    'این حکم به‌عنوان پیوست قرارداد کار همکار، جزء لاینفک قرارداد محسوب می‌شود.',
    { size: 11, align: 'both', spacing: 380 },
  );
  // امضا بدون کادر — فقط امضای مدیر و امضای همکار (نسخه ۱٫۴٫۶)
  const sig = wTable([
    { cells: [{ text: `${toFa(managerName)} — امضای مدیر`, bold: true }, { text: `${toFa(p.fullName)} — امضای همکار`, bold: true }] },
    { cells: [{ text: ' ' }, { text: ' ' }], height: 1100 },
  ], [4819, 4819]);
  return `${title}${attached}${meta}${intro}${wageTable}${notes}${law}${wSpacer()}` + sigBordersOff(sig);
}

/** نسخه ۱٫۴٫۶ — حذف خط‌کشی جدول امضا (فقط فاصله + نام) */
function sigBordersOff(tblXml: string): string {
  return tblXml
    .replace(/<w:tblBorders>.*?<\/w:tblBorders>/, '<w:tblBorders><w:top w:val="none"/><w:bottom w:val="none"/><w:left w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>')
    .replace(/<w:tcBorders>.*?<\/w:tcBorders>/g, '<w:tcBorders><w:top w:val="none"/><w:bottom w:val="none"/><w:left w:val="none"/><w:right w:val="none"/></w:tcBorders>');
}

export interface TasvieLine { title: string; detail: string; amount: number; sign: 1 | -1 }
export interface TasviePerson {
  fullName: string; personnelCode: string; nationalId: string; jobTitle: string;
  department: string; hireDate: string; endWorkDate: string;
}
export interface TasvieData {
  person: TasviePerson; toDate: string; companyName: string;
  serviceDays: number; serviceYears: number; decreeUsed: string;
  lines: TasvieLine[]; totalDue: number; totalDeduct: number; net: number;
  bankName?: string; bankAccount?: string; bankSheba?: string;
}

/** بدنه فرم تسویه‌حساب برای سربرگ — اقلام تک‌به‌تک با جزئیات محاسبه روزانه */
export function tasviyeWordBody(d: TasvieData): string {
  const title = wP('فرم تسویه حساب و پایان کار', { bold: true, size: 14, align: 'center', font: 'B Koodak' });
  // نسخه ۱.۴.۷ — عرض جدول‌ها دقیقاً برابر عرض متن سربرگ (۹۶۳۸ twips) + تاریخ‌ها فونت کودک
  const KD = 'B Koodak';
  const info = wTable([
    { cells: [
      { text: 'نام و نام خانوادگی', bold: true, shade: true }, { text: toFa(d.person.fullName), bold: true },
      { text: 'کد پرسنلی', bold: true, shade: true }, { text: toFa(d.person.personnelCode), bold: true, font: KD },
      { text: 'کد ملی', bold: true, shade: true }, { text: toFa(d.person.nationalId), bold: true, font: KD },
    ] },
    { cells: [
      { text: 'عنوان شغل', bold: true, shade: true }, { text: toFa(d.person.jobTitle) },
      { text: 'بخش', bold: true, shade: true }, { text: toFa(d.person.department) },
      { text: 'تاریخ استخدام', bold: true, shade: true }, { text: toFa(d.person.hireDate), bold: true, font: KD },
    ] },
    { cells: [
      { text: 'تاریخ پایان کار', bold: true, shade: true }, { text: toFa(d.person.endWorkDate), bold: true, font: KD },
      { text: 'کل روزهای کارکرد', bold: true, shade: true }, { text: `${toFa(d.serviceDays)} روز (${toFa(d.serviceYears)} سال)`, bold: true, font: KD },
      { text: 'مبنا: حکم مورخ', bold: true, shade: true }, { text: toFa(d.decreeUsed), bold: true, font: KD },
    ] },
    { cells: [
      { text: 'بانک پرداخت', bold: true, shade: true }, { text: toFa(d.bankName || '—') },
      { text: 'شماره حساب', bold: true, shade: true }, { text: toFa(d.bankAccount || '—'), font: KD },
      { text: 'شماره شبا', bold: true, shade: true }, { text: toFa(d.bankSheba || '—'), font: KD },
    ] },
  ], [1620, 1720, 1400, 1620, 1400, 1878]);
  const intro = wP(
    `همکار محترم؛ به موجب این فرم، کلیه مطالبات و کسور قانونی ${toFa(d.person.fullName)} تا تاریخ ${toFa(d.toDate)} به شرح جدول زیر محاسبه و تسویه گردید. ` +
    `عیدی و پاداش، سنوات پایان کار و مانده مرخصی به‌صورت روزانه بر مبنای مزد حکم محاسبه شده و حق مسکن، بن کارگری و سایر مزایا هر کدام جداگانه به نسبت روزهای کارکرد ماه تسویه درج شده‌اند. ` +
    `مبلغ خالص قابل پرداخت (${toFa(Math.round(d.net).toLocaleString('en-US'))} ریال) به شماره حساب/شبا اعلام‌شده واریز می‌گردد.`,
    { size: 11, align: 'both', spacing: 330 },
  );
  const rows: WTRow[] = [
    { cells: [{ text: 'ردیف', bold: true, shade: true }, { text: 'شرح', bold: true, shade: true }, { text: 'محاسبه / جزئیات', bold: true, shade: true }, { text: 'مبلغ (ریال)', bold: true, shade: true }] },
    ...d.lines.map((l, i) => ({
      cells: [
        { text: toFa(i + 1) },
        { text: toFa(l.title), align: 'right' as const, bold: l.sign === 1 },
        { text: toFa(l.detail), align: 'right' as const, size: 9.5 },
        { text: `${l.sign === 1 ? '+' : '−'} ${faMoneyDot(l.amount)}`, bold: l.sign === 1 },
      ],
    })),
    { cells: [{ text: 'جمع مطالبات همکار (طلبکار)', bold: true, shade: true, span: 2, noWrap: true, align: 'right' as const }, { text: faMoneyDot(d.totalDue), bold: true, shade: true }] },
    { cells: [{ text: 'جمع بدهی همکار (وام و مساعده)', bold: true, shade: true, span: 2, noWrap: true, align: 'right' as const }, { text: faMoneyDot(d.totalDeduct), bold: true, shade: true }] },
    { cells: [{ text: 'خالص قابل پرداخت هنگام تسویه', bold: true, shade: true, span: 2, noWrap: true, align: 'right' as const }, { text: faMoneyDot(d.net), bold: true, shade: true }] },
  ];
  const table = wTable(rows, [830, 2680, 4030, 2098]);
  // v1.4.7 — متن اقرارنامه مطابق متن استاندارد فرم‌های رسمی تسویه‌حساب (منبع: نمونه فرم‌های اداره کار)
  const law = wP(
    `ایجانب ${toFa(d.person.fullName)}، کارگر/کارمند شرکت ${toFa(d.companyName)} با سمت ${toFa(d.person.jobTitle)}، از تاریخ ${toFa(d.person.hireDate)} لغایت ${toFa(d.person.endWorkDate)} در شرکت مذکور انجام وظیفه می‌نمودم. بدین‌وسیله گواهی و تأیید می‌نمایم که کلیه حقوق و مزایای پایان کار خود اعم از حقوق و مزایای معوقه، حق مسکن، بن خواروبار و بن کارگری، حق اولاد، عیدی و پاداش، سنوات (مزایای پایان کار)، اضافه‌کاری، جمعه‌کاری و مانده مرخصی و سایر مزایای متعلقه، منطبق با مقررات قانون کار و آیین‌نامه‌های مربوطه به شرح جدول فوق محاسبه گردید و مبلغ خالص ${faMoneyDot(d.net)} ریال به شماره حساب/شبا اعلام‌شده در همین فرم واریز و کامل دریافت نموده‌ام و با شرکت قطع همکاری نموده‌ام و من بعد حق هرگونه ادعا و شکایتی بابت کارکرد و مزایای دوره همکاری خود نسبت به شرکت مذکور را از خود سلب می‌نمایم. تسویه حساب بانکی، امانات و لوازم شرکت نیز انجام شده است و این فرم به‌همراه فیش پرداخت و سند بانکی ضمیمه می‌باشد.`,
    { size: 10, align: 'both', spacing: 320 },
  );
  const sig = wTable([
    { cells: [{ text: 'امضا و اثر انگشت همکار (تسویه‌کننده)', bold: true, shade: true }, { text: 'امضا و مهر کارفرما / مدیرعامل', bold: true, shade: true }] },
    { cells: [{ text: toFa(d.person.fullName) }, { text: toFa(d.companyName) }] },
    { cells: [{ text: 'امضا:' }, { text: 'امضا و مهر:' }], height: 1200 },
    { cells: [{ text: 'اثر انگشت:' }, { text: 'تاریخ واریز و شماره سند بانکی:' }], height: 1200 },
  ], [4819, 4819]);
  return `${title}${info}${intro}${table}${law}${wSpacer()}${sig}`;
}
