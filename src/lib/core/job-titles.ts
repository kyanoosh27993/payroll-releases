// عناوین شغلی تامین اجتماعی — کد شغل بیمه (جدول کد شغل تامین اجتماعی)
// فهرست مشترک: سرچ‌شونده در فرم پرسنل — hint همان کد شغل بیمه است
export interface JobTitle {
  title: string;
  code: number;
}

export const JOB_TITLES: JobTitle[] = [
  { title: 'مدیر عامل', code: 1213 },
  { title: 'مدیر هتل', code: 1221 },
  { title: 'مدیر فروش', code: 1225 },
  { title: 'مدیر منابع انسانی', code: 1231 },
  { title: 'مدیر مالی و حسابداری', code: 1235 },
  { title: 'حسابدار', code: 3411 },
  { title: 'حسابدار ارشد / رئیس حسابداری', code: 3412 },
  { title: 'کارشناس منابع انسانی', code: 3421 },
  { title: 'کارشناس حقوق و دستمزد', code: 3422 },
  { title: 'مترجم / کارشناس پیاده‌سازی نرم‌افزار', code: 3441 },
  { title: 'ناظر پذیرش (سرپرست پذیرش)', code: 3415 },
  { title: 'پذیرشگر هتل (رسپشن)', code: 5111 },
  { title: 'متصدی رزرواسیون', code: 5112 },
  { title: 'مهماندار (کانسیِرژ)', code: 5113 },
  { title: 'سرپرست خانه‌داری (هاوس‌کیپینگ)', code: 5121 },
  { title: 'اتاق‌دار (نظافت اتاق هتل)', code: 5122 },
  { title: 'لباس‌شوی و اتوکش (لاندری)', code: 5123 },
  { title: 'سرآشپز', code: 5131 },
  { title: 'آشپز', code: 5132 },
  { title: 'کمک‌آشپز', code: 5133 },
  { title: 'قناد / شیرینی‌پز', code: 5134 },
  { title: 'پیش‌خدمت (گارسون رستوران)', code: 5141 },
  { title: 'متصدی بار (باریستا)', code: 5142 },
  { title: 'نگهبان و متصدی حراست', code: 6111 },
  { title: 'متصدی تعمیرات و تأسیسات', code: 7111 },
  { title: 'برقکار / تاسیسات مکانیکی', code: 7112 },
  { title: 'راننده (سرویس خودرو)', code: 8111 },
  { title: 'کارگر ساده / خدمتکار عمومی', code: 9111 },
  { title: 'انباردار', code: 4131 },
  { title: 'متصدی خرید و تدارکات', code: 4132 },
  { title: 'کارشناس فروش و بازاریابی', code: 3416 },
  { title: 'کارمند اداری / منشی', code: 4111 },
  { title: 'تلفن‌بان (اپراتور تلفن هتل)', code: 4112 },
];

/** یافتن کد شغل بیمه بر اساس عنوان شغل */
export function jobCodeByTitle(title: string): number | null {
  const t = (title || '').trim();
  if (!t) return null;
  return JOB_TITLES.find((j) => j.title === t)?.code ?? null;
}

/** کد شغل بیمه به‌صورت رشته — برای درج در قرارداد/فرم‌ها */
export function insuranceCodeFor(title: string): string {
  const c = jobCodeByTitle(title);
  return c == null ? '' : String(c);
}

// مراکز هزینه هتل
export const HOTEL_COST_CENTERS: string[] = [
  'پذیرش', 'خانه‌داری (هاوس‌کیپینگ)', 'رستوران', 'آشپزخانه',
  'نگهبانی', 'حسابداری', 'فروشگاه', 'تاسیسات',
];

// گروه‌های فیش حقوقی هتل
export const HOTEL_PAYSLIP_GROUPS: string[] = [
  'گروه پذیرش', 'گروه خانه‌داری', 'گروه اداری',
];
