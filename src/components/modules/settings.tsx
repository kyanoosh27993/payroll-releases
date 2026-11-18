'use client';
// ماژول تنظیمات — پارامترهای سال مالی، پله‌های مالیاتی و اقلام فیش حقوقی
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Settings, Save, Plus, Pencil, Trash2, Lock, Percent, ReceiptText, Infinity as InfinityIcon, DatabaseBackup, RotateCcw, Archive, Sparkles, Cpu, Palette, ImagePlus, Briefcase, Upload } from 'lucide-react';
import { usePayrollTheme } from '@/components/theme/payroll-theme';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState, LoadingBlock, Fa } from '@/components/shared';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { normalizeDigits, toPersianDigits, parseIntOr, parseNumberOr, formatMoney } from '@/lib/core/numbers';
import { MONTH_NAMES } from '@/lib/core/jalali';
import { formatSize } from './settings-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type DtColumn } from '@/components/data-table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface BracketRow {
  id: number; fiscalYearId: number; seq: number; fromAmount: number; toAmount: number | null; ratePercent: number;
}

interface ItemRow {
  code: string; title: string; kind: string; formulaKey: string; taxMode: string;
  taxPercent: number; insured: boolean; active: boolean; sort: number; systemLocked: boolean;
}

interface BackupRow {
  name: string; size: number; mtime: string | number; preRestore: boolean;
}



const SETTING_FIELDS: Array<{ key: string; label: string; hint?: string }> = [
  { key: 'monthly_required_hours', label: 'ساعات موظفی ماه' },
  { key: 'overtime_factor', label: 'ضریب اضافه‌کاری', hint: 'معمولاً ۱.۴ (ماده ۵۹ قانون کار)' },
  { key: 'holiday_work_factor', label: 'ضریب تعطیل‌کاری', hint: 'معمولاً ۱.۷' },
  { key: 'friday_work_factor', label: 'ضریب جمعه‌کاری — با تعطیلی جایگزین', hint: 'معمولاً ۱.۴ (ماده ۶۲): ۴۰٪ فوق‌العاده' },
  { key: 'friday_no_replace_factor', label: 'ضریب جمعه‌کاری — بدون تعطیلی جایگزین', hint: 'معمولاً ۱.۸ (۱۰۰٪ مزد + ۴۰٪ فوق‌العاده + ۴۰٪ اضافه‌کار)' },
  { key: 'night_work_percent', label: 'درصد شب‌کاری موظفی', hint: 'معمولاً ۳۵٪ اضافه بر مزد ساعتی (ماده ۵۸)' },
  { key: 'night_ot_percent', label: 'درصد شب‌کاری غیرموظفی (اضافه‌کار شب)', hint: 'معمولاً ۷۵٪ اضافه — جمعاً ۱۷۵٪ مزد ساعتی' },
  { key: 'shift1_percent', label: 'نوبت‌کاری صبح و عصر (٪)', hint: 'معمولاً ۱۰٪ مزد ساعتی' },
  { key: 'shift2_percent', label: 'نوبت‌کاری صبح، عصر و شب (٪)', hint: 'معمولاً ۱۵٪ مزد ساعتی' },
  { key: 'shift3_percent', label: 'نوبت‌کاری دو شیفت همراه با شب (٪)', hint: 'معمولاً ۲۲.۵٪ مزد ساعتی' },
  { key: 'minimum_wage_monthly', label: 'پایه حقوق وزارت کار — ماهانه (ریال)', hint: 'برابر حداقل دستمزد روزانه × ۳۰ — سقف عیدی نیز هست' },
  { key: 'seniority_base_monthly', label: 'پایه سنوات — ماهانه (ریال)', hint: 'پایه سنوات روزانه = این عدد ÷ ۳۰' },
  { key: 'housing_monthly', label: 'حق مسکن ماهانه سال (ریال)', hint: 'مبنای پیش‌فرض حق مسکن برای احکامی که مبلغ ندارند' },
  { key: 'worker_ben_monthly', label: 'بن خواروبار ماهانه سال (ریال)', hint: 'مبنای پیش‌فرض بن کارگری' },
  { key: 'family_allowance_monthly', label: 'حق عائله‌مندی (متأهل) ماهانه سال (ریال)', hint: 'فقط به افراد متأهل تعلق می‌گیرد' },
  { key: 'child_allowance_monthly', label: 'حق اولاد — هر فرزند، ماهانه سال (ریال)', hint: 'در محاسبه × تعداد فرزند مندرج در پرونده پرسنل' },
  { key: 'daily_divisor_days', label: 'مقسوم‌علیه مزد روزانه (روز)', hint: 'مزد روزانه = مزد ماهانه ÷ ۳۰' },
  { key: 'hourly_divisor_hours', label: 'مقسوم‌علیه مزد ساعتی (ساعت)', hint: 'مزد ساعتی = مزد روزانه ÷ ۷.۳۳ (معادل ماده ۵۹: ۱/۲۲۰ مزد ماهانه)' },
  { key: 'sso_worker_rate', label: 'بیمه سهم کارگر (٪)' },
  { key: 'sso_employer_rate', label: 'بیمه سهم کارفرما (٪)' },
  { key: 'sso_unemployment_rate', label: 'بیمه بیکاری (٪)' },
  { key: 'sso_ceiling_30d', label: 'سقف حقوق مشمول بیمه — ماه ۳۰ روزه (ریال)' },
  { key: 'sso_ceiling_31d', label: 'سقف حقوق مشمول بیمه — ماه ۳۱ روزه (ریال)' },
  { key: 'm84_monthly_exemption', label: 'معافیت ماهانه مالیات حقوق — ماده ۸۴ (ریال)' },
  { key: 'late_grace_minutes', label: 'زمان تاخیر مجاز (دقیقه)', hint: 'تا این تعداد دقیقه، تاخیر محسوب نمی‌شود' },
  { key: 'early_grace_minutes', label: 'زمان تعجیل مجاز (دقیقه)', hint: 'تا این تعداد دقیقه، تعجیل محسوب نمی‌شود' },
];


