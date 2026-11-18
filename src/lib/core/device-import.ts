// ایمپورت فایل خروجی دستگاه حضور و غیاب («گزارش روزانه فردی» — ۲۹ شیت)
// پورت attendance_import.py با SheetJS:
// هر شیت = یک پرسنل؛ کد دستگاه در ردیف «قسمت»، نام در ردیف «نام»،
// دوره از ردیف ازتاریخ/تاتاریخ، هدر جدول روزانه در ردیف «روز هفته»
// C6: xlsx فقط هنگام ایمپورت فایل (lazy) بارگذاری می‌شود
import type * as XLSXTypes from 'xlsx';
let X: typeof XLSXTypes | null = null;
import { parseHHMM, normalizeDigits, parseJalaliDateStr, cleanText } from './numbers';

export interface DeviceDay {
  date: [number, number, number];
  status: string;
  entry1: number; exit1: number; entry2: number; exit2: number; entry3: number; exit3: number;
  lateMin: number; earlyMin: number; missingMin: number; leaveMin: number;
  missionMin: number; overtimeMin: number; freeOvertimeMin: number; workedMin: number;
}

export interface DeviceEmployee {
  cardNo: string; name: string;
  period: [number, number, number] | null;
  daily: DeviceDay[];
  totals: Record<string, number>;
}

export interface DeviceFile {
  period: [number, number, number] | null;
  employees: DeviceEmployee[];
}

function cell(sh: XLSXTypes.WorkSheet, r: number, c: number): XLSXTypes.CellObject | undefined {
  const addr = X!.utils.encode_cell({ r, c });
  return sh[addr] as XLSXTypes.CellObject | undefined;
}

function cellStr(sh: XLSXTypes.WorkSheet, r: number, c: number): string {
  const v = cell(sh, r, c);
  if (!v) return '';
  return normalizeDigits(v.w ?? String(v.v ?? '')).trim();
}

function sheetSize(sh: XLSXTypes.WorkSheet): { rows: number; cols: number } {
  const ref = sh['!ref'] || 'A1:A1';
  const range = X!.utils.decode_range(ref);
  return { rows: range.e.r + 1, cols: range.e.c + 1 };
}

/** جستجوی متن در سلول‌ها → (row, col) */
function findCell(sh: XLSXTypes.WorkSheet, text: string): [number, number] | null {
  const { rows, cols } = sheetSize(sh);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = cell(sh, r, c);
      if (v && typeof v.v === 'string' && (v.v as string).includes(text)) return [r, c];
    }
  }
  return null;
}

/** اولین مقدار در ستون‌های بعدی سلول برچسب */
function valueRight(sh: XLSXTypes.WorkSheet, r: number, c: number, maxShift = 6): string {
  const { cols } = sheetSize(sh);
  for (let cc = c + 1; cc <= Math.min(c + maxShift, cols - 1); cc++) {
    const s = cellStr(sh, r, cc);
    if (s) return s;
  }
  return '';
}

