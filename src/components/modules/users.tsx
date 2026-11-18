'use client';
// مدیریت کاربران — سوپروایزر و مدیر؛ اکانت سوپروایزر مخفی است و اینجا دیده نمی‌شود
import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Unlock, CalendarClock } from 'lucide-react';
import { DataTable, type DtColumn } from '@/components/data-table';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { useApp } from '@/components/app-state';

interface UserRow {
  id: number; username: string; fullName: string; role: string;
  active: boolean; mustChangePassword: boolean; lockedUntil: string | null; createdAt: string;
  expiresAt: string | null; expiryJalali?: string; daysLeft?: number | null;
}

const ROLE_FA: Record<string, string> = {
  admin: 'مدیر (همه‌کاره)',
  operator: 'اپراتور (محاسبه/ویرایش)',
  viewer: 'بازدید (فقط مشاهده)',
};

export default function Users() {
  const { user: me } = useApp();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', fullName: '', role: 'operator', password: '', active: true, expiresAt: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [delTarget, setDelTarget] = useState<UserRow | null>(null);

  const isAdmin = me?.role === 'admin' || me?.isSupervisor;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ users: UserRow[] }>('/api/users');
      setRows(data.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ username: '', fullName: '', role: 'operator', password: '', active: true, expiresAt: '' });
    setError('');
    setFormOpen(true);
  };
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({ username: u.username, fullName: u.fullName, role: u.role, password: '', active: u.active, expiresAt: u.expiryJalali || '' });
    setError('');
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    // اعتبارسنجی سمت کاربر: قالب تاریخ انقضا شمسی
    const exp = form.expiresAt.trim();
    if (exp && !/^\d{3,4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(exp.replace(/[\u06F0-\u06F9]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))) {
      setSaving(false);
      setError('تاریخ انقضا نامعتبر است — قالب درست: ۱۴۰۶/۰۱/۰۱');
      return;
    }
    try {
      if (editing) {
        await apiPut(`/api/users/${editing.id}`, {
          username: form.username, fullName: form.fullName, role: form.role, active: form.active,
          password: form.password || undefined,
          expiresAt: exp,
        });
      } else {
        await apiPost('/api/users', { ...form, expiresAt: exp });
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!delTarget) return;
    try {
      await apiDelete(`/api/users/${delTarget.id}`);
      setDelTarget(null);
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const unlock = async (u: UserRow) => {
    try {
      await apiPut(`/api/users/${u.id}`, { unlock: true });
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const columns: DtColumn<UserRow>[] = [
    { key: 'username', header: 'نام کاربری', cell: (r) => <span className="font-semibold" dir="ltr">{r.username}</span> },
    { key: 'fullName', header: 'نام و نام خانوادگی' },
    {
      key: 'role', header: 'نقش و دسترسی',
      cell: (r) => (
        <Badge variant={r.role === 'admin' ? 'default' : 'secondary'}>
          {ROLE_FA[r.role] || r.role}
        </Badge>
      ),
      sortValue: (r) => r.role,
    },
    {
      key: 'active', header: 'فعال',
      cell: (r) => r.active
        ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">فعال</Badge>
        : <Badge variant="destructive">غیرفعال</Badge>,
      sortValue: (r) => (r.active ? 1 : 0),
    },
    {
      key: 'locked', header: 'قفل ورود',
      cell: (r) => r.lockedUntil ? (
        <button onClick={() => unlock(r)} className="inline-flex items-center gap-1 text-amber-600 hover:underline text-[12px]">
          <Unlock size={13} /> قفل است — آزادسازی
        </button>
      ) : '—',
      sortValue: (r) => (r.lockedUntil ? 1 : 0),
      noFilter: true,
    },
    {
      key: 'mustChange', header: 'تغییر اجباری رمز',
      cell: (r) => r.mustChangePassword ? 'بله' : '—',
      sortValue: (r) => (r.mustChangePassword ? 1 : 0),
    },
    {
      key: 'expiry', header: 'اعتبار تا',
      cell: (r) => {
        if (!r.expiresAt) return <span className="text-muted-foreground">بدون محدودیت</span>;
        const d = r.daysLeft ?? 0;
        if (d <= 0) return <Badge variant="destructive">منقضی ({r.expiryJalali})</Badge>;
        if (d <= 7) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{d} روز مانده ({r.expiryJalali})</Badge>;
        return <span className="inline-flex items-center gap-1" dir="ltr"><CalendarClock size={13} className="text-muted-foreground" />{r.expiryJalali}</span>;
      },
      sortValue: (r) => (r.expiresAt ? new Date(r.expiresAt).getTime() : 0),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="مدیریت کاربران"
        subtitle="تعریف و ویرایش کاربر با نام کاربری، رمز، سطح دسترسی و تاریخ انقضای اعتبار — برای سوپروایزر و مدیر؛ همه تغییرات در لاگ ثبت می‌شود"
      />
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>}
      <DataTable
        id="users"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<p className="py-10 text-center text-muted-foreground">کاربری ثبت نشده است.</p>}
        toolbarExtra={isAdmin && (
          <Button size="sm" className="h-8 gap-1.5" onClick={openNew}>
            <Plus size={15} /> کاربر جدید
          </Button>
        )}
      />
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <ShieldCheck size={14} className="text-primary" />
        تأیید و پرداخت حقوق فقط با نقش «مدیر» انجام می‌شود. رمزها به‌صورت رمزنگاری‌شده (scrypt) ذخیره می‌شوند.
      </p>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? `ویرایش کاربر: ${editing.username}` : 'کاربر جدید'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>نام کاربری (لاتین — نام ورود به برنامه)</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" className="text-left" />
            </div>
            <div className="space-y-1.5">
              <Label>نام و نام خانوادگی</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>نقش و سطح دسترسی</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدیر (همه‌کاره)</SelectItem>
                  <SelectItem value="operator">اپراتور (محاسبه/ویرایش)</SelectItem>
                  <SelectItem value="viewer">بازدید (فقط مشاهده)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{editing ? 'رمز جدید (خالی = بدون تغییر)' : 'رمز عبور (حداقل ۶ نویسه)'}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" className="text-left" />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>حساب فعال</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <div className="space-y-1.5 rounded-lg border px-3 py-2">
              <Label className="flex items-center gap-1.5"><CalendarClock size={14} className="text-primary" /> تاریخ انقضای اعتبار (شمسی)</Label>
              <Input
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                dir="ltr" className="text-left" placeholder="1406/01/01"
              />
              <p className="text-[11.5px] text-muted-foreground">
                خالی = بدون محدودیت. بعد از این تاریخ، ورود این کاربر مسدود می‌شود و تا تمدید اعتبار توسط مدیر یا سوپروایزر نمی‌تواند وارد شود. از ۷ روز مانده به انقضا، پیغام تمدید هر روز به کاربر نمایش داده می‌شود.
              </p>
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>انصراف</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'در حال ثبت…' : 'ثبت'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف کاربر</AlertDialogTitle>
            <AlertDialogDescription>
              کاربر «{delTarget?.username}» حذف شود؟ این عملیات در لاگ تغییرات ثبت می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={doDelete}>
              <Trash2 size={14} className="ml-1" /> حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
