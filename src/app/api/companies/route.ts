import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { normalizeDigits, cleanText } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companies = await db.company.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json({ companies });
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
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: 'نام شرکت الزامی است' }, { status: 400 });
    const company = await db.company.create({
      data: {
        name,
        nationalId: normalizeDigits(body.nationalId ?? ''),
        economicCode: normalizeDigits(body.economicCode ?? ''),
        ssoBranchCode: normalizeDigits(body.ssoBranchCode ?? ''),
        ssoWorkshopCode: normalizeDigits(body.ssoWorkshopCode ?? ''),
        ssoContractRow: normalizeDigits(body.ssoContractRow ?? ''),
        taxFileCode: normalizeDigits(body.taxFileCode ?? ''),
        postalCode: normalizeDigits(body.postalCode ?? ''),
        managerName: cleanText(body.managerName ?? ''),
        phone: normalizeDigits(body.phone ?? ''),
        address: cleanText(body.address ?? ''),
      },
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
