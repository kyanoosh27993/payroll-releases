# راهنمای معماری سامانه حقوق و دستمزد — نسخه ۱.۲.۰ (Web)

> این پوشه، «نقشه راه» برنامه است. هر کسی (یا هر هوش مصنوعی/ابزاری) که بخواهد
> بخشی از برنامه را اصلاح یا توسعه دهد، ابتدا باید این اسناد را بخواند تا بداند
> هر قابلیت دقیقاً در کدام فایل پیاده‌سازی شده و تغییر آن به کجا اثر می‌گذارد.

## فهرست اسناد

| فایل | موضوع |
|---|---|
| [01-architecture.md](01-architecture.md) | معماری کلی، استک فناوری، چرخه داده و نحوه اجرا |
| [02-modules-map.md](02-modules-map.md) | **مهم‌ترین سند:** نگاشت «هر تغییر → دقیقاً کدام فایل» |
| [03-data-model.md](03-data-model.md) | مدل دیتابیس (Prisma) و روابط جدول‌ها |
| [04-core-libs.md](04-core-libs.md) | کتابخانه‌های هسته (`src/lib/core`) و موتور هوش مصنوعی آفلاین (`src/lib/ai`) |
| [05-build-deploy.md](05-build-deploy.md) | ساخت نسخه Production، خروجی exe (نصبی/پرتابل) و zip سورس |
| [06-conventions.md](06-conventions.md) | قواعد اجباری توسعه (جدول‌ها، رنگ‌ها، تقویم، بهداشت پوشه download) |

## گراف کلی برنامه

```
                          ┌─────────────────────────────────────────────┐
                          │            کاربر (مرورگر / پنجره Electron)  │
                          └──────────────────────┬──────────────────────┘
                                                 │ http://localhost:3000 (وب)
                                                 │ http://localhost:47310 (exe)
                          ┌──────────────────────▼──────────────────────┐
                          │           لایه نمایش — React Client          │
                          │  src/app/page.tsx      (تک‌صفحه، RTL، فونت)  │
                          │  src/components/app-shell.tsx (منوی کنار)    │
                          │  src/components/app-state.tsx (وضعیت سراسری) │
                          │  src/components/data-table.tsx               │
                          │     ★ همه جدول‌ها: مرتب‌سازی+فیلتر+ستون‌ها   │
                          │  src/components/modules/*.tsx (۱۴ ماژول)     │
                          └──────────────────────┬──────────────────────┘
                                                 │ fetch (src/lib/api-client.ts)
                          ┌──────────────────────▼──────────────────────┐
                          │        لایه API — Next.js Route Handlers     │
                          │  src/app/api/*/route.ts                      │
                          │  personnel / contracts / shifts / attendance │
                          │  payroll / exports / reports / settings / ai │
                          └──────────────────────┬──────────────────────┘
                                                 │
                          ┌──────────────────────▼──────────────────────┐
                          │           لایه منطق — src/lib               │
                          │  core/payroll-engine.ts  (محاسبه حقوق)      │
                          │  core/device-import.ts   (دستگاه mehr1405)  │
                          │  core/standard-exports.ts (خروجی‌های استاندارد)│
                          │  core/jalali.ts          (تقویم شمسی)       │
                          │  ai/local-engine.ts      (دستیار آفلاین)    │
                          └──────────────────────┬──────────────────────┘
                                                 │ Prisma Client
                          ┌──────────────────────▼──────────────────────┐
                          │        دیتابیس SQLite — db/custom.db         │
                          │        prisma/schema.prisma (۲۵ مدل)         │
                          └─────────────────────────────────────────────┘
```

## ماژول‌های دوازده‌گانه (منوی برنامه)

| کلید ماژول | عنوان | فایل رابط کاربری |
|---|---|---|
| `dashboard` | داشبورد | `src/components/modules/dashboard.tsx` |
| `companies` | شرکت‌ها | `src/components/modules/companies.tsx` |
| `personnel` | پرسنل | `src/components/modules/personnel.tsx` |
| `contracts` | قراردادها و احکام | `src/components/modules/contracts.tsx` |
| `shifts` | شیفت‌ها | `src/components/modules/shifts.tsx` |
| `attendance` | حضور و غیاب | `src/components/modules/attendance.tsx` |
| `payroll` | حقوق و دستمزد | `src/components/modules/payroll.tsx` |
| `std-exports` | خروجی‌های استاندارد | `src/components/modules/std-exports.tsx` |
| `reports` | گزارش‌ساز | `src/components/modules/reports.tsx` |
| `calendar` | تقویم و رویدادها | `src/components/modules/calendar.tsx` |
| `settings` | تنظیمات | `src/components/modules/settings.tsx` |
| `users` | مدیریت کاربران (فقط مدیر) | `src/components/modules/users.tsx` |
| `audit` | گزارش تغییرات / لاگ (فقط مدیر) | `src/components/modules/audit.tsx` |
| `help` | راهنما (F1) | `src/components/modules/help.tsx` |

ثبت و بارگذاری تنبل (lazy) همه ماژول‌ها در `src/components/modules/registry.tsx` انجام می‌شود —
**برای افزودن ماژول جدید فقط همین فایل + منوی `app-shell.tsx` باید تغییر کند.**
