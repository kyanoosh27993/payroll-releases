// نسخه ۱.۴.۳ — ابزار تاریخ انقضای اکانت کاربران
// تاریخ انقضا شمسی از کاربر گرفته می‌شود («۱۴۰۶/۰۱/۰۱») و در دیتابیس به‌صورت
// میلادی (پایان همان روز) ذخیره می‌شود؛ یعنی کاربر در روز انقضا هنوز می‌تواند کار کند
// و از روز بعد ورود برای او مسدود است.
import { toGregorian, toJalaali, formatJalali } from './jalali';

/** تبدیل رشته تاریخ شمسی «yyyy/mm/dd» یا «yyyy-mm-dd» به پایان همان روز میلادی — ورودی نامعتبر → null */
export function parseJalaliExpiry(input: unknown): Date | null {
  if (input === undefined || input === null) return null;
  const s = String(input).trim();
  if (!s) return null; // رشته خالی = حذف تاریخ انقضا (بدون محدودیت)
  const m = s.match(/(\d{3,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (jy < 1300 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd, 23, 59, 59, 999);
}

/** نمایش تاریخ انقضای ذخیره‌شده به‌صورت شمسی خوانا — خالی → رشته خالی */
export function isoToJalaliStr(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return formatJalali(jy, jm, jd, false); // با ارقام لاتین برای نمایش یکنواخت در جدول
}

/** تعداد روز باقی‌مانده تا انقضا — بدون تاریخ انقضا → null؛ منقضی → عدد صفر یا منفی */
export function daysUntilExpiry(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400_000);
}
