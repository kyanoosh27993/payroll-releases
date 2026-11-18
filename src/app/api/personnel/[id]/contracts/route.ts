import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';
import { contractData } from '@/lib/core/personnel-input';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const contracts = await db.contract.findMany({
      where: { personnelId: pid },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ contracts });
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
    const data = contractData(body);
    const contract = await db.contract.create({ data: { personnelId: pid, ...data } });
    return NextResponse.json({ contract }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
