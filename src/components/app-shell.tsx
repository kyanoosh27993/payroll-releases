'use client';
// پوسته اصلی برنامه — سایدبار زغالی لوکس، تاپ‌بار شرکت/سال مالی، دستیار هوشمند شناور
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AppStateProvider, useApp } from '@/components/app-state';
import { ModuleView, type ModuleKey } from '@/components/modules/registry';
import SmartAssistant from '@/components/ai/smart-assistant';
import {
  LayoutDashboard, Users, FileSignature, Clock, CalendarRange, Calculator,
  FileOutput, BarChart3, CalendarDays, Building2, Settings, HelpCircle,
  ChevronLeft, Sparkles, Moon, Sun, RefreshCw, ShieldCheck, ScrollText, LogOut,
  Printer, FileCheck, CalendarClock,
} from 'lucide-react';
import { LoginScreen, MustChangePassword } from '@/components/login-screen';
import ModuleErrorBoundary from '@/components/module-error-boundary';
import BirthdayReminder from '@/components/modules/birthday-reminder';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toPersianDigits } from '@/lib/core/numbers';
import { DatabaseBackup } from 'lucide-react';
import { usePayrollTheme } from '@/components/theme/payroll-theme';
import { NAV_GROUPS, navigateListener } from '@/components/nav-groups';

// فهرست ماژول‌ها در nav-groups.tsx مشترک است (سایدبار + منوی آبشاری سرصفحه)
const NAV = NAV_GROUPS as Array<{ label: string; items: Array<{ key: ModuleKey; title: string; icon: React.ReactNode; rolesOnly?: string[] }> }>;

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

