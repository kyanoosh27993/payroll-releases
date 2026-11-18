// خروجی اکسل استاندارد — exceljs
// سربرگ رسمی شرکت + لوگو + زیبرا سفید/خاکستری خیلی کمرنگ (متن همیشه مشکی خوانا) + چاپ A4
// C6: exceljs فقط هنگام تولید فایل (lazy) بارگذاری می‌شود تا استارت برنامه سبک بماند
import type ExcelJS from 'exceljs';
import { formatMoney, toPersianDigits } from './numbers';

export const ZEBRA_FILL = 'FFF5F6F8';     // سطرهای زوج: تقریبا سفید
export const HEADER_FILL = 'FFE8EAED';    // هدر: خاکستری خیلی کمرنگ
export const SUM_FILL = 'FFE8EAED';
const TEXT_COLOR = 'FF111827';

export interface CompanyInfo {
  name: string; nationalId?: string; economicCode?: string; ssoWorkshopCode?: string;
  phone?: string; address?: string; logoPath?: string; logoData?: Buffer;
}

export function companyHeaderLines(company: CompanyInfo | null): string[] {
  const c = company || ({} as CompanyInfo);
  const lines = [c.name || ''];
  const extra: string[] = [];
  if (c.nationalId) extra.push('شناسه ملی: ' + c.nationalId);
  if (c.economicCode) extra.push('کد اقتصادی: ' + c.economicCode);
  if (c.ssoWorkshopCode) extra.push('کد کارگاه بیمه: ' + c.ssoWorkshopCode);
  if (c.phone) extra.push('تلفن: ' + c.phone);
  if (extra.length) lines.push(extra.join('   |   '));
  if (c.address) lines.push('نشانی: ' + c.address);
  return lines;
}

export interface ExportTableOpts {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
  moneyCols?: Set<number> | number[];
  sumCols?: boolean;
  company?: CompanyInfo | null;
  landscape?: boolean;
  extraNote?: string;
}

