// API شیفت روزانه/تک‌روزه — استثنای ساعت کاری یک روز مشخص برای یک فرد (نسخه ۱.۴)
// kind: off = تعطیل برای فرد | custom = ساعت خاص | shift = شیفت تعریف‌شده
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import * as JJ from '@/lib/core/jalali';
import { logAudit } from '@/lib/audit';
import { userFromHeaders , hasRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** فهرست استثناهای روزانه یک ماه (companyId + jy + jm) یا یک فرد */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = parseIntOr(sp.get('companyId'), 0);
    const jy = parseIntOr(sp.get('jy'), 0);
    const jm = parseIntOr(sp.get('jm'), 0);
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    if (!jy || !jm) return NextResponse.json({ error: 'سال و ماه الزامی است' }, { status: 400 });
    const overrides = await db.shiftOverride.findMany({
      where: {
        jy, jm,
        ...(personnelId ? { personnelId } : {}),
        ...(companyId ? { personnel: { companyId } } : {}),
      },
      orderBy: [{ personnelId: 'asc' }, { jd: 'asc' }],
    });
    return NextResponse.json({ overrides });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** ثبت/به‌روزرسانی استثنای یک روز (upsert) */
export async function POST(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const personnelId = parseIntOr(body.personnelId, 0);
    const jy = parseIntOr(body.jy, 0);
    const jm = parseIntOr(body.jm, 0);
    const jd = parseIntOr(body.jd, 0);
    const kind = ['off', 'custom', 'shift'].includes(body.kind) ? body.kind : 'custom';
    let startMin = parseIntOr(body.startMin, 480);
    let endMin = parseIntOr(body.endMin, 960);
    const shiftId = kind === 'shift' ? parseIntOr(body.shiftId, 0) : 0;
    const note = typeof body.note === 'string' ? body.note.slice(0, 200) : '';
    if (!personnelId || !jy || !jm || !jd) {
      return NextResponse.json({ error: 'پرسنل، سال، ماه و روز همگی الزامی هستند' }, { status: 400 });
    }
    const dim = JJ.daysInMonth(jy, jm);
    if (jd < 1 || jd > dim) return NextResponse.json({ error: 'روز خارج از محدوده ماه است' }, { status: 400 });
    const person = await db.personnel.findUnique({ where: { id: personnelId } });
    if (!person) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });

    if (kind === 'custom') {
      if (endMin <= startMin) {
        return NextResponse.json({ error: 'ساعت پایان باید بعد از ساعت شروع باشد' }, { status: 400 });
      }
      startMin = Math.max(0, Math.min(1439, startMin));
      endMin = Math.max(1, Math.min(1440, endMin));
    }
    if (kind === 'shift') {
      const sh = await db.shift.findUnique({ where: { id: shiftId } });
      if (!sh) return NextResponse.json({ error: 'شیفت انتخابی یافت نشد' }, { status: 400 });
    }

    const data = {
      kind,
      shiftId: kind === 'shift' ? shiftId : null,
      startMin: kind === 'custom' ? startMin : 480,
      endMin: kind === 'custom' ? endMin : 960,
      note,
    };
    const override = await db.shiftOverride.upsert({
      where: { personnelId_jy_jm_jd: { personnelId, jy, jm, jd } },
      update: data,
      create: { personnelId, jy, jm, jd, ...data },
    });
    await logAudit({
      user: userFromHeaders(req),
      action: 'شیفت تک‌روزه',
      entity: 'ShiftOverride',
      entityId: override.id,
      details: `شیفت تک‌روزه ${jy}/${jm}/${jd} (${kind}) برای پرسنل ${personnelId}`,
    });
    return NextResponse.json({ override });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** حذف استثنا (id) یا همه استثناهای یک فرد در ماه (personnelId + jy + jm) */
export async function DELETE(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const id = parseIntOr(sp.get('id'), 0);
    const personnelId = parseIntOr(sp.get('personnelId'), 0);
    const jy = parseIntOr(sp.get('jy'), 0);
    const jm = parseIntOr(sp.get('jm'), 0);
    if (id) {
      await db.shiftOverride.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: 1 });
    }
    if (personnelId && jy && jm) {
      const res = await db.shiftOverride.deleteMany({ where: { personnelId, jy, jm } });
      return NextResponse.json({ ok: true, deleted: res.count });
    }
    return NextResponse.json({ error: 'id یا (personnelId + سال + ماه) الزامی است' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
