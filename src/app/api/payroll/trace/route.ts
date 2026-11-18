// ردپای محاسبه حقوق — قابلیت ۱٫۴٫۵
// GET /api/payroll/trace?periodId=&personnelId=
// بازمحاسبه بدون نوشتن و برگرداندن مراحل گام‌به‌گام هر قلم + خلاصه‌های فیش
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';
import { computeTraceForPerson } from '@/lib/core/payroll-trace';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const periodId = parseIntOr(sp.get('periodId'), 0);
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    if (!periodId || !personnelId) {
      return NextResponse.json({ error: 'periodId و personnelId الزامی است' }, { status: 400 });
    }
    const result = await computeTraceForPerson(periodId, personnelId);
    if (!result) return NextResponse.json({ error: 'دوره یا پرسنل یافت نشد' }, { status: 404 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