function parseSheet(sh: XLSXTypes.WorkSheet, log: (m: string) => void): DeviceEmployee | null {
  const { rows, cols } = sheetSize(sh);
  // کد دستگاه (قسمت)
  let cardNo = '';
  let loc = findCell(sh, 'قسمت');
  if (loc) cardNo = valueRight(sh, loc[0], loc[1]).trim();
  // نام
  let name = '';
  loc = findCell(sh, 'نام');
  if (loc) {
    for (let cc = loc[1] - 8; cc < loc[1]; cc++) {
      if (cc < 0) continue;
      const s = cellStr(sh, loc[0], cc);
      if (s) name = s;
    }
  }
  // دوره
  let period: [number, number, number] | null = null;
  loc = findCell(sh, 'ازتاریخ');
  if (loc && loc[1] >= 6) period = parseJalaliDateStr(cellStr(sh, loc[0], loc[1] - 6));
  if (!period) {
    loc = findCell(sh, 'تاتاریخ');
    if (loc && loc[1] >= 7) period = parseJalaliDateStr(cellStr(sh, loc[0], loc[1] - 7));
  }
  if (!cardNo && !name) return null;

  // هدر جدول روزانه: ردیف حاوی «روز هفته»
  const hdr = findCell(sh, 'روز هفته');
  if (!hdr) {
    log(`شیت ${cardNo || name}: جدول روزانه یافت نشد`);
    return null;
  }
  const hr = hdr[0];
  const colmap = new Map<string, number>();
  for (let c = 0; c < cols; c++) {
    const v = cell(sh, hr, c);
    if (v && typeof v.v === 'string') {
      colmap.set((v.v as string).trim().replace(/^:+/, '').trim(), c);
    }
  }
  const g = (key: string) => colmap.get(key) ?? -1;

  const daily: DeviceDay[] = [];
  const totals: Record<string, number> = {
    overtimeMin: 0, missingMin: 0, lateMin: 0, earlyMin: 0,
    leaveMin: 0, missionMin: 0, freeOvertimeMin: 0, workedMin: 0,
  };
  for (let r = hr + 1; r < rows; r++) {
    const dv = g('تاریخ') >= 0 ? cellStr(sh, r, g('تاریخ')) : '';
    const dayPeriod = parseJalaliDateStr(dv);
    if (!dayPeriod) {
      // ردیف جمع «مجموع»
      const stCell = g('وضعیت') >= 0 ? cellStr(sh, r, g('وضعیت')) : '';
      if (stCell.includes('مجموع')) {
        totals.freeOvertimeMin = g('اضافه آزاد') >= 0 ? parseHHMM(cell(sh, r, g('اضافه آزاد'))?.v, 0) : 0;
        totals.overtimeMin = g('اضافه کار') >= 0 ? parseHHMM(cell(sh, r, g('اضافه کار'))?.v, 0) : 0;
        totals.missingMin = g('کسرکار') >= 0 ? parseHHMM(cell(sh, r, g('کسرکار'))?.v, 0) : 0;
        totals.lateMin = g('تاخیر') >= 0 ? parseHHMM(cell(sh, r, g('تاخیر'))?.v, 0) : 0;
        totals.earlyMin = g('تعجیل') >= 0 ? parseHHMM(cell(sh, r, g('تعجیل'))?.v, 0) : 0;
        totals.leaveMin = g('مرخصی') >= 0 ? parseHHMM(cell(sh, r, g('مرخصی'))?.v, 0) : 0;
        totals.missionMin = g('ماموریت') >= 0 ? parseHHMM(cell(sh, r, g('ماموریت'))?.v, 0) : 0;
        totals.workedMin = g('مجموع') >= 0 ? parseHHMM(cell(sh, r, g('مجموع'))?.v, 0) : 0;
      }
      continue;
    }
    if (period && dayPeriod[0] === period[0] && dayPeriod[1] !== period[1]) continue;

    const minute = (key: string) => (g(key) >= 0 ? parseHHMM(cell(sh, r, g(key))?.v, 0) : 0);
    const clock = (key: string) => {
      const c = g(key);
      if (c < 0) return -1;
      const s = cellStr(sh, r, c).replace(/^\*+/, '').trim();
      if (!s) return -1;
      return parseHHMM(s, -1);
    };
    daily.push({
      date: [dayPeriod[0], dayPeriod[1], dayPeriod[2]],
      status: g('وضعیت') >= 0 ? cellStr(sh, r, g('وضعیت')) : '',
      entry1: clock('ورود1'), exit1: clock('خروج1'),
      entry2: clock('ورود2'), exit2: clock('خروج2'),
      entry3: clock('ورود3'), exit3: clock('خروج3'),
      lateMin: minute('تاخیر'), earlyMin: minute('تعجیل'),
      missingMin: minute('کسرکار'), leaveMin: minute('مرخصی'),
      missionMin: minute('ماموریت'), overtimeMin: minute('اضافه کار'),
      freeOvertimeMin: minute('اضافه آزاد'), workedMin: minute('مجموع'),
    });
  }
  return { cardNo, name, period, daily, totals };
}

export async function parseDeviceFile(buffer: Buffer, log: (m: string) => void = () => {}): Promise<DeviceFile> {
  X = (await import('xlsx')) as unknown as typeof XLSXTypes;
  const wb = X!.read(buffer, { type: 'buffer' });
  const result: DeviceFile = { period: null, employees: [] };
  for (const name of wb.SheetNames) {
    const emp = parseSheet(wb.Sheets[name], log);
    if (emp) {
      result.employees.push(emp);
      if (emp.period && !result.period) result.period = emp.period;
    }
  }
  return result;
}

export interface SaveResult {
  saved: number;
  unmatched: Array<{ card: string; name: string }>;
  newEmployees: string[];
  monthId: number | null;
  period: [number, number] | null;
}

