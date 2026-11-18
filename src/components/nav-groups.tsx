// فهرست گروه‌بندی ماژول‌ها — مشترک بین سایدبار و منوی آبشاری سرصفحه (مورد ۱۶)
// نکته: برای جلوگیری از وابستگی حلقوی، نوع کلید ماژول‌ها string است و آیکن‌ها همین‌جا ساخته می‌شوند
import React from 'react';
import {
  LayoutDashboard, Users, FileSignature, Clock, CalendarRange,
  Calculator, FileOutput, BarChart3, FileCheck,
  CalendarDays, Building2, Settings, DatabaseBackup, Printer,
  ScrollText, ShieldCheck, HelpCircle,
} from 'lucide-react';

export interface NavItem {
  key: string;
  title: string;
  icon: React.ReactNode;
  /** فقط این نقش‌ها می‌بینند؛ undefined = همه */
  rolesOnly?: ('admin' | 'supervisor')[];
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'عملیات اصلی',
    items: [
      { key: 'dashboard', title: 'داشبورد', icon: <LayoutDashboard size={18} /> },
      { key: 'personnel', title: 'پرسنل', icon: <Users size={18} /> },
      { key: 'contracts', title: 'قرارداد و احکام', icon: <FileSignature size={18} /> },
      { key: 'shifts', title: 'شیفت‌های کاری', icon: <Clock size={18} /> },
      { key: 'attendance', title: 'حضور و غیاب', icon: <CalendarRange size={18} /> },
    ],
  },
  {
    label: 'حقوق و دستمزد',
    items: [
      { key: 'payroll', title: 'محاسبه و فیش', icon: <Calculator size={18} /> },
      { key: 'std-exports', title: 'خروجی‌های استاندارد', icon: <FileOutput size={18} /> },
      { key: 'reports', title: 'گزارش‌ساز', icon: <BarChart3 size={18} /> },
      { key: 'settlement', title: 'تسویه حساب', icon: <FileCheck size={18} /> },
    ],
  },
  {
    label: 'سیستم',
    items: [
      { key: 'calendar', title: 'تقویم و تعطیلات', icon: <CalendarDays size={18} /> },
      { key: 'companies', title: 'شرکت و سال مالی', icon: <Building2 size={18} /> },
      { key: 'settings', title: 'تنظیمات', icon: <Settings size={18} /> },
      { key: 'database', title: 'مدیریت دیتابیس', icon: <DatabaseBackup size={18} /> },
      { key: 'print-forms', title: 'پرینت فرم‌های ضروری', icon: <Printer size={18} /> },
      { key: 'audit', title: 'گزارش تغییرات (لاگ)', icon: <ScrollText size={18} />, rolesOnly: ['admin', 'supervisor'] },
      { key: 'users', title: 'مدیریت کاربران', icon: <ShieldCheck size={18} />, rolesOnly: ['admin', 'supervisor'] },
      { key: 'help', title: 'راهنما (F1)', icon: <HelpCircle size={18} /> },
    ],
  },
];

/** پرش به ماژول از هر جای برنامه — یک رویداد سراسری که app-shell گوش می‌دهد */
export function navigateToModule(key: string) {
  window.dispatchEvent(new CustomEvent('app-navigate', { detail: key }));
}

/** گوش‌دادن به رویداد پرش — app-shell در useEffect از این استفاده می‌کند؛ تابع unlisten برمی‌گرداند */
export function navigateListener(handler: (key: string) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener('app-navigate', fn);
  return () => window.removeEventListener('app-navigate', fn);
}

/** ماژول فعال فعلی — app-shell هنگام تغییر ماژول این مقدار را به‌روز می‌کند */
export function currentActiveModule(): string {
  return (window as unknown as { __payrollActiveModule?: string }).__payrollActiveModule ?? 'dashboard';
}
