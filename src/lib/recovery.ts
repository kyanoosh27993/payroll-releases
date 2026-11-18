// کد بازیابی رمز عبور فراموش‌شده — برای برنامه کاملا محلی
// کد در پایگاه‌داده (AppSetting) و در فایل recovery-key.txt کنار پایگاه‌داده ذخیره می‌شود.
import * as crypto from 'crypto';
import { writeFileSync } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { dataRoot } from './app-root';

export const RECOVERY_KEY = 'recovery_code';

function genCode(): string {
  // ۱۰ نویسه از حروف/اعداد بدون ابهام (بدون 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  const buf = crypto.randomBytes(20);
  for (let i = 0; i < 10; i++) raw += alphabet[buf[i] % alphabet.length];
  return `PR-${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

async function writeKeyFile(code: string): Promise<void> {
  try {
    const users = await db.user.findMany({ select: { username: true, fullName: true } });
    const lines = [
      'سامانه جامع حقوق و دستمزد — کد بازیابی رمز عبور',
      '='.repeat(48),
      `کد بازیابی: ${code}`,
      '',
      'نام‌های کاربری موجود:',
      ...users.map((u) => `  - ${u.username} (${u.fullName || '—'})`),
      '',
      'روش استفاده: در صفحه ورود، روی «فراموشی رمز عبور؟» بزنید و نام کاربری،',
      'این کد و رمز جدید را وارد کنید.',
      'پس از هر بازیابی موفق، کد جدیدی ساخته و در همین فایل نوشته می‌شود.',
      '',
      `تاریخ ثبت: ${new Date().toLocaleString('fa-IR')}`,
    ];
    writeFileSync(path.join(dataRoot(), 'recovery-key.txt'), lines.join('\n') + '\n', 'utf8');
  } catch {
    // نوشتن فایل اختیاری است — کد در پایگاه‌داده موجود است
  }
}

/** اگر کد بازیابی وجود نداشت، یکی می‌سازد (اجرای اول روی پایگاه‌داده موجود هم پوشش داده می‌شود) */
export async function ensureRecoveryCode(): Promise<string> {
  const found = await db.appSetting.findUnique({ where: { key: RECOVERY_KEY } });
  if (found?.value) {
    // فایل کلید را به‌روز نگه می‌داریم (اگر فایل حذف شده باشد بازساخته می‌شود)
    await writeKeyFile(found.value);
    return found.value;
  }
  const code = genCode();
  await db.appSetting.upsert({
    where: { key: RECOVERY_KEY },
    create: { key: RECOVERY_KEY, value: code },
    update: { value: code },
  });
  await writeKeyFile(code);
  return code;
}

/** ساخت کد جدید (بعد از بازیابی موفق یا بازتولید دستی) */
export async function rotateRecoveryCode(): Promise<string> {
  const code = genCode();
  await db.appSetting.upsert({
    where: { key: RECOVERY_KEY },
    create: { key: RECOVERY_KEY, value: code },
    update: { value: code },
  });
  await writeKeyFile(code);
  return code;
}

export async function checkRecoveryCode(code: string): Promise<boolean> {
  const found = await db.appSetting.findUnique({ where: { key: RECOVERY_KEY } });
  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');
  return !!found?.value && norm(found.value) === norm(code);
}
