// مهاجرت خودکار دیتابیس در اولین اجرا — برای نسخه exe که prisma CLI ندارد
// اسکیمای SQL از prisma/init.sql خوانده و روی دیتابیس خالی اجرا می‌شود.
// ensureSchemaUpgrades: ارتقای تدریجی دیتابیس‌های موجود (افزودن ستون‌ها/جدول‌های جدید نسخه‌ها)
import { readFileSync } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { appRoot } from '@/lib/app-root';
import * as crypto from 'crypto';

let migrated = false;
let upgraded = false;
// فیکس ۱.۴.۳ — قفل همزمانی: دو درخواست همزمان (مثلاً /api/context و /api/auth/login در شروع سرد)
// هر دو وارد migrateIfNeeded می‌شدند و اجرای موازی init.sql باعث P2021/جدول تکراری و
// seed ناقص می‌شد (کاربر با دیتابیس خالی و بدون شرکت دمو می‌ماند). اکنون فقط یک اجرا انجام می‌شود.
let migratePromise: Promise<void> | null = null;

type RawDb = { $queryRawUnsafe: <T = unknown>(q: string) => Promise<T> };

async function tableExists(tx: RawDb, name: string): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`,
  );
  return rows.length > 0;
}

async function columnsOf(tx: RawDb, table: string): Promise<Set<string>> {
  const rows = await tx.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info('${table}')`);
  return new Set(rows.map((r) => r.name));
}

