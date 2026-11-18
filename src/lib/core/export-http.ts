// پاسخ‌های فایل HTTP برای مسیرهای خروجی
import { NextResponse } from 'next/server';
import * as JJ from './jalali';

export function fileResponse(content: Buffer | string, filename: string, contentType: string): NextResponse {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export function xlsxResponse(buf: Buffer, filename: string): NextResponse {
  return fileResponse(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function daysInJMonth(jy: number, jm: number): number {
  return JJ.daysInMonth(jy, jm);
}
