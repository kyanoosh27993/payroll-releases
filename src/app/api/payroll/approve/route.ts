import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

/** تایید/لغو تایید پرداخت یک فرد در دوره */
export async function PUT(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const periodId = parseIntOr(body.periodId, 0);
    const personnelId = parseIntOr(body.personnelId, 0);
    if (!periodId || !personnelId) {
      return NextResponse.json({ error: 'periodId و personnelId الزامی است' }, { status: 400 });
    }
    const summary = await db.payrollSummary.findUnique({
      where: { periodId_personnelId: { periodId, personnelId } },
    });
    if (!summary) return NextResponse.json({ error: 'ردیف خلاصه یافت نشد — ابتدا دوره را محاسبه کنید' }, { status: 404 });
    const payApproved = body.payApproved === undefined ? !summary.payApproved : !!body.payApproved;
    const updated = await db.payrollSummary.update({
      where: { periodId_personnelId: { periodId, personnelId } },
      data: { payApproved },
    });
    return NextResponse.json({ summary: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
