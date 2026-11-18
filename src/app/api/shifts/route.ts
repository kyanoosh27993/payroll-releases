import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr, cleanText, normalizeDigits } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

/** اعتبارسنجی schedule: {"0":[480,960],...} */
export function validSchedule(schedule: unknown): string {
  let obj: Record<string, unknown> = {};
  if (typeof schedule === 'string') {
    try { obj = JSON.parse(schedule || '{}'); } catch { return '{}'; }
  } else if (schedule && typeof schedule === 'object') {
    obj = schedule as Record<string, unknown>;
  }
  const out: Record<string, number[]> = {};
  for (let d = 0; d < 7; d++) {
    const v = obj[String(d)];
    if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && isFinite(x))) {
      out[String(d)] = [Math.max(0, Math.round(v[0])), Math.min(1439, Math.round(v[1]))];
    }
  }
  return JSON.stringify(out);
}

export async function GET(req: NextRequest) {
  try {
    const companyId = parseIntOr(req.nextUrl.searchParams.get('companyId'), 0);
    if (!companyId) return NextResponse.json({ error: 'companyId الزامی است' }, { status: 400 });
    const shifts = await db.shift.findMany({ where: { companyId }, orderBy: { id: 'asc' } });
    return NextResponse.json({ shifts });
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
    const companyId = parseIntOr(body.companyId, 0);
    if (!companyId) return NextResponse.json({ error: 'companyId الزامی است' }, { status: 400 });
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: 'نام شیفت الزامی است' }, { status: 400 });
    const premiumPct = Math.max(0, Math.min(100, parseFloat(normalizeDigits(String(body.premiumPct ?? 10))) || 0));
    const shift = await db.shift.create({
      data: {
        premiumPct, companyId,
        name,
        schedule: validSchedule(body.schedule),
        notes: normalizeDigits(body.notes ?? ''),
      },
    });
    return NextResponse.json({ shift }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
