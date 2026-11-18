// سرویس تقویم: تعطیلات رسمی تا سال ۱۵۰۰ + پرس‌وجوی تعطیل بودن روز (سرور)
import { db } from '@/lib/db';
import * as JJ from './jalali';

// تعطیلات دقیق ۱۴۰۴ و ۱۴۰۵ (تقویم رسمی)
export const DEFAULT_CALENDAR_EVENTS: Array<[number, number, number, 'holiday' | 'occasion', string]> = [
  // ۱۴۰۴
  [1404, 1, 1, 'holiday', 'عید نوروز'],
  [1404, 1, 2, 'holiday', 'عید نوروز / شهادت حضرت علی (ع)'],
  [1404, 1, 3, 'holiday', 'عید نوروز'],
  [1404, 1, 4, 'holiday', 'عید نوروز'],
  [1404, 1, 11, 'holiday', 'عید سعید فطر'],
  [1404, 1, 12, 'holiday', 'عید سعید فطر / روز جمهوری اسلامی'],
  [1404, 1, 13, 'holiday', 'روز طبیعت (سیزده‌بدر)'],
  [1404, 2, 4, 'holiday', 'شهادت امام جعفر صادق (ع)'],
  [1404, 2, 11, 'holiday', 'روز جهانی کارگر'],
  [1404, 3, 14, 'holiday', 'رحلت امام خمینی (ره)'],
  [1404, 3, 15, 'holiday', 'قیام ۱۵ خرداد'],
  [1404, 3, 16, 'holiday', 'عید سعید قربان'],
  [1404, 3, 24, 'holiday', 'عید سعید غدیر خم'],
  [1404, 4, 14, 'holiday', 'تاسوعای حسینی'],
  [1404, 4, 15, 'holiday', 'عاشورای حسینی'],
  [1404, 5, 23, 'holiday', 'اربعین حسینی'],
  [1404, 5, 31, 'holiday', 'رحلت رسول اکرم (ص) / شهادت امام حسن مجتبی (ع)'],
  [1404, 6, 2, 'holiday', 'شهادت امام رضا (ع)'],
  [1404, 6, 10, 'holiday', 'شهادت امام حسن عسکری (ع)'],
  [1404, 6, 19, 'holiday', 'میلاد رسول اکرم (ص) و امام صادق (ع)'],
  [1404, 9, 3, 'holiday', 'شهادت حضرت فاطمه زهرا (س)'],
  [1404, 10, 13, 'holiday', 'ولادت امام علی (ع) / روز پدر'],
  [1404, 10, 27, 'holiday', 'مبعث رسول اکرم (ص)'],
  [1404, 11, 15, 'holiday', 'ولادت حضرت قائم (ع) / نیمه شعبان'],
  [1404, 11, 22, 'holiday', 'پیروزی انقلاب اسلامی'],
  [1404, 12, 20, 'holiday', 'شهادت حضرت علی (ع)'],
  [1404, 12, 29, 'holiday', 'روز ملی شدن صنعت نفت'],
  [1404, 2, 1, 'occasion', 'روز بزرگداشت سعدی'],
  [1404, 2, 10, 'occasion', 'روز ملی خلیج فارس'],
  [1404, 2, 12, 'occasion', 'روز معلم'],
  [1404, 2, 25, 'occasion', 'روز بزرگداشت فردوسی'],
  [1404, 7, 13, 'occasion', 'روز نیروی انتظامی'],
  [1404, 8, 13, 'occasion', 'روز دانش‌آموز'],
  [1404, 8, 24, 'occasion', 'روز کتاب و کتابخوانی'],
  [1404, 11, 19, 'occasion', 'روز نیروی هوایی'],
  // ۱۴۰۵
  [1405, 1, 1, 'holiday', 'عید نوروز'],
  [1405, 1, 2, 'holiday', 'عید نوروز'],
  [1405, 1, 3, 'holiday', 'عید نوروز'],
  [1405, 1, 4, 'holiday', 'عید نوروز'],
  [1405, 1, 12, 'holiday', 'روز جمهوری اسلامی'],
  [1405, 1, 13, 'holiday', 'روز طبیعت (سیزده‌بدر)'],
  [1405, 1, 28, 'holiday', 'عید سعید فطر'],
  [1405, 1, 29, 'holiday', 'عید سعید فطر (دوم)'],
  [1405, 2, 11, 'holiday', 'روز جهانی کارگر'],
  [1405, 3, 14, 'holiday', 'رحلت امام خمینی (ره)'],
  [1405, 3, 15, 'holiday', 'قیام ۱۵ خرداد'],
  [1405, 3, 17, 'holiday', 'عید سعید قربان'],
  [1405, 3, 25, 'holiday', 'عید سعید غدیر خم'],
  [1405, 5, 7, 'holiday', 'تاسوعای حسینی'],
  [1405, 5, 8, 'holiday', 'عاشورای حسینی'],
  [1405, 6, 30, 'holiday', 'اربعین حسینی'],
  [1405, 7, 13, 'holiday', 'رحلت رسول اکرم (ص)'],
  [1405, 7, 14, 'holiday', 'شهادت امام حسن مجتبی (ع)'],
  [1405, 7, 15, 'holiday', 'شهادت امام رضا (ع)'],
  [1405, 8, 13, 'holiday', 'روز دانش‌آموز / تسخیر لانه جاسوسی'],
  [1405, 8, 14, 'holiday', 'میلاد رسول اکرم (ص) و امام صادق (ع)'],
  [1405, 10, 27, 'holiday', 'ولادت حضرت فاطمه زهرا (س) / روز زن'],
  [1405, 11, 22, 'holiday', 'پیروزی انقلاب اسلامی'],
  [1405, 12, 29, 'holiday', 'روز ملی شدن صنعت نفت'],
  [1405, 2, 12, 'occasion', 'روز معلم'],
  [1405, 2, 10, 'occasion', 'روز ملی خلیج فارس'],
  [1405, 2, 25, 'occasion', 'روز بزرگداشت فردوسی'],
  [1405, 7, 13, 'occasion', 'روز نیروی انتظامی'],
  [1405, 8, 24, 'occasion', 'روز کتاب و کتابخوانی'],
  [1405, 12, 5, 'occasion', 'روز مهندسی'],
];

