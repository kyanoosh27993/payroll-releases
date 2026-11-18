// موتور شیفت کاری و طبقه‌بندی روزانه حضور و غیاب (پورت shifts.py)
// تعریف شیفت هر روز هفته، زمان تاخیر مجاز/تعجیل، تشخیص مرخصی، آمار ماهانه برای حقوق
import { db } from '@/lib/db';
import * as JJ from './jalali';

export type Schedule = Record<string, [number, number]>;

export const DEFAULT_SCHEDULE: Schedule = {
  '0': [480, 960], '1': [480, 960], '2': [480, 960],
  '3': [480, 960], '4': [480, 960], // شنبه تا پنجشنبه ۸ تا ۱۶
};

export function parseSchedule(json: string | null | undefined): Schedule {
  try {
    const o = JSON.parse(json || '{}');
    const out: Schedule = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (Array.isArray(v) && v.length >= 2) out[k] = [Number(v[0]), Number(v[1])];
    }
    return out;
  } catch {
    return {};
  }
}

/** شیفت مؤثر فرد در ماه: اول انتساب ماه، بعد شیفت پیش‌فرض پرونده، بعد پیش‌فرض ۸-۱۶
 *  با jd مشخص، استثنای تک‌روزه (ShiftOverride) همان روز هم اعمال می‌شود (نسخه ۱.۴) */
export async function personShift(personnelId: number, shiftId: number | null, jy: number, jm: number, jd?: number): Promise<Schedule> {
  return (await personShiftInfo(personnelId, shiftId, jy, jm, jd)).schedule;
}

/** شیفت + درصد حق شیفت (نوبت‌کاری) فرد در ماه (یا یک روز مشخص) */
export async function personShiftInfo(personnelId: number, shiftId: number | null, jy: number, jm: number, jd?: number): Promise<{ schedule: Schedule; premiumPct: number }> {
  const asg = await db.shiftAssignment.findFirst({
    where: { personnelId, jy, jm }, select: { shiftId: true },
  });
  const sid = asg?.shiftId ?? shiftId;
  let schedule: Schedule = { ...DEFAULT_SCHEDULE };
  let premiumPct = 0;
  if (sid) {
    const sh = await db.shift.findUnique({ where: { id: sid } });
    if (sh) {
      const s = parseSchedule(sh.schedule);
      premiumPct = sh.premiumPct ?? 0;
      schedule = Object.keys(s).length ? s : schedule;
    }
  }
  // استثنای تک‌روزه — بالاترین اولویت (نسخه ۱.۴)
  if (jd !== undefined) {
    const ov = await db.shiftOverride.findUnique({
      where: { personnelId_jy_jm_jd: { personnelId, jy, jm, jd } },
    }).catch(() => null);
    if (ov) {
      const wd = JJ.weekday(jy, jm, jd);
      if (ov.kind === 'off') {
        delete schedule[String(wd)];
      } else if (ov.kind === 'custom' && ov.endMin > ov.startMin) {
        schedule[String(wd)] = [ov.startMin, ov.endMin];
      } else if (ov.kind === 'shift' && ov.shiftId) {
        const sh2 = await db.shift.findUnique({ where: { id: ov.shiftId } });
        if (sh2) {
          const s2 = parseSchedule(sh2.schedule);
          if (Object.keys(s2).length) {
            // فقط همان روز از شیفت مقصد گرفته می‌شود؛ بقیه هفته دست‌نخورده
            if (s2[String(wd)]) schedule[String(wd)] = s2[String(wd)];
            else delete schedule[String(wd)];
            premiumPct = sh2.premiumPct ?? premiumPct;
          }
        }
      }
    }
  }
  return { schedule, premiumPct };
}

// ---------- شیفت روزانه/تک‌روزه — واکشی دسته‌ای (بدون N+1) ----------
export interface OverrideLite { kind: string; shiftId: number | null; startMin: number; endMin: number }

