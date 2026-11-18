import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';
import { parseDeviceFile, saveDeviceToDb } from '@/lib/core/device-import';
import { recalcMonth } from '@/lib/core/shifts';
import { holidaySetOfMonth } from '@/lib/core/calendar';
import { getFySettings } from '@/lib/core/payroll-calc';

export const dynamic = 'force-dynamic';

/** ایمپورت فایل خروجی دستگاه حضور و غیاب (xls/xlsx به base64) */
export async function POST(req: NextRequest) {
  try {
    // ممیزی امنیتی ۱٫۴٫۳ (یافته ۶): سقف حجم فایل ایمپورت — ۱۰ مگابایت
    if ((req.headers.get('content-length') ? Number(req.headers.get('content-length')) : 0) > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم فایل ایمپورت نباید بیش از ۱۰ مگابایت باشد' }, { status: 413 });
    }
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const fyId = parseIntOr(body.fyId, 0);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    const fy = await db.fiscalYear.findUnique({ where: { id: fyId } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد' }, { status: 404 });
    const fileBase64 = String(body.fileBase64 || '').replace(/^data:[^;]*;base64,/, '');
    if (!fileBase64) return NextResponse.json({ error: 'فایل ارسال نشده است' }, { status: 400 });
    const buffer = Buffer.from(fileBase64, 'base64');

    const logs: string[] = [];
    const parsed = await parseDeviceFile(buffer, (m) => { if (logs.length < 30) logs.push(m); });
    if (!parsed.employees.length) {
      return NextResponse.json({ error: 'هیچ شیت قابل تشخیصی در فایل یافت نشد. فایل باید «گزارش روزانه فردی» دستگاه باشد.' }, { status: 400 });
    }

    const settings = await getFySettings(fyId);
    const graceLate = parseIntOr(settings['late_grace_minutes'], 10);
    const graceEarly = parseIntOr(settings['early_grace_minutes'], 10);
    const recalc = async (monthId: number, jy: number, jm: number) => {
      const holidays = await holidaySetOfMonth(jy, jm);
      await recalcMonth(monthId, holidays, graceLate, graceEarly);
    };
    const result = await saveDeviceToDb(fyId, fy.companyId, parsed, recalc);
    return NextResponse.json({
      saved: result.saved,
      newEmployees: result.newEmployees,
      unmatched: result.unmatched,
      monthId: result.monthId,
      period: result.period,
      logs: logs.slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
