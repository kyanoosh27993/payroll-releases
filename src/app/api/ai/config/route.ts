import { userFromHeaders, hasRole } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { ollamaStatus, readAiConfig, writeAiConfig } from '@/lib/ai/ollama';
import { ramInfo, recommendedModel } from '@/lib/ai/ai-guard';
import os from 'node:os';

export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  const role = (req.headers.get('x-user-role') || '').toLowerCase();
  return role === 'admin';
}

export async function GET() {
  const status = await ollamaStatus();
  const cfg = readAiConfig();
  return NextResponse.json({ ...status, timeoutMs: cfg.timeoutMs, numCtx: cfg.numCtx, numPredict: cfg.numPredict, temperature: cfg.temperature, topP: cfg.topP, minSourceConfidence: cfg.minSourceConfidence, ram: ramInfo(), recommended: recommendedModel(os.totalmem()) });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'فقط مدیر می‌تواند تنظیمات هوش مصنوعی را تغییر دهد.' }, { status: 403 });
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = {}; }
  const next = writeAiConfig({
    enabled: body.enabled as boolean | undefined,
    model: body.model as string | undefined,
    timeoutMs: body.timeoutMs as number | undefined,
    numCtx: body.numCtx as number | undefined,
    numPredict: body.numPredict as number | undefined,
    temperature: body.temperature as number | undefined,
    topP: body.topP as number | undefined,
    minSourceConfidence: body.minSourceConfidence as number | undefined,
  });
  const status = await ollamaStatus();
  return NextResponse.json({ config: next, status });
}
