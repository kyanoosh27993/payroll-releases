import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

/** روزهای ثبت‌شده یک پرسنل در ماه حضور */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const monthId = parseIntOr(sp.get('monthId'), 0);
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    if (!monthId || !personnelId) {
      return NextResponse.json({ error: 'monthId و personnelId الزامی است' }, { status: 400 });
    }
    const month = await db.attendanceMonth.findUnique({ where: { id: monthId } });
    if (!month) return NextResponse.json({ error: 'ماه حضور یافت نشد' }, { status: 404 });
    const rows = await db.attendanceDaily.findMany({
      where: { monthId, personnelId },
      orderBy: { day: 'asc' },
    });
    return NextResponse.json({
      month: { id: month.id, jy: month.jy, jm: month.jm, source: month.source },
      rows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
