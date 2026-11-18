// ورودی تاریخ جلالی ۸ رقمی فقط عددی — گزاره ۴ نسخه ۱٫۲٫۰
// کاربر فقط ۸ رقم بدون / وارد می‌کند (مثال: 13650906)؛ برنامه خودش نمایش
// «1365/09/06» را به‌صورت RTL درست نشان می‌دهد و با / در value نگه می‌دارد
// (مقدار ذخیره‌شده در دیتابیس همیشه با / است تا گزارش‌گیری مشکلی نخورد).
'use client';
import { Input } from '@/components/ui/input';
import { toPersianDigits, normalizeDigits } from '@/lib/core/numbers';

const FA = '۰۱۲۳۴۵۶۷۸۹';

/** فقط ۸ رقم سال/ماه/روز مجاز — خروجی همیشه yyyy/mm/dd یا رشته خالی */
export function digitsToJalali(raw: string): string {
  const d = normalizeDigits(raw).replace(/[^0-9]/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}/${d.slice(4)}`;
  return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}`;
}

/** نمایش فارسی تاریخ ذخیره‌شده با / — برای خواندن از دیتابیس */
export function faDate(v: string): string {
  return toPersianDigits(v || '');
}

function jDigitsToFa(s: string): string {
  return s.replace(/[0-9]/g, (d) => FA[Number(d)]);
}

export function JalaliDateInput({ value, onChange, placeholder = '۱۳۶۵۰۹۰۶', className = '', id }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; id?: string;
}) {
  // value ورودی ممکن است با / باشد (از دیتابیس) — نمایش با / فارسی
  const display = value ? jDigitsToFa(value) : '';
  return (
    <Input
      id={id}
      dir="ltr"
      inputMode="numeric"
      className={`num text-center ${className}`}
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        // فقط ارقام — هر کاراکتر / یا حروف حذف و قالب‌بندی خودکار می‌شود
        const digits = e.target.value.replace(/[^۰-۹0-9]/g, '');
        const d = digits.replace(/[۰-۹]/g, (c) => String(FA.indexOf(c)));
        onChange(digitsToJalali(d));
      }}
    />
  );
}
