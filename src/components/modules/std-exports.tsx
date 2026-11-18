'use client';
// ماژول خروجی‌های استاندارد — فایل‌های مالیات، بیمه، بانک و فیش چاپی
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FileOutput, FileSpreadsheet, FileText, Printer, Database, Landmark, ShieldCheck, ScrollText, Info,
} from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState } from '@/components/shared';
import { downloadFile, openPrintWindow } from '@/lib/api-client';
import { toPersianDigits } from '@/lib/core/numbers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

interface PeriodRow { id: number; fiscalYearId: number; jy: number; jm: number; status: string }

function ExportCard({ title, desc, target, icon, filename, url, disabled, tonext }: {
  title: string; desc: string; target: string; icon: React.ReactNode;
  filename?: string; url?: string; disabled?: boolean; tonext?: boolean;
}) {
  return (
    <Card className="p-5 shadow-luxe border-border/70 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[14px]">{title}</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{desc}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground truncate" title={target}>{target}</span>
        <Button
          size="sm" variant="outline" className="gap-1.5 h-8 shrink-0"
          disabled={disabled}
          onClick={async () => {
            if (!url) return;
            try {
              if (tonext) {
                await openPrintWindow(url, { filename: filename || 'payslip.html' });
              } else {
                await downloadFile(url, filename || 'export');
              }
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <FileOutput size={13} /> دانلود
        </Button>
      </div>
    </Card>
  );
}

export default function StdExportsModule() {
  const { company, fy, periods } = useApp();
  const [periodId, setPeriodId] = useState('');
  const [busy, setBusy] = useState(false);

  // دوره انتخابی یا اولین دوره موجود
  const effPeriodId = periodId || String(periods[0]?.id ?? '');

  const period = periods.find((p) => String(p.id) === effPeriodId) ?? null;
  const stamp = useMemo(
    () => (period ? `${period.jy}${String(period.jm).padStart(2, '0')}` : ''),
    [period],
  );
  const qs = effPeriodId ? `?periodId=${effPeriodId}` : '';
  const noPeriod = !effPeriodId;

  return (
    <div>
      <PageHeader
        title="خروجی‌های استاندارد"
        subtitle={`${company?.name ?? ''} — فایل‌های بارگذاری سامانه‌های دولتی`}
        icon={<FileOutput size={20} />}
        actions={
          <>
            <Select value={effPeriodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="انتخاب دوره" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {MONTH_NAMES[p.jm - 1]} {toPersianDigits(p.jy)} — {p.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!periods.length && (
              <Button variant="outline" size="sm" className="h-9" onClick={() => toast.info('ابتدا در ماژول «محاسبه و فیش» یک دوره ایجاد و محاسبه کنید')}>
                دوره‌ای موجود نیست
              </Button>
            )}
          </>
        }
      />

      {noPeriod ? (
        <Card>
          <EmptyState
            title="دوره‌ای انتخاب نشده است"
            hint="از ماژول «محاسبه و فیش» یک دوره ایجاد و محاسبه کنید تا خروجی‌های استاندارد فعال شوند"
            icon={<FileOutput size={28} />}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {/* بن اطلاعات */}
          <Card className="p-4 border-gold/40 bg-gold/5">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-gold shrink-0 mt-0.5" />
              <p className="text-[12.5px] leading-relaxed text-foreground/90">
                فایل‌های WP/WH مطابق راهنمای نسخه <b>۱.۷.۰.۴</b> سازمان امور مالیاتی است (salary.tax.gov.ir).
                فایل‌های DBF مطابق نرم‌افزار رسمی «لیست دیسک» تامین اجتماعی است (eservices.tamin.ir) —
                <b> قبل از ارسال قطعی یک بار بارگذاری آزمایشی کنید</b>. لیست بانک برای سیستم بانکی و فیش برای چاپ/ارسال به پرسنل است.
              </p>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <ExportCard
              title="اکسل لیست حقوق ماه"
              desc="جدول خلاصه حقوق همه پرسنل با جمع کل — بایگانی و گزارش داخلی"
              target="فایل اکسل داخلی"
              icon={<FileSpreadsheet size={18} />}
              url={`/api/exports/payroll-xlsx${qs}`}
              filename={`payroll-${stamp}.xlsx`}
              disabled={busy}
            />
            <ExportCard
              title="اکسل لیست بانک"
              desc="نام، کد ملی، حساب و مبلغ قابل پرداخت — ورودی سیستم بانکی"
              target="سیستم بانکی / خزانه‌داری"
              icon={<Landmark size={18} />}
              url={`/api/exports/bank${qs}`}
              filename={`bank-${stamp}.xlsx`}
              disabled={busy}
            />
            <ExportCard
              title="اکسل لیست مالیات"
              desc="نام، کد ملی، درآمد، مشمول مالیات و مالیات متعلقه"
              target="salary.tax.gov.ir"
              icon={<ScrollText size={18} />}
              url={`/api/exports/tax-xlsx${qs}`}
              filename={`tax-${stamp}.xlsx`}
              disabled={busy}
            />
            <ExportCard
              title="اکسل لیست بیمه"
              desc="شماره بیمه، روز بیمه، دستمزد مشمول و سهم ۷٪/۲۳٪/۳٪"
              target="eservices.tamin.ir — لیست دیسک"
              icon={<ShieldCheck size={18} />}
              url={`/api/exports/insurance-xlsx${qs}`}
              filename={`insurance-${stamp}.xlsx`}
              disabled={busy}
            />
            <ExportCard
              title={`فایل مالیات WP${toPersianDigits(stamp)}.TXT`}
              desc="فهرست کارکنان — ۲۳ فیلد، UTF-8، سطرها CRLF (بارگذاری مستقیم در سامانه)"
              target="salary.tax.gov.ir → فهرست حقوق جدید"
              icon={<FileText size={18} />}
              url={`/api/exports/tax-wp${qs}`}
              filename={`WP${stamp}.TXT`}
              disabled={busy}
            />
            <ExportCard
              title={`فایل مالیات WH${toPersianDigits(stamp)}.TXT`}
              desc="فهرست حقوق ریالی — ۳۹ فیلد مطابق راهنمای ۱.۷.۰.۴"
              target="salary.tax.gov.ir → فهرست حقوق جدید"
              icon={<FileText size={18} />}
              url={`/api/exports/tax-wh${qs}`}
              filename={`WH${stamp}.TXT`}
              disabled={busy}
            />
            <ExportCard
              title="اکسل WH (قالب ۳۹ ستون)"
              desc="همان قالب WH برای کنترل و ورود دستی در سامانه مالیات"
              target="salary.tax.gov.ir"
              icon={<FileSpreadsheet size={18} />}
              url={`/api/exports/wh-xlsx${qs}`}
              filename={`WH${stamp}.xlsx`}
              disabled={busy}
            />
            <ExportCard
              title="DBF بیمه — کارگاه (DSKKAR00)"
              desc="فایل اطلاعات ماهیانه کارگاه مطابق نرم‌افزار لیست دیسک"
              target="eservices.tamin.ir → لیست حق بیمه"
              icon={<Database size={18} />}
              url={`/api/exports/insurance-dbf-kar${qs}`}
              filename="DSKKAR00.dbf"
              disabled={busy}
            />
            <ExportCard
              title="DBF بیمه — بیمه‌شدگان (DSKWOR00)"
              desc="ریزکارکرد بیمه‌شدگان (نام، کد بیمه، روز، دستمزد مشمول)"
              target="eservices.tamin.ir → لیست حق بیمه"
              icon={<Database size={18} />}
              url={`/api/exports/insurance-dbf-wor${qs}`}
              filename="DSKWOR00.dbf"
              disabled={busy}
            />
            <ExportCard
              title="فیش HTML (چاپ به PDF)"
              desc="فیش حقوقی چاپی تک‌رنگ برای همه یا یک پرسنل — در پنجره جدید باز می‌شود"
              target="چاپ / ارسال به پرسنل"
              icon={<Printer size={18} />}
              url={`/api/exports/payslip${qs}`}
              tonext
              disabled={busy}
            />
          </div>
        </div>
      )}
    </div>
  );
}
