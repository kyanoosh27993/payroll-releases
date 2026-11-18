import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { contractData } from '@/lib/core/personnel-input';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const cid = parseIntOr(id, 0);
    const existing = await db.contract.findUnique({ where: { id: cid } });
    if (!existing) return NextResponse.json({ error: 'قرارداد یافت نشد' }, { status: 404 });
    const body = await req.json();
    const contract = await db.contract.update({ where: { id: cid }, data: contractData(body) });
    await logAudit({
      user: me, action: 'ویرایش قرارداد', entity: 'contract', entityId: cid,
      details: `قرارداد ${cid} — نوع: ${contract.contractType}`,
      before: { contractType: existing.contractType, hourlyRate: existing.hourlyRate, dailyRate: existing.dailyRate, monthlyWage: existing.monthlyWage, },
      after: { contractType: contract.contractType, hourlyRate: contract.hourlyRate, dailyRate: contract.dailyRate, monthlyWage: contract.monthlyWage, },
    });
    return NextResponse.json({ contract });
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
    const cid = parseIntOr(id, 0);
    const existing = await db.contract.findUnique({ where: { id: cid } });
    if (!existing) return NextResponse.json({ error: 'قرارداد یافت نشد' }, { status: 404 });
    await db.contract.delete({ where: { id: cid } });
    await logAudit({ user: me, action: 'حذف قرارداد', entity: 'contract', entityId: cid });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
