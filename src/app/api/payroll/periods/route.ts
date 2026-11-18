import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

/** فهرست دوره‌های حقوق یک سال مالی */
export async function GET(req: NextRequest) {
  try {
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const periods = await db.payrollPeriod.findMany({
      where: { fiscalYearId: fyId },
      orderBy: [{ jy: 'desc' }, { jm: 'desc' }],
    });
    return NextResponse.json({ periods });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** ایجاد دوره جدید (یا بازگشت دوره موجود) */
export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const fyId = parseIntOr(body.fyId, 0);
    const jy = parseIntOr(body.jy, 0);
    const jm = parseIntOr(body.jm, 0);
    if (!fyId || !jy || !jm) {
      return NextResponse.json({ error: 'fyId، jy و jm الزامی است' }, { status: 400 });
    }
    if (jm < 1 || jm > 12) return NextResponse.json({ error: 'ماه نامعتبر است' }, { status: 400 });
    const fy = await db.fiscalYear.findUnique({ where: { id: fyId } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد' }, { status: 404 });
    const period = await db.payrollPeriod.upsert({
      where: { fiscalYearId_jy_jm: { fiscalYearId: fyId, jy, jm } },
      create: { fiscalYearId: fyId, jy, jm },
      update: {},
    });
    return NextResponse.json({ period }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
