import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr } from '@/lib/core/numbers';
import { personnelData } from '@/lib/core/personnel-input';
import { isValidNationalId } from '@/lib/core/national-id';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const personnel = await db.personnel.findUnique({ where: { id: pid } });
    if (!personnel) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    return NextResponse.json({ personnel });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const existing = await db.personnel.findUnique({ where: { id: pid } });
    if (!existing) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    const body = await req.json();
    const data = personnelData(body);
    if (!data.personnelCode) return NextResponse.json({ error: 'کد پرسنلی الزامی است' }, { status: 400 });
    const dup = await db.personnel.findFirst({
      where: { companyId: existing.companyId, personnelCode: data.personnelCode, id: { not: pid } },
    });
    if (dup) return NextResponse.json({ error: 'کد پرسنلی تکراری است' }, { status: 400 });
    // گزاره ۱ نسخه ۱٫۲٫۰ — راستی‌آزمایی کد ملی در ویرایش + قفل فعال‌سازی:
    // پرسنل غیرفعال فقط با کد ملی معتبر می‌تواند فعال (شاغل) شود.
    if (data.nationalId && !isValidNationalId(data.nationalId)) {
      return NextResponse.json({ error: 'کد ملی وارد شده معتبر نیست — لطفاً کد ملی ۱۰ رقمی صحیح را وارد کنید' }, { status: 400 });
    }
    if (!data.nationalId && data.status === 'شاغل') {
      return NextResponse.json({ error: 'برای فعال‌سازی پرسنل، وارد کردن کد ملی معتبر الزامی است' }, { status: 400 });
    }
    if (!data.nationalId && existing.status === 'غیرفعال' && data.status !== 'غیرفعال') {
      return NextResponse.json({ error: 'برای تغییر وضعیت پرسنل غیرفعال، ابتدا کد ملی معتبر را وارد کنید' }, { status: 400 });
    }
    const personnel = await db.personnel.update({ where: { id: pid }, data });
    await logAudit({
      user: me, action: 'ویرایش پرسنل', entity: 'personnel', entityId: pid,
      details: `${personnel.firstName} ${personnel.lastName} — کد: ${personnel.personnelCode}`,
      before: { personnelCode: existing.personnelCode, firstName: existing.firstName, lastName: existing.lastName, status: existing.status },
      after: { personnelCode: personnel.personnelCode, firstName: personnel.firstName, lastName: personnel.lastName, status: personnel.status },
    });
    return NextResponse.json({ personnel });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const pid = parseIntOr(id, 0);
    const existing = await db.personnel.findUnique({ where: { id: pid } });
    if (!existing) return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 });
    await db.personnel.delete({ where: { id: pid } });
    await logAudit({
      user: me, action: 'حذف پرسنل', entity: 'personnel', entityId: pid,
      details: `${existing.firstName} ${existing.lastName} — کد: ${existing.personnelCode}`,
      before: { personnelCode: existing.personnelCode, firstName: existing.firstName, lastName: existing.lastName },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
