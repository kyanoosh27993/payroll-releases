import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr, cleanText, normalizeDigits } from '@/lib/core/numbers';
import { validSchedule } from '../route';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const sid = parseIntOr(id, 0);
    const existing = await db.shift.findUnique({ where: { id: sid } });
    if (!existing) return NextResponse.json({ error: 'شیفت یافت نشد' }, { status: 404 });
    const body = await req.json();
    const name = cleanText(body.name) || existing.name;
    const premiumPct = body.premiumPct === undefined
      ? existing.premiumPct
      : Math.max(0, Math.min(100, parseFloat(normalizeDigits(String(body.premiumPct))) || 0));
    const shift = await db.shift.update({
      where: { id: sid },
      data: { name, schedule: validSchedule(body.schedule), notes: normalizeDigits(body.notes ?? ''), premiumPct },
    });
    return NextResponse.json({ shift });
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
    const sid = parseIntOr(id, 0);
    const existing = await db.shift.findUnique({ where: { id: sid } });
    if (!existing) return NextResponse.json({ error: 'شیفت یافت نشد' }, { status: 404 });
    // پرسنل‌های با این شیفت → بدون شیفت
    await db.personnel.updateMany({ where: { shiftId: sid }, data: { shiftId: null } });
    await db.shiftAssignment.deleteMany({ where: { shiftId: sid } });
    await db.shift.delete({ where: { id: sid } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