function TopBar() {
  const { company, setCompany, companies, fy, setFy, fiscalYears, version, refreshContext, user, logout } = useApp();
  const theme = usePayrollTheme();
  // دکمه تیره/روشن — بین تم‌های آماده تیره و روشن جابجا می‌شود
  // (کلاس CSS «dark» چون تم پویا متغیرها را مستقیم روی html تنظیم می‌کند اثری نداشت)
  const currentPreset = theme.presets.find((p) => p.id === theme.config.preset);
  const isDark = currentPreset?.mode !== 'light';
  const toggleDark = () => {
    const cur = currentPreset;
    if (!cur) return;
    const other: 'dark' | 'light' = cur.mode === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(`pt-last-${cur.mode}`, cur.id); } catch { /* ignore */ }
    let nextId: string | null = null;
    try { nextId = localStorage.getItem(`pt-last-${other}`); } catch { /* ignore */ }
    const np = (nextId && theme.presets.find((p) => p.id === nextId && p.mode === other))
      || theme.presets.find((p) => p.mode === other)
      || cur;
    theme.update({ preset: np.id, accent: np.colors.primary, accent2: np.colors.accent2 });
  };
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-card/80 px-5 backdrop-blur-md no-print">
      <div className="flex items-center gap-2 min-w-0">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={company ? String(company.id) : ''} onValueChange={(v) => setCompany(companies.find((c) => c.id === Number(v)) ?? null)}>
          <SelectTrigger className="w-[220px] h-9 border-none bg-muted/60 shadow-none font-semibold">
            <SelectValue placeholder="شرکت" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <Select value={fy ? String(fy.id) : ''} onValueChange={(v) => setFy(fiscalYears.find((f) => f.id === Number(v)) ?? null)}>
          <SelectTrigger className="w-[150px] h-9 border-none bg-muted/60 shadow-none">
            <SelectValue placeholder="سال مالی" />
          </SelectTrigger>
          <SelectContent>
            {fiscalYears.filter((f) => f.companyId === company?.id).map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>{toPersianDigits(f.jy)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mr-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refreshContext()} title="به‌روزرسانی">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleDark} title={isDark ? 'حالت روشن' : 'حالت تیره'}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
          نسخه {toPersianDigits(version)}
        </span>
        {user && (
          <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 py-1">
            <span className="text-[12px] font-semibold">{user.fullName || user.username}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {user.isSupervisor ? 'سوپروایزر' : user.role === 'admin' ? 'مدیر' : user.role === 'operator' ? 'اپراتور' : 'بازدیدکننده'}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => logout()} title="خروج از حساب">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

// نسخه ۱.۴.۴ — پیغام اعتبار اکانت: از ۷ روز مانده به انقضا، در هر ورود (هر روز) به همان کاربر
// نمایش داده می‌شود تا کارهای لازم جهت تمدید اعتبار انجام شود؛ فقط نمایش است و دسترسی تغییری نمی‌کند
function ExpiryWarning() {
  const { user } = useApp();
  if (!user?.expiresAt) return null;
  const ms = new Date(user.expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86400_000);
  if (days > 7) return null;
  return (
    <div
      data-slot="expiry-warning"
      className={cn(
        'mx-6 mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold no-print',
        days <= 0
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-700',
      )}
    >
      <CalendarClock size={16} className="shrink-0" />
      {days <= 0
        ? 'اعتبار حساب شما به پایان رسیده است — برای تمدید اعتبار با مدیر یا سوپروایزر سیستم تماس بگیرید.'
        : `اعتبار حساب شما تا ${toPersianDigits(String(days))} روز دیگر به پایان می‌رسد — برای تمدید اعتبار با مدیر یا سوپروایزر سیستم تماس بگیرید.`}
    </div>
  );
}

// ماژول‌های سیستمی که بدون انتخاب شرکت هم باید باز شوند
const SYSTEM_MODULES: ModuleKey[] = ['companies', 'settings', 'help', 'users', 'audit', 'print-forms', 'database'];

function ShellInner() {
  const { ready, company, user } = useApp();
  const [active, setActive] = useState<ModuleKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false); // مورد ۱۶: با ورود موس به نوار، اتومات باز شود

  const [aiOpen, setAiOpen] = useState(false);

  // مورد ۱۶ (۱.۴.۴) — پرش از منوی آبشاری سرصفحه: رویداد سراسری app-navigate
  useEffect(() => navigateListener((key) => setActive(key as ModuleKey)), []);

  // ماژول فعال برای ModuleQuickNav — چون state داخلی است، سراسری نگه داشته می‌شود
  useEffect(() => {
    (window as unknown as { __payrollActiveModule?: string }).__payrollActiveModule = active;
  }, [active]);

  // میانبر F1 → راهنما
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActive('help');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return <LoginScreen />;
  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* سایدبار — با ورود موس اتومات باز می‌شود و با خروج موس جمع می‌شود (مورد ۱۶ نسخه ۱٫۴٫۴) */}
      <aside
        onMouseEnter={() => { if (collapsed) setHoverOpen(true); }}
        onMouseLeave={() => setHoverOpen(false)}
        className={cn(
          'fixed inset-y-0 right-0 z-40 flex flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 no-print',
          collapsed && !hoverOpen ? 'w-[76px]' : 'w-64',
        )}
      >
        {/* برند */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-sidebar-foreground truncate">سامانه جامع حقوق</p>
              <p className="text-[11px] text-sidebar-foreground/70">حضور و غیاب و دستمزد</p>
            </div>
          )}
        </div>

        {/* ناوبری */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {NAV.map((g) => (
            <div key={g.label}>
              {!collapsed && (
                <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-wide text-sidebar-foreground/45">
                  {g.label}
                </p>
              )}
              <div className="space-y-0.5">
                {g.items.filter((it) => {
                  if (it.key === 'users' || it.key === 'audit') {
                    return user.role === 'admin' || user.isSupervisor;
                  }
                  return true;
                }).map((it) => (
                  <button
                    key={it.key}
                    onClick={() => setActive(it.key)}
                    title={it.title}
                    className={cn(
                      'group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all',
                      active === it.key
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    {active === it.key && (
                      <span className="absolute inset-y-1.5 -right-2.5 w-1 rounded-full bg-sidebar-primary" />
                    )}
                    <span className={cn(active === it.key ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground')}>
                      {it.icon}
                    </span>
                    {!collapsed && <span className="truncate">{it.title}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* دستیار + جمع‌شدن */}
        <div className="border-t border-sidebar-border p-2.5 space-y-1.5">
          <button
            onClick={() => setAiOpen(true)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors',
              collapsed && 'justify-center px-0',
            )}
          >
            <Sparkles size={18} />
            {!collapsed && <span>دستیار هوشمند آفلاین</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60',
              collapsed && 'justify-center px-0',
            )}
          >
            <ChevronLeft size={15} className={cn('transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>جمع کردن منو</span>}
          </button>
        </div>
      </aside>

      {/* محتوای اصلی */}
      <div className={cn('flex min-h-screen flex-1 flex-col transition-[padding] duration-300', collapsed && !hoverOpen ? 'pr-[76px]' : 'pr-64')}>
        <TopBar />
        <ExpiryWarning />
        <main className="flex-1 px-6 py-6">
          {!ready ? (
            <div className="flex h-[60vh] items-center justify-center text-muted-foreground">در حال بارگذاری…</div>
          ) : !company && !SYSTEM_MODULES.includes(active) ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-lg font-bold">خوش آمدید</p>
              <p className="mt-1 text-sm text-muted-foreground">
                برای شروع، از بخش «شرکت و سال مالی» شرکت خود را ثبت کنید.
              </p>
              <Button className="mt-4 gap-2" onClick={() => setActive('companies')}>
                <Building2 size={16} />
                رفتن به ثبت شرکت و سال مالی
              </Button>
            </div>
          ) : (
            <ModuleErrorBoundary key={active}>
              <ModuleView moduleKey={active} />
            </ModuleErrorBoundary>
          )}
        </main>
        <footer className="mt-auto border-t border-border/70 py-3.5 text-center text-[11.5px] text-muted-foreground no-print">
          سامانه جامع حقوق و دستمزد و حضور و غیاب — نسخه {toPersianDigits('1.4.7')} — اجرای کاملا محلی، داده‌ها روی همین سیستم
        </footer>
      </div>

      {/* گزاره ۷ — یادآور تولد پرسنل شاغل، پس از هر ورود به برنامه برای همه کاربران */}
      {company && <BirthdayReminder />}

      <MustChangePassword />
      {/* دستیار هوشمند */}
      <SmartAssistant
        open={aiOpen}
        onOpenChange={setAiOpen}
        onNavigate={(m) => {
          setActive(m as ModuleKey);
          setAiOpen(false);
        }}
      />
    </div>
  );
}

export default function AppShell() {
  return (
    <AppStateProvider>
      <ShellInner />
    </AppStateProvider>
  );
}
