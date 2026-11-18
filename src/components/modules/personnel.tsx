'use client';
// ماژول پرسنل — جدول با جستجو/فیلتر + فرم کامل در چهار تب
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Users, Plus, Pencil, Trash2, FileSignature, ScrollText, Search, Save, RotateCcw, Coins,
  AlarmClock, RefreshCw,
} from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState, LoadingBlock, Fa, StatusBadge } from '@/components/shared';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { normalizeDigits, toPersianDigits, parseIntOr, parseNumberOr, formatMoney } from '@/lib/core/numbers';
import { isValidNationalId, normalizeInsuranceNumber } from '@/lib/core/national-id';
import { JalaliDateInput } from '@/components/jalali-date-input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { JOB_TITLES } from '@/lib/core/job-titles';
import type { JobTitleRow } from '@/app/api/job-titles/route';
import { setFocusPersonnel, navigateTo } from '@/lib/core/nav-focus';
import { todayJalali, toGregorian } from '@/lib/core/jalali';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export interface PersonnelRow {
  id: number; personnelCode: string; cardNo: string; firstName: string; lastName: string;
  fatherName: string; nationalId: string; idNumber: string; idSerial: string; idIssuePlace: string; photo: string;
  birthDate: string; gender: string; maritalStatus: string; dependents: number; education: string;
  mobile: string; jobTitle: string; jobCode: string; department: string; costCenter: string; payslipGroup: string; bankName: string;
  bankAccount: string; bankSheba: string; ssoNumber: string; ssoInsurer: string;
  militaryStatus: string; isVeteran: boolean; workLocation: string; permanentNight: boolean;
  shiftId: number | null; ssoWorkerPct: number | null; ssoEmployerPct: number | null;
  ssoUnempPct: number | null; address: string; postalCode: string; birthPlace: string;
  insuranceType: number; employmentType: number; jobCategory: number; taxExemptionCode: number;
  status: string; hireDate: string; endWorkDate: string; notes: string;
}

type PForm = Omit<PersonnelRow, 'id' | 'shiftId' | 'ssoWorkerPct' | 'ssoEmployerPct' | 'ssoUnempPct'> & {
  shiftId: string;
  ssoWorkerPct: string; ssoEmployerPct: string; ssoUnempPct: string;
};

const EMPTY: PForm = {
  personnelCode: '', cardNo: '', firstName: '', lastName: '', fatherName: '', nationalId: '', photo: '',
  idNumber: '', idSerial: '', idIssuePlace: '', birthDate: '', gender: 'مرد', maritalStatus: 'مجرد',
  dependents: 0, education: '', mobile: '', jobTitle: '', jobCode: '', department: 'عمومی', costCenter: '', payslipGroup: '',
  bankName: '', bankAccount: '', bankSheba: '', ssoNumber: '', ssoInsurer: '', militaryStatus: '',
  isVeteran: false, workLocation: '', permanentNight: false, shiftId: '',
  ssoWorkerPct: '', ssoEmployerPct: '', ssoUnempPct: '',
  address: '', postalCode: '', birthPlace: '', insuranceType: 2, employmentType: 1,
  jobCategory: 12, taxExemptionCode: 1, status: 'شاغل', hireDate: '', endWorkDate: '', notes: '',
};

const STATUS_OPTIONS = ['شاغل', 'غیرفعال', 'خروج', 'بازنشسته'];
const MILITARY_OPTIONS = [
  'مشمول', 'در حال خدمت', 'پایان خدمت', 'معافیت پزشکی', 'معافیت غیر پزشکی',
  'مشمول قانون موسوم به کسری خدمت', 'مبارزات', 'مشمول طرح تمیین نیرو',
];

// ─── شمارش معکوس قرارداد (گزاره ۷) ──────────────────────────────
const WARN_DAYS_KEY = 'personnelContractWarnDays';