const normName = (s: string) => cleanText(s).replace(/ك/g, 'ک').replace(/\s+/g, '');

/**
 * ذخیره نتیجه پارس در دیتابیس + تطبیق پرسنل (کارت → نام → ایجاد خودکار «غیرفعال»)
 */
export async function saveDeviceToDb(
  fyId: number, companyId: number, parsed: DeviceFile,
  recalc: (monthId: number, jy: number, jm: number) => Promise<void>,
  tx?: any,
): Promise<SaveResult> {
  const d = tx ?? (await import('@/lib/db')).db;
  if (!parsed.employees.length) {
    return { saved: 0, unmatched: [], newEmployees: [], monthId: null, period: null };
  }
  const per = parsed.period ?? parsed.employees[0].period;
  if (!per) return { saved: 0, unmatched: [], newEmployees: [], monthId: null, period: null };
  const [jy, jm] = [per[0], per[1]];

  const month = await d.attendanceMonth.upsert({
    where: { fiscalYearId_jy_jm: { fiscalYearId: fyId, jy, jm } },
    create: { fiscalYearId: fyId, jy, jm, source: 'فایل دستگاه' },
    update: { source: 'فایل دستگاه', importedAt: new Date() },
  });
  // ردیف‌های دستی ویرایش‌شده (ستاره‌دار) با ایمپورت مجدد دستگاه بازنویسی نمی‌شوند
  await d.attendanceDaily.deleteMany({ where: { monthId: month.id, edited: false } });

  const plist = await d.personnel.findMany({
    where: { companyId },
    select: { id: true, cardNo: true, firstName: true, lastName: true, personnelCode: true },
  });

  const saved: string[] = [];
  const unmatched: Array<{ card: string; name: string }> = [];
  const newEmployees: string[] = [];

  for (const emp of parsed.employees) {
    let pid: number | null = null;
    const card = normalizeDigits(emp.cardNo).trim();
    // ۱) تطبیق با شماره کارت
    for (const p of plist) {
      if (card && normalizeDigits(p.cardNo || '').trim() === card) { pid = p.id; break; }
    }
    // ۲) تطبیق با نام
    if (pid === null) {
      const en = normName(emp.name);
      if (en) {
        for (const p of plist) {
          const full = normName(`${p.firstName} ${p.lastName}`);
          if (en && (en.includes(full) || full.includes(en))) { pid = p.id; break; }
        }
      }
    }
    // ۳) پرسنل جدید خودکار — غیرفعال تا اطلاعات پرونده کامل شود
    if (pid === null) {
      const name = cleanText(emp.name || '');
      const parts = name.split(' ');
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ') || '';
      const base = card || 'D';
      let code = base, i = 2;
      while (true) {
        const ex = await d.personnel.findFirst({ where: { companyId, personnelCode: code }, select: { id: true } });
        if (!ex) break;
        code = `${base}-${i++}`;
      }
      const np = await d.personnel.create({
        data: {
          companyId, personnelCode: code, cardNo: card, firstName: first, lastName: last,
          status: 'غیرفعال',
          notes: 'ایجاد خودکار از فایل دستگاه — اطلاعات پرسنل و قرارداد باید تکمیل شود',
        },
      });
      pid = np.id;
      plist.push({ id: np.id, cardNo: card, firstName: first, lastName: last, personnelCode: code });
      unmatched.push({ card, name });
      newEmployees.push(name || card);
    }
    if (emp.daily.length) {
      await d.attendanceDaily.createMany({
        data: emp.daily.map((dd) => ({
          monthId: month.id, personnelId: pid!, day: dd.date[2], status: dd.status,
          entry1: dd.entry1, exit1: dd.exit1, entry2: dd.entry2, exit2: dd.exit2,
          entry3: dd.entry3, exit3: dd.exit3,
          lateMin: dd.lateMin, earlyMin: dd.earlyMin, missingMin: dd.missingMin,
          leaveMin: dd.leaveMin, missionMin: dd.missionMin,
          overtimeMin: dd.overtimeMin, freeOvertimeMin: dd.freeOvertimeMin,
          workedMin: dd.workedMin,
        })),
      });
    }
    saved.push(emp.name || emp.cardNo);
  }
  await recalc(month.id, jy, jm);
  return { saved: saved.length, unmatched, newEmployees, monthId: month.id, period: [jy, jm] };
}
