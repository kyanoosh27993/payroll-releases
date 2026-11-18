import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { decreeData } from '@/lib/core/personnel-input';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { ensureContractVersion } from '@/lib/core/contract-versioning';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const decrees = await db.decree.findMany({
      where: { personnelId: pid },
      orderBy: { effectiveDate: 'desc' },
    });
    return NextResponse.json({ decrees });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const personnel = await db.personnel.findUnique({ where: { id: pid } });
    if (!personnel) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    const body = await req.json();
    const data = decreeData(body);
    if (!data.effectiveDate) return NextResponse.json({ error: 'تاریخ اجرا الزامی است' }, { status: 400 });
    const decree = await db.decree.create({ data: { personnelId: pid, ...data } });
    // گزاره ۸ — حکم جدید → قرارداد جدید از آن ماه (نسخه قبلی سابقه می‌ماند)
    try { await ensureContractVersion(pid, decree.effectiveDate); } catch { /* مانع ثبت حکم نشود */ }
    return NextResponse.json({ decree }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
