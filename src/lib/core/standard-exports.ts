// فایل‌های استاندارد دولتی — پورت standard_exports.py
// مالیات: WPYYYYMM.TXT (۲۳ فیلد) + WHYYYYMM.TXT (۳۹ فیلد) طبق راهنمای نسخه ۱.۷.۰.۴
// بیمه: DSKKAR00.dbf + DSKKWOR00.dbf مطابق نرم‌افزار رسمی «لیست دیسک»
import { normalizeDigits, parseJalaliDateStr } from './numbers';
import * as iconv from 'iconv-lite';

// ---------------------------------------------------------------- DBF (dBase III)
export interface DbfField { name: string; type: 'C' | 'N'; length: number; decimals: number }

export function dbfWrite(fields: DbfField[], records: Array<Record<string, string | number>>, encoding = 'cp1256'): Buffer {
  const headerLen = 32 + 32 * fields.length + 1;
  const recLen = fields.reduce((s, f) => s + f.length, 0) + 1;
  const buf: Buffer[] = [];
  const head = Buffer.alloc(32);
  head.writeUInt8(3, 0);
  head.writeUInt32LE(records.length, 4);
  head.writeUInt16LE(headerLen, 8);
  head.writeUInt16LE(recLen, 10);
  buf.push(head);
  for (const f of fields) {
    const fd = Buffer.alloc(32);
    fd.write(f.name.slice(0, 11), 0, 'ascii');
    fd.write(f.type, 11, 'ascii');
    fd.writeUInt8(f.length, 16);
    fd.writeUInt8(f.decimals, 17);
    buf.push(fd);
  }
  buf.push(Buffer.from([0x0d]));
  for (const rec of records) {
    const parts: Buffer[] = [Buffer.from([0x20])];
    for (const f of fields) {
      const v = rec[f.name];
      if (f.type === 'N') {
        const n = typeof v === 'number' ? v : parseFloat(normalizeDigits(v ?? 0)) || 0;
        let s = f.decimals > 0 ? n.toFixed(f.decimals) : String(Math.round(n));
        s = s.slice(0, f.length).padStart(f.length, ' ');
        parts.push(Buffer.from(s, 'binary'));
      } else {
        let b = iconv.encode(String(v ?? ''), encoding);
        if (b.length > f.length) b = b.subarray(0, f.length);
        const out = Buffer.alloc(f.length, 0x20);
        b.copy(out, 0);
        parts.push(out);
      }
    }
    buf.push(Buffer.concat(parts));
  }
  return Buffer.concat(buf);
}

// ---------------------------------------------------------------- مالیات
export const TAX_EDUCATION_MAP: Record<string, number> = {
  '': 1, 'زیر دیپلم': 1, 'سیکل': 1, 'سيكل': 1, 'سیکل اول متوسطه': 1,
  'دیپلم': 2, 'فوق دیپلم': 3, 'ليسانس': 4, 'لیسانس': 4,
  'فوق ليسانس': 5, 'فوق لیسانس': 5, 'دكتري': 6, 'دکتری': 6, 'فوق دکتری': 7,
};
export const TAX_EMPLOYMENT_MAP: Record<string, number> = {
  'قراردادی': 1, 'شرکتی': 2, 'رسمی': 3, 'پیمانی': 4, 'مامور': 5, 'کارمزدی': 6,
  'خرید خدمت': 7, 'ساعتی': 8, 'روزمزد': 9, 'رسمی-آزمایشی': 10, 'رسمی فصلی': 11, 'سایر': 12,
};

const digits = (s: unknown, maxlen?: number) => {
  const v = normalizeDigits(String(s ?? '')).replace(/-/g, '').trim();
  return maxlen ? v.slice(0, maxlen) : v;
};

const jdate8 = (dstr: unknown) => {
  const p = parseJalaliDateStr(String(dstr ?? ''));
  return p ? `${p[0]}${String(p[1]).padStart(2, '0')}${String(p[2]).padStart(2, '0')}` : '';
};

export interface PersonRow {
  [k: string]: unknown;
  nationalId: string; firstName: string; lastName: string; fatherName: string;
  birthDate: string; idNumber: string; birthPlace?: string; idIssuePlace?: string;
  education: string; insuranceType: number; ssoNumber: string; ssoInsurer?: string;
  taxExemptionCode?: number; postalCode?: string; address?: string;
  jobCategory?: number; jobTitle: string; employmentType?: number; hireDate?: string;
  endWorkDate?: string;
}

export interface WpRecord { [k: string]: string | number }

