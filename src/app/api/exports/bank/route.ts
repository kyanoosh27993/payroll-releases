import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData, companyWithLogo } from '@/lib/core/payroll-views';
import { exportTableXlsx, bankListRows } from '@/lib/core/excel';
import { xlsxResponse } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

/** اکسل لیست بانک (approved فقط به‌صورت پیش‌فرض) */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const periodId = parseIntOr(sp.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const onlyApproved = sp.get('all') !== '1';
    const data = await loadPeriodData(periodId);
    const bankRows = data.summaries.map((s) => ({
      firstName: s.personnel.firstName, lastName: s.personnel.lastName,
      nationalId: s.personnel.nationalId, bankAccount: s.personnel.bankAccount,
      bankName: s.personnel.bankName, prevBalance: s.prevBalance,
      netPay: s.netPay, payPaid: s.payPaid, payApproved: s.payApproved,
    }));
    const headers = ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'شماره حساب', 'بانک',
      'مانده قبلی', 'خالص قابل پرداخت', 'جمع قابل پرداخت', 'وضعیت'];
    const buf = await exportTableXlsx({
      title: 'لیست پرداخت بانک',
      subtitle: data.period.jy + '/' + String(data.period.jm).padStart(2, '0'),
      headers,
      rows: bankListRows(bankRows, onlyApproved),
      moneyCols: new Set([5, 6, 7]),
      sumCols: true,
      company: companyWithLogo(data.company),
    });
    return xlsxResponse(buf, `bank-${data.period.jy}${String(data.period.jm).padStart(2, '0')}.xlsx`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
