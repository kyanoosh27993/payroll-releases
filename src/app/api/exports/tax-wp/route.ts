import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData } from '@/lib/core/payroll-views';
import { taxWpRecords, makeTaxFileContents, PersonRow } from '@/lib/core/standard-exports';
import { fileResponse } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

/** فایل فهرست کارکنان مالیات — WPYYYYMM.TXT (۲۳ فیلد، UTF-8، CRLF) */
export async function GET(req: NextRequest) {
  try {
    const periodId = parseIntOr(req.nextUrl.searchParams.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const data = await loadPeriodData(periodId);
    const personRows: PersonRow[] = data.summaries.map((s) => ({
      nationalId: s.personnel.nationalId, firstName: s.personnel.firstName,
      lastName: s.personnel.lastName, fatherName: s.personnel.fatherName,
      birthDate: s.personnel.birthDate, idNumber: s.personnel.idNumber,
      birthPlace: s.personnel.birthPlace, idIssuePlace: s.personnel.idIssuePlace,
      education: s.personnel.education, insuranceType: s.personnel.insuranceType,
      ssoNumber: s.personnel.ssoNumber, ssoInsurer: s.personnel.ssoInsurer,
      taxExemptionCode: s.personnel.taxExemptionCode, postalCode: s.personnel.postalCode,
      address: s.personnel.address, jobCategory: s.personnel.jobCategory,
      jobTitle: s.personnel.jobTitle, employmentType: s.personnel.employmentType,
      hireDate: s.personnel.hireDate, endWorkDate: s.personnel.endWorkDate,
    }));
    // WH خالی — این مسیر فقط WP تولید می‌کند
    const [wp] = makeTaxFileContents(data.period.jy, data.period.jm, taxWpRecords(personRows), []);
    return fileResponse(wp.content, wp.name, 'text/plain; charset=utf-8');
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
