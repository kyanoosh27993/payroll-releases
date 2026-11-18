// Seed اولیه برنامه: اقلام فیش، تقویم، ماژول‌ها، کاربر مدیر + داده نمونه تست + کد بازیابی رمز
import { db } from '@/lib/db';
import * as crypto from 'crypto';
import { DEFAULT_PAYROLL_ITEMS, ensureFySettings } from './payroll-calc';
import { seedDefaults as seedCalendar } from './calendar';
import { migrateIfNeeded } from './migrate';
import { daysInMonth, weekday } from './jalali';
import { ensureRecoveryCode } from '@/lib/recovery';
import { HOTEL_COST_CENTERS, HOTEL_PAYSLIP_GROUPS, insuranceCodeFor } from './job-titles';

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// فیکس ۱.۴.۳ — قفل همزمانی seed: در شروع سرد، /api/context و /api/auth/login همزمان
// ensureSeeded را صدا می‌زدند؛ اجرای موازی باعث seed ناقص (بدون شرکت دمو) می‌شد.
let seedPromise: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed().catch((e) => {
      seedPromise = null; // در خطا اجازه تلاش مجدد در درخواست بعدی
      throw e;
    });
  }
  return seedPromise;
}

async function doSeed(): Promise<void> {
  await migrateIfNeeded();
  // کاربر مدیر پیش‌فرض — رمز اولیه در اولین ورود اجباراً تغییر می‌کند
  const uc = await db.user.count({ where: { isSupervisor: false } });
  if (uc === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    await db.user.create({
      data: {
        username: 'admin', salt,
        passwordHash: hashPassword('Admin@1405', salt),
        fullName: 'مدیر سیستم', role: 'admin',
        mustChangePassword: true,
      },
    });
  }
  // اکانت مخفی سوپروایزر — در فهرست کاربران نمایش داده نمی‌شود و لاگ ثبت نمی‌کند
  const supc = await db.user.count({ where: { isSupervisor: true } });
  if (supc === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    await db.user.create({
      data: {
        username: 'supervisor', salt,
        passwordHash: hashPassword('Sup@1405!', salt),
        fullName: 'سوپروایزر سیستم', role: 'admin',
        isSupervisor: true, mustChangePassword: true,
      },
    });
  }
  // اقلام پیش‌فرض فیش — به‌جای شمارش کل (مایگریت سه قلم مانده اولیه را از قبل می‌گذارد)،
  // هر قلم غایب از فهرست پیش‌فرض اضافه می‌شود تا اقلام اصلی فیش هیچ‌وقت جا نیفتند
  const existingCodes = new Set(
    (await db.payrollItemConfig.findMany({ select: { code: true } })).map((i) => i.code),
  );
  const missingItems = DEFAULT_PAYROLL_ITEMS.filter((i) => !existingCodes.has(i.code));
  if (missingItems.length) {
    await db.payrollItemConfig.createMany({ data: missingItems });
  }
  // ماژول‌ها
  const mc = await db.installedModule.count();
  if (mc === 0) {
    await db.installedModule.createMany({
      data: [
        { key: 'core_companies', title: 'شرکت‌ها و سال مالی', licenseNote: 'پایه' },
        { key: 'personnel', title: 'پرسنل و قراردادها', licenseNote: 'پایه' },
        { key: 'decrees', title: 'احکام پرسنلی', licenseNote: 'پایه' },
        { key: 'attendance', title: 'حضور و غیاب', licenseNote: 'پایه' },
        { key: 'payroll', title: 'حقوق و دستمزد', licenseNote: 'پایه' },
        { key: 'outputs', title: 'خروجی‌های استاندارد', licenseNote: 'پایه' },
        { key: 'calendar', title: 'تقویم و تعطیلات', licenseNote: 'پایه' },
        { key: 'ai_assistant', title: 'دستیار هوشمند آفلاین', licenseNote: 'نسخه ۰.۴' },
      ],
    });
  }
  // تقویم رسمی
  await seedCalendar();
  // کد بازیابی رمز عبور (فایل recovery-key.txt کنار پایگاه‌داده)
  await ensureRecoveryCode();
  // داده نمونه کامل برای تست — فقط وقتی هیچ شرکتی وجود ندارد
  await ensureDemoData();
}

// ================= داده نمونه کامل برای تست =================

type ShiftSchedule = Record<string, [number, number]>;