// ثابت شمسی همه سال‌ها (۱۴۰۶ تا ۱۵۰۰)
export const FIXED_SOLAR_HOLIDAYS: Array<[number, number, string]> = [
  [1, 1, 'عید نوروز'], [1, 2, 'عید نوروز'], [1, 3, 'عید نوروز'], [1, 4, 'عید نوروز'],
  [1, 12, 'روز جمهوری اسلامی'], [1, 13, 'روز طبیعت (سیزده‌بدر)'],
  [2, 11, 'روز جهانی کارگر'],
  [3, 14, 'رحلت امام خمینی (ره)'], [3, 15, 'قیام ۱۵ خرداد'],
  [11, 22, 'پیروزی انقلاب اسلامی'],
  [12, 29, 'روز ملی شدن صنعت نفت'],
];

// تعطیلات قمری رسمی: (ماه هجری، روز، عنوان)
export const LUNAR_HOLIDAYS: Array<[number, number, string]> = [
  [1, 9, 'تاسوعای حسینی'],
  [1, 10, 'عاشورای حسینی'],
  [2, 20, 'اربعین حسینی'],
  [2, 28, 'رحلت رسول اکرم (ص) / شهادت امام حسن مجتبی (ع)'],
  [2, 30, 'شهادت امام رضا (ع)'],
  [3, 8, 'شهادت امام حسن عسکری (ع)'],
  [3, 17, 'میلاد رسول اکرم (ص) و امام جعفر صادق (ع)'],
  [5, 3, 'شهادت حضرت فاطمه زهرا (س)'],
  [6, 20, 'ولادت حضرت فاطمه زهرا (س) / روز زن'],
  [7, 13, 'ولادت امام علی (ع) / روز پدر'],
  [7, 27, 'مبعث رسول اکرم (ص)'],
  [9, 21, 'شهادت حضرت علی (ع)'],
  [10, 1, 'عید سعید فطر'],
  [10, 2, 'عید سعید فطر (دوم)'],
  [12, 10, 'عید سعید قربان'],
  [12, 18, 'عید سعید غدیر خم'],
];

const ensuredYears = new Set<number>();

export async function seedDefaults() {
  const c = await db.calendarEvent.count();
  if (c > 0) return;
  await db.calendarEvent.createMany({
    data: DEFAULT_CALENDAR_EVENTS.map(([jy, jm, jd, kind, title]) => ({
      jy, jm, jd, kind, title, source: 'پیش‌فرض تقویم رسمی',
    })),
  });
}

/** تولید تعطیلات سال‌های خارج از ۱۴۰۴/۱۴۰۵ (قمری تقریبی + ثابت شمسی) — یک بار برای هر سال */
export async function ensureYear(jy: number) {
  if (jy === 1404 || jy === 1405 || ensuredYears.has(jy)) return;
  const c = await db.calendarEvent.count({
    where: { jy, source: 'پیش‌فرض تقویم رسمی' },
  });
  if (c > 0) { ensuredYears.add(jy); return; }
  const rows: Array<{ jy: number; jm: number; jd: number; kind: string; title: string; source: string }> = [];
  for (const [jm, jd, title] of FIXED_SOLAR_HOLIDAYS) {
    rows.push({ jy, jm, jd, kind: 'holiday', title, source: 'پیش‌فرض تقویم رسمی' });
  }
  for (const [hm, hd, title] of LUNAR_HOLIDAYS) {
    // به‌دلیل رانش تقویم قمری، سال هجری متناظر جستجو می‌شود
    for (let hy = jy + 40; hy < jy + 49; hy++) {
      const j = JJ.hijriToJalali(hy, hm, hd);
      if (j && j[0] === jy) {
        rows.push({ jy, jm: j[1], jd: j[2], kind: 'holiday', title, source: 'محاسباتی (تقریبی — با تقویم رسمی اصلاح کنید)' });
        break;
      }
    }
  }
  if (rows.length) await db.calendarEvent.createMany({ data: rows });
  ensuredYears.add(jy);
}

/** آیا این روز تعطیل رسمی است؟ (جمعه همیشه تعطیل) */
export async function isHoliday(jy: number, jm: number, jd: number): Promise<boolean> {
  await ensureYear(jy);
  const e = await db.calendarEvent.findFirst({
    where: { jy, jm, jd, kind: 'holiday' }, select: { id: true },
  });
  if (e) return true;
  return JJ.weekday(jy, jm, jd) === 6;
}

/** کلید کش سمت سرور برای یک ماه */
export async function holidaySetOfMonth(jy: number, jm: number): Promise<Set<number>> {
  await ensureYear(jy);
  const events = await db.calendarEvent.findMany({
    where: { jy, jm, kind: 'holiday' }, select: { jd: true },
  });
  const s = new Set<number>(events.map((e) => e.jd));
  for (let d = 1; d <= JJ.daysInMonth(jy, jm); d++) {
    if (JJ.weekday(jy, jm, d) === 6) s.add(d);
  }
  return s;
}
