import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr, parseNumberOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

function parseToAmount(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  return parseNumberOr(v, 0);
}

export async function GET(req: NextRequest) {
  try {
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const brackets = await db.taxBracket.findMany({
      where: { fiscalYearId: fyId },
      orderBy: { seq: 'asc' },
    });
    return NextResponse.json({ brackets });
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
    const seq = parseIntOr(body.seq, 0);
    const ratePercent = parseNumberOr(body.ratePercent, -1);
    if (!seq) return NextResponse.json({ error: 'ردیف (seq) الزامی است' }, { status: 400 });
    if (ratePercent < 0) return NextResponse.json({ error: 'نرخ مالیات نامعتبر است' }, { status: 400 });
    const bracket = await db.taxBracket.create({
      data: {
        fiscalYearId: fyId,
        seq,
        fromAmount: parseNumberOr(body.fromAmount, 0),
        toAmount: parseToAmount(body.toAmount),
        ratePercent,
      },
    });
    return NextResponse.json({ bracket }, { status: 201 });
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
    const id = parseIntOr(body.id, 0);
    const existing = await db.taxBracket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'پله یافت نشد' }, { status: 404 });
    const ratePercent = parseNumberOr(body.ratePercent, existing.ratePercent);
    if (ratePercent < 0) return NextResponse.json({ error: 'نرخ مالیات نامعتبر است' }, { status: 400 });
    const bracket = await db.taxBracket.update({
      where: { id },
      data: {
        seq: parseIntOr(body.seq, existing.seq),
        fromAmount: parseNumberOr(body.fromAmount, existing.fromAmount),
        toAmount: body.toAmount !== undefined ? parseToAmount(body.toAmount) : existing.toAmount,
        ratePercent,
      },
    });
    return NextResponse.json({ bracket });
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
    const existing = await db.taxBracket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'پله یافت نشد' }, { status: 404 });
    await db.taxBracket.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
