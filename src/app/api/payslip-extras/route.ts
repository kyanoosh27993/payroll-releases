// اقلام تکمیلی فیش حقوقی — گزاره ۵ نسخه ۱٫۲٫۰
// GET  /api/payslip-extras?periodId=&personnelId=  → ردیف‌های محاسبه‌شده
// POST { fyId, options } → ذخیره انتخاب‌های نمایش (به‌ازای سال مالی)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';
import { computePayslipExtras, getPayslipOptions, savePayslipOptions, PAYSLIP_OPTION_DEFS } from '@/lib/core/payslip-extras';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const fyIdOnly = parseIntOr(sp.get('fyId'), 0);
    if (fyIdOnly) {
      // تنظیمات ذخیره‌شده سال مالی + تعریف اقلام (برای دیالوگ تنظیمات)
      const options = await getPayslipOptions(fyIdOnly);
      return NextResponse.json({ defs: PAYSLIP_OPTION_DEFS, options });
    }
    const periodId = parseIntOr(sp.get('periodId'), 0);
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    if (!periodId || !personnelId) return NextResponse.json({ error: 'periodId و personnelId الزامی است' }, { status: 400 });
    const rows = await computePayslipExtras(periodId, personnelId);
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const fyId = parseIntOr(body.fyId, 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const options = (body.options ?? {}) as Record<string, boolean>;
    await savePayslipOptions(fyId, options);
    return NextResponse.json({ ok: true, options: await getPayslipOptions(fyId), defs: PAYSLIP_OPTION_DEFS });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
