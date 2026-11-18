// مراکز هزینه شرکت فعال — GET/POST /api/cost-centers
// GET: ترکیب لیست رسمی مراکز هزینه ذخیره‌شده در تنظیمات سال مالی (FySetting key=cost_centers)
//      + مقادیر یکتای ثبت‌شده روی پرسنل همان شرکت (مرکز هزینه جدید در هر ماژول، خودکار اینجا ظاهر می‌شود)
// POST: ذخیره لیست رسمی بخش‌های کاری هتل (مراکز هزینه) در تنظیمات سال مالی فعال
//       — همین لیست در فرم پرسنل به‌عنوان «بخش هتل (مرکز هزینه سازمانی)» نمایش داده می‌شود
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { userFromHeaders, hasRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST — ذخیره لیست بخش‌های کاری هتل (مراکز هزینه) برای سال مالی فعال { companyId, fyId, costCenters: string[] } */
export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = (await req.json()) as { companyId?: number; fyId?: number; costCenters?: string[] };
    const fyId = parseIntOr(body.fyId, 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const list = Array.from(
      new Set((body.costCenters ?? []).map((c) => String(c).trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'fa'));
    await db.fySetting.upsert({
      where: { fiscalYearId_key: { fiscalYearId: fyId, key: 'cost_centers' } },
      update: { value: JSON.stringify(list) },
      create: { fiscalYearId: fyId, key: 'cost_centers', value: JSON.stringify(list) },
    });
    return NextResponse.json({ costCenters: list, saved: list.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const companyId = parseIntOr(req.nextUrl.searchParams.get('companyId'), 0);
    if (!companyId) return NextResponse.json({ error: 'companyId الزامی است' }, { status: 400 });
    const fys = await db.fiscalYear.findMany({ where: { companyId }, select: { id: true } });
    const fyIds = fys.map((f) => f.id);
    let official: string[] = [];
    if (fyIds.length) {
      const settings = await db.fySetting.findMany({ where: { key: 'cost_centers', fiscalYearId: { in: fyIds } } });
      for (const s of settings) {
        try {
          const v = JSON.parse(s.value);
          if (Array.isArray(v)) official.push(...v.map((x) => String(x)));
        } catch { /* ignore */ }
      }
    }
    const rows = await db.personnel.findMany({
      where: { companyId, costCenter: { not: '' } },
      select: { costCenter: true },
      distinct: ['costCenter'],
      orderBy: { costCenter: 'asc' },
    });
    const set = new Set<string>();
    for (const o of official) { const t = o.trim(); if (t) set.add(t); }
    for (const r of rows) { const t = r.costCenter.trim(); if (t) set.add(t); }
    return NextResponse.json({ costCenters: Array.from(set).sort((a, b) => a.localeCompare(b, 'fa')) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
