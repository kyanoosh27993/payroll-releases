// لایه نمایش دوره حقوق — لودر مشترک داده‌های دوره + سازنده HTML فیش حقوقی (چاپ B/W)
import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/lib/db';
import { appRoot } from '@/lib/app-root';
import { formatMoney, toPersianDigits } from './numbers';
import { escapeHtml as esc, isSafeImageDataUrl } from './sanitize';
import { companyHeaderLines, CompanyInfo } from './excel';

export type PersonnelFull = {
  id: number; personnelCode: string; firstName: string; lastName: string;
  nationalId: string; ssoNumber: string; jobTitle: string; costCenter: string;
  bankName: string; bankAccount: string; bankSheba: string;
  fatherName: string; birthDate: string; idNumber: string; birthPlace: string; idIssuePlace: string;
  education: string; insuranceType: number; ssoInsurer: string; taxExemptionCode: number;
  postalCode: string; address: string; jobCategory: number; employmentType: number;
  hireDate: string; endWorkDate: string; status: string;
};

export type SummaryRow = {
  id: number; personnelId: number; workedDays: number; leaveDays: number; leaveBalance: number;
  overtimeMin: number; gross: number; insuredBase: number; workerIns: number; employerIns: number;
  unemploymentIns: number; taxBase: number; tax: number; totalDeductions: number;
  netPay: number; prevBalance: number; payApproved: boolean; payPaid: boolean; payNote: string;
  personnel: PersonnelFull;
};

export interface PeriodData {
  period: { id: number; fiscalYearId: number; jy: number; jm: number; status: string; calculatedAt: Date };
  company: CompanyInfo & {
    id: number; name: string; nationalId: string; economicCode: string;
    ssoBranchCode: string; ssoWorkshopCode: string; ssoContractRow: string;
    managerName: string; logoPath: string; address: string; phone: string;
  };
  summaries: SummaryRow[];
  lines: Array<{ id: number; personnelId: number; itemCode: string; amount: number }>;
  itemMap: Record<string, { title: string; kind: string }>;
}

export const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export function periodTitle(p: { jy: number; jm: number }): string {
  return `${MONTH_NAMES[p.jm - 1]} ${toPersianDigits(p.jy)}`;
}

export function monthStamp(p: { jy: number; jm: number }): string {
  return `${p.jy}${String(p.jm).padStart(2, '0')}`;
}

/** بارگذاری کامل داده‌های یک دوره حقوق */
export async function loadPeriodData(periodId: number): Promise<PeriodData> {
  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { fiscalYear: { include: { company: true } } },
  });
  if (!period) throw new Error('دوره یافت نشد');
  const c = period.fiscalYear.company;
  const company: PeriodData['company'] = {
    id: c.id, name: c.name, nationalId: c.nationalId, economicCode: c.economicCode,
    ssoBranchCode: c.ssoBranchCode, ssoWorkshopCode: c.ssoWorkshopCode,
    ssoContractRow: c.ssoContractRow, managerName: c.managerName,
    logoPath: c.logoPath, address: c.address, phone: c.phone,
  };
  const [summaries, lines, itemCfg] = await Promise.all([
    db.payrollSummary.findMany({
      where: { periodId },
      include: { personnel: true },
      orderBy: { personnel: { personnelCode: 'asc' } } // قانون ۱٫۴٫۳: کد پرسنلی صعودی — ترتیب فیش‌های گروهی
    }),
    db.payrollLine.findMany({ where: { periodId } }),
    db.payrollItemConfig.findMany({ orderBy: { sort: 'asc' } }),
  ]);
  const itemMap: Record<string, { title: string; kind: string }> = {};
  for (const it of itemCfg) itemMap[it.code] = { title: it.title, kind: it.kind };
  return {
    period: {
      id: period.id, fiscalYearId: period.fiscalYearId, jy: period.jy, jm: period.jm,
      status: period.status, calculatedAt: period.calculatedAt,
    },
    company,
    summaries: summaries as unknown as SummaryRow[],
    lines: lines.map((l) => ({ id: l.id, personnelId: l.personnelId, itemCode: l.itemCode, amount: l.amount })),
    itemMap,
  };
}

