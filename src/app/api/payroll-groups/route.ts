// گروه‌های فیش حقوقی — GET/POST /api/payroll-groups?companyId=
// مدل PayrollGroup در اسکیما وجود ندارد؛ فهرست در AppSetting نگه داشته می‌شود
// و با مقادیر یکتای استفاده‌شده روی پرسنل ادغام می‌شود (گروه‌های ساخته‌شده همه‌جا ظاهر می‌شوند).
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseIntOr, cleanText } from '@/lib/core/numbers';
import { userFromHeaders , hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const SETTING_KEY = 'payrollGroups';

async function loadStored(): Promise<string[]> {
  const s = await db.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!s?.value) return [];
  try {
    const arr = JSON.parse(s.value);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function loadAll(companyId: number): Promise<string[]> {
  const [stored, used] = await Promise.all([
    loadStored(),
    db.personnel.findMany({
      where: { companyId, payslipGroup: { not: '' } },
      select: { payslipGroup: true },
      distinct: ['payslipGroup'],
    }).then((r) => r.map((x) => x.payslipGroup)),
  ]);
  return Array.from(new Set([...stored, ...used])).sort((a, b) => a.localeCompare(b, 'fa'));
}

export async function GET(req: NextRequest) {
  try {
    const companyId = parseIntOr(req.nextUrl.searchParams.get('companyId'), 0);
    if (!companyId) return NextResponse.json({ error: 'companyId الزامی است' }, { status: 400 });
    return NextResponse.json({ groups: await loadAll(companyId) });
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
    const name = cleanText(body.name ?? '');
    if (!name) return NextResponse.json({ error: 'نام گروه الزامی است' }, { status: 400 });
    const stored = await loadStored();
    if (!stored.includes(name)) stored.push(name);
    await db.appSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(stored) },
      create: { key: SETTING_KEY, value: JSON.stringify(stored) },
    });
    await logAudit({ user: me, action: 'ایجاد گروه فیش حقوقی', entity: 'payroll-group', details: name });
    return NextResponse.json({ groups: await loadAll(companyId) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
