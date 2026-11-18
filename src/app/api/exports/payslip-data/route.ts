import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData, periodTitle } from '@/lib/core/payroll-views';

export const dynamic = 'force-dynamic';

/** داده فیش حقوقی به‌صورت JSON — برای تست API و مصرف سایر ابزارها */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const periodId = parseIntOr(sp.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    const data = await loadPeriodData(periodId);
    const selected = personnelId
      ? data.summaries.filter((s) => s.personnelId === personnelId)
      : data.summaries;
    const slips = selected.map((s) => ({
      periodTitle: periodTitle(data.period),
      person: {
        id: s.personnelId,
        fullName: `${s.personnel.firstName} ${s.personnel.lastName}`.trim(),
        personnelCode: s.personnel.personnelCode,
        nationalId: s.personnel.nationalId,
        ssoNumber: s.personnel.ssoNumber,
        jobTitle: s.personnel.jobTitle,
        costCenter: s.personnel.costCenter,
      },
      items: data.lines
        .filter((l) => l.personnelId === s.personnelId)
        .map((l) => ({
          itemCode: l.itemCode,
          title: data.itemMap[l.itemCode]?.title ?? l.itemCode,
          kind: data.itemMap[l.itemCode]?.kind ?? 'earning',
          amount: l.amount,
        })),
      summary: {
        workedDays: s.workedDays, leaveDays: s.leaveDays, leaveBalance: s.leaveBalance,
        gross: s.gross, insuredBase: s.insuredBase, workerIns: s.workerIns,
        employerIns: s.employerIns, unemploymentIns: s.unemploymentIns,
        taxBase: s.taxBase, totalDeductions: s.totalDeductions, tax: s.tax,
        netPay: s.netPay, prevBalance: s.prevBalance,
      },
    }));
    return NextResponse.json({
      period: { ...data.period, title: periodTitle(data.period) },
      company: { name: data.company.name },
      slips,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
