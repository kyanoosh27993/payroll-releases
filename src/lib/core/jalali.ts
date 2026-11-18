// موتور تقویم هجری شمسی تا سال ۱۵۰۰ — مبتنی بر jalaali-js (الگوریتم دقیق گاه‌شماری جلالی)
import * as J from 'jalaali-js';
import { toPersianDigits } from './numbers';

export const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export const WEEKDAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export interface JDate { jy: number; jm: number; jd: number }

export function toJalaali(gy: number, gm: number, gd: number): JDate {
  const r = J.toJalaali(gy, gm, gd);
  return { jy: r.jy, jm: r.jm, jd: r.jd };
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return J.toGregorian(jy, jm, jd);
}

export function daysInMonth(jy: number, jm: number): number {
  return J.jalaaliMonthLength(jy, jm);
}

export function isLeap(jy: number): boolean {
  return J.isLeapJalaaliYear(jy);
}

/** روز هفته: شنبه=0 ... جمعه=6 */
export function weekday(jy: number, jm: number, jd: number): number {
  const g = J.toGregorian(jy, jm, jd);
  const d = new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
  // JS: یکشنبه=0 ... شنبه=6 → شنبه=0
  return (d.getUTCDay() + 1) % 7;
}

export function weekdayName(jy: number, jm: number, jd: number): string {
  return WEEKDAY_NAMES[weekday(jy, jm, jd)];
}

/** تاریخ امروز به شمسی (زبان سرور: Asia/Tehran) */
export function todayJalali(): JDate {
  const now = new Date(Date.now() + 3.5 * 3600 * 1000); // UTC+3:30
  const g = { gy: now.getUTCFullYear(), gm: now.getUTCMonth() + 1, gd: now.getUTCDate() };
  return toJalaali(g.gy, g.gm, g.gd);
}

export function formatJalali(jy: number, jm: number, jd: number, persian = true): string {
  const s = `${String(jy).padStart(4, '0')}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
  return persian ? toPersianDigits(s) : s;
}

export function monthDaysList(jy: number, jm: number): Array<JDate & { weekday: number; weekdayName: string }> {
  const out: Array<JDate & { weekday: number; weekdayName: string }> = [];
  for (let d = 1; d <= daysInMonth(jy, jm); d++) {
    out.push({ jy, jm, jd: d, weekday: weekday(jy, jm, d), weekdayName: WEEKDAY_NAMES[weekday(jy, jm, d)] });
  }
  return out;
}

/** فهرست تاریخ‌های شمسی بین دو تاریخ (شامل دو سر) */
export function dateRangeJalali(y1: number, m1: number, d1: number, y2: number, m2: number, d2: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  let cur = J.toGregorian(y1, m1, d1);
  const endG = J.toGregorian(y2, m2, d2);
  let t = Date.UTC(cur.gy, cur.gm - 1, cur.gd);
  const end = Date.UTC(endG.gy, endG.gm - 1, endG.gd);
  while (t <= end) {
    const dt = new Date(t);
    const j = J.toJalaali(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    out.push([j.jy, j.jm, j.jd]);
    t += 86400000;
  }
  return out;
}

export function gregorianToJalaliStr(iso: string | Date): string {
  const dt = typeof iso === 'string' ? new Date(iso) : iso;
  const j = J.toJalaali(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// تعطیلات قمری تا سال ۱۵۰۰ — تقویم محاسباتی civil (تقریبی ±۱ روز، قابل اصلاح دستی)
// ---------------------------------------------------------------------------
export function hijriToJd(hy: number, hm: number, hd: number): number {
  return Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2)
    + hd + 1948440 - 385;
}

export function jdToGregorian(jd: number): { gy: number; gm: number; gd: number } {
  let a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { gy: year, gm: month, gd: day };
}

/** هجری قمری → شمسی (تقریبی) */
export function hijriToJalali(hy: number, hm: number, hd: number, delta = 0): [number, number, number] | null {
  try {
    const g = jdToGregorian(hijriToJd(hy, hm, hd) + delta);
    const j = J.toJalaali(g.gy, g.gm, g.gd);
    return [j.jy, j.jm, j.jd];
  } catch {
    return null;
  }
}

export { J as jalaali };
