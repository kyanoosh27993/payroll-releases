import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole, hashPassword, newSalt } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { cleanText } from '@/lib/core/numbers';
import { parseJalaliExpiry, isoToJalaliStr, daysUntilExpiry } from '@/lib/core/user-expiry';

export const dynamic = 'force-dynamic';

const ROLES = ['admin', 'operator', 'viewer'];

/** فهرست کاربران — سوپروایزر و مدیر؛ اکانت سوپروایزر هرگز نمایش داده نمی‌شود */
export async function GET(req: NextRequest) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin')) return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  const users = await db.user.findMany({
    where: { isSupervisor: false },
    select: {
      id: true, username: true, fullName: true, role: true, active: true,
      mustChangePassword: true, lockedUntil: true, createdAt: true, expiresAt: true,
    },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      expiryJalali: isoToJalaliStr(u.expiresAt),
      daysLeft: daysUntilExpiry(u.expiresAt),
    })),
  });
}

/** ایجاد کاربر جدید — سوپروایزر و مدیر */
export async function POST(req: NextRequest) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin')) return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  try {
    const body = await req.json();
    const username = cleanText(String(body.username || '')).toLowerCase().replace(/\s+/g, '_');
    const password = String(body.password || '');
    const role = ROLES.includes(body.role) ? body.role : 'viewer';
    if (!username || password.length < 6) {
      return NextResponse.json({ error: 'نام کاربری و رمز (حداقل ۶ نویسه) الزامی است' }, { status: 400 });
    }
    const exists = await db.user.findFirst({ where: { username } });
    if (exists) return NextResponse.json({ error: 'این نام کاربری قبلاً ثبت شده است' }, { status: 400 });
    // تاریخ انقضای اعتبار — شمسی «۱۴۰۶/۰۱/۰۱»؛ خالی = بدون محدودیت
    let expiresAt: Date | null = null;
    if (body.expiresAt !== undefined && String(body.expiresAt || '').trim() !== '') {
      expiresAt = parseJalaliExpiry(body.expiresAt);
      if (!expiresAt) return NextResponse.json({ error: 'تاریخ انقضا نامعتبر است — قالب درست: ۱۴۰۶/۰۱/۰۱' }, { status: 400 });
    }
    const salt = newSalt();
    const created = await db.user.create({
      data: {
        username, salt, passwordHash: hashPassword(password, salt),
        fullName: cleanText(String(body.fullName || '')), role,
        active: body.active === undefined ? true : !!body.active,
        mustChangePassword: !!body.mustChangePassword,
        expiresAt,
      },
    });
    await logAudit({
      user: me, action: 'ایجاد کاربر', entity: 'user', entityId: created.id,
      details: `نام کاربری: ${username} — نقش: ${role}`,
      after: { username, fullName: created.fullName, role, active: created.active, expiresAt },
    });
    return NextResponse.json({ user: { id: created.id, username: created.username } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
