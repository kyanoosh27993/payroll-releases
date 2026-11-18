// گزارش عیدی و سنوات سالانه — GET /api/reports/eidi?fyId=
// عیدی: ۲ روز آخر سال به ازای هر ماه کارکرد (قانون کار ماده ۱۴۹) با سقف ۳ برابر عیدی حداقل‌بگیر
// سنوات: یک ماه آخرین مزد به ازای هر سال سابقه — به نسبت روزها
// روزهای سابقه = مانده سابقه از قبل (مانده‌های اولیه) + روزهای سال مالی
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr, parseJalaliDateStr } from '@/lib/core/numbers';
import { getFySettings } from '@/lib/core/payroll-calc';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { daysInMonth as jDaysInMonth } from '@/lib/core/jalali';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const fy = await db.fiscalYear.findUnique({ where: { id: fyId } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد' }, { status: 404 });
    const settings = await getFySettings(fyId);
    const minimumWage = parseIntOr(settings['minimum_wage_monthly'], 0); // ۰ = بدون سقف

    const people = await db.personnel.findMany({
      where: { companyId: fy.companyId, status: { in: ['شاغل', 'ترک کار'] } },
      orderBy: { personnelCode: 'asc' }, // قانون ۱٫۴٫۳: کد پرسنلی صعودی
    });
    const ids = people.map((p) => p.id);
    const decrees = ids.length
      ? await db.decree.findMany({ where: { personnelId: { in: ids } }, orderBy: { effectiveDate: 'desc' } })
      : [];
    const decreeByPerson = new Map<number, typeof decrees>();
    for (const d of decrees) {
      const arr = decreeByPerson.get(d.personnelId) ?? [];
      arr.push(d);
      decreeByPerson.set(d.personnelId, arr);
    }
    const openings = ids.length ? await db.openingBalance.findMany({ where: { personnelId: { in: ids } } }) : [];

    // گزاره ۱۴ — روزهای بدون حقوق از روزهای کارکرد سال کسر می‌شود:
    //   • مرخصی تمام‌روز «بدون حقوق» در حضور و غیاب
    //   • روزهای «تعطیل برای فرد» پرسنل قرارداد ساعتی (معادل مرخصی بدون حقوق)
    const unpaidDaysMap = new Map<number, number>();
    const attMonths = await db.attendanceMonth.findMany({
      where: { fiscalYearId: fy.id }, select: { id: true, jy: true, jm: true },
    });
    const monthIds = attMonths.map((m) => m.id);
    if (monthIds.length) {
      const unpaidRows = await db.attendanceDaily.findMany({
        where: { monthId: { in: monthIds }, personnelId: { in: ids }, leaveKind: 'بدون حقوق' },
        select: { personnelId: true, leaveMin: true, expectedMin: true },
      });
      for (const d of unpaidRows) {
        if (d.expectedMin > 0 && d.leaveMin >= d.expectedMin) {
          unpaidDaysMap.set(d.personnelId, (unpaidDaysMap.get(d.personnelId) ?? 0) + 1);
        }
      }
    }
    const hourlyOffMap = new Map<number, number>();
    const hourlyContractRows = await db.contract.findMany({
      where: { personnelId: { in: ids }, contractType: 'ساعتی', isValid: true },
      select: { personnelId: true },
    });
    const hourlyIds = [...new Set(hourlyContractRows.map((c) => c.personnelId))];
    if (hourlyIds.length && attMonths.length) {
      const offs = await db.shiftOverride.findMany({
        where: { personnelId: { in: hourlyIds }, jy: fy.jy, kind: 'off' },
        select: { personnelId: true, jm: true, jd: true },
      });
      const workedSet = new Set<string>();
      const workedRows = await db.attendanceDaily.findMany({
        where: { monthId: { in: monthIds }, personnelId: { in: hourlyIds }, workedMin: { gt: 0 } },
        select: { personnelId: true, day: true },
      });
      for (const w of workedRows) workedSet.add(`${w.personnelId}:${w.day}`);
      for (const o of offs) {
        if (!workedSet.has(`${o.personnelId}:${o.jd}`)) {
          hourlyOffMap.set(o.personnelId, (hourlyOffMap.get(o.personnelId) ?? 0) + 1);
        }
      }
    }

    // روزهای سال مالی (فروردین تا اسفند)
    let yearDays = 0;
    for (let m = 1; m <= 12; m++) yearDays += jDaysInMonth(fy.jy, m);

    const lastOfFy = `${fy.jy}/12/${String(jDaysInMonth(fy.jy, 12)).padStart(2, '0')}`;
    const rows = people.map((p) => {
      const dList = (decreeByPerson.get(p.id) ?? []);
      const decree = dList.find((d) => d.effectiveDate <= lastOfFy) ?? dList[0] ?? null;
      const jobWage = decree?.jobWage ?? 0;

      // ماه‌های کارکرد در سال مالی: از max(استخدام، ابتدای سال) تا پایان سال
      let months = 12;
      const hire = parseJalaliDateStr(p.hireDate);
      if (hire) {
        if (hire[0] > fy.jy) months = 0;
        else if (hire[0] === fy.jy) months = Math.max(0, 12 - hire[1] + 1);
      }
      // روزهای کارکرد سال (منهای روزهای بدون حقوق — گزاره ۱۴)
      let daysWorked = 0;
      if (hire && hire[0] === fy.jy && hire[1] >= 1 && hire[1] <= 12) {
        daysWorked = jDaysInMonth(fy.jy, hire[1]) - hire[2] + 1;
        for (let m = hire[1] + 1; m <= 12; m++) daysWorked += jDaysInMonth(fy.jy, m);
      } else if (!hire || hire[0] < fy.jy) {
        daysWorked = yearDays;
      }
      const unpaidExcluded = (unpaidDaysMap.get(p.id) ?? 0) + (hourlyOffMap.get(p.id) ?? 0);
      if (unpaidExcluded > 0) daysWorked = Math.max(0, daysWorked - unpaidExcluded);

      const pOpen = openings.filter((o) => o.personnelId === p.id);
      const seniorityDaysBefore = pOpen
        .filter((o) => o.kind === 'seniority_days' && o.unit === 'days')
        .reduce((s, o) => s + o.amount, 0);

      // عیدی ماهانه و سقف قانونی
      const eidiMonthly = Math.round(jobWage * 2);
      const eidiRaw = Math.round((eidiMonthly * daysWorked) / yearDays);
      const capFull = minimumWage > 0 ? Math.round((minimumWage * 2 * 3 * daysWorked) / yearDays) : 0;
      const eidiCapped = capFull > 0 && eidiRaw > capFull ? capFull : eidiRaw;

      // سنوات: یک ماه آخرین مزد به ازای هر سال سابقه — به نسبت روز
      const totalServiceDays = seniorityDaysBefore + daysWorked;
      const seniority = Math.round((jobWage * totalServiceDays) / 365);

      const eidUnpaid = pOpen
        .filter((o) => o.kind === 'eid_unpaid' && o.unit === 'amount')
        .reduce((s, o) => s + o.amount, 0);

      return {
        personnelId: p.id,
        personnelCode: p.personnelCode,
        fullName: `${p.firstName} ${p.lastName}`.trim(),
        hireDate: p.hireDate,
        jobWage,
        monthsWorked: months,
        daysWorked,
        unpaidDaysExcluded: unpaidExcluded,
        seniorityDaysBefore: Math.round(seniorityDaysBefore * 100) / 100,
        eidiRaw,
        eidiCapped,
        capApplied: capFull > 0 && eidiRaw > capFull,
        seniority,
        eidUnpaid,
        total: eidiCapped + seniority + eidUnpaid,
      };
    });

    return NextResponse.json({
      fiscalYear: { id: fy.id, jy: fy.jy, title: fy.title },
      yearDays,
      minimumWage,
      rows,
      totals: {
        eidi: rows.reduce((s, r) => s + r.eidiCapped, 0),
        seniority: rows.reduce((s, r) => s + r.seniority, 0),
        eidUnpaid: rows.reduce((s, r) => s + r.eidUnpaid, 0),
        total: rows.reduce((s, r) => s + r.total, 0),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
