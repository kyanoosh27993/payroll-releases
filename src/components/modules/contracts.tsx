'use client';
// ماژول قرارداد و احکام — مدیریت قراردادها و احکام پرسنلی پرسنل شرکت فعال
import { JalaliDateInput } from '@/components/jalali-date-input';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileSignature, ScrollText, Plus, Pencil, Trash2, Save, Info, Printer, FileDown } from 'lucide-react';
import { useApp } from '@/components/app-state';
import { consumeFocusPersonnel } from '@/lib/core/nav-focus';
import { PageHeader, EmptyState, LoadingBlock, Fa } from '@/components/shared';
import { apiGet, apiPost, apiPut, apiDelete, openPrintWindow } from '@/lib/api-client';
import { normalizeDigits, toPersianDigits, formatMoney } from '@/lib/core/numbers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTable, type DtColumn } from '@/components/data-table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PersonLite { id: number; personnelCode: string; firstName: string; lastName: string }

interface ContractRow {
  id: number; personnelId: number; contractType: string; hourlyRate: number; dailyRate: number;
  monthlyWage: number; projectAmount: number; startDate: string; endDate: string;
  payCycle: string; insuranceRequired: boolean; notes: string;
  docKind: string; periodKey: string; isValid: boolean;
}

interface DecreeRow {
  id: number; personnelId: number; effectiveDate: string; jobWage: number; seniorityWage: number;
  childAllowance: number; housing: number; food: number; adjustmentDiff: number; supervision: number;
  educationAid: number; laborMarket: number; attractionPercent: number; attractionAmount: number;
  otherBenefits: number; workerBen: number; fixedOvertime: number; familyAllowance: number;
  shiftAllowance: number; notes: string;
}

const CONTRACT_TYPES = ['ماهانه ثابت', 'ساعتی', 'روزانه', 'پیمانی', 'سایر'];
const PAY_CYCLES = ['ماهانه', 'هفتگی', 'دو هفته', 'روزانه'];

interface CForm {
  contractType: string; hourlyRate: string; dailyRate: string; monthlyWage: string;
  projectAmount: string; startDate: string; endDate: string; payCycle: string;
  insuranceRequired: boolean; notes: string;
}
const EMPTY_CONTRACT: CForm = {
  contractType: 'ماهانه ثابت', hourlyRate: '', dailyRate: '', monthlyWage: '',
  projectAmount: '', startDate: '', endDate: '', payCycle: 'ماهانه', insuranceRequired: true, notes: '',
};

interface DForm {
  effectiveDate: string; jobWage: string; seniorityWage: string; childAllowance: string;
  housing: string; food: string; adjustmentDiff: string; supervision: string; educationAid: string;
  laborMarket: string; attractionPercent: string; attractionAmount: string; otherBenefits: string;
  workerBen: string; fixedOvertime: string; familyAllowance: string; shiftAllowance: string; notes: string;
}
const EMPTY_DECREE: DForm = {
  effectiveDate: '', jobWage: '', seniorityWage: '', childAllowance: '', housing: '', food: '',
  adjustmentDiff: '', supervision: '', educationAid: '', laborMarket: '', attractionPercent: '',
  attractionAmount: '', otherBenefits: '', workerBen: '', fixedOvertime: '', familyAllowance: '',
  shiftAllowance: '', notes: '',
};

const DECREE_FIELDS: Array<{ key: keyof DForm; label: string }> = [
  { key: 'effectiveDate', label: 'تاریخ اجرا *' },
  { key: 'jobWage', label: 'مزد شغل (حقوق پایه)' },
  { key: 'seniorityWage', label: 'مزد سنوات' },
  { key: 'housing', label: 'حق مسکن' },
  { key: 'food', label: 'خواروبار' },
  { key: 'childAllowance', label: 'حق اولاد' },
  { key: 'familyAllowance', label: 'حق عائله‌مندی' },
  { key: 'workerBen', label: 'بن کارگری (خواروبار کارگری)' },
  { key: 'shiftAllowance', label: 'حق شیفت / نوبت‌کاری' },
  { key: 'attractionPercent', label: 'درصد حق جذب' },
  { key: 'attractionAmount', label: 'مبلغ حق جذب' },
  { key: 'adjustmentDiff', label: 'تفاوت تطبیق' },
  { key: 'supervision', label: 'حق سرپرستی' },
  { key: 'educationAid', label: 'کمک‌هزینه تحصیلی' },
  { key: 'laborMarket', label: 'فوق‌العاده بازار کار' },
  { key: 'fixedOvertime', label: 'اضافه‌کار ثابت' },
  { key: 'otherBenefits', label: 'سایر مزایا' },
];

