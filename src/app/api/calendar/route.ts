// API تقویم — GET: گرید ماه با رویدادها (ensureYear) — POST: افزودن رویداد
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr, normalizeDigits } from '@/lib/core/numbers';
import { daysInMonth, weekday, todayJalali, WEEKDAY_NAMES } from '@/lib/core/jalali';
import { ensureYear } from '@/lib/core/calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const today = todayJalali();
    const jy = parseIntOr(req.nextUrl.searchParams.get('jy'), today.jy);
    const jm = parseIntOr(req.nextUrl.searchParams.get('jm'), today.jm);
    if (!(jy >= 1300 && jy <= 1500 && jm >= 1 && jm <= 12)) {
      return NextResponse.json({ error: 'سال/ماه نامعتبر است' }, { status: 400 });
    }
    await ensureYear(jy);
    const events = await db.calendarEvent.findMany({
      where: { jy, jm },
      orderBy: [{ jd: 'asc' }, { kind: 'asc' }],
    });

    const dim = daysInMonth(jy, jm);
    const eventsByDay = new Map<number, typeof events>();
    for (const e of events) {
      const arr = eventsByDay.get(e.jd) ?? [];
      arr.push(e);
      eventsByDay.set(e.jd, arr);
    }
    const days: Array<{
      jd: number; weekday: number; weekdayName: string; isFriday: boolean; holiday: boolean;
      events: Array<{ id: number; kind: string; title: string; source: string }>;
    }> = [];
    for (let d = 1; d <= dim; d++) {
      const wd = weekday(jy, jm, d);
      const evs = eventsByDay.get(d) ?? [];
      days.push({
        jd: d,
        weekday: wd,
        weekdayName: WEEKDAY_NAMES[wd],
        isFriday: wd === 6,
        holiday: wd === 6 || evs.some((e) => e.kind === 'holiday'),
        events: evs.map((e) => ({ id: e.id, kind: e.kind, title: e.title, source: e.source })),
      });
    }
    return NextResponse.json({
      jy, jm, daysInMonth: dim, days, events,
      today: { jy: today.jy, jm: today.jm, jd: today.jd },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const jy = parseIntOr(body.jy, 0);
    const jm = parseIntOr(body.jm, 0);
    const jd = parseIntOr(body.jd, 0);
    const kind = body.kind === 'holiday' ? 'holiday' : 'occasion';
    const title = normalizeDigits(String(body.title ?? '')).trim();
    if (!(jy >= 1300 && jy <= 1500 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31)) {
      return NextResponse.json({ error: 'تاریخ نامعتبر است' }, { status: 400 });
    }
    if (!title) return NextResponse.json({ error: 'عنوان رویداد الزامی است' }, { status: 400 });
    const ev = await db.calendarEvent.create({
      data: { jy, jm, jd, kind, title, source: 'دستی' },
    });
    return NextResponse.json({ event: ev });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