/** Map پرسنل → روز → استثنا برای یک ماه */
export async function dayOverridesMap(jy: number, jm: number, personIds?: number[]): Promise<Map<number, Map<number, OverrideLite>>> {
  const rows = await db.shiftOverride.findMany({
    where: { jy, jm, ...(personIds && personIds.length ? { personnelId: { in: personIds } } : {}) },
    select: { personnelId: true, jd: true, kind: true, shiftId: true, startMin: true, endMin: true },
  });
  const out = new Map<number, Map<number, OverrideLite>>();
  for (const r of rows) {
    let m = out.get(r.personnelId);
    if (!m) { m = new Map(); out.set(r.personnelId, m); }
    m.set(r.jd, { kind: r.kind, shiftId: r.shiftId, startMin: r.startMin, endMin: r.endMin });
  }
  return out;
}

/** پنجره کاری مؤثر یک روز با احتساب استثنای تک‌روزه؛ null = روز تعطیل برای فرد */
export function effectiveWindow(
  sched: Schedule, ov: OverrideLite | undefined, wd: number, shiftById?: Map<number, { schedule: string; premiumPct: number }>,
): [number, number] | null {
  if (ov) {
    if (ov.kind === 'off') return null;
    if (ov.kind === 'custom') return ov.endMin > ov.startMin ? [ov.startMin, ov.endMin] : null;
    if (ov.kind === 'shift' && ov.shiftId && shiftById) {
      const sh = shiftById.get(ov.shiftId);
      if (sh) {
        const s2 = parseSchedule(sh.schedule);
        return s2[String(wd)] ?? null;
      }
    }
  }
  return sched[String(wd)] ?? null;
}

/** دقیقه موظفی یک روز هفته طبق شیفت؛ ۰ = تعطیل/بدون شیفت */
export function expectedMinutes(schedule: Schedule, wd: number): number {
  const v = schedule[String(wd)];
  if (!v) return 0;
  return Math.max(0, v[1] - v[0]);
}

function fullDayLeave(leave: number, expected: number, mission = 0): boolean {
  return expected > 0 && leave + mission >= expected;
}

export interface DayRow {
  entry1: number; entry2: number; entry3: number;
  exit1: number; exit2: number; exit3: number;
  workedMin: number; leaveMin: number; missionMin: number; status: string;
}

/** طبقه‌بندی یک روز از روی ورود/خروج‌ها و شیفت — پورت recompute_day */
export function recomputeDay(
  row: DayRow, expectedMin: number, graceLate: number, graceEarly: number,
  schedStart: number | null, schedEnd: number | null,
): { lateMin: number; earlyMin: number; missingMin: number; leaveMin: number; status: string; expectedMin: number } {
  const entries = [row.entry1, row.entry2, row.entry3].filter((e) => e >= 0);
  const exits = [row.exit1, row.exit2, row.exit3].filter((e) => e >= 0);
  const worked = row.workedMin || 0;
  const leave = row.leaveMin || 0;
  const mission = row.missionMin || 0;
  let status = (row.status || '').trim();
  if (status === 'بدون شیفت') status = '';

  if (expectedMin <= 0) {
    return {
      lateMin: 0, earlyMin: 0, missingMin: 0, leaveMin: leave,
      status: status || (worked <= 0 ? 'تعطیل' : 'تعطیل‌کاری'), expectedMin: 0,
    };
  }

  let late = 0, early = 0, missing = 0;
  const isFullLeave = fullDayLeave(leave, expectedMin, mission);
  if (entries.length && !isFullLeave) {
    const firstIn = Math.min(...entries);
    const rawLate = Math.max(0, firstIn - (schedStart ?? 0));
    late = Math.max(0, rawLate - graceLate);
  }
  if (exits.length && schedEnd !== null) {
    const lastOut = Math.max(...exits);
    const rawEarly = Math.max(0, schedEnd - lastOut);
    early = Math.max(0, rawEarly - graceEarly);
  }
  if (!isFullLeave) {
    missing = Math.max(0, expectedMin - worked - leave - mission);
    if (missing > 0 && leave >= expectedMin) missing = 0;
  }
  if (!status) {
    if (isFullLeave) status = 'مرخصی';
    else if (worked <= 0 && leave <= 0 && mission <= 0) status = 'غایب';
    else if (late > 0 && early > 0) status = 'تاخیر و تعجیل';
    else if (late > 0) status = 'تاخیر';
    else if (early > 0) status = 'تعجیل';
    else if (mission > 0 && worked <= 0) status = 'ماموریت';
    else status = 'حاضر';
  }
  return { lateMin: late, earlyMin: early, missingMin: missing, leaveMin: leave, status, expectedMin };
}

