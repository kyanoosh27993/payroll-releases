import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData, monthStamp } from '@/lib/core/payroll-views';
import { taxWhRecords, makeTaxFileContents, WhRow } from '@/lib/core/standard-exports';
import { fileResponse } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

/** فایل فهرست حقوق مالیات — WHYYYYMM.TXT (۳۹ فیلد ریالی، UTF-8، CRLF) */
export async function GET(req: NextRequest) {
  try {
    const periodId = parseIntOr(req.nextUrl.searchParams.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const data = await loadPeriodData(periodId);
    const whRows: WhRow[] = data.summaries.map((s) => ({
      personnelId: s.personnelId,
      nationalId: s.personnel.nationalId,
      netPay: s.netPay,
      prevBalance: s.prevBalance,
      items: data.lines
        .filter((l) => l.personnelId === s.personnelId && data.itemMap[l.itemCode]?.kind === 'earning')
        .map((l) => ({ itemCode: l.itemCode, amount: l.amount })),
    }));
    const [, wh] = makeTaxFileContents(data.period.jy, data.period.jm, [], taxWhRecords(whRows));
    return fileResponse(wh.content, wh.name, 'text/plain; charset=utf-8');
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