// ---------------- تب جدول مشاغل تامین اجتماعی (مورد ۴ و ۹ نسخه ۱٫۴٫۳) ----------------
function JobsSection() {
  const { toast } = useToastShim();
  const [count, setCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadCount = useCallback(async () => {
    try {
      const d = await apiGet<{ titles: Array<{ title: string; code: string; source?: string }>; customCount: number }>('/api/job-titles');
      setCount(d.customCount);
    } catch { setCount(null); }
  }, []);
  useEffect(() => { void loadCount(); }, [loadCount]);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/job-titles', { method: 'PUT', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'خطا در بارگزاری');
      toast.success(d.message || 'جدول مشاغل بارگزاری شد');
      void loadCount();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const reset = async () => {
    if (!confirm('فهرست بارگزاری‌شده حذف و فهرست داخلی برنامه جایگزین شود؟')) return;
    try {
      const d = await apiDelete<{ message: string }>('/api/job-titles');
      toast.success(d.message);
      void loadCount();
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        جدول مشاغل بیمه تامین اجتماعی هر سال اعلام می‌شود. فایل جدید (xlsx، xls، csv، md یا txt) را بارگزاری کنید تا
        <b> به‌طور کامل جایگزین</b> فهرست قبلی شود؛ بدون هیچ اخلالی در داده‌های پرسنل — عنوان و کد شغل از فایل خوانده و
        در انتخاب شغل پرسنل و فایل‌های استاندارد بیمه استفاده می‌شود. کد شغل می‌تواند حرف‌وعددی باشد (مثل 2035AG).
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.md,.txt,.tsv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
        />
        <Button size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> {uploading ? 'در حال پردازش…' : 'بارگزاری فایل جدول مشاغل'}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
          <RotateCcw size={15} /> بازگشت به فهرست داخلی
        </Button>
        <span className="text-[12px] text-muted-foreground">
          {count !== null && count > 0 ? `${toPersianDigits(String(count))} عنوان از فایل بارگزاری‌شده فعال است` : 'فعلاً فهرست داخلی برنامه ملاک است'}
        </span>
      </div>
    </div>
  );
}

/** استفاده از toast بدون وابستگی مستقیم برای حفظ الگوی ماژول */
function useToastShim() {
  return { toast: { success: (m: string) => import('sonner').then(({ toast }) => toast.success(m)), error: (m: string) => import('sonner').then(({ toast }) => toast.error(m)) } };
}


// ---------------- سربرگ شرکت (مورد ۱۲ نسخه ۱٫۴٫۳) ----------------
function LetterheadSection() {
  const [current, setCurrent] = useState<string>('');
  const [isDefault, setIsDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ dataUrl: string; isDefault: boolean }>('/api/letterhead');
      setCurrent(d.dataUrl); setIsDefault(d.isDefault);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (f: File) => {
    setBusy(true);
    try {
      if (f.size > 3 * 1024 * 1024) throw new Error('حجم تصویر سربرگ نباید بیش از ۳ مگابایت باشد');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('خواندن فایل ناموفق بود'));
        r.readAsDataURL(f);
      });
      const d = await apiPut<{ message: string }>('/api/letterhead', { dataUrl });
      toast.success(d.message);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const reset = async () => {
    try {
      const d = await apiDelete<{ message: string }>('/api/letterhead');
      toast.success(d.message); await load();
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        تصویر سربرگ شرکت (PNG یا JPG) در چاپ <b>قرارداد کار</b> و <b>احکام پرسنلی</b> — خروجی چاپ/PDF و Word — در بالای هر سند درج می‌شود.
        سربرگ پیش‌فرض برنامه بارگزاری شده است؛ با بارگزاری فایل جدید جایگزین می‌شود.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {current && (
          <img src={current} alt="سربرگ فعلی" className="h-24 rounded border border-border/60 object-cover object-top" style={{ width: 260 }} />
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void save(f); }} />
        <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus size={15} /> {busy ? 'در حال ذخیره…' : 'بارگزاری سربرگ جدید'}
        </Button>
        {!isDefault && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
            <RotateCcw size={15} /> بازگشت به سربرگ پیش‌فرض
          </Button>
        )}
        <span className="text-[12px] text-muted-foreground">{isDefault ? 'سربرگ پیش‌فرض برنامه فعال است' : 'سربرگ شخصی‌سازی‌شده فعال است'}</span>
      </div>
    </div>
  );
}

const KIND_LABELS: Record<string, { label: string; cls: string }> = {
  earning: { label: 'درآمد', cls: 'bg-success/10 text-success' },
  deduction: { label: 'کسر', cls: 'bg-destructive/10 text-destructive' },
  employer: { label: 'کارفرما', cls: 'bg-gold/10 text-gold' },
};

/** ردیف پله مالیاتی یا ردیف «جدید» در حال درج */
type BracketRowOrNew = BracketRow | 'new';
const isBracket = (r: BracketRowOrNew): r is BracketRow => r !== 'new';

export default function SettingsModule() {
  const { company, fy, refreshContext } = useApp();

  // پارامترها
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // پله‌های مالیاتی
  const [brackets, setBrackets] = useState<BracketRow[]>([]);
  const [loadingBrackets, setLoadingBrackets] = useState(true);
  const [editingBracket, setEditingBracket] = useState<BracketRow | 'new' | null>(null);
  const [bSeq, setBSeq] = useState('');
  const [bFrom, setBFrom] = useState('');
  const [bTo, setBTo] = useState('');
  const [bRate, setBRate] = useState('');

  // اقلام فیش
  const [items, setItems] = useState<ItemRow[]>([]);
  const [formulas, setFormulas] = useState<Array<{ key: string; title: string }>>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // نسخه پشتیبان
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [busyBackup, setBusyBackup] = useState<string | null>(null);
  const [createdBackupName, setCreatedBackupName] = useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!fy) return;
    setLoadingSettings(true);
    try {
      const data = await apiGet<{ settings: Record<string, string> }>(`/api/settings?fyId=${fy.id}`);
      setSettings(data.settings);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingSettings(false);
    }
  }, [fy]);

  const loadBrackets = useCallback(async () => {
    if (!fy) return;
    setLoadingBrackets(true);
    try {
      const data = await apiGet<{ brackets: BracketRow[] }>(`/api/settings/tax-brackets?fyId=${fy.id}`);
      setBrackets(data.brackets);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingBrackets(false);
    }
  }, [fy]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const data = await apiGet<{ items: ItemRow[]; availableFormulas: Array<{ key: string; title: string }> }>(
        '/api/settings/payroll-items',
      );
      setItems(data.items);
      setFormulas(data.availableFormulas);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const data = await apiGet<{ backups: BackupRow[] }>('/api/backup');
      setBackups(data.backups);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadBrackets(); }, [loadBrackets]);
  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadBackups(); }, [loadBackups]);

  const saveSettings = async () => {
    if (!fy) return;
    setSavingSettings(true);
    try {
      await apiPut('/api/settings', { fyId: fy.id, settings });
      toast.success('پارامترهای سال مالی ذخیره شد');
      await refreshContext();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  // ---------- پله‌های مالیاتی ----------
  // ردیف درج پله جدید (در صورت باز بودن فرم) بالای جدول نمایش داده می‌شود
  const bracketRows: BracketRowOrNew[] = editingBracket === 'new' ? ['new', ...brackets] : brackets;
  const isBracketEditing = (r: BracketRowOrNew) =>
    isBracket(r) && editingBracket !== null && editingBracket !== 'new' && editingBracket.id === r.id;
  // پس‌زمینه ردیف در حال درج/ویرایش (جبران padding سلول‌ها)
  const bracketTint = (r: BracketRowOrNew, node: React.ReactNode) =>
    r === 'new' || isBracketEditing(r) ? <div className="bg-primary/5 -m-2 p-2">{node}</div> : node;

  const bracketCols: DtColumn<BracketRowOrNew>[] = [
    {
      key: 'seq', header: 'seq', align: 'center', className: 'num', headerClassName: 'w-14',
      sortValue: (r) => (isBracket(r) ? r.seq : -1),
      cell: (r) =>
        bracketTint(
          r,
          r === 'new' || isBracketEditing(r) ? (
            <Input className="num h-8 text-center" value={bSeq} onChange={(e) => setBSeq(normalizeDigits(e.target.value))} />
          ) : (
            <Fa>{r.seq}</Fa>
          ),
        ),
    },
    {
      key: 'fromAmount', header: 'از مبلغ (ریال)', className: 'num',
      sortValue: (r) => (isBracket(r) ? r.fromAmount : 0),
      cell: (r) =>
        bracketTint(
          r,
          r === 'new' || isBracketEditing(r) ? (
            <Input className="num h-8" value={bFrom} onChange={(e) => setBFrom(normalizeDigits(e.target.value))} />
          ) : (
            formatMoney(r.fromAmount)
          ),
        ),
    },
    {
      key: 'toAmount', header: 'تا مبلغ (ریال)', className: 'num',
      sortValue: (r) => (isBracket(r) ? (r.toAmount === null ? Number.MAX_SAFE_INTEGER : r.toAmount) : 0),
      cell: (r) =>
        bracketTint(
          r,
          r === 'new' || isBracketEditing(r) ? (
            <Input className="num h-8" value={bTo} onChange={(e) => setBTo(normalizeDigits(e.target.value))} placeholder="خالی = بی‌نهایت" />
          ) : r.toAmount === null ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <InfinityIcon size={14} /> بی‌نهایت
            </span>
          ) : (
            formatMoney(r.toAmount)
          ),
        ),
    },
    {
      key: 'ratePercent', header: 'نرخ (٪)', align: 'center', className: 'num font-bold text-primary',
      sortValue: (r) => (isBracket(r) ? r.ratePercent : 0),
      cell: (r) =>
        bracketTint(
          r,
          r === 'new' || isBracketEditing(r) ? (
            <Input className="num h-8 text-center" value={bRate} onChange={(e) => setBRate(normalizeDigits(e.target.value))} />
          ) : (
            <>
              {toPersianDigits(String(r.ratePercent))}٪
            </>
          ),
        ),
    },
    {
      key: 'ops', header: 'عملیات', align: 'left', noSort: true, noFilter: true, headerClassName: 'w-28',
      cell: (r) =>
        bracketTint(
          r,
          r === 'new' || isBracketEditing(r) ? (
            <div className="flex justify-end gap-1">
              <Button size="sm" className="h-8 px-2.5" onClick={saveBracket}>ذخیره</Button>
              <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => setEditingBracket(null)}>لغو</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBracketEdit(r)} title="ویرایش">
                <Pencil size={14} />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => deleteBracket(r)} title="حذف"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ),
        ),
    },
  ];

  // ---------- اقلام فیش ----------
  const updateItem = (code: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it) => (it.code === code ? { ...it, ...patch } : it)));
  };
  const saveItem = async (it: ItemRow) => {
    try {
      await apiPut('/api/settings/payroll-items', it);
      toast.success(`قلم «${it.title}» ذخیره شد`);
      await loadItems();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // اقلام غیرفعال کم‌رنگ نمایش داده می‌شوند (جایگزین کلاس opacity سطر)
  const itemDim = (it: ItemRow, node: React.ReactNode) =>
    it.active ? node : <span className="opacity-60 block">{node}</span>;

  const itemCols: DtColumn<ItemRow>[] = [
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'code', header: 'کد',
      cell: (it) => itemDim(it, <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]" dir="ltr">{it.code}</code>),
    },
    {
      key: 'title', header: 'عنوان', headerClassName: 'min-w-44',
      cell: (it) => itemDim(
        it,
        <Input
          className="h-8 text-[12.5px]"
          value={it.title}
          onChange={(e) => updateItem(it.code, { title: e.target.value })}
          disabled={false}
        />,
      ),
    },
    {
      key: 'kind', header: 'نوع', align: 'center',
      filterValue: (it) => KIND_LABELS[it.kind]?.label ?? it.kind,
      cell: (it) => itemDim(
        it,
        <Badge className={KIND_LABELS[it.kind]?.cls ?? 'bg-muted text-muted-foreground'}>
          {KIND_LABELS[it.kind]?.label ?? it.kind}
        </Badge>,
      ),
    },
    {
      key: 'formulaKey', header: 'فرمول محاسبه', headerClassName: 'min-w-64',
      cell: (it) => itemDim(
        it,
        <Select value={it.formulaKey} onValueChange={(v) => updateItem(it.code, { formulaKey: v })}>
          <SelectTrigger className="h-8 text-[11.5px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-64">
            {formulas.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                <span dir="ltr" className="inline-block">{f.key}</span> — {f.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      ),
    },
    {
      key: 'insured', header: 'مشمول بیمه', align: 'center',
      sortValue: (it) => (it.insured ? 1 : 0), filterValue: (it) => (it.insured ? 'بله' : 'خیر'),
      cell: (it) => itemDim(
        it,
        <Switch
          checked={it.insured}
          onCheckedChange={(v) => updateItem(it.code, { insured: v })}
          aria-label={`مشمول بیمه ${it.title}`}
        />,
      ),
    },
    {
      key: 'active', header: 'فعال', align: 'center',
      sortValue: (it) => (it.active ? 1 : 0), filterValue: (it) => (it.active ? 'بله' : 'خیر'),
      cell: (it) => (
        <Switch
          checked={it.active}
          onCheckedChange={(v) => updateItem(it.code, { active: v })}
          aria-label={`فعال بودن ${it.title}`}
        />
      ),
    },
    {
      key: 'systemLocked', header: 'قفل', align: 'center',
      sortValue: (it) => (it.systemLocked ? 1 : 0),
      filterValue: (it) => (it.systemLocked ? 'سیستمی' : '—'),
      cell: (it) => itemDim(
        it,
        it.systemLocked ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="این قلم سیستمی است و کد آن قابل تغییر نیست">
            <Lock size={13} /> سیستمی
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        ),
      ),
    },
    {
      key: 'ops', header: 'عملیات', align: 'left', noSort: true, noFilter: true, headerClassName: 'w-20',
      cell: (it) => itemDim(
        it,
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-[12px]" onClick={() => saveItem(it)}>
            <Save size={13} /> ذخیره
          </Button>
        </div>,
      ),
    },
  ];
  // ---------- پله‌های مالیاتی (هندلرها) ----------
  // eslint-disable-next-line -- تعریف ستون‌ها در ابتدای کامپوننت انجام شده است
  const openBracketNew = () => {
    setEditingBracket('new');
    setBSeq(String(brackets.length + 1));
    setBFrom('');
    setBTo('');
    setBRate('');
  };
  const openBracketEdit = (b: BracketRow) => {
    setEditingBracket(b);
    setBSeq(String(b.seq));
    setBFrom(b.fromAmount ? String(b.fromAmount) : '');
    setBTo(b.toAmount === null ? '' : String(b.toAmount));
    setBRate(String(b.ratePercent));
  };
  const saveBracket = async () => {
    if (!fy) return;
    const seq = parseIntOr(bSeq, 0);
    const rate = parseNumberOr(bRate, -1);
    if (!seq) { toast.error('شماره ردیف (seq) الزامی است'); return; }
    if (rate < 0) { toast.error('نرخ مالیات را وارد کنید'); return; }
    const payload = {
      fyId: fy.id,
      seq,
      fromAmount: parseNumberOr(bFrom, 0),
      toAmount: normalizeDigits(bTo).trim() === '' ? null : parseNumberOr(bTo, 0),
      ratePercent: rate,
    };
    try {
      if (editingBracket === 'new') {
        await apiPost('/api/settings/tax-brackets', payload);
        toast.success('پله مالیاتی اضافه شد');
      } else if (editingBracket) {
        await apiPut('/api/settings/tax-brackets', { id: editingBracket.id, ...payload });
        toast.success('پله مالیاتی ویرایش شد');
      }
      setEditingBracket(null);
      await loadBrackets();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const deleteBracket = async (b: BracketRow) => {
    try {
      await apiDelete(`/api/settings/tax-brackets?id=${b.id}`);
      toast.success('پله مالیاتی حذف شد');
      await loadBrackets();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ---------- نسخه پشتیبان (هندلرها) ----------
  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      const data = await apiPost<{ ok: boolean; name: string; backups: BackupRow[] }>('/api/backup', { action: 'create' });
      setBackups(data.backups);
      setCreatedBackupName(data.name);
      setRestoreNotice(false);
      toast.success(`نسخه پشتیبان «${data.name}» تهیه شد`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const restoreBackup = async (b: BackupRow) => {
    const ok = window.confirm(
      `با بازگردانی نسخه «${b.name}» تمام داده‌های فعلی جایگزین می‌شود و این عمل قابل بازگشت نیست. پس از بازگردانی، برنامه باید بسته و دوباره اجرا شود. ادامه می‌دهید؟`,
    );
    if (!ok) return;
    setBusyBackup(b.name);
    try {
      const data = await apiPost<{ ok: boolean; needsRestart: boolean }>('/api/backup', { action: 'restore', name: b.name });
      if (data.needsRestart) setRestoreNotice(true);
      toast.success('بازگردانی انجام شد');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyBackup(null);
    }
  };

  const deleteBackup = async (b: BackupRow) => {
    const ok = window.confirm(`نسخه پشتیبان «${b.name}» برای همیشه حذف شود؟`);
    if (!ok) return;
    setBusyBackup(b.name);
    try {
      const data = await apiDelete<{ ok: boolean; backups: BackupRow[] }>(`/api/backup?name=${encodeURIComponent(b.name)}`);
      setBackups(data.backups);
      toast.success('نسخه پشتیبان حذف شد');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyBackup(null);
    }
  };

  // ---------- اقلام فیش ----------
  // ---------- اقلام فیش (تعریف بالا انجام شده) ----------

  if (!company || !fy) {
    return (
      <div>
        <PageHeader title="تنظیمات" icon={<Settings size={20} />} />
        <Card>
          <EmptyState
            title="ابتدا شرکت و سال مالی را ثبت کنید"
            hint="تنظیمات برای هر سال مالی به‌صورت جداگانه نگهداری می‌شود"
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="تنظیمات"
        subtitle={`${company.name} — سال مالی ${toPersianDigits(fy.jy)}`}
        icon={<Settings size={20} />}
      />

      <Card className="shadow-luxe border-border/70 p-5">
        <Tabs defaultValue="params" dir="rtl">
          <TabsList className="mb-4">
            <TabsTrigger value="params" className="gap-1.5">
              <Settings size={14} /> پارامترهای سال مالی
            </TabsTrigger>
            <TabsTrigger value="brackets" className="gap-1.5">
              <Percent size={14} /> پله‌های مالیاتی
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-1.5">
              <ReceiptText size={14} /> اقلام فیش
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1.5">
              <Briefcase size={14} /> جدول مشاغل
            </TabsTrigger>
            <TabsTrigger value="letterhead" className="gap-1.5">
              <ImagePlus size={14} /> سربرگ
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5">
              <Palette size={14} /> ظاهر برنامه
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5">
              <Sparkles size={14} /> هوش مصنوعی
            </TabsTrigger>
          </TabsList>

          {/* تب پارامترها */}
          <TabsContent value="params" className="mt-0">
            {loadingSettings ? (
              <LoadingBlock rows={6} />
            ) : (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
                  {SETTING_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label className="text-[12.5px]">{f.label}</Label>
                      <Input
                        className="num"
                        value={settings[f.key] ?? ''}
                        onChange={(e) => setSettings({ ...settings, [f.key]: normalizeDigits(e.target.value) })}
                      />
                      {f.hint && <p className="text-[10.5px] text-muted-foreground">{f.hint}</p>}
                    </div>
                  ))}
                </div>

                {/* جدول ساعات موظفی سالانه — مورد ۱۰ نسخه ۱٫۴٫۳ */}
                <div className="mt-6 rounded-lg border border-border/60 p-4">
                  <p className="text-[13px] font-bold mb-1.5">جدول ساعات موظفی سالانه (اعلان اداره کار)</p>
                  <p className="text-[11px] text-muted-foreground mb-3">ساعات موظفی هر ماه را جداگانه وارد کنید؛ اگر خالی بماند، «ساعات موظفی ماه» عمومی ملاک است. ساعات مرخصی و کارکرد هر ماه از همین جدول خوانده می‌شود.</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {MONTH_NAMES.map((mn, idx) => (
                      <div key={mn} className="space-y-1">
                        <Label className="text-[11.5px]">{mn}</Label>
                        <Input
                          className="num h-8 text-[12px]"
                          placeholder={settings['monthly_required_hours'] || '۱۷۶'}
                          value={settings[`required_hours_m${idx + 1}`] ?? ''}
                          onChange={(e) => setSettings({ ...settings, [`required_hours_m${idx + 1}`]: normalizeDigits(e.target.value) })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <Button onClick={saveSettings} disabled={savingSettings} className="gap-1.5 min-w-32">
                    <Save size={15} /> {savingSettings ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* تب جدول مشاغل */}
          <TabsContent value="jobs" className="mt-0">
            <JobsSection />
          </TabsContent>

          {/* تب سربرگ */}
          <TabsContent value="letterhead" className="mt-0">
            <LetterheadSection />
          </TabsContent>

          {/* تب ظاهر */}
          <TabsContent value="appearance" className="mt-0">
            <AppearanceSection />
          </TabsContent>

          {/* تب هوش مصنوعی */}
          <TabsContent value="ai" className="mt-0">
            <AiSettingsSection />
          </TabsContent>

          {/* تب پله‌های مالیاتی */}
          <TabsContent value="brackets" className="mt-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-muted-foreground">
                پله‌های مالیات حقوق سال {toPersianDigits(fy.jy)} — مبالغ سالانه به ریال
              </p>
              <Button size="sm" className="gap-1.5" onClick={openBracketNew}>
                <Plus size={15} /> افزودن پله
              </Button>
            </div>
            {loadingBrackets ? (
              <LoadingBlock rows={5} />
            ) : (
              <DataTable
                id="settings-tax"
                columns={bracketCols}
                rows={bracketRows}
                rowKey={(r) => (isBracket(r) ? r.id : 'new')}
              />
            )}
          </TabsContent>

          {/* تب اقلام فیش */}
          <TabsContent value="items" className="mt-0">
            <p className="text-[13px] text-muted-foreground mb-3">
              اقلام فیش حقوقی — عنوان، فرمول محاسبه، مشمولیت بیمه و فعال بودن هر قلم قابل ویرایش است. کد و وضعیت سیستمی اقلام پیش‌فرض ثابت است.
            </p>
            {loadingItems ? (
              <LoadingBlock rows={8} />
            ) : (
              <DataTable
                id="settings-items"
                columns={itemCols}
                rows={items}
                rowKey={(it) => it.code}
                containerClassName="max-h-[62vh]"
              />
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* نسخه پشتیبان و بازگردانی */}
      <Card className="shadow-luxe border-border/70 p-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <DatabaseBackup size={17} className="text-primary" /> نسخه پشتیبان و بازگردانی
          </h2>
          <Button size="sm" className="gap-1.5" onClick={createBackup} disabled={creatingBackup}>
            <Archive size={15} /> {creatingBackup ? 'در حال تهیه…' : 'تهیه نسخه پشتیبان'}
          </Button>
        </div>

        {restoreNotice && (
          <div className="mb-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-2.5 text-[13px] font-medium text-gold flex items-center gap-2">
            <RotateCcw size={15} className="shrink-0" />
            بازگردانی انجام شد — برای اعمال تغییرات، برنامه را ببندید و دوباره اجرا کنید
          </div>
        )}

        {createdBackupName && !restoreNotice && (
          <div className="mb-3 rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-[13px] text-success">
            نسخه پشتیبان «{createdBackupName}» با موفقیت تهیه شد.
          </div>
        )}

        {loadingBackups ? (
          <LoadingBlock rows={4} />
        ) : backups.length === 0 ? (
          <EmptyState
            title="هنوز نسخه پشتیبانی تهیه نشده است"
            hint="برای حفاظت از داده‌ها، به‌طور دوره‌ای نسخه پشتیبان تهیه کنید"
          />
        ) : (
          <div className="rounded-lg border border-border/70 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 text-right font-medium">نام فایل</th>
                  <th className="px-3 py-2 text-right font-medium">حجم</th>
                  <th className="px-3 py-2 text-right font-medium">تاریخ ایجاد</th>
                  <th className="px-3 py-2 text-left font-medium w-36">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.name} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]" dir="ltr">{b.name}</code>
                        {b.preRestore && (
                          <Badge className="bg-gold/10 text-gold">پشتیبان قبل از بازگردانی</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 num">{formatSize(b.size)}</td>
                    <td className="px-3 py-2">{new Date(b.mtime).toLocaleString('fa-IR')}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost" size="sm" className="h-8 gap-1 text-[12px]"
                          disabled={busyBackup !== null}
                          onClick={() => restoreBackup(b)} title="بازگردانی"
                        >
                          <RotateCcw size={13} /> {busyBackup === b.name ? 'در حال بازگردانی…' : 'بازگردانی'}
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={busyBackup !== null}
                          onClick={() => deleteBackup(b)} title="حذف"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------
// تب ظاهر — تصویر پس‌زمینه، تاریکی پوشش و رنگ نوشته‌های سایدبار (ذخیره در تم پویا)
// ------------------------------------------------------------------
function AppearanceSection() {
  const theme = usePayrollTheme();
  const { config, update } = theme;
  const [bgNote, setBgNote] = useState('');
  const bgFileRef = useRef<HTMLInputElement | null>(null);

  // انتخاب تصویر پس‌زمینه — کوچک‌سازی تا حداکثر ~۱۹۲۰ پیکسل با canvas و ذخیره به‌صورت data URL
  const pickBgImage = useCallback(async (file: File) => {
    setBgNote('');
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('load'));
        img.src = url;
      });
      const max = 1920;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const g = canvas.getContext('2d');
      if (!g) throw new Error('canvas');
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL('image/jpeg', 0.82);
      if (data.length >= 4_500_000) {
        setBgNote('تصویر خیلی بزرگ است؛ تصویر کوچک‌تری انتخاب کنید.');
        return;
      }
      update({ bgImage: data });
      setBgNote('تصویر پس‌زمینه اعمال شد.');
    } catch {
      setBgNote('خواندن تصویر ممکن نشد؛ فایل دیگری انتخاب کنید.');
    }
  }, [update]);

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted-foreground">
        شخصی‌سازی ظاهر برنامه — تغییرات زنده است و در مرورگر ذخیره می‌شود؛ هیچ دادهٔ حقوقی تغییر نمی‌کند.
      </p>

      {/* تصویر پس‌زمینه */}
      <div className="rounded-xl border border-border/70 p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-[14px] font-bold">
          <ImagePlus size={16} className="text-primary" /> تصویر پس‌زمینه
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => bgFileRef.current?.click()}>
            <ImagePlus size={14} /> انتخاب تصویر پس‌زمینه
          </Button>
          {config.bgImage && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => { update({ bgImage: '' }); setBgNote('تصویر پس‌زمینه حذف شد.'); }}>
              <Trash2 size={14} /> حذف تصویر
            </Button>
          )}
        </div>
        <input
          ref={bgFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pickBgImage(file);
            e.target.value = '';
          }}
        />
        {config.bgImage ? (
          <div className="space-y-1.5 max-w-md">
            <div className="flex items-center justify-between">
              <Label className="text-[12.5px]">تاریکی پوشش روی تصویر</Label>
              <span className="num text-[12px] text-muted-foreground">{toPersianDigits(config.bgDim)}٪</span>
            </div>
            <input
              type="range"
              min={0}
              max={85}
              step={5}
              value={config.bgDim}
              className="w-full accent-[var(--primary)]"
              onChange={(e) => update({ bgDim: Number(e.target.value) })}
            />
          </div>
        ) : (
          <p className="text-[10.5px] text-muted-foreground">تصویر به‌صورت پس‌زمینه ثابت زیر محتوا نمایش داده می‌شود؛ تصاویر بزرگ خودکار کوچک می‌شوند.</p>
        )}
        {bgNote && <p className="text-[11px] text-muted-foreground">{bgNote}</p>}
      </div>

      {/* رنگ نوشته‌های سایدبار */}
      <div className="rounded-xl border border-border/70 p-4 space-y-3">
        <h3 className="flex items-center gap-2 text-[14px] font-bold">
          <Palette size={16} className="text-primary" /> رنگ نوشته‌های سایدبار
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            aria-label="رنگ نوشته‌های سایدبار"
            className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
            value={config.sidebarText || '#eaf2ff'}
            onChange={(e) => update({ sidebarText: e.target.value })}
          />
          <span className="text-[12px] text-muted-foreground" dir="ltr">
            {config.sidebarText || 'پیش‌فرض تم'}
          </span>
          {config.sidebarText && (
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => update({ sidebarText: '' })}>
              <RotateCcw size={14} /> بازگشت به رنگ پیش‌فرض تم
            </Button>
          )}
        </div>
        <p className="text-[10.5px] text-muted-foreground">رنگ‌های هاور و کمرنگ منو به‌صورت خودکار از همین رنگ ساخته می‌شوند.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// تب هوش مصنوعی — پارامترهای دستیار هوشمند و مدل Ollama محلی (نسخه ۱.۴)
// ------------------------------------------------------------------
interface AiCfg {
  enabled: boolean; model: string; timeoutMs: number; numCtx: number; numPredict: number;
  temperature: number; topP: number; minSourceConfidence: number;
  reachable: boolean; allowed: boolean; reason: string; recommended: string | null;
  ram: { totalGB: number; freeGB: number; tier: string } | null;
}

function AiSettingsSection() {
  const [cfg, setCfg] = useState<AiCfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<AiCfg>('/api/ai/config');
      setCfg(d);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const d = await apiPost<{ config: AiCfg; status: AiCfg }>('/api/ai/config', {
        enabled: cfg.enabled, model: cfg.model, timeoutMs: cfg.timeoutMs, numCtx: cfg.numCtx,
        numPredict: cfg.numPredict, temperature: cfg.temperature, topP: cfg.topP,
        minSourceConfidence: cfg.minSourceConfidence,
      });
      toast.success('تنظیمات هوش مصنوعی ذخیره شد');
      setCfg({ ...d.status, ...d.config });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock rows={5} />;
  if (!cfg) return <p className="text-sm text-muted-foreground py-4">تنظیمات هوش مصنوعی بارگذاری نشد.</p>;

  const numField = (label: string, key: keyof AiCfg, min: number, max: number, step: number, hint: string) => (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      <Input
        className="num"
        value={String(cfg[key] ?? '')}
        onChange={(e) => {
          const v = parseNumberOr(e.target.value, Number(cfg[key]));
          setCfg({ ...cfg, [key]: Math.min(max, Math.max(min, v)) } as AiCfg);
        }}
      />
      <p className="text-[10.5px] text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <Cpu className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-[12.5px] leading-6">
          <p className="font-semibold mb-1">دو لایه هوش مصنوعی برنامه</p>
          <p className="text-muted-foreground">
            لایه ۱ — موتور درونی آفلاین: پرسش‌وپاسخ از داده‌ها، تحلیل ناهنجاری‌ها، روند و پیش‌بینی (داشبورد) — همیشه فعال و بدون نیاز به اینترنت.
            لایه ۲ — مدل Ollama محلی (اختیاری): اگر روی سیستم شما Ollama نصب باشد، دستیار چت پاسخ‌های زبانی بهتری می‌دهد.
          </p>
          <p className="mt-1.5">
            وضعیت: {cfg.enabled ? (cfg.reachable ? 'مدل محلی متصل است ✓' : 'فعال ولی Ollama در دسترس نیست (پاسخ از موتور درونی)') : 'فقط موتور درونی آفلاین'}
            {cfg.ram ? ` — رم: ${toPersianDigits(cfg.ram.freeGB.toFixed(1))} آزاد از ${toPersianDigits(cfg.ram.totalGB.toFixed(1))} گیگابایت` : ''}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">فعال‌سازی مدل محلی (Ollama)</Label>
          <div className="flex items-center gap-2 h-9">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
            <span className="text-[12px] text-muted-foreground">{cfg.enabled ? 'فعال' : 'غیرفعال'}</span>
          </div>
          <p className="text-[10.5px] text-muted-foreground">در صورت نبود Ollama یا کمبود رم، برنامه خودکار از موتور درونی استفاده می‌کند.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">نام مدل</Label>
          <Input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} placeholder="qwen2.5:0.5b-instruct-q4_K_M" />
          <p className="text-[10.5px] text-muted-foreground">مدل پیشنهادی برای این سیستم: {cfg.recommended ?? '—'}</p>
        </div>
        {numField('مهلت پاسخ مدل (میلی‌ثانیه)', 'timeoutMs', 2000, 60000, 500, '۲۰۰۰ تا ۶۰۰۰۰ — بعد از این مهلت، پاسخ از موتور درونی می‌آید')}
        {numField('طول زمینه (num_ctx)', 'numCtx', 512, 4096, 128, '۵۱۲ تا ۴۰۹۶ توکن — زمینه داده‌ای ارسالی به مدل')}
        {numField('طول پاسخ (num_predict)', 'numPredict', 64, 1024, 32, '۶۴ تا ۱۰۲۴ توکن — حداکثر طول پاسخ مدل')}
        {numField('دمای مدل (temperature)', 'temperature', 0, 1, 0.05, '۰ تا ۱ — کمتر = دقیق‌تر و کم‌خلاق‌تر (پیشنهادی ۰.۲ برای داده مالی)')}
        {numField('top_p مدل', 'topP', 0.1, 1, 0.05, '۰.۱ تا ۱ — تنظیم نمونه‌گیری مدل زبانی')}
        {numField('حد اطمینان منابع راهنما', 'minSourceConfidence', 0, 1, 0.05, '۰ تا ۱ — منابع راهنمای با اطمینان بالاتر از این مقدار نمایش داده می‌شوند')}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-1.5 min-w-32">
          <Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات هوش مصنوعی'}
        </Button>
      </div>
    </div>
  );
}
