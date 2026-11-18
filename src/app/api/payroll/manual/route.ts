import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr, normalizeDigits, parseNumberOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

const MANUAL_CODES = ['tax_free_other', 'other_deduct'];

/** ورود دستی اقلام فیش (سایر مزایا بدون بیمه/مالیات، سایر کسورات) */
export async function PUT(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const periodId = parseIntOr(body.periodId, 0);
    const personnelId = parseIntOr(body.personnelId, 0);
    const itemCode = normalizeDigits(String(body.itemCode || '')).trim();
    if (!periodId || !personnelId || !itemCode) {
      return NextResponse.json({ error: 'periodId، personnelId و itemCode الزامی است' }, { status: 400 });
    }
    if (!MANUAL_CODES.includes(itemCode)) {
      return NextResponse.json({ error: 'این قلم قابل ورود دستی نیست' }, { status: 400 });
    }
    const amount = Math.max(0, Math.round(parseNumberOr(body.amount, 0)));
    // دوره قفل‌شده/نهایی قابل تغییر نیست
    const period = await db.payrollPeriod.findUnique({ where: { id: periodId }, select: { status: true } });
    if (!period) return NextResponse.json({ error: 'دوره یافت نشد' }, { status: 404 });
    if (['نهایی', 'پرداخت‌شده', 'قفل‌شده'].includes(period.status)) {
      return NextResponse.json({ error: 'این دوره قفل/نهایی است — ورود دستی اقلام مجاز نیست' }, { status: 400 });
    }
    const manual = await db.payrollManual.upsert({
      where: { periodId_personnelId_itemCode: { periodId, personnelId, itemCode } },
      create: { periodId, personnelId, itemCode, amount },
      update: { amount },
    });
    return NextResponse.json({ manual });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
