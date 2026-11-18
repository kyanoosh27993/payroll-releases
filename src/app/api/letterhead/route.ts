// سربرگ شرکت برای چاپ قرارداد و احکام — مورد ۱۲ نسخه ۱٫۴٫۳
// GET  /api/letterhead  → { dataUrl } (تصویر سربرگ بارگزاری‌شده یا پیش‌فرض برنامه)
// PUT  { dataUrl }      → ذخیره سربرگ جدید (data URL تصویر، حداکثر ~۳MB)
// DELETE                → بازگشت به سربرگ پیش‌فرض
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const LETTERHEAD_KEY = 'letterhead_image';
export const LETTERHEAD_DEFAULT = '/letterhead/letterhead-default.jpeg';

export async function GET() {
  try {
    const row = await db.appSetting.findUnique({ where: { key: LETTERHEAD_KEY } });
    return NextResponse.json({ dataUrl: row?.value || LETTERHEAD_DEFAULT, isDefault: !row?.value });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const body = await req.json();
    const dataUrl = String(body.dataUrl ?? '');
    if (!/^data:image\/(png|jpe?g);base64,/.test(dataUrl)) {
      return NextResponse.json({ error: 'فایل باید تصویر PNG یا JPG باشد' }, { status: 400 });
    }
    const base64 = dataUrl.split(',')[1] ?? '';
    if (base64.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم تصویر سربرگ نباید بیش از ۳ مگابایت باشد' }, { status: 413 });
    }
    await db.appSetting.upsert({
      where: { key: LETTERHEAD_KEY },
      update: { value: dataUrl },
      create: { key: LETTERHEAD_KEY, value: dataUrl },
    });
    await logAudit({ user: me, action: 'letterhead.update', entity: 'AppSetting', entityId: null, details: 'به‌روزرسانی سربرگ شرکت' });
    return NextResponse.json({ message: 'سربرگ شرکت ذخیره شد — از این پس در چاپ قرارداد و احکام استفاده می‌شود.' });
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
    await db.appSetting.deleteMany({ where: { key: LETTERHEAD_KEY } });
    await logAudit({ user: me, action: 'letterhead.reset', entity: 'AppSetting', entityId: null, details: 'بازگشت سربرگ به پیش‌فرض' });
    return NextResponse.json({ message: 'سربرگ به حالت پیش‌فرض برگشت.' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
