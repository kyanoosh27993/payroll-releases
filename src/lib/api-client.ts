// کلاینت API — همه فراخوانی‌ها مسیر نسبی و تایپ‌دار
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'خطای سرور');
  return res.json();
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'خطای سرور');
  return res.json();
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'خطای سرور');
  return res.json();
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'خطای سرور');
  return res.json();
}

/** دریافت فایل به‌صورت blob از API با ارسال کوکی نشست — همیشه مسیر نسبی (همان origin) */
export async function fetchFile(url: string, method = 'GET', body?: unknown): Promise<Blob> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'خطا در تولید فایل' }));
    throw new Error(err.error || 'خطا در تولید فایل');
  }
  return res.blob();
}

/** دانلود فایل (blob) از API و ذخیره در مرورگر */
export async function downloadFile(url: string, filename: string, method = 'GET', body?: unknown) {
  const blob = await fetchFile(url, method, body);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    a.remove();
  }, 1500);
}

/**
 * بازکردن خروجی HTML برای چاپ — بدون window.open و بدون navigation.
 * فایل با کوکی نشست از همان origin گرفته می‌شود و داخل خود برنامه
 * در یک iframe نمایش و چاپ می‌شود (رفع کامل خطای NO_SESSION —
 * هم در مرورگر و هم در Electron که window.open مسدود است).
 * فایل‌های غیر HTML (Word/PDF/Excel/…) به‌صورت blob دانلود می‌شوند.
 */
export async function openPrintWindow(url: string, opts?: { autoPrint?: boolean; filename?: string }) {
  const { autoPrint = true, filename } = opts ?? {};
  const blob = await fetchFile(url);
  const mime = blob.type || 'text/html';
  if (!mime.includes('html')) {
    // فایل غیر HTML (Word/PDF/Excel/…) — دانلود با نام مشخص
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || 'export';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      a.remove();
    }, 1500);
    return;
  }
  const html = await blob.text();
  printHtmlInApp(html, autoPrint, filename);
}

/** نمایش HTML در یک روکش داخل برنامه + چاپ از طریق iframe — بدون پنجره جدید */
export function printHtmlInApp(html: string, autoPrint = true, _filename?: string) {
  // اگر روکش قبلی باز است ببند
  document.getElementById('payroll-print-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'payroll-print-overlay';
  overlay.setAttribute('dir', 'rtl');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(15,23,42,0.55)', 'backdrop-filter:blur(2px)',
    'display:flex', 'flex-direction:column', 'align-items:center', 'padding:16px',
  ].join(';');

  const bar = document.createElement('div');
  bar.style.cssText = [
    'width:min(900px,100%)', 'display:flex', 'align-items:center', 'gap:8px',
    'background:#ffffff', 'color:#0f172a', 'border-radius:10px 10px 0 0',
    'padding:8px 12px', 'font:600 13px/1.5 system-ui', 'box-shadow:0 8px 30px rgba(0,0,0,0.25)',
  ].join(';');

  const title = document.createElement('span');
  title.textContent = 'پیش‌نمایش چاپ';
  title.style.flex = '1';

  const mkBtn = (label: string, primary = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.type = 'button';
    b.style.cssText = [
      'border:1px solid #cbd5e1', 'border-radius:8px', 'padding:5px 14px',
      'font:600 12.5px/1.4 inherit', 'cursor:pointer', 'background:#ffffff', 'color:#0f172a',
    ].join(';');
    if (primary) {
      b.style.background = '#059669';
      b.style.borderColor = '#059669';
      b.style.color = '#ffffff';
    }
    return b;
  };

  const printBtn = mkBtn('چاپ', true);
  const closeBtn = mkBtn('بستن');
  bar.append(title, printBtn, closeBtn);

  const frame = document.createElement('iframe');
  frame.style.cssText = [
    'width:min(900px,100%)', 'flex:1', 'border:0', 'background:#ffffff',
    'border-radius:0 0 10px 10px', 'box-shadow:0 8px 30px rgba(0,0,0,0.25)',
  ].join(';');

  overlay.append(bar, frame);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const doPrint = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch { /* بعضی محیط‌ها print روی iframe را محدود می‌کنند */ }
  };
  printBtn.addEventListener('click', doPrint);

  frame.onload = () => { if (autoPrint) setTimeout(doPrint, 350); };
  // srcdoc — محتوای HTML داخل همین صفحه بدون هیچ درخواست شبکه اضافه
  frame.setAttribute('srcdoc', html);
}
