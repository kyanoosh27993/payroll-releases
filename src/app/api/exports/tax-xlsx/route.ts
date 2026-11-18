import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr, toPersianDigits } from '@/lib/core/numbers';
import { loadPeriodData, companyWithLogo } from '@/lib/core/payroll-views';
import { exportTableXlsx } from '@/lib/core/excel';
import { xlsxResponse } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

/** اکسل لیست مالیات حقوق: نام، کد ملی، درآمد، مشمول مالیات، مالیات */
export async function GET(req: NextRequest) {
  try {
    const periodId = parseIntOr(req.nextUrl.searchParams.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const data = await loadPeriodData(periodId);
    const headers = ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'جمع درآمد', 'مشمول مالیات', 'مالیات حقوق'];
    const money = new Set([3, 4, 5]);
    const rows = data.summaries.map((s, i) => [
      toPersianDigits(String(i + 1)),
      `${s.personnel.firstName} ${s.personnel.lastName}`.trim(),
      toPersianDigits(s.personnel.nationalId || ''),
      s.gross, s.taxBase, s.tax,
    ]);
    const buf = await exportTableXlsx({
      title: 'لیست مالیات حقوق ماه',
      subtitle: data.period.jy + '/' + String(data.period.jm).padStart(2, '0'),
      headers, rows, moneyCols: money, sumCols: true,
      company: companyWithLogo(data.company),
    });
    return xlsxResponse(buf, `tax-${data.period.jy}${String(data.period.jm).padStart(2, '0')}.xlsx`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
