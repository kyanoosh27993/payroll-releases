'use client';
// ماژول مدیریت دیتابیس — مورد ۱۱ نسخه ۱٫۴٫۳
// بک‌آپ دستی به مسیر دلخواه (دانلود)، لیست و بازیابی و حذف با هشدار+تائید،
// بک‌آپ‌های اتوماتیک (پس از هر محاسبه حقوق و هنگام خروج) در صفحه جداگانه،
// پاک‌سازی کامل دیتابیس — فقط و فقط اکانت سوپروایزر با هشدار چندمرحله‌ای
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DatabaseBackup, Archive, RotateCcw, Trash2, Download, AlarmClock, ShieldAlert } from 'lucide-react';
import { PageHeader, Fa, LoadingBlock, EmptyState } from '@/components/shared';
import { apiGet, apiPost, apiDelete, downloadFile } from '@/lib/api-client';
import { useApp } from '@/components/app-state';
import { formatSize } from './settings-utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BackupRow { name: string; size: number; mtime: string; preRestore?: boolean; kind?: string }

const faTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} — ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return iso; }
};

function BackupTable({ rows, scope, onChanged }: { rows: BackupRow[]; scope: 'manual' | 'auto'; onChanged: () => void }) {
  const { user } = useApp();
  const canManage = !user || user.role === 'admin' || user.isSupervisor;
  const restore = async (name: string) => {
    if (!confirm(`بازگردانی «${name}»؟ تمام داده‌های فعلی با این نسخه جایگزین می‌شود و یک نسخه ایمن از وضعیت فعلی گرفته خواهد شد.`)) return;
    try {
      await apiPost('/api/backup', { action: 'restore', name, scope });
      toast.success('بازگردانی انجام شد — برنامه را ببندید و دوباره اجرا کنید');
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
  };
  const remove = async (name: string) => {
    if (!confirm(`حذف نسخه پشتیبان «${name}»؟ این عملیات غیرقابل بازگشت است.`)) return;
    try {
      await apiDelete(`/api/backup?name=${encodeURIComponent(name)}&scope=${scope}`);
      toast.success('نسخه پشتیبان حذف شد');
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
  };
  const download = (name: string) => {
    void downloadFile(`/api/backup?download=${encodeURIComponent(name)}&scope=${scope}`, name, 'GET');
  };
  if (!rows.length) {
    return <EmptyState title="نسخه پشتیبانی در این بخش نیست" hint={scope === 'auto' ? 'بک‌آپ‌های اتوماتیک پس از هر محاسبه حقوق و هنگام خروج از برنامه گرفته می‌شوند' : 'با دکمه «تهیه نسخه پشتیبان» اولین نسخه را بسازید'} icon={<Archive size={26} />} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground">
            <th className="py-2 px-2 text-right font-medium">فایل</th>
            <th className="py-2 px-2 text-right font-medium">زمان</th>
            <th className="py-2 px-2 text-right font-medium">حجم</th>
            <th className="py-2 px-2 text-right font-medium">نوع</th>
            {canManage && <th className="py-2 px-2 text-left font-medium">عملیات</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.name} className="border-b border-border/40 hover:bg-muted/30">
              <td className="py-2 px-2 num" dir="ltr">{b.name}</td>
              <td className="py-2 px-2 num">{faTime(b.mtime)}</td>
              <td className="py-2 px-2 num">{formatSize(b.size)}</td>
              <td className="py-2 px-2">
                <Badge variant="outline" className="text-[10px]">
                  {scope === 'auto' ? (b.kind === 'exit' ? 'هنگام خروج' : b.kind === 'pre-restore' ? 'قبل از بازگردانی' : 'پس از محاسبه') : b.preRestore ? 'ایمنی قبل از بازگردانی' : 'دستی'}
                </Badge>
              </td>
              {canManage && (
                <td className="py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="ذخیره در مسیر دلخواه (دانلود)" onClick={() => download(b.name)}>
                      <Download size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gold" title="بازیابی" onClick={() => void restore(b.name)}>
                      <RotateCcw size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="حذف" onClick={() => void remove(b.name)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DatabaseManager() {
  const { user } = useApp();
  const [manual, setManual] = useState<BackupRow[]>([]);
  const [auto, setAuto] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [wiping, setWiping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([
        apiGet<{ backups: BackupRow[] }>('/api/backup?scope=manual'),
        apiGet<{ backups: BackupRow[] }>('/api/backup?scope=auto'),
      ]);
      setManual(m.backups); setAuto(a.backups);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      await apiPost('/api/backup', { action: 'create' });
      toast.success('نسخه پشتیبان تهیه شد');
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setCreating(false); }
  };

  const wipe = async () => {
    setWiping(true);
    try {
      await apiPost('/api/backup', { action: 'wipe', confirm: wipeConfirm.trim() });
      toast.success('دیتابیس پاک‌سازی شد — برنامه را ببندید و دوباره اجرا کنید');
      setWipeOpen(false); setWipeConfirm('');
    } catch (e) { toast.error((e as Error).message); }
    finally { setWiping(false); }
  };

  const isSupervisor = Boolean(user?.isSupervisor);

  return (
    <div className="space-y-4">
      <PageHeader
        title="مدیریت دیتابیس"
        subtitle="پشتیبان‌گیری دستی و اتوماتیک، بازیابی، حذف و پاک‌سازی کامل داده‌ها"
        icon={<DatabaseBackup size={22} />}
      />

      <Tabs defaultValue="manual" className="w-full">
        <TabsList>
          <TabsTrigger value="manual" className="gap-1.5"><Archive size={14} /> بک‌آپ‌های دستی</TabsTrigger>
          <TabsTrigger value="auto" className="gap-1.5"><AlarmClock size={14} /> بک‌آپ‌های اتوماتیک</TabsTrigger>
          {isSupervisor && (
            <TabsTrigger value="wipe" className="gap-1.5 text-destructive"><ShieldAlert size={14} /> پاک‌سازی کامل</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="manual" className="mt-3">
          <Card className="shadow-luxe border-border/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-muted-foreground">نسخه‌های دستی؛ برای ذخیره در مسیر دلخواه از دکمه دانلود استفاده کنید. نسخه‌های دستی خودکار حذف نمی‌شوند.</p>
              <Button size="sm" className="gap-1.5" onClick={create} disabled={creating}>
                <Archive size={15} /> {creating ? 'در حال تهیه…' : 'تهیه نسخه پشتیبان'}
              </Button>
            </div>
            {loading ? <LoadingBlock rows={4} /> : <BackupTable rows={manual} scope="manual" onChanged={load} />}
          </Card>
        </TabsContent>

        <TabsContent value="auto" className="mt-3">
          <Card className="shadow-luxe border-border/70 p-5">
            <p className="text-[13px] text-muted-foreground mb-3">
              بک‌آپ‌های اتوماتیک در پس‌زمینه و بدون نمایش گرفته می‌شوند: پس از هر محاسبه موفق حقوق و هنگام خروج از برنامه.
              نسخه‌های اتوماتیک پس از <b>۳۰ روز</b> به‌طور خودکار حذف می‌شوند؛ هر وقت بخواهید می‌توانید مستقیماً از همین صفحه بازیابی یا حذفشان کنید.
            </p>
            {loading ? <LoadingBlock rows={4} /> : <BackupTable rows={auto} scope="auto" onChanged={load} />}
          </Card>
        </TabsContent>

        {isSupervisor && (
          <TabsContent value="wipe" className="mt-3">
            <Card className="shadow-luxe border-destructive/40 p-5">
              <p className="text-[13.5px] font-bold text-destructive mb-2">پاک‌سازی کامل دیتابیس — بازگرداندن برنامه به حالت خام</p>
              <p className="text-[12.5px] text-muted-foreground leading-7">
                تمام داده‌ها (شرکت‌ها، سال‌های مالی، پرسنل، حضور و غیاب، حقوق، کاربران و …) برای همیشه حذف می‌شوند.
                قبل از پاک‌سازی، یک نسخه پشتیبان ایمن به‌طور خودکار گرفته می‌شود.
                این عملیات <b>فقط و فقط با اکانت سوپروایزر</b> ممکن است — حتی مدیران هم به آن دسترسی ندارند.
              </p>
              <Button size="sm" variant="destructive" className="gap-1.5 mt-4" onClick={() => setWipeOpen(true)}>
                <ShieldAlert size={15} /> پاک‌سازی کامل دیتابیس
              </Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* دیالوگ تائید نهایی پاک‌سازی */}
      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">هشدار — پاک‌سازی کامل دیتابیس</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] leading-7">
            این آخرین هشدار است. پس از تائید، <b>همه داده‌های برنامه برای همیشه حذف می‌شود</b> و برنامه به حالت خام برمی‌گردد
            (شرکت و سال مالی و کاربران باید دوباره ثبت شوند). یک نسخه پشتیبان ایمن قبل از پاک‌سازی گرفته خواهد شد.
          </p>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">برای تائید، عبارت <span className="num font-bold" dir="ltr">PAK-KON</span> را تایپ کنید:</Label>
            <Input className="num" value={wipeConfirm} onChange={(e) => setWipeConfirm(e.target.value)} placeholder="PAK-KON" dir="ltr" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWipeOpen(false)}>انصراف</Button>
            <Button variant="destructive" size="sm" onClick={() => void wipe()} disabled={wiping || wipeConfirm.trim() !== 'PAK-KON'}>
              {wiping ? 'در حال پاک‌سازی…' : 'پاک‌سازی کامل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
