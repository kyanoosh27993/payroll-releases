'use client';
// ماژول شیفت‌های کاری — تعریف شیفت با برنامه هفتگی و انتساب ماهانه به پرسنل
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Plus, Pencil, Trash2, Save, CalendarClock, CalendarDays } from 'lucide-react';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState, LoadingBlock, Fa } from '@/components/shared';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { normalizeDigits, parseIntOr, toPersianDigits } from '@/lib/core/numbers';
import { daysInMonth, weekday, WEEKDAY_NAMES } from '@/lib/core/jalali';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataTable, type DtColumn } from '@/components/data-table';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

interface ShiftRow { id: number; companyId: number; name: string; schedule: string; premiumPct: number; notes: string }

interface AssignmentRow { id: number; personnelId: number; jy: number; jm: number; shiftId: number }
interface PersonLite { id: number; personnelCode: string; firstName: string; lastName: string }
interface OverrideRow { id: number; personnelId: number; jy: number; jm: number; jd: number; kind: string; shiftId: number | null; startMin: number; endMin: number; note: string }

const OV_KIND_LABEL: Record<string, string> = { off: 'تعطیل برای فرد', custom: 'ساعت کاری خاص', shift: 'شیفت تعریف‌شده' };

/** دقیقه از نیمه‌شب → HH:MM */
function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** HH:MM → دقیقه (نامعتبر → null) */
function hhmmToMin(s: string): number | null {
  const t = normalizeDigits(s).trim();
  const m = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (h < 0 || h > 24 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** خلاصه برنامه هفتگی: «شنبه تا پنجشنبه ۸:۰۰ تا ۱۶:۰۰» یا فهرست روزها */
function scheduleSummary(scheduleJson: string): string {
  let sch: Record<string, number[]> = {};
  try { sch = JSON.parse(scheduleJson || '{}'); } catch { return 'برنامه ثبت نشده'; }
  const active = Object.keys(sch)
    .map(Number)
    .filter((d) => d >= 0 && d <= 6 && Array.isArray(sch[String(d)]))
    .sort((a, b) => a - b);
  if (active.length === 0) return 'برنامه ثبت نشده';
  const fmt = (d: number) => `${DAY_NAMES[d]} ${toPersianDigits(minToHHMM(sch[String(d)][0]))} تا ${toPersianDigits(minToHHMM(sch[String(d)][1]))}`;
  // گروه‌بندی روزهای پیوسته با ساعت یکسان
  type Group = { days: number[]; from: number; to: number };
  const groups: Group[] = [];
  for (const d of active) {
    const [from, to] = sch[String(d)];
    const last = groups[groups.length - 1];
    if (last && last.to === d - 1 && last.from === from && sch[String(last.days[0])][1] === to) {
      last.days.push(d);
      last.to = d;
    } else {
      groups.push({ days: [d], from, to: d });
    }
  }
  return groups
    .map((g) =>
      g.days.length === 1
        ? fmt(g.days[0])
        : `${DAY_NAMES[g.days[0]]} تا ${DAY_NAMES[g.days[g.days.length - 1]]} ${toPersianDigits(minToHHMM(g.from))} تا ${toPersianDigits(minToHHMM(sch[String(g.days[0])][1]))}`,
    )
    .join(' و ');
}

type DayForm = { enabled: boolean; from: string; to: string };
interface ShiftForm { name: string; notes: string; premiumPct: string; days: DayForm[] }
const EMPTY_SHIFT: ShiftForm = {
  name: '', notes: '', premiumPct: '10',
  days: Array.from({ length: 7 }, () => ({ enabled: false, from: '08:00', to: '16:00' })),
};

function parseScheduleToForm(scheduleJson: string): DayForm[] {
  let sch: Record<string, number[]> = {};
  try { sch = JSON.parse(scheduleJson || '{}'); } catch { sch = {}; }
  return Array.from({ length: 7 }, (_, d) => {
    const v = sch[String(d)];
    return Array.isArray(v)
      ? { enabled: true, from: minToHHMM(v[0]), to: minToHHMM(v[1]) }
      : { enabled: false, from: '08:00', to: '16:00' };
  });
}

export default function ShiftsModule() {
  const { company, fy } = useApp();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_SHIFT);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShiftRow | null>(null);

  // انتساب ماهانه
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [personnelId, setPersonnelId] = useState('');
  const [jm, setJm] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // شیفت روزانه/تک‌روزه (نسخه ۱.۴)
  const [ovJm, setOvJm] = useState('');
  const [ovPersonId, setOvPersonId] = useState('');
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovSaving, setOvSaving] = useState(false);
  const [ovDialog, setOvDialog] = useState<{ jd: number } | null>(null);
  const [ovKind, setOvKind] = useState<'off' | 'custom' | 'shift'>('custom');
  const [ovFrom, setOvFrom] = useState('08:00');
  const [ovTo, setOvTo] = useState('16:00');
  const [ovShiftId, setOvShiftId] = useState('');
  const [ovNote, setOvNote] = useState('');

  const loadShifts = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const data = await apiGet<{ shifts: ShiftRow[] }>(`/api/shifts?companyId=${company.id}`);
      setShifts(data.shifts);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  useEffect(() => {
    if (!company) { setPeople([]); return; }
    apiGet<{ personnel: PersonLite[] }>(`/api/personnel?companyId=${company.id}`)
      .then((d) => setPeople(d.personnel))
      .catch(() => setPeople([]));
  }, [company]);

  const currentJy = fy?.jy ?? 0;

  const loadAssignments = useCallback(async () => {
    if (!company || !jm || !currentJy) { setAssignments([]); return; }
    setAssignLoading(true);
    try {
      const data = await apiGet<{ assignments: AssignmentRow[] }>(
        `/api/shifts/assign?companyId=${company.id}&jy=${currentJy}&jm=${jm}`,
      );
      setAssignments(data.assignments);
    } catch {
      setAssignments([]);
    } finally {
      setAssignLoading(false);
    }
  }, [company, currentJy, jm]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // --- شیفت روزانه: بارگذاری استثناها ---
  const loadOverrides = useCallback(async () => {
    if (!company || !ovJm || !currentJy) { setOverrides([]); return; }
    setOvLoading(true);
    try {
      const pid = parseIntOr(ovPersonId, 0);
      const url = `/api/shifts/override?companyId=${company.id}&jy=${currentJy}&jm=${ovJm}${pid ? `&personnelId=${pid}` : ''}`;
      const data = await apiGet<{ overrides: OverrideRow[] }>(url);
      setOverrides(data.overrides);
    } catch {
      setOverrides([]);
    } finally {
      setOvLoading(false);
    }
  }, [company, currentJy, ovJm, ovPersonId]);

  useEffect(() => { loadOverrides(); }, [loadOverrides]);

  const openDayEditor = (jd: number) => {
    const existing = overrides.find((o) => o.personnelId === parseIntOr(ovPersonId, 0) && o.jd === jd);
    if (existing) {
      setOvKind(existing.kind as 'off' | 'custom' | 'shift');
      setOvFrom(minToHHMM(existing.startMin));
      setOvTo(minToHHMM(existing.endMin));
      setOvShiftId(existing.shiftId ? String(existing.shiftId) : '');
      setOvNote(existing.note);
    } else {
      setOvKind('custom'); setOvFrom('08:00'); setOvTo('16:00'); setOvShiftId(''); setOvNote('');
    }
    setOvDialog({ jd });
  };

  const saveDayOverride = async () => {
    const pid = parseIntOr(ovPersonId, 0);
    if (!pid || !ovJm || !ovDialog) { toast.error('ابتدا فرد و ماه را انتخاب کنید'); return; }
    if (ovKind === 'custom') {
      const from = hhmmToMin(ovFrom), to = hhmmToMin(ovTo);
      if (from === null || to === null) { toast.error('ساعت شروع/پایان نامعتبر است (قالب HH:MM)'); return; }
      if (to <= from) { toast.error('ساعت پایان باید بعد از ساعت شروع باشد'); return; }
    }
    if (ovKind === 'shift' && !ovShiftId) { toast.error('شیفت موردنظر را انتخاب کنید'); return; }
    setOvSaving(true);
    try {
      const from = hhmmToMin(ovFrom) ?? 480, to = hhmmToMin(ovTo) ?? 960;
      await apiPost('/api/shifts/override', {
        personnelId: pid, jy: currentJy, jm: parseIntOr(ovJm, 0), jd: ovDialog.jd,
        kind: ovKind, startMin: from, endMin: to,
        shiftId: parseIntOr(ovShiftId, 0), note: ovNote,
      });
      toast.success(`شیفت روز ${toPersianDigits(ovDialog.jd)} ثبت شد — برای اعمال، حضور و غیاب آن ماه را بازمحاسبه کنید`);
      setOvDialog(null);
      await loadOverrides();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOvSaving(false);
    }
  };

  const deleteDayOverride = async (jd: number) => {
    const pid = parseIntOr(ovPersonId, 0);
    const existing = overrides.find((o) => o.personnelId === pid && o.jd === jd);
    if (!existing) return;
    try {
      await apiDelete(`/api/shifts/override?id=${existing.id}`);
      toast.success('استثنای آن روز حذف شد — طبق الگوی ماهانه محاسبه می‌شود');
      setOvDialog(null);
      await loadOverrides();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const clearMonthOverrides = async () => {
    const pid = parseIntOr(ovPersonId, 0);
    if (!pid || !ovJm) return;
    try {
      const res = await apiDelete<{ deleted: number }>(`/api/shifts/override?personnelId=${pid}&jy=${currentJy}&jm=${ovJm}`);
      toast.success(`${toPersianDigits(res.deleted)} استثنا حذف شد`);
      await loadOverrides();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SHIFT);
    setDialogOpen(true);
  };
  const openEdit = (s: ShiftRow) => {
    setEditing(s);
    setForm({ name: s.name, notes: s.notes, premiumPct: String(s.premiumPct ?? 10), days: parseScheduleToForm(s.schedule) });
    setDialogOpen(true);
  };

  const saveShift = async () => {
    if (!form.name.trim()) { toast.error('نام شیفت الزامی است'); return; }
    const anyDay = form.days.some((d) => d.enabled);
    if (!anyDay) { toast.error('حداقل یک روز هفته را فعال کنید'); return; }
    // تبدیل ساعت‌ها به دقیقه
    const schedule: Record<string, number[]> = {};
    for (let d = 0; d < 7; d++) {
      const day = form.days[d];
      if (!day.enabled) continue;
      const from = hhmmToMin(day.from);
      const to = hhmmToMin(day.to);
      if (from === null || to === null) {
        toast.error(`ساعت شروع/پایان «${DAY_NAMES[d]}» نامعتبر است (قالب HH:MM)`);
        return;
      }
      if (to <= from) {
        toast.error(`ساعت پایان «${DAY_NAMES[d]}» باید بعد از ساعت شروع باشد`);
        return;
      }
      schedule[String(d)] = [from, to];
    }
    setSaving(true);
    try {
      if (editing) {
        await apiPut(`/api/shifts/${editing.id}`, { name: form.name, notes: form.notes, premiumPct: form.premiumPct, schedule });
        toast.success('شیفت ویرایش شد');
      } else {
        await apiPost('/api/shifts', { companyId: company?.id, name: form.name, notes: form.notes, premiumPct: form.premiumPct, schedule });
        toast.success('شیفت جدید ثبت شد');
      }
      setDialogOpen(false);
      await loadShifts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doDeleteShift = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/shifts/${deleteTarget.id}`);
      toast.success('شیفت حذف شد');
      await loadShifts();
      await loadAssignments();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const submitAssignment = async () => {
    if (!personnelId || !jm || !assignShiftId) {
      toast.error('پرسنل، ماه و شیفت را انتخاب کنید');
      return;
    }
    try {
      await apiPost('/api/shifts/assign', {
        personnelId: parseIntOr(personnelId, 0),
        jy: currentJy,
        jm: parseIntOr(jm, 0),
        shiftId: parseIntOr(assignShiftId, 0),
      });
      toast.success('انتساب شیفت ثبت شد');
      await loadAssignments();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const deleteAssignment = useCallback(async (id: number) => {
    try {
      await apiDelete(`/api/shifts/assign?id=${id}`);
      toast.success('انتساب حذف شد');
      await loadAssignments();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [loadAssignments]);

  if (!company || !fy) {
    return (
      <div>
        <PageHeader title="شیفت‌های کاری" icon={<Clock size={20} />} />
        <Card>
          <EmptyState
            title="ابتدا شرکت و سال مالی را ثبت کنید"
            hint="از بخش «شرکت و سال مالی» شرکت خود و یک سال مالی ثبت و فعال کنید"
          />
        </Card>
      </div>
    );
  }

  const personName = (id: number) => {
    const p = people.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : `#${id}`;
  };
  const shiftName = (id: number) => shifts.find((s) => s.id === id)?.name ?? `#${id}`;

  // ستون‌های جدول انتساب‌های ماهانه — سورت/فیلتر/نمایش و مخفی‌سازی روی هر ستون
  const assignCols: DtColumn<AssignmentRow>[] = useMemo(() => [
    {
      key: 'row', header: 'ردیف', align: 'center', noSort: true, noFilter: true, headerClassName: 'w-12',
      cell: (_, i) => <Fa>{i + 1}</Fa>,
    },
    {
      key: 'person', header: 'پرسنل',
      sortValue: (a) => personName(a.personnelId),
      cell: (a) => personName(a.personnelId),
    },
    {
      key: 'shift', header: 'شیفت',
      sortValue: (a) => shiftName(a.shiftId),
      cell: (a) => <Badge variant="outline">{shiftName(a.shiftId)}</Badge>,
    },
    {
      key: 'month', header: 'ماه',
      sortValue: (a) => a.jm,
      cell: (a) => <>{MONTH_NAMES[a.jm - 1]} {toPersianDigits(a.jy)}</>,
    },
    {
      key: 'ops', header: 'عملیات', align: 'left', noSort: true, noFilter: true, headerClassName: 'w-20',
      cell: (a) => (
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => deleteAssignment(a.id)} title="حذف"
        >
          <Trash2 size={14} />
        </Button>
      ),
    },
  ], [people, shifts, deleteAssignment]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader
        title="شیفت‌های کاری"
        subtitle={`${company.name} — تعریف برنامه هفتگی و انتساب ماهانه`}
        icon={<Clock size={20} />}
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus size={16} /> شیفت جدید
          </Button>
        }
      />

      {/* فهرست شیفت‌ها */}
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : shifts.length === 0 ? (
        <Card>
          <EmptyState
            title="هنوز شیفت‌ی تعریف نشده است"
            hint="با دکمه «شیفت جدید» برنامه هفتگی شیفت کاری را تعریف کنید"
            icon={<Clock size={28} />}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shifts.map((s) => (
            <Card key={s.id} className="p-5 shadow-luxe border-border/70">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{s.name}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">{scheduleSummary(s.schedule)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title="ویرایش">
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(s)} title="حذف"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {s.notes && <p className="mt-3 text-[12px] text-muted-foreground border-t border-border/60 pt-2.5">{s.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      {/* انتساب ماهانه */}
      <Card className="mt-6 shadow-luxe border-border/70">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarClock size={18} className="text-primary" />
            <h2 className="font-bold">انتساب ماهانه شیفت</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            انتساب شیفت برای هر پرسنل در هر ماه (سال مالی فعال: {toPersianDigits(currentJy)})
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56 space-y-1.5">
              <Label className="text-[12px]">پرسنل</Label>
              <SearchableSelect
                value={personnelId}
                onValueChange={setPersonnelId}
                placeholder="انتخاب پرسنل…"
                searchPlaceholder="جستجوی نام یا کد پرسنلی…"
                options={people.map((p) => ({
                  value: String(p.id),
                  label: `${p.personnelCode} — ${p.firstName} ${p.lastName}`,
                }))}
              />
            </div>
            <div className="w-40 space-y-1.5">
              <Label className="text-[12px]">ماه</Label>
              <SearchableSelect
                value={jm}
                onValueChange={setJm}
                placeholder="انتخاب ماه"
                searchPlaceholder="جستجوی ماه…"
                options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
              />
            </div>
            <div className="w-44 space-y-1.5">
              <Label className="text-[12px]">شیفت</Label>
              <SearchableSelect
                value={assignShiftId}
                onValueChange={setAssignShiftId}
                placeholder="انتخاب شیفت"
                searchPlaceholder="جستجوی شیفت…"
                options={shifts.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </div>
            <Button className="gap-1.5 h-9" onClick={submitAssignment}>
              <CalendarDays size={15} /> ثبت انتساب
            </Button>
          </div>
        </div>

        <div className="border-t border-border/60 p-5 pt-4">
          <p className="text-[13px] font-medium mb-3">
            انتساب‌های ماه{' '}
            {jm ? MONTH_NAMES[parseIntOr(jm, 1) - 1] : '—'} {toPersianDigits(currentJy)}
          </p>
          {assignLoading ? (
            <LoadingBlock rows={2} />
          ) : (
            <DataTable
              id="shifts-assign"
              columns={assignCols}
              rows={assignments}
              rowKey={(a) => a.id}
              containerClassName="max-h-72"
              empty={
                <p className="text-[12.5px] text-muted-foreground py-3">
                  برای این ماه انتسابی ثبت نشده است. پرسنل بدون انتساب، از شیفت پیش‌فرض پرسنل‌نامه پیروی می‌کنند.
                </p>
              }
            />
          )}
        </div>
      </Card>

      {/* شیفت روزانه/تک‌روزه (نسخه ۱.۴) */}
      <Card className="mt-6 shadow-luxe border-border/70">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={18} className="text-primary" />
            <h2 className="font-bold">شیفت روزانه و تک‌روزه (ساعت کاری متفاوت برای روزهای خاص)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            برای هر فرد می‌توانید یک روز مشخص را «تعطیل» یا با «ساعت کاری متفاوت» تعریف کنید؛ این تعریف بر الگوی ماهانه و شیفت پیش‌فرض فرد اولویت دارد.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56 space-y-1.5">
              <Label className="text-[12px]">پرسنل</Label>
              <SearchableSelect
                value={ovPersonId}
                onValueChange={setOvPersonId}
                placeholder="انتخاب پرسنل…"
                searchPlaceholder="جستجوی نام یا کد پرسنلی…"
                options={people.map((p) => ({
                  value: String(p.id),
                  label: `${p.personnelCode} — ${p.firstName} ${p.lastName}`,
                }))}
              />
            </div>
            <div className="w-40 space-y-1.5">
              <Label className="text-[12px]">ماه</Label>
              <SearchableSelect
                value={ovJm}
                onValueChange={setOvJm}
                placeholder="انتخاب ماه"
                searchPlaceholder="جستجوی ماه…"
                options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
              />
            </div>
            {ovPersonId && ovJm && overrides.filter((o) => o.personnelId === parseIntOr(ovPersonId, 0)).length > 0 && (
              <Button variant="outline" className="h-9 gap-1.5 text-destructive hover:text-destructive" onClick={clearMonthOverrides}>
                <Trash2 size={14} /> حذف همه استثناهای این ماه
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 p-5 pt-4">
          {ovLoading ? (
            <LoadingBlock rows={2} />
          ) : !ovPersonId || !ovJm ? (
            <p className="text-[12.5px] text-muted-foreground py-3">
              فرد و ماه را انتخاب کنید تا تقویم روزهای ماه نمایش داده شود.
            </p>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {Array.from({ length: daysInMonth(currentJy, parseIntOr(ovJm, 1)) }, (_, i) => i + 1).map((jd) => {
                const pid = parseIntOr(ovPersonId, 0);
                const ov = overrides.find((o) => o.personnelId === pid && o.jd === jd);
                const wd = weekday(currentJy, parseIntOr(ovJm, 1), jd);
                return (
                  <button
                    key={jd}
                    onClick={() => openDayEditor(jd)}
                    className={'rounded-xl border p-2.5 text-right transition-colors hover:border-primary/50 hover:bg-primary/5 ' + (
                      ov ? (ov.kind === 'off' ? 'border-destructive/50 bg-destructive/5' : 'border-primary/50 bg-primary/5') : 'border-border/70'
                    )}
                    title="کلیک برای تعریف/ویرایش شیفت این روز"
                  >
                    <div className="flex items-center justify-between">
                      <span className="num text-[13px] font-bold">{toPersianDigits(jd)}</span>
                      <span className="text-[10.5px] text-muted-foreground">{WEEKDAY_NAMES[wd]}</span>
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-4">
                      {ov ? (
                        ov.kind === 'off' ? <span className="text-destructive font-medium">تعطیل برای فرد</span>
                          : ov.kind === 'custom' ? <span className="num text-primary font-medium">{toPersianDigits(minToHHMM(ov.startMin))} تا {toPersianDigits(minToHHMM(ov.endMin))}</span>
                            : <span className="text-primary font-medium">{shiftName(ov.shiftId ?? 0)}</span>
                      ) : (
                        <span className="text-muted-foreground">طبق الگوی ماه/پیش‌فرض</span>
                      )}
                    </p>
                    {ov?.note && <p className="text-[9.5px] text-muted-foreground mt-0.5 truncate">{ov.note}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* دیالوگ ویرایش شیفت یک روز */}
      <Dialog open={!!ovDialog} onOpenChange={(o) => !o && setOvDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              شیفت روز {ovDialog ? toPersianDigits(ovDialog.jd) : ''}{' '}
              {ovJm ? MONTH_NAMES[parseIntOr(ovJm, 1) - 1] : ''} {toPersianDigits(currentJy)}
              {' — '}{ovPersonId ? personName(parseIntOr(ovPersonId, 0)) : ''}
            </DialogTitle>
            <DialogDescription>
              نوع استثنای این روز را انتخاب کنید؛ برای بازگشت به الگوی ماهانه، «حذف استثنا» را بزنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div className="grid grid-cols-3 gap-1.5">
              {(['off', 'custom', 'shift'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setOvKind(k)}
                  className={'rounded-lg border px-2 py-2 text-[12px] font-medium transition-colors ' + (ovKind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground hover:bg-muted/40')}
                >
                  {OV_KIND_LABEL[k]}
                </button>
              ))}
            </div>
            {ovKind === 'off' && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12px] leading-6 text-muted-foreground space-y-1">
                <p>تعریف شیفت «تعطیل برای فرد» یعنی اینکه آن روز شخص تعطیل بوده است: ساعات موظفی آن روز صفر لحاظ می‌شود و فرد «غایب» حساب نمی‌شود.</p>
                <p>برای پرسنل قرارداد ساعتی، این روزها معادل مرخصی بدون حقوق است و در محاسبات پایان سال (عیدی، پاداش، سنوات) اصلاً محاسبه نمی‌شوند.</p>
                <p>برای سایر پرسنل، این روز به‌عنوان روز پرداخت‌شده (مساوی یک روز کاری) لحاظ می‌شود؛ اگر همان روز کار کرده باشد، کارکرد واقعی او محاسبه می‌شود.</p>
                <p>اگر آن روز در تقویم برنامه «تعطیل رسمی» ثبت شده باشد و پرسنل در آن روز اشتغال داشته باشد، کارکرد او به‌عنوان «تعطیل‌کاری» با ضریب قانونی محاسبه می‌شود.</p>
              </div>
            )}
            {ovKind === 'custom' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">از ساعت</Label>
                  <Input className="num h-9 text-center" value={ovFrom} onChange={(e) => setOvFrom(normalizeDigits(e.target.value))} placeholder="۱۰:۰۰" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">تا ساعت</Label>
                  <Input className="num h-9 text-center" value={ovTo} onChange={(e) => setOvTo(normalizeDigits(e.target.value))} placeholder="۱۸:۰۰" />
                </div>
              </div>
            )}
            {ovKind === 'shift' && (
              <div className="space-y-1.5">
                <Label className="text-[12px]">شیفت تعریف‌شده (فقط همین روز)</Label>
                <SearchableSelect
                  value={ovShiftId}
                  onValueChange={setOvShiftId}
                  placeholder="انتخاب شیفت"
                  searchPlaceholder="جستجوی شیفت…"
                  options={shifts.map((s) => ({ value: String(s.id), label: s.name }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[12px]">یادداشت (اختیاری)</Label>
              <Input value={ovNote} onChange={(e) => setOvNote(e.target.value)} placeholder="مثال: آموزش، پذیرش شب، ..." />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline" className="text-destructive hover:text-destructive"
              onClick={() => ovDialog && deleteDayOverride(ovDialog.jd)}
            >
              حذف استثنا
            </Button>
            <Button onClick={saveDayOverride} disabled={ovSaving} className="gap-1.5 min-w-24">
              <Save size={15} /> {ovSaving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ شیفت */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `ویرایش شیفت — ${editing.name}` : 'تعریف شیفت جدید'}</DialogTitle>
            <DialogDescription>
              روزهای هفته را فعال و ساعت شروع و پایان را تعیین کنید (قالب ۲۴ ساعته HH:MM).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">نام شیفت<span className="text-destructive"> *</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: اداری صبح" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">یادداشت</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
              <Label className="text-[12.5px]">درصد حق شیفت (نوبت‌کاری)</Label>
              <div className="flex items-center gap-2">
                <Input
                  className="num h-8 w-24 text-center text-[13px]"
                  value={form.premiumPct}
                  onChange={(e) => setForm({ ...form, premiumPct: normalizeDigits(e.target.value) })}
                  placeholder="۱۰"
                />
                <span className="text-[12.5px] text-muted-foreground">درصد — روی ساعات کارکرد غیرشبِ افرادِ این شیفت پرداخت می‌شود (پیش‌فرض ۱۰٪؛ شب‌کاری ۲۲–۰۶ جداگانه ۳۵٪ محاسبه می‌شود)</span>
              </div>
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {form.days.map((d, i) => (
                <div
                  key={i}
                  className={'rounded-xl border p-3 space-y-2.5 transition-colors ' + (d.enabled ? 'border-primary/40 bg-primary/5' : 'border-border/70')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-medium">{DAY_NAMES[i]}</span>
                    <Switch
                      checked={d.enabled}
                      onCheckedChange={(v) => {
                        const days = [...form.days];
                        days[i] = { ...days[i], enabled: v };
                        setForm({ ...form, days });
                      }}
                      aria-label={`فعال بودن ${DAY_NAMES[i]}`}
                    />
                  </div>
                  <div className={d.enabled ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-2 gap-1.5 opacity-40 pointer-events-none'}>
                    <Input
                      className="num h-8 text-[12px] text-center"
                      value={d.from}
                      onChange={(e) => {
                        const days = [...form.days];
                        days[i] = { ...days[i], from: normalizeDigits(e.target.value) };
                        setForm({ ...form, days });
                      }}
                      placeholder="۰۸:۰۰"
                      aria-label={`شروع ${DAY_NAMES[i]}`}
                    />
                    <Input
                      className="num h-8 text-[12px] text-center"
                      value={d.to}
                      onChange={(e) => {
                        const days = [...form.days];
                        days[i] = { ...days[i], to: normalizeDigits(e.target.value) };
                        setForm({ ...form, days });
                      }}
                      placeholder="۱۶:۰۰"
                      aria-label={`پایان ${DAY_NAMES[i]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
            <Button onClick={saveShift} disabled={saving} className="gap-1.5 min-w-28">
              <Save size={15} /> {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تایید حذف شیفت */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader dir="rtl">
            <AlertDialogTitle>حذف شیفت «{deleteTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              انتساب‌های ماهانه این شیفت حذف و شیفت پیش‌فرض پرسنل مرتبط پاک می‌شود. این عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={doDeleteShift}>
              بله، حذف شود
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
