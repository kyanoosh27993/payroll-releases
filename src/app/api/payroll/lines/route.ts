import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData } from '@/lib/core/payroll-views';

export const dynamic = 'force-dynamic';

/** ریز اقلام فیش یک پرسنل در دوره (با عنوان اقلام از تنظیمات) */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const periodId = parseIntOr(sp.get('periodId'), 0);
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    if (!periodId || !personnelId) {
      return NextResponse.json({ error: 'periodId و personnelId الزامی است' }, { status: 400 });
    }
    const data = await loadPeriodData(periodId);
    const summary = data.summaries.find((s) => s.personnelId === personnelId) ?? null;
    const lines = data.lines
      .filter((l) => l.personnelId === personnelId)
      .map((l) => ({
        itemCode: l.itemCode,
        title: data.itemMap[l.itemCode]?.title ?? l.itemCode,
        kind: data.itemMap[l.itemCode]?.kind ?? 'earning',
        amount: l.amount,
      }));
    return NextResponse.json({
      period: data.period,
      summary,
      lines,
      itemMap: data.itemMap,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
