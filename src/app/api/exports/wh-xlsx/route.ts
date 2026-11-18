import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr, toPersianDigits } from '@/lib/core/numbers';
import { loadPeriodData, companyWithLogo, monthStamp } from '@/lib/core/payroll-views';
import { exportTableXlsx } from '@/lib/core/excel';
import { taxWhRecords, WhRow, WH_ORDER } from '@/lib/core/standard-exports';
import { xlsxResponse } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

// هدرهای فارسی قالب WH سامانه مالیات حقوق (۳۹ ستون) — عینا از make_wh_excel نسخه دسکتاپ
const WH_EXCEL_HEADERS = [
  'کد ملی', 'نوع پرداخت', 'وضعیت محل خدمت', 'استثنائات قانون بودجه', 'نوع ارز',
  'نرخ تسعیر', 'جمع ناخالص مستمر نقدی', 'مستمر نقدی معوق', 'مسکن',
  'کسر مسکن', 'اتومبیل', 'کسر اتومبیل', 'سایر مستمر غیرنقدی', 'مستمر غیرنقدی معوق',
  'حق‌الزحمه/مشاوره', 'قراردادهای پژوهشی', 'اضافه‌کاری', 'هزینه سفر',
  'فوق‌العاده ماموریت', 'کارانه', 'پاداش', 'پاداش آخر سال', 'عیدی سالانه',
  'پاداش پایان خدمت', 'خسارت اخراج', 'بازخرید خدمت', 'حق سنوات',
  'مرخصی استفاده نشده', 'سایر غیرمستمر نقدی', 'غیرمستمر نقدی معوق',
  'غیرمستمر غیرنقدی', 'غیرمستمر غیرنقدی معوق', 'بیمه درمان ماده ۱۳۷',
  'بیمه عمر ماده ۱۳۷', 'خالص پرداختی', 'حق‌التدریس', 'حق‌کشیک',
  'رفاهی و بهره‌وری', 'حق‌السعی',
];

/** اکسل WH — قالب ۳۹ ستونی سامانه مالیات حقوق برای کنترل/ورود دستی */
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
    const recs = taxWhRecords(whRows);
    const rows = recs.map((r) => [
      toPersianDigits(String(r.f1_national_id ?? '')), 1, 1, 1, 84, 1,
      ...Array.from({ length: 33 }, (_, k) => Number(r[WH_ORDER[k + 6]] ?? 0)),
    ]);
    const buf = await exportTableXlsx({
      title: 'فایل فهرست حقوق WH (قالب سامانه مالیات حقوق)',
      subtitle: data.period.jy + '/' + String(data.period.jm).padStart(2, '0'),
      headers: WH_EXCEL_HEADERS,
      rows,
      moneyCols: new Set(Array.from({ length: 33 }, (_, k) => k + 6)),
      sumCols: true,
      company: companyWithLogo(data.company),
      landscape: true,
    });
    return xlsxResponse(buf, `WH${monthStamp(data.period)}.xlsx`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