/** ساخت ردیف‌های حضور روزانه بر اساس برنامه شیفت + استثناها */
function dailyFromSchedule(
  schedule: ShiftSchedule,
  jy: number, jm: number,
  overrides: Record<number, { start: number; end: number; status: string; leaveKind?: string; leaveMin?: number }>,
  lastDay: number,
): Array<{
  day: number; status: string; entry1: number; exit1: number; workedMin: number;
  expectedMin: number; lateMin: number; overtimeMin: number; leaveMin: number; leaveKind: string;
}> {
  const out: Array<{ day: number; status: string; entry1: number; exit1: number; workedMin: number; expectedMin: number; lateMin: number; overtimeMin: number; leaveMin: number; leaveKind: string; }> = [];
  for (let d = 1; d <= lastDay; d++) {
    const ov = overrides[d];
    if (ov) {
      if (ov.status === 'مرخصی' || ov.status === 'تعطیل') {
        out.push({ day: d, status: ov.status, entry1: -1, exit1: -1, workedMin: 0, expectedMin: 0, lateMin: 0, overtimeMin: 0, leaveMin: ov.leaveMin ?? 0, leaveKind: ov.leaveKind ?? '' });
      } else {
        const w = Math.max(0, ov.end - ov.start);
        out.push({ day: d, status: ov.status, entry1: ov.start, exit1: ov.end, workedMin: w, expectedMin: w, lateMin: 0, overtimeMin: 0, leaveMin: 0, leaveKind: '' });
      }
      continue;
    }
    // جمعه = روز تعطیل هفتگی
    if (weekday(jy, jm, d) === 6) {
      out.push({ day: d, status: 'تعطیل', entry1: -1, exit1: -1, workedMin: 0, expectedMin: 0, lateMin: 0, overtimeMin: 0, leaveMin: 0, leaveKind: '' });
      continue;
    }
    const seg = schedule[String(weekday(jy, jm, d))] ?? schedule['*'];
    if (!seg) {
      out.push({ day: d, status: 'بدون شیفت', entry1: -1, exit1: -1, workedMin: 0, expectedMin: 0, lateMin: 0, overtimeMin: 0, leaveMin: 0, leaveKind: '' });
      continue;
    }
    const [st, en] = seg;
    out.push({ day: d, status: 'حاضر', entry1: st, exit1: en, workedMin: en - st, expectedMin: en - st, lateMin: 0, overtimeMin: 0, leaveMin: 0, leaveKind: '' });
  }
  return out;
}

