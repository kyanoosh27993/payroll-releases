import { NextRequest, NextResponse } from 'next/server';
import { parseIntOr } from '@/lib/core/numbers';
import { loadPeriodData, payslipPageHtml, SlipInput } from '@/lib/core/payroll-views';
import { computePayslipExtras, getPayslipOptions, PAYSLIP_OPTION_DEFS } from '@/lib/core/payslip-extras';
import { computeTraceForPerson } from '@/lib/core/payroll-trace';
import { isSafeImageDataUrl } from '@/lib/core/sanitize';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const toFa = (v: number | string) => String(v ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** فیش حقوقی چاپی — HTML کامل
 *  personnelId یا ids خالی = همه پرسنل (چاپ گروهی A4، ۲ نفر در صفحه)
 *  paper=a5l|a4 — codes: فهرست اقلام انتخابی (خالی = همه اقلام)
 *  گزاره ۵ نسخه ۱٫۲٫۰: اقلام تکمیلی طبق تنظیمات سال مالی (noextras=1 برای غیرفعال‌سازی) */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const periodId = parseIntOr(sp.get('periodId'), 0);
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    const idsParam = (sp.get('ids') ?? '')
      .split(',').map((x) => parseIntOr(x, 0)).filter(Boolean);
    const paper = sp.get('paper') === 'a4' ? 'a4' as const : 'a5l' as const;
    const codes = new Set((sp.get('codes') ?? '').split(',').map((x) => x.trim()).filter(Boolean));
    const noextras = sp.get('noextras') === '1';
    const data = await loadPeriodData(periodId);
    if (!data.summaries.length) {
      return NextResponse.json({ error: 'این دوره هنوز محاسبه نشده است' }, { status: 400 });
    }
    let selected = data.summaries;
    if (personnelId) selected = selected.filter((s) => s.personnelId === personnelId);
    else if (idsParam.length) selected = selected.filter((s) => idsParam.includes(s.personnelId));
    if (!selected.length) {
      return NextResponse.json({ error: 'پرسنل در این دوره یافت نشد' }, { status: 404 });
    }

    // گزاره ۵ — اقلام تکمیلی طبق انتخاب‌های ذخیره‌شده سال مالی
    const options = noextras ? {} : await getPayslipOptions(data.period.fiscalYearId);
    const enabled = new Set(PAYSLIP_OPTION_DEFS.filter((o) => options[o.key]).map((o) => o.key));

    const slips: Array<SlipInput & { period: { jy: number; jm: number }; pid: number }> = selected.map((s) => ({
      pid: s.personnelId,
      period: { jy: data.period.jy, jm: data.period.jm },
      person: {
        fullName: `${s.personnel.firstName} ${s.personnel.lastName}`.trim(),
        personnelCode: s.personnel.personnelCode,
        nationalId: s.personnel.nationalId,
        ssoNumber: s.personnel.ssoNumber,
        jobTitle: s.personnel.jobTitle,
        costCenter: s.personnel.costCenter,
      },
      items: data.lines
        .filter((l) => l.personnelId === s.personnelId)
        .filter((l) => codes.size === 0 || codes.has(l.itemCode))
        .map((l) => ({
          code: l.itemCode,
          title: data.itemMap[l.itemCode]?.title ?? l.itemCode,
          kind: data.itemMap[l.itemCode]?.kind ?? 'earning',
          amount: l.amount,
        })),
      summary: {
        workedDays: s.workedDays, leaveDays: s.leaveDays, leaveBalance: s.leaveBalance,
        gross: s.gross, insuredBase: s.insuredBase, workerIns: s.workerIns,
        taxBase: s.taxBase, totalDeductions: s.totalDeductions, tax: s.tax,
        netPay: s.netPay, prevBalance: s.prevBalance,
      },
    }));

    if (enabled.size > 0) {
      for (const slip of slips) {
        try {
          const rows = await computePayslipExtras(periodId, slip.pid);
          slip.extras = rows.filter((r) => enabled.has(PAYSLIP_OPTION_DEFS.find((o) => o.label === r.label)?.key ?? ''));
        } catch { /* خطای یک فرد چاپ گروهی را نبندد */ }
      }
    }

    // نسخه ۱٫۴٫۵ — عکس پرسنلی در فیش + ردپای محاسبه هر قلم (کلیک روی مبلغ)
    const notrace = sp.get('notrace') === '1';
    const photoMap = new Map<number, string>();
    if (!notrace) {
      const photos = await db.personnel.findMany({
        where: { id: { in: selected.map((s) => s.personnelId) } },
        select: { id: true, photo: true },
      });
      for (const ph of photos) {
        if (isSafeImageDataUrl(ph.photo)) photoMap.set(ph.id, ph.photo);
      }
      for (const slip of slips) {
        const ph = photoMap.get(slip.pid);
        if (ph) slip.photo = ph;
        try {
          const tr = await computeTraceForPerson(periodId, slip.pid);
          if (tr) {
            slip.trace = tr;
            // نسخه ۱٫۴٫۶ — ساعت کارکرد و اضافه‌کار در سربرگ فیش + ستون مبنا هر قلم از ردپای محاسبه
            if (tr.stat) {
              slip.summary.workedHours = tr.stat.workedHours;
              slip.summary.overtimeHours = tr.stat.overtimeHours;
            }
            for (const it of slip.items) {
              const t = it.code ? tr.traces[it.code] : undefined;
              if (t?.basisShort) it.basis = t.basisShort;
            }
            // ریز شیفت‌ها: هر درصد شیفت جداگانه با تعداد ساعت (به‌جای یک ردیف جمع)
            const shiftIdx = slip.items.findIndex((it) => it.code === 'shift_allow' && it.amount);
            if (shiftIdx >= 0 && tr.stat?.shiftPctHours?.length && tr.stat.shiftPctHours.length > 1) {
              const total = slip.items[shiftIdx].amount;
              const sumHours = tr.stat.shiftPctHours.reduce((s, sp) => s + sp.hours, 0);
              const parts = tr.stat.shiftPctHours.map((sp) => ({
                code: 'shift_allow',
                title: `حق شیفت (${toFa(sp.pct)}٪ نوبت‌کاری)`,
                kind: 'earning',
                amount: Math.round((total * sp.hours) / (sumHours || 1)),
                basis: `${toFa(sp.hours)} ساعت × ${toFa(sp.pct)}٪`,
              }));
              const drift = total - parts.reduce((s, p) => s + p.amount, 0);
              if (parts.length && drift) parts[0].amount += drift;
              slip.items.splice(shiftIdx, 1, ...parts);
            }
            // جمعه‌کاری با/بدون روز جایگزین — هر کدام جداگانه
            const frIdx = slip.items.findIndex((it) => it.code === 'friday_work' && it.amount);
            if (frIdx >= 0 && tr.stat && (tr.stat.fridayReplacedHours || tr.stat.fridayNoReplaceHours)) {
              const total = slip.items[frIdx].amount;
              const h = tr.stat.fridayReplacedHours || 0;
              const nh = tr.stat.fridayNoReplaceHours || 0;
              const parts: typeof slip.items = [];
              if (h) parts.push({ code: 'friday_work', title: 'جمعه‌کاری (با روز جایگزین — ۴۰٪)', kind: 'earning', amount: Math.round((total * h) / (h + nh || 1)), basis: `${toFa(h)} ساعت × ۱٫۴` });
              if (nh) parts.push({ code: 'friday_work', title: 'جمعه‌کاری (بدون روز جایگزین — ۸۰٪ اضافه)', kind: 'earning', amount: 0, basis: `${toFa(nh)} ساعت × ۱٫۸` });
              if (parts.length === 2) { parts[1].amount = total - parts[0].amount; }
              else if (parts.length === 1) parts[0].amount = total;
              slip.items.splice(frIdx, 1, ...parts);
            }
          }
        } catch { /* ردپا اختیاری است */ }
      }
    }

    const html = payslipPageHtml(slips, data.company, { paper, perPage: 2 });
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
