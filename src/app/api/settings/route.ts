import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { getFySettings, FY_DEFAULTS } from '@/lib/core/payroll-calc';
import { parseIntOr, normalizeDigits } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const fy = await db.fiscalYear.findUnique({ where: { id: fyId } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد' }, { status: 404 });
    const settings = await getFySettings(fyId);
    return NextResponse.json({ settings, defaults: FY_DEFAULTS, fy });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const fyId = parseIntOr(body.fyId, 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const fy = await db.fiscalYear.findUnique({ where: { id: fyId } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد' }, { status: 404 });
    const settings = body.settings;
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'settings نامعتبر است' }, { status: 400 });
    }
    // فقط کلیدهای مجاز (کلیدهای پیش‌فرض) پذیرفته می‌شوند
    const entries = Object.entries(settings as Record<string, unknown>).filter(
      ([k]) => k in FY_DEFAULTS,
    );
    for (const [key, value] of entries) {
      await db.fySetting.upsert({
        where: { fiscalYearId_key: { fiscalYearId: fyId, key } },
        create: { fiscalYearId: fyId, key, value: normalizeDigits(String(value ?? '')) },
        update: { value: normalizeDigits(String(value ?? '')) },
      });
    }
    const saved = await getFySettings(fyId);
    return NextResponse.json({ settings: saved });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
