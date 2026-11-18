import { NextRequest, NextResponse } from 'next/server';
import { runLocalEngine } from '@/lib/ai/local-engine';
import { askOllama, readAiConfig } from '@/lib/ai/ollama';
import { searchGuide } from '@/lib/ai/retrieval';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: 'متن پرسش خالی است' }, { status: 400 });
    const companyId = Number(body.companyId) || 1;
    const fyId = Number(body.fyId) || null;

    const local = await runLocalEngine(companyId, fyId, message);
    let answer = local.answer;
    let engine: 'local' | 'hybrid' = 'local';

    if (local.context) {
      const llm = await askOllama(message, local.context);
      if (llm && llm.trim().length > 0) { answer = llm.trim(); engine = 'hybrid'; }
    }

    const hits = searchGuide(message, 2);
    const cfg = readAiConfig();
    const sources = hits.filter((h) => h.confidence >= (cfg.minSourceConfidence ?? 0.25)).map((h) => ({ id: h.topic.id, section: h.topic.section, module: h.topic.module, confidence: Number(h.confidence.toFixed(2)) }));
    const { context: _context, ...rest } = local;

    return NextResponse.json({ ...rest, answer, engine, mode: engine === 'hybrid' ? 'model' : 'fast', llmEnabled: cfg.enabled, sources, confidence: sources.length ? sources[0].confidence : local.matched ? 0.9 : 0.3 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
