'use client';
// ماژول پرینت فرم‌های ضروری — گزاره ۷ نسخه ۱٫۲٫۰
// آپلود فرم‌های استاندارد مجموعه (Word/PDF/Excel/عکس) و پرینت توسط سایر همکاران
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/components/app-state';
import { PageHeader, EmptyState, Fa, LoadingBlock } from '@/components/shared';
import { apiGet, apiPost, apiDelete, fetchFile, printHtmlInApp } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Printer, Trash2, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react';

interface FormRow { id: number; title: string; description: string; fileName: string; mime: string; size: number; createdAt: string }

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return <FileImage size={28} className="text-blue-600" />;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet size={28} className="text-emerald-700" />;
  if (mime.includes('pdf') || mime.includes('word')) return <FileText size={28} className="text-red-700" />;
  return <File size={28} className="text-gray-600" />;
}
const faSize = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} مگابایت` : `${Math.max(1, Math.round(b / 1024))} کیلوبایت`;

export default function PrintFormsModule() {
  const { user } = useApp();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = user?.role === 'admin' || user?.role === 'operator';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ forms: FormRow[] }>('/api/print-forms');
      setForms(res.forms ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!title.trim()) { toast.error('عنوان فرم الزامی است'); return; }
    if (!f) { toast.error('فایل فرم را انتخاب کنید (Word، PDF، Excel یا عکس)'); return; }
    if (f.size > 8 * 1024 * 1024) { toast.error('حجم فایل بیش از ۸ مگابایت است'); return; }
    setBusy(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      await apiPost('/api/print-forms', { title, description, fileName: f.name, dataBase64 });
      toast.success('فرم با موفقیت در برنامه ذخیره شد');
      setTitle(''); setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('این فرم حذف شود؟')) return;
    try {
      await apiDelete(`/api/print-forms?id=${id}`);
      toast.success('فرم حذف شد');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openPrint = async (f: FormRow) => {
    const url = `/api/print-forms/${f.id}/file`;
    try {
      // فایل از همان origin با کوکی نشست گرفته می‌شود (بدون navigation مستقیم به API)
      const blob = await fetchFile(url);
      const objectUrl = URL.createObjectURL(blob);
      if (f.mime === 'application/pdf') {
        // PDF — در iframe داخل برنامه نمایش داده می‌شود؛ کاربر با دکمه چاپ مرورگر چاپ می‌کند
        const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${f.title}</title>` +
          `<style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0}</style></head><body>` +
          `<iframe src="${objectUrl}"></iframe></body></html>`;
        printHtmlInApp(html, false);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
      } else if (f.mime.startsWith('image/')) {
        // عکس — در iframe داخل برنامه + چاپ خودکار
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${f.title}</title>` +
          `<style>@media print{img{width:100%}}body{margin:0;text-align:center}</style></head><body>` +
          `<img src="${objectUrl}" alt="${f.title}" style="max-width:100%"/></body></html>`;
        printHtmlInApp(html, true);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
      } else {
        // Word/Excel — دانلود برای پرینت
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = f.fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          a.remove();
        }, 1500);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="پرینت فرم‌های ضروری"
        subtitle="فرم‌های استاندارد پرکاربرد مجموعه (مرخصی، ماموریت، اخطار، تحویل و...) را یک‌بار آپلود کنید تا همه از همین‌جا پرینت بگیرند — Word، PDF، Excel و عکس"
      />

      {canEdit && (
        <Card className="p-4">
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>عنوان فرم *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: فرم درخواست مرخصی" />
            </div>
            <div className="space-y-1.5">
              <Label>توضیح (اختیاری)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="کاربرد فرم / راهنمای تکمیل" />
            </div>
            <div className="space-y-1.5">
              <Label>فایل فرم — Word / PDF / Excel / عکس (حداکثر ۸MB)</Label>
              <Input ref={fileRef} type="file" accept=".doc,.docx,.pdf,.xls,.xlsx,image/*" />
            </div>
          </div>
          <Button onClick={upload} disabled={busy} className="mt-3 gap-2">
            <Upload size={16} /> {busy ? 'در حال ذخیره…' : 'آپلود و ذخیره فرم'}
          </Button>
        </Card>
      )}

      {loading ? <LoadingBlock /> : forms.length === 0 ? (
        <EmptyState
          icon={<Printer size={40} className="opacity-40" />}
          title="هنوز فرمی ثبت نشده"
          hint="فایل فرم‌های استاندارد مجموعه را با دکمه بالا آپلود کنید تا در این فهرست برای پرینت در دسترس باشد."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {forms.map((f) => (
            <Card key={f.id} className="p-3 flex gap-3 items-start">
              <div className="mt-0.5">{iconFor(f.mime)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate"><Fa>{f.title}</Fa></p>
                <p className="text-xs text-muted-foreground truncate"><Fa>{f.fileName}</Fa> — <Fa>{faSize(f.size)}</Fa></p>
                {f.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2"><Fa>{f.description}</Fa></p>}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => openPrint(f)}>
                    <Printer size={14} /> پرینت / باز کردن
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={() => remove(f.id)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