async function ensureDemoData() {
  const cc = await db.company.count();
  if (cc > 0) return; // فقط پایگاه‌دانه تازه — idempotent

  const company = await db.company.create({
    data: {
      name: 'هتل فرضی پارس',
      nationalId: '14005783124',
      economicCode: '411349672108',
      ssoBranchCode: '2417',
      ssoWorkshopCode: '318562',
      ssoContractRow: '2',
      taxFileCode: '517380226',
      postalCode: '1591634571',
      managerName: 'کامران دلاوری',
      address: 'تهران، خیابان انقلاب اسلامی، نبش خیابان والامر، پلاک ۴۵۰',
      phone: '02166409111',
    },
  });

  const fy = await createFiscalYear(company.id, 1405);
  await db.payrollPeriod.createMany({
    data: Array.from({ length: 12 }, (_, i) => ({ fiscalYearId: fy.id, jy: 1405, jm: i + 1, status: 'پیش‌نویس' })),
  });

  // مراکز هزینه و گروه‌های فیش هتل — به‌عنوان تنظیمات سال مالی ذخیره می‌شود تا در فرم‌ها در دسترس باشد
  const settingRows: Array<{ fiscalYearId: number; key: string; value: string }> = [
    { fiscalYearId: fy.id, key: 'cost_centers', value: JSON.stringify(HOTEL_COST_CENTERS) },
    { fiscalYearId: fy.id, key: 'payslip_groups', value: JSON.stringify(HOTEL_PAYSLIP_GROUPS) },
  ];
  for (const r of settingRows) {
    await db.fySetting.upsert({
      where: { fiscalYearId_key: { fiscalYearId: r.fiscalYearId, key: r.key } },
      create: r, update: { value: r.value },
    });
  }

  // پرسنل نمونه هتل — همه فیلدهای فرم پرسنل پر می‌شود
  const p = await db.personnel.create({
    data: {
      companyId: company.id,
      personnelCode: '1001',
      cardNo: '1001',
      firstName: 'علی',
      lastName: 'محمدی',
      fatherName: 'حسن',
      nationalId: '0079328451',
      idNumber: '214',
      idSerial: '38C/654',
      idIssuePlace: 'تهران',
      birthDate: '1370/05/12',
      gender: 'مرد',
      maritalStatus: 'متاهل',
      dependents: 1,
      education: 'لیانسانی مدیریت هتلداری',
      mobile: '09123334455',
      jobTitle: 'ناظر پذیرش (سرپرست پذیرش)',
      department: 'پذیرش',
      costCenter: 'پذیرش',
      payslipGroup: 'گروه پذیرش',
      bankName: 'بانک ملت',
      bankAccount: '7701234567',
      bankSheba: 'IR440120010000007701234567',
      ssoNumber: '874152396',
      ssoInsurer: 'تأمین اجتماعی — شعبه تهران',
      militaryStatus: 'پایان خدمت',
      workLocation: 'هتل فرضی پارس',
      permanentNight: false,
      ssoWorkerPct: 7,
      ssoEmployerPct: 20,
      ssoUnempPct: 3,
      address: 'تهران، خیابان شهید بهشتی، کوچه یاس، پلاک ۱۲',
      postalCode: '1589784312',
      birthPlace: 'تهران',
      insuranceType: 2,
      employmentType: 1,
      jobCategory: 3415,
      taxExemptionCode: 1,
      status: 'شاغل',
      hireDate: '1405/01/01',
      endWorkDate: '1405/12/29', // گزاره ۶ — تاریخ پایان قرارداد برای هشدار هوشمند
      notes: 'پرسنل نمونه هتل — داده آزمایشی',
    },
  });

  // قرارداد + حکم حقوق — اعداد حقوقی بر پایه دستمزد ۱۴۰۵ (روزانه ~۹۰۳٬۰۰۰ تومان)
  // مبالغ در پایگاه‌داده ریال است: حقوق مبنا ماهانه ~۲۷٬۰۹۰٬۰۰۰ تومان = ۲۷۰٬۹۰۰٬۰۰۰ ریال
  const BASE_WAGE = 270_900_000;      // حقوق مبنا ماهانه (ریال)
  const HOUSING = 90_000_000;         // حق مسکن ۹٬۰۰۰٬۰۰۰ تومان
  const WORKER_BEN = 140_000_000;     // بن کارگری ۱۴٬۰۰۰٬۰۰۰ تومان
  const FOOD = 140_000_000;           // کمک هزینه اقلام مصرفی
  const insuranceCode = insuranceCodeFor('ناظر پذیرش (سرپرست پذیرش)');
  await db.contract.create({
    data: {
      personnelId: p.id,
      contractType: 'ماهانه ثابت',
      hourlyRate: 1_231_000,
      dailyRate: 9_030_000,
      monthlyWage: BASE_WAGE,
      startDate: '1405/01/01',
      endDate: '1405/12/29',
      payCycle: 'ماهانه',
      insuranceRequired: true,
      notes: `قرارداد پرسنل هتل — کد شغل بیمه: ${insuranceCode} — داده نمونه`,
    },
  });
  await db.decree.create({
    data: {
      personnelId: p.id,
      effectiveDate: '1405/01/01',
      jobWage: BASE_WAGE,
      seniorityWage: 13_500_000,
      childAllowance: 30_000_000,
      housing: HOUSING,
      food: FOOD,
      workerBen: WORKER_BEN,
      familyAllowance: 30_000_000,
      shiftAllowance: 13_500_000,
      notes: 'حکم حقوق ۱۴۰۵ بر پایه حداقل دستمزد — داده نمونه هتل',
    },
  });

  // شیفت‌های هتل: صبح ۰۷–۱۵، عصر ۱۵–۲۳، شب ۲۳–۰۷ (گذر از نیمه‌شب) و گردشی
  const morning: ShiftSchedule = { '0': [420, 900], '1': [420, 900], '2': [420, 900], '3': [420, 900], '4': [420, 900], '5': [420, 900] };
  const evening: ShiftSchedule = { '0': [900, 1380], '1': [900, 1380], '2': [900, 1380], '3': [900, 1380], '4': [900, 1380], '5': [900, 1380] };
  const night: ShiftSchedule = { '0': [1380, 1860], '1': [1380, 1860], '2': [1380, 1860], '3': [1380, 1860], '4': [1380, 1860], '5': [1380, 1860] };
  // گردشی هتل: صبح/عصر متناوب + جمعه کوتاه‌تر
  const rotating: ShiftSchedule = { '0': [420, 900], '1': [900, 1380], '2': [420, 900], '3': [900, 1380], '4': [420, 900], '5': [1380, 1740], '6': [420, 780] };
  await db.shift.create({ data: { companyId: company.id, name: 'شیفت صبح (۰۷–۱۵)', schedule: JSON.stringify(morning), premiumPct: 0, notes: 'شیفت هتل — داده نمونه' } });
  await db.shift.create({ data: { companyId: company.id, name: 'شیفت عصر (۱۵–۲۳)', schedule: JSON.stringify(evening), premiumPct: 10, notes: 'شیفت هتل — داده نمونه' } });
  const sNight = await db.shift.create({ data: { companyId: company.id, name: 'شیفت شب (۲۳–۰۷)', schedule: JSON.stringify(night), premiumPct: 15, notes: 'گذر از نیمه‌شب — داده نمونه' } });
  const sRotating = await db.shift.create({ data: { companyId: company.id, name: 'شیفت گردشی هتل', schedule: JSON.stringify(rotating), premiumPct: 15, notes: 'ترکیب شیفت صبح/عصر/شب در روزهای مختلف هفته — داده نمونه' } });

  // تخصیص شیفت ماهانه: مهر = گردشی، آبان = گردشی هتل
  await db.shiftAssignment.create({ data: { personnelId: p.id, jy: 1405, jm: 7, shiftId: sRotating.id } });
  await db.shiftAssignment.create({ data: { personnelId: p.id, jy: 1405, jm: 8, shiftId: sRotating.id } });

  // استثناهای روزانه در آبان: تعطیل برای فرد، ساعت متفاوت، پوشش شیفت شب
  await db.shiftOverride.createMany({
    data: [
      { personnelId: p.id, jy: 1405, jm: 8, jd: 5, kind: 'off', note: 'تعطیل برای فرد (مرخصی بدون حقوق) — داده نمونه' },
      { personnelId: p.id, jy: 1405, jm: 8, jd: 12, kind: 'custom', startMin: 420, endMin: 1080, note: 'آموزش پذیرش ۰۷ تا ۱۸' },
      { personnelId: p.id, jy: 1405, jm: 8, jd: 18, kind: 'shift', shiftId: sNight.id, note: 'پوشش شیفت شب ۲۳–۰۷' },
    ],
  });

  // حضور و غیاب آبان ۱۴۰۵ (شیفت گردشی + استثناها) — ثبت ساعات کاری فرضی در روزهای مختلف
  const m8 = await db.attendanceMonth.create({ data: { fiscalYearId: fy.id, jy: 1405, jm: 8, source: 'داده نمونه' } });
  const ov8: Record<number, { start: number; end: number; status: string; leaveKind?: string; leaveMin?: number }> = {
    5: { start: 0, end: 0, status: 'مرخصی', leaveKind: 'بدون حقوق', leaveMin: 480 },
    12: { start: 420, end: 1080, status: 'حاضر' },
    18: { start: 1380, end: 1860, status: 'حاضر' },
  };
  const lastDay8 = Math.min(daysInMonth(1405, 8), 29);
  const rows8 = dailyFromSchedule(rotating, 1405, 8, ov8, lastDay8);
  await db.attendanceDaily.createMany({
    data: rows8.map((r) => ({
      monthId: m8.id, personnelId: p.id, day: r.day, status: r.status,
      entry1: r.entry1, exit1: r.exit1, workedMin: r.workedMin, expectedMin: r.expectedMin,
      lateMin: r.day === 9 ? 20 : 0,
      overtimeMin: r.day === 22 ? 90 : 0,
    })),
  });

  // مرخصی، مساعده، وام و مانده اولیه
  await db.leave.create({ data: { personnelId: p.id, fromDate: '1405/08/05', toDate: '1405/08/05', days: 1, leaveKind: 'بدون حقوق', approved: true, notes: 'داده نمونه هتل' } });
  await db.advance.create({ data: { personnelId: p.id, payDate: '1405/08/10', amount: 30_000_000, period: '1405-08', notes: 'مساعده نمونه' } });
  await db.loan.create({ data: { personnelId: p.id, title: 'وام ضروری مسکن', totalAmount: 240_000_000, installment: 20_000_000, installmentsCount: 12, paidCount: 0, startPeriod: '1405-08', remaining: 240_000_000, notes: 'داده نمونه' } });
  await db.openingBalance.create({ data: { personnelId: p.id, title: 'مانده مرخصی سال قبل', kind: 'leave_balance', unit: 'days', amount: 9, effect: 'none', notes: 'داده نمونه' } });
}

/** ایجاد سال مالی با تنظیمات پیش‌فرض */
export async function createFiscalYear(companyId: number, jy: number) {
  const fy = await db.fiscalYear.upsert({
    where: { companyId_jy: { companyId, jy } },
    create: { companyId, jy, title: `سال مالی ${jy}` },
    update: {},
  });
  await ensureFySettings(fy.id);
  return fy;
}
