// بازیابی معنایی سبک (TF-IDF + ایندکس معکوس) روی پایگاه دانش راهنما
import { GUIDE_TOPICS, type GuideTopic } from './guide';
import { normalizeFa, tokenizeFa, stemFa, nearMatch, looksLikeHowTo } from './persian';

export interface GuideHit { topic: GuideTopic; score: number; confidence: number; }

interface Doc { topic: GuideTopic; terms: Map<string, number>; norm: number; keys: string[]; }
interface Index { docs: Doc[]; idf: Map<string, number>; vocab: string[]; }

let INDEX: Index | null = null;

function buildIndex(): Index {
  const docs: Doc[] = [];
  const df = new Map<string, number>();
  for (const topic of GUIDE_TOPICS) {
    const weighted: Array<[string, number]> = [
      [(topic.keywords || []).join(' '), 3],
      [topic.section || '', 2],
      [topic.summary || '', 1],
      [(topic.steps || []).join(' '), 1],
    ];
    const tf = new Map<string, number>();
    for (const [text, weight] of weighted) {
      for (const tok of tokenizeFa(text)) {
        const s = stemFa(tok);
        tf.set(s, (tf.get(s) || 0) + weight);
      }
    }
    for (const [k, v] of tf) tf.set(k, 1 + Math.log(v));
    for (const k of tf.keys()) df.set(k, (df.get(k) || 0) + 1);
    docs.push({ topic, terms: tf, norm: 1, keys: (topic.keywords || []).map((k) => normalizeFa(k)).filter((k) => k.length >= 3) });
  }
  const N = docs.length || 1;
  const idf = new Map<string, number>();
  for (const [k, d] of df) idf.set(k, Math.log(1 + N / d));
  for (const doc of docs) {
    let sum = 0;
    for (const [k, v] of doc.terms) { const w = v * (idf.get(k) || 0); sum += w * w; }
    doc.norm = Math.sqrt(sum) || 1;
  }
  INDEX = { docs, idf, vocab: [...idf.keys()] };
  return INDEX;
}

export function searchGuide(query: string, k = 3): GuideHit[] {
  const idx = INDEX ?? buildIndex();
  const qn = normalizeFa(query);
  const tokens = tokenizeFa(qn).map(stemFa);
  if (!tokens.length) return [];
  const qtf = new Map<string, number>();
  for (const t of tokens) qtf.set(t, (qtf.get(t) || 0) + 1);
  for (const t of [...qtf.keys()]) {
    if (idx.idf.has(t)) continue;
    const near = nearMatch(t, idx.vocab);
    if (near) qtf.set(near, (qtf.get(near) || 0) + 0.6);
  }
  const qw = new Map<string, number>();
  let qnorm = 0;
  const fallbackIdf = Math.log(1 + (idx.docs.length || 1));
  for (const [t, c] of qtf) {
    const w = (1 + Math.log(c)) * (idx.idf.get(t) ?? fallbackIdf);
    qw.set(t, w); qnorm += w * w;
  }
  qnorm = Math.sqrt(qnorm) || 1;
  const scored = idx.docs.map((doc) => {
    let dot = 0;
    for (const [t, w] of qw) { const dv = doc.terms.get(t); if (dv) dot += w * dv * (idx.idf.get(t) || 0); }
    let score = dot / (qnorm * doc.norm);
    let bonus = 0;
    for (const key of doc.keys) { if (qn.includes(key)) bonus = Math.max(bonus, key.length >= 8 ? 0.55 : 0.4); }
    return { topic: doc.topic, score: score + bonus };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(1, k));
  const first = top[0], second = top[1];
  const margin = second && first.score > 0 ? (first.score - second.score) / first.score : 1;
  return top.filter((h) => h.score > 0.02).map((h, i) => ({
    topic: h.topic, score: h.score,
    confidence: i === 0 ? Math.max(0, Math.min(1, h.score * 1.1 + margin * 0.15)) : Math.max(0, Math.min(1, h.score * 1.1)),
  }));
}

export function matchGuideTopic(query: string, ..._rest: unknown[]): GuideTopic | null {
  const hits = searchGuide(query, 2);
  return hits.length > 0 && hits[0].score >= 0.18 ? hits[0].topic : null;
}

export function isGuideIntent(query: string, ..._rest: unknown[]): boolean {
  if (looksLikeHowTo(query)) return true;
  const hits = searchGuide(query, 1);
  return hits.length > 0 && hits[0].score >= 0.30;
}

export function guideAnswerText(topic: GuideTopic, ..._rest: unknown[]): string {
  const lines: string[] = [];
  if (topic.summary) lines.push(topic.summary.trim());
  const steps = topic.steps || [];
  if (steps.length) { lines.push(''); lines.push('مراحل انجام کار:'); steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`)); }
  if (topic.section) { lines.push(''); lines.push(`📚 منبع: بخش «${topic.section}» راهنمای برنامه`); }
  return lines.join('\n');
}

export function lowConfidenceAnswer(query: string): string | null {
  const hits = searchGuide(query, 3);
  if (!hits.length || hits[0].confidence >= 0.45) return null;
  const names = hits.map((h) => `«${h.topic.section}»`).join('، ');
  return `دقیق متوجه منظورت نشدم. نزدیک‌ترین بخش‌های راهنما: ${names}. اگر یکی از این‌ها را می‌خواهی، نام بخش را بگو.`;
}