/** ردیف‌های فایل WP (فهرست کارکنان) — ۲۳ فیلد */
export function taxWpRecords(rows: PersonRow[]): WpRecord[] {
  return rows.map((r) => ({
    f1_nationality: 1,
    f2_national_id: digits(r.nationalId),
    f3_first: r.firstName || '',
    f4_last: r.lastName || '',
    f5_father: r.fatherName || '',
    f6_birth: jdate8(r.birthDate),
    f7_idnum: digits(r.idNumber),
    f8_birthplace: r.birthPlace || r.idIssuePlace || '',
    f9_education: TAX_EDUCATION_MAP[String(r.education || '').trim()] ?? 1,
    f10_ins_type: Number(r.insuranceType ?? 2),
    f11_ins_no: digits(r.ssoNumber, 10),
    f12_ins_name: Number(r.insuranceType ?? 2) === 2 ? 'تامین اجتماعی' : (r.ssoInsurer || ''),
    f13_exemption: Number(r.taxExemptionCode ?? 1),
    f14_country_citizen: 103,
    f15_country_living: 103,
    f16_postal: digits(r.postalCode, 10),
    f17_address: r.address || '',
    f18_job_category: Number(r.jobCategory ?? 12),
    f19_position: r.jobTitle || '',
    f20_employment: Number(r.employmentType ?? 1),
    f21_start: jdate8(r.hireDate),
    f22_end: jdate8(r.endWorkDate),
    f23_retire: '',
  }));
}

export const WP_KEYS = [
  'f1_nationality', 'f2_national_id', 'f3_first', 'f4_last', 'f5_father', 'f6_birth',
  'f7_idnum', 'f8_birthplace', 'f9_education', 'f10_ins_type', 'f11_ins_no',
  'f12_ins_name', 'f13_exemption', 'f14_country_citizen', 'f15_country_living',
  'f16_postal', 'f17_address', 'f18_job_category', 'f19_position', 'f20_employment',
  'f21_start', 'f22_end', 'f23_retire',
];

export const WH_ORDER = [
  'f1_national_id', 'f2_paytype', 'f3_service_place', 'f4_budget_except', 'f5_currency',
  'f6_fx_rate', 'f7_gross_sustainable_cash', 'f8_arrears_sus_cash', 'f9_housing',
  'f10_housing_deduct', 'f11_car', 'f12_car_deduct', 'f13_other_sus_noncash',
  'f14_arrears_sus_noncash', 'f15_honorary', 'f16_research', 'f17_overtime', 'f18_travel',
  'f19_mission', 'f20_karaneh', 'f21_bonus', 'f22_year_end_bonus', 'f23_annual_eydi',
  'f24_severance', 'f25_firing_damages', 'f26_buyback', 'f27_seniority_pay',
  'f28_unused_leave', 'f29_other_non_sus_cash', 'f30_arrears_non_sus_cash',
  'f31_non_sus_noncash', 'f32_arrears_non_sus_noncash', 'f33_ins137_health',
  'f34_ins137_life', 'f35_net_paid', 'f36_teaching', 'f37_watchman', 'f38_welfare',
  'f39_effort',
];

/** نگاشت آیتم‌های فیش → فیلد WH (قابل ویرایش) */
export const DEFAULT_WH_ITEM_MAP: Record<string, number> = {
  base_wage: 7, seniority: 7, housing: 7, food: 7, child_allow: 7,
  worker_ben: 7, shift_allow: 7, attraction: 7, family_allow: 7,
  adjustment: 7, supervision: 7, labor_market: 7, education_aid: 7,
  fixed_ot: 7, other_ben: 7,
  overtime: 17,
  holiday_work: 29, friday_work: 29, night_work: 29, tax_free_other: 29,
  eydi: 23, year_end_bonus: 22, bonus: 21, seniority_settle: 27,
  unused_leave: 28, severance: 24,
};

export interface WhRow {
  personnelId: number; nationalId: string; netPay: number; prevBalance: number;
  items: Array<{ itemCode: string; amount: number }>;
}

/** ردیف‌های فایل WH (فهرست حقوق ریالی) — ۳۹ فیلد */
export function taxWhRecords(rows: WhRow[]): WpRecord[] {
  return rows.map((r) => {
    const fields: Record<number, number> = {};
    for (let i = 1; i <= 39; i++) fields[i] = 0;
    for (const it of r.items) {
      const idx = DEFAULT_WH_ITEM_MAP[it.itemCode];
      if (idx) fields[idx] += it.amount;
    }
    fields[9] = 1;
    fields[11] = 1;
    fields[35] = Math.round((r.netPay || 0) + (r.prevBalance || 0));
    const rec: WpRecord = {
      f1_national_id: digits(r.nationalId),
      f2_paytype: 1, f3_service_place: 1, f4_budget_except: 1,
      f5_currency: 84, f6_fx_rate: 1,
    };
    for (let i = 7; i <= 39; i++) rec[WH_ORDER[i - 1]] = Math.round(fields[i]);
    return rec;
  });
}

function csvLine(rec: WpRecord, keys: string[]): string {
  return keys.map((k) => {
    const v = rec[k];
    if (typeof v === 'number' && v === Math.floor(v)) return String(Math.floor(v));
    return String(v ?? '');
  }).join(',');
}

