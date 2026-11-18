import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { minutesToHHMM } from '@/lib/core/numbers';
import { loadPeriodData, companyWithLogo } from '@/lib/core/payroll-views';
import { exportTableXlsx } from '@/lib/core/excel';
import { xlsxResponse } from '@/lib/core/export-http';
import { toPersianDigits } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

/** اکسل لیست حقوق ماه — همان ستون‌های جدول خلاصه + جمع کل */
export async function GET(req: NextRequest) {
  try {
    const periodId = parseIntOr(req.nextUrl.searchParams.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const data = await loadPeriodData(periodId);
    const headers = ['ردیف', 'کد پرسنلی', 'نام و نام خانوادگی', 'کارکرد (روز)', 'اضافه‌کار',
      'جمع درآمد', 'مشمول بیمه', 'بیمه ۷٪', 'مشمول مالیات', 'مالیات', 'کسورات',
      'مانده قبلی', 'خالص قابل پرداخت', 'وضعیت پرداخت'];
    const money = new Set([5, 6, 7, 8, 9, 10, 11, 12]);
    const rows = data.summaries.map((s, i) => [
      toPersianDigits(String(i + 1)),
      toPersianDigits(s.personnel.personnelCode),
      `${s.personnel.firstName} ${s.personnel.lastName}`.trim(),
      toPersianDigits(String(s.workedDays)),
      minutesToHHMM(s.overtimeMin),
      s.gross, s.insuredBase, s.workerIns, s.taxBase, s.tax,
      s.totalDeductions, s.prevBalance, s.netPay + s.prevBalance,
      s.payPaid ? 'پرداخت شده' : 'در انتظار پرداخت',
    ]);
    const buf = await exportTableXlsx({
      title: 'لیست حقوق و دستمزد ماه',
      subtitle: data.period.jy + '/' + String(data.period.jm).padStart(2, '0'),
      headers, rows, moneyCols: money, sumCols: true,
      company: companyWithLogo(data.company),
    });
    return xlsxResponse(buf, `payroll-${data.period.jy}${String(data.period.jm).padStart(2, '0')}.xlsx`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