/** مرخصی‌های روزانه ثبت‌شده در جدول leaves → Map پرسنل→روز→(نوع، دقیقه)
 *  C3: در سطح SQL به سال جاری محدود می‌شود (ایمن برای تاریخ‌های با/بدون صفر اول) */
export async function leavesMapForMonth(jy: number, jm: number): Promise<Map<string, { kind: string; minutes: number }>> {
  const dim = JJ.daysInMonth(jy, jm);
  const yearStart = `${jy}/01/01`;
  const yearEnd = `${jy}/12/31`;
  const leaves = await db.leave.findMany({
    where: {
      leaveKind: { in: ['استحقاقی', 'استعلاجی', 'بدون حقوق'] },
      toDate: { gte: yearStart },
      fromDate: { lte: yearEnd },
    },
    select: { personnelId: true, fromDate: true, toDate: true, leaveKind: true },
  });
  const out = new Map<string, { kind: string; minutes: number }>();
  for (const l of leaves) {
    const f = (await import('./numbers')).parseJalaliDateStr(l.fromDate);
    const t = (await import('./numbers')).parseJalaliDateStr(l.toDate);
    if (!f || !t) continue;
    for (const [yy, mm, dd] of JJ.dateRangeJalali(f[0], f[1], f[2], t[0], t[1], t[2])) {
      if (yy === jy && mm === jm && dd >= 1 && dd <= dim) {
        out.set(`${l.personnelId}:${dd}`, { kind: l.leaveKind, minutes: 480 });
      }
    }
  }
  return out;
}

/** بازمحاسبه همه روزهای ماه بر اساس شیفت هر فرد + زمان‌های مجاز تاخیر و تعجیل + جدول مرخصی‌ها
 *  C2: همه به‌روزرسانی‌ها فقط وقتی مقدار تغییر کرده داخل یک تراکنش اجرا می‌شوند
 *  B6: مرخصی تمام‌روز = دقیقه موظفی همان روز طبق شیفت (نه ۴۸۰ ثابت)
 *  روزهای تعطیل شیفت (مثل جمعه برای فرد غیرشیفتکار) مرخصی مصرف نمی‌کند */
