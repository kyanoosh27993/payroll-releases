import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr, parseHHMM } from '@/lib/core/numbers';
import { personShift, expectedMinutes, recomputeDay, leavesMapForMonth } from '@/lib/core/shifts';
import { getFySettings } from '@/lib/core/payroll-calc';
import { userFromHeaders , hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** ویرایش یک روز حضور + بازمحاسبه همان روز (recalc=true) */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const rid = parseIntOr(id, 0);
    const row = await db.attendanceDaily.findUnique({ where: { id: rid } });
    if (!row) return NextResponse.json({ error: 'رکورد روز یافت نشد' }, { status: 404 });
    const body = await req.json();
    // ستاره ویرایش دستی: هر تغییر توسط غیر سوپروایزر، ستاره می‌خورد؛ سوپروایزر بدون ستاره اصلاح می‌کند
    const isSup = !!me?.isSupervisor;
    // ورودی‌ها هم دقیقه (عدد) و هم قالب HH:MM پذیرفته می‌شوند
    const pm = (v: unknown, def: number) => {
      if (v === null || v === undefined || v === '') return def;
      if (typeof v === 'number' && isFinite(v)) return Math.round(v);
      return parseHHMM(v, def);
    };

    const data: Record<string, number | string | boolean> = {};
    if (body.entry1 !== undefined) data.entry1 = pm(body.entry1, row.entry1);
    if (body.exit1 !== undefined) data.exit1 = pm(body.exit1, row.exit1);
    if (body.entry2 !== undefined) data.entry2 = pm(body.entry2, row.entry2);
    if (body.exit2 !== undefined) data.exit2 = pm(body.exit2, row.exit2);
    if (body.missionMin !== undefined) data.missionMin = pm(body.missionMin, row.missionMin);
    if (body.overtimeMin !== undefined) data.overtimeMin = pm(body.overtimeMin, row.overtimeMin);
    if (body.workedMin !== undefined) data.workedMin = pm(body.workedMin, row.workedMin);
    if (body.leaveMin !== undefined) data.leaveMin = pm(body.leaveMin, row.leaveMin);
    // ستاره ویرایش دستی: هر تغییر توسط غیر سوپروایزر ستاره می‌خورد؛ سوپروایزر بدون ستاره اصلاح می‌کند
    if (!isSup) data.edited = true;
    else if (body.clearEdited) data.edited = false; // برداشتن ستاره (بازگشت به داده خام)

    const recalc = !!body.recalc;
    let status = typeof body.status === 'string' && body.status ? body.status : row.status;
    let leaveKind = typeof body.leaveKind === 'string' ? body.leaveKind : row.leaveKind;

    if (recalc) {
      const month = await db.attendanceMonth.findUnique({ where: { id: row.monthId } });
      const person = await db.personnel.findUnique({
        where: { id: row.personnelId }, select: { shiftId: true },
      });
      if (month && person) {
        const settings = await getFySettings(month.fiscalYearId);
        const graceLate = parseIntOr(settings['late_grace_minutes'], 10);
        const graceEarly = parseIntOr(settings['early_grace_minutes'], 10);
        const sched = await personShift(row.personnelId, person.shiftId, month.jy, month.jm, row.day); // با استثنای تک‌روزه (۱.۴)
        const wd = (await import('@/lib/core/jalali')).weekday(month.jy, month.jm, row.day);
        const exp = expectedMinutes(sched, wd);
        const v = sched[String(wd)];
        const [ss, se] = v ? [v[0], v[1]] : [null, null];
        const leaveMap = await leavesMapForMonth(month.jy, month.jm);
        const lm = leaveMap.get(`${row.personnelId}:${row.day}`);
        let leaveMin = Number(data.leaveMin ?? row.leaveMin) || 0;
        let lKind = leaveKind || '';
        if (lm && lm.minutes > leaveMin) leaveMin = lm.minutes;
        if (lm) lKind = lm.kind;
        const out = recomputeDay(
          {
            entry1: Number(data.entry1 ?? row.entry1), entry2: Number(data.entry2 ?? row.entry2),
            entry3: row.entry3, exit1: Number(data.exit1 ?? row.exit1),
            exit2: Number(data.exit2 ?? row.exit2), exit3: row.exit3,
            workedMin: Number(data.workedMin ?? row.workedMin), leaveMin,
            missionMin: Number(data.missionMin ?? row.missionMin), status: row.status,
          },
          exp, graceLate, graceEarly, ss, se,
        );
        // نوع مرخصی انتخابی کاربر بر اولویت وضعیت است
        if (lKind && leaveMin > 0) {
          out.status = (lKind === 'استعلاجی' || lKind === 'بدون حقوق') ? 'مرخصی ' + lKind : 'مرخصی';
          out.leaveMin = leaveMin;
        }
        status = out.status;
        leaveKind = lKind;
        data.lateMin = out.lateMin;
        data.earlyMin = out.earlyMin;
        data.missingMin = out.missingMin;
        data.leaveMin = out.leaveMin;
        data.expectedMin = out.expectedMin;
      }
    }
    const updated = await db.attendanceDaily.update({
      where: { id: rid },
      data: { ...data, status, leaveKind } as never,
    });
    await logAudit({
      user: me, action: isSup ? 'اصلاح حضور (بدون ستاره)' : 'ویرایش دستی حضور',
      entity: 'attendance_daily', entityId: rid,
      details: `روز ${row.day} — پرسنل ${row.personnelId}`,
      before: { entry1: row.entry1, exit1: row.exit1, entry2: row.entry2, exit2: row.exit2, workedMin: row.workedMin },
      after: { ...data, status },
    });
    return NextResponse.json({ daily: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
