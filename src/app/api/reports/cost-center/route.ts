// گزارش مرکز هزینه هتل — GET /api/reports/cost-center?fyId=1&jy=1405&jm=8
// حقوق، اضافه‌کاری و بیمه به تفکیک بخش (پذیرش، خانه‌داری، آشپزخانه، نگهبانی، عمومی)
// + درصد رشد/کاهش نسبت به ماه قبل برای کنترل هزینه‌های مدیریت ارشد هتل
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function departmentReport(fyId: number, jy: number, jm: number) {
  const period = await db.payrollPeriod.findFirst({
    where: { fiscalYearId: fyId, jy, jm },
    include: { summaries: { include: { personnel: true } } },
  });
  if (!period || !period.summaries.length) return null;

  const departments = new Map<string, { count: number; gross: number; netPay: number; overtimeMin: number; workerIns: number; employerIns: number; tax: number }>();
  for (const s of period.summaries) {
    const dept = s.personnel.department || 'عمومی';
    const row = departments.get(dept) ?? { count: 0, gross: 0, netPay: 0, overtimeMin: 0, workerIns: 0, employerIns: 0, tax: 0 };
    row.count += 1;
    row.gross += s.gross || 0;
    row.netPay += s.netPay || 0;
    row.overtimeMin += s.overtimeMin || 0;
    row.workerIns += s.workerIns || 0;
    row.employerIns += s.employerIns || 0;
    row.tax += s.tax || 0;
    departments.set(dept, row);
  }
  return Array.from(departments.entries())
    .map(([department, d]) => ({
      department,
      personnelCount: d.count,
      totalGross: d.gross,
      totalNetPay: d.netPay,
      totalOvertimeHours: Math.round(d.overtimeMin / 60),
      totalWorkerIns: d.workerIns,
      totalEmployerIns: d.employerIns,
      totalTax: d.tax,
    }))
    .sort((a, b) => b.totalNetPay - a.totalNetPay);
}

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const fyId = Number(req.nextUrl.searchParams.get('fyId'));
    const jy = Number(req.nextUrl.searchParams.get('jy'));
    const jm = Number(req.nextUrl.searchParams.get('jm'));
    if (!fyId || !jy || !jm) {
      return NextResponse.json({ error: 'پارامترهای fyId، jy و jm الزامی هستند.' }, { status: 400 });
    }
    const fy = await db.fiscalYear.findUnique({ where: { id: fyId } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد.' }, { status: 404 });

    const report = await departmentReport(fyId, jy, jm);
    if (!report) {
      return NextResponse.json({ error: 'دوره محاسبه‌شده‌ای برای این ماه یافت نشد.' }, { status: 404 });
    }

    // ماه قبل — حتی اگر به اسفند سال مالی قبل برسد
    const prevFy = jm === 1
      ? await db.fiscalYear.findFirst({ where: { companyId: fy.companyId, jy: jy - 1 } })
      : fy;
    const prevFyId = jm === 1 ? prevFy?.id : fyId;
    const prevJy = jm === 1 ? jy - 1 : jy;
    const prevJm = jm === 1 ? 12 : jm - 1;
    const prevReport = prevFyId ? await departmentReport(prevFyId, prevJy, prevJm) : null;
    const prevMap = new Map((prevReport ?? []).map((r) => [r.department, r]));

    const withGrowth = report.map((r) => {
      const prev = prevMap.get(r.department);
      const prevNet = prev?.totalNetPay ?? null;
      const growthPct = prevNet !== null && prevNet > 0 ? Math.round(((r.totalNetPay - prevNet) / prevNet) * 1000) / 10 : null;
      return {
        ...r,
        prevMonthNetPay: prevNet,
        growthPct, // درصد رشد/کاهش خالص نسبت به ماه قبل (null = ماه قبل محاسبه نشده)
      };
    });

    const sum = (rows: typeof report, key: keyof (typeof report)[number]) =>
      rows.reduce((s, r) => s + (r[key] as number), 0);

    return NextResponse.json({
      period: `${jy}/${String(jm).padStart(2, '0')}`,
      previousPeriod: `${prevJy}/${String(prevJm).padStart(2, '0')}`,
      departments: withGrowth,
      totals: {
        count: sum(withGrowth, 'personnelCount'),
        gross: sum(withGrowth, 'totalGross'),
        netPay: sum(withGrowth, 'totalNetPay'),
        overtimeHours: sum(withGrowth, 'totalOvertimeHours'),
        workerIns: sum(withGrowth, 'totalWorkerIns'),
        employerIns: sum(withGrowth, 'totalEmployerIns'),
        tax: sum(withGrowth, 'totalTax'),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'خطا در تولید گزارش مرکز هزینه: ' + String(e).slice(0, 200) }, { status: 500 });
  }
}
