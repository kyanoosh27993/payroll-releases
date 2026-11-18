import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr, toPersianDigits } from '@/lib/core/numbers';
import { loadPeriodData, companyWithLogo } from '@/lib/core/payroll-views';
import { exportTableXlsx } from '@/lib/core/excel';
import { xlsxResponse } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

/** اکسل لیست بیمه تامین اجتماعی: شماره بیمه، نام، روز بیمه، مشمول، سهم ۷٪/۲۳٪/۳٪، جمع */
export async function GET(req: NextRequest) {
  try {
    const periodId = parseIntOr(req.nextUrl.searchParams.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const data = await loadPeriodData(periodId);
    const headers = ['ردیف', 'شماره بیمه', 'نام و نام خانوادگی', 'روز بیمه',
      'دستمزد و مزایای مشمول', 'سهم کارگر (۷٪)', 'سهم کارفرما (۲۳٪)', 'بیکاری (۳٪)', 'جمع حق بیمه'];
    const money = new Set([4, 5, 6, 7, 8]);
    const rows = data.summaries.map((s, i) => {
      const total = s.workerIns + s.employerIns + s.unemploymentIns;
      return [
        toPersianDigits(String(i + 1)),
        toPersianDigits(s.personnel.ssoNumber || ''),
        `${s.personnel.firstName} ${s.personnel.lastName}`.trim(),
        toPersianDigits(String(Math.round(s.workedDays))),
        s.insuredBase, s.workerIns, s.employerIns, s.unemploymentIns, total,
      ];
    });
    const buf = await exportTableXlsx({
      title: 'لیست ماهانه بیمه تامین اجتماعی',
      subtitle: data.period.jy + '/' + String(data.period.jm).padStart(2, '0'),
      headers, rows, moneyCols: money, sumCols: true,
      company: companyWithLogo(data.company),
    });
    return xlsxResponse(buf, `insurance-${data.period.jy}${String(data.period.jm).padStart(2, '0')}.xlsx`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
