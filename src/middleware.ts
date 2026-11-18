// Middleware سراسری — محافظت از همه مسیرهای /api با نشست معتبر
// بدون نشست معتبر: پاسخ 401. هویت کاربر روی هدرهای درخواست سوار می‌شود.
// امنیت: هدرهای x-user-* ورودیِ کلاینت قبل از تنظیم حذف می‌شوند تا جعل هویت ممکن نباشد.
// انقضای بی‌کاری: اگر کاربر مدتی (پیش‌فرض ۸ ساعت) درخواست نفرستد، نشست باطل می‌شود.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const config = {
  runtime: 'nodejs',
  matcher: ['/api/:path*'],
};

// مسیرهایی که بدون نشست هم در دسترس‌اند (فقط ورود و بازیابی رمز)
const PUBLIC_PREFIXES = ['/api/auth/login', '/api/auth/recover', '/api/auth/forgot-password'];
const IDENTITY_HEADERS = ['x-user-id', 'x-username', 'x-fullname', 'x-user-role', 'x-is-supervisor'];
// انقضای بی‌کاری نشست (دقیقه) — قابل تغییر از تنظیمات با کلید session_idle_minutes
export const DEFAULT_IDLE_MINUTES = 480; // ۸ ساعت

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // در مسیرهای عمومی هم هدرهای هویتیِ رسیده از کلاینت باید حذف شوند
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    const clean = new Headers(req.headers);
    for (const h of IDENTITY_HEADERS) clean.delete(h);
    return NextResponse.next({ request: { headers: clean } });
  }
  const token = req.cookies.get('pd_session')?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'برای استفاده از برنامه باید وارد حساب خود شوید', code: 'NO_SESSION' },
      { status: 401 },
    );
  }
  // فیکس ۱.۴.۳ — اگر جدول‌ها هنوز ساخته نشده‌اند (دیتابیس خالی/تازه با کوکی نشست قبلی)
  // کوئری نشست P2021 می‌داد و درخواست 500 می‌شد؛ اکنون تمیز 401 برمی‌گردد تا کاربر به صفحه ورود برود
  const sess = await db.session
    .findUnique({ where: { token }, include: { user: true } })
    .catch(() => null);
  if (!sess || sess.expiresAt < new Date() || !sess.user.active) {
    const res = NextResponse.json(
      { error: 'نشست شما منقضی شده است — دوباره وارد شوید', code: 'SESSION_EXPIRED' },
      { status: 401 },
    );
    if (sess) res.cookies.delete('pd_session');
    return res;
  }
  // کاربری که باید رمزش را عوض کند فقط به مسیرهای auth دسترسی دارد
  if (sess.user.mustChangePassword && !pathname.startsWith('/api/auth/')) {
    return NextResponse.json(
      { error: 'ابتدا باید رمز عبور خود را تغییر دهید', code: 'MUST_CHANGE_PASSWORD' },
      { status: 403 },
    );
  }
  // انقضای بی‌کاری: مدت طولانی بدون درخواست = خروج اجباری
  let idleMinutes = DEFAULT_IDLE_MINUTES;
  try {
    const s = await db.appSetting.findUnique({ where: { key: 'session_idle_minutes' } });
    const v = s ? Number(s.value) : 0;
    if (v >= 15) idleMinutes = v; // کمتر از ۱۵ دقیقه مجاز نیست
  } catch { /* ignore */ }
  if (sess.lastSeenAt && Date.now() - sess.lastSeenAt.getTime() > idleMinutes * 60000) {
    await db.session.delete({ where: { id: sess.id } }).catch(() => undefined);
    const res = NextResponse.json(
      { error: 'به دلیل عدم فعالیت، نشست شما بسته شد — دوباره وارد شوید', code: 'SESSION_IDLE_EXPIRED' },
      { status: 401 },
    );
    res.cookies.delete('pd_session');
    return res;
  }
  // به‌روزرسانی lastSeenAt — فقط اگر بیش از ۶۰ ثانیه از آخرین فعالیت گذشته باشد
  const lastSeen = sess.lastSeenAt?.getTime() ?? 0;
  if (Date.now() - lastSeen > 60_000) {
    await db.session.update({ where: { id: sess.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  const headers = new Headers(req.headers);
  // امنیت: هدرهای هویتیِ رسیده از کلاینت حذف می‌شوند تا با هدرهای واقعی جایگزین شوند
  for (const h of IDENTITY_HEADERS) headers.delete(h);
  const b64 = (v: string) => Buffer.from(v, 'utf8').toString('base64url');
  headers.set('x-user-id', String(sess.user.id));
  headers.set('x-username', b64(sess.user.username));
  headers.set('x-fullname', b64(sess.user.fullName || sess.user.username));
  headers.set('x-user-role', sess.user.role);
  headers.set('x-is-supervisor', sess.user.isSupervisor ? '1' : '0');
  // پاکسازی نشست‌های منقضی قدیمی (هر چند وقت یک‌بار)
  if (Math.random() < 0.02) {
    try {
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch { /* ignore */ }
  }
  return NextResponse.next({ request: { headers } });
}
