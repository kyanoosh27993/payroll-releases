// پرینت فرم‌های ضروری — گزاره ۷ نسخه ۱٫۲٫۰
// GET  /api/print-forms            → فهرست فرم‌ها (بدون داده)
// POST { title, description, fileName, dataBase64 } → آپلود فرم جدید (Word/PDF/Excel/عکس)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { cleanText, parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 8 * 1024 * 1024; // ۸ مگابایت

const ALLOWED_MIME: Record<string, string> = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

export async function GET(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator', 'viewer')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const forms = await db.printForm.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, description: true, fileName: true, mime: true, size: true, createdAt: true },
    });
    return NextResponse.json({ forms });
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
    const title = cleanText(body.title ?? '');
    const fileName = cleanText(body.fileName ?? '');
    const dataBase64 = String(body.dataBase64 ?? '');
    if (!title) return NextResponse.json({ error: 'عنوان فرم الزامی است' }, { status: 400 });
    if (!fileName || !dataBase64) return NextResponse.json({ error: 'فایل فرم الزامی است' }, { status: 400 });
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mime = ALLOWED_MIME[ext];
    if (!mime) return NextResponse.json({ error: `فرمت .${ext} پشتیبانی نمی‌شود — Word، PDF، Excel یا عکس` }, { status: 400 });
    const size = Math.round(dataBase64.length * 0.75);
    if (size > MAX_SIZE) return NextResponse.json({ error: 'حجم فایل بیش از ۸ مگابایت است' }, { status: 400 });
    const form = await db.printForm.create({
      data: { title, description: cleanText(body.description ?? ''), fileName, mime, size, data: dataBase64 },
    });
    await logAudit({
      user: me, action: 'آپلود فرم چاپی', entity: 'print-form', entityId: form.id,
      details: `${title} (${fileName})`,
    });
    return NextResponse.json({ form: { id: form.id, title, description: form.description, fileName, mime, size, createdAt: form.createdAt } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const id = parseIntOr(req.nextUrl.searchParams.get('id'), 0);
    if (!id) return NextResponse.json({ error: 'id الزامی است' }, { status: 400 });
    const form = await db.printForm.findUnique({ where: { id } });
    if (!form) return NextResponse.json({ error: 'فرم یافت نشد' }, { status: 404 });
    await db.printForm.delete({ where: { id } });
    await logAudit({ user: me, action: 'حذف فرم چاپی', entity: 'print-form', entityId: id, details: form.title });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
