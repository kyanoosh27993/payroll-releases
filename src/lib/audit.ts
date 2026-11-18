// لاگ تغییرات (Audit) — ثبت در دیتابیس + فایل متنی روزانه با چرخش خودکار
// قاعده: تغییرات اکانت سوپروایزر هیچ‌گاه ثبت نمی‌شود (داده پس از ویرایش او «خام و اصلی» تلقی می‌شود)
import { db } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { todayJalali } from './core/jalali';

export interface AuditInput {
  /** کاربر انجام‌دهنده — اگر سوپروایزر باشد لاگی ثبت نمی‌شود */
  user?: { username?: string; fullName?: string; isSupervisor?: boolean } | null;
  action: string;
  entity?: string;
  entityId?: number | null;
  details?: string;
  before?: unknown;
  after?: unknown;
}

/** کلیدهای حساس که هرگز نباید در لاگ بنشینند */
const SECRET_KEYS = /pass|token|secret|hash|salt/i;
const MAX_DEPTH = 6;

/** پاکسازی عمیق: همه لایه‌های شیء تودرتو بررسی می‌شوند (نه فقط لایه اول) */
function deepMask(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '...';
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => deepMask(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '***' : deepMask(v, depth + 1);
    }
    return out;
  }
  return value;
}

function sanitize(data: unknown): string {
  if (data === null || data === undefined) return '';
  let text: string;
  if (typeof data === 'string') text = data;
  else {
    try {
      text = JSON.stringify(deepMask(data));
    } catch {
      text = String(data);
    }
  }
  return text.slice(0, 2000);
}

/** حذف فایل‌های لاگ قدیمی — نگهداری حداکثر ۱۸۰ روز و سقف ۱۰۰ مگابایت
 *  هر ۵۰۰ فراخوانی یک‌بار اجرا می‌شود تا روی عملکرد اثر نگذارد */
let cleanupCounter = 0;
const LOG_RETENTION_DAYS = 180;
const LOG_MAX_TOTAL_BYTES = 100 * 1024 * 1024;

function cleanupOldLogs(dir: string): void {
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.log'))
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { name: f, mtime: st.mtimeMs, size: st.size };
      })
      .sort((a, b) => b.mtime - a.mtime); // جدیدترین اول
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 86400_000;
    let total = 0;
    for (const f of files) {
      if (f.mtime < cutoff) {
        try { fs.unlinkSync(path.join(dir, f.name)); } catch { /* ignore */ }
        continue;
      }
      total += f.size;
    }
    if (total > LOG_MAX_TOTAL_BYTES) {
      for (let i = files.length - 1; i >= 0 && total > LOG_MAX_TOTAL_BYTES; i--) {
        const f = files[i];
        if (f.mtime < cutoff) continue;
        try {
          fs.unlinkSync(path.join(dir, f.name));
          total -= f.size;
        } catch { /* ignore */ }
      }
    }
  } catch { /* هرگز جریان برنامه را نشکند */ }
}

function logsDir(): string {
  // اولویت: PAYROLL_DATA_DIR (نسخه exe) → کنار فایل دیتابیس (DATABASE_URL) → cwd/db
  let base = '';
  if (process.env.PAYROLL_DATA_DIR) {
    base = process.env.PAYROLL_DATA_DIR;
  } else {
    const m = (process.env.DATABASE_URL || '').match(/file:([^?]+)/);
    if (m) base = path.dirname(m[1]);
    else base = path.join(process.cwd(), 'db');
  }
  const dir = path.join(base, 'logs');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch { /* ignore */ }
  return dir;
}

/** نوشتن سطر در فایل لاگ روزانه (چرخش خودکار: هر روز یک فایل) */
function appendFileLog(username: string, action: string, entity: string, details: string, before: string, after: string): void {
  try {
    const today = todayJalali() as unknown as { jy: number; jm: number; jd: number };
    const file = path.join(logsDir(), `audit-${today.jy}-${String(today.jm).padStart(2, '0')}-${String(today.jd).padStart(2, '0')}.log`);
    const ts = new Date().toISOString();
    const line = [
      ts, username || '-', action, entity || '-',
      details.replace(/[\r\n]+/g, ' '),
      before ? `قبل: ${before.replace(/[\r\n]+/g, ' ')}` : '',
      after ? `بعد: ${after.replace(/[\r\n]+/g, ' ')}` : '',
    ].filter(Boolean).join(' | ') + '\n';
    fs.appendFileSync(file, line, 'utf8');
    if (++cleanupCounter % 500 === 0) cleanupOldLogs(logsDir());
  } catch { /* نوشتن فایل هرگز جریان برنامه را نشکند */ }
}

/** ثبت یک رویداد در لاگ — برای کاربر سوپروایزر هیچ کاری انجام نمی‌دهد */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    if (input.user?.isSupervisor) return; // قاعده سوپروایزر: بدون لاگ
    const username = input.user?.username || 'ناشناس';
    const before = sanitize(input.before);
    const after = sanitize(input.after);
    const details = sanitize(input.details) || '';
    await db.auditLog.create({
      data: {
        username,
        action: input.action,
        entity: input.entity || '',
        entityId: input.entityId ?? null,
        details,
        beforeData: before,
        afterData: after,
      },
    });
    appendFileLog(username, input.action, input.entity || '', details, before, after);
  } catch { /* لاگ هرگز عملیات اصلی را نباید بشکند */ }
}

/** ثبت خطا در لاگ (بدون داده حساس) */
export async function logError(user: AuditInput['user'], place: string, err: unknown): Promise<void> {
  await logAudit({
    user, action: 'خطا', entity: place,
    details: String(err).slice(0, 500),
  });
}
