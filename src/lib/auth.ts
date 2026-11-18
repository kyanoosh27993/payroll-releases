// احراز هویت و نشست کاربران — scrypt + نشست دیتابیسی + قفل تلاش ورود
import * as crypto from 'crypto';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'pd_session';
const SESSION_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 5;

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isSupervisor: boolean;
  mustChangePassword: boolean;
  /** تاریخ انقضای اعتبار اکانت (ISO) — خالی = بدون محدودیت؛ برای پیغام ۷ روز مانده */
  expiresAt?: string | null;
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(password, salt), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** ورود: بررسی قفل، رمز، ساخت نشست — رشته خطای فارسی یا کاربر */
export async function login(username: string, password: string): Promise<{ ok: true; user: SessionUser; token: string } | { ok: false; error: string; mustChangePassword?: boolean }> {
  const uname = username.trim().toLowerCase();
  const user = await db.user.findFirst({ where: { username: { equals: uname } } });
  // نام کاربری در دیتابیس ممکن است با حروف بزرگ ذخیره شده باشد
  const user2 = user ?? await db.user.findFirst({ where: { username: uname } });
  const u = user2;
  if (!u || !u.active) return { ok: false, error: 'نام کاربری یا رمز عبور نادرست است' };
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    const min = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `به دلیل تلاش‌های ناموفق، حساب تا ${min} دقیقه قفل است` };
  }
  if (!verifyPassword(password, u.salt, u.passwordHash)) {
    const failed = u.failedAttempts + 1;
    const lockedUntil = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await db.user.update({
      where: { id: u.id },
      data: { failedAttempts: lockedUntil ? 0 : failed, lockedUntil },
    });
    return {
      ok: false,
      error: lockedUntil
        ? `پنج بار رمز نادرست وارد شد — حساب برای ${LOCK_MINUTES} دقیقه قفل شد`
        : `نام کاربری یا رمز عبور نادرست است (${failed} از ${MAX_FAILED} تلاش)`,
    };
  }
  // --- نسخه ۱.۴.۳: مسدودسازی ورود اکانت منقضی (تاریخ انقضا توسط مدیر تعیین می‌شود) ---
  if (u.expiresAt && u.expiresAt <= new Date()) {
    return {
      ok: false,
      error: `اعتبار این حساب تا تاریخ ${u.expiresAt.toLocaleDateString('fa-IR')} به پایان رسیده است — برای تمدید اعتبار با مدیر سیستم تماس بگیرید`,
    };
  }
  await db.user.update({ where: { id: u.id }, data: { failedAttempts: 0, lockedUntil: null } });
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { token, userId: u.id, expiresAt } });
  return {
    ok: true,
    token,
    user: toSessionUser(u),
  };
}

export function toSessionUser(u: {
  id: number; username: string; fullName: string; role: string;
  isSupervisor: boolean; mustChangePassword: boolean; expiresAt?: Date | null;
}): SessionUser {
  return {
    id: u.id, username: u.username, fullName: u.fullName || u.username,
    role: u.role, isSupervisor: u.isSupervisor, mustChangePassword: u.mustChangePassword,
    expiresAt: u.expiresAt ? u.expiresAt.toISOString() : null,
  };
}

/** خواندن کاربر جاری از هدرهایی که middleware روی درخواست می‌گذارد */
export function userFromHeaders(req: NextRequest): SessionUser | null {
  const id = Number(req.headers.get('x-user-id') || '0');
  if (!id) return null;
  const dec = (v: string | null) => {
    if (!v) return '';
    try { return Buffer.from(v, 'base64url').toString('utf8'); } catch { return v; }
  };
  return {
    id,
    username: dec(req.headers.get('x-username')),
    fullName: dec(req.headers.get('x-fullname')),
    role: req.headers.get('x-user-role') || 'viewer',
    isSupervisor: req.headers.get('x-is-supervisor') === '1',
    mustChangePassword: false,
  };
}

/** واکشی کاربر از دیتابیس بر اساس کوکی نشست — برای مسیرهایی که به هدر بسنده نمی‌کنند */
export async function sessionUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sess = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!sess || sess.expiresAt < new Date() || !sess.user.active) return null;
  // اکانتی که در میانه نشست منقضی شود، بلافاصله از برنامه خارج می‌شود
  if (sess.user.expiresAt && sess.user.expiresAt <= new Date()) return null;
  return toSessionUser(sess.user);
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } });
}

/** پاسخ 401 استاندارد برای APIها */
export function unauthorized() {
  return Response.json({ error: 'برای انجام این عملیات باید وارد حساب خود شوید' }, { status: 401 });
}

/** بررسی نقش — فقط نقش‌های مجاز پاسخ می‌گیرند */
export function hasRole(user: SessionUser | null, ...roles: string[]): boolean {
  if (!user) return false;
  if (user.isSupervisor) return true;
  return roles.includes(user.role);
}