/** خواندن لوگوی شرکت از public به‌صورت Buffer (اگر وجود داشته باشد) — با پیش‌فرض لوگوی سربرگ رسمی */
export function readCompanyLogo(logoPath: string): Buffer | undefined {
  const tryRead = (p: string): Buffer | undefined => {
    try {
      const full = p.startsWith('/') ? path.join(appRoot(), 'public', p) : p;
      if (fs.existsSync(full)) return fs.readFileSync(full);
    } catch { /* اختیاری */ }
    return undefined;
  };
  if (logoPath) {
    const b = tryRead(logoPath);
    if (b) return b;
  }
  // v1.4.7 — پیش‌فرض: نشان (لوگو) برش‌خورده از سربرگ رسمی شرکت — کل صفحه سربرگ در کادر ۷۸px دیده نمی‌شد
  return tryRead('/letterhead/company-logo.jpeg') ?? tryRead('/letterhead/letterhead-default.jpeg');
}

export function companyWithLogo(c: PeriodData['company']): CompanyInfo {
  return { ...c, logoData: readCompanyLogo(c.logoPath) };
}

// ---------------------------------------------------------------------------
// فیش حقوقی — HTML چاپی حرفه‌ای تک‌رنگ (پورت payslip_html از exports.py)
// ---------------------------------------------------------------------------
interface SlipItem { title: string; amount: number; kind: string; code?: string; basis?: string }
interface SlipSummary {
  workedDays: number; leaveDays: number; leaveBalance: number;
  gross: number; insuredBase: number; workerIns: number; taxBase: number;
  totalDeductions: number; tax: number; netPay: number; prevBalance: number;
  /** نسخه ۱٫۴٫۶ — کل ساعات کارکرد ماه (از حضور و غیاب) */
  workedHours?: number;
  /** نسخه ۱٫۴٫۶ — ساعات اضافه‌کاری (برای درج در سربرگ فیش) */
  overtimeHours?: number;
}
export interface SlipInput {
  person: { fullName: string; personnelCode: string; nationalId: string; ssoNumber: string; jobTitle: string; costCenter: string };
  items: SlipItem[];
  summary: SlipSummary;
  /** عکس پرسنلی — نسخه ۱٫۴٫۵ (نمایش عکس در فیش به درخواست کاربر) */
  photo?: string;
  /** ردپای محاسبه هر قلم + خلاصه‌ها — کلیک روی مبلغ (نسخه ۱٫۴٫۵) */
  trace?: { traces: Record<string, unknown>; summaryTraces: Record<string, unknown>; inputs?: Record<string, string> };
  /** گزاره ۵ نسخه ۱٫۲٫۰ — اقلام تکمیلی انتخابی (روزهای ماه، ساعات اضافه‌کاری، عیدی سال و ...) */
  extras?: Array<{ label: string; value: string }>;
}

const G = '#111827', LG = '#f6f7f8', HG = '#e8eaed';

function FONT_CSS(): string {
  return `
@font-face { font-family:'Vazirmatn'; src:url('/fonts/Vazirmatn-Regular.ttf') format('truetype'); font-weight:400; }
@font-face { font-family:'Vazirmatn'; src:url('/fonts/Vazirmatn-Medium.ttf') format('truetype'); font-weight:500; }
@font-face { font-family:'Vazirmatn'; src:url('/fonts/Vazirmatn-Bold.ttf') format('truetype'); font-weight:700; }
* { font-family:'Vazirmatn', Tahoma, sans-serif; box-sizing:border-box; }
@media print { .no-print { display:none !important; } body { margin:0; } }`;
}

function logoHtml(logoData?: Buffer, logoPath?: string): string {
  if (!logoData) return '';
  // v1.4.7 — تشخیص واقعی فرمت تصویر از امضای بایت‌ها (قبلاً jpeg با mime png چاپ می‌شد و لوگو دیده نمی‌شد)
  let mime = 'image/png';
  if (logoData[0] === 0xff && logoData[1] === 0xd8) mime = 'image/jpeg';
  else if (logoData[0] === 0x89 && logoData[1] === 0x50) mime = 'image/png';
  else if ((logoPath || '').match(/\.jpe?g$/i)) mime = 'image/jpeg';
  return `<img src="data:${mime};base64,${logoData.toString('base64')}" alt="لوگو" style="width:78px;height:78px;object-fit:contain" />`;
}

