import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';
import { hashPassword } from '@/lib/core/seed';
import { checkRecoveryCode, rotateRecoveryCode } from '@/lib/recovery';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** بازیابی رمز عبور فراموش‌شده با کد بازیابی (فایل recovery-key.txt کنار پایگاه‌داده) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim().toLowerCase();
    const code = String(body.code || '');
    const newPassword = String(body.newPassword || '');
    if (!username || !code || !newPassword) {
      return NextResponse.json({ error: 'همه فیلدها الزامی است' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'رمز جدید باید حداقل ۶ نویسه باشد' }, { status: 400 });
    }
    const ok = await checkRecoveryCode(code);
    if (!ok) {
      return NextResponse.json({ error: 'کد بازیابی نامعتبر است' }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      return NextResponse.json({ error: 'کاربری با این نام یافت نشد' }, { status: 404 });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    await db.user.update({
      where: { id: user.id },
      data: {
        salt,
        passwordHash: hashPassword(newPassword, salt),
        mustChangePassword: false,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    // همه نشست‌های قبلی باطل می‌شود
    await db.session.deleteMany({ where: { userId: user.id } });
    // کد بازیابی مصرف شد — کد جدید صادر می‌شود
    await rotateRecoveryCode();
    await logAudit({ user: { username, isSupervisor: user.isSupervisor }, action: 'بازیابی رمز', entity: 'auth', details: `بازیابی رمز با کد بازیابی — کاربر: ${username}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
