import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders , hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** ویرایش رکورد لاگ — فقط و فقط اکانت سوپروایزر */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const me = userFromHeaders(req);
  if (!me?.isSupervisor) {
    return NextResponse.json({ error: 'ویرایش لاگ فقط توسط اکانت سوپروایزر مجاز است' }, { status: 403 });
  }
  try {
    const id = Number((await ctx.params).id);
    const row = await db.auditLog.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 });
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.details !== undefined) data.details = String(body.details);
    if (body.action !== undefined) data.action = String(body.action);
    const updated = await db.auditLog.update({ where: { id }, data });
    // تغییرات سوپروایزر لاگ نمی‌شود (قاعده اصلی)
    return NextResponse.json({ log: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** حذف رکورد لاگ — فقط و فقط اکانت سوپروایزر */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const me = userFromHeaders(req);
  if (!me?.isSupervisor) {
    return NextResponse.json({ error: 'حذف لاگ فقط توسط اکانت سوپروایزر مجاز است' }, { status: 403 });
  }
  try {
    const id = Number((await ctx.params).id);
    const row = await db.auditLog.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 });
    await db.auditLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
