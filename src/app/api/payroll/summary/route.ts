import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData } from '@/lib/core/payroll-views';

export const dynamic = 'force-dynamic';

/** جدول خلاصه پرسنل یک دوره حقوق */
export async function GET(req: NextRequest) {
  try {
    const periodId = parseIntOr(req.nextUrl.searchParams.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const data = await loadPeriodData(periodId);
    const totals = data.summaries.reduce((acc, s) => ({
      gross: acc.gross + s.gross,
      insuredBase: acc.insuredBase + s.insuredBase,
      workerIns: acc.workerIns + s.workerIns,
      taxBase: acc.taxBase + s.taxBase,
      tax: acc.tax + s.tax,
      totalDeductions: acc.totalDeductions + s.totalDeductions,
      prevBalance: acc.prevBalance + s.prevBalance,
      netPay: acc.netPay + s.netPay,
    }), { gross: 0, insuredBase: 0, workerIns: 0, taxBase: 0, tax: 0, totalDeductions: 0, prevBalance: 0, netPay: 0 });
    return NextResponse.json({
      period: data.period,
      company: { name: data.company.name, logoPath: data.company.logoPath },
      rows: data.summaries,
      totals: { ...totals, count: data.summaries.length },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
