// تسویه‌حساب پرسنل — گزاره ۶ نسخه ۱٫۲٫۰
// GET /api/settlement?personnelId=&toDate=1405/08/30  → JSON محاسبات
// GET ...&format=html → فرم چاپی استاندارد A4 با امضا و اثر انگشت
// GET ...&format=docx → فایل ورد واقعی روی قالب سربرگ رسمی کاربر (نسخه ۱٫۴٫۵)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr, cleanText } from '@/lib/core/numbers';
import { computeSettlement, settlementHtml } from '@/lib/core/settlement';
import { readCompanyLogo } from '@/lib/core/payroll-views';
import { fillLetterheadDocx } from '@/lib/core/docx-template';
import { tasviyeWordBody } from '@/lib/core/word-outputs';

export const dynamic = 'force-dynamic';

const toFaCode = (v: string) => String(v ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    if (!personnelId) return NextResponse.json({ error: 'personnelId الزامی است' }, { status: 400 });
    const toDate = cleanText(sp.get('toDate') ?? '');
    const result = await computeSettlement(personnelId, toDate);
    // نسخه ۱٫۴٫۵ — فایل ورد تسویه‌حساب روی قالب سربرگ رسمی کاربر + عکس پرسنلی
    if (sp.get('format') === 'docx') {
      const personnel = await db.personnel.findUnique({ where: { id: personnelId } });
      const company = personnel ? await db.company.findUnique({ where: { id: personnel.companyId } }) : null;
      const buf = await fillLetterheadDocx(
        tasviyeWordBody({
          person: {
            fullName: result.personnel.fullName, personnelCode: result.personnel.personnelCode,
            nationalId: result.personnel.nationalId, jobTitle: result.personnel.jobTitle,
            department: result.personnel.department, hireDate: result.personnel.hireDate,
            endWorkDate: result.personnel.endWorkDate,
          },
          toDate: result.toDate, companyName: company?.name ?? '',
          serviceDays: result.serviceDays, serviceYears: result.serviceYears,
          decreeUsed: result.decreeUsed,
          lines: result.lines, totalDue: result.totalDue, totalDeduct: result.totalDeduct, net: result.net,
          bankName: personnel?.bankName, bankAccount: personnel?.bankAccount, bankSheba: personnel?.bankSheba,
        }),
        { num: toFaCode(result.personnel.personnelCode), num2: '01', date: result.toDate },
        personnel?.photo,
      );
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="settlement-${encodeURIComponent(result.personnel.personnelCode || String(personnelId))}.docx"`,
        },
      });
    }
    if (sp.get('format') === 'html') {
      // مورد ۱۳ نسخه ۱٫۴٫۳: شرکت مالکِ پرسنل (نه findFirst سراسری)
      const personnel = await db.personnel.findUnique({ where: { id: personnelId }, select: { companyId: true, photo: true, bankName: true, bankAccount: true, bankSheba: true, firstName: true, lastName: true } });
      const company = personnel ? await db.company.findUnique({ where: { id: personnel.companyId } }) : null;
      const logo = company ? readCompanyLogo(company.logoPath) : undefined;
      return new NextResponse(settlementHtml(result, company?.name ?? '', logo, personnel ? {
        photo: personnel.photo, bankName: personnel.bankName, bankAccount: personnel.bankAccount, bankSheba: personnel.bankSheba,
      } : undefined), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