function Fld({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">{label}</Label>
      {children}
      {hint && <p className="text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function money(v: number): string {
  return formatMoney(v);
}

export default function ContractsModule() {
  const { company, fy } = useApp();
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [personnelId, setPersonnelId] = useState('');
  const [tab, setTab] = useState('contracts');
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [decrees, setDecrees] = useState<DecreeRow[]>([]);

  const [cDialog, setCDialog] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null);
  const [cForm, setCForm] = useState<CForm>(EMPTY_CONTRACT);
  const [saving, setSaving] = useState(false);
  // گزاره ۸ نسخه ۱٫۲٫۰ — قرارداد هوشمند
  const [genBusy, setGenBusy] = useState(false);

  const [dDialog, setDDialog] = useState(false);
  const [editingDecree, setEditingDecree] = useState<DecreeRow | null>(null);
  const [dForm, setDForm] = useState<DForm>(EMPTY_DECREE);

  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'contract' | 'decree'; id: number } | null>(null);

  // پرسنل شرکت فعال
  useEffect(() => {
    if (!company) { setPeople([]); setPersonnelId(''); return; }
    apiGet<{ personnel: PersonLite[] }>(`/api/personnel?companyId=${company.id}`)
      .then((d) => setPeople(d.personnel))
      .catch(() => setPeople([]));
  }, [company]);

  // فوکوس از ماژول پرسنل — دکمه «قرارداد/احکام» لیست پرسنل ماژول را با این پرسنل باز می‌کند
  useEffect(() => {
    const f = consumeFocusPersonnel();
    if (!f) return;
    setTab(f.module === 'decrees' ? 'decrees' : 'contracts');
    if (f.personnelId) setPersonnelId(String(f.personnelId));
  }, []);

  // بارگذاری قراردادها و احکام پرسنل انتخابی
  const loadRows = useCallback(async () => {
    if (!personnelId) { setContracts([]); setDecrees([]); return; }
    setLoading(true);
    try {
      const [c, d] = await Promise.all([
        apiGet<{ contracts: ContractRow[] }>(`/api/personnel/${personnelId}/contracts`),
        apiGet<{ decrees: DecreeRow[] }>(`/api/personnel/${personnelId}/decrees`),
      ]);
      setContracts(c.contracts);
      setDecrees(d.decrees);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [personnelId]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const selected = people.find((p) => String(p.id) === personnelId) ?? null;

  // چاپ/دانلود قرارداد — همیشه با fetch از همان origin (کوکی نشست) و blob، بدون navigation مستقیم
  const printContract = (pid: number | string, kind: string) =>
    openPrintWindow(`/api/contracts/generate?personnelId=${pid}&kind=${encodeURIComponent(kind)}&format=html`, { filename: 'contract.html' });
  // نسخه ۱٫۴٫۵ — فایل ورد واقعی روی قالب رسمی کاربر (قرارداد خام عادی/با مبلغ معین)
  const downloadContractWord = (pid: number | string, kind: string) =>
    openPrintWindow(`/api/contracts/generate?personnelId=${pid}&kind=${encodeURIComponent(kind)}&format=docx`, { filename: `contract-${kind === 'ساعتی' ? 'hourly' : 'fixed'}.docx` });
  // چاپ حکم پرسنلی داخل سربرگ (مورد ۱۲ نسخه ۱٫۴٫۳) + فایل ورد واقعی روی سربرگ رسمی (۱٫۴٫۵)
  const printDecree = (pid: number | string, decreeId?: number) =>
    openPrintWindow(`/api/decrees/print?personnelId=${pid}${decreeId ? `&decreeId=${decreeId}` : ''}&format=html`, { filename: 'decree.html' });
  const downloadDecreeWord = (pid: number | string, decreeId?: number) =>
    openPrintWindow(`/api/decrees/print?personnelId=${pid}${decreeId ? `&decreeId=${decreeId}` : ''}&format=docx`, { filename: 'decree-letterhead.docx' });

  // گزاره ۸ — تولید/چاپ قرارداد هوشمند از روی حکم + دانلود Word
  const genContract = async (kind: string, save: boolean) => {
    if (!personnelId) { toast.error('ابتدا پرسنل را انتخاب کنید'); return; }
    setGenBusy(true);
    try {
      if (save) {
        const res = await apiPost<{ mismatch: boolean; notes: string[] }>(`/api/contracts/generate`, { personnelId: Number(personnelId), kind });
        if (res.notes?.length) res.notes.forEach((n) => toast.warning(n));
        else toast.success('قرارداد هوشمند تولید و به‌عنوان نسخه جدید ثبت شد');
        await loadRows();
      }
      if (save) await downloadContractWord(personnelId, kind);
      else await printContract(personnelId, kind);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  };

  // ستون‌های جدول قراردادها — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const contractCols: DtColumn<ContractRow>[] = [
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'contractType', header: 'نوع قرارداد',
      cell: (c) => <Badge variant="outline">{c.contractType}</Badge>,
    },
    {
      key: 'hourlyRate', header: 'نرخ ساعت', className: 'num',
      sortValue: (c) => c.hourlyRate, cell: (c) => (c.hourlyRate ? money(c.hourlyRate) : '—'),
    },
    {
      key: 'dailyRate', header: 'نرخ روز', className: 'num',
      sortValue: (c) => c.dailyRate, cell: (c) => (c.dailyRate ? money(c.dailyRate) : '—'),
    },
    {
      key: 'monthlyWage', header: 'مزد ماهانه', className: 'num',
      sortValue: (c) => c.monthlyWage, cell: (c) => (c.monthlyWage ? money(c.monthlyWage) : '—'),
    },
    {
      key: 'projectAmount', header: 'مبلغ پیمان', className: 'num',
      sortValue: (c) => c.projectAmount, cell: (c) => (c.projectAmount ? money(c.projectAmount) : '—'),
    },
    {
      key: 'startDate', header: 'از تاریخ', className: 'num',
      cell: (c) => <Fa>{c.startDate || '—'}</Fa>,
    },
    {
      key: 'endDate', header: 'تا تاریخ', className: 'num',
      cell: (c) => <Fa>{c.endDate || '—'}</Fa>,
    },
    {
      key: 'insuranceRequired', header: 'مشمول بیمه', align: 'center',
      sortValue: (c) => (c.insuranceRequired ? 1 : 0), filterValue: (c) => (c.insuranceRequired ? 'بله' : 'خیر'),
      cell: (c) =>
        c.insuranceRequired ? (
          <Badge className="bg-success/10 text-success border-0">بله</Badge>
        ) : (
          <Badge variant="outline">خیر</Badge>
        ),
    },
    {
      key: 'docKind', header: 'نسخه هوشمند', align: 'center', noSort: true, noFilter: true,
      cell: (c) => c.docKind ? (
        <div className="flex items-center justify-center gap-1">
          <Badge variant="outline" className={c.isValid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>
            {c.docKind}{c.periodKey ? ` — ${c.periodKey}` : ''}{c.isValid ? '' : ' (سابقه)'}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="چاپ قرارداد (A4)"
            onClick={() => printContract(c.personnelId, c.docKind)}>
            <Printer size={13} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="دانلود Word"
            onClick={() => downloadContractWord(c.personnelId, c.docKind)}>
            <FileDown size={13} />
          </Button>
        </div>
      ) : <span className="text-muted-foreground text-xs">دستی</span>,
    },
    {
      key: 'ops', header: 'عملیات', align: 'left', noSort: true, noFilter: true, headerClassName: 'w-24',
      cell: (c) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openContractEdit(c)} title="ویرایش">
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget({ kind: 'contract', id: c.id })} title="حذف"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  // ستون‌های جدول احکام پرسنلی
  const decreeCols: DtColumn<DecreeRow>[] = [
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'effectiveDate', header: 'تاریخ اجرا', className: 'num font-medium',
      cell: (d) => <Fa>{d.effectiveDate}</Fa>,
    },
    { key: 'jobWage', header: 'مزد شغل', className: 'num', sortValue: (d) => d.jobWage, cell: (d) => money(d.jobWage) },
    { key: 'seniorityWage', header: 'سنوات', className: 'num', sortValue: (d) => d.seniorityWage, cell: (d) => money(d.seniorityWage) },
    { key: 'housing', header: 'حق مسکن', className: 'num', sortValue: (d) => d.housing, cell: (d) => money(d.housing) },
    { key: 'food', header: 'خواروبار', className: 'num', sortValue: (d) => d.food, cell: (d) => money(d.food) },
    { key: 'workerBen', header: 'بن کارگری', className: 'num', sortValue: (d) => d.workerBen, cell: (d) => money(d.workerBen) },
    { key: 'childAllowance', header: 'حق اولاد', className: 'num', sortValue: (d) => d.childAllowance, cell: (d) => money(d.childAllowance) },
    { key: 'shiftAllowance', header: 'شیفت', className: 'num', sortValue: (d) => d.shiftAllowance, cell: (d) => money(d.shiftAllowance) },
    { key: 'otherBenefits', header: 'سایر مزایا', className: 'num', sortValue: (d) => d.otherBenefits, cell: (d) => money(d.otherBenefits) },
    {
      key: 'ops', header: 'عملیات', align: 'left', noSort: true, noFilter: true, headerClassName: 'w-24',
      cell: (d) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDecreeEdit(d)} title="ویرایش">
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printDecree(personnelId ?? '', d.id)} title="چاپ حکم داخل سربرگ">
            <Printer size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadDecreeWord(personnelId ?? '', d.id)} title="دانلود حکم (Word داخل سربرگ)">
            <FileDown size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget({ kind: 'decree', id: d.id })} title="حذف"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  // ---------- قرارداد ----------
  const openContractCreate = () => {
    setEditingContract(null);
    setCForm(EMPTY_CONTRACT);
    setCDialog(true);
  };
  const openContractEdit = (c: ContractRow) => {
    setEditingContract(c);
    setCForm({
      contractType: c.contractType,
      hourlyRate: c.hourlyRate ? String(c.hourlyRate) : '',
      dailyRate: c.dailyRate ? String(c.dailyRate) : '',
      monthlyWage: c.monthlyWage ? String(c.monthlyWage) : '',
      projectAmount: c.projectAmount ? String(c.projectAmount) : '',
      startDate: c.startDate, endDate: c.endDate,
      payCycle: c.payCycle || 'ماهانه',
      insuranceRequired: c.insuranceRequired,
      notes: c.notes,
    });
    setCDialog(true);
  };
  const saveContract = async () => {
    if (!personnelId) return;
    setSaving(true);
    try {
      if (editingContract) {
        await apiPut(`/api/contracts/${editingContract.id}`, cForm);
        toast.success('قرارداد ویرایش شد');
      } else {
        await apiPost(`/api/personnel/${personnelId}/contracts`, cForm);
        toast.success('قرارداد جدید ثبت شد');
      }
      setCDialog(false);
      await loadRows();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- حکم ----------
  const openDecreeCreate = () => {
    setEditingDecree(null);
    setDForm(EMPTY_DECREE);
    setDDialog(true);
  };
  const openDecreeEdit = (d: DecreeRow) => {
    setEditingDecree(d);
    setDForm({
      effectiveDate: d.effectiveDate,
      jobWage: d.jobWage ? String(d.jobWage) : '',
      seniorityWage: d.seniorityWage ? String(d.seniorityWage) : '',
      childAllowance: d.childAllowance ? String(d.childAllowance) : '',
      housing: d.housing ? String(d.housing) : '',
      food: d.food ? String(d.food) : '',
      adjustmentDiff: d.adjustmentDiff ? String(d.adjustmentDiff) : '',
      supervision: d.supervision ? String(d.supervision) : '',
      educationAid: d.educationAid ? String(d.educationAid) : '',
      laborMarket: d.laborMarket ? String(d.laborMarket) : '',
      attractionPercent: d.attractionPercent ? String(d.attractionPercent) : '',
      attractionAmount: d.attractionAmount ? String(d.attractionAmount) : '',
      otherBenefits: d.otherBenefits ? String(d.otherBenefits) : '',
      workerBen: d.workerBen ? String(d.workerBen) : '',
      fixedOvertime: d.fixedOvertime ? String(d.fixedOvertime) : '',
      familyAllowance: d.familyAllowance ? String(d.familyAllowance) : '',
      shiftAllowance: d.shiftAllowance ? String(d.shiftAllowance) : '',
      notes: d.notes,
    });
    setDDialog(true);
  };
  const saveDecree = async () => {
    if (!personnelId) return;
    if (!normalizeDigits(dForm.effectiveDate).trim()) {
      toast.error('تاریخ اجرا الزامی است');
      return;
    }
    setSaving(true);
    try {
      if (editingDecree) {
        await apiPut(`/api/decrees/${editingDecree.id}`, dForm);
        toast.success('حکم ویرایش شد');
      } else {
        await apiPost(`/api/personnel/${personnelId}/decrees`, dForm);
        toast.success('حکم جدید ثبت شد');
      }
      setDDialog(false);
      await loadRows();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'contract') await apiDelete(`/api/contracts/${deleteTarget.id}`);
      else await apiDelete(`/api/decrees/${deleteTarget.id}`);
      toast.success('حذف شد');
      await loadRows();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!company || !fy) {
    return (
      <div>
        <PageHeader title="قرارداد و احکام" icon={<FileSignature size={20} />} />
        <Card>
          <EmptyState
            title="ابتدا شرکت و سال مالی را ثبت کنید"
            hint="از بخش «شرکت و سال مالی» شرکت خود و یک سال مالی ثبت و فعال کنید"
          />
        </Card>
      </div>
    );
  }

  const personSelect = (
    <div className="w-full sm:w-64">
      <Select
        value={personnelId}
        onValueChange={setPersonnelId}
      >
        <SelectTrigger className="w-full h-9">
          <SelectValue placeholder="انتخاب پرسنل…" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {people.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.personnelCode} — {p.firstName} {p.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="قرارداد و احکام"
        subtitle={`${company.name} — سال مالی ${toPersianDigits(fy.jy)}`}
        icon={<FileSignature size={20} />}
      />

      <Card className="shadow-luxe border-border/70 p-5">
        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="contracts" className="gap-1.5">
                <FileSignature size={14} /> قراردادها
              </TabsTrigger>
              <TabsTrigger value="decrees" className="gap-1.5">
                <ScrollText size={14} /> احکام پرسنلی
              </TabsTrigger>
            </TabsList>
            {personSelect}
          </div>

          {!personnelId ? (
            <EmptyState
              title="یک پرسنل انتخاب کنید"
              hint="برای مشاهده و مدیریت قراردادها یا احکام، ابتدا پرسنل مورد نظر را از فهرست بالا انتخاب کنید"
              icon={<FileSignature size={28} />}
            />
          ) : (
            <>
              {/* تب قراردادها */}
              <TabsContent value="contracts" className="mt-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] text-muted-foreground">
                    قراردادهای {selected?.firstName} {selected?.lastName}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={genBusy} onClick={() => genContract('ساعتی', true)} title="تولید قرارداد هوشمند از روی حکم + عکس پرسنلی">
                      <FileSignature size={14} /> قرارداد ساعتی هوشمند
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={genBusy} onClick={() => genContract('مبلغ معین', true)} title="تولید قرارداد مبلغ معین از روی حکم">
                      <FileSignature size={14} /> قرارداد مبلغ معین هوشمند
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={openContractCreate}>
                      <Plus size={15} /> افزودن قرارداد
                    </Button>
                  </div>
                </div>
                {loading ? (
                  <LoadingBlock rows={3} />
                ) : (
                  <DataTable
                    id="contracts-list"
                    columns={contractCols}
                    rows={contracts}
                    rowKey={(c) => c.id}
                    empty={
                      <EmptyState title="قراردادی ثبت نشده است" hint="برای این پرسنل هنوز قراردادی ثبت نشده است" />
                    }
                  />
                )}
              </TabsContent>

              {/* تب احکام */}
              <TabsContent value="decrees" className="mt-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <Info size={14} />
                    <span>آخرین حکم با تاریخ اجرا کمتر از پایان ماه، مبنای محاسبه حقوق آن ماه است.</span>
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={openDecreeCreate}>
                    <Plus size={15} /> افزودن حکم
                  </Button>
                </div>
                {loading ? (
                  <LoadingBlock rows={3} />
                ) : (
                  <DataTable
                    id="decrees-list"
                    columns={decreeCols}
                    rows={decrees}
                    rowKey={(d) => d.id}
                    containerClassName="max-h-[55vh]"
                    empty={
                      <EmptyState
                        title="حکمی ثبت نشده است"
                        hint="برای این پرسنل هنوز حکم پرسنلی ثبت نشده است"
                        icon={<ScrollText size={28} />}
                      />
                    }
                  />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </Card>

      {/* دیالوگ قرارداد */}
      <Dialog open={cDialog} onOpenChange={setCDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? 'ویرایش قرارداد' : 'افزودن قرارداد'}</DialogTitle>
            <DialogDescription>
              {selected ? `پرسنل: ${selected.firstName} ${selected.lastName}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5 py-1">
            <Fld label="نوع قرارداد">
              <Select value={cForm.contractType} onValueChange={(v) => setCForm({ ...cForm, contractType: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Fld>
            <Fld label="دوره پرداخت">
              <Select value={cForm.payCycle} onValueChange={(v) => setCForm({ ...cForm, payCycle: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAY_CYCLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Fld>
            {cForm.contractType === 'ساعتی' && (
              <Fld label="نرخ ساعتی (ریال)">
                <Input className="num" value={cForm.hourlyRate} onChange={(e) => setCForm({ ...cForm, hourlyRate: normalizeDigits(e.target.value) })} />
              </Fld>
            )}
            {cForm.contractType === 'روزانه' && (
              <Fld label="نرخ روزانه (ریال)">
                <Input className="num" value={cForm.dailyRate} onChange={(e) => setCForm({ ...cForm, dailyRate: normalizeDigits(e.target.value) })} />
              </Fld>
            )}
            {(cForm.contractType === 'ماهانه ثابت' || cForm.contractType === 'سایر') && (
              <Fld label="مزد ماهانه (ریال)">
                <Input className="num" value={cForm.monthlyWage} onChange={(e) => setCForm({ ...cForm, monthlyWage: normalizeDigits(e.target.value) })} />
              </Fld>
            )}
            {cForm.contractType === 'پیمانی' && (
              <Fld label="مبلغ پیمان (ریال)">
                <Input className="num" value={cForm.projectAmount} onChange={(e) => setCForm({ ...cForm, projectAmount: normalizeDigits(e.target.value) })} />
              </Fld>
            )}
            <Fld label="از تاریخ" hint="۸ رقم — مثال: ۱۴۰۵۰۷۰۱">
              <JalaliDateInput value={cForm.startDate} onChange={(v) => setCForm({ ...cForm, startDate: v })} />
            </Fld>
            <Fld label="تا تاریخ" hint="۸ رقم — مثال: ۱۴۰۵۰۷۳۱">
              <JalaliDateInput value={cForm.endDate} onChange={(v) => setCForm({ ...cForm, endDate: v })} />
            </Fld>
            <div className="flex items-center gap-2 pt-4">
              <Switch
                id="cins"
                checked={cForm.insuranceRequired}
                onCheckedChange={(v) => setCForm({ ...cForm, insuranceRequired: v })}
              />
              <Label htmlFor="cins" className="text-[12.5px] cursor-pointer">مشمول بیمه</Label>
            </div>
            <div className="sm:col-span-2">
              <Fld label="یادداشت">
                <Textarea rows={2} value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} />
              </Fld>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCDialog(false)}>انصراف</Button>
            <Button onClick={saveContract} disabled={saving} className="gap-1.5 min-w-28">
              <Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ حکم */}
      <Dialog open={dDialog} onOpenChange={setDDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDecree ? 'ویرایش حکم پرسنلی' : 'افزودن حکم پرسنلی'}</DialogTitle>
            <DialogDescription>
              {selected ? `پرسنل: ${selected.firstName} ${selected.lastName}` : ''} — همه مبالغ به ریال است.
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5 py-1">
            {DECREE_FIELDS.map((f) => (
              <Fld key={f.key} label={f.label} hint={f.key === 'effectiveDate' ? '۸ رقم — مثال: ۱۴۰۵۰۷۰۱' : undefined}>
                {f.key === 'effectiveDate' ? (
                  <JalaliDateInput value={dForm.effectiveDate} onChange={(v) => setDForm({ ...dForm, effectiveDate: v })} />
                ) : (
                  <Input
                    className="num"
                    value={String(dForm[f.key])}
                    onChange={(e) =>
                      setDForm({
                        ...dForm,
                        [f.key]: normalizeDigits(e.target.value),
                      })
                    }
                  />
                )}
              </Fld>
            ))}
            <div className="sm:col-span-2">
              <Fld label="یادداشت">
                <Textarea rows={2} value={dForm.notes} onChange={(e) => setDForm({ ...dForm, notes: e.target.value })} />
              </Fld>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDDialog(false)}>انصراف</Button>
            <Button onClick={saveDecree} disabled={saving} className="gap-1.5 min-w-28">
              <Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تایید حذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader dir="rtl">
            <AlertDialogTitle>حذف این {deleteTarget?.kind === 'contract' ? 'قرارداد' : 'حکم'}؟</AlertDialogTitle>
            <AlertDialogDescription>این عملیات قابل بازگشت نیست.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={doDelete}>
              بله، حذف شود
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
