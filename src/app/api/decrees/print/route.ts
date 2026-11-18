// چاپ حکم پرسنلی داخل سربرگ شرکت — مورد ۱۲ نسخه ۱٫۴٫۳
// GET /api/decrees/print?personnelId=&decreeId=&format=html|doc|docx
// نسخه ۱٫۴٫۵: format=docx → فایل ورد واقعی روی قالب سربرگ رسمی کاربر (letterhead.docx)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { formatMoney } from '@/lib/core/numbers';
import { escapeHtml as esc, isSafeImageDataUrl, isSafePublicPath } from '@/lib/core/sanitize';
import { fillLetterheadDocx } from '@/lib/core/docx-template';
import { hokmWordBody } from '@/lib/core/word-outputs';
import { todayJalali } from '@/lib/core/settlement';
import { gregorianToJalaliStr } from '@/lib/core/jalali';

export const dynamic = 'force-dynamic';

const toFa = (v: number | string) => String(v ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const dateLtr = (v: string | number | null | undefined) => `<b dir="ltr" style="unicode-bidi:embed">${toFa(String(v ?? ''))}</b>`;

const DECREE_ROWS: Array<[string, string]> = [
  ['مزد شغل (حقوق پایه)', 'jobWage'],
  ['مزد سنوات', 'seniorityWage'],
  ['حق مسکن', 'housing'],
  ['بن خواروبار (خواروبار)', 'food'],
  ['حق اولاد', 'childAllowance'],
  ['حق عائله‌مندی', 'familyAllowance'],
  ['تفاوت تطبیق', 'adjustmentDiff'],
  ['حق سرپرستی', 'supervision'],
  ['کمک‌هزینه تحصیلی', 'educationAid'],
  ['فوق‌العاده بازار کار', 'laborMarket'],
  ['حق جذب (مبلغ)', 'attractionAmount'],
  ['سایر مزایا', 'otherBenefits'],
  ['بن کارگری', 'workerBen'],
  ['اضافه‌کار ثابت', 'fixedOvertime'],
  ['حق شیفت', 'shiftAllowance'],
];

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const personnelId = Number(sp.get('personnelId') || 0);
    if (!personnelId) return NextResponse.json({ error: 'personnelId الزامی است' }, { status: 400 });
    const decreeId = Number(sp.get('decreeId') || 0);
    const format = sp.get('format') ?? 'html';

    const p = await db.personnel.findUnique({ where: { id: personnelId } });
    if (!p) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    const decree = decreeId
      ? await db.decree.findUnique({ where: { id: decreeId } })
      : await db.decree.findFirst({ where: { personnelId }, orderBy: { effectiveDate: 'desc' } });
    if (!decree) return NextResponse.json({ error: 'حکمی برای این پرسنل ثبت نشده است' }, { status: 404 });
    const company = await db.company.findUnique({ where: { id: p.companyId } });

    // نسخه ۱٫۴٫۶ — شماره حکم = شماره پرسنلی / ماه صدور (مثل 140501160/08)
    // تاریخ حکم = تاریخ صدور (ثبت) حکم در سیستم — در سربرگ و ردیف اطلاعات
    if (format === 'docx') {
    const createdAtStr = decree.createdAt ? new Date(decree.createdAt).toISOString() : '';
    const issuedJ = createdAtStr ? gregorianToJalaliStr(createdAtStr) : '';
    const issuedDate = issuedJ || decree.effectiveDate || todayJalali();
    const issuedParts = issuedDate.split('/');
    const issueMonth = String(Number(issuedParts[1] || '1')).padStart(2, '0');
    const decreeNumber = `${p.personnelCode || String(personnelId)}/${issueMonth}`;
    const body = hokmWordBody(
      {
        fullName: `${p.firstName} ${p.lastName}`.trim(), fatherName: p.fatherName, nationalId: p.nationalId,
        personnelCode: p.personnelCode, jobTitle: p.jobTitle, department: p.department || 'عمومی',
      },
      { ...(decree as unknown as Record<string, unknown>), decreeNumber, issuedDate },
      company?.managerName || '',
    );
    const buf = await fillLetterheadDocx(body, {
      num: decreeNumber.split('/')[0], num2: issueMonth,
      date: issuedDate,
    }, p.photo);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="decree-${encodeURIComponent(p.personnelCode || String(personnelId))}.docx"`,
        },
      });
    }
    const lhRow = await db.appSetting.findUnique({ where: { key: 'letterhead_image' } });
    const letterhead = lhRow?.value ? (isSafeImageDataUrl(lhRow.value) ?? isSafePublicPath(lhRow.value)) : '/letterhead/letterhead-default.jpeg';

    const rows = DECREE_ROWS
      .filter(([, k]) => Number((decree as unknown as Record<string, number>)[k] ?? 0) > 0)
      .map(([t, k], i) => {
        const v = Number((decree as unknown as Record<string, number>)[k] ?? 0);
        return `<tr><td style="text-align:center">${toFa(i + 1)}</td><td>${toFa(t)}</td><td style="text-align:center">${formatMoney(v)}</td></tr>`;
      })
      .join('');
    const sum = DECREE_ROWS.reduce((s, [, k]) => s + Number((decree as unknown as Record<string, number>)[k] ?? 0), 0);

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="UTF-8" />
<title>حکم پرسنلی — ${esc(toFa(p.firstName))} ${esc(toFa(p.lastName))}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body { font-family: 'Vazirmatn','Tahoma',sans-serif; font-size: 11.5px; line-height: 1.9; color: #111; }
  img.letterhead { width: 100%; display: block; margin-bottom: 6px; }
  h2.doc-title { text-align: center; font-size: 14.5px; margin: 8px 0 2px; }
  .meta { width: 100%; font-size: 11px; margin-bottom: 6px; }
  .meta td { padding: 2px 5px; }
  .intro { text-align: justify; }
  table.wage { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11.5px; }
  table.wage td, table.wage th { border: 1px solid #666; padding: 5px 8px; }
  table.wage th { background: #eef2f7; }
  .law { font-size: 10.5px; line-height: 1.9; text-align: justify; }
  .sig { width: 100%; margin-top: 16px; border-collapse: collapse; }
  .sig td { border: none; text-align: center; padding: 12px 6px; font-size: 11.5px; }
  @media print { .noprint { display: none } }
</style></head><body>
  <button class="noprint" onclick="window.print()" style="position:fixed;top:6px;left:6px">چاپ / PDF (Ctrl+P)</button>
  <img class="letterhead" src="${letterhead}" alt="سربرگ شرکت" />
  <h2 class="doc-title">حکم پرسنلی حقوق و مزایا</h2>
  <table class="meta"><tr>
    <td>شماره حکم : <b>${toFa(decree.id)}</b></td>
    <td>شماره پرسنلی : <b>${toFa(p.personnelCode)}</b></td>
    <td>تاریخ اجرا : ${dateLtr(decree.effectiveDate)}</td>
  </tr></table>
  <p class="intro">
    جناب/سرکار آقای/خانم <b>${esc(toFa(p.firstName))} ${esc(toFa(p.lastName))}</b> فرزند ${esc(toFa(p.fatherName))} — کدملی ${esc(toFa(p.nationalId || '—'))} —
    شاغل در بخش ${esc(toFa(p.department))} به عنوان ${esc(toFa(p.jobTitle || '—'))}، با توجه به صلاحدید مدیریت و مطابق مفاد قانون کار،
    حقوق و مزایای حکمی شما با تاریخ اجرای ${dateLtr(decree.effectiveDate)} به شرح جدول زیر تعیین و ابلاغ می‌گردد. تمامی
    محاسبات حقوق و دستمزد (اضافه‌کاری، شب‌کاری، نوبت‌کاری، جمعه‌کاری، مرخصی، عیدی و سنوات) بر مبنای همین حکم و پارامترهای
    قانونی سال مالی انجام می‌شود.
  </p>
  <table class="wage">
    <thead><tr><th style="width:34px">ردیف</th><th>شرح قلم حقوقی</th><th style="width:170px">مبلغ ماهانه (ریال)</th></tr></thead>
    <tbody>${rows}
      <tr style="font-weight:800;background:#f6f8fa"><td colspan="2">جمع کل حقوق ثابت و مزایای حکم</td><td style="text-align:center">${formatMoney(sum)}</td></tr>
    </tbody>
  </table>
  ${decree.notes ? `<p class="law"><b>ملاحظات:</b> ${esc(toFa(decree.notes))}</p>` : ''}
  <p class="law">
    این حکم مطابق قانون کار صادر و به اطلاع همکار رسید؛ هرگونه تغییر در مبالغ فوق صرفاً با صدور حکم جدید با تاریخ اجرای مشخص امکان‌پذیر است.
    حق اولاد فقط برای افراد متأهل و به‌ازای هر فرزند مندرج در پرونده پرسنلی تعلق می‌گیرد و حق عائله‌مندی مخصوص افراد متأهل است.
  </p>
  <table class="sig"><tr>
    <td>امضای مدیرعامل</td><td><b>${esc(toFa(company?.managerName || ''))}</b></td>
    <td>امضای همکار</td><td><b>${esc(toFa(p.firstName))} ${esc(toFa(p.lastName))}</b></td>
  </tr></table>
</body></html>`;

    if (format === 'doc') {
      return new NextResponse('\ufeff' + html, {
        headers: {
          'Content-Type': 'application/msword; charset=utf-8',
          'Content-Disposition': `attachment; filename="decree-${personnelId}.doc"`,
        },
      });
    }
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
