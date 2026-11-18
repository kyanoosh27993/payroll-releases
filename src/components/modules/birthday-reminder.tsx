'use client';
// یادآور تولد پرسنل شاغل — پس از هر ورود به برنامه (مونت سراسری در app-shell) نمایش داده می‌شود
// روزهای مانده تا تولد پرسنل فعال محاسبه و در آستانه N روز دیالوگ فهرست نمایش داده می‌شود.
// با «تائید» مقدار acknowledged در localStorage ذخیره می‌شود تا سال بعد دوباره نمایش داده شود؛
// بدون تائید، بعد از هر ورود به برنامه دوباره نمایش داده می‌شود (گزاره ۷).
import { useEffect, useMemo, useState } from 'react';
import { Cake, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useApp } from '@/components/app-state';
import { apiGet } from '@/lib/api-client';
import { todayJalali, toGregorian } from '@/lib/core/jalali';
import { toPersianDigits } from '@/lib/core/numbers';

export interface BirthdayPerson {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string; // '1365/09/06'
  status: string;
}

const THRESHOLD_KEY = 'personnelBirthdayDays';
const ACK_KEY = 'personnelBirthdayAck';

/** فاصله روز تا نزدیک‌ترین تولد بعدی (جلالی) — بدون تولد ثبت‌شده null */
export function daysUntilBirthday(birthDate: string): number | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec((birthDate || '').trim());
  if (!m) return null;
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const t = todayJalali();
  const g1 = toGregorian(t.jy, t.jm, t.jd);
  const g2 = toGregorian(t.jy, jm, jd);
  const diff = Math.round((Date.UTC(g2.gy, g2.gm - 1, g2.gd) - Date.UTC(g1.gy, g1.gm - 1, g1.gd)) / 86400000);
  return diff >= 0 ? diff : null; // تولد امسال گذشته → نادیده (سال بعد از طریق ack رفرش می‌شود)
}

export default function BirthdayReminder({ rows: rowsProp }: { rows?: BirthdayPerson[] }) {
  const { company } = useApp();
  const [fetched, setFetched] = useState<BirthdayPerson[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [ack, setAck] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // حالت سراسری — بدون props، خودش پرسنل شرکت فعال را می‌گیرد
  useEffect(() => {
    if (rowsProp || !company) return;
    apiGet<{ personnel: BirthdayPerson[] }>(`/api/personnel?companyId=${company.id}`)
      .then((d) => setFetched(d.personnel))
      .catch(() => setFetched([]));
  }, [rowsProp, company]);

  const rows = rowsProp ?? fetched;

  useEffect(() => {
    try {
      setThreshold(Number(localStorage.getItem(THRESHOLD_KEY)) || 3);
      setAck(JSON.parse(localStorage.getItem(ACK_KEY) || '[]'));
    } catch { /* ignore */ }
  }, []);

  const t = todayJalali();

  const upcoming = useMemo(() => {
    return rows
      .filter((p) => p.status === 'شاغل')
      .map((p) => ({ p, days: daysUntilBirthday(p.birthDate) }))
      .filter((x): x is { p: BirthdayPerson; days: number } => x.days !== null && x.days <= threshold)
      .filter((x) => !ack.includes(`${x.p.birthDate}|${t.jy}`))
      .sort((a, b) => a.days - b.days);
  }, [rows, threshold, ack, t.jy]);

  // بدون تائید، در هر ورود به پرسنل نمایش داده می‌شود
  useEffect(() => {
    if (upcoming.length > 0) setOpen(true);
  }, [upcoming.length]);

  const confirm = () => {
    const next = Array.from(new Set([...ack, ...upcoming.map((x) => `${x.p.birthDate}|${t.jy}`)]));
    setAck(next);
    try { localStorage.setItem(ACK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setOpen(false);
  };

  const changeThreshold = (v: number) => {
    setThreshold(v);
    try { localStorage.setItem(THRESHOLD_KEY, String(v)); } catch { /* ignore */ }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        title="تنظیم یادآور تولد"
      >
        <Cake size={14} /> یادآور تولد
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cake size={17} className="text-pink-500" /> تولد پرسنل در روزهای آینده
            </DialogTitle>
            <DialogDescription>
              پرسنل شاغلی که تولدشان تا <span className="num">{toPersianDigits(threshold)}</span> روز دیگر است.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {upcoming.map(({ p, days }) => (
              <li key={p.id} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                <span className="text-[13px] font-medium">{p.firstName} {p.lastName}</span>
                <span className="text-[12px] text-muted-foreground num">
                  {days === 0 ? 'امروز تولد اوست! 🎂' : `${toPersianDigits(days)} روز مانده`}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-[12px]">هشدار از:</Label>
              <SearchableSelect
                className="w-24"
                value={String(threshold)}
                onValueChange={(v) => changeThreshold(Number(v))}
                options={[1, 3, 7, 14].map((d) => ({ value: String(d), label: `${toPersianDigits(d)} روز` }))}
                searchPlaceholder="جستجو…"
              />
            </div>
            <Button onClick={confirm}>تائید</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Cake size={17} /> تنظیم یادآور تولد</DialogTitle>
            <DialogDescription>
              چند روز قبل از تولد پرسنل شاغل، فهرست تبریک نمایش داده شود.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Label className="text-[12.5px]">آستانه هشدار:</Label>
            <SearchableSelect
              className="w-28"
              value={String(threshold)}
              onValueChange={(v) => changeThreshold(Number(v))}
              options={[1, 3, 7, 14].map((d) => ({ value: String(d), label: `${toPersianDigits(d)} روز` }))}
              searchPlaceholder="جستجو…"
            />
          </div>
          <Button className="gap-1.5" onClick={() => setShowSettings(false)}>
            <X size={14} /> بستن
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
