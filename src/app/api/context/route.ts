import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSeeded } from '@/lib/core/seed';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSeeded();
    const [companies, fiscalYears] = await Promise.all([
      db.company.findMany({ orderBy: { id: 'asc' } }),
      db.fiscalYear.findMany({ orderBy: { jy: 'desc' } }),
    ]);
    return NextResponse.json({
      companies,
      fiscalYears,
      activeCompanyId: companies[0]?.id ?? null,
      activeFyId: fiscalYears[0]?.id ?? null,
      version: '1.4.7',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
