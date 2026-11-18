'use client';
// ماژول داشبورد — نمای کلی: پرسنل، دوره حقوق اخیر، شروع سریع، تعطیلات پیش رو
import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Banknote, Landmark, Scale, CalendarDays,
  Download, Calculator, FileOutput, UserPlus, ArrowLeft, Sparkles, AlertTriangle, Info, ShieldAlert,
} from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, StatCard, LoadingBlock, StatusBadge } from '@/components/shared';
import { apiGet } from '@/lib/api-client';
import { toPersianDigits, formatMoney } from '@/lib/core/numbers';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DtColumn } from '@/components/data-table';
import type { Insight } from '@/lib/ai/insights';

interface DashboardData {
  company: { id: number; name: string };
  fy: { id: number; jy: number } | null;
  today: { jy: number; jm: number; jd: number; monthName: string };
  personnel: { total: number; byStatus: Record<string, number>; active: number; inactive: number };
  lastPeriod: {
    id: number; jy: number; jm: number; status: string; monthName: string;
    count: number; netPay: number; tax: number; insurance: number; gross: number;
  } | null;
  periods: Array<{
    id: number; jy: number; jm: number; status: string; monthName: string;
    count: number; netPay: number; tax: number; insurance: number; gross: number;
  }>;
  upcomingHolidays: Array<{ id: number; label: string; title: string }>;
}

const STEPS = [
  {
    icon: <UserPlus className="h-5 w-5" />, title: '۱. ثبت پرسنل و احکام',
    text: 'پرسنل را در ماژول «پرسنل» ثبت یا ویرایش کنید و وضعیت شاغل/غیرفعال را تنظیم نمایید. سپس در «قرارداد و احکام» حکم حقوقی (مزد، مسکن، خواروبار و…) هر نفر را وارد کنید.',
    hint: 'ماژول: پرسنل → قرارداد و احکام',
  },
  {
    icon: <Download className="h-5 w-5" />, title: '۲. ایمپورت حضور و غیاب',
    text: 'فایل «گزارش روزانه فردی» دستگاه حضور و غیاب را در ماژول «حضور و غیاب» ایمپورت کنید؛ پرسنل جدید به‌صورت خودکار ساخته می‌شود و تاخیر/تعجیل/اضافه‌کار بر اساس شیفت و زمان‌های مجاز تاخیر و تعجیل محاسبه می‌گردد.',
    hint: 'ماژول: حضور و غیاب → دکمه ایمپورت',
  },
  {
    icon: <Calculator className="h-5 w-5" />, title: '۳. محاسبه حقوق و خروجی‌ها',
    text: 'در ماژول «محاسبه و فیش» دوره ماهانه را بسازید و محاسبه کنید؛ سپس فیش‌ها را چاپ و خروجی‌های استاندارد (مالیات، بیمه، لیست بانک و اکسل) را دانلود نمایید.',
    hint: 'ماژول: محاسبه و فیش → خروجی‌های استاندارد',
  },
];