export async function recalcMonth(monthId: number, holidaySet: Set<number>, graceLate: number, graceEarly: number): Promise<number> {
  const m = await db.attendanceMonth.findUnique({ where: { id: monthId } });
  if (!m) return 0;
  const { jy, jm } = m;
  const rows = await db.attendanceDaily.findMany({
    where: { monthId },
    include: { personnel: { select: { shiftId: true } } },
  });
  const leaveMap = await leavesMapForMonth(jy, jm);
  // واکشی دسته‌ای شیفت‌ها (بدون N+1)
  const personIds = [...new Set(rows.map((r) => r.personnelId))];
  const assignments = personIds.length
    ? await db.shiftAssignment.findMany({ where: { personnelId: { in: personIds }, jy, jm } })
    : [];
  const asgByPerson = new Map<number, number>();
  for (const a of assignments) if (!asgByPerson.has(a.personnelId)) asgByPerson.set(a.personnelId, a.shiftId);
  const shiftIds = [...new Set([...asgByPerson.values(), ...rows.map((r) => r.personnel.shiftId).filter((v): v is number => v !== null)])];
  const shifts = shiftIds.length ? await db.shift.findMany({ where: { id: { in: shiftIds } } }) : [];
  const shiftById = new Map(shifts.map((sh) => [sh.id, sh]));
  const scheduleOf = (pid: number, fallbackShiftId: number | null): Schedule => {
    const sid = asgByPerson.get(pid) ?? fallbackShiftId;
    const sh = sid ? shiftById.get(sid) : null;
    if (sh) {
      const sc = parseSchedule(sh.schedule);
      if (Object.keys(sc).length) return sc;
    }
    return { ...DEFAULT_SCHEDULE };
  };
  // استثناهای تک‌روزه (نسخه ۱.۴)
  const ovMap = await dayOverridesMap(jy, jm, personIds);
  // نسخه ۱٫۴٫۶ — شیفت‌های استفاده‌شده در استثناهای kind=shift هم باید واکشی شوند
  const overrideShiftIds = [...new Set([...ovMap.values()].flatMap((m) => [...m.values()])
    .filter((ov) => ov.kind === 'shift' && ov.shiftId).map((ov) => ov.shiftId as number))];
  for (const sid of overrideShiftIds) if (!shiftById.has(sid)) {
    const sh = await db.shift.findUnique({ where: { id: sid } });
    if (sh) shiftById.set(sh.id, sh);
  }

  const pending: Array<{ id: number; data: Record<string, unknown> }> = [];
  for (const r of rows) {
    const sched = scheduleOf(r.personnelId, r.personnel.shiftId);
    const wd = JJ.weekday(jy, jm, r.day);
    const win = effectiveWindow(sched, ovMap.get(r.personnelId)?.get(r.day), wd, shiftById);
    const exp = win ? Math.max(0, win[1] - win[0]) : 0;
    const [ss, se] = win ? [win[0], win[1]] : [null, null];
    let leaveMin = r.leaveMin || 0;
    const lm = leaveMap.get(`${r.personnelId}:${r.day}`);
    let kind = '';
    if (lm) {
      kind = lm.kind;
      if (exp > 0) {
        // مرخصی تمام‌روز به اندازه دقیقه موظفی همان روز (شیفت ۱۲ ساعته = ۷۲۰ دقیقه)
        leaveMin = Math.max(leaveMin, exp);
      } else {
        // روز تعطیل شیفت — مرخصی مصرف نمی‌کند
        leaveMin = 0;
      }
    }
    const out = recomputeDay(
      {
        entry1: r.entry1, entry2: r.entry2, entry3: r.entry3,
        exit1: r.exit1, exit2: r.exit2, exit3: r.exit3,
        workedMin: r.workedMin, leaveMin, missionMin: r.missionMin, status: r.status,
      },
      exp, graceLate, graceEarly, ss, se,
    );
    if (kind) out.status = (kind === 'استعلاجی' || kind === 'بدون حقوق') ? 'مرخصی ' + kind : 'مرخصی';
    if (
      out.lateMin !== r.lateMin || out.earlyMin !== r.earlyMin || out.missingMin !== r.missingMin ||
      out.leaveMin !== r.leaveMin || out.status !== r.status || out.expectedMin !== r.expectedMin ||
      kind !== r.leaveKind
    ) {
      pending.push({
        id: r.id,
        data: {
          lateMin: out.lateMin, earlyMin: out.earlyMin, missingMin: out.missingMin,
          leaveMin: out.leaveMin, status: out.status, expectedMin: out.expectedMin, leaveKind: kind,
        },
      });
    }
  }
  // همه تغییرات داخل یک تراکنش — قفل کوتاه‌تر و سرعت بیشتر
  if (pending.length) {
    await db.$transaction(async (tx) => {
      for (const u of pending) {
        await tx.attendanceDaily.update({ where: { id: u.id }, data: u.data });
      }
    }, { timeout: 120000 });
  }
  return pending.length;
}

/** دقیقه‌های شب‌کاری ۲۲:۰۰ تا ۰۶:۰۰ از بازه‌های ورود/خروج (خروج قبل از ورود = عبور از نیمه‌شب) */
export function nightMinutesOf(pairs: Array<[number, number]>): number {
  const WINDOWS: Array<[number, number]> = [[1320, 1440], [0, 360]];
  let total = 0;
  for (const [a, bRaw] of pairs) {
    if (a < 0 || bRaw < 0 || bRaw === a) continue;
    const segs: Array<[number, number]> = bRaw > a ? [[a, bRaw]] : [[a, 1440], [0, bRaw]];
    for (const [s, e] of segs) {
      for (const [ws, we] of WINDOWS) {
        total += Math.max(0, Math.min(e, we) - Math.max(s, ws));
      }
    }
  }
  return Math.min(total, 12 * 60);
}

