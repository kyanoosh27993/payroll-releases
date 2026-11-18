import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { decreeData } from '@/lib/core/personnel-input';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { ensureContractVersion } from '@/lib/core/contract-versioning';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const did = parseIntOr(id, 0);
    const existing = await db.decree.findUnique({ where: { id: did } });
    if (!existing) return NextResponse.json({ error: 'حکم یافت نشد' }, { status: 404 });
    const body = await req.json();
    const data = decreeData(body);
    if (!data.effectiveDate) return NextResponse.json({ error: 'تاریخ اجرا الزامی است' }, { status: 400 });
    const decree = await db.decree.update({ where: { id: did }, data });
    // گزاره ۸ — تغییر حکم → قرارداد جدید از آن ماه (نسخه قبلی سابقه می‌ماند)
    try { await ensureContractVersion(existing.personnelId, decree.effectiveDate); } catch { /* مانع ثبت حکم نشود */ }
    await logAudit({
      user: me, action: 'ویرایش حکم', entity: 'decree', entityId: did,
      details: `حکم ${did} — تاریخ اجرا: ${decree.effectiveDate}`,
      before: { effectiveDate: existing.effectiveDate, jobWage: existing.jobWage, seniorityWage: existing.seniorityWage, housing: existing.housing, food: existing.food },
      after: { effectiveDate: decree.effectiveDate, jobWage: decree.jobWage, seniorityWage: decree.seniorityWage, housing: decree.housing, food: decree.food },
    });
    return NextResponse.json({ decree });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const did = parseIntOr(id, 0);
    const existing = await db.decree.findUnique({ where: { id: did } });
    if (!existing) return NextResponse.json({ error: 'حکم یافت نشد' }, { status: 404 });
    await db.decree.delete({ where: { id: did } });
    await logAudit({ user: me, action: 'حذف حکم', entity: 'decree', entityId: did });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
