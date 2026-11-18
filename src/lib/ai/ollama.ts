import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateModel, recommendedModel, ramInfo } from './ai-guard';

const BASE_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const CONFIG_PATH = process.env.PAYROLL_AI_CONFIG || path.join(os.homedir(), '.payroll-ai.json');
const NEGATIVE_CACHE_MS = 60_000;

export interface AiConfig {
  enabled: boolean; model: string; timeoutMs: number; numCtx: number; numPredict: number;
  /** دمای مدل — هرچه کمتر، پاسخ دقیق‌تر و کم‌خلاق‌تر (پیش‌فرض ۰.۲ برای داده مالی) */
  temperature: number;
  /** nucleus sampling — پیش‌فرض ۰.۹ */
  topP: number;
  /** حداقل سطح اطمینان منابع راهنما برای نمایش (۰ تا ۱) */
  minSourceConfidence: number;
}
const DEFAULT_CONFIG: AiConfig = { enabled: false, model: '', timeoutMs: 12_000, numCtx: 1024, numPredict: 220, temperature: 0.2, topP: 0.9, minSourceConfidence: 0.25 };
let cached: { at: number; value: AiConfig } | null = null;
let negativeUntil = 0;

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n); return !Number.isFinite(v) ? fallback : Math.min(max, Math.max(min, v));
}

export function readAiConfig(): AiConfig {
  if (cached && Date.now() - cached.at < 10_000) return cached.value;
  let cfg: AiConfig = { ...DEFAULT_CONFIG };
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    cfg = {
      enabled: parsed.enabled === true,
      model: typeof parsed.model === 'string' ? parsed.model.trim() : '',
      timeoutMs: clamp(parsed.timeoutMs, 2000, 60_000, DEFAULT_CONFIG.timeoutMs),
      numCtx: clamp(parsed.numCtx, 512, 4096, DEFAULT_CONFIG.numCtx),
      numPredict: clamp(parsed.numPredict, 64, 1024, DEFAULT_CONFIG.numPredict),
      temperature: clamp(parsed.temperature, 0, 1, DEFAULT_CONFIG.temperature),
      topP: clamp(parsed.topP, 0.1, 1, DEFAULT_CONFIG.topP),
      minSourceConfidence: clamp(parsed.minSourceConfidence, 0, 1, DEFAULT_CONFIG.minSourceConfidence),
    };
  } catch {}
  if (!cfg.model) cfg.model = recommendedModel(os.totalmem()) || 'qwen2.5:0.5b-instruct-q4_K_M';
  cached = { at: Date.now(), value: cfg };
  return cfg;
}

export function writeAiConfig(patch: Partial<AiConfig>): AiConfig {
  const current = readAiConfig();
  const next: AiConfig = {
    enabled: patch.enabled === undefined ? current.enabled : patch.enabled === true,
    model: typeof patch.model === 'string' && patch.model.trim() ? patch.model.trim() : current.model,
    timeoutMs: clamp(patch.timeoutMs, 2000, 60_000, current.timeoutMs),
    numCtx: clamp(patch.numCtx, 512, 4096, current.numCtx),
    numPredict: clamp(patch.numPredict, 64, 1024, current.numPredict),
    temperature: clamp(patch.temperature, 0, 1, current.temperature),
    topP: clamp(patch.topP, 0.1, 1, current.topP),
    minSourceConfidence: clamp(patch.minSourceConfidence, 0, 1, current.minSourceConfidence),
  };
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8'); } catch {}
  cached = { at: Date.now(), value: next };
  negativeUntil = 0;
  return next;
}

export async function getAiModel(): Promise<string> { return readAiConfig().model; }

export interface AiStatus { enabled: boolean; model: string; reachable: boolean; allowed: boolean; reason: string; recommended: string | null; ram: ReturnType<typeof ramInfo>; mode: 'fast' | 'model'; }

async function probe(timeoutMs = 1500): Promise<boolean> {
  if (Date.now() < negativeUntil) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) throw new Error('bad status');
    return true;
  } catch { negativeUntil = Date.now() + NEGATIVE_CACHE_MS; return false; }
  finally { clearTimeout(timer); }
}

export async function ollamaStatus(): Promise<AiStatus> {
  const cfg = readAiConfig();
  const decision = evaluateModel(cfg.model);
  const recommended = recommendedModel(os.totalmem());
  let reachable = false;
  if (cfg.enabled && decision.allowed) reachable = await probe();
  return { enabled: cfg.enabled, model: cfg.model, reachable, allowed: decision.allowed, reason: decision.reason, recommended, ram: decision.ram, mode: cfg.enabled && decision.allowed && reachable ? 'model' : 'fast' };
}

const SYSTEM_PROMPT = ['تو دستیار فارسی یک سامانهٔ حقوق و دستمزد هستی.', 'فقط بر پایهٔ «دادهٔ زمینه» پاسخ بده و هیچ عدد یا واقعیتی از خودت نساز.', 'اگر دادهٔ زمینه کافی نبود، صادقانه بگو اطلاعات کافی نیست.', 'پاسخ کوتاه، دقیق و کاملاً فارسی باشد؛ اعداد را تغییر نده.'].join('\n');

export async function askOllama(question: string, context: string): Promise<string | null> {
  const cfg = readAiConfig();
  if (!cfg.enabled) return null;
  const decision = evaluateModel(cfg.model);
  if (!decision.allowed) return null;
  if (!(await probe())) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({
        model: cfg.model, system: SYSTEM_PROMPT,
        prompt: `دادهٔ زمینه:\n${(context || '').slice(0, 3000)}\n\nپرسش کاربر: ${question}\n\nپاسخ:`,
        stream: false, keep_alive: 0,
        options: { num_ctx: cfg.numCtx, num_predict: cfg.numPredict, temperature: cfg.temperature, top_p: cfg.topP, repeat_penalty: 1.05 },
      }),
    });
    if (!res.ok) throw new Error('bad status');
    const data = (await res.json()) as { response?: string };
    const text = String(data?.response ?? '').trim();
    return text.length > 0 ? text : null;
  } catch { negativeUntil = Date.now() + NEGATIVE_CACHE_MS; return null; }
  finally { clearTimeout(timer); }
}
