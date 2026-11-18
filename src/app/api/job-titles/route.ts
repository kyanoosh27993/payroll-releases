// عناوین شغلی بیمه تامین اجتماعی — GET: فهرست ترکیبی (داخلی + به‌روزرسانی‌شده)
// POST: دانلود خودکار جدول مشاغل ۱۴۰۵ از سایت تامین اجتماعی
// اگر ارتباط اینترنت قطع باشد یا صفحه قابل پردازش نباشد، پیغام خطا + راهنمای رفع مشکل برمی‌گردد.
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFromHeaders, hasRole } from '@/lib/auth';
import { JOB_TITLES } from '@/lib/core/job-titles';

export const dynamic = 'force-dynamic';

const CUSTOM_KEY = 'job_titles_custom';
const TAMIN_URL =
  'https://www.tamin.ir/news/item/22556/%D8%AC%D8%AF%D9%88%D9%84-%D9%85%D8%B4%D8%A7%D8%BA%D9%84-%D8%B3%D8%A7%D9%84-1405';

export interface JobTitleRow { title: string; code: string; source?: string }

async function readCustomTitles(): Promise<JobTitleRow[]> {
  const s = await db.appSetting.findUnique({ where: { key: CUSTOM_KEY } });
  if (!s) return [];
  try {
    const v = JSON.parse(s.value);
    if (Array.isArray(v)) {
      return v
        .filter((x) => x && typeof x.title === 'string')
        .map((x) => ({ title: String(x.title).trim(), code: String(x.code ?? '').trim() }))
        .filter((x) => x.title.length >= 2 && x.code.length >= 1);
    }
  } catch { /* ignore */ }
  return [];
}

/** GET — فهرست ترکیبی: فهرست به‌روزرسانی‌شده (در صورت وجود) + فهرست داخلی برنامه */
export async function GET() {
  try {
    const custom = await readCustomTitles();
    const seen = new Set<string>();
    const titles: JobTitleRow[] = [];
    for (const t of custom) {
      if (!t.title) continue;
      const k = t.title.replace(/\s+/g, ' ');
      if (seen.has(k)) continue;
      seen.add(k);
      titles.push({ ...t, source: 'custom' });
    }
    for (const t of JOB_TITLES) {
      const k = t.title.replace(/\s+/g, ' ');
      if (seen.has(k)) continue;
      seen.add(k);
      titles.push({ ...t, code: String(t.code), source: 'builtin' });
    }
    return NextResponse.json({ titles, customCount: custom.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─── پردازش صفحه تامین اجتماعی ──────────────────────────────────────
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|p|div|li|h[1-6])>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

/** استخراج عنوان شغل + کد شغل از متن خام صفحه — کد شغل بیمه معمولا ۳ تا ۴ رقمی است */
export function parseJobTitles(html: string): Array<{ title: string; code: number }> {
  const text = stripTags(html);
  const out = new Map<string, number>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\u200c/g, ' ').replace(/[ \t]+/g, ' ').trim();
    if (!line) continue;
    const matches = [...line.matchAll(/(?<!\d)(\d{3,4})(?!\d)/g)];
    if (!matches.length) continue;
    const title = line
      .replace(/\d+/g, ' ')
      .replace(/[()|،,\-–:./\\]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const faLetters = (title.match(/[\u0600-\u06FF]/g) || []).length;
    if (faLetters < 3) continue;
    if (title.length < 3 || title.length > 60) continue;
    for (const m of matches) {
      const code = Number(m[1]);
      if (code >= 100 && code <= 9999) {
        out.set(title.replace(/\s+/g, ' '), code);
        break;
      }
    }
  }
  return Array.from(out.entries()).map(([title, code]) => ({ title, code }));
}

/** استخراج ردیف‌های (عنوان شغل، کد شغل) از فایل بارگزاری‌شده کاربر — xlsx/xls/csv/md/txt
 *  کد شغل تامین اجتماعی ممکن است حرف‌وعددی باشد (2035AG، OA2675 و ...) */
function parseJobRowsFromText(text: string): Array<{ title: string; code: string }> {
  const out = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\u200c/g, ' ').trim();
    if (!line || /^(ردیف|HEAD|لیست عناوین)/i.test(line)) continue;
    const cells = line.split(/\t|\s*[|،;]\s*/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    // کد = اولین سلول حاوی الگوی کد (عدد خالص یا حرف‌وعددی مثل 2035AG / OA2675)
    const codeCell = cells.find((c) => /^[A-Za-z]{0,3}\d{2,8}[A-Za-z]{0,3}$/.test(c) && /[\d]/.test(c));
    const titleCell = cells.find((c) => (c.match(/[\u0600-\u06FF]/g) || []).length >= 3 && !/^[A-Za-z]/.test(c));
    if (!codeCell || !titleCell) continue;
    const title = titleCell.replace(/\s+/g, ' ').slice(0, 80);
    out.set(title, codeCell);
  }
  return Array.from(out.entries()).map(([title, code]) => ({ title, code }));
}

/** DELETE — حذف فهرست بارگزاری‌شده و بازگشت به فهرست داخلی برنامه */
export async function DELETE(req: NextRequest) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin', 'operator')) {
    return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  }
  await db.appSetting.deleteMany({ where: { key: CUSTOM_KEY } });
  return NextResponse.json({ message: 'فهرست بارگزاری‌شده حذف شد — فهرست داخلی برنامه ملاک است.' });
}

