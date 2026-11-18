// نرمال‌سازی و توکن‌سازی زبان فارسی برای دستیار آفلاین
// بدون هیچ وابستگی خارجی — سبک و سریع

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeFa(input: string): string {
  let s = String(input ?? '');
  s = s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  s = s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
  s = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ؤ/g, 'و');
  s = s.replace(/[\u064B-\u0652\u0670]/g, '');
  s = s.replace(/\u0640/g, '');
  s = s.replace(/[\u200c\u200d\u200e\u200f]/g, ' ');
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

const STOPWORDS = new Set([
  'از', 'به', 'با', 'در', 'را', 'که', 'چی', 'چه', 'چطور', 'چگونه', 'است', 'هست', 'بود',
  'می', 'نمی', 'شود', 'شد', 'کرد', 'کن', 'کنم', 'کنید', 'بگو', 'بگویید', 'لطفا', 'یک', 'یه',
  'و', 'یا', 'برای', 'من', 'ما', 'شما', 'او', 'ان', 'این', 'هم', 'تا', 'اگر', 'روی', 'زیر',
  'پس', 'قبل', 'بعد', 'چند', 'چقدر', 'کجا', 'کی', 'ایا', 'ها', 'های', 'هر', 'همه', 'هیچ',
  'باید', 'شاید', 'طور', 'جور', 'ভাবে', 'please', 'the', 'a', 'an', 'is', 'how', 'what',
]);

export function tokenizeFa(input: string): string[] {
  const s = normalizeFa(input);
  if (!s) return [];
  return s.split(' ').filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function stemFa(token: string): string {
  let t = token;
  if (t.length <= 4) return t;
  const suffixes = ['ترین', 'های', 'ها', 'ات', 'ام', 'اش', 'مان', 'تان', 'شان', 'تر', 'ی'];
  for (const suf of suffixes) {
    if (t.length > suf.length + 3 && t.endsWith(suf)) {
      t = t.slice(0, -suf.length);
      break;
    }
  }
  if (t.startsWith('نمی') && t.length > 6) t = t.slice(3);
  else if (t.startsWith('می') && t.length > 5) t = t.slice(2);
  return t;
}

export function withinEditDistance(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;
  const la = a.length, lb = b.length;
  if (!la || !lb) return Math.max(la, lb) <= max;
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return false;
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[lb] <= max;
}

export function nearMatch(token: string, vocab: string[]): string | null {
  if (token.length < 4) return null;
  const max = token.length >= 7 ? 2 : 1;
  let best: string | null = null;
  let bestLen = Infinity;
  for (const w of vocab) {
    if (Math.abs(w.length - token.length) > max) continue;
    if (w.length < 4) continue;
    if (withinEditDistance(token, w, max)) {
      const d = Math.abs(w.length - token.length);
      if (d < bestLen) { best = w; bestLen = d; if (d === 0) break; }
    }
  }
  return best;
}

export function looksLikeHowTo(raw: string): boolean {
  const s = normalizeFa(raw);
  return /(چطور|چگونه|چجوری|راهنما|اموزش|مراحل|یاد|بلد|کجا|از کجا|چیکار|چه کار|روش|نحوه|how to|where)/.test(s);
}