export async function exportTableXlsx(opts: ExportTableOpts): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.views = [{ x: 0, y: 0, width: 1200, height: 800, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  const ws = wb.addWorksheet('گزارش', { views: [{ rightToLeft: true, state: 'frozen', ySplit: headerRowCount(opts) }] });
  const money = new Set(opts.moneyCols ?? []);
  const ncol = opts.headers.length;
  let r = 1;

  // لوگو
  if (opts.company?.logoData) {
    try {
      const ext = (opts.company.logoPath || '').endsWith('.jpg') || (opts.company.logoPath || '').endsWith('.jpeg') ? 'jpeg' : 'png';
      const img = wb.addImage({ buffer: opts.company.logoData as unknown as ExcelJS.Buffer, extension: ext });
      const anchorCol = Math.max(0, ncol - 1);
      ws.addImage(img, { tl: { col: anchorCol, row: 0 }, ext: { width: 64, height: 64 } });
    } catch { /* لوگو اختیاری است */ }
  }

  // سربرگ شرکت
  const lines = companyHeaderLines(opts.company ?? null).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const row = ws.getRow(r++);
    const cell = row.getCell(1);
    cell.value = lines[i];
    cell.font = { name: 'Tahoma', size: i === 0 ? 11 : 8, bold: i === 0, color: { argb: i === 0 ? TEXT_COLOR : 'FF374151' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    ws.mergeCells(r - 1, 1, r - 1, ncol);
  }
  // عنوان
  {
    const row = ws.getRow(r++);
    const cell = row.getCell(1);
    cell.value = opts.title;
    cell.font = { name: 'Tahoma', size: 12, bold: true, color: { argb: TEXT_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(r - 1, 1, r - 1, ncol);
    row.height = 24;
  }
  // زیرعنوان
  if (opts.subtitle) {
    const row = ws.getRow(r++);
    const cell = row.getCell(1);
    cell.value = opts.subtitle;
    cell.font = { name: 'Tahoma', size: 9, color: { argb: 'FF475569' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(r - 1, 1, r - 1, ncol);
  }
  r++;

  // هدر جدول
  const hrow = ws.getRow(r++);
  opts.headers.forEach((h, i) => {
    const cell = hrow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Tahoma', size: 9, bold: true, color: { argb: TEXT_COLOR } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
  });
  hrow.height = 22;

  // بدنه — زیبرا سفید / خاکستری خیلی کمرنگ
  opts.rows.forEach((row, ri) => {
    const xr = ws.getRow(r++);
    const zebra = ri % 2 === 1;
    row.forEach((v, ci) => {
      const cell = xr.getCell(ci + 1);
      cell.value = v ?? '';
      cell.font = { name: 'Tahoma', size: 9, color: { argb: TEXT_COLOR } };
      cell.border = thinBorder();
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
      if (money.has(ci) && typeof v === 'number') cell.numFmt = '#,##0';
    });
  });

  // جمع کل
  if (opts.sumCols && opts.rows.length) {
    const xr = ws.getRow(r++);
    xr.getCell(1).value = 'جمع کل';
    xr.getCell(1).font = { name: 'Tahoma', size: 9, bold: true, color: { argb: TEXT_COLOR } };
    const dataStart = hrow.number + 1, dataEnd = hrow.number + opts.rows.length;
    money.forEach((ci) => {
      const cell = xr.getCell(ci + 1);
      const colLetter = ws.getColumn(ci + 1).letter;
      cell.value = { formula: `SUM(${colLetter}${dataStart}:${colLetter}${dataEnd})` };
      cell.font = { name: 'Tahoma', size: 9, bold: true, color: { argb: TEXT_COLOR } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUM_FILL } };
      cell.border = thinBorder();
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    xr.getCell(1).border = thinBorder();
    xr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUM_FILL } };
  }

  // عرض ستون‌ها
  opts.headers.forEach((h, i) => {
    let maxlen = h.length * 1.1;
    for (const row of opts.rows.slice(0, 80)) {
      if (row.length > i) maxlen = Math.max(maxlen, String(row[i] ?? '').length);
    }
    ws.getColumn(i + 1).width = Math.max(10, Math.min(30, maxlen * 1.25 + 4));
  });

  if (opts.extraNote) {
    const nr = ws.getRow(r + 1);
    nr.getCell(1).value = opts.extraNote;
    nr.getCell(1).font = { name: 'Tahoma', size: 8, color: { argb: 'FF64748B' } };
  }

  // چاپ A4
  ws.pageSetup = {
    paperSize: 9, orientation: opts.landscape ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.pageSetup.printTitlesRow = `${hrow.number}:${hrow.number}`;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function headerRowCount(opts: ExportTableOpts): number {
  // برای فریز شدن زیر هدر جدول: سربرگ شرکت (تا ۳ خط) + عنوان + زیرعنوان + هدر جدول
  const lines = companyHeaderLines(opts.company ?? null).filter(Boolean).length;
  return lines + 1 + (opts.subtitle ? 1 : 0) + 1 + 1;
}

function thinBorder(): ExcelJS.Borders {
  const style: ExcelJS.Border = { style: 'thin', color: { argb: 'FF94A3B8' } };
  return { top: style, left: style, bottom: style, right: style, diagonal: {} };
}

/** خروجی لیست بانک: نام، کد ملی، حساب، مانده قبلی، خالص، جمع قابل پرداخت */
export interface BankRow {
  firstName: string; lastName: string; nationalId: string;
  bankAccount: string; bankName: string;
  prevBalance: number; netPay: number; payPaid: boolean; payApproved: boolean;
}

export function bankListRows(rows: BankRow[], onlyApproved = false): Array<Array<string | number>> {
  const out: Array<Array<string | number>> = [];
  let i = 0;
  for (const r of rows) {
    if (onlyApproved && !r.payApproved) continue;
    i++;
    const total = (r.netPay || 0) + (r.prevBalance || 0);
    out.push([
      toPersianDigits(String(i)), `${r.firstName} ${r.lastName}`,
      toPersianDigits(r.nationalId || ''), toPersianDigits(r.bankAccount || ''),
      r.bankName || '', r.prevBalance || 0, r.netPay, total,
      r.payPaid ? 'پرداخت شده' : 'در انتظار پرداخت',
    ]);
  }
  return out;
}

export { formatMoney };