function slipRowsHtml(rows: SlipItem[], title: string, traces?: Record<string, unknown>, wide = false): string {
  let body = '';
  rows.forEach((r, i) => {
    const z = i % 2 ? `background:${LG};` : '';
    const hasTrace = traces && r.code && traces[r.code];
    const amtStyle = `white-space:nowrap;text-align:left;border:1px solid ${G};padding:2px 6px${hasTrace ? ';cursor:pointer;text-decoration:underline dotted' : ''}`;
    const basisCell = wide && (r.basis || (hasTrace && (traces![r.code!] as { basisShort?: string })?.basisShort))
      ? `<td style="text-align:right;border:1px solid ${G};padding:2px 6px;font-size:7.5pt;color:#374151">${r.basis || (traces![r.code!] as { basisShort?: string }).basisShort}</td>`
      : wide ? `<td style="text-align:right;border:1px solid ${G};padding:2px 6px;font-size:7.5pt;color:#9ca3af">—</td>` : '';
    body += `<tr style="${z}">`
      + `<td style="text-align:center;border:1px solid ${G};padding:2px 4px">${toPersianDigits(String(i + 1))}</td>`
      + `<td style="text-align:right;border:1px solid ${G};padding:2px 6px">${r.title}</td>`
      + basisCell
      + `<td class="amt" data-slip="0" data-code="${r.code ?? ''}" style="${amtStyle}">${formatMoney(r.amount)}</td></tr>`;
  });
  const total = formatMoney(rows.reduce((s, r) => s + r.amount, 0));
  const headBasis = wide ? `<td style="width:26%;border:1px solid ${G};text-align:center;padding:2px">مبنا (روز / ساعت / ضریب)</td>` : '';
  const footSpan = wide ? 'colspan="2"' : 'colspan="2"';
  return `<p style="background:${HG};color:${G};padding:4px 8px;margin:6px 0 3px 0;font-weight:bold;font-size:9pt;border:1px solid ${G}">${title}</p>`
    + `<table width="100%" cellspacing="0" cellpadding="3" style="border:1px solid ${G};border-collapse:collapse;font-size:8.5pt">`
    + `<tr style="background:${HG};font-weight:bold">`
    + `<td style="width:8%;border:1px solid ${G};text-align:center;padding:2px">ردیف</td>`
    + `<td style="border:1px solid ${G};text-align:center;padding:2px">شرح</td>`
    + headBasis
    + `<td style="width:${wide ? '22%' : '38%'};border:1px solid ${G};text-align:center;padding:2px">مبلغ (ریال)</td></tr>`
    + `${body}<tr style="background:${HG};font-weight:bold">`
    + `<td ${footSpan} style="border:1px solid ${G};padding:3px">جمع ${title}</td>`
    + (wide ? '<td style="border:1px solid ' + G + '"></td>' : '')
    + `<td style="border:1px solid ${G};white-space:nowrap;text-align:left;padding:3px 6px">${total}</td></tr></table>`;
}

function slipInfoCell(label: string, value: string): string {
  return `<td style="background:${LG};border:1px solid ${G};font-size:8pt;padding:2px 6px"><b>${esc(label)}</b></td>`
    + `<td style="border:1px solid ${G};font-size:8.5pt;padding:2px 6px">${esc(value)}</td>`;
}

