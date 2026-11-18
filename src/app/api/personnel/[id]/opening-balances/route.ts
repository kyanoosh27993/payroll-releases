// مانده‌های اولیه (از قبل) پرسنل — GET/POST/PUT/DELETE
// kinds: seniority_days سابقه از قبل / seniority_amount سنوات انباشته / leave_balance مانده مرخصی /
// current_balance بدهی-بستانکاری جاری / eid_unpaid عیدی پرداخت‌نشده / tax_debt بدهی مالیات / other سایر
// effects: earning_ins / earning_free / deduction / none
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr, cleanText } from '@/lib/core/numbers';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const KINDS = ['seniority_days', 'seniority_amount', 'leave_balance', 'current_balance', 'eid_unpaid', 'tax_debt', 'other'];
const EFFECTS = ['earning_ins', 'earning_free', 'deduction', 'none'];
const UNITS = ['amount', 'days'];

function rowOf(body: Record<string, unknown>) {
  const kind = cleanText(String(body.kind ?? 'other')) || 'other';
  const effect = String(body.effect ?? 'none');
  let unit = String(body.unit ?? 'amount');
  if (!UNITS.includes(unit)) unit = 'amount';
  const amount = Number(body.amount ?? 0);
  return {
    title: cleanText(String(body.title ?? '')),
    kind: KINDS.includes(kind) ? kind : 'other',
    unit,
    amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
    effect: EFFECTS.includes(effect) ? effect : 'none',
    notes: cleanText(String(body.notes ?? '')),
  };
}

type Ctx = { params: Promise<{ id: string }> };

/** GET: فهرست مانده‌های اولیه یک پرسنل */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const personnel = await db.personnel.findUnique({ where: { id: pid }, select: { id: true, firstName: true, lastName: true } });
    if (!personnel) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    const rows = await db.openingBalance.findMany({
      where: { personnelId: pid },
      orderBy: [{ kind: 'asc' }, { id: 'asc' }],
    });
    return NextResponse.json({ personnel, rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** POST: افزودن مانده جدید */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'ثبت مانده اولیه فقط با نقش مدیر یا اپراتور مجاز است' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const personnel = await db.personnel.findUnique({ where: { id: pid } });
    if (!personnel) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    const body = await req.json();
    const data = rowOf(body);
    const row = await db.openingBalance.create({ data: { ...data, personnelId: pid } });
    await logAudit({
      user: me, action: 'ثبت مانده اولیه', entity: 'opening_balance', entityId: row.id,
      details: `${personnel.firstName} ${personnel.lastName} — ${data.title || data.kind}: ${data.amount}`,
      after: data,
    });
    return NextResponse.json({ row });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** PUT: ویرایش مانده */
export async function PUT(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'ویرایش مانده فقط با نقش مدیر یا اپراتور مجاز است' }, { status: 403 });
    }
    const body = await req.json();
    const rowId = parseIntOr(body.id, 0);
    if (!rowId) return NextResponse.json({ error: 'id الزامی است' }, { status: 400 });
    const existing = await db.openingBalance.findUnique({ where: { id: rowId }, include: { personnel: true } });
    if (!existing) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 });
    const data = rowOf(body);
    const row = await db.openingBalance.update({ where: { id: rowId }, data });
    await logAudit({
      user: me, action: 'ویرایش مانده اولیه', entity: 'opening_balance', entityId: rowId,
      details: `${existing.personnel.firstName} ${existing.personnel.lastName} — ${data.title || data.kind}`,
      before: { title: existing.title, amount: existing.amount, effect: existing.effect, unit: existing.unit },
      after: data,
    });
    return NextResponse.json({ row });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** DELETE: حذف مانده */
export async function DELETE(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'حذف مانده فقط با نقش مدیر یا اپراتور مجاز است' }, { status: 403 });
    }
    const rowId = parseIntOr(req.nextUrl.searchParams.get('id') ?? '', 0);
    if (!rowId) return NextResponse.json({ error: 'id الزامی است' }, { status: 400 });
    const existing = await db.openingBalance.findUnique({ where: { id: rowId }, include: { personnel: true } });
    if (!existing) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 });
    await db.openingBalance.delete({ where: { id: rowId } });
    await logAudit({
      user: me, action: 'حذف مانده اولیه', entity: 'opening_balance', entityId: rowId,
      details: `${existing.personnel.firstName} ${existing.personnel.lastName} — ${existing.title || existing.kind}: ${existing.amount}`,
      before: { title: existing.title, amount: existing.amount, effect: existing.effect, unit: existing.unit },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
