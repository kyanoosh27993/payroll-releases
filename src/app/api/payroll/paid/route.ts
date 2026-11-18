import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** ثبت پرداخت گروهی (یا لغو) برای فهرست پرسنل */
export async function PUT(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin')) {
      return NextResponse.json({ error: 'ثبت پرداخت فقط با نقش مدیر مجاز است' }, { status: 403 });
    }
    const body = await req.json();
    const periodId = parseIntOr(body.periodId, 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const ids: number[] = Array.isArray(body.ids)
      ? body.ids.map((x: unknown) => parseIntOr(x, 0)).filter(Boolean)
      : [];
    if (!ids.length) return NextResponse.json({ error: 'فهرست پرسنل خالی است' }, { status: 400 });
    const payPaid = body.payPaid === undefined ? true : !!body.payPaid;
    const res = await db.payrollSummary.updateMany({
      where: { periodId, personnelId: { in: ids } },
      data: { payPaid },
    });
    // مانده‌های اولیه اثرگذار با ثبت پرداخت، مصرف‌شده علامت می‌خورند
    if (payPaid) {
      const period = await db.payrollPeriod.findUnique({ where: { id: periodId } });
      if (period) {
        const usedPeriod = `${period.jy}-${String(period.jm).padStart(2, '0')}`;
        await db.openingBalance.updateMany({
          where: { personnelId: { in: ids }, effect: { not: 'none' }, consumed: false },
          data: { consumed: true, usedPeriod },
        });
      }
    }
    await logAudit({
      user: me, action: payPaid ? 'ثبت پرداخت' : 'لغو پرداخت', entity: 'payroll_period', entityId: periodId,
      details: `${res.count} نفر — شناسه‌ها: ${ids.join('، ')}`,
    });
    return NextResponse.json({ updated: res.count });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