export default function DashboardModule() {
  const { company, fy } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  // قابلیت ۱٫۴٫۵ — ریز محاسبه کارت‌های مالی داشبورد
  const [sumTrace, setSumTrace] = useState<{
    title: string; kind: 'net' | 'tax' | 'ins'; periodId: number;
    rows: Array<{ name: string; code: string; amount: number }>;
    total: number;
  } | null>(null);
  const openSumTrace = async (kind: 'net' | 'tax' | 'ins', title: string) => {
    if (!data?.lastPeriod) return;
    try {
      const res = await apiGet<{ rows: Array<{ personnel: { firstName: string; lastName: string; personnelCode: string }; workerIns: number; employerIns: number; unemploymentIns: number; tax: number; netPay: number }> }>(
        `/api/payroll/summary?periodId=${data.lastPeriod.id}`);
      const rows = res.rows.map((r) => ({
        name: `${r.personnel.firstName} ${r.personnel.lastName}`.trim(),
        code: r.personnel.personnelCode,
        amount: kind === 'net' ? r.netPay : kind === 'tax' ? r.tax : r.workerIns + r.employerIns + r.unemploymentIns,
      })).filter((r) => r.amount !== 0);
      const total = rows.reduce((s, r) => s + r.amount, 0);
      setSumTrace({ title, kind, periodId: data.lastPeriod.id, rows, total });
    } catch { /* بی‌صدا */ }
  };

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const res = await apiGet<DashboardData>(
        `/api/dashboard?companyId=${company.id}${fy ? `&fyId=${fy.id}` : ''}`,
      );
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [company, fy]);

  // تحلیل هوشمند — ناهنجاری‌ها و پیش‌بینی آماری (کاملا آفلاین)
  const loadInsights = useCallback(async () => {
    if (!fy || !company) { setInsights([]); setInsightsLoading(false); return; }
    setInsightsLoading(true);
    try {
      const res = await apiGet<{ insights: Insight[] }>(`/api/ai/insights?fyId=${fy.id}&companyId=${company.id}`);
      setInsights(res.insights ?? []);
    } catch {
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }, [company, fy]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadInsights(); }, [loadInsights]);

  const money = (v: number) => formatMoney(v);

  // ستون‌های جدول دوره‌های حقوق — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const periodCols: DtColumn<DashboardData['periods'][number]>[] = [
    {
      key: 'month', header: 'ماه', align: 'center', className: 'font-medium',
      sortValue: (p) => p.jm,
      cell: (p) => `${p.monthName} ${toPersianDigits(p.jy)}`,
    },
    {
      key: 'count', header: 'تعداد فیش', align: 'center', className: 'num',
      cell: (p) => toPersianDigits(String(p.count)),
    },
    {
      key: 'status', header: 'وضعیت', align: 'center',
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'netPay', header: 'جمع خالص (ریال)', align: 'center', className: 'num whitespace-nowrap',
      cell: (p) => (p.count ? money(p.netPay) : '—'),
    },
  ];

  const lp = data?.lastPeriod ?? null;
  return (
    <div className="space-y-5">
      <PageHeader
        title="داشبورد"
        subtitle={data ? `${data.company.name} — سال مالی ${toPersianDigits(data.fy?.jy ?? 0)} — امروز ${toPersianDigits(data.today.jd)} ${data.today.monthName} ${toPersianDigits(data.today.jy)}` : 'نمای کلی سامانه'}
        icon={<LayoutDashboard className="h-5 w-5" />}
        actions={
          <Badge variant="outline" className="gap-1.5 text-[11px] px-3 py-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> اجرای کاملا محلی
          </Badge>
        }
      />

      {loading ? (
        <LoadingBlock rows={6} />
      ) : !data ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          خطا در بارگذاری آمار — اتصال به سرور محلی را بررسی کنید.
        </Card>
      ) : (
        <>
          {/* کارت‌های آماری — نسخه ۱٫۴٫۵: کلیک روی کارت‌های مالی = ریز محاسبه جمع */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="پرسنل شاغل"
              value={toPersianDigits(String(data.personnel.active))}
              hint={`از مجموع ${toPersianDigits(String(data.personnel.total))} نفر ثبت‌شده`}
              icon={<Users className="h-5 w-5" />}
              tone="default"
            />
            <div className={lp ? 'cursor-pointer' : ''} onClick={lp ? () => openSumTrace('net', `جمع خالص ${lp.monthName}`) : undefined}>
              <StatCard
                title={`جمع خالص ${lp ? lp.monthName : 'آخرین دوره'}`}
                value={lp ? money(lp.netPay) : '—'}
                hint={lp ? `${toPersianDigits(String(lp.count))} فیش — ${lp.status} — ریال — برای ریز محاسبه کلیک کنید` : 'دوره‌ای محاسبه نشده'}
                icon={<Banknote className="h-5 w-5" />}
                tone="positive"
              />
            </div>
            <div className={lp ? 'cursor-pointer' : ''} onClick={lp ? () => openSumTrace('tax', `جمع مالیات ${lp.monthName}`) : undefined}>
              <StatCard
                title={`جمع مالیات ${lp ? lp.monthName : ''}`}
                value={lp ? money(lp.tax) : '—'}
                hint={data.lastPeriod ? 'مالیات حقوق دوره — برای ریز محاسبه کلیک کنید' : ''}
                icon={<Scale className="h-5 w-5" />}
                tone="warning"
              />
            </div>
            <div className={lp ? 'cursor-pointer' : ''} onClick={lp ? () => openSumTrace('ins', `جمع بیمه ${lp.monthName}`) : undefined}>
              <StatCard
                title={`جمع بیمه ${lp ? lp.monthName : ''}`}
                value={lp ? money(lp.insurance) : '—'}
                hint={data.lastPeriod ? 'کارگر + کارفرما + بیکاری — برای ریز محاسبه کلیک کنید' : ''}
                icon={<Landmark className="h-5 w-5" />}
                tone="gold"
              />
            </div>
          </div>

          {/* تحلیل هوشمند — بینش‌ها و ناهنجاری‌ها (موتور آفلاین) */}
          <Card className="p-5 shadow-luxe border-border/70">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h2 className="font-bold text-[15px]">تحلیل هوشمند — ناهنجاری‌ها و پیش‌بینی</h2>
              </div>
              <Badge variant="outline" className="gap-1 text-[10px] border-primary/40 bg-primary/5 text-primary">
                <Sparkles className="h-3 w-3" /> موتور آفلاین برنامه
              </Badge>
            </div>
            {insightsLoading ? (
              <LoadingBlock rows={2} />
            ) : insights.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                هنوز داده کافی برای تحلیل وجود ندارد — پس از محاسبه حداقل یک دوره حقوق، بینش‌های هوشمند اینجا نمایش داده می‌شود.
              </p>
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2">
                {insights.map((ins) => {
                  const tone = ins.severity === 'critical'
                    ? 'border-destructive/40 bg-destructive/5'
                    : ins.severity === 'warning'
                      ? 'border-gold/50 bg-gold/5'
                      : 'border-border/60 bg-muted/20';
                  const Icon = ins.severity === 'critical' ? ShieldAlert : ins.severity === 'warning' ? AlertTriangle : Info;
                  const iconCls = ins.severity === 'critical' ? 'text-destructive bg-destructive/10'
                    : ins.severity === 'warning' ? 'text-gold bg-gold/10' : 'text-primary bg-primary/10';
                  return (
                    <div key={ins.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tone}`}>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${iconCls}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{ins.title}</p>
                        <p className="text-[11.5px] leading-5 text-muted-foreground mt-0.5">{ins.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* دوره‌های اخیر */}
            <Card className="p-5 shadow-luxe border-border/70">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[15px]">دوره‌های حقوق سال {toPersianDigits(data.fy?.jy ?? 0)}</h2>
                <span className="text-[11px] text-muted-foreground">محاسبه و جزئیات از ماژول «محاسبه و فیش»</span>
              </div>
              {data.periods.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  هنوز دوره‌ای ساخته نشده است. از ماژول «محاسبه و فیش» دوره ماهانه بسازید.
                </p>
              ) : (
                <DataTable
                  id="dashboard-periods"
                  columns={periodCols}
                  rows={[...data.periods].reverse()}
                  rowKey={(p) => p.id}
                  containerClassName="max-h-72"
                />
              )}
            </Card>

            {/* تعطیلات پیش رو */}
            <Card className="p-5 shadow-luxe border-border/70">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[15px]">تعطیلات پیش رو</h2>
                <span className="text-[11px] text-muted-foreground">پنج تعطیل رسمی بعدی از امروز</span>
              </div>
              {data.upcomingHolidays.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">تعطیل رسمی ثبت‌شده‌ای در پیش رو نیست (جمعه‌ها در تقویم ماژول جداگانه‌اند).</p>
              ) : (
                <div className="space-y-2.5">
                  {data.upcomingHolidays.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive shrink-0">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">{h.title}</p>
                        <p className="text-[11.5px] text-muted-foreground num mt-0.5">{toPersianDigits(h.label)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* شروع سریع — سه گام */}
          <Card className="p-5 shadow-luxe border-border/70">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">شروع سریع — جریان کار در سه گام</h2>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                ماژول‌ها از منوی سایدبار <ArrowLeft className="h-3 w-3" />
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={i} className="relative rounded-xl border border-border/60 bg-muted/20 p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      {s.icon}
                    </div>
                    <p className="text-[13.5px] font-bold">{s.title}</p>
                  </div>
                  <p className="text-[12.5px] leading-6 text-muted-foreground">{s.text}</p>
                  <p className="mt-2.5 text-[11px] font-medium text-primary">{s.hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
              <FileOutput className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[12.5px] text-foreground/85">
                نکته: پرسنلِ ایجادشده از فایل دستگاه معمولا «غیرفعال» هستند — پیش از محاسبه حقوق، وضعیت و حکم آن‌ها را کامل کنید
                <span className="text-muted-foreground"> (فعلا {toPersianDigits(String(data.personnel.inactive))} نفر غیرفعال ثبت شده است).</span>
              </p>
            </div>
          </Card>

          {/* دیالوگ ریز محاسبه کارت‌های مالی — قابلیت ۱٫۴٫۵ */}
          <Dialog open={!!sumTrace} onOpenChange={(o) => !o && setSumTrace(null)}>
            <DialogContent className="max-w-xl max-h-[80vh] overflow-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-base">ریز محاسبه — {sumTrace?.title}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">جمع کل = مجموع مقدار همه پرسنل در دوره؛ روی هر نفر مقدار او نمایش داده می‌شود.</p>
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-muted text-xs"><th className="border p-2 text-right w-14">ردیف</th><th className="border p-2 text-right">نام</th><th className="border p-2 text-right">کد پرسنلی</th><th className="border p-2 text-right">مبلغ (ریال)</th></tr></thead>
                <tbody>
                  {sumTrace?.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="border p-2 text-center">{toPersianDigits(String(i + 1))}</td>
                      <td className="border p-2">{r.name}</td>
                      <td className="border p-2 num">{toPersianDigits(r.code)}</td>
                      <td className="border p-2 text-left font-mono">{money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-muted/50">
                    <td className="border p-2 text-center" colSpan={3}>جمع کل</td>
                    <td className="border p-2 text-left font-mono">{sumTrace ? money(sumTrace.total) : ''}</td>
                  </tr>
                </tfoot>
              </table>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
