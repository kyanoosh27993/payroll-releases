'use client';
// گزارش تغییرات (لاگ فایل) — هر تغییر با تاریخ/ساعت/کاربر/قبل/بعد
// ویرایش و حذف رکورد لاگ فقط با اکانت سوپروایزر (سایر کاربران دکمه‌ای نمی‌بینند)
import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import { DataTable, type DtColumn } from '@/components/data-table';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiGet, apiPut, apiDelete } from '@/lib/api-client';
import { toPersianDigits } from '@/lib/core/numbers';
import { useApp } from '@/components/app-state';

interface AuditRow {
  id: number; ts: string; username: string | null; action: string;
  entity: string; entityId: number | null;
  details: string; beforeData: string; afterData: string;
}

function faTime(ts: string): string {
  try {
    const d = new Date(ts);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    return `${toPersianDigits(time)}`;
  } catch {
    return '';
  }
}

function faDate(ts: string): string {
  try {
    return toPersianDigits(new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(ts)));
  } catch {
    return toPersianDigits(ts.slice(0, 10));
  }
}

export default function Audit() {
  const { user } = useApp();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<AuditRow | null>(null);
  const [editDetails, setEditDetails] = useState('');
  const [delTarget, setDelTarget] = useState<AuditRow | null>(null);
  const [error, setError] = useState('');
  const isSup = !!user?.isSupervisor;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ logs: AuditRow[] }>(`/api/audit?limit=1000${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      setRows(data.logs);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { void load(); }, [load]);

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await apiPut(`/api/audit/${editing.id}`, { details: editDetails });
      setEditing(null);
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const doDelete = async () => {
    if (!delTarget) return;
    try {
      await apiDelete(`/api/audit/${delTarget.id}`);
      setDelTarget(null);
      await load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const columns: DtColumn<AuditRow>[] = [
    {
      key: 'date', header: 'تاریخ', headerClassName: 'w-[110px]',
      cell: (r) => faDate(r.ts), sortValue: (r) => r.ts, noFilter: true,
    },
    {
      key: 'time', header: 'ساعت', headerClassName: 'w-[90px]',
      cell: (r) => faTime(r.ts), sortValue: (r) => r.ts, noFilter: true,
    },
    { key: 'username', header: 'کاربر', cell: (r) => <span dir="ltr">{r.username || '—'}</span> },
    {
      key: 'action', header: 'عملیات',
      cell: (r) => {
        const a = r.action;
        const tone = a.includes('حذف') || a.includes('ناموفق') || a === 'خطا' ? 'destructive'
          : a.includes('ورود') || a.includes('تایید') || a.includes('پرداخت') ? 'default' : 'secondary';
        return <Badge variant={tone as 'destructive' | 'default' | 'secondary'}>{a}</Badge>;
      },
    },
    { key: 'entity', header: 'موضوع', cell: (r) => r.entity || '—' },
    { key: 'details', header: 'شرح', className: 'max-w-[280px] truncate', cell: (r) => r.details || '—' },
    {
      key: 'before', header: 'مقدار قبل',
      className: 'max-w-[200px] truncate text-[11px] text-muted-foreground',
      cell: (r) => r.beforeData || '—', defaultHidden: true,
    },
    {
      key: 'after', header: 'مقدار بعد',
      className: 'max-w-[200px] truncate text-[11px] text-muted-foreground',
      cell: (r) => r.afterData || '—', defaultHidden: true,
    },
    ...(isSup ? [{
      key: 'ops', header: 'مدیریت لاگ', noSort: true, noFilter: true, headerClassName: 'w-[100px]',
      cell: (r: AuditRow) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setEditing(r); setEditDetails(r.details); }}
            className="rounded p-1 hover:bg-muted" title="ویرایش رکورد لاگ">
            <Pencil size={14} />
          </button>
          <button onClick={() => setDelTarget(r)}
            className="rounded p-1 text-destructive hover:bg-destructive/10" title="حذف رکورد لاگ">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    } as DtColumn<AuditRow>] : []),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="گزارش تغییرات (لاگ)"
        subtitle="هر تغییر کاربران با تاریخ، ساعت، نام کاربر و مقادیر قبل/بعد — تغییرات سوپروایزر ثبت نمی‌شود"
      />
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>}
      <DataTable
        id="audit"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        toolbarExtra={
          <>
            <div className="relative">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در لاگ…"
                className="h-8 w-48 text-xs" />
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => load()}>
              <RefreshCw size={14} />
            </Button>
          </>
        }
        empty={<p className="py-10 text-center text-muted-foreground">رکوردی ثبت نشده است.</p>}
      />
      <p className="text-[12px] text-muted-foreground">
        نسخه متنی لاگ‌ها به‌صورت فایل روزانه در پوشه logs کنار دیتابیس هم ذخیره می‌شود.
      </p>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش رکورد لاگ (دسترسی سوپروایزر)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>شرح</Label>
              <Textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} rows={4} />
            </div>
            <p className="text-[12px] text-muted-foreground">این ویرایش در هیچ لاگی ثبت نمی‌شود.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>انصراف</Button>
            <Button onClick={saveEdit}>ثبت</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف رکورد لاگ</AlertDialogTitle>
            <AlertDialogDescription>این رکورد برای همیشه حذف شود؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={doDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
