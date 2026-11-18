// API گزارش‌ساز — GET /api/reports/builtin-xlsx?type=... → دانلود اکسل با سربرگ شرکت
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { runBuiltinReport } from '@/lib/core/reports';
import { exportTableXlsx } from '@/lib/core/excel';
import { readCompanyLogo } from '@/lib/core/payroll-views';
import { xlsxResponse } from '@/lib/core/export-http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = String(sp.get('type') ?? '');
    const companyId = parseIntOr(sp.get('companyId'), 1);
    const result = await runBuiltinReport(type, {
      companyId,
      periodId: parseIntOr(sp.get('periodId'), 0) || undefined,
      jy: parseIntOr(sp.get('jy'), 0) || undefined,
      jm: parseIntOr(sp.get('jm'), 0) || undefined,
      personnelId: parseIntOr(sp.get('personnelId'), 0) || null,
    });
    const company = await db.company.findUnique({ where: { id: companyId } });
    const buf = await exportTableXlsx({
      title: result.title,
      subtitle: result.subtitle,
      headers: result.headers,
      rows: result.rows,
      moneyCols: result.moneyCols,
      sumCols: true,
      company: company ? {
        name: company.name, nationalId: company.nationalId, economicCode: company.economicCode,
        ssoWorkshopCode: company.ssoWorkshopCode, phone: company.phone, address: company.address,
        logoPath: company.logoPath, logoData: readCompanyLogo(company.logoPath),
      } : null,
    });
    return xlsxResponse(buf, `report-${type}.xlsx`);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
