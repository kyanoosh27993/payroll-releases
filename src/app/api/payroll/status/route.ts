import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr, cleanText } from '@/lib/core/numbers';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** تغییر وضعیت دوره: پیش‌نویس ↔ نهایی ↔ قفل‌شده
 *  قفل کردن: فقط مدیر. بازگشایی قفل: فقط مدیر و فقط با ثبت دلیل در لاگ */
export async function PUT(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin')) {
      return NextResponse.json({ error: 'تغییر وضعیت دوره فقط با نقش مدیر مجاز است' }, { status: 403 });
    }
    const body = await req.json();
    const periodId = parseIntOr(body.periodId, 0);
    // نیم‌فاصله حفظ شود (cleanText آن را به فاصله تبدیل می‌کند)
    const status = String(body.status ?? '').replace(/\s+/g, ' ').trim().replace('پیش نویس', 'پیش\u200cنویس');
    const reason = String(body.reason ?? '').trim();
    if (!periodId) return NextResponse.json({ error: 'periodId الزامی است' }, { status: 400 });
    if (!['پیش‌نویس', 'نهایی', 'قفل‌شده'].includes(status)) {
      return NextResponse.json({ error: 'وضعیت باید «پیش‌نویس»، «نهایی» یا «قفل‌شده» باشد' }, { status: 400 });
    }
    const existing = await db.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!existing) return NextResponse.json({ error: 'دوره یافت نشد' }, { status: 404 });
    // بازگشایی دوره قفل‌شده فقط با ثبت دلیل
    if (existing.status === 'قفل‌شده' && status !== 'قفل‌شده') {
      if (!reason || reason.length < 5) {
        return NextResponse.json(
          { error: 'برای بازگشایی دوره قفل‌شده، ثبت دلیل (حداقل ۵ نویسه) الزامی است' },
          { status: 400 },
        );
      }
    }
    const period = await db.payrollPeriod.update({ where: { id: periodId }, data: { status } });
    await logAudit({
      user: me, action: existing.status === 'قفل‌شده' ? 'بازگشایی دوره قفل‌شده' : 'تغییر وضعیت دوره',
      entity: 'payroll_period', entityId: periodId,
      details: `وضعیت قبلی: ${existing.status} → جدید: ${status}${reason ? ` — دلیل: ${reason}` : ''}`,
    });
    return NextResponse.json({ period });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
