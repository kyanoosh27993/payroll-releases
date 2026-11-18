// API داشبورد — آمار کلی: پرسنل، آخرین دوره حقوق، دوره‌های سال، تعطیلات پیش رو
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { todayJalali, MONTH_NAMES } from '@/lib/core/jalali';
import { ensureYear } from '@/lib/core/calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const companyId = parseIntOr(req.nextUrl.searchParams.get('companyId'), 1);
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    const today = todayJalali();

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: 'شرکت یافت نشد' }, { status: 404 });

    const fy = fyId
      ? await db.fiscalYear.findUnique({ where: { id: fyId } })
      : await db.fiscalYear.findFirst({ where: { companyId }, orderBy: { jy: 'desc' } });

    // پرسنل به تفکیک وضعیت
    const statusGroups = await db.personnel.groupBy({
      by: ['status'], where: { companyId }, _count: true,
    });
    const totalPersonnel = await db.personnel.count({ where: { companyId } });
    const statusMap: Record<string, number> = {};
    for (const g of statusGroups) statusMap[g.status] = g._count;

    // دوره‌های سال مالی با جمع خلاصه
    const periods = fy
      ? await db.payrollPeriod.findMany({
          where: { fiscalYearId: fy.id },
          include: {
            _count: { select: { summaries: true } },
            summaries: { select: { netPay: true, tax: true, workerIns: true, employerIns: true, unemploymentIns: true, gross: true } },
          },
          orderBy: [{ jy: 'asc' }, { jm: 'asc' }],
        })
      : [];

    const periodRows = periods.map((p) => {
      const t = p.summaries.reduce((acc, s) => ({
        net: acc.net + s.netPay,
        tax: acc.tax + s.tax,
        ins: acc.ins + s.workerIns + s.employerIns + s.unemploymentIns,
        gross: acc.gross + s.gross,
      }), { net: 0, tax: 0, ins: 0, gross: 0 });
      return {
        id: p.id, jy: p.jy, jm: p.jm, status: p.status,
        monthName: MONTH_NAMES[p.jm - 1],
        count: p._count.summaries,
        netPay: t.net, tax: t.tax, insurance: t.ins, gross: t.gross,
      };
    });

    // آخرین دوره دارای خلاصه
    const lastPeriod = [...periodRows].reverse().find((p) => p.count > 0) ?? null;

    // تعطیلات پیش رو (۵ تعطیل بعدی از امروز — با عبور از مرز سال)
    await ensureYear(today.jy);
    if (today.jm >= 11) await ensureYear(today.jy + 1);
    const events = await db.calendarEvent.findMany({
      where: {
        kind: 'holiday',
        OR: [{ jy: today.jy }, { jy: today.jy + 1 }],
      },
      orderBy: [{ jy: 'asc' }, { jm: 'asc' }, { jd: 'asc' }],
    });
    const upcoming = events
      .filter((e) => (e.jy > today.jy) || (e.jy === today.jy && (e.jm > today.jm || (e.jm === today.jm && e.jd >= today.jd))))
      .slice(0, 5)
      .map((e) => ({
        id: e.id, jy: e.jy, jm: e.jm, jd: e.jd, title: e.title,
        monthName: MONTH_NAMES[e.jm - 1],
        label: `${e.jd} ${MONTH_NAMES[e.jm - 1]} ${e.jy}`,
      }));

    return NextResponse.json({
      company: { id: company.id, name: company.name },
      fy: fy ? { id: fy.id, jy: fy.jy } : null,
      today: { jy: today.jy, jm: today.jm, jd: today.jd, monthName: MONTH_NAMES[today.jm - 1] },
      personnel: {
        total: totalPersonnel,
        byStatus: statusMap,
        active: statusMap['شاغل'] ?? 0,
        inactive: statusMap['غیرفعال'] ?? 0,
      },
      lastPeriod,
      periods: periodRows,
      upcomingHolidays: upcoming,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
