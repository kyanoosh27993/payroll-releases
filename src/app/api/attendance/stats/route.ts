import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { monthStats } from '@/lib/core/shifts';
import { holidaySetOfMonth } from '@/lib/core/calendar';

export const dynamic = 'force-dynamic';

/** آمار خلاصه ماه حضور (برای همه یا یک پرسنل) */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const monthId = parseIntOr(sp.get('monthId'), 0);
    if (!monthId) return NextResponse.json({ error: 'monthId الزامی است' }, { status: 400 });
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    const month = await db.attendanceMonth.findUnique({ where: { id: monthId } });
    if (!month) return NextResponse.json({ error: 'ماه حضور یافت نشد' }, { status: 404 });
    const holidays = await holidaySetOfMonth(month.jy, month.jm);
    const stats = await monthStats(monthId, holidays);
    // روزهای غایب از وضعیت رکوردها
    const rows = await db.attendanceDaily.findMany({
      where: { monthId, ...(personnelId ? { personnelId } : {}) },
      select: { personnelId: true, status: true },
    });
    const absent: Record<number, number> = {};
    for (const r of rows) {
      if ((r.status || '') === 'غایب') absent[r.personnelId] = (absent[r.personnelId] || 0) + 1;
    }
    if (personnelId) {
      const s = stats[personnelId] ?? null;
      return NextResponse.json({
        stat: s ? {
          ...s,
          absentDays: absent[personnelId] ?? 0,
          totalLateMinutes: s.lateMinutes,
          overtimeMinutes: Math.round((s.overtimeHours || 0) * 60),
        } : null,
      });
    }
    const out: Record<number, unknown> = {};
    for (const [pid, s] of Object.entries(stats)) {
      out[Number(pid)] = {
        ...s,
        absentDays: absent[Number(pid)] ?? 0,
        totalLateMinutes: s.lateMinutes,
        overtimeMinutes: Math.round((s.overtimeHours || 0) * 60),
      };
    }
    return NextResponse.json({ stats: out });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