function parseJalaliStr(s: string): [number, number, number] | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec((s || '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** روزهای مانده تا پایان قرارداد (تاریخ پایان کار) — null یعنی تاریخ ثبت نشده */
export function contractDaysLeft(endDate: string): number | null {
  const e = parseJalaliStr(endDate);
  if (!e) return null;
  const t = todayJalali();
  const g1 = toGregorian(t.jy, t.jm, t.jd);
  const g2 = toGregorian(e[0], e[1], e[2]);
  return Math.round((Date.UTC(g2.gy, g2.gm - 1, g2.gd) - Date.UTC(g1.gy, g1.gm - 1, g1.gd)) / 86400000);
}

function ContractCountdownBadge({ endDate }: { endDate: string }) {
  const days = contractDaysLeft(endDate);
  if (days === null) return null;
  if (days <= 0) {
    return <Badge variant="destructive" className="num text-[10.5px]">قرارداد منقضی شده</Badge>;
  }
  if (days <= 30) {
    return <Badge variant="outline" className="num text-[10.5px] text-amber-600 border-amber-500/40">{toPersianDigits(days)} روز مانده</Badge>;
  }
  return <Badge variant="secondary" className="num text-[10.5px]">{toPersianDigits(days)} روز مانده</Badge>;
}
const DEPARTMENT_OPTIONS = ['پذیرش', 'خانه‌داری', 'آشپزخانه', 'نگهبانی', 'عمومی'];
const EDUCATION_OPTIONS = ['زیر دیپلم', 'سیکل', 'دیپلم', 'فوق دیپلم', 'لیسانس', 'فوق لیسانس', 'دکتری'];
const EMPLOYMENT_TYPES = [
  { v: 1, label: 'قراردادی' }, { v: 2, label: 'شرکتی' }, { v: 3, label: 'رسمی' },
  { v: 4, label: 'پیمانی' }, { v: 8, label: 'ساعتی' }, { v: 9, label: 'روزمزد' }, { v: 12, label: 'سایر' },
];
const INSURANCE_TYPES = [
  { v: 1, label: 'خدمات درمانی' }, { v: 2, label: 'تامین اجتماعی' }, { v: 3, label: 'بیمه سلامت' },
  { v: 4, label: 'سایر' }, { v: 5, label: 'ندارد' },
];
const TAX_EXEMPTION = [
  { v: 1, label: 'عدم معافیت' }, { v: 2, label: 'جانباز' }, { v: 3, label: 'فرزند شاهد' },
  { v: 4, label: 'آزاده' }, { v: 10, label: 'ماده ۱۰' }, { v: 11, label: 'ماده ۱۸' },
];
const GENDERS = ['مرد', 'زن'];
const MARITAL = ['مجرد', 'متاهل'];

// ─── مانده‌های اولیه ───────────────────────────────────────────────
type ObKind = 'seniority_days' | 'seniority_amount' | 'leave_balance' | 'current_balance'
  | 'eid_unpaid' | 'tax_debt' | 'other';
type ObUnit = 'amount' | 'days';
type ObEffect = 'earning_ins' | 'earning_free' | 'deduction' | 'none';

interface ObRow {
  id: number; title: string; kind: ObKind; unit: ObUnit; amount: number;
  effect: ObEffect; consumed: boolean; usedPeriod: string | null; notes: string;
}

interface ObForm {
  title: string; kind: ObKind; unit: ObUnit; amount: string; effect: ObEffect; notes: string;
}

const OB_EMPTY: ObForm = { title: '', kind: 'current_balance', unit: 'amount', amount: '', effect: 'none', notes: '' };

const OB_KINDS: Array<{ v: ObKind; l: string }> = [
  { v: 'seniority_days', l: 'سابقه از قبل (روز)' },
  { v: 'seniority_amount', l: 'سنوات انباشته' },
  { v: 'leave_balance', l: 'مانده مرخصی' },
  { v: 'current_balance', l: 'بدهی/بستانکاری جاری' },
  { v: 'eid_unpaid', l: 'عیدی پرداخت‌نشده' },
  { v: 'tax_debt', l: 'بدهی مالیات' },
  { v: 'other', l: 'سایر' },
];
const OB_UNITS: Array<{ v: ObUnit; l: string }> = [
  { v: 'amount', l: 'مبلغ (ریال)' }, { v: 'days', l: 'روز' },
];
const OB_EFFECTS: Array<{ v: ObEffect; l: string }> = [
  { v: 'earning_ins', l: 'درآمد مشمول بیمه و مالیات' },
  { v: 'earning_free', l: 'درآمد بدون بیمه و مالیات' },
  { v: 'deduction', l: 'کسر از حقوق' },
  { v: 'none', l: 'بدون اثر (فقط اطلاعاتی)' },
];

const obKindLabel = (k: ObKind) => OB_KINDS.find((x) => x.v === k)?.l ?? k;
const obUnitLabel = (u: ObUnit) => OB_UNITS.find((x) => x.v === u)?.l ?? u;
const obEffectLabel = (e: ObEffect) => OB_EFFECTS.find((x) => x.v === e)?.l ?? e;

/** مبلغ/روز — روز با حداکثر ۲ رقم اعشار، مبلغ صحیح با جداکننده هزارگان */
function formatObAmount(row: Pick<ObRow, 'unit' | 'amount'>): string {
  if (row.unit === 'days') {
    const v = Math.round(row.amount * 100) / 100;
    return toPersianDigits(String(v));
  }
  return formatMoney(Math.round(row.amount));
}

function Fld({ label, children, hint, required }: {
  label: string; children: React.ReactNode; hint?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px]">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-[10.5px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

function PersonFormFields({ form, set, shifts, companyName, costCenters, payrollGroups, jobTitles, onSyncJobTitles, jobSyncing }: {
  form: PForm; set: (f: PForm) => void; shifts: Array<{ id: number; name: string }>;
  companyName: string;
  costCenters: string[];
  payrollGroups: string[];
  jobTitles: JobTitleRow[];
  onSyncJobTitles: () => void;
  jobSyncing: boolean;
}) {
  const up = (patch: Partial<PForm>) => set({ ...form, ...patch });
  const inp = (v: string) => normalizeDigits(v);

  // کد شغل بیمه — از فهرست بارگذاری‌شده (به‌روزرسانی‌شده از تامین اجتماعی یا داخلی)
  const selectedJobCode = jobTitles.find((j) => j.title === form.jobTitle)?.code ?? null;
  // گزینه مرکز هزینه / بخش هتل — همیشه از سرور (fresh) می‌آید؛ مقدار فعلی هم در فهرست حفظ می‌شود
  const ccOptions = Array.from(new Set([...(form.costCenter ? [form.costCenter] : []), ...costCenters]))
    .map((c) => ({ value: c, label: c }));
  const pgOptions = Array.from(new Set([...(form.payslipGroup ? [form.payslipGroup] : []), ...payrollGroups]))
    .map((g) => ({ value: g, label: g }));
  // گزاره ۳ — بخش هتل همان مرکز هزینه است؛ انتخاب یکی، دیگری را خودکار پر می‌کند
  const setHotelSection = (v: string) => up({ department: v, costCenter: v });
  return (
    <Tabs defaultValue="identity" dir="rtl" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-4">
        <TabsTrigger value="identity">هویتی</TabsTrigger>
        <TabsTrigger value="job">شغلی</TabsTrigger>
        <TabsTrigger value="bank">بانک و بیمه</TabsTrigger>
        <TabsTrigger value="shift">شیفت و بیمه اختصاصی</TabsTrigger>
      </TabsList>

      {/* تب هویتی */}
      <TabsContent value="identity" className="mt-0">
        {/* عکس پرسنلی — در قرارداد کار زیر سربرگ درج می‌شود */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg border border-border/60 bg-muted/30">
          <div className="w-[72px] h-[88px] rounded-md border border-border overflow-hidden bg-background flex items-center justify-center shrink-0">
            {form.photo
              ? <img src={form.photo} alt="عکس پرسنلی" className="w-full h-full object-cover" />
              : <span className="text-[10px] text-muted-foreground text-center px-1">بدون عکس</span>}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">عکس پرسنلی (۴×۳ — در قرارداد کار زیر سربرگ درج می‌شود)</p>
            <div className="flex gap-2">
              <input
                type="file" accept="image/*" className="hidden" id="person-photo-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const img = new Image();
                    img.onload = () => {
                      const cv = document.createElement('canvas');
                      const maxW = 320, maxH = 400;
                      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
                      cv.width = Math.round(img.width * scale);
                      cv.height = Math.round(img.height * scale);
                      cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
                      up({ photo: cv.toDataURL('image/jpeg', 0.82) });
                    };
                    img.src = String(reader.result);
                  };
                  reader.readAsDataURL(f);
                  e.target.value = '';
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById('person-photo-input')?.click()}>انتخاب عکس</Button>
              {form.photo && <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => up({ photo: '' })}>حذف</Button>}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
          <Fld label="کد پرسنلی" required>
            <Input className="num" value={form.personnelCode} onChange={(e) => up({ personnelCode: inp(e.target.value) })} placeholder="۱۰۰" />
          </Fld>
          <Fld label="شماره کارت">
            <Input className="num" value={form.cardNo} onChange={(e) => up({ cardNo: inp(e.target.value) })} placeholder="۱۳۲" />
          </Fld>
          <Fld label="نام" required>
            <Input value={form.firstName} onChange={(e) => up({ firstName: e.target.value })} />
          </Fld>
          <Fld label="نام خانوادگی" required>
            <Input value={form.lastName} onChange={(e) => up({ lastName: e.target.value })} />
          </Fld>
          <Fld label="نام پدر">
            <Input value={form.fatherName} onChange={(e) => up({ fatherName: e.target.value })} />
          </Fld>
          <Fld label="کد ملی">
            <Input className="num" value={form.nationalId} onChange={(e) => up({ nationalId: inp(e.target.value) })} />
            {form.nationalId && !isValidNationalId(form.nationalId) && (
              <p className="text-xs text-red-600 mt-1">کد ملی وارد شده معتبر نیست — ۱۰ رقم صحیح وارد کنید</p>
            )}
            {form.nationalId && isValidNationalId(form.nationalId) && (
              <p className="text-xs text-emerald-600 mt-1">کد ملی معتبر است</p>
            )}
          </Fld>
          <Fld label="شماره شناسنامه">
            <Input className="num" value={form.idNumber} onChange={(e) => up({ idNumber: inp(e.target.value) })} />
          </Fld>
          <Fld label="سری شناسنامه">
            <Input value={form.idSerial} onChange={(e) => up({ idSerial: e.target.value })} />
          </Fld>
          <Fld label="محل صدور">
            <Input value={form.idIssuePlace} onChange={(e) => up({ idIssuePlace: e.target.value })} />
          </Fld>
          <Fld label="تاریخ تولد" hint="۸ رقم بدون اسلش — مثال: ۱۳۶۵۰۹۰۶">
            <JalaliDateInput value={form.birthDate} onChange={(v) => up({ birthDate: v })} />
          </Fld>
          <Fld label="جنسیت">
            <Select value={form.gender} onValueChange={(v) => up({ gender: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld label="وضعیت تاهل">
            <Select value={form.maritalStatus} onValueChange={(v) => up({ maritalStatus: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{MARITAL.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld label="تعداد افراد تحت تکفل">
            <Input className="num" value={toPersianDigits(String(form.dependents))} onChange={(e) => up({ dependents: parseIntOr(inp(e.target.value), 0) })} />
          </Fld>
          <Fld label="مدرک تحصیلی">
            <SearchableSelect
              value={form.education}
              onValueChange={(v) => up({ education: v })}
              options={EDUCATION_OPTIONS.map((g) => ({ value: g, label: g }))}
              allowClear
              searchPlaceholder="جستجوی مدرک…"
            />
          </Fld>
          <Fld label="محل تولد">
            <Input value={form.birthPlace} onChange={(e) => up({ birthPlace: e.target.value })} />
          </Fld>
          <Fld label="موبایل">
            <Input className="num" value={form.mobile} onChange={(e) => up({ mobile: inp(e.target.value) })} />
          </Fld>
        </div>
      </TabsContent>

      {/* تب شغلی */}
      <TabsContent value="job" className="mt-0">
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
          <Fld
            label="عنوان شغل (تامین اجتماعی)"
            hint={selectedJobCode
              ? `کد شغل بیمه: ${toPersianDigits(String(selectedJobCode))}`
              : 'جستجو از هر جای عنوان یا کد — کد شغل بیمه روی رکورد ذخیره می‌شود'}
          >
            <div className="space-y-1.5">
              <SearchableSelect
                value={form.jobTitle}
                onValueChange={(v) => {
                  const jt = jobTitles.find((j) => j.title === v);
                  const code = jt ? String(jt.code) : '';
                  up({ jobTitle: v, jobCode: code, jobCategory: Number.isFinite(Number(code)) && code !== '' ? Number(code) : form.jobCategory });
                }}
                options={jobTitles.map((j) => ({
                  value: j.title,
                  label: j.title,
                  hint: `کد بیمه: ${toPersianDigits(String(j.code))}${j.source === 'custom' ? ' (به‌روز)' : ''}`,
                }))}
                allowClear
                searchPlaceholder="جستجوی عنوان شغل یا کد…"
              />
              <button
                type="button"
                onClick={onSyncJobTitles}
                disabled={jobSyncing}
                className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline disabled:opacity-50"
                title="دانلود خودکار جدول مشاغل از سایت تامین اجتماعی"
              >
                <RefreshCw size={12} className={jobSyncing ? 'animate-spin' : ''} />
                {jobSyncing ? 'در حال دریافت از تامین اجتماعی…' : 'به‌روزرسانی جدول مشاغل از سایت تامین اجتماعی'}
              </button>
            </div>
          </Fld>
          <Fld
            label="بخش هتل (مرکز هزینه سازمانی)"
            hint="فهرست از مراکز هزینه هتل می‌آید؛ مرکز هزینه جدید در ویرایش اطلاعات هتل، خودکار اینجا ظاهر می‌شود"
          >
            <SearchableSelect
              value={form.department}
              onValueChange={setHotelSection}
              options={ccOptions}
              allowClear
              searchPlaceholder="جستجوی بخش هتل / مرکز هزینه…"
            />
          </Fld>
          <Fld label="مرکز هزینه" hint="همان بخش هتل — با انتخاب بخش، خودکار تکمیل می‌شود">
            <SearchableSelect
              value={form.costCenter}
              onValueChange={setHotelSection}
              options={ccOptions}
              allowClear
              searchPlaceholder="جستجوی مرکز هزینه…"
            />
          </Fld>
          <Fld label="محل خدمت" hint="به‌صورت خودکار با نام شرکت پر می‌شود">
            <Input value={companyName} readOnly className="bg-muted/40" />
          </Fld>
          <Fld
            label="گروه فیش حقوقی"
            hint="ابتدا گروه‌ها را در ویرایش اطلاعات هتل تعریف کنید، سپس از این لیست انتخاب کنید"
          >
            <SearchableSelect
              value={form.payslipGroup}
              onValueChange={(v) => up({ payslipGroup: v })}
              options={pgOptions}
              allowClear
              searchPlaceholder="جستجوی گروه فیش…"
            />
          </Fld>
          <Fld label="تاریخ استخدام" hint="۸ رقم — مثال: ۱۴۰۵۰۷۰۱">
            <JalaliDateInput value={form.hireDate} onChange={(v) => up({ hireDate: v })} />
          </Fld>
          <Fld label="تاریخ پایان کار (پایان قرارداد)" hint="۸ رقم — مثال: ۱۴۰۵۰۷۰۱">
            <div className="flex items-center gap-2">
              <div className="flex-1"><JalaliDateInput value={form.endWorkDate} onChange={(v) => up({ endWorkDate: v })} /></div>
              <ContractCountdownBadge endDate={form.endWorkDate} />
            </div>
          </Fld>
          <Fld label="نوع قرارداد (فرم مالیات)">
            <SearchableSelect
              value={String(form.employmentType)}
              onValueChange={(v) => up({ employmentType: parseIntOr(v, 1) })}
              options={EMPLOYMENT_TYPES.map((t) => ({ value: String(t.v), label: `${t.label} (${toPersianDigits(t.v)})` }))}
              searchPlaceholder="جستجوی نوع قرارداد…"
            />
          </Fld>
          <Fld label="گروه شغلی" hint="پیش‌فرض: ۱۲">
            <Input className="num" value={String(form.jobCategory)} onChange={(e) => up({ jobCategory: parseIntOr(inp(e.target.value), 12) })} />
          </Fld>
          <Fld label="وضعیت">
            <Select value={form.status} onValueChange={(v) => up({ status: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={form.permanentNight} onCheckedChange={(v) => up({ permanentNight: v })} id="pnight" />
            <Label htmlFor="pnight" className="text-[12.5px] cursor-pointer">شب‌کار دائمی</Label>
          </div>
          <div className="sm:col-span-2">
            <Fld label="یادداشت">
              <Textarea rows={2} value={form.notes} onChange={(e) => up({ notes: e.target.value })} />
            </Fld>
          </div>
        </div>
      </TabsContent>

      {/* تب بانک و بیمه */}
      <TabsContent value="bank" className="mt-0">
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
          <Fld label="نام بانک">
            <Input value={form.bankName} onChange={(e) => up({ bankName: e.target.value })} />
          </Fld>
          <Fld label="شماره حساب">
            <Input className="num" value={form.bankAccount} onChange={(e) => up({ bankAccount: inp(e.target.value) })} />
          </Fld>
          <Fld label="شماره شبا">
            <Input className="num" value={form.bankSheba} onChange={(e) => up({ bankSheba: inp(e.target.value) })} />
          </Fld>
          <Fld label="شماره بیمه تامین اجتماعی">
            <Input className="num" value={form.ssoNumber} onChange={(e) => up({ ssoNumber: inp(e.target.value) })} onBlur={() => up({ ssoNumber: normalizeInsuranceNumber(form.ssoNumber) })} />
            <p className="text-xs text-muted-foreground mt-1">۱۰ رقم — صفرهای ابتدایی به‌صورت خودکار تکمیل می‌شود</p>
          </Fld>
          <Fld label="بیمه‌گر">
            <Input value={form.ssoInsurer} onChange={(e) => up({ ssoInsurer: e.target.value })} />
          </Fld>
          <Fld label="نوع بیمه">
            <SearchableSelect
              value={String(form.insuranceType)}
              onValueChange={(v) => up({ insuranceType: parseIntOr(v, 2) })}
              options={INSURANCE_TYPES.map((t) => ({ value: String(t.v), label: t.label }))}
              searchPlaceholder="جستجوی نوع بیمه…"
            />
          </Fld>
          <Fld label="وضعیت نظام وظیفه" hint="از لیست انتخاب کنید تا برای همه پرسنل یکسان ثبت شود">
            <SearchableSelect
              value={form.militaryStatus}
              onValueChange={(v) => up({ militaryStatus: v })}
              options={MILITARY_OPTIONS.map((s) => ({ value: s, label: s }))}
              allowClear
              searchPlaceholder="جستجوی وضعیت نظام وظیفه…"
            />
          </Fld>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={form.isVeteran} onCheckedChange={(v) => up({ isVeteran: v })} id="vet" />
            <Label htmlFor="vet" className="text-[12.5px] cursor-pointer">ایثارگر / جانباز</Label>
          </div>
        </div>
      </TabsContent>

      {/* تب شیفت و بیمه اختصاصی */}
      <TabsContent value="shift" className="mt-0">
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
          <Fld label="شیفت پیش‌فرض">
            <SearchableSelect
              value={form.shiftId}
              onValueChange={(v) => up({ shiftId: v })}
              options={shifts.map((s) => ({ value: String(s.id), label: s.name }))}
              allowClear
              placeholder="بدون شیفت"
              searchPlaceholder="جستجوی شیفت…"
            />
          </Fld>
          <Fld label="کد معافیت مالیاتی">
            <SearchableSelect
              value={String(form.taxExemptionCode)}
              onValueChange={(v) => up({ taxExemptionCode: parseIntOr(v, 1) })}
              options={TAX_EXEMPTION.map((t) => ({ value: String(t.v), label: `${t.label} (${toPersianDigits(t.v)})` }))}
              searchPlaceholder="جستجوی کد معافیت…"
            />
          </Fld>
          <Fld label="نرخ بیمه سهم کارگر (٪)" hint="خالی = نرخ پیش‌فرض تنظیمات سال ۷">
            <Input className="num" value={form.ssoWorkerPct ?? ''} onChange={(e) => up({ ssoWorkerPct: inp(e.target.value) })} placeholder="۷" />
          </Fld>
          <Fld label="نرخ بیمه سهم کارفرما (٪)" hint="خالی = نرخ پیش‌فرض تنظیمات سال ۲۳">
            <Input className="num" value={form.ssoEmployerPct ?? ''} onChange={(e) => up({ ssoEmployerPct: inp(e.target.value) })} placeholder="۲۳" />
          </Fld>
          <Fld label="نرخ بیمه بیکاری (٪)" hint="خالی = نرخ پیش‌فرض تنظیمات سال ۳">
            <Input className="num" value={form.ssoUnempPct ?? ''} onChange={(e) => up({ ssoUnempPct: inp(e.target.value) })} placeholder="۳" />
          </Fld>
          <Fld label="کد پستی">
            <Input className="num" value={form.postalCode ?? ''} onChange={(e) => up({ postalCode: inp(e.target.value) })} />
          </Fld>
          <div className="sm:col-span-2">
            <Fld label="آدرس">
              <Textarea rows={2} value={form.address} onChange={(e) => up({ address: e.target.value })} />
            </Fld>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default function PersonnelModule() {
  const { company, fy } = useApp();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('همه');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PersonnelRow | null>(null);
  const [shifts, setShifts] = useState<Array<{ id: number; name: string }>>([]);

  // گزاره ۱ — عناوین شغلی تامین اجتماعی: فهرست از سرور + دکمه به‌روزرسانی خودکار از tamin.ir
  const [jobTitles, setJobTitles] = useState<JobTitleRow[]>(JOB_TITLES.map((j) => ({ title: j.title, code: String(j.code), source: 'builtin' as const })));
  const [jobSyncing, setJobSyncing] = useState(false);

  const loadJobTitles = useCallback(() => {
    apiGet<{ titles: JobTitleRow[] }>('/api/job-titles')
      .then((d) => { if (d.titles?.length) setJobTitles(d.titles); })
      .catch(() => { /* فهرست داخلی باقی می‌ماند */ });
  }, []);

  useEffect(() => { loadJobTitles(); }, [loadJobTitles]);

  const syncJobTitles = useCallback(async () => {
    setJobSyncing(true);
    try {
      const d = await apiPost<{ message: string }>('/api/job-titles', {});
      toast.success(d.message || 'جدول مشاغل به‌روزرسانی شد');
      loadJobTitles();
    } catch (e) {
      toast.error((e as Error).message, { duration: 12000 });
    } finally {
      setJobSyncing(false);
    }
  }, [loadJobTitles]);

  // گزینه‌های مرکز هزینه / گروه فیش — همیشه fresh از سرور هنگام باز شدن فرم (گزاره ۲ و ۳)
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [payrollGroups, setPayrollGroups] = useState<string[]>([]);
  // گزاره ۷ — شمارش معکوس قرارداد
  const [warnDays, setWarnDays] = useState(7);
  const [expiryPerson, setExpiryPerson] = useState<PersonnelRow | null>(null);
  const contractWarnedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    try { setWarnDays(Number(localStorage.getItem(WARN_DAYS_KEY)) || 7); } catch { /* ignore */ }
  }, []);

  const changeWarnDays = (v: number) => {
    setWarnDays(v);
    try { localStorage.setItem(WARN_DAYS_KEY, String(v)); } catch { /* ignore */ }
  };

  // هشدار قرارداد رو به اتمام / منقضی — پس از هر بارگذاری لیست
  useEffect(() => {
    for (const p of rows) {
      const days = contractDaysLeft(p.endWorkDate);
      if (days === null) continue;
      if (days <= 0) { setExpiryPerson((cur) => cur ?? p); continue; }
      if (days <= warnDays && !contractWarnedRef.current.has(p.id)) {
        contractWarnedRef.current.add(p.id);
        toast.warning(`قرارداد این پرسنل رو به اتمام است، نسبت به عقد قرارداد جدید اقدام شود — ${p.firstName} ${p.lastName} (${toPersianDigits(days)} روز مانده)`);
      }
    }
  }, [rows, warnDays]);

  // مانده‌های اولیه
  const [obPerson, setObPerson] = useState<PersonnelRow | null>(null);
  const [obOpen, setObOpen] = useState(false);
  const [obRows, setObRows] = useState<ObRow[]>([]);
  const [obLoading, setObLoading] = useState(false);
  const [obForm, setObForm] = useState<ObForm>(OB_EMPTY);
  const [obEditingId, setObEditingId] = useState<number | null>(null);
  const [obSaving, setObSaving] = useState(false);

  // ستون‌های جدول پرسنل — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const personnelCols: DtColumn<PersonnelRow>[] = useMemo(() => [
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'personnelCode', header: 'کد پرسنلی',
      className: 'num font-medium',
      sortValue: (p) => Number(normalizeDigits(String(p.personnelCode))) || 0,
      filterValue: (p) => p.personnelCode,
      cell: (p) => <Fa>{p.personnelCode}</Fa>,
    },
    {
      key: 'name', header: 'نام و نام خانوادگی', className: 'font-medium',
      sortValue: (p) => `${p.firstName} ${p.lastName}`.trim(),
      filterValue: (p) => `${p.firstName} ${p.lastName} ${p.fatherName}`.trim(),
      cell: (p) => `${p.firstName} ${p.lastName}`.trim() || '—',
    },
    {
      key: 'nationalId', header: 'کد ملی', className: 'num',
      sortValue: (p) => p.nationalId || '', cell: (p) => <Fa>{p.nationalId || '—'}</Fa>,
    },
    {
      key: 'cardNo', header: 'شماره کارت', className: 'num',
      sortValue: (p) => p.cardNo || '', cell: (p) => <Fa>{p.cardNo || '—'}</Fa>,
    },
    {
      key: 'jobTitle', header: 'شغل',
      sortValue: (p) => p.jobTitle || '', cell: (p) => p.jobTitle || '—',
    },
    {
      key: 'department', header: 'بخش', align: 'center',
      sortValue: (p) => p.department || '', cell: (p) => p.department || 'عمومی',
    },
    {
      key: 'endWorkDate', header: 'پایان قرارداد', align: 'center', className: 'whitespace-nowrap',
      sortValue: (p) => p.endWorkDate || '', cell: (p) => <ContractCountdownBadge endDate={p.endWorkDate} />,
    },
    {
      key: 'status', header: 'وضعیت', align: 'center',
      sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'ops', header: 'عملیات', align: 'left', noSort: true, noFilter: true, headerClassName: 'w-52',
      cell: (p) => (
        <div className="flex items-center gap-0.5 justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="ویرایش" onClick={() => openEdit(p)}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            title="حذف" onClick={() => setDeleteTarget(p)}
          >
            <Trash2 size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-primary" title="قراردادها"
            onClick={() => openPersonContracts(p, 'contracts')}
          >
            <FileSignature size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-gold" title="احکام"
            onClick={() => openPersonContracts(p, 'decrees')}
          >
            <ScrollText size={14} />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-sky-600" title="مانده‌ها"
            onClick={() => openBalances(p)}
          >
            <Coins size={14} />
          </Button>
        </div>
      ),
    },
  ], [/* توابع پایدار از useState */]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(company.id) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const [data, all] = await Promise.all([
        apiGet<{ personnel: PersonnelRow[] }>(`/api/personnel?${params}`),
        apiGet<{ personnel: PersonnelRow[] }>(`/api/personnel?companyId=${company.id}`),
      ]);
      setRows(data.personnel);
      setTotalCount(all.personnel.length);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [company, q, status]);

  useEffect(() => {
    const t = setTimeout(() => { load(); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!company) { setShifts([]); return; }
    apiGet<{ shifts: Array<{ id: number; name: string }> }>(`/api/shifts?companyId=${company.id}`)
      .then((d) => setShifts(d.shifts))
      .catch(() => setShifts([]));
  }, [company]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY, workLocation: company?.name || '' });
    setDialogOpen(true);
  };

  const openEdit = (p: PersonnelRow) => {
    setEditingId(p.id);
    const { id: _id, shiftId, ssoWorkerPct, ssoEmployerPct, ssoUnempPct, ...rest } = p;
    // گزاره ۳ — بخش هتل و مرکز هزینه یکی هستند؛ اگر یکی پر و دیگری خالی است، خودکار هم‌گام می‌شوند
    const section = rest.department || rest.costCenter || '';
    setForm({
      ...rest,
      department: section,
      costCenter: section,
      workLocation: company?.name || rest.workLocation, // گزاره ۳ — محل خدمت = نام شرکت
      shiftId: shiftId ? String(shiftId) : '',
      ssoWorkerPct: ssoWorkerPct === null ? '' : String(ssoWorkerPct),
      ssoEmployerPct: ssoEmployerPct === null ? '' : String(ssoEmployerPct),
      ssoUnempPct: ssoUnempPct === null ? '' : String(ssoUnempPct),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!normalizeDigits(form.personnelCode).trim()) { toast.error('کد پرسنلی الزامی است'); return; }
    if (!form.firstName.trim() && !form.lastName.trim()) {
      toast.error('نام یا نام خانوادگی الزامی است');
      return;
    }
    // گزاره ۱ — راستی‌آزمایی کد ملی قبل از ارسال + قفل فعال‌سازی پرسنل غیرفعال
    if (form.nationalId && !isValidNationalId(form.nationalId)) {
      toast.error('کد ملی وارد شده معتبر نیست — ۱۰ رقم صحیح وارد کنید');
      return;
    }
    if (!form.nationalId && form.status !== 'غیرفعال') {
      toast.error('کد ملی الزامی است — فقط پرسنل غیرفعالِ واردشده از دستگاه حضور و غیاب بدون کد ملی ثبت می‌شود');
      return;
    }
    setSaving(true);
    try {
      // گزاره ۳ — محل خدمت همیشه نام شرکت فعال است
      const payload = { ...form, workLocation: company?.name || form.workLocation, ssoNumber: normalizeInsuranceNumber(form.ssoNumber), companyId: company?.id };
      if (editingId) {
        await apiPut(`/api/personnel/${editingId}`, payload);
        toast.success('اطلاعات پرسنل با موفقیت ویرایش شد');
      } else {
        await apiPost('/api/personnel', payload);
        toast.success('پرسنل جدید ثبت شد');
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // بارگذاری fresh مراکز هزینه و گروه‌های فیش — هنگام باز شدن دیالوگ فرم
  // (گروه‌ها ابتدا در ویرایش اطلاعات هتل تعریف می‌شوند، اینجا فقط انتخاب می‌شوند)
  useEffect(() => {
    if (!dialogOpen || !company) return;
    apiGet<{ costCenters: string[] }>(`/api/cost-centers?companyId=${company.id}`)
      .then((d) => setCostCenters(d.costCenters))
      .catch(() => setCostCenters([]));
    apiGet<{ groups: string[] }>(`/api/payroll-groups?companyId=${company.id}`)
      .then((d) => setPayrollGroups(d.groups))
      .catch(() => setPayrollGroups([]));
  }, [dialogOpen, company]);

  // گزاره ۵ — دکمه‌های قرارداد/احکام لیست، ماژول قرارداد و احکام را با فوکوس روی پرسنل باز می‌کنند
  const openPersonContracts = (p: PersonnelRow, tab: 'contracts' | 'decrees') => {
    setFocusPersonnel(tab, p.id);
    navigateTo('contracts');
  };

  // ─── مانده‌های اولیه ─────────────────────────────────────────────
  const loadOb = useCallback(async (personnelId: number) => {
    setObLoading(true);
    try {
      const d = await apiGet<{ rows: ObRow[] }>(`/api/personnel/${personnelId}/opening-balances`);
      setObRows(d.rows);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setObLoading(false);
    }
  }, []);

  const openBalances = (p: PersonnelRow) => {
    setObPerson(p);
    setObRows([]);
    setObForm(OB_EMPTY);
    setObEditingId(null);
    setObOpen(true);
    loadOb(p.id);
  };

  const editOb = (r: ObRow) => {
    setObEditingId(r.id);
    setObForm({
      title: r.title, kind: r.kind, unit: r.unit,
      amount: String(r.amount), effect: r.effect, notes: r.notes || '',
    });
  };

  const upOb = (patch: Partial<ObForm>) => setObForm((f) => ({ ...f, ...patch }));

  const upObKind = (k: ObKind) => setObForm((f) => ({
    ...f,
    kind: k,
    unit: k === 'seniority_days' || k === 'leave_balance' ? 'days' : 'amount',
  }));

  const saveOb = async () => {
    if (!obPerson) return;
    if (!obForm.title.trim()) { toast.error('شرح مانده الزامی است'); return; }
    setObSaving(true);
    try {
      const payload = {
        title: obForm.title.trim(),
        kind: obForm.kind,
        unit: obForm.unit,
        amount: parseNumberOr(obForm.amount, 0),
        effect: obForm.unit === 'amount' ? obForm.effect : 'none' as ObEffect,
        notes: obForm.notes.trim(),
      };
      if (obEditingId) {
        await apiPut(`/api/personnel/${obPerson.id}/opening-balances`, { id: obEditingId, ...payload });
        toast.success('مانده با موفقیت ویرایش شد');
      } else {
        await apiPost(`/api/personnel/${obPerson.id}/opening-balances`, payload);
        toast.success('مانده جدید ثبت شد');
      }
      setObForm(OB_EMPTY);
      setObEditingId(null);
      await loadOb(obPerson.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setObSaving(false);
    }
  };

  const deleteOb = async (r: ObRow) => {
    if (!obPerson) return;
    if (!window.confirm(`حذف مانده «${r.title}»؟ این عملیات قابل بازگشت نیست.`)) return;
    try {
      await apiDelete(`/api/personnel/${obPerson.id}/opening-balances?id=${r.id}`);
      toast.success('مانده حذف شد');
      await loadOb(obPerson.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/personnel/${deleteTarget.id}`);
      toast.success('پرسنل حذف شد');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!company || !fy) {
    return (
      <div>
        <PageHeader title="پرسنل" icon={<Users size={20} />} />
        <Card>
          <EmptyState
            title="ابتدا شرکت و سال مالی را ثبت کنید"
            hint="از بخش «شرکت و سال مالی» شرکت خود و یک سال مالی ثبت و فعال کنید"
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="پرسنل"
        subtitle={`${company.name} — سال مالی ${toPersianDigits(fy.jy)}`}
        icon={<Users size={20} />}
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus size={16} /> افزودن پرسنل
          </Button>
        }
      />

      <Card className="shadow-luxe border-border/70">
        {/* نوار ابزار */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border/60">
          <div className="relative flex-1 min-w-52 max-w-xs">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو: نام، کد پرسنلی، کد ملی…"
              className="pr-9 h-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="همه">همه</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-[12.5px] text-muted-foreground mr-auto">
            نمایش <Fa>{rows.length}</Fa> از <Fa>{totalCount}</Fa> نفر
          </span>
          {/* گزاره ۷ — آستانه هشدار پایان قرارداد */}
          <div className="flex items-center gap-1.5">
            <AlarmClock size={14} className="text-muted-foreground" />
            <span className="text-[11.5px] text-muted-foreground">هشدار پایان قرارداد:</span>
            <Select value={String(warnDays)} onValueChange={(v) => changeWarnDays(parseIntOr(v, 7))}>
              <SelectTrigger className="w-[74px] h-8 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 7, 15, 30].map((d) => (
                  <SelectItem key={d} value={String(d)}>{toPersianDigits(d)} روز</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(q || status !== 'همه') && (
            <Button variant="ghost" size="sm" className="gap-1 h-8 text-[12px]" onClick={() => { setQ(''); setStatus('همه'); }}>
              <RotateCcw size={13} /> حذف فیلترها
            </Button>
          )}
        </div>

        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState
            title="پرسنلی یافت نشد"
            hint="با دکمه «افزودن پرسنل» اولین پرسنل خود را ثبت کنید"
            icon={<Users size={28} />}
          />
        ) : (
          <DataTable
            id="personnel"
            columns={personnelCols}
            rows={rows}
            rowKey={(p) => p.id}
            containerClassName="max-h-[62vh]"
            defaultSort={{ key: 'personnelCode', dir: 'asc' }}
          />
        )}
      </Card>

      {/* دیالوگ فرم پرسنل */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'ویرایش پرسنل' : 'افزودن پرسنل'}</DialogTitle>
            <DialogDescription>
              اطلاعات در چهار گروه هویتی، شغلی، بانک و بیمه، و شیفت سازمان‌دهی شده است. فیلدهای ستاره‌دار الزامی هستند.
            </DialogDescription>
          </DialogHeader>
          <PersonFormFields
            form={form}
            set={setForm}
            shifts={shifts}
            companyName={company.name}
            costCenters={costCenters}
            payrollGroups={payrollGroups}
            jobTitles={jobTitles}
            onSyncJobTitles={() => void syncJobTitles()}
            jobSyncing={jobSyncing}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5 min-w-28">
              <Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تایید حذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader dir="rtl">
            <AlertDialogTitle>
              حذف پرسنل «{deleteTarget?.firstName} {deleteTarget?.lastName}»؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              با حذف پرسنل، قراردادها، احکام و انتساب‌های شیفت او نیز حذف خواهند شد. این عملیات قابل بازگشت نیست.
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

      {/* گزاره ۷ — دیالوگ قرارداد منقضی شده */}
      <AlertDialog open={!!expiryPerson} onOpenChange={(o) => !o && setExpiryPerson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader dir="rtl">
            <AlertDialogTitle>قرارداد منقضی شده</AlertDialogTitle>
            <AlertDialogDescription>
              قرارداد {expiryPerson?.firstName} {expiryPerson?.lastName} منقضی شده است — پرسنل جهت تسویه حساب
              و اعلام به اداره امور مالیاتی و بیمه تامین اجتماعی معرفی شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>بعداً</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (expiryPerson) {
                  setFocusPersonnel('settlement', expiryPerson.id);
                  navigateTo('settlement');
                }
                setExpiryPerson(null);
              }}
            >
              رفتن به تسویه حساب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* دیالوگ مانده‌های اولیه */}
      <Dialog open={obOpen} onOpenChange={setObOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              مانده‌های اولیه — {obPerson ? `${obPerson.firstName} ${obPerson.lastName}`.trim() : ''}
            </DialogTitle>
            <DialogDescription>
              مانده‌های اولیه شخص در ابتدای دوره مالی. ردیف‌های مصرف‌شده در حقوق و دستمزد به‌صورت اطلاعاتی نمایش داده می‌شوند.
            </DialogDescription>
          </DialogHeader>

          {/* جدول مانده‌های ثبت‌شده */}
          {obLoading ? (
            <LoadingBlock />
          ) : obRows.length === 0 ? (
            <EmptyState
              title="مانده‌ای ثبت نشده است"
              hint="با فرم زیر اولین مانده اولیه این شخص را ثبت کنید"
            />
          ) : (
            <div className="rounded-md border border-border/70 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>شرح</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead className="text-center">واحد</TableHead>
                    <TableHead className="text-center">مبلغ/روز</TableHead>
                    <TableHead>اثر در حقوق</TableHead>
                    <TableHead className="text-center">وضعیت</TableHead>
                    <TableHead className="text-left">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obRows.map((r) => (
                    <TableRow key={r.id} className={obEditingId === r.id ? 'bg-muted/50' : undefined}>
                      <TableCell className="font-medium">
                        {r.title}
                        {r.notes && <p className="text-[10.5px] text-muted-foreground mt-0.5">{r.notes}</p>}
                      </TableCell>
                      <TableCell>{obKindLabel(r.kind)}</TableCell>
                      <TableCell className="text-center">{obUnitLabel(r.unit)}</TableCell>
                      <TableCell className="num text-center font-medium">{formatObAmount(r)}</TableCell>
                      <TableCell>{r.unit === 'amount' ? obEffectLabel(r.effect) : '—'}</TableCell>
                      <TableCell className="text-center">
                        {r.consumed ? (
                          <Badge variant="secondary" className="num text-[10.5px]">
                            مصرف‌شده{r.usedPeriod ? ` — ${toPersianDigits(r.usedPeriod)}` : ''}
                          </Badge>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">آزاد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 justify-end">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7" title="ویرایش"
                            onClick={() => editOb(r)}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive" title="حذف"
                            onClick={() => deleteOb(r)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* فرم درج/ویرایش */}
          <div className="rounded-md border border-border/70 p-4 space-y-3.5">
            <p className="text-[12.5px] font-medium">
              {obEditingId ? 'ویرایش مانده' : 'افزودن مانده جدید'}
            </p>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
              <Fld label="شرح" required>
                <Input
                  value={obForm.title}
                  onChange={(e) => upOb({ title: e.target.value })}
                  placeholder="مثلا مانده مرخصی سال قبل"
                />
              </Fld>
              <Fld label="نوع">
                <Select value={obForm.kind} onValueChange={(v) => upObKind(v as ObKind)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OB_KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Fld>
              <Fld label="واحد">
                <Select value={obForm.unit} onValueChange={(v) => upOb({ unit: v as ObUnit })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OB_UNITS.map((u) => <SelectItem key={u.v} value={u.v}>{u.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Fld>
              <Fld label={obForm.unit === 'days' ? 'مقدار (روز)' : 'مبلغ (ریال)'}>
                <Input
                  className="num"
                  value={obForm.amount}
                  onChange={(e) => upOb({ amount: normalizeDigits(e.target.value) })}
                  placeholder={obForm.unit === 'days' ? '۱۲٫۵' : '۵٬۰۰۰٬۰۰۰'}
                />
              </Fld>
              <Fld
                label="اثر در حقوق"
                hint={obForm.unit === 'days' ? 'برای واحد روز اثر در حقوق اعمال نمی‌شود' : undefined}
              >
                <Select
                  value={obForm.effect}
                  onValueChange={(v) => upOb({ effect: v as ObEffect })}
                  disabled={obForm.unit === 'days'}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OB_EFFECTS.map((ef) => <SelectItem key={ef.v} value={ef.v}>{ef.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Fld>
              <Fld label="یادداشت">
                <Input value={obForm.notes} onChange={(e) => upOb({ notes: e.target.value })} />
              </Fld>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={saveOb} disabled={obSaving} className="gap-1.5 min-w-28">
                <Save size={15} /> {obSaving ? 'در حال ذخیره…' : obEditingId ? 'ذخیره تغییرات' : 'افزودن'}
              </Button>
              {obEditingId && (
                <Button
                  variant="outline"
                  onClick={() => { setObEditingId(null); setObForm(OB_EMPTY); }}
                >
                  انصراف از ویرایش
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
