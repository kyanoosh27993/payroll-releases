import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';
import { recalcMonth } from '@/lib/core/shifts';
import { holidaySetOfMonth } from '@/lib/core/calendar';
import { getFySettings } from '@/lib/core/payroll-calc';

export const dynamic = 'force-dynamic';

/** بازمحاسبه همه روزهای ماه بر اساس شیفت و زمان‌های مجاز تاخیر و تعجیلی تنظیمات سال مالی */
export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const monthId = parseIntOr(body.monthId, 0);
    if (!monthId) return NextResponse.json({ error: 'monthId الزامی است' }, { status: 400 });
    const month = await db.attendanceMonth.findUnique({ where: { id: monthId } });
    if (!month) return NextResponse.json({ error: 'ماه حضور یافت نشد' }, { status: 404 });
    const settings = await getFySettings(month.fiscalYearId);
    const graceLate = parseIntOr(settings['late_grace_minutes'], 10);
    const graceEarly = parseIntOr(settings['early_grace_minutes'], 10);
    const holidays = await holidaySetOfMonth(month.jy, month.jm);
    const n = await recalcMonth(monthId, holidays, graceLate, graceEarly);
    return NextResponse.json({ recalced: n });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
