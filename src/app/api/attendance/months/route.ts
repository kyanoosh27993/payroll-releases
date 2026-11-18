import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

/** فهرست ماه‌های حضور ثبت‌شده یک سال مالی + آمار ردیف‌ها */
export async function GET(req: NextRequest) {
  try {
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const months = await db.attendanceMonth.findMany({
      where: { fiscalYearId: fyId },
      orderBy: [{ jy: 'asc' }, { jm: 'asc' }],
      include: { _count: { select: { days: true } } },
    });
    return NextResponse.json({
      months: months.map((m) => ({
        id: m.id, jy: m.jy, jm: m.jm, source: m.source, importedAt: m.importedAt,
        dayCount: m._count.days,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