export interface MonthStat {
  paidDays: number; presentDays: number;
  overtimeHours: number; holidayHours: number; fridayHours: number;
  leaveDays: number; unpaidDays: number;
  lateMinutes: number; earlyMinutes: number; missingMinutes: number;
  /** ساعات شب‌کاری ۲۲–۰۶ — مبنای ۳۵٪ شب‌کاری */
  nightHours: number;
  /** کل ساعات کارکرد — مبنای درصد حق شیفت */
  workedHours: number;
  /** نسخه ۱٫۴٫۶ — جمعه‌کاری با روز جایگزین (۴۰٪) و بدون روز جایگزین (۱۸۰٪) */
  fridayReplacedHours: number; fridayNoReplaceHours: number;
  /** نسخه ۱٫۴٫۶ — ریز ساعات حق شیفت بر حسب درصد شیفت هر روز (نوبت‌کاری چندگانه) */
  shiftPctHours: Array<{ pct: number; hours: number }>;
}

/** آمار کارکرد ماهانه هر پرسنل برای حقوق — پورت month_stats
 *  B4: روز کارکرد کسری می‌شود (کار + مرخصی ساعتی همان روز هرگز از یک روز بیشتر نمی‌شود)
 *  B5: جمعه‌کاری فقط وقتی جمعه طبق شیفت فرد روز کار نباشد ضریب می‌گیرد
 *      (شیفتکارِ هتلی که جمعه‌ها طبق برنامه کار می‌کند، جمعه‌کاری اضافه نمی‌گیرد) */