/** ارتقای دیتابیس‌های ساخته‌شده با نسخه‌های قدیمی — idempotent، در هر اجرا چک می‌شود */
export async function ensureSchemaUpgrades(): Promise<void> {
  if (upgraded) return;
  // --- نسخه ۰.۷: کاربران و نشست‌ها، لاگ کامل، حق شیفت، ستاره ویرایش دستی ---
  if (!(await tableExists(db, 'Session'))) {
    await db.$executeRawUnsafe(`CREATE TABLE "Session" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "token" TEXT NOT NULL UNIQUE,
      "userId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME NOT NULL,
      CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX "Session_userId_idx" ON "Session"("userId")`);
  }
  const u = await columnsOf(db, 'User');
  if (!u.has('mustChangePassword')) await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0`);
  if (!u.has('failedAttempts')) await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0`);
  if (!u.has('lockedUntil')) await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "lockedUntil" DATETIME`);
  if (!u.has('isSupervisor')) await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "isSupervisor" BOOLEAN NOT NULL DEFAULT 0`);
  // --- نسخه ۱.۴.۳: تاریخ انقضای اعتبار اکانت کاربران (ورود خودکار پس از انقضا مسدود می‌شود) ---
  if (!u.has('expiresAt')) await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "expiresAt" DATETIME`);
  // ترتیب درست: اول ساخت جدول AuditLog (اگر نیست) بعد ALTER ستون‌ها —
  // در دیتابیس قدیمی که AuditLog ندارد، PRAGMA روی جدول غایب خالی است و ALTER کرش می‌کرد
  if (!(await tableExists(db, 'AuditLog'))) {
    await db.$executeRawUnsafe(`CREATE TABLE "AuditLog" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT, "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "username" TEXT, "action" TEXT NOT NULL, "entity" TEXT NOT NULL DEFAULT '',
      "entityId" INTEGER, "details" TEXT NOT NULL DEFAULT '',
      "beforeData" TEXT NOT NULL DEFAULT '', "afterData" TEXT NOT NULL DEFAULT ''
    )`);
  }
  const a = await columnsOf(db, 'AuditLog');
  if (!a.has('entity')) await db.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD COLUMN "entity" TEXT NOT NULL DEFAULT ''`);
  if (!a.has('entityId')) await db.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD COLUMN "entityId" INTEGER`);
  if (!a.has('beforeData')) await db.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD COLUMN "beforeData" TEXT NOT NULL DEFAULT ''`);
  if (!a.has('afterData')) await db.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD COLUMN "afterData" TEXT NOT NULL DEFAULT ''`);
  const sh = await columnsOf(db, 'Shift');
  if (!sh.has('premiumPct')) await db.$executeRawUnsafe(`ALTER TABLE "Shift" ADD COLUMN "premiumPct" REAL NOT NULL DEFAULT 10`);
  const ad = await columnsOf(db, 'AttendanceDaily');
  if (!ad.has('edited')) await db.$executeRawUnsafe(`ALTER TABLE "AttendanceDaily" ADD COLUMN "edited" BOOLEAN NOT NULL DEFAULT 0`);

  // --- نسخه ۱٫۱/۱٫۲: بخش سازمانی و عکس پرسنلی، قرارداد هوشمند، فرم‌های چاپی ---
  // در نسخه‌های قبلی این ستون‌ها فقط با اجرای دستی روی دیتابیس توسعه اعمال شده بود؛
  // دیتابیس‌های نصب‌شده روی سیستم کاربر بدون این بلوک «no such column» می‌گرفتند (خطای Internal Server Error)
  const p = await columnsOf(db, 'Personnel');
  if (!p.has('department')) await db.$executeRawUnsafe(`ALTER TABLE "Personnel" ADD COLUMN "department" TEXT NOT NULL DEFAULT 'عمومی'`);
  if (!p.has('photo')) await db.$executeRawUnsafe(`ALTER TABLE "Personnel" ADD COLUMN "photo" TEXT NOT NULL DEFAULT ''`);
  if (!p.has('jobCode')) await db.$executeRawUnsafe(`ALTER TABLE "Personnel" ADD COLUMN "jobCode" TEXT NOT NULL DEFAULT ''`);
  const ct = await columnsOf(db, 'Contract');
  if (!ct.has('docKind')) await db.$executeRawUnsafe(`ALTER TABLE "Contract" ADD COLUMN "docKind" TEXT NOT NULL DEFAULT ''`);
  if (!ct.has('periodKey')) await db.$executeRawUnsafe(`ALTER TABLE "Contract" ADD COLUMN "periodKey" TEXT NOT NULL DEFAULT ''`);
  if (!ct.has('snapshot')) await db.$executeRawUnsafe(`ALTER TABLE "Contract" ADD COLUMN "snapshot" TEXT NOT NULL DEFAULT ''`);
  if (!ct.has('isValid')) await db.$executeRawUnsafe(`ALTER TABLE "Contract" ADD COLUMN "isValid" BOOLEAN NOT NULL DEFAULT 1`);
  if (!(await tableExists(db, 'PrintForm'))) {
    await db.$executeRawUnsafe(`CREATE TABLE "PrintForm" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "fileName" TEXT NOT NULL,
      "mime" TEXT NOT NULL DEFAULT 'application/octet-stream',
      "size" INTEGER NOT NULL DEFAULT 0,
      "data" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  }

  // --- نسخه ۱٫۴: شیفت روزانه/تک‌روزه (استثنای یک روز برای یک فرد) ---
  if (!(await tableExists(db, 'ShiftOverride'))) {
    await db.$executeRawUnsafe(`CREATE TABLE "ShiftOverride" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "personnelId" INTEGER NOT NULL,
      "jy" INTEGER NOT NULL,
      "jm" INTEGER NOT NULL,
      "jd" INTEGER NOT NULL,
      "kind" TEXT NOT NULL DEFAULT 'custom',
      "shiftId" INTEGER,
      "startMin" INTEGER NOT NULL DEFAULT 480,
      "endMin" INTEGER NOT NULL DEFAULT 960,
      "note" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ShiftOverride_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
  }
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ShiftOverride_personnelId_jy_jm_jd_key" ON "ShiftOverride"("personnelId", "jy", "jm", "jd")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShiftOverride_jy_jm_idx" ON "ShiftOverride"("jy", "jm")`);

  // --- نسخه ۰.۸: مانده‌های اولیه پرسنل + نشست با انقضای بی‌کاری + ایندکس‌ها ---
  if (!(await tableExists(db, 'OpeningBalance'))) {
    await db.$executeRawUnsafe(`CREATE TABLE "OpeningBalance" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "personnelId" INTEGER NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "kind" TEXT NOT NULL DEFAULT 'other',
      "unit" TEXT NOT NULL DEFAULT 'amount',
      "amount" REAL NOT NULL DEFAULT 0,
      "effect" TEXT NOT NULL DEFAULT 'none',
      "consumed" BOOLEAN NOT NULL DEFAULT 0,
      "usedPeriod" TEXT NOT NULL DEFAULT '',
      "notes" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OpeningBalance_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
  }
  const s = await columnsOf(db, 'Session');
  if (!s.has('lastSeenAt')) await db.$executeRawUnsafe(`ALTER TABLE "Session" ADD COLUMN "lastSeenAt" DATETIME`);
  // ایندکس‌های پرکاربرد محاسبات و گزارش‌ها (idempotent)
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OpeningBalance_personnelId_idx" ON "OpeningBalance"("personnelId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Decree_personnelId_idx" ON "Decree"("personnelId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShiftAssignment_jy_jm_idx" ON "ShiftAssignment"("jy", "jm")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Loan_personnelId_idx" ON "Loan"("personnelId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Advance_personnelId_idx" ON "Advance"("personnelId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Leave_personnelId_idx" ON "Leave"("personnelId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PayrollSummary_personnelId_idx" ON "PayrollSummary"("personnelId")`);
  // حالت WAL: خواندن همزمان با نوشتن + سرعت بیشتر روی SQLite
  // journal_mode نتیجه برمی‌گرداند → queryRawUnsafe (executeRaw با خروجی خطا می‌دهد)
  await db.$queryRawUnsafe(`PRAGMA journal_mode=WAL`);
  await db.$queryRawUnsafe(`PRAGMA synchronous=NORMAL`);

  // --- اصلاح داده: مبالغ حقوقی عدد صحیح ریال (حذف خطای اعشار Float) ---
  // شرط WHERE باعث می‌شود فقط سطرهای اعشاری به‌روزشوند؛ اجرای مکرر بدون هزینه است
  const moneyRounding: Array<[string, string]> = [
    ['PayrollLine', 'amount'], ['PayrollManual', 'amount'], ['Advance', 'amount'],
    ['PayrollSummary', 'gross'], ['PayrollSummary', 'insuredBase'], ['PayrollSummary', 'workerIns'],
    ['PayrollSummary', 'employerIns'], ['PayrollSummary', 'unemploymentIns'], ['PayrollSummary', 'taxBase'],
    ['PayrollSummary', 'tax'], ['PayrollSummary', 'totalDeductions'], ['PayrollSummary', 'netPay'],
    ['PayrollSummary', 'prevBalance'],
    ['Decree', 'jobWage'], ['Decree', 'seniorityWage'], ['Decree', 'childAllowance'], ['Decree', 'housing'],
    ['Decree', 'food'], ['Decree', 'adjustmentDiff'], ['Decree', 'supervision'], ['Decree', 'educationAid'],
    ['Decree', 'laborMarket'], ['Decree', 'attractionAmount'], ['Decree', 'otherBenefits'], ['Decree', 'workerBen'],
    ['Decree', 'fixedOvertime'], ['Decree', 'familyAllowance'], ['Decree', 'shiftAllowance'],
    ['Contract', 'hourlyRate'], ['Contract', 'dailyRate'], ['Contract', 'monthlyWage'], ['Contract', 'projectAmount'],
    ['Loan', 'totalAmount'], ['Loan', 'installment'], ['Loan', 'remaining'],
    ['TaxBracket', 'fromAmount'], ['TaxBracket', 'toAmount'],
  ];
  for (const [tbl, col] of moneyRounding) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE "${tbl}" SET "${col}" = CAST(ROUND("${col}") AS INTEGER) WHERE "${col}" IS NOT NULL AND "${col}" <> CAST("${col}" AS INTEGER)`,
      );
    } catch { /* جدول/ستون در دیتابیس خیلی قدیمی ممکن است نباشد */ }
  }

  // اقلام پیش‌فرض جدید فیش برای دیتابیس‌های موجود
  await db.$executeRawUnsafe(`INSERT OR IGNORE INTO "PayrollItemConfig"
    ("code","title","kind","formulaKey","taxMode","taxPercent","insured","active","sort","systemLocked")
    VALUES
    ('ob_ins','مانده‌های اولیه (مشمول بیمه و مالیات)','earning','ob_earning_ins','m84',0,1,1,195,1),
    ('ob_free','مانده‌های اولیه (بدون بیمه و مالیات)','earning','ob_earning_free','none',0,0,1,205,1),
    ('ob_deduct','کسور مانده‌های اولیه','deduction','ob_deduction','none',0,0,1,545,1)`);

  // --- اصلاح داده: بیمه کارفرما ۲۳٪ + ۳٪ بیکاری = ۲۶٪ بود؛ درست: ۲۰٪ + ۳٪ = ۲۳٪ ---
  await db.$executeRawUnsafe(`UPDATE "FySetting" SET "value"='20' WHERE "key"='sso_employer_rate' AND "value"='23'`);
  await db.$executeRawUnsafe(`UPDATE "PayrollItemConfig" SET "title"='بیمه سهم کارفرما (۲۰٪)' WHERE "code"='employer_ins'`);
  await db.$executeRawUnsafe(`UPDATE "PayrollItemConfig" SET "formulaKey"='shift_premium_percent' WHERE "code"='shift_allow'`);

  // --- اجبار تغییر رمز: کاربری که هنوز رمز پیش‌فرض admin123 دارد ---
  const admins = await db.user.findMany({ where: { isSupervisor: false } });
  for (const usr of admins) {
    if (crypto.scryptSync('admin123', usr.salt, 64).toString('hex') === usr.passwordHash && !usr.mustChangePassword) {
      await db.user.update({ where: { id: usr.id }, data: { mustChangePassword: true } });
    }
  }

  // --- اکانت مخفی سوپروایزر (اگر وجود نداشت ساخته می‌شود) ---
  const supCount = await db.user.count({ where: { isSupervisor: true } });
  if (supCount === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    await db.user.create({
      data: {
        username: 'supervisor', salt,
        passwordHash: crypto.scryptSync('Sup@1405!', salt, 64).toString('hex'),
        fullName: 'سوپروایزر سیستم', role: 'admin',
        isSupervisor: true, mustChangePassword: true,
      },
    });
  }
  upgraded = true;
}

export async function migrateIfNeeded(): Promise<void> {
  if (migrated) return;
  // قفل همزمانی — اجرای موازی init.sql روی SQLite مجاز نیست
  if (!migratePromise) {
    migratePromise = doMigrate().catch((e) => {
      migratePromise = null; // در خطا اجازه تلاش مجدد
      throw e;
    });
  }
  await migratePromise;
}

async function doMigrate(): Promise<void> {
  const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Company'`,
  );
  if (tables.length > 0) {
    migrated = true;
    await ensureSchemaUpgrades();
    return;
  }
  // یافتن init.sql در همه حالت‌ها: exe الکترون (env)، اجرای standalone، اجرای سورس
  const candidates = [
    process.env.PAYROLL_WEBAPP_DIR && path.join(process.env.PAYROLL_WEBAPP_DIR, 'prisma', 'init.sql'),
    path.join(process.cwd(), 'prisma', 'init.sql'),
    path.join(process.cwd(), 'init.sql'),
    path.join(appRoot(), 'prisma', 'init.sql'),
    path.join(appRoot(), 'init.sql'),
  ].filter(Boolean) as string[];
  let sql = '';
  let foundAt = '';
  for (const p of candidates) {
    try {
      sql = readFileSync(p, 'utf8');
      foundAt = p;
      break;
    } catch { /* مسیر بعدی */ }
  }
  if (!sql) {
    throw new Error('init.sql یافت نشد — مسیرهای امتحان‌شده: ' + candidates.join(' , '));
  }
  console.log('[migrate] init.sql:', foundAt);
  const statements = sql
    .split(/;\s*\n/)
    .map((s) =>
      s.split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);
  for (const st of statements) {
    await db.$executeRawUnsafe(st);
  }
  migrated = true;
  await ensureSchemaUpgrades();
}
