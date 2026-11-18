// API بینش هوشمند — ناهنجاری‌ها و پیش‌بینی آماری برای داشبورد و گزارش‌ها
import { NextRequest, NextResponse } from 'next/server';
import { computeInsights, DEFAULT_INSIGHT_PARAMS, type InsightParam } from '@/lib/ai/insights';
import { parseIntOr, parseNumberOr } from '@/lib/core/numbers';

export const dynamic = 'force-dynamic';

// کش سبک ۶۰ ثانیه‌ای — جلوگیری از محاسبه تکراری پرهزینه
let cache: { at: number; key: string; data: Awaited<ReturnType<typeof computeInsights>> } | null = null;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const fyId = parseIntOr(sp.get('fyId'), 0);
    const companyId = parseIntOr(sp.get('companyId'), 1);
    if (!fyId) return NextResponse.json({ error: 'fyId الزامی است' }, { status: 400 });
    // پارامترهای قابل تنظیم از کوئری (پیش‌فرض: DEFAULT_INSIGHT_PARAMS)
    const params: Partial<InsightParam> = {
      lateRateWarn: parseNumberOr(sp.get('lateRateWarn'), DEFAULT_INSIGHT_PARAMS.lateRateWarn),
      absenceDaysWarn: parseIntOr(sp.get('absenceDaysWarn'), DEFAULT_INSIGHT_PARAMS.absenceDaysWarn),
      overtimeSpikeRatio: parseNumberOr(sp.get('overtimeSpikeRatio'), DEFAULT_INSIGHT_PARAMS.overtimeSpikeRatio),
      missingMinutesWarn: parseIntOr(sp.get('missingMinutesWarn'), DEFAULT_INSIGHT_PARAMS.missingMinutesWarn),
      netDropRatio: parseNumberOr(sp.get('netDropRatio'), DEFAULT_INSIGHT_PARAMS.netDropRatio),
      maxInsights: parseIntOr(sp.get('maxInsights'), DEFAULT_INSIGHT_PARAMS.maxInsights),
    };
    const key = `${fyId}:${companyId}:${JSON.stringify(params)}`;
    if (cache && cache.key === key && Date.now() - cache.at < 60_000) {
      return NextResponse.json({ ...cache.data, cached: true });
    }
    const data = await computeInsights(fyId, companyId, params);
    cache = { at: Date.now(), key, data };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
