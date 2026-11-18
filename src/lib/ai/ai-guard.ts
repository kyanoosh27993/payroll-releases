import os from 'node:os';
export type RamTier = 'low' | 'mid' | 'high';
export interface RamInfo { totalBytes: number; freeBytes: number; totalGB: number; freeGB: number; tier: RamTier; }
const GB = 1024 * 1024 * 1024;
export function ramInfo(): RamInfo {
  const totalBytes = os.totalmem(), freeBytes = os.freemem();
  const totalGB = totalBytes / GB;
  return { totalBytes, freeBytes, totalGB: Number(totalGB.toFixed(2)), freeGB: Number((freeBytes / GB).toFixed(2)), tier: totalGB < 6 ? 'low' : totalGB < 12 ? 'mid' : 'high' };
}
const MODEL_REQUIREMENTS: Array<[RegExp, number]> = [
  [/0\.5b|0_5b|500m/i, 0.9], [/1\.5b|1_5b|(^|[^0-9])1b/i, 1.8], [/2b|3b/i, 3.0], [/7b|8b/i, 6.5], [/13b|14b/i, 10], [/27b|32b|70b/i, 24],
];
export function requiredFreeGB(model: string): number {
  for (const [re, gb] of MODEL_REQUIREMENTS) if (re.test(model)) return gb;
  return 6.5;
}
export function recommendedModel(totalBytes: number): string | null {
  const gb = totalBytes / GB;
  if (gb < 6) return null;
  if (gb < 12) return 'qwen2.5:0.5b-instruct-q4_K_M';
  return 'qwen2.5:1.5b-instruct-q4_K_M';
}
export interface GuardDecision { allowed: boolean; reason: string; ram: RamInfo; needGB: number; }
export function evaluateModel(model: string): GuardDecision {
  const ram = ramInfo();
  const needGB = requiredFreeGB(model);
  if (ram.tier === 'low') return { allowed: false, reason: `رم کل سیستم ${ram.totalGB} گیگابایت است؛ روی سیستم‌های زیر ۶ گیگابایت فقط موتور سریع آفلاین فعال می‌شود.`, ram, needGB };
  if (ram.freeGB < needGB) return { allowed: false, reason: `رم آزاد ${ram.freeGB} گیگابایت است ولی این مدل حداقل ${needGB} گیگابایت می‌خواهد.`, ram, needGB };
  return { allowed: true, reason: 'رم کافی است.', ram, needGB };
}
