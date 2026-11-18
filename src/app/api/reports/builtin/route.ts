// API گزارش‌ساز — GET /api/reports/builtin?type=...&periodId=..&jy=..&jm=..&personnelId=..
import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { runBuiltinReport } from '@/lib/core/reports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = String(sp.get('type') ?? '');
    const companyId = parseIntOr(sp.get('companyId'), 1);
    const result = await runBuiltinReport(type, {
      companyId,
      periodId: parseIntOr(sp.get('periodId'), 0) || undefined,
      jy: parseIntOr(sp.get('jy'), 0) || undefined,
      jm: parseIntOr(sp.get('jm'), 0) || undefined,
      personnelId: parseIntOr(sp.get('personnelId'), 0) || null,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
