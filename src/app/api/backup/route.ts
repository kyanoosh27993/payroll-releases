// پشتیبان‌گیری و بازگردانی — GET فهرست / POST ساخت یا بازگردانی / DELETE حذف
// فایل دیتابیس SQLite در پوشه backups کنار دیتابیس کپی می‌شود.
// بازگردانی: فایل فعلی اول به‌عنوان pre-restore ذخیره و بعد نسخه انتخابی جایگزین می‌شود.
// پس از بازگردانی برنامه باید دوباره اجرا شود (پیام restart برگردانده می‌شود).
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function dbFilePath(): { dir: string; file: string } {
  // اولویت: DATABASE_URL واقعی (پرازیما از همین استفاده می‌کند) — در exe مسیر data/payroll.db است
  const m = (process.env.DATABASE_URL || '').match(/file:([^?]+)/);
  if (m) {
    const p = path.resolve(m[1]);
    return { dir: path.dirname(p), file: path.basename(p) };
  }
  if (process.env.PAYROLL_DATA_DIR) {
    return { dir: path.join(process.env.PAYROLL_DATA_DIR, 'data'), file: 'payroll.db' };
  }
  return { dir: path.join(process.cwd(), 'db'), file: 'custom.db' };
}

/** پوشه بک‌آپ‌های اتوماتیک (~/.payroll-backups) — مورد ۱۱ نسخه ۱٫۴٫۳ */
function autoBackupsDir(): string {
  const d = path.join(process.env.HOME || process.cwd(), '.payroll-backups');
  try { fs.mkdirSync(d, { recursive: true }); } catch { /* ignore */ }
  return d;
}

