'use client';
// ماژول شرکت و سال مالی — کارت‌های شرکت، ثبت/ویرایش با آپلود لوگو، مدیریت سال‌های مالی
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Plus, Pencil, Trash2, CalendarPlus, CheckCircle2, Save, Image as ImageIcon, Network, FileSpreadsheet, X } from 'lucide-react';
import { useApp, type Company, type FiscalYear } from '@/components/app-state';
import { PageHeader, EmptyState, LoadingBlock, Fa } from '@/components/shared';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { toPersianDigits, parseIntOr } from '@/lib/core/numbers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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

interface CompanyForm {
  name: string; nationalId: string; economicCode: string; ssoBranchCode: string;
  ssoWorkshopCode: string; ssoContractRow: string; taxFileCode: string; postalCode: string;
  managerName: string; phone: string; address: string;
}

const EMPTY_COMPANY: CompanyForm = {
  name: '', nationalId: '', economicCode: '', ssoBranchCode: '', ssoWorkshopCode: '',
  ssoContractRow: '', taxFileCode: '', postalCode: '', managerName: '', phone: '', address: '',
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export default function CompaniesModule() {
  const { company, setCompany, setFy, fy: activeFy, refreshContext, fiscalYears } = useApp();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_COMPANY);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [fyDialogOpen, setFyDialogOpen] = useState(false);
  const [newJy, setNewJy] = useState('');
  // مورد ۱۳ (۱.۴.۴) — انتقال اختیاری از سال مالی قبل با تائید کاربر
  const [fyCarry, setFyCarry] = useState(false);
  const [companyFys, setCompanyFys] = useState<Array<{ id: number; companyId: number; jy: number; title: string }>>([]);
  const prevJy = companyFys.length
    ? Math.max(0, ...companyFys.map((f) => f.jy).filter((y) => y < (parseIntOr(newJy, 0) || 0)))
    : 0;

  // گزاره ۲ و ۵ — بخش‌های کاری هتل (مراکز هزینه) و گروه‌های فیش حقوقی در ویرایش اطلاعات هتل
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [pgList, setPgList] = useState<string[]>([]);
  const [pgInput, setPgInput] = useState('');

  const loadLists = useCallback(async (companyId: number) => {
    try {
      const [cc, pg] = await Promise.all([
        apiGet<{ costCenters: string[] }>(`/api/cost-centers?companyId=${companyId}`),
        apiGet<{ groups: string[] }>(`/api/payroll-groups?companyId=${companyId}`),
      ]);
      setCcList(cc.costCenters);
      setPgList(pg.groups);
    } catch { /* ignore */ }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const data = await apiGet<{ companies: Company[] }>('/api/companies');
      setCompanies(data.companies);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFys = useCallback(async (companyId: number) => {
    try {
      const data = await apiGet<{ fiscalYears: Array<{ id: number; companyId: number; jy: number; title: string }> }>(
        `/api/companies/${companyId}/fiscal-years`,
      );
      setCompanyFys(data.fiscalYears);
    } catch { setCompanyFys([]); }
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => {
    if (company) loadFys(company.id);
    else setCompanyFys([]);
  }, [company, loadFys, fiscalYears]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_COMPANY);
    setLogoFile(null);
    setLogoPreview('');
    setDialogOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({
      name: c.name, nationalId: c.nationalId, economicCode: c.economicCode,
      ssoBranchCode: c.ssoBranchCode, ssoWorkshopCode: c.ssoWorkshopCode,
      ssoContractRow: c.ssoContractRow, taxFileCode: c.taxFileCode,
      postalCode: c.postalCode, managerName: c.managerName, phone: c.phone, address: c.address,
    });
    setLogoFile(null);
    setLogoPreview(c.logoPath ? c.logoPath : '');
    void loadLists(c.id);
    setDialogOpen(true);
  };

  // گزاره ۲ — افزودن/حذف مرکز هزینه (بخش کاری هتل)؛ بلافاصله ذخیره می‌شود و در فرم پرسنل خودکار ظاهر می‌شود
  const addCostCenter = async () => {
    const name = ccInput.trim();
    if (!name || !editing || !activeFy) return;
    const next = Array.from(new Set([...ccList, name]));
    try {
      const d = await apiPost<{ costCenters: string[] }>('/api/cost-centers', {
        companyId: editing.id, fyId: activeFy.id, costCenters: next,
      });
      setCcList(d.costCenters);
      setCcInput('');
      toast.success(`مرکز هزینه «${name}» ذخیره شد — در فرم پرسنل و گزارش‌ها خودکار ظاهر می‌شود`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeCostCenter = async (name: string) => {
    if (!editing || !activeFy) return;
    const next = ccList.filter((c) => c !== name);
    try {
      const d = await apiPost<{ costCenters: string[] }>('/api/cost-centers', {
        companyId: editing.id, fyId: activeFy.id, costCenters: next,
      });
      setCcList(d.costCenters);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // گزاره ۵ — تعریف گروه فیش حقوقی (ابتدا تعریف، بعد انتخاب در فرم پرسنل)
  const addPayrollGroup = async () => {
    const name = pgInput.trim();
    if (!name || !editing) return;
    try {
      const d = await apiPost<{ groups: string[] }>('/api/payroll-groups', { companyId: editing.id, name });
      setPgList(d.groups);
      setPgInput('');
      toast.success(`گروه فیش «${name}» ثبت شد`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const pickLogo = (f: File | null) => {
    if (!f) return;
    if (!['image/png', 'image/jpeg'].includes(f.type)) {
      toast.error('فرمت تصویر باید PNG یا JPG باشد');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error('حجم لوگو نباید بیش از ۲ مگابایت باشد');
      return;
    }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('نام شرکت الزامی است');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, string> = { ...form };
        if (logoFile) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error('خطا در خواندن فایل'));
            r.readAsDataURL(logoFile);
          });
          payload.logoBase64 = dataUrl;
        }
        await apiPut(`/api/companies/${editing.id}`, payload);
        toast.success('شرکت با موفقیت ویرایش شد');
      } else {
        await apiPost('/api/companies', form);
        toast.success('شرکت جدید ثبت شد');
      }
      setDialogOpen(false);
      await loadCompanies();
      await refreshContext();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/companies/${deleteTarget.id}`);
      toast.success('شرکت حذف شد');
      if (deleteTarget.id === company?.id) setCompany(null);
      await loadCompanies();
      await refreshContext();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const addFy = async () => {
    if (!company) return;
    const jy = parseIntOr(newJy, 0);
    if (!jy) {
      toast.error('سال مالی را انتخاب کنید');
      return;
    }
    try {
      const res = await apiPost<{ carried?: string[] }>(`/api/companies/${company.id}/fiscal-years`, {
        jy,
        carryFromPrevious: fyCarry,
      });
      const carried = res.carried ?? [];
      if (fyCarry && carried.length) {
        toast.success(`سال مالی ${toPersianDigits(jy)} ایجاد شد — تنظیمات، پله‌های مالیاتی و دوره‌های ۱۲گانه از سال ${toPersianDigits(prevJy ?? jy - 1)} منتقل شد`);
      } else {
        toast.success(`سال مالی ${toPersianDigits(jy)} ایجاد شد (تنظیمات و پله‌های مالیاتی پیش‌فرض ثبت شد)`);
      }
      setFyDialogOpen(false);
      setNewJy('');
      setFyCarry(false);
      await loadFys(company.id);
      await refreshContext();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const deleteFy = async (fyId: number, jy: number) => {
    if (!company) return;
    try {
      await apiDelete(`/api/companies/${company.id}/fiscal-years?fyId=${fyId}`);
      toast.success(`سال مالی ${toPersianDigits(jy)} حذف شد`);
      await loadFys(company.id);
      await refreshContext();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const years = Array.from({ length: 101 }, (_, i) => 1400 + i);

  type FyRow = { id: number; companyId: number; jy: number; title: string };

  // ستون‌های جدول سال‌های مالی — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const fyCols: DtColumn<FyRow>[] = [
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-14',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'title', header: 'عنوان', className: 'font-medium',
      cell: (f) => f.title,
    },
    {
      key: 'jy', header: 'سال', align: 'center', className: 'num',
      cell: (f) => <Fa>{f.jy}</Fa>,
    },
    {
      key: 'status', header: 'وضعیت', align: 'center',
      sortValue: (f) => (activeFy?.id === f.id && company?.id === f.companyId ? 1 : 0),
      filterValue: (f) => (activeFy?.id === f.id && company?.id === f.companyId ? 'فعال' : 'غیرفعال'),
      cell: (f) => {
        const isActiveFy = activeFy?.id === f.id && company?.id === f.companyId;
        return isActiveFy ? (
          <Badge className="bg-success/10 text-success border-0">فعال</Badge>
        ) : (
          <Badge variant="outline">غیرفعال</Badge>
        );
      },
    },
    {
      key: 'ops', header: 'عملیات', align: 'left', noSort: true, noFilter: true, headerClassName: 'w-40',
      cell: (f) => {
        const isActiveFy = activeFy?.id === f.id && company?.id === f.companyId;
        return (
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="outline" size="sm"
              className="gap-1 h-8 text-[12px]"
              onClick={() => {
                const c = companies.find((x) => x.id === f.companyId);
                setCompany(c ?? null);
                setFy(f as FiscalYear);
                toast.success(`سال مالی ${toPersianDigits(f.jy)} به‌عنوان فعال انتخاب شد`);
              }}
              disabled={isActiveFy}
            >
              انتخاب به‌عنوان فعال
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => deleteFy(f.id, f.jy)}
              title="حذف سال مالی"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="شرکت و سال مالی"
        subtitle="مدیریت اطلاعات کارگاه‌ها و سال‌های مالی سامانه"
        icon={<Building2 size={20} />}
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus size={16} /> شرکت جدید
          </Button>
        }
      />

      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : companies.length === 0 ? (
        <Card>
          <EmptyState
            title="هنوز شرکتی ثبت نشده است"
            hint="برای شروع کار با سامانه، اطلاعات شرکت خود را ثبت کنید"
            icon={<Building2 size={28} />}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => {
            const isActive = company?.id === c.id;
            return (
              <Card
                key={c.id}
                className={
                  'p-5 shadow-luxe border-border/70 transition-all hover:shadow-md ' +
                  (isActive ? 'ring-2 ring-primary/50' : '')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.logoPath ? (
                      <img src={c.logoPath} alt={`لوگوی ${c.name}`} className="h-11 w-11 rounded-xl object-cover border border-border/60" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Building2 size={20} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        شناسه ملی: <Fa>{c.nationalId || '—'}</Fa>
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <Badge className="bg-success/10 text-success border-0 shrink-0">فعال</Badge>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px] text-muted-foreground">
                  <div>
                    <span className="block text-[11px]">کد کارگاه بیمه</span>
                    <span className="num font-medium text-foreground"><Fa>{c.ssoWorkshopCode || '—'}</Fa></span>
                  </div>
                  <div>
                    <span className="block text-[11px]">مدیر</span>
                    <span className="font-medium text-foreground truncate block">{c.managerName || '—'}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
                  {!isActive && (
                    <Button
                      variant="outline" size="sm"
                      className="gap-1.5 text-primary"
                      onClick={() => { setCompany(c); toast.success(`شرکت «${c.name}» فعال شد`); }}
                    >
                      <CheckCircle2 size={14} /> فعال‌سازی
                    </Button>
                  )}
                  <div className="mr-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="ویرایش">
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(c)}
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* سال‌های مالی شرکت فعال */}
      {company && (
        <Card className="mt-6 shadow-luxe border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0">
            <div>
              <h2 className="font-bold">سال‌های مالی — {company.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                برای هر سال مالی، تنظیمات و پله‌های مالیاتی پیش‌فرض به‌صورت خودکار ایجاد می‌شود
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setFyDialogOpen(true)}>
              <CalendarPlus size={15} /> افزودن سال مالی
            </Button>
          </div>
          <div className="p-5">
            {companyFys.length === 0 ? (
              <EmptyState title="سال مالی ثبت نشده است" hint="برای محاسبه حقوق، ابتدا یک سال مالی اضافه کنید" />
            ) : (
              <DataTable
                id="companies-list"
                columns={fyCols}
                rows={companyFys}
                rowKey={(f) => f.id}
              />
            )}
          </div>
        </Card>
      )}

      {/* دیالوگ ثبت/ویرایش شرکت */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `ویرایش شرکت — ${editing.name}` : 'ثبت شرکت جدید'}</DialogTitle>
            <DialogDescription>
              اطلاعات هویتی و بیمه‌ای کارگاه را تکمیل کنید. فیلد نام الزامی است.
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5 py-1">
            <Field label="نام شرکت" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: آریان کویر رفسنجان" />
            </Field>
            <Field label="شناسه ملی">
              <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} className="num" placeholder="۱۰۱۰۰۰۰۰۰۰۰" />
            </Field>
            <Field label="کد اقتصادی">
              <Input value={form.economicCode} onChange={(e) => setForm({ ...form, economicCode: e.target.value })} className="num" />
            </Field>
            <Field label="کد شعبه بیمه">
              <Input value={form.ssoBranchCode} onChange={(e) => setForm({ ...form, ssoBranchCode: e.target.value })} className="num" />
            </Field>
            <Field label="کد کارگاه بیمه">
              <Input value={form.ssoWorkshopCode} onChange={(e) => setForm({ ...form, ssoWorkshopCode: e.target.value })} className="num" />
            </Field>
            <Field label="ردیف قرارداد بیمه">
              <Input value={form.ssoContractRow} onChange={(e) => setForm({ ...form, ssoContractRow: e.target.value })} className="num" />
            </Field>
            <Field label="کد پرونده مالیاتی">
              <Input value={form.taxFileCode} onChange={(e) => setForm({ ...form, taxFileCode: e.target.value })} className="num" />
            </Field>
            <Field label="کد پستی">
              <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="num" />
            </Field>
            <Field label="نام مدیر">
              <Input value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} />
            </Field>
            <Field label="تلفن">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="num" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="آدرس">
                <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
            {editing && (
              <div className="sm:col-span-2">
                <Label className="text-[12.5px]">لوگوی شرکت (PNG یا JPG، حداکثر ۲ مگابایت)</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="پیش‌نمایش لوگو" className="h-12 w-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <ImageIcon size={18} />
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
                  />
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                    <ImageIcon size={14} /> انتخاب فایل لوگو
                  </Button>
                  {logoFile && <span className="text-xs text-muted-foreground truncate">{logoFile.name}</span>}
                </div>
              </div>
            )}

            {/* گزاره ۲ — بخش‌های کاری هتل (مراکز هزینه) */}
            {editing && (
              <div className="sm:col-span-2 rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Network size={15} className="text-primary" />
                  <span className="text-[13px] font-bold">بخش‌های کاری هتل (مراکز هزینه)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  هر مرکز هزینه جدید که اینجا بسازید، به‌صورت خودکار در فرم ویرایش اطلاعات پرسنل (بخش هتل / مرکز هزینه) و در گزارش‌های مراکز هزینه نمایش داده می‌شود.
                </p>
                <div className="flex flex-wrap gap-1.5 min-h-8">
                  {ccList.length === 0 ? (
                    <span className="text-[12px] text-muted-foreground">هنوز مرکز هزینه‌ای ثبت نشده است</span>
                  ) : ccList.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[12px]">
                      {c}
                      <button type="button" onClick={() => void removeCostCenter(c)} className="text-muted-foreground hover:text-destructive" title="حذف">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    placeholder="نام مرکز هزینه جدید… مثال: خدمات اتاق"
                    className="h-8 text-[12px]"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addCostCenter(); } }}
                  />
                  <Button
                    type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1"
                    disabled={!ccInput.trim() || !activeFy}
                    onClick={() => void addCostCenter()}
                  >
                    <Plus size={13} /> افزودن
                  </Button>
                </div>
                {!activeFy && (
                  <p className="text-[11px] text-amber-600">برای ذخیره مراکز هزینه ابتدا سال مالی فعال انتخاب کنید</p>
                )}
              </div>
            )}

            {/* گزاره ۵ — گروه‌های فیش حقوقی */}
            {editing && (
              <div className="sm:col-span-2 rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={15} className="text-primary" />
                  <span className="text-[13px] font-bold">گروه‌های فیش حقوقی</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  گروه‌های فیش را اول اینجا تعریف کنید؛ سپس در فرم ویرایش اطلاعات پرسنل از لیست گروه‌های تعریف‌شده انتخاب می‌کنید.
                </p>
                <div className="flex flex-wrap gap-1.5 min-h-8">
                  {pgList.length === 0 ? (
                    <span className="text-[12px] text-muted-foreground">هنوز گروهی تعریف نشده است</span>
                  ) : pgList.map((g) => (
                    <span key={g} className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[12px]">{g}</span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={pgInput}
                    onChange={(e) => setPgInput(e.target.value)}
                    placeholder="نام گروه جدید… مثال: گروه اداری"
                    className="h-8 text-[12px]"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addPayrollGroup(); } }}
                  />
                  <Button
                    type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1"
                    disabled={!pgInput.trim()}
                    onClick={() => void addPayrollGroup()}
                  >
                    <Plus size={13} /> تعریف گروه
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5 min-w-28">
              <Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ افزودن سال مالی */}
      <Dialog open={fyDialogOpen} onOpenChange={setFyDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>افزودن سال مالی</DialogTitle>
            <DialogDescription>سال مالی برای شرکت «{company?.name}»</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label>سال مالی (۱۴۰۰ تا ۱۵۰۰)</Label>
            <Select value={newJy} onValueChange={setNewJy}>
              <SelectTrigger className="w-full num">
                <SelectValue placeholder="انتخاب سال" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{toPersianDigits(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {prevJy > 0 && (
              <label className="flex items-start gap-2 mt-2 rounded-md border border-border/60 bg-muted/40 p-2.5 cursor-pointer select-none">
                <Checkbox
                  checked={fyCarry}
                  onCheckedChange={(v) => setFyCarry(v === true)}
                  className="mt-0.5"
                />
                <span className="text-[12px] leading-5">
                  <span className="font-medium">انتقال داده‌ها از سال مالی {toPersianDigits(prevJy)}</span>
                  <span className="block text-muted-foreground">
                    تنظیمات سال (حداقل مزد روزانه، کمک‌ها و بن)، پله‌های مالیاتی و دوره‌های ۱۲گانه حقوق از آخرین سال مالی قبلِ همین شرکت کپی می‌شود. لیست پرسنل و شیفت‌ها به‌صورت خودکار در سطح شرکت مشترک است و نیازی به انتقال ندارد.
                  </span>
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFyDialogOpen(false)}>انصراف</Button>
            <Button onClick={addFy} className="gap-1.5">
              <CalendarPlus size={15} /> ایجاد سال مالی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تایید حذف شرکت */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader dir="rtl">
            <AlertDialogTitle>حذف شرکت «{deleteTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              این عملیات قابل بازگشت نیست. حذف شرکت تنها در صورتی امکان‌پذیر است که هیچ داده وابسته‌ای (سال مالی، پرسنل، قرارداد و…) نداشته باشد.
            </AlertDialogDescription>
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
