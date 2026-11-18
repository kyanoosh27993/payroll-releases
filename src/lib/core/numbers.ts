// نرمال‌سازی اعداد — قلب یکپارچگی داده‌ها (پورت numbers.py)
// هر عددی از هر منبعی (ارقام فارسی/عربی/انگلیسی، جداکننده هزارگان، فرمت H:MM دستگاه) به عدد انگلیسی استاندارد تبدیل می‌شود.

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';
const EN = '0123456789';

export function normalizeDigits(text: unknown): string {
  if (text === null || text === undefined) return '';
  let s = String(text);
  let out = '';
  for (const ch of s) {
    const fi = FA.indexOf(ch);
    const ai = AR.indexOf(ch);
    out += fi >= 0 ? EN[fi] : ai >= 0 ? EN[ai] : ch;
  }
  return out;
}

export function toPersianDigits(text: unknown): string {
  if (text === null || text === undefined) return '';
  let out = '';
  for (const ch of String(text)) {
    const ei = EN.indexOf(ch);
    out += ei >= 0 ? FA[ei] : ch;
  }
  return out;
}

/** پارس هر ورودی عددی به number انگلیسی — نامعتبر → default */
export function parseNumber(value: unknown, def: number | null = 0): number | null {
  if (value === null || value === undefined) return def;
  if (typeof value === 'number') return isFinite(value) ? value : def;
  let s = normalizeDigits(value).trim();
  if (!s) return def;
  s = s.replace(/(?<=\d)[،٬,\s\u200f\u200e](?=\d)/g, '');
  s = s.replace('٫', '.');
  if (/^\d+\/\d+$/.test(s)) s = s.replace('/', '.');
  s = s.replace(/[^0-9.+\-]/g, '');
  if (['', '.', '-', '+', '-.', '+.'].includes(s)) return def;
  const v = parseFloat(s);
  return isFinite(v) ? v : def;
}

export function parseNumberOr(value: unknown, def: number): number {
  return parseNumber(value, def) as number;
}

export function parseIntOr(value: unknown, def = 0): number {
  const v = parseNumber(value, null);
  return v === null ? def : Math.round(v);
}

/** پارس تاریخ شمسی از هر قالبی: ۱۴۰۵/۰۷/۰۱ یا 1405-7-1 → (y,m,d) یا null */
export function parseJalaliDateStr(value: unknown): [number, number, number] | null {
  if (value === null || value === undefined) return null;
  const s = normalizeDigits(value).trim().replace(/-/g, '/').replace(/\./g, '/');
  const m = s.match(/(\d{3,4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  if (!(y >= 1000 && y <= 1500 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  return [y, mo, d];
}

/** پارس زمان دستگاه به دقیقه: '216:02' → 12962 ، '8.5' → 510 ، '*' ابتدای برخی مقادیر نادیده */
export function parseHHMM(value: unknown, def = 0): number {
  if (value === null || value === undefined) return def;
  if (typeof value === 'number') return Math.round(value);
  const s = normalizeDigits(value).trim().replace(/^\*+/, '').trim();
  if (!s) return def;
  const m = s.match(/^(\d{1,6}):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const v = parseNumber(s, null);
  if (v === null) return def;
  return Math.round(v * 60);
}

/** دقیقه → فرمت استاندارد H:MM */
export function minutesToHHMM(minutes: number | null | undefined): string {
  let m = minutes ?? 0;
  const sign = m < 0 ? '-' : '';
  m = Math.abs(Math.round(m));
  return `${sign}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** قالب‌بندی مبلغ با جداکننده هزارگان فارسی «٬» */
export function formatMoney(value: unknown, persian = true): string {
  let v = 0;
  const n = typeof value === 'number' ? value : parseFloat(normalizeDigits(value ?? 0));
  if (isFinite(n)) v = n;
  const neg = v < 0;
  v = Math.abs(v);
  const s = (v === Math.floor(v)
    ? Math.floor(v).toLocaleString('en-US')
    : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  ).replace(/,/g, '٬');
  return toPersianDigits(neg ? '-' + s : s);
}

export function formatPercent(value: unknown, persian = true): string {
  const v = parseNumberOr(value, 0);
  const s = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return persian ? toPersianDigits(s) + '٪' : s + '%';
}

/** پاکسازی متن برای جستجو: نیم‌فاصله → فاصله، فاصله‌های اضافی حذف */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
}
