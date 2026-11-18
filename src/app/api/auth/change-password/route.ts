import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, hashPassword, newSalt, userFromHeaders, toSessionUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** تغییر رمز عبور کاربر جاری (اجباری در اولین ورود) */
export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!me) return NextResponse.json({ error: 'ابتدا وارد شوید' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const oldPassword = String(body.oldPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'رمز جدید باید حداقل ۶ نویسه باشد' }, { status: 400 });
    }
    const u = await db.user.findUnique({ where: { id: me.id } });
    if (!u) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 });
    if (!verifyPassword(oldPassword, u.salt, u.passwordHash)) {
      await logAudit({ user: me, action: 'تغییر رمز ناموفق', entity: 'user', entityId: me.id, details: 'رمز فعلی نادرست بود' });
      return NextResponse.json({ error: 'رمز فعلی نادرست است' }, { status: 400 });
    }
    const salt = newSalt();
    await db.user.update({
      where: { id: me.id },
      data: { salt, passwordHash: hashPassword(newPassword, salt), mustChangePassword: false },
    });
    // با تغییر رمز، همه نشست‌های دیگر باطل شود
    await db.session.deleteMany({ where: { userId: me.id } });
    await logAudit({ user: me, action: 'تغییر رمز', entity: 'user', entityId: me.id, details: 'رمز عبور با موفقیت تغییر کرد' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
