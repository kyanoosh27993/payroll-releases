import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole, hashPassword, newSalt, SESSION_COOKIE } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { cleanText } from '@/lib/core/numbers';
import { parseJalaliExpiry, isoToJalaliStr, daysUntilExpiry } from '@/lib/core/user-expiry';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const ROLES = ['admin', 'operator', 'viewer'];

/** ویرایش کاربر — سوپروایزر و مدیر؛ اکانت سوپروایزر از این مسیر قابل تغییر نیست */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin')) return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  try {
    const id = Number((await ctx.params).id);
    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.isSupervisor) {
      return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 });
    }
    const body = await req.json();
    const data: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};
    // تغییر نام کاربری (نام ورود) — با بررسی تکراری نبودن
    if (body.username !== undefined) {
      const nu = cleanText(String(body.username)).toLowerCase().replace(/\s+/g, '_');
      if (!nu) return NextResponse.json({ error: 'نام کاربری نمی‌تواند خالی باشد' }, { status: 400 });
      if (nu !== target.username) {
        const dupe = await db.user.findFirst({ where: { username: nu } });
        if (dupe) return NextResponse.json({ error: 'این نام کاربری قبلاً ثبت شده است' }, { status: 400 });
        data.username = nu;
        changes.username = nu;
      }
    }
    if (body.fullName !== undefined) { data.fullName = cleanText(String(body.fullName)); changes.fullName = data.fullName; }
    if (body.role !== undefined && ROLES.includes(body.role)) { data.role = body.role; changes.role = body.role; }
    if (body.active !== undefined) { data.active = !!body.active; changes.active = !!body.active; }
    // تاریخ انقضای اعتبار — شمسی «۱۴۰۶/۰۱/۰۱»؛ رشته خالی = حذف محدودیت (بدون انقضا)
    if (body.expiresAt !== undefined) {
      const raw = String(body.expiresAt || '').trim();
      if (raw === '') {
        data.expiresAt = null;
        changes.expiresAt = 'بدون محدودیت';
      } else {
        const d = parseJalaliExpiry(raw);
        if (!d) return NextResponse.json({ error: 'تاریخ انقضا نامعتبر است — قالب درست: ۱۴۰۶/۰۱/۰۱' }, { status: 400 });
        data.expiresAt = d;
        changes.expiresAt = isoToJalaliStr(d);
      }
    }
    if (body.unlock) { data.failedAttempts = 0; data.lockedUntil = null; changes.unlock = true; }
    if (body.password) {
      const pw = String(body.password);
      if (pw.length < 6) return NextResponse.json({ error: 'رمز باید حداقل ۶ نویسه باشد' }, { status: 400 });
      const salt = newSalt();
      data.salt = salt;
      data.passwordHash = hashPassword(pw, salt);
      changes.password = 'تغییر یافت';
    }
    const updated = await db.user.update({ where: { id }, data });
    // نشست‌های دیگر همین کاربر باطل شود — اما نشست جاری (اگر مدیر خودش را ویرایش می‌کند)
    // باقی بماند تا کاربر بی‌دلیل از برنامه بیرون پرت نشود (فیکس ۱.۴.۳)
    const curToken = req.cookies.get(SESSION_COOKIE)?.value;
    await db.session.deleteMany({
      where: { userId: id, ...(curToken ? { token: { not: curToken } } : {}) },
    });
    await logAudit({
      user: me, action: 'ویرایش کاربر', entity: 'user', entityId: id,
      details: `نام کاربری: ${data.username ?? target.username} — انقضا: ${changes.expiresAt ?? isoToJalaliStr(target.expiresAt) ?? 'بدون محدودیت'}`,
      before: { fullName: target.fullName, role: target.role, active: target.active, expiresAt: target.expiresAt },
      after: changes,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** حذف کاربر — سوپروایزر و مدیر؛ سوپروایزر حذف نمی‌شود */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin')) return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  try {
    const id = Number((await ctx.params).id);
    if (id === me?.id) return NextResponse.json({ error: 'حساب خودتان را نمی‌توانید حذف کنید' }, { status: 400 });
    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.isSupervisor) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 });
    await db.user.delete({ where: { id } });
    await logAudit({
      user: me, action: 'حذف کاربر', entity: 'user', entityId: id,
      details: `نام کاربری: ${target.username} — نقش: ${target.role}`,
      before: { username: target.username, fullName: target.fullName, role: target.role },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
