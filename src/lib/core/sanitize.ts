// ابزار پاک‌سازی و ایمن‌سازی خروجی‌ها — ممیزی امنیتی نسخه ۱٫۴٫۳ (بند ۱۷)
/** گریز HTML — هر متنِ متعلق به کاربر قبل از قرارگیری در اسناد چاپی باید از این عبور کند */
export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** فقط data URL تصویر PNG/JPG سالم — برای عکس پرسنل/لوگو/سربرگ (پیشگیری از XSS در src) */
export function isSafeImageDataUrl(v: unknown): string | undefined {
  const s = String(v ?? '');
  return /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : undefined;
}

/** مسیر نسبی امن داخل public — برای logoPath و سربرگ (پیشگیری از پیمایش مسیر) */
export function isSafePublicPath(v: unknown): string | undefined {
  const s = String(v ?? '');
  return s.startsWith('/letterhead/') || s.startsWith('/uploads/') ? s : undefined;
}
