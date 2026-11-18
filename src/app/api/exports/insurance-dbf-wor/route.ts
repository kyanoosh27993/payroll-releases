import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData } from '@/lib/core/payroll-views';
import { makeInsuranceBuffers, InsRow } from '@/lib/core/standard-exports';
import { fileResponse, daysInJMonth } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

/** فایل بیمه DSKWOR00.dbf — اطلاعات ماهیانه بیمه‌شدگان (ریزکارکرد) */
export async function GET(req: NextRequest) {
  try {
    const periodId = parseIntOr(req.nextUrl.searchParams.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const data = await loadPeriodData(periodId);
    const rows: InsRow[] = data.summaries.map((s) => ({
      ssoNumber: s.personnel.ssoNumber, nationalId: s.personnel.nationalId,
      firstName: s.personnel.firstName, lastName: s.personnel.lastName,
      workedDays: Math.round(s.workedDays) || daysInJMonth(data.period.jy, data.period.jm),
      insuredBase: s.insuredBase, workerIns: s.workerIns,
      employerIns: s.employerIns, unemploymentIns: s.unemploymentIns,
    }));
    const calDays = daysInJMonth(data.period.jy, data.period.jm);
    const [_kar, wor] = makeInsuranceBuffers(data.company, rows, data.period.jy, data.period.jm, calDays);
    return fileResponse(wor.content, wor.name, 'application/octet-stream');
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