/** PUT — بارگزاری دستی فایل جدول مشاغل (xlsx/xls/csv/md/txt) و جایگزینی کامل بدون اخلال (مورد ۴ و ۹ نسخه ۱٫۴٫۳) */
export async function PUT(req: NextRequest) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin', 'operator')) {
    return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  }
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'فایلی ارسال نشده است' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم فایل جدول مشاغل نباید بیش از ۱۰ مگابایت باشد' }, { status: 413 });
    }
    const name = file.name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    let rows: Array<{ title: string; code: string }> = [];
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const lines: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const arr = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
        for (const row of arr) {
          const cells = (row as unknown[]).map((c) => String(c ?? '').trim());
          if (cells.length >= 2) lines.push(cells.join('\t'));
        }
      }
      rows = parseJobRowsFromText(lines.join('\n'));
    } else if (name.endsWith('.csv') || name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.tsv')) {
      rows = parseJobRowsFromText(buf.toString('utf8'));
    } else {
      return NextResponse.json({ error: 'فرمت فایل پشتیبانی نمی‌شود — از xlsx، xls، csv، md یا txt استفاده کنید' }, { status: 415 });
    }
    // حذف تکراری و نامعتبر
    const seen = new Set<string>();
    const clean = rows.filter((r) => {
      if (!r.title || !r.code) return false;
      const k = r.title.replace(/\s+/g, ' ');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (clean.length < 5) {
      return NextResponse.json(
        { error: `فایل خوانده شد اما فقط ${clean.length} ردیف معتبر (عنوان شغلی + کد) پیدا شد. ستون‌های فایل باید شامل عنوان شغل و کد شغل باشند.` },
        { status: 422 },
      );
    }
    await db.appSetting.upsert({
      where: { key: CUSTOM_KEY },
      update: { value: JSON.stringify(clean) },
      create: { key: CUSTOM_KEY, value: JSON.stringify(clean) },
    });
    return NextResponse.json({
      saved: clean.length,
      message: `جدول مشاغل با موفقیت از فایل بارگزاری و جایگزین شد (${clean.length} عنوان شغلی).`,
    });
  } catch (e) {
    return NextResponse.json({ error: 'پردازش فایل ناموفق بود: ' + String(e) }, { status: 500 });
  }
}

/** POST — دانلود جدول مشاغل از سایت تامین اجتماعی و ذخیره در برنامه */
export async function POST(req: NextRequest) {
  const me = userFromHeaders(req);
  if (!hasRole(me, 'admin', 'operator')) {
    return NextResponse.json({ error: 'دسترسی مجاز نیست' }, { status: 403 });
  }
  let html = '';
  try {
    const res = await fetch(TAMIN_URL, {
      signal: AbortSignal.timeout(25_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PayrollApp/1.4',
        'Accept-Language': 'fa,en;q=0.8',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            `دریافت صفحه تامین اجتماعی ناموفق بود (کد وضعیت ${res.status}). ` +
            'راه‌های رفع: ۱) اتصال اینترنت را بررسی کنید ۲) اگر سایت تامین اجتماعی قطع یا فیلتر است از VPN استفاده کنید یا بعدا تلاش کنید ' +
            '۳) تا آن زمان می‌توانید از فهرست داخلی برنامه برای انتخاب عنوان شغل استفاده کنید.',
        },
        { status: 502 },
      );
    }
    html = await res.text();
  } catch (e) {
    const err = e as Error;
    const msg = err.name === 'TimeoutError' || err.message.includes('timeout')
      ? 'زمان انتظار برای پاسخ سایت تامین اجتماعی به پایان رسید (Timeout).'
      : 'ارتباط با سایت تامین اجتماعی برقرار نشد.';
    return NextResponse.json(
      {
        error:
          `${msg} راه‌های رفع: ۱) اتصال اینترنت دستگاه را بررسی کنید ۲) در صورت فیلتر یا اختلال سایت تامین اجتماعی از VPN استفاده کنید ` +
          '۳) به فایروال یا آنتی‌ویروس اجازه دسترسی به tamin.ir را بدهید ۴) تا آن زمان از فهرست داخلی برنامه استفاده کنید.',
      },
      { status: 502 },
    );
  }
  const parsed = parseJobTitles(html);
  if (parsed.length < 10) {
    return NextResponse.json(
      {
        error:
          'صفحه تامین اجتماعی دریافت شد اما جدول مشاغل داخل آن قابل پردازش نبود (احتمالا جدول به‌صورت تصویر درج شده است). ' +
          'راه‌های رفع: ۱) صفحه را در مرورگر باز کنید و عنوان و کد شغل را دستی از فهرست داخلی برنامه انتخاب کنید ' +
          '۲) اگر جدول در صفحه به‌صورت متن است بعدا مجدد تلاش کنید ۳) از فهرست داخلی برنامه (شغل‌های رایج هتل) استفاده کنید.',
      },
      { status: 422 },
    );
  }
  const parsedStr = parsed.map((r) => ({ title: r.title, code: String(r.code) }));
  await db.appSetting.upsert({
    where: { key: CUSTOM_KEY },
    update: { value: JSON.stringify(parsedStr) },
    create: { key: CUSTOM_KEY, value: JSON.stringify(parsedStr) },
  });
  return NextResponse.json({
    saved: parsedStr.length,
    builtinCount: JOB_TITLES.length,
    message: `جدول مشاغل با موفقیت از سایت تامین اجتماعی دریافت و به‌روزرسانی شد (${parsedStr.length} عنوان).`,
  });
}