function slipHtml(slip: SlipInput & { slipIdx?: number }, period: { jy: number; jm: number }, company: PeriodData['company'], logoData?: Buffer, last = false): string {
  const s = slip.summary;
  const idx = slip.slipIdx ?? 0;
  const earn = slip.items.filter((r) => r.kind === 'earning' && r.amount);
  const ded = slip.items.filter((r) => r.kind === 'deduction' && r.amount);
  const prev = s.prevBalance || 0;
  const prevRow = Math.abs(prev) > 0.5 ? slipInfoCell('مانده حقوق ماه قبل', formatMoney(prev) + ' ریال') : '';
  // عکس پرسنلی — نسخه ۱٫۴٫۵
  const photo = slip.photo ? `<img src="${slip.photo}" alt="عکس" style="width:16mm;height:20mm;object-fit:cover;border:1px solid ${G}" onerror="this.style.display='none'" />` : '';
  const info = `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
    <tr>${slipInfoCell('نام و نام خانوادگی', slip.person.fullName)}
        ${slipInfoCell('شماره پرسنلی', toPersianDigits(slip.person.personnelCode))}
        <td rowspan="5" style="border:1px solid ${G};text-align:center;padding:2px;min-width:64px">${photo}</td></tr>
    <tr>${slipInfoCell('کد ملی', toPersianDigits(slip.person.nationalId || ''))}
        ${slipInfoCell('شماره بیمه', toPersianDigits(slip.person.ssoNumber || ''))}</tr>
    <tr>${slipInfoCell('شغل', slip.person.jobTitle || '—')}
        ${slipInfoCell('مرکز هزینه', slip.person.costCenter || '—')}</tr>
    <tr>${slipInfoCell('کارکرد (روز)', toPersianDigits(String(s.workedDays)))}
        ${slipInfoCell('ساعت کارکرد ماه', toPersianDigits(String(s.workedHours ?? 0)))}</tr>
    <tr>${slipInfoCell('مرخصی (روز)', toPersianDigits(String(s.leaveDays)))}
        ${slipInfoCell('اضافه‌کار (ساعت)', toPersianDigits(String(s.overtimeHours ?? 0)))}</tr>
    <tr>${slipInfoCell('مانده مرخصی', toPersianDigits(String(s.leaveBalance || 0)))}
        ${prevRow || slipInfoCell('دوره', periodTitle(period))}</tr>
  </table>`;
  const payTotal = s.netPay + prev;
  const amtCell = (key: string, label: string, v: number, strong = false) => {
    const t = slip.trace?.summaryTraces?.[key] ? 'class="amt" data-slip="' + idx + '" data-sum="' + key + '" style="cursor:pointer;text-decoration:underline dotted"' : '';
    return `<td style="border:1px solid ${G};font-size:${strong ? '9pt' : '8.5pt'};padding:${strong ? '4px' : '2px'} 6px" ${t}><b>${label}</b></td><td style="border:1px solid ${G};font-size:${strong ? '9pt' : '8.5pt'};padding:${strong ? '4px' : '2px'} 6px" ${t}><b>${formatMoney(v)}</b></td>`;
  };
  const summaryHtml = `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px;font-size:8.5pt">
    <tr>${amtCell('gross', 'جمع درآمد', s.gross)}
        ${amtCell('insuredBase', 'مشمول بیمه', s.insuredBase)}</tr>
    <tr>${amtCell('workerIns', 'بیمه سهم کارگر', s.workerIns)}
        ${amtCell('taxBase', 'مشمول مالیات', s.taxBase)}</tr>
    <tr>${amtCell('totalDeductions', 'جمع کسورات', s.totalDeductions)}
        ${amtCell('tax', 'مالیات حقوق', s.tax)}</tr>
    <tr style="background:${HG}">
      ${amtCell('netPay', 'خالص قابل پرداخت', s.netPay, true)}
      <td style="border:1px solid ${G};font-size:9pt;padding:4px 6px" ${slip.trace ? `class="amt" data-slip="${idx}" data-sum="netPay"` : ''}><b>قابل پرداخت با مانده قبلی</b></td>
      <td style="border:1px solid ${G};font-size:9pt;padding:4px 6px" ${slip.trace ? `class="amt" data-slip="${idx}" data-sum="netPay"` : ''}><b>${formatMoney(payTotal)}</b> ریال</td></tr>
  </table>`;
  const compLines = companyHeaderLines(company).filter(Boolean);
  const ident = compLines[1] ? `<p style="font-size:7.5pt;color:#374151;margin:1px;text-align:center">${esc(compLines[1])}</p>` : '';
  const addr = compLines[2] ? `<p style="font-size:7.5pt;color:#374151;margin:1px;text-align:center">${esc(compLines[2])}</p>` : '';
  const brk = last ? '' : ` style="page-break-after:always"`;
  const tracesArg = slip.trace?.traces as Record<string, unknown> | undefined;
  return `<div dir="rtl"${brk} style="background:#ffffff;color:${G};padding:10px">
    <table width="100%" cellspacing="0"><tr>
      <td style="width:90px;text-align:left">${logoHtml(logoData, company.logoPath)}</td>
      <td style="text-align:center">
        <p style="font-size:13pt;font-weight:bold;margin:2px">${compLines[0] || company.name}</p>
        ${ident}${addr}
        <p style="font-size:11pt;font-weight:bold;margin:6px 0 2px 0;border-top:2px solid ${G};border-bottom:2px solid ${G};padding:3px">
          فیش حقوقی — ${periodTitle(period)}</p>
      </td>
      <td style="width:90px"></td></tr></table>
    ${info}
    <table width="100%" cellspacing="6" cellpadding="0"><tr>
      <td width="50%" valign="top">${slipRowsHtml(earn, 'مزایا و درآمدها', tracesArg, true)}</td>
      <td width="50%" valign="top">${slipRowsHtml(ded, 'کسورات', tracesArg, false)}</td></tr></table>
    ${summaryHtml}
    ${slip.extras && slip.extras.length ? `<p style="background:${HG};color:${G};padding:3px 8px;margin:6px 0 3px 0;font-weight:bold;font-size:9pt;border:1px solid ${G}">اطلاعات تکمیلی کارکرد</p><table width="100%" cellspacing="0" cellpadding="3" style="border:1px solid ${G};border-collapse:collapse;font-size:8pt">${slip.extras.map((x) => `<tr><td style="border:1px solid ${G};padding:2px 6px;background:${LG}"><b>${x.label}</b></td><td style="border:1px solid ${G};padding:2px 6px;text-align:left">${x.value}</td></tr>`).join('')}</table>` : ''}
    <table width="100%" cellspacing="0" style="margin-top:14px;font-size:8pt">
      <tr><td style="text-align:center">امضای کارمند</td>
          <td style="text-align:center">محل درج مهر شرکت</td>
          <td style="text-align:center">امضای مدیر مالی / کارفرما</td></tr>
      <tr><td style="height:34px;border-bottom:1px solid ${G}"></td>
          <td style="border-bottom:1px solid ${G}"></td>
          <td style="border-bottom:1px solid ${G}"></td></tr>
    </table>
  </div>`;
}

