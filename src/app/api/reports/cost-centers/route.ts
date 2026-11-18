// گزارش مراکز هزینه — GET /api/reports/cost-centers?fyId=
// تجمیع حقوق هر ماه به تفکیک مرکز هزینه (households/آشپزخانه/پذیرش/حراست و ...)
// + مقایسه ماه‌به‌ماه هر مرکز هزینه در طول سال مالی
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { userFromHeaders, hasRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const fy = await db.fiscalYear.findUnique({ where: { id: fyId } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد' }, { status: 404 });

    const periods = await db.payrollPeriod.findMany({
      where: { fiscalYearId: fyId },
      orderBy: [{ jy: 'asc' }, { jm: 'asc' }],
      include: {
        summaries: { include: { personnel: { select: { costCenter: true } } } },
      },
    });

    const monthsOut = periods.map((p) => {
      const groups = new Map<string, { count: number; gross: number; net: number; tax: number; ins: number }>();
      for (const s of p.summaries) {
        const cc = (s.personnel.costCenter || '').trim() || 'بدون مرکز هزینه';
        const g = groups.get(cc) ?? { count: 0, gross: 0, net: 0, tax: 0, ins: 0 };
        g.count++;
        g.gross += s.gross || 0;
        g.net += s.netPay || 0;
        g.tax += s.tax || 0;
        g.ins += (s.workerIns || 0) + (s.employerIns || 0) + (s.unemploymentIns || 0);
        groups.set(cc, g);
      }
      return {
        periodId: p.id, jy: p.jy, jm: p.jm, status: p.status,
        groups: [...groups.entries()]
          .map(([costCenter, v]) => ({ costCenter, ...v }))
          .sort((a, b) => b.net - a.net),
      };
    });

    // مقایسه ماه‌به‌ماه هر مرکز هزینه (خالص)
    const centers = new Set<string>();
    for (const m of monthsOut) for (const g of m.groups) centers.add(g.costCenter);
    const comparison = [...centers].sort().map((cc) => {
      const monthly: Array<{ jm: number; net: number }> = [];
      for (const m of monthsOut) {
        const g = m.groups.find((x) => x.costCenter === cc);
        if (g) monthly.push({ jm: m.jm, net: g.net });
      }
      return {
        costCenter: cc,
        monthly,
        total: monthly.reduce((s, x) => s + x.net, 0),
        avg: monthly.length ? Math.round(monthly.reduce((s, x) => s + x.net, 0) / monthly.length) : 0,
      };
    });

    return NextResponse.json({
      fiscalYear: { id: fy.id, jy: fy.jy, title: fy.title },
      months: monthsOut,
      comparison,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