function listAutoBackups(): Array<{ name: string; size: number; mtime: string; kind: string }> {
  const d = autoBackupsDir();
  try {
    return fs.readdirSync(d)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const st = fs.statSync(path.join(d, f));
        return {
          name: f, size: st.size, mtime: st.mtime.toISOString(),
          kind: f.startsWith('exit-') ? 'exit' : f.startsWith('pre-restore-') ? 'pre-restore' : 'calc',
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch { return []; }
}

function backupsDir(): string {
  const { dir } = dbFilePath();
  const d = path.join(dir, 'backups');
  try { fs.mkdirSync(d, { recursive: true }); } catch { /* ignore */ }
  return d;
}

function listBackups(): Array<{ name: string; size: number; mtime: string; preRestore: boolean }> {
  const d = backupsDir();
  try {
    return fs.readdirSync(d)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const st = fs.statSync(path.join(d, f));
        return {
          name: f,
          size: st.size,
          mtime: st.mtime.toISOString(),
          preRestore: f.startsWith('pre-restore-'),
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

function stampNow(): string {
  const n = new Date();
  return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}` +
    `-${String(n.getHours()).padStart(2, '0')}${String(n.getMinutes()).padStart(2, '0')}${String(n.getSeconds()).padStart(2, '0')}`;
}

/** فهرست پشتیبان‌ها */
export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const scope = sp.get('scope') ?? 'manual';
    // دانلود فایل پشتیبان برای ذخیره در مسیر دلخواه کاربر
    const download = sp.get('download') ?? '';
    if (download) {
      // ممیزی امنیتی ۱٫۴٫۳ (یافته ۴): فایل دیتابیس حاوی هش رمزهاست — دانلود فقط با نقش مدیر
      if (!hasRole(me, 'admin')) {
        return NextResponse.json({ error: 'دانلود نسخه پشتیبان فقط با نقش مدیر مجاز است' }, { status: 403 });
      }
      if (!/^[\w.-]+\.db$/.test(download) || download.includes('..')) {
        return NextResponse.json({ error: 'نام فایل نامعتبر است' }, { status: 400 });
      }
      const d = scope === 'auto' ? autoBackupsDir() : backupsDir();
      const f = path.join(d, download);
      if (!fs.existsSync(f)) return NextResponse.json({ error: 'فایل یافت نشد' }, { status: 404 });
      await logAudit({ user: me, action: 'دانلود نسخه پشتیبان', entity: 'backup', details: download });
      return new NextResponse(fs.readFileSync(f), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${download}"`,
        },
      });
    }
    if (scope === 'auto') {
      return NextResponse.json({ backups: listAutoBackups() });
    }
    return NextResponse.json({ backups: listBackups() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** ساخت پشتیبان جدید یا بازگردانی */
export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin')) {
      return NextResponse.json({ error: 'پشتیبان‌گیری فقط با نقش مدیر مجاز است' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'create');
    const scope = String(body.scope ?? 'manual');
    const { dir, file } = dbFilePath();
    const dbPath = path.join(dir, file);

    // پاک‌سازی کامل دیتابیس — فقط و فقط اکانت سوپروایزر (مورد ۱۱ نسخه ۱٫۴٫۳)
    if (action === 'wipe') {
      if (!me?.isSupervisor) {
        return NextResponse.json({ error: 'پاک‌سازی کامل دیتابیس فقط با اکانت سوپروایزر مجاز است' }, { status: 403 });
      }
      const confirmText = String(body.confirm ?? '');
      if (confirmText !== 'PAK-KON') {
        return NextResponse.json({ error: 'تائیدیه پاک‌سازی نامعتبر است' }, { status: 400 });
      }
      // پشتیبان نهایی قبل از پاک‌سازی — در پوشه اتوماتیک ذخیره می‌شود
      if (fs.existsSync(dbPath)) {
        try {
          const { db } = await import('@/lib/db');
          await db.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
        } catch { /* ignore */ }
        const snap = path.join(autoBackupsDir(), `exit-wipe-${stampNow()}.db`);
        fs.copyFileSync(dbPath, snap);
      }
      const { db } = await import('@/lib/db');
      const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations'`,
      );
      await db.$transaction(async (tx) => {
        for (const t of tables) {
          await tx.$executeRawUnsafe(`DELETE FROM "${t.name.replace(/"/g, '')}"`);
        }
      });
      try { await db.$executeRawUnsafe('VACUUM'); } catch { /* ignore */ }
      await logAudit({ user: me, action: 'پاک‌سازی کامل دیتابیس', entity: 'backup', details: `تمام داده‌ها حذف شد — اسنپ‌شات: exit-wipe` });
      return NextResponse.json({ ok: true, needsRestart: true, wiped: tables.length });
    }

    if (action === 'create') {
      if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ error: 'فایل دیتابیس یافت نشد' }, { status: 500 });
      }
      // flush WAL تا کپی کامل باشد
      try {
        const { db } = await import('@/lib/db');
        await db.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
      } catch { /* ignore */ }
      const name = `backup-${stampNow()}.db`;
      fs.copyFileSync(dbPath, path.join(backupsDir(), name));
      await logAudit({ user: me, action: 'تهیه نسخه پشتیبان', entity: 'backup', details: name });
      return NextResponse.json({ ok: true, name, backups: listBackups() });
    }

    if (action === 'restore') {
      const name = String(body.name ?? '');
      if (!/^[\w.-]+\.db$/.test(name) || name.includes('..')) {
        return NextResponse.json({ error: 'نام فایل نامعتبر است' }, { status: 400 });
      }
      const src = path.join(scope === 'auto' ? autoBackupsDir() : backupsDir(), name);
      if (!fs.existsSync(src)) {
        return NextResponse.json({ error: 'فایل پشتیبان یافت نشد' }, { status: 404 });
      }
      // نسخه فعلی قبل از بازگردانی نگه داشته می‌شود
      if (fs.existsSync(dbPath)) {
        try {
          const { db } = await import('@/lib/db');
          await db.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
        } catch { /* ignore */ }
        fs.copyFileSync(dbPath, path.join(backupsDir(), `pre-restore-${stampNow()}.db`));
      }
      fs.copyFileSync(src, dbPath);
      // فایل‌های WAL قدیمی نباید با دیتابیس جدید ناسازگار بمانند
      for (const ext of ['-wal', '-shm']) {
        try { fs.unlinkSync(dbPath + ext); } catch { /* ignore */ }
      }
      await logAudit({
        user: me, action: 'بازگردانی نسخه پشتیبان', entity: 'backup',
        details: `${name} — برنامه باید مجددا اجرا شود`,
      });
      return NextResponse.json({ ok: true, needsRestart: true });
    }

    return NextResponse.json({ error: 'عملیات نامعتبر است' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** حذف یک پشتیبان */
export async function DELETE(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin')) {
      return NextResponse.json({ error: 'حذف پشتیبان فقط با نقش مدیر مجاز است' }, { status: 403 });
    }
    const name = req.nextUrl.searchParams.get('name') ?? '';
    const scope = req.nextUrl.searchParams.get('scope') ?? 'manual';
    if (!/^[\w.-]+\.db$/.test(name) || name.includes('..')) {
      return NextResponse.json({ error: 'نام فایل نامعتبر است' }, { status: 400 });
    }
    const p = path.join(scope === 'auto' ? autoBackupsDir() : backupsDir(), name);
    if (!fs.existsSync(p)) return NextResponse.json({ error: 'فایل یافت نشد' }, { status: 404 });
    fs.unlinkSync(p);
    await logAudit({ user: me, action: 'حذف نسخه پشتیبان', entity: 'backup', details: name });
    return NextResponse.json({ ok: true, backups: scope === 'auto' ? listAutoBackups() : listBackups() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
