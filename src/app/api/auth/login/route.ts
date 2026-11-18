import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { login, SESSION_COOKIE, toSessionUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { ensureSeeded } from '@/lib/core/seed';

export const dynamic = 'force-dynamic';

/** ورود کاربر — قفل خودکار بعد از ۵ تلاش ناموفق */
export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '');
    const password = String(body.password || '');
    if (!username || !password) {
      return NextResponse.json({ error: 'نام کاربری و رمز عبور الزامی است' }, { status: 400 });
    }
    const res = await login(username, password);
    if (!res.ok) {
      // تلاش ناموفق روی اکانت سوپروایزر هم هیچ لاگی ندارد (مخفی بودن کامل)
      const attempted = await db.user.findFirst({ where: { username: username.trim().toLowerCase() } });
      if (!attempted?.isSupervisor) {
        await logAudit({ user: { username, isSupervisor: false }, action: 'ورود ناموفق', entity: 'auth', details: `نام کاربری: ${username}` });
      }
      return NextResponse.json({ error: res.error }, { status: 401 });
    }
    await logAudit({ user: res.user, action: 'ورود', entity: 'auth', details: 'ورود موفق به برنامه' });
    const out = NextResponse.json({ user: res.user });
    out.cookies.set(SESSION_COOKIE, res.token, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 86400,
    });
    return out;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** کاربر جاری (برای بارگذاری اولیه صفحه) */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });
  const sess = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!sess || sess.expiresAt < new Date() || !sess.user.active) return NextResponse.json({ user: null });
  return NextResponse.json({ user: toSessionUser(sess.user) });
}
