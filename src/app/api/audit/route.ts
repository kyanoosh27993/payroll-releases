import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** فهرست لاگ تغییرات — فقط admin (سوپروایزر هم می‌بیند) */
export async function GET(req: NextRequest) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin')) return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 500), 2000);
  const search = (req.nextUrl.searchParams.get('q') || '').trim();
  const rows = await db.auditLog.findMany({
    where: search
      ? {
          OR: [
            { username: { contains: search } },
            { action: { contains: search } },
            { entity: { contains: search } },
            { details: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { id: 'desc' },
    take: limit,
  });
  return NextResponse.json({ logs: rows });
}
