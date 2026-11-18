import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr, toPersianDigits } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = parseIntOr(sp.get('companyId'), 0);
    const jy = parseIntOr(sp.get('jy'), 0);
    const jm = parseIntOr(sp.get('jm'), 0);
    if (!companyId) return NextResponse.json({ error: 'companyId الزامی است' }, { status: 400 });
    const assignments = await db.shiftAssignment.findMany({
      where: {
        jy, jm,
        personnel: { companyId },
      },
      orderBy: { id: 'asc' },
    });
    return NextResponse.json({ assignments });
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
    const personnelId = parseIntOr(body.personnelId, 0);
    const jy = parseIntOr(body.jy, 0);
    const jm = parseIntOr(body.jm, 0);
    const shiftId = parseIntOr(body.shiftId, 0);
    if (!personnelId || !jy || !jm || !shiftId) {
      return NextResponse.json({ error: 'پرسنل، ماه و شیفت همگی الزامی هستند' }, { status: 400 });
    }
    const [personnel, shift] = await Promise.all([
      db.personnel.findUnique({ where: { id: personnelId } }),
      db.shift.findUnique({ where: { id: shiftId } }),
    ]);
    if (!personnel) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    if (!shift) return NextResponse.json({ error: 'شیفت یافت نشد' }, { status: 404 });
    const assignment = await db.shiftAssignment.upsert({
      where: { personnelId_jy_jm: { personnelId, jy, jm } },
      create: { personnelId, jy, jm, shiftId },
      update: { shiftId },
    });
    return NextResponse.json({ assignment });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const id = parseIntOr(req.nextUrl.searchParams.get('id'), 0);
    if (!id) return NextResponse.json({ error: 'شناسه انتساب الزامی است' }, { status: 400 });
    const existing = await db.shiftAssignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'انتساب یافت نشد' }, { status: 404 });
    await db.shiftAssignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: toPersianDigits(String(e)) }, { status: 500 });
  }
}