/** صفحه کامل چاپ فیش
 *  D4: حالت‌های چاپ —
 *   paper='a5l' (پیش‌فرض): تک‌نفره، A5 افقی، هر فیش یک صفحه کامل
 *   paper='a4' + perPage=2: چندنفره، A4 عمودی، هر صفحه ۲ فیش (چاپ گروهی)
 *  اقلام با مبلغ صفر به‌طور خودکار چاپ نمی‌شوند و فهرست اقلام انتخابی هم از سمت برنامه می‌آید */
export function payslipPageHtml(
  slips: Array<SlipInput & { period: { jy: number; jm: number } }>,
  company: PeriodData['company'],
  opts?: { paper?: 'a5l' | 'a4'; perPage?: 1 | 2 },
): string {
  const logoData = readCompanyLogo(company.logoPath);
  const paper = opts?.paper ?? 'a5l';
  const perPage = paper === 'a5l' ? 1 : Math.max(1, Math.min(2, opts?.perPage ?? 2));
  const pageCss = paper === 'a5l'
    ? '@page { size: A5 landscape; margin: 6mm; }'
    : '@page { size: A4 portrait; margin: 8mm; }';
  const slipHeight = paper === 'a5l' ? '' : 'height:136mm;overflow:hidden;';
  // نسخه ۱٫۴٫۶ — fit-to-page: فیش همیشه فقط یک برگه A5 لندسکیپ — با زیاد شدن اقلام، محتوا خودکار کوچک می‌شود
  const A5_AVAIL = 498; // ارتفاع قابل استفاده صفحه A5 لندسکیپ (px)
  const estSlipH = (sl: { items: SlipItem[]; extras?: Array<{ label: string; value: string }> | null }): number => {
    const nE = sl.items.filter((i) => i.kind === 'earning' && i.amount).length;
    const nD = sl.items.filter((i) => i.kind === 'deduction' && i.amount).length;
    return 78 + 6 * 24 + Math.max(nE, nD) * 21 + 70 + 4 * 24 + (sl.extras?.length ?? 0) * 22 + 84 + 36;
  };
  const zoomOf = (sl: { items: SlipItem[]; extras?: Array<{ label: string; value: string }> | null }): string =>
    paper === 'a5l' ? `zoom:${Math.min(1, Math.max(0.6, A5_AVAIL / estSlipH(sl)))};` : '';
  // شماره‌گذاری فیش‌ها برای اتصال کلیک به ردپای محاسبه (۱٫۴٫۵)
  const slipsIdx = slips.map((s, i) => ({ ...s, slipIdx: i }));
  const hasTraces = slipsIdx.some((s) => s.trace);
  const tracesJson = JSON.stringify(slipsIdx.map((s) => ({ traces: s.trace?.traces ?? {}, summaryTraces: s.trace?.summaryTraces ?? {}, inputs: s.trace?.inputs ?? {} })));
  // دسته‌بندی: هر گروه perPage فیش = یک صفحه چاپی
  const pages: Array<Array<typeof slipsIdx[number]>> = [];
  for (let i = 0; i < slipsIdx.length; i += perPage) pages.push(slipsIdx.slice(i, i + perPage));
  const body = pages
    .map((group, pi) => {
      const inner = group
        .map((sl) => `<div style="${slipHeight}${zoomOf(sl)}">${slipHtml(sl, sl.period, company, logoData, true)}</div>`)
        .join('');
      const brk = pi === pages.length - 1 ? '' : ' page-break-after:always;';
      const grid = perPage === 2 ? `display:flex;flex-direction:column;gap:4px;${brk}` : brk;
      return `<div class="pg" style="${grid}">${inner}</div>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>فیش حقوقی — ${company.name}</title>
<style>
${FONT_CSS()}
${pageCss}
@media print { .pg:last-child { page-break-after: auto; } #traceBox { display: none !important; } }
#traceBox { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: none; z-index: 999; align-items: center; justify-content: center; font-family: 'Vazirmatn', Tahoma, sans-serif; }
#traceCard { background: #fff; color: #111827; border-radius: 10px; max-width: 660px; width: 92%; max-height: 82vh; overflow: auto; padding: 16px 18px; }
#traceCard h3 { margin: 0 0 8px; font-size: 15px; color: #0f5c5a; }
#traceCard table { font-size: 12px; margin-top: 0; }
#traceCard th { background: #0f5c5a; color: #fff; padding: 5px 8px; }
#traceCard td { border: 1px solid #888; padding: 4px 8px; }
#traceCard .basis { font-size: 11px; color: #555; background: #fbfaf7; border: 1px dashed #b9a77c; border-radius: 6px; padding: 6px 8px; margin-top: 8px; }
#traceClose { float: left; cursor: pointer; border: 1px solid #999; background: #f6f8fa; border-radius: 6px; padding: 2px 10px; }
</style>
</head>
<body style="margin:0;background:#ffffff;color:${G}">
<div class="no-print" style="position:fixed;top:14px;left:14px;z-index:99">
<button onclick="window.print()" type="button"
  style="padding:9px 22px;font-size:13px;font-weight:bold;cursor:pointer;background:#111827;color:#ffffff;
  border:none;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.25)">
  چاپ فیش (${toPersianDigits(String(slips.length))} نفر)
</button>
${hasTraces ? '<p style="font-size:10.5px;color:#374151;margin:6px 0 0;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;max-width:260px">هر مبلغی که زیرش خط‌چین دارد را کلیک کنید تا مراحل محاسبه آن نمایش داده شود.</p>' : ''}
</div>
${body}
<div id="traceBox" onclick="if(event.target===this)this.style.display='none'">
  <div id="traceCard">
    <button id="traceClose" onclick="document.getElementById('traceBox').style.display='none'">بستن</button>
    <h3 id="traceTitle"></h3>
    <div id="traceInputs" style="font-size:11px;color:#374151;background:#f6f7f8;border:1px solid #d1d5db;border-radius:6px;padding:6px 8px;margin-bottom:8px"></div>
    <table width="100%" cellspacing="0"><thead><tr><th style="width:55%">مرحله محاسبه</th><th>مقدار</th></tr></thead><tbody id="traceBody"></tbody></table>
    <div class="basis" id="traceBasis"></div>
  </div>
</div>
${hasTraces ? `<script>
  var TRACES = ${tracesJson};
  function faMoney(v) { return String(Math.round(v||0).toLocaleString('en-US')).replace(/\\d/g, function(d){return '۰۱۲۳۴۵۶۷۸۹'[d];}); }
  document.querySelectorAll('.amt').forEach(function(el) {
    el.addEventListener('click', function() {
      var t = TRACES[Number(el.dataset.slip)]; if (!t) return;
      var tr = el.dataset.sum ? t.summaryTraces[el.dataset.sum] : t.traces[el.dataset.code];
      if (!tr) return;
      document.getElementById('traceTitle').textContent = tr.formula || '';
      var inp = document.getElementById('traceInputs');
      var rows = Object.keys(t.inputs || {}).map(function(k){ return '<b>' + k + ':</b> ' + t.inputs[k]; });
      inp.innerHTML = rows.length ? rows.join(' &nbsp;|&nbsp; ') : '';
      inp.style.display = rows.length ? '' : 'none';
      document.getElementById('traceBody').innerHTML = (tr.steps || []).map(function(s){
        return '<tr><td>' + s.label + '</td><td style="text-align:left;white-space:nowrap">' + s.value + '</td></tr>';
      }).join('') || '<tr><td colspan="2">مرحله‌ای ثبت نشده است</td></tr>';
      document.getElementById('traceBasis').textContent = tr.basis ? 'مبنای قانونی: ' + tr.basis : '';
      document.getElementById('traceBox').style.display = 'flex';
    });
  });
</script>` : ''}
</body>
</html>`;
}
