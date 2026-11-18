# ۰۱ — معماری کلی

## استک فناوری

| لایه | فناوری | توضیح |
|---|---|---|
| فریم‌ورک | Next.js 16 (App Router, `output: 'standalone'`) | تک‌صفحه‌ای (SPA-مانند) با API Routes |
| زبان | TypeScript | همه کدها تایپ‌دار |
| رابط کاربری | React + Tailwind CSS + shadcn/ui | راست‌به‌چپ کامل، فونت وزیرمتن |
| جدول‌ها | کامپوننت اختصاصی `src/components/data-table.tsx` | مرتب‌سازی + فیلتر + نمایش/مخفی‌کردن ستون‌ها (بدون وابستگی خارجی) |
| دیتابیس | SQLite + Prisma ORM | فایل `db/custom.db` |
| هوش مصنوعی | موتور محلی `src/lib/ai/local-engine.ts` | کاملاً آفلاین، بدون نیاز به اینترنت |
| دسکتاپ | Electron (`desktop/main.js`) | سرور Next را به‌صورت پروسه فرزند اجرا می‌کند |

## چرا «وب محلی»؟

برنامه یک سرور Next.js است که روی دستگاه کاربر اجرا می‌شود:
- **حالت وب:** `node webapp-standalone/server.js` روی پورت 3000
- **حالت exe:** Electron همان سرور را روی پورت 47310 بالا می‌آورد و پنجره بومی ویندوز باز می‌کند

هر دو حالت **از یک خروجی build مشترک** (`webapp-standalone/`) استفاده می‌کنند؛
بنابراین هر اصلاح در کد، با یک build به هر دو حالت می‌رسد.

## مسیرهای مهم

| مسیر | نقش |
|---|---|
| `src/` | کد کامل برنامه (UI + API + منطق) |
| `prisma/schema.prisma` | تعریف ۲۵ مدل دیتابیس |
| `prisma/init.sql` | اسکیمای SQL برای مهاجرت خودکار (اجرای اول در exe) |
| `db/custom.db` | دیتابیس واقعی کاربر (ایران — هتل هیلال رفسنجان) |
| `webapp-standalone/` | خروجی نهایی Production (سرور + `.next` + node_modules) |
| `desktop/` | پروژه Electron (main.js + package.json + icon.png) |
| `docs/` | همین اسناد راهنما — همراه سورس توزیع می‌شود |
| `scripts/make-zip-v04.sh` | ساخت zip سورس |
| `build-exe.bat` / `run-web.bat` | اسکریپت‌های ویندوزی ساخت exe و اجرای وب |

## چرخه داده (مثال: محاسبه حقوق)

```
کاربر در ماژول «حقوق و دستمزد» دکمه محاسبه را می‌زند
   → modules/payroll.tsx  (apiPost /api/payroll/calculate)
   → app/api/payroll/calculate/route.ts
   → lib/core/payroll-engine.ts + payroll-calc.ts
        • کارکرد ماه از AttendanceDaily
        • شیفت‌ها و جریمه‌ها از core/shifts.ts
        • نرخ‌ها و عوامل از FySetting / Contract / Decree
        • مالیات از TaxBracket (ستون‌های WP/WH)
        • بیمه ۷/۲۰/۳ (sso_*_pct)
   → ذخیره در PayrollLine / PayrollSummary
   → نمایش در جدول DataTable + ذخیره وضعیت (پیش‌نویس/تایید/پرداخت)
```

## وضعیت سراسری برنامه

`src/components/app-state.tsx` با React Context سه چیز را نگه می‌دارد و از
`/api/context` پیش‌بارگذاری می‌کند:
1. **شرکت فعال** (`Company`) — برنامه چندشرکتی است
2. **سال مالی فعال** (`FiscalYear`) — سال شمسی (jy تا ۱۵۰۰ پشتیبانی می‌شود)
3. **دوره‌های حقوق** (`PayrollPeriod[]`) — ماه‌های جاری سال مالی

هر ماژول با `useApp()` این مقادیر را می‌خواند؛ پس هر درخواست API باید
شناسه شرکت/سال/دوره را بفرستد.

## نحوه اجرای محیط توسعه

```bash
npm run dev          # توسعه روی http://localhost:3000
npm run build        # build تولیدی + کپی static/public داخل standalone
npm run db:push      # اعمال اسکیما روی دیتابیس
```

اجرای نسخه Production (بدون Electron):

```bash
DATABASE_URL="file:/abs/path/db/custom.db" NODE_ENV=production PORT=3000 \
  HOSTNAME=0.0.0.0 node webapp-standalone/server.js
```
