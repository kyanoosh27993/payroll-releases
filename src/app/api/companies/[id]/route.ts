import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { appRoot } from '@/lib/app-root';
import { normalizeDigits, cleanText } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const cid = parseInt(id, 10);
    if (!Number.isFinite(cid)) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 });
    const existing = await db.company.findUnique({ where: { id: cid } });
    if (!existing) return NextResponse.json({ error: 'شرکت یافت نشد' }, { status: 404 });
    const body = await req.json();
    const name = cleanText(body.name) || existing.name;
    // آپلود لوگو: base64 → ذخیره در public/logos/<companyId>.<ext>
    let logoPath = existing.logoPath;
    if (typeof body.logoBase64 === 'string' && body.logoBase64.startsWith('data:image/')) {
      const m = body.logoBase64.match(/^data:image\/(png|jpeg|jpg);base64,([\s\S]+)$/);
      if (!m) return NextResponse.json({ error: 'فرمت تصویر باید PNG یا JPG باشد' }, { status: 400 });
      const ext = m[1] === 'jpg' ? 'jpg' : m[1];
      const dir = path.join(appRoot(), 'public', 'logos');
      await fs.mkdir(dir, { recursive: true });
      // حذف لوگوهای قبلی
      for (const oldExt of ['png', 'jpg', 'jpeg']) {
        try { await fs.unlink(path.join(dir, `${cid}.${oldExt}`)); } catch { /* بی‌اهمیت */ }
      }
      await fs.writeFile(path.join(dir, `${cid}.${ext}`), Buffer.from(m[2], 'base64'));
      logoPath = `/logos/${cid}.${ext}?v=${Date.now()}`;
    }
    const company = await db.company.update({
      where: { id: cid },
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
        logoPath,
      },
    });
    return NextResponse.json({ company });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const cid = parseInt(id, 10);
    if (!Number.isFinite(cid)) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 });
    const company = await db.company.findUnique({
      where: { id: cid },
      include: { fiscalYears: { select: { id: true } } },
    });
    if (!company) return NextResponse.json({ error: 'شرکت یافت نشد' }, { status: 404 });
    if (company.fiscalYears.length > 0) {
      return NextResponse.json(
        { error: 'این شرکت دارای سال مالی است و حذف آن امکان‌پذیر نیست. ابتدا سال‌های مالی آن را حذف کنید.' },
        { status: 400 },
      );
    }
    await db.company.delete({ where: { id: cid } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
