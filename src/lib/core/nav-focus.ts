// فوکوس ناوبری بین ماژول‌ها — سینگلتون ماژول‌اسکوپ (بدون وابستگی به app-state)
// کاربرد: از لیست پرسنل روی «قرارداد/احکام» کلیک می‌شود، قرارداد ماژول در mount مصرف می‌کند.
export type FocusModule = 'contracts' | 'decrees' | 'settlement';

export interface NavFocus {
  module: FocusModule;
  personnelId: number | null;
  ts: number;
}

let focus: NavFocus | null = null;

export function setFocusPersonnel(module: FocusModule, personnelId: number | null = null) {
  focus = { module, personnelId, ts: Date.now() };
}

/** خواندن بدون مصرف */
export function getFocusPersonnel(): NavFocus | null {
  return focus;
}

/** خواندن و پاک‌کردن (consume on mount) */
export function consumeFocusPersonnel(): NavFocus | null {
  const f = focus;
  focus = null;
  return f;
}

const NAV_TITLE: Record<string, string> = {
  dashboard: 'داشبورد',
  personnel: 'پرسنل',
  contracts: 'قرارداد و احکام',
  shifts: 'شیفت‌های کاری',
  attendance: 'حضور و غیاب',
  payroll: 'محاسبه و فیش',
  'std-exports': 'خروجی‌های استاندارد',
  reports: 'گزارش‌ساز',
  settlement: 'تسویه حساب',
  calendar: 'تقویم و تعطیلات',
  companies: 'شرکت و سال مالی',
  settings: 'تنظیمات',
};

/**
 * جابجایی به ماژول دیگر — دکمه ناوبری سایدبار (app-shell) شبیه‌سازی کلیک می‌شود
 * چون app-state.tsx در مالکیت عامل دیگری است و قابل تغییر نیست.
 */
export function navigateTo(moduleKey: string): boolean {
  const title = NAV_TITLE[moduleKey];
  if (!title) return false;
  try {
    const btn = document.querySelector<HTMLButtonElement>(`aside button[title="${title}"]`);
    if (btn) { btn.click(); return true; }
  } catch { /* ignore */ }
  return false;
}
