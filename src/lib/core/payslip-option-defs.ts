// تعریف اقلام تکمیلی فیش — مشترک بین سرور و کلاینت (بدون وابستگی دیتابیس)
export const PAYSLIP_OPTION_DEFS: Array<{ key: string; label: string }> = [
  { key: 'month_days', label: 'تعداد روزهای ماه' },
  { key: 'worked_days', label: 'روزهای کارکرد' },
  { key: 'ot_rate', label: 'مبلغ هر ساعت اضافه‌کاری' },
  { key: 'friday_amount', label: 'مبلغ جمعه‌کاری' },
  { key: 'leave_days', label: 'مرخصی رفته (روز)' },
  { key: 'late_min', label: 'کسر کار تأخیر (دقیقه)' },
  { key: 'early_min', label: 'کسر کار تعجیل (دقیقه)' },
  { key: 'ot_hours', label: 'ساعات اضافه‌کاری' },
  { key: 'night_shifts', label: 'تعداد شیفت شب' },
  { key: 'regular_shifts', label: 'تعداد شیفت عادی (تمام‌روز)' },
  { key: 'morning_evening_shifts', label: 'تعداد شیفت صبح / عصر' },
  { key: 'holiday_work_count', label: 'تعداد تعطیل‌کاری' },
  { key: 'holiday_work_amount', label: 'مبلغ تعطیل‌کاری' },
  { key: 'ytd_bonus', label: 'پاداش/اضافه‌پرداختی از ابتدای سال' },
  { key: 'ytd_penalty', label: 'جریمه/خسارت از ابتدای سال' },
  { key: 'ytd_insured_days', label: 'روزهای بیمه‌شده از ابتدای سال' },
  { key: 'seniority_accum', label: 'سنوات انباشته تا پایان ماه قبل' },
  { key: 'eidi_ytd', label: 'عیدی/پاداش سال تا پایان ماه قبل' },
];

export function defaultPayslipOptions(): Record<string, boolean> {
  return Object.fromEntries(PAYSLIP_OPTION_DEFS.map((o) => [o.key, true]));
}
