'use client';
// اجزای مشترک رابط کاربری — سطح یکپارچه در سرتاسر برنامه
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toPersianDigits } from '@/lib/core/numbers';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { NAV_GROUPS, navigateToModule, currentActiveModule } from '@/components/nav-groups';
import { useApp } from '@/components/app-state';

/** منوی آبشاری سرصفحه — پرش سریع به سایر ماژول‌ها از بالای هر صفحه (مورد ۱۶ نسخه ۱٫۴٫۴) */
export function ModuleQuickNav() {
  const { user } = useApp();
  const active = currentActiveModule();
  const visible = (rolesOnly?: ('admin' | 'supervisor')[]) =>
    !rolesOnly || (user?.role === 'admin' || user?.isSupervisor === true);
  const current = NAV_GROUPS.flatMap((g) => g.items).find((it) => it.key === active && visible(it.rolesOnly));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[12px] no-print" title="پرش سریع به سایر بخش‌ها">
          {current?.icon}
          <span className="max-w-40 truncate">{current?.title ?? 'بخش‌ها'}</span>
          <span className="text-[10px] text-muted-foreground">▾</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
        {NAV_GROUPS.map((g, gi) => {
          const items = g.items.filter((it) => visible(it.rolesOnly));
          if (!items.length) return null;
          return (
            <div key={g.label}>
              {gi > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[10.5px] text-muted-foreground">{g.label}</DropdownMenuLabel>
              {items.map((it) => (
                <DropdownMenuItem
                  key={it.key}
                  className={cn('gap-2 text-[12.5px] cursor-pointer', it.key === active && 'bg-primary/10 text-primary font-medium')}
                  onClick={() => navigateToModule(it.key)}
                >
                  <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{it.icon}</span>
                  {it.title}
                </DropdownMenuItem>
              ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader({ title, subtitle, icon, actions }: {
  title: string; subtitle?: string; icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5 animate-fade-up">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <ModuleQuickNav />
        {actions}
      </div>
    </div>
  );
}

export function StatCard({ title, value, hint, icon, tone = 'default' }: {
  title: string; value: string; hint?: string; icon?: React.ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'destructive' | 'gold';
}) {
  const tones: Record<string, string> = {
    default: 'text-primary bg-primary/10',
    positive: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    destructive: 'text-destructive bg-destructive/10',
    gold: 'text-gold bg-gold/10',
  };
  return (
    <Card className="p-5 shadow-luxe border-border/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
          <p className="text-[22px] font-bold num mt-1.5 truncate" title={value}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        {icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
        {icon ?? <span className="text-2xl">—</span>}
      </div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1 max-w-md">{hint}</p>}
    </div>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** نمایش عدد/مبلغ با ارقام فارسی */
export function Fa({ children, money }: { children: string | number; money?: boolean }) {
  const s = String(children ?? '');
  return <span className="num">{money ? toPersianDigits(Number(s).toLocaleString('en-US')).replace(/,/g, '٬') : toPersianDigits(s)}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'شاغل': 'bg-success/10 text-success',
    'غیرفعال': 'bg-muted text-muted-foreground',
    'خروج': 'bg-destructive/10 text-destructive',
    'بازنشسته': 'bg-gold/10 text-gold',
    'حاضر': 'bg-success/10 text-success',
    'غایب': 'bg-destructive/10 text-destructive',
    'مرخصی': 'bg-warning/10 text-warning',
    'تاخیر': 'bg-warning/10 text-warning',
    'تعجیل': 'bg-warning/10 text-warning',
    'تاخیر و تعجیل': 'bg-warning/10 text-warning',
    'ماموریت': 'bg-primary/10 text-primary',
    'تعطیل': 'bg-muted text-muted-foreground',
    'تعطیل‌کاری': 'bg-primary/10 text-primary',
    'مرخصی استعلاجی': 'bg-warning/10 text-warning',
    'مرخصی بدون حقوق': 'bg-muted text-muted-foreground',
    'پیش‌نویس': 'bg-muted text-muted-foreground',
    'نهایی': 'bg-success/10 text-success',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', map[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  );
}
