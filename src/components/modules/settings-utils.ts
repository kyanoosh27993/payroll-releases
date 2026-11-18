// ابزارهای مشترک ماژول تنظیمات/دیتابیس
/** نمایش حجم فایل به کیلوبایت/مگابایت */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} مگابایت`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} کیلوبایت`;
}
