'use client';
// ماژول تسویه حساب پرسنل — گزاره ۶ نسخه ۱٫۲٫۰
// فرم استاندارد مورد قبول اداره کار/تامین اجتماعی با محاسبات دقیق قانون کار
// + محل امضا و اثر انگشت همکار و کارفرما — چاپ A4
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState, Fa } from '@/components/shared';
import { apiGet, openPrintWindow } from '@/lib/api-client';
import { formatMoney } from '@/lib/core/numbers';
import { JalaliDateInput } from '@/components/jalali-date-input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Printer, FileDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PersonLite { id: number; firstName: string; lastName: string; personnelCode: string; status: string; nationalId: string }
interface SettleStep { label: string; value: string }
interface SettleLine { title: string; detail: string; amount: number; sign: 1 | -1; steps?: SettleStep[]; basis?: string }
interface SettleResult {
  personnel: { id: number; fullName: string; personnelCode: string; nationalId: string; jobTitle: string; department: string; hireDate: string; endWorkDate: string };
  toDate: string; serviceYears: number; serviceDays?: number; daysThisYear?: number; lines: SettleLine[]; totalDue: number; totalDeduct: number; net: number;
  decreeUsed: string; dailyWage: number; mizanDaily?: number;
}

export default function SettlementModule() {
  const { company } = useApp();
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [personnelId, setPersonnelId] = useState('');
  // اتوماسیون دستیار هوشمند (مورد ۷): «تسویه حساب فلانی» → انتخاب خودکار فرد
  const pendingCodeRef = useRef<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string; personnelCode?: string }>).detail;
      if (detail?.type === 'settlement' && detail.personnelCode) {
        pendingCodeRef.current = String(detail.personnelCode);
      }
    };
    window.addEventListener('payroll-assistant-command', handler);
    return () => window.removeEventListener('payroll-assistant-command', handler);
  }, []);
  const [toDate, setToDate] = useState('');
  const [result, setResult] = useState<SettleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await apiGet<{ personnel: PersonLite[] }>(`/api/personnel?companyId=${company.id}`);
      setPeople(res.personnel ?? []);
      if (pendingCodeRef.current) {
        const found = res.personnel.find((x) => String(x.personnelCode) === pendingCodeRef.current);
        if (found) { setPersonnelId(String(found.id)); pendingCodeRef.current = null; }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  const compute = async () => {
    if (!personnelId) { toast.error('ابتدا پرسنل را انتخاب کنید'); return; }
    setBusy(true);
    try {
      const r = await apiGet<SettleResult>(`/api/settlement?personnelId=${personnelId}${toDate ? `&toDate=${encodeURIComponent(toDate)}` : ''}`);
      setResult(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    if (!personnelId) return;
    await openPrintWindow(`/api/settlement?personnelId=${personnelId}${toDate ? `&toDate=${encodeURIComponent(toDate)}` : ''}&format=html`, { filename: 'settlement.html' });
  };

  // نسخه ۱٫۴٫۵ — فایل ورد واقعی تسویه‌حساب روی قالب سربرگ رسمی کاربر
  const printWord = async () => {
    if (!personnelId) return;
    await openPrintWindow(`/api/settlement?personnelId=${personnelId}${toDate ? `&toDate=${encodeURIComponent(toDate)}` : ''}&format=docx`, { filename: 'settlement-letterhead.docx' });
  };

  const sel = people.find((p) => String(p.id) === personnelId);

  // قابلیت ۱٫۴٫۵ — کلیک روی هر مبلغ تسویه‌حساب → نمایش مراحل محاسبه
  const [traceLine, setTraceLine] = useState<SettleLine | null>(null);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="تسویه حساب پرسنل"
        subtitle="فرم استاندارد پایان کار مطابق قانون کار و تامین اجتماعی — مرخصی (ماده ۶۴)، عیدی (مصوبه ۱۳۷۰)، سنوات (مواد ۲۴ و ۲۷) و کسور وام/مساعده"
      />
      <Card className="p-4">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">انتخاب پرسنل</label>
            <Select value={personnelId} onValueChange={(v) => { setPersonnelId(v); setResult(null); }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.firstName} {p.lastName} — {p.personnelCode} {p.status !== 'شاغل' ? `(${p.status})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">تاریخ تسویه (۸ رقم — مثال: ۱۴۰۵۰۸۳۰)</label>
            <JalaliDateInput value={toDate} onChange={setToDate} placeholder="۱۴۰۵۰۸۳۰" />
          </div>
          <Button onClick={compute} disabled={busy || !personnelId} className="gap-2">
            <Calculator size={16} /> {busy ? 'در حال محاسبه…' : 'محاسبه تسویه'}
          </Button>
          <Button onClick={print} disabled={!result} variant="outline" className="gap-2">
            <Printer size={16} /> چاپ فرم تسویه‌حساب (A4)
          </Button>
          <Button onClick={printWord} disabled={!result} variant="outline" className="gap-2">
            <FileDown size={16} /> دانلود Word (سربرگ رسمی)
          </Button>
        </div>
      </Card>

      {!result && !loading && (
        <EmptyState
          icon={<Calculator size={40} className="opacity-40" />}
          title="محاسبه تسویه حساب"
          hint="پرسنل و تاریخ تسویه را انتخاب و روی «محاسبه تسویه» بزنید. فرم چاپی شامل جدول محاسبات، مفاد قانونی و محل امضا و اثر انگشت است."
        />
      )}

      {result && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm border-b pb-3">
            <span><b>نام:</b> <Fa>{result.personnel.fullName}</Fa></span>
            <span><b>کد پرسنلی:</b> <Fa>{result.personnel.personnelCode}</Fa></span>
            <span><b>کد ملی:</b> <Fa>{result.personnel.nationalId || '—'}</Fa></span>
            <span><b>بخش:</b> <Fa>{result.personnel.department}</Fa></span>
            <span><b>تاریخ استخدام:</b> <Fa>{result.personnel.hireDate || '—'}</Fa></span>
            <span><b>سابقه خدمت:</b> <Fa>{`${String(result.serviceYears)} سال`}</Fa></span>
            <span><b>مزد روزانه مبنای محاسبه:</b> <Fa>{formatMoney(result.dailyWage)}</Fa> ریال</span>
            <span><b>حکم مبنا:</b> <Fa>{result.decreeUsed}</Fa></span>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted text-xs">
                <th className="border p-2 w-10">ردیف</th>
                <th className="border p-2 text-right">شرح</th>
                <th className="border p-2 text-right">محاسبه / جزئیات</th>
                <th className="border p-2 w-44">مبلغ (ریال)</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l, i) => (
                <tr key={i} className={l.sign === -1 ? 'text-red-700' : 'text-emerald-800'}>
                  <td className="border p-2 text-center"><Fa>{i + 1}</Fa></td>
                  <td className="border p-2 font-medium">{l.title}</td>
                  <td className="border p-2 text-xs text-muted-foreground">{l.detail}</td>
                  <td className="border p-2 text-left font-mono">
                    {l.steps?.length ? (
                      <button className="underline decoration-dotted underline-offset-4 cursor-pointer" onClick={() => setTraceLine(l)} title="نمایش مراحل محاسبه">
                        <Fa>{`${l.sign === 1 ? '+' : '−'} ${formatMoney(l.amount)}`}</Fa>
                      </button>
                    ) : <Fa>{`${l.sign === 1 ? '+' : '−'} ${formatMoney(l.amount)}`}</Fa>}
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-muted/50">
                <td className="border p-2 text-center" colSpan={3}>جمع مطالبات همکار</td>
                <td className="border p-2 text-left font-mono"><Fa>{formatMoney(result.totalDue)}</Fa></td>
              </tr>
              <tr className="font-bold bg-muted/50">
                <td className="border p-2 text-center" colSpan={3}>جمع بدهی همکار (وام و مساعده)</td>
                <td className="border p-2 text-left font-mono"><Fa>{formatMoney(result.totalDeduct)}</Fa></td>
              </tr>
              <tr className="font-extrabold bg-emerald-50 text-emerald-900 text-base">
                <td className="border p-2 text-center" colSpan={3}>خالص قابل پرداخت هنگام تسویه</td>
                <td className="border p-2 text-left font-mono"><Fa>{formatMoney(result.net)}</Fa></td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-2">
            مبانی: مانده مرخصی موضوع ماده ۶۴ قانون کار — عیدی و پاداش به نسبت کارکرد موضوع قانون مصوب ۱۳۷۰/۱۲/۰۶ —
            سنوات (مزایای پایان کار) موضوع مواد ۲۴ و ۲۷ قانون کار — کسور وام و مساعده باز پرونده.
            فرم چاپی شامل مفاد رضایت‌نامه و محل امضا و اثر انگشت همکار و کارفرماست.
          </p>
          {sel && !sel.nationalId && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              توجه: این پرسنل کد ملی ندارد — برای تسویه‌حساب رسمی، ابتدا کد ملی معتبر را در پرونده ثبت کنید.
            </p>
          )}
          <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">
            راهنما: روی هر مبلغِ زیرش خط‌چین است کلیک کنید تا مراحل گام‌به‌گام محاسبه آن نمایش داده شود.
          </p>
        </Card>
      )}

      {/* دیالوگ مراحل محاسبه — قابلیت ۱٫۴٫۵ */}
      <Dialog open={!!traceLine} onOpenChange={(o) => !o && setTraceLine(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base">مراحل محاسبه — {traceLine?.title}</DialogTitle>
          </DialogHeader>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-muted text-xs"><th className="border p-2 text-right w-1/2">مرحله محاسبه</th><th className="border p-2 text-right">مقدار</th></tr></thead>
            <tbody>
              {traceLine?.steps?.map((s, i) => (
                <tr key={i}><td className="border p-2">{s.label}</td><td className="border p-2 text-left font-mono"><Fa>{s.value}</Fa></td></tr>
              ))}
            </tbody>
          </table>
          {traceLine?.basis && <p className="text-[11px] text-muted-foreground bg-muted/50 border rounded p-2">مبنای قانونی: {traceLine.basis}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