export async function monthStats(monthId: number, holidaySet: Set<number>): Promise<Record<number, MonthStat>> {
  const m = await db.attendanceMonth.findUnique({ where: { id: monthId } });
  if (!m) return {};
  const { jy, jm } = m;
  const dim = JJ.daysInMonth(jy, jm);
  const rows = await db.attendanceDaily.findMany({
    where: { monthId },
    include: { personnel: { select: { shiftId: true } } },
  });
  // واکشی دسته‌ای شیفت مؤثر هر فرد (بدون N+1)
  const personIds = [...new Set(rows.map((r) => r.personnelId))];
  const assignments = personIds.length
    ? await db.shiftAssignment.findMany({ where: { personnelId: { in: personIds }, jy, jm } })
    : [];
  const asgByPerson = new Map<number, number>();
  for (const a of assignments) if (!asgByPerson.has(a.personnelId)) asgByPerson.set(a.personnelId, a.shiftId);
  const shiftIds = [...new Set([...asgByPerson.values(), ...rows.map((r) => r.personnel.shiftId).filter((v): v is number => v !== null)])];
  const shifts = shiftIds.length ? await db.shift.findMany({ where: { id: { in: shiftIds } } }) : [];
  const shiftById = new Map(shifts.map((sh) => [sh.id, sh]));
  const scheduleOf = (pid: number, fallbackShiftId: number | null): Schedule => {
    const sid = asgByPerson.get(pid) ?? fallbackShiftId;
    const sh = sid ? shiftById.get(sid) : null;
    if (sh) {
      const sc = parseSchedule(sh.schedule);
      if (Object.keys(sc).length) return sc;
    }
    return { ...DEFAULT_SCHEDULE };
  };
  // استثناهای تک‌روزه (نسخه ۱.۴) — برای تشخیص درست جمعه‌کاری/تعطیل‌کاری هر روز
  const ovMap = await dayOverridesMap(jy, jm, personIds);
  // نسخه ۱٫۴٫۶ — شیفت‌های استثنای kind=shift هم واکشی شوند (وگرنه درصد حق شیفت روز پیدا نمی‌شود)
  const overrideShiftIds = [...new Set([...ovMap.values()].flatMap((m) => [...m.values()])
    .filter((ov) => ov.kind === 'shift' && ov.shiftId).map((ov) => ov.shiftId as number))];
  for (const sid of overrideShiftIds) if (!shiftById.has(sid)) {
    const sh = await db.shift.findUnique({ where: { id: sid } });
    if (sh) shiftById.set(sh.id, sh);
  }
  // نسخه ۱٫۴٫۶ — روزهای «تعطیل برای فرد» (استثنا off) هر پرسنل = مبنای تشخیص «جمعه‌کاری با روز جایگزین»
  const offDaysByPerson = new Map<number, Set<number>>();
  for (const [pid, dm] of ovMap) {
    const s = new Set<number>();
    for (const [jd, ov] of dm) if (ov.kind === 'off') s.add(jd);
    offDaysByPerson.set(pid, s);
  }
  // نسخه ۱٫۴٫۶ — درصد حق شیفت مؤثر هر روز: استثنای kind=shift → شیفت همان روز، وگرنه شیفت ماه
  const pctOf = (pid: number, fallbackShiftId: number | null, jd: number): number => {
    const ov = ovMap.get(pid)?.get(jd);
    if (ov?.kind === 'shift' && ov.shiftId) {
      const sh = shiftById.get(ov.shiftId);
      if (sh) return sh.premiumPct || 0;
    }
    const sid = asgByPerson.get(pid) ?? fallbackShiftId;
    const sh = sid ? shiftById.get(sid) : null;
    return sh?.premiumPct || 0;
  };
  // گزاره ۱۴ — پرسنل دارای قرارداد ساعتی (برای لحاظ کردن روز تعطیل برای فرد به‌عنوان مرخصی بدون حقوق)
  const hourlyContracts = personIds.length
    ? await db.contract.findMany({ where: { personnelId: { in: personIds }, contractType: 'ساعتی', isValid: true }, select: { personnelId: true } })
    : [];
  const hourlyPersonSet = new Set(hourlyContracts.map((c) => c.personnelId));

  const people = new Map<number, {
    paidFraction: number; presentDays: number; otMin: number; holidayMin: number; fridayMin: number;
    fridayReplacedMin: number; fridayNoReplaceMin: number;
    leaveMin: number; unpaidMin: number; lateMin: number; earlyMin: number; missingMin: number;
    nightMin: number; workedMinTotal: number; shiftPctMin: Map<number, number>;
  }>();
  const newSt = () => ({
    paidFraction: 0, presentDays: 0, otMin: 0, holidayMin: 0, fridayMin: 0,
    fridayReplacedMin: 0, fridayNoReplaceMin: 0,
    leaveMin: 0, unpaidMin: 0, lateMin: 0, earlyMin: 0, missingMin: 0,
    nightMin: 0, workedMinTotal: 0, shiftPctMin: new Map<number, number>(),
  });
  for (const r of rows) {
    const st = people.get(r.personnelId) ?? newSt();
    const stat = r.status || '';
    const lv = r.leaveMin || 0;
    const exp = r.expectedMin || 0;
    const worked = r.workedMin || 0;
    const mission = r.missionMin || 0;
    const fullLeave = exp > 0 && lv >= exp;
    const isPaidLeave = fullLeave && !stat.includes('بدون حقوق');
    const isUnpaid = fullLeave && stat.includes('بدون حقوق');

    // گزاره ۱۳/۱۴ — روز «تعطیل برای فرد» (استثنای تک‌روزه kind=off):
    //   • پرسنل قرارداد ساعتی: مرخصی بدون حقوق — دای پرداخت‌شدهای حساب نمی‌شود
    //     و از عیدی/پاداش/سنوات هم حذف می‌شود
    //   • سایر پرسنل: روز پرداخت‌شده — مثل یک روز کاری لحاظ می‌شود
    const offOv = ovMap.get(r.personnelId)?.get(r.day);
    const offOverrideDay = offOv?.kind === 'off';
    const isHourly = hourlyPersonSet.has(r.personnelId);
    if (worked > 0) st.presentDays++;
    if (isUnpaid) {
      st.unpaidMin += lv;
    } else {
      // روز کارکرد کسری: کار + مرخصی + ماموریت همان روز حداکثر یک روز حساب می‌شود
      let fraction: number;
      if (offOverrideDay && exp <= 0 && worked <= 0 && lv <= 0 && mission <= 0) {
        fraction = isHourly ? 0 : 1;
      } else {
        fraction = exp > 0
          ? Math.min(1, (worked + lv + mission) / exp)
          : (worked > 0 || lv > 0 ? 1 : 0);
      }
      st.paidFraction += fraction;
      if (!isPaidLeave) st.leaveMin += lv; // مرخصی ساعتی — آمار مصرف
    }
    st.otMin += r.overtimeMin || 0;
    st.lateMin += r.lateMin || 0;
    st.earlyMin += r.earlyMin || 0;
    st.missingMin += r.missingMin || 0;
    if (r.day >= 1 && r.day <= dim) {
      const wd = JJ.weekday(jy, jm, r.day);
      const sched = scheduleOf(r.personnelId, r.personnel.shiftId);
      // جمعه‌کاری/تعطیل‌کاری با احتساب استثنای تک‌روزه همان روز (نسخه ۱.۴)
      const win = effectiveWindow(sched, ovMap.get(r.personnelId)?.get(r.day), wd, shiftById);
      const fridayIsWorkday = win !== null && win[1] > win[0];
      if (wd === 6 && !fridayIsWorkday) {
        st.fridayMin += worked;
        // نسخه ۱٫۴٫۶ — تفکیک با/بدون روز جایگزین:
        // اگر در همان هفته (شنبه تا جمعه) یک روز «تعطیل برای فرد» (استثنا off) باشد → جایگزین داده شده = ۴۰٪
        // وگرنه جمعه‌کاری بدون روز جایگزین = ۱۸۰٪
        const offs = offDaysByPerson.get(r.personnelId);
        let replaced = false;
        if (offs && offs.size) {
          for (let d = r.day - 6; d <= r.day + 6 && !replaced; d++) {
            if (d >= 1 && d <= dim && offs.has(d) && d !== r.day) replaced = true;
          }
        }
        if (replaced) st.fridayReplacedMin += worked;
        else st.fridayNoReplaceMin += worked;
      }
      else if (wd !== 6 && holidaySet.has(r.day)) st.holidayMin += worked;
    }
    // شب‌کاری ۲۲–۰۶ فقط برای روزهای با کارکرد واقعی
    if (worked > 0) {
      const nightMin = nightMinutesOf([
        [r.entry1, r.exit1], [r.entry2, r.exit2], [r.entry3, r.exit3],
      ]);
      st.nightMin += nightMin;
      st.workedMinTotal += worked;
      // نسخه ۱٫۴٫۶ — ساعات مشمول حق شیفت هر روز = کارکرد − شب‌کاری، تفکیک‌شده بر حسب درصد شیفت همان روز
      const premiumMin = Math.max(0, worked - nightMin);
      if (premiumMin > 0) {
        const pct = Math.round(pctOf(r.personnelId, r.personnel.shiftId, r.day) * 10) / 10;
        st.shiftPctMin.set(pct, (st.shiftPctMin.get(pct) ?? 0) + premiumMin);
      }
    }
    people.set(r.personnelId, st);
  }
  const out: Record<number, MonthStat> = {};
  for (const [pid, st] of people) {
    const leaveDays = st.leaveMin / 480;
    const unpaidDays = st.unpaidMin / 480;
    const shiftPctHours = [...st.shiftPctMin.entries()]
      .filter(([pct]) => pct > 0)
      .sort((a, b) => b[0] - a[0])
      .map(([pct, min]) => ({ pct, hours: Math.round((min / 60) * 100) / 100 }));
    out[pid] = {
      fridayReplacedHours: Math.round((st.fridayReplacedMin / 60) * 100) / 100,
      fridayNoReplaceHours: Math.round((st.fridayNoReplaceMin / 60) * 100) / 100,
      shiftPctHours,
      paidDays: Math.round(st.paidFraction * 100) / 100,
      presentDays: st.presentDays,
      overtimeHours: st.otMin / 60,
      holidayHours: st.holidayMin / 60,
      fridayHours: st.fridayMin / 60,
      leaveDays: Math.round(leaveDays * 100) / 100,
      unpaidDays: Math.round(unpaidDays * 100) / 100,
      lateMinutes: st.lateMin,
      earlyMinutes: st.earlyMin,
      missingMinutes: st.missingMin,
      nightHours: Math.round((st.nightMin / 60) * 100) / 100,
      workedHours: Math.round((st.workedMinTotal / 60) * 100) / 100,
    };
  }
  return out;
}
