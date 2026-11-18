import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { availableFormulas } from '@/lib/core/payroll-engine';
import { cleanText, parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await db.payrollItemConfig.findMany({ orderBy: { sort: 'asc' } });
    const availableFormulasList = availableFormulas().map(([key, title]) => ({ key, title }));
    return NextResponse.json({ items, availableFormulas: availableFormulasList });
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
    const code = cleanText(body.code);
    if (!code) return NextResponse.json({ error: 'کد قلم الزامی است' }, { status: 400 });
    const item = await db.payrollItemConfig.findUnique({ where: { code } });
    if (!item) return NextResponse.json({ error: 'قلم یافت نشد' }, { status: 404 });
    const taxModes = ['none', 'm84', 'lump', 'percent'];
    const updated = await db.payrollItemConfig.update({
      where: { code },
      data: {
        title: cleanText(body.title) || item.title,
        formulaKey: cleanText(body.formulaKey) || item.formulaKey,
        taxMode: taxModes.includes(String(body.taxMode)) ? String(body.taxMode) : item.taxMode,
        taxPercent: body.taxPercent !== undefined ? Number(body.taxPercent) || 0 : item.taxPercent,
        insured: body.insured === undefined ? item.insured : Boolean(body.insured),
        active: body.active === undefined ? item.active : Boolean(body.active),
        sort: body.sort !== undefined ? parseIntOr(body.sort, item.sort) : item.sort,
      },
    });
    return NextResponse.json({ item: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
