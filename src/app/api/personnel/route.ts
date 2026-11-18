import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeDigits, cleanText, parseIntOr } from '@/lib/core/numbers';
import { personnelData } from '@/lib/core/personnel-input';
import { isValidNationalId } from '@/lib/core/national-id';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const companyId = parseIntOr(sp.get('companyId'), 0);
    if (!companyId) return NextResponse.json({ error: 'companyId الزامی است' }, { status: 400 });
    const q = cleanText(sp.get('q') ?? '');
    const status = cleanText(sp.get('status') ?? '');
    const where: Record<string, unknown> = { companyId };
    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { personnelCode: { contains: normalizeDigits(q) } },
        { nationalId: { contains: normalizeDigits(q) } },
      ];
    }
    if (status && status !== 'همه') where.status = status;
    const personnel = await db.personnel.findMany({
      where,
      orderBy: { personnelCode: 'asc' } // قانون نسخه ۱٫۴٫۳: ملاک پیش‌فرض نمایش = کد پرسنلی از کم به زیاد
    });
    return NextResponse.json({ personnel });
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
    const companyId = parseIntOr(body.companyId, 0);
    if (!companyId) return NextResponse.json({ error: 'companyId الزامی است' }, { status: 400 });
    const data = personnelData(body);
    if (!data.personnelCode) return NextResponse.json({ error: 'کد پرسنلی الزامی است' }, { status: 400 });
    if (!data.firstName && !data.lastName) {
      return NextResponse.json({ error: 'نام یا نام خانوادگی الزامی است' }, { status: 400 });
    }
    const dup = await db.personnel.findFirst({
      where: { companyId, personnelCode: data.personnelCode },
    });
    if (dup) return NextResponse.json({ error: 'کد پرسنلی تکراری است' }, { status: 400 });
    // گزاره ۱ نسخه ۱٫۲٫۰ — راستی‌آزمایی کد ملی: جلوگیری از کدهای ملی فیک.
    // فقط پرسنل «غیرفعال» (واردشده از فایل اکسل دستگاه حضور و غیاب) مجاز به ثبت بدون کد ملی است.
    if (data.nationalId && !isValidNationalId(data.nationalId)) {
      return NextResponse.json({ error: 'کد ملی وارد شده معتبر نیست — لطفاً کد ملی ۱۰ رقمی صحیح را وارد کنید' }, { status: 400 });
    }
    if (!data.nationalId && data.status !== 'غیرفعال') {
      return NextResponse.json({ error: 'کد ملی الزامی است. فقط پرسنل غیرفعالِ واردشده از دستگاه حضور و غیاب می‌تواند بدون کد ملی ثبت شود' }, { status: 400 });
    }
    const personnel = await db.personnel.create({ data: { companyId, ...data } });
    await logAudit({
      user: me, action: 'ایجاد پرسنل', entity: 'personnel', entityId: personnel.id,
      details: `${personnel.firstName} ${personnel.lastName} — کد: ${personnel.personnelCode}`,
      after: { personnelCode: personnel.personnelCode, firstName: personnel.firstName, lastName: personnel.lastName, status: personnel.status },
    });
    return NextResponse.json({ personnel }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
