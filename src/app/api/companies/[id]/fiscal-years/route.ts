import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { createFiscalYear } from '@/lib/core/seed';
import { parseIntOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const cid = parseInt(id, 10);
    if (!Number.isFinite(cid)) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 });
    const fiscalYears = await db.fiscalYear.findMany({
      where: { companyId: cid },
      orderBy: { jy: 'desc' },
    });
    return NextResponse.json({ fiscalYears });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = userFromHeaders(req);
    if (!hasRole(me, 'admin', 'operator')) {
      return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
    }
    const { id } = await ctx.params;
    const cid = parseInt(id, 10);
    if (!Number.isFinite(cid)) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 });
    const company = await db.company.findUnique({ where: { id: cid } });
    if (!company) return NextResponse.json({ error: 'شرکت یافت نشد' }, { status: 404 });
    const body = await req.json();
    const jy = parseIntOr(body.jy, 0);
    if (jy < 1400 || jy > 1500) {
      return NextResponse.json({ error: 'سال مالی باید بین ۱۴۰۰ تا ۱۵۰۰ باشد' }, { status: 400 });
    }
    const fy = await createFiscalYear(cid, jy);

    // مورد ۱۳ (۱.۴.۴) — انتقال اختیاری داده‌ها از آخرین سال مالی قبلِ همان شرکت، فقط با تائید صریح کاربر
    const carried: string[] = [];
    if (body.carryFromPrevious === true) {
      const prev = await db.fiscalYear.findFirst({
        where: { companyId: cid, jy: { lt: jy } },
        orderBy: { jy: 'desc' },
      });
      if (prev) {
        // ۱) تنظیمات سال مالی: پارامترهای حقوق، اقلام فیش، جدول ساعات موظفی، گروه‌ها و…
        const prevSettings = await db.fySetting.findMany({ where: { fiscalYearId: prev.id } });
        for (const s of prevSettings) {
          await db.fySetting.upsert({
            where: { fiscalYearId_key: { fiscalYearId: fy.id, key: s.key } },
            create: { fiscalYearId: fy.id, key: s.key, value: s.value },
            update: { value: s.value },
          });
        }
        carried.push('settings');

        // ۲) پله‌های مالیاتی
        const prevBrackets = await db.taxBracket.findMany({
          where: { fiscalYearId: prev.id },
          orderBy: { seq: 'asc' },
        });
        if (prevBrackets.length) {
          await db.taxBracket.deleteMany({ where: { fiscalYearId: fy.id } });
          await db.taxBracket.createMany({
            data: prevBrackets.map((b) => ({
              fiscalYearId: fy.id,
              seq: b.seq,
              fromAmount: b.fromAmount,
              toAmount: b.toAmount,
              ratePercent: b.ratePercent,
            })),
          });
          carried.push('tax-brackets');
        }

        // ۳) دوره‌های ۱۲گانه حقوق — فقط ماه‌هایی که هنوز وجود ندارند (SQLite از skipDuplicates پشتیبانی نمی‌کند)
        const existingMonths = await db.payrollPeriod.findMany({
          where: { fiscalYearId: fy.id, jy },
          select: { jm: true },
        });
        const existing = new Set(existingMonths.map((p) => p.jm));
        const missing = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !existing.has(m));
        if (missing.length) {
          await db.payrollPeriod.createMany({
            data: missing.map((m) => ({
              fiscalYearId: fy.id,
              jy,
              jm: m,
              status: 'پیش‌نویس',
            })),
          });
        }
        carried.push('periods');
      }
    }

    return NextResponse.json({ fiscalYear: fy, carried }, { status: 201 });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'این سال مالی قبلاً برای این شرکت ثبت شده است' }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
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
    const fyId = parseIntOr(req.nextUrl.searchParams.get('fyId'), 0);
    if (!Number.isFinite(cid) || !fyId) return NextResponse.json({ error: 'شناسه نامعتبر' }, { status: 400 });
    const fy = await db.fiscalYear.findFirst({ where: { id: fyId, companyId: cid } });
    if (!fy) return NextResponse.json({ error: 'سال مالی یافت نشد' }, { status: 404 });
    await db.fiscalYear.delete({ where: { id: fyId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
