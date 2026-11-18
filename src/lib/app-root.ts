// ریشه برنامه — تعیین درست مسیرها در نسخه exe (الکترون) و وب
// در نسخه exe، main.js مسیر پوشه webapp را در PAYROLL_WEBAPP_DIR و پوشه داده
// کاربر را در PAYROLL_DATA_DIR می‌گذارد؛ اگر نبود (اجرای وب/سورس) همان cwd.
import path from 'path';

/** ریشه وب‌اپ — محل prisma/init.sql و public (فایل‌های همراه بسته) */
export function appRoot(): string {
  return process.env.PAYROLL_WEBAPP_DIR || process.cwd();
}

/** ریشه داده‌های نوشتنی (پشتیبان دیتابیس و ...) — در exe پوشه داده کاربر */
export function dataRoot(): string {
  return process.env.PAYROLL_DATA_DIR || appRoot();
}

export function prismaDir(): string {
  return path.join(appRoot(), 'prisma');
}
