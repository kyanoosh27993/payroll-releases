import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'crypto';
import { verifyPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ممیزی امنیتی ۱٫۴٫۳ (یافته ۲): محدودیت تلاش روی مسیر عمومی ریست رمز
// حداکثر ۵ تلاش در ۱۵ دقیقه به‌ازای هر IP + پیام خطای یکسان برای جلوگیری از شناسایی نام کاربری
const fpAttempts = new Map<string, { count: number; resetAt: number }>();
const FP_MAX = 5;
const FP_WINDOW_MS = 15 * 60 * 1000;
function fpRateLimited(ip: string): boolean {
  const rec = fpAttempts.get(ip);
  if (!rec || rec.resetAt < Date.now()) {
    fpAttempts.set(ip, { count: 1, resetAt: Date.now() + FP_WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > FP_MAX;
}

/**
 * بازیابی رمز عبور فراموش‌شده — روش آفلاین با رمز سوپروایزر:
 * POST {username, adminPassword}
 * - کاربر سوپروایزر خودش از این مسیر نمی‌تواند رمزش را ریست کند (پیام «با مدیر سیستم تماس بگیرید»)
 * - برای سایر کاربران، adminPassword باید رمز اکانت مخفی سوپروایزر (Sup@1405! — نزد مالک برنامه) باشد
 * - در صورت موفقیت، رمز موقت تصادفی ساخته می‌شود، mustChangePassword فعال می‌گردد
 *   و همه نشست‌های قبلی کاربر باطل می‌شود
 */
export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    if (fpRateLimited(ip)) {
      return NextResponse.json({ error: 'تلاش‌های بیش از حد — ۱۵ دقیقه دیگر مراجعه کنید' }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim().toLowerCase();
    const adminPassword = String(body.adminPassword || '');
    if (!username || !adminPassword) {
      return NextResponse.json({ error: 'اطلاعات ورود نادرست است' }, { status: 400 });
    }
    const user = await db.user.findFirst({ where: { username } });
    if (!user || !user.active) {
      // پیام یکسان — جلوگیری از شمارش نام کاربری
      return NextResponse.json({ error: 'اطلاعات ورود نادرست است' }, { status: 401 });
    }
    if (user.isSupervisor) {
      return NextResponse.json({ error: 'ریست رمز اکانت سوپروایزر از این مسیر مجاز نیست — با مدیر سیستم تماس بگیرید' }, { status: 403 });
    }
    // بررسی رمز سوپروایزر
    const sup = await db.user.findFirst({ where: { isSupervisor: true, active: true } });
    if (!sup || !verifyPassword(adminPassword, sup.salt, sup.passwordHash)) {
      await logAudit({ user: { username, isSupervisor: false }, action: 'ریست رمز ناموفق', entity: 'auth', details: `رمز سوپروایزر نادرست برای کاربر: ${username}` });
      return NextResponse.json({ error: 'اطلاعات ورود نادرست است' }, { status: 401 });
    }
    // رمز موقت تصادفی — بدون کاراکتر مبهم
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const buf = crypto.randomBytes(12);
    let temp = '';
    for (let i = 0; i < 12; i++) temp += alphabet[buf[i] % alphabet.length];
    const salt = crypto.randomBytes(16).toString('hex');
    await db.user.update({
      where: { id: user.id },
      data: {
        salt,
        passwordHash: crypto.scryptSync(temp, salt, 64).toString('hex'),
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    // ابطال همه نشست‌های قبلی کاربر
    await db.session.deleteMany({ where: { userId: user.id } });
    await logAudit({ user: { username, isSupervisor: false }, action: 'ریست رمز', entity: 'auth', details: `ریست رمز با رمز سوپروایزر — کاربر: ${username}` });
    return NextResponse.json({
      ok: true,
      tempPassword: temp,
      message: 'رمز موقت صادر شد. هنگام ورود بعدی، برنامه تغییر رمز را اجباری می‌کند.',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
