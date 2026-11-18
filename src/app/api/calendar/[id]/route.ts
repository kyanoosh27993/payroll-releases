// API تقویم — حذف رویداد (دستی یا محاسباتی)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const eventId = parseInt(id, 10);
    if (!eventId) return NextResponse.json({ error: 'شناسه نامعتبر است' }, { status: 400 });
    await db.calendarEvent.delete({ where: { id: eventId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
