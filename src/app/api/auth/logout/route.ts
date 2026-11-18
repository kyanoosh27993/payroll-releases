import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SESSION_COOKIE, toSessionUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** خروج کاربر — نشست باطل و لاگ ثبت می‌شود */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const sess = await db.session.findUnique({ where: { token }, include: { user: true } });
    if (sess) {
      await logAudit({ user: toSessionUser(sess.user), action: 'خروج', entity: 'auth', details: 'خروج از برنامه' });
      await db.session.deleteMany({ where: { token } });
    }
  }
  const out = NextResponse.json({ ok: true });
  out.cookies.delete(SESSION_COOKIE);
  return out;
}