/** ساخت محتوای فایل‌های مالیات (WP/WH) — CSV/UTF-8/CRLF */
export function makeTaxFileContents(jy: number, jm: number, wpRecords: WpRecord[], whRecords: WpRecord[]): Array<{ name: string; content: string }> {
  const stamp = `${jy}${String(jm).padStart(2, '0')}`;
  return [
    {
      name: `WP${stamp}.TXT`,
      content: wpRecords.map((r) => csvLine(r, WP_KEYS)).join('\r\n') + (wpRecords.length ? '\r\n' : ''),
    },
    {
      name: `WH${stamp}.TXT`,
      content: whRecords.map((r) => csvLine(r, WH_ORDER)).join('\r\n') + (whRecords.length ? '\r\n' : ''),
    },
  ];
}

// ---------------------------------------------------------------- بیمه
export interface InsRow {
  ssoNumber: string; nationalId: string; firstName: string; lastName: string;
  workedDays: number; insuredBase: number; workerIns: number; employerIns: number; unemploymentIns: number;
}

/** ساخت فایل‌های بیمه DBF: DSKKAR00.dbf + DSKKWOR00.dbf */
export function makeInsuranceBuffers(
  company: { ssoWorkshopCode?: string; ssoBranchCode?: string; ssoContractRow?: string; managerName?: string; name?: string },
  rows: InsRow[], jy: number, jm: number, calDays = 30,
): Array<{ name: string; content: Buffer }> {
  const workshop = normalizeDigits(String(company.ssoWorkshopCode || ''));
  const branch = normalizeDigits(String(company.ssoBranchCode || '')).slice(0, 3);
  const contractRow = normalizeDigits(String(company.ssoContractRow || '')) || '000';
  const karName = company.managerName || company.name || '';
  const totalDays = rows.reduce((s, r) => s + (r.workedDays || calDays), 0);
  const totalDaily = Math.round(rows.reduce((s, r) => s + r.insuredBase * calDays / Math.max(totalDays, 1), 0));
  const kar = {
    KARGAH: workshop, ROW: contractRow, NAME: karName, BRANCH: branch,
    YY: String(jy % 100).padStart(2, '0'), MM: String(jm).padStart(2, '0'),
    PNUM: rows.length, DAY: totalDays, DAILY: totalDaily, MSTMR: 0,
  };
  const wor = rows.map((r) => ({
    KARGAH: workshop, ROW: contractRow,
    CODE: digits(r.ssoNumber, 10), NATCODE: digits(r.nationalId, 10),
    NAME: r.firstName || '', FAM: r.lastName || '',
    DAY: r.workedDays || calDays,
    DAILY: Math.round(r.insuredBase * calDays / Math.max(totalDays, 1)),
    MS: 0, BASE: Math.round(r.insuredBase),
    WINS: Math.round(r.workerIns || 0), EINS: Math.round(r.employerIns || 0), UINS: Math.round(r.unemploymentIns || 0),
  }));
  const karFields: DbfField[] = [
    { name: 'KARGAH', type: 'C', length: 10, decimals: 0 }, { name: 'ROW', type: 'C', length: 3, decimals: 0 },
    { name: 'NAME', type: 'C', length: 40, decimals: 0 }, { name: 'BRANCH', type: 'C', length: 3, decimals: 0 },
    { name: 'YY', type: 'C', length: 2, decimals: 0 }, { name: 'MM', type: 'C', length: 2, decimals: 0 },
    { name: 'PNUM', type: 'N', length: 4, decimals: 0 }, { name: 'DAY', type: 'N', length: 5, decimals: 0 },
    { name: 'DAILY', type: 'N', length: 14, decimals: 0 }, { name: 'MSTMR', type: 'N', length: 14, decimals: 0 },
  ];
  const worFields: DbfField[] = [
    { name: 'KARGAH', type: 'C', length: 10, decimals: 0 }, { name: 'ROW', type: 'C', length: 3, decimals: 0 },
    { name: 'CODE', type: 'C', length: 10, decimals: 0 }, { name: 'NATCODE', type: 'C', length: 10, decimals: 0 },
    { name: 'NAME', type: 'C', length: 15, decimals: 0 }, { name: 'FAM', type: 'C', length: 25, decimals: 0 },
    { name: 'DAY', type: 'N', length: 3, decimals: 0 }, { name: 'DAILY', type: 'N', length: 10, decimals: 0 },
    { name: 'MS', type: 'N', length: 12, decimals: 0 }, { name: 'BASE', type: 'N', length: 14, decimals: 0 },
    { name: 'WINS', type: 'N', length: 12, decimals: 0 }, { name: 'EINS', type: 'N', length: 12, decimals: 0 },
    { name: 'UINS', type: 'N', length: 12, decimals: 0 },
  ];
  return [
    { name: 'DSKKAR00.dbf', content: dbfWrite(karFields, [kar]) },
    { name: 'DSKWOR00.dbf', content: dbfWrite(worFields, wor) },
  ];
}
