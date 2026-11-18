import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { calculatePeriod, ensureFySettings } from '@/lib/core/payroll-calc';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** محاسبه کامل یک دوره حقوق برای همه پرسنل شاغل */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const periodId = parseIntOr(body.periodId, 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const period = await db.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) return NextResponse.json({ error: 'دوره یافت نشد' }, { status: 404 });
    await ensureFySettings(period.fiscalYearId);
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const result = await calculatePeriod(periodId);
    await logAudit({
      user: me, action: 'محاسبه حقوق', entity: 'payroll_period', entityId: periodId,
      details: `تعداد ${result.count} نفر — خالص: ${result.totalNet}`,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
