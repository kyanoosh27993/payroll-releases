// دانلود/چاپ فایل فرم چاپی — GET /api/print-forms/[id]/file
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const form = await db.printForm.findUnique({ where: { id: parseIntOr(id, 0) } });
    if (!form || !form.data) return NextResponse.json({ error: 'فرم یافت نشد' }, { status: 404 });
    const buf = Buffer.from(form.data, 'base64');
    const inline = form.mime.startsWith('image/') || form.mime === 'application/pdf';
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': form.mime,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(form.fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
