# ۰۲ — نقشه ماژول‌ها: «چه تغییری → دقیقاً کدام فایل»

> این سند پرکاربردترین بخش کل راهنماست. قبل از هر اصلاح، ردیف مربوطه را پیدا کنید
> و فقط فایل(های) همان ستون را تغییر دهید.

## جدول اصلی نگاشت

| می‌خواهم ... تغییر بدهم | فایل(های) دقیق | توضیح |
|---|---|---|
| **جدول‌ها: مرتب‌سازی / فیلتر / ستون‌ها** | `src/components/data-table.tsx` | «تنها» این فایل — همه جدول‌های برنامه از همین کامپوننت استفاده می‌کنند |
| ستون‌های یک جدول خاص (افزودن/حذف ستون) | ماژول همان صفحه، جایی که `DtColumn[]` ساخته می‌شود | مثلاً جدول پرسنل: `modules/personnel.tsx` |
| منوی کنار / هدر / قالب کلی | `src/components/app-shell.tsx` + `src/app/globals.css` | |
| وضعیت سراسری (شرکت/سال/دوره فعال) | `src/components/app-state.tsx` | |
| افزودن ماژول (بخش) جدید | `src/components/modules/<new>.tsx` + ثبت در `modules/registry.tsx` + منوی `app-shell.tsx` | بقیه خودکار |
| منطق محاسبه حقوق (فرمول‌ها) | `src/lib/core/payroll-calc.ts` (محاسبات خام) و `payroll-engine.ts` (ارکستراسیون) | نمایش ستون‌های جدول حقوق: `payroll-views.ts` |
| عوامل پیش‌فرض حقوق (نرخ اضافه‌کاری، اقلام) | `src/lib/core/seed.ts` + مدل `FySetting`/`PayrollItemConfig` | |
| مالیات (پلکان WP/WH، ۲۳/۳۹ فیلد) | `src/lib/core/payroll-calc.ts` + تنظیمات پلکان در `api/settings/tax-brackets` | |
| بیمه (۷/۲۰/۳ — sso_*_pct) | `Contract` هر پرسنل + `api/exports/insurance-*` | |
| ورود اطلاعات دستگاه حضور (mehr1405) | `src/lib/core/device-import.ts` + `api/attendance/import/route.ts` + UI در `modules/attendance.tsx` | ۲۹ شیت، ساخت خودکار پرسنل جدید (پیش‌فرض خاموش) |
| شیفت‌ها و گرید زمانی / کارکرد | `src/lib/core/shifts.ts` + `modules/shifts.tsx` | شیفت شخصی + گرید + دقایق گذشت |
| تقویم شمسی (تبدیل تاریخ تا ۱۵۰۰) | `src/lib/core/jalali.ts` | الگوریتم: hijri_to_jd civil + جستجوی jy+40..48 |
| رویدادهای تقویم (تعطیلات و ...) | `src/lib/core/calendar.ts` + `api/calendar/*` + `modules/calendar.tsx` | |
| خروجی‌های استاندارد (لیست بانک، مالیات WP/WH/WK، بیمه، فیش) | `src/lib/core/standard-exports.ts` + `src/app/api/exports/*/route.ts` + UI در `modules/std-exports.tsx` | فرمت‌های دولتی از همین‌جا |
| خروجی DBF بیمه (DSKKAR00/DSKWOR00) | `api/exports/insurance-dbf-kar` و `insurance-dbf-wor` | با `iconv-lite` و کدپیج cp1256 |
| فیش حقوقی (PDF) | `api/exports/payslip/route.ts` + `payslip-data/route.ts` | شامل مانده ماه قبل |
| لیست بانک (پرداخت/تایید/مانده قبلی) | `api/exports/bank/route.ts` | فیلدهای pay_approved/pay_paid/prev_balance |
| گزارش‌ساز | `src/lib/core/reports.ts` + `api/reports/builtin*/route.ts` + `modules/reports.tsx` | |
| مدیریت کاربران | `/api/users`، `/api/users/[id]`، `/api/auth/*` | User, Session |
| لاگ تغییرات | `/api/audit`، `/api/audit/[id]` (ویرایش/حذف فقط سوپروایزر) | AuditLog |
| دستیار هوشمند آفلاین | `src/lib/ai/local-engine.ts` (موتور ۱۲ نیت + پارامترپذیر) + `insights.ts` (ناهنجاری/روند/پیش‌بینی) + `guide.ts` (پایگاه دانش) + `api/ai/chat/route.ts` + `api/ai/insights/route.ts` + UI در `components/ai/smart-assistant.tsx` و کارت داشبورد | بدون اینترنت |
| راهنمای F1 داخل برنامه | `modules/help.tsx` | محتوای AI از این راهنا در `ai/guide.ts` همگام نگه داشته شود |
| تنظیمات برنامه | `modules/settings.tsx` + `api/settings/*` | |
| اعداد فارسی / نرمال‌سازی ارقام | `src/lib/core/numbers.ts` | همه‌جا از این توابع استفاده شود |
| کلاینت API (fetch تایپ‌دار) | `src/lib/api-client.ts` | |
| تعریف/تغییر جدول‌های دیتابیس | `prisma/schema.prisma` + `prisma/init.sql` (هر دو باید با هم به‌روز شوند!) | سپس `npm run db:push` |
| مهاجرت خودکار در اجرای اول exe | `src/lib/core/migrate.ts` | از `prisma/init.sql` می‌خواند |
| اتصال دیتابیس | `src/lib/db.ts` | Prisma singleton |
| نمودارها/آیکون‌ها | lucide-react (`src/components/ui/*` شادکن UI) | |
| آیکون exe / لوگو | `desktop/icon.png` (ساخت با `scripts/make_icon.py`) | |
| اجرای exe (پنجره، پورت، مسیر دیتابیس) | `desktop/main.js` | دیتابیس در `%APPDATA%/PayrollSystem/data` |

## API Routes — نقشه کامل

| گروه | مسیرها |
|---|---|
| پرسنل | `GET/POST /api/personnel`، `GET/PUT/DELETE /api/personnel/[id]`، `.../contracts`، `.../decrees` |
| قرارداد و حکم | `/api/contracts/[id]`، `/api/decrees/[id]` |
| شیفت | `/api/shifts`، `/api/shifts/[id]`، `/api/shifts/assign`، `/api/shifts/override` (شیفت روزانه/تک‌روزه — v۱.۴) |
| حضور و غیاب | `/api/attendance/import`، `/api/attendance/months`، `/api/attendance/daily[/id]`، `/recalc`، `/stats` |
| حقوق | `/api/payroll/calculate`، `/lines`، `/periods`، `/summary`، `/approve`، `/paid`، `/manual`، `/status` |
| خروجی‌ها | `/api/exports/bank`، `payroll-xlsx`، `payslip[/data]`، `tax-wp`، `tax-wh`، `tax-xlsx`، `wh-xlsx`، `insurance-xlsx`، `insurance-dbf-kar`، `insurance-dbf-wor` |
| گزارش‌ها | `/api/reports/builtin`، `/api/reports/builtin-xlsx` |
| تنظیمات | `/api/settings`، `/api/settings/tax-brackets`، `/api/settings/payroll-items` |
| شرکت | `/api/companies`، `/api/companies/[id]`، `.../fiscal-years` |
| تقویم | `/api/calendar`، `/api/calendar/[id]` |
| هوش مصنوعی | `POST /api/ai/chat`، `GET /api/ai/insights`، `GET/POST /api/ai/config` |
| زمینه برنامه | `/api/context` (شرکت‌ها + سال مالی + دوره‌ها) |

## ماژول → API → مدل دیتابیس

| ماژول | API اصلی | مدل‌های Prisma |
|---|---|---|
| companies | `/api/companies` | Company, FiscalYear, FySetting |
| personnel | `/api/personnel` | Personnel |
| contracts | `/api/personnel/[id]/contracts`، `/api/decrees` | Contract, Decree |
| shifts | `/api/shifts` | Shift, ShiftAssignment, ShiftOverride (v۱.۴) |
| attendance | `/api/attendance/*` | AttendanceMonth, AttendanceDaily, Leave |
| payroll | `/api/payroll/*` | PayrollPeriod, PayrollLine, PayrollSummary, PayrollManual, Loan, Advance |
| std-exports | `/api/exports/*` | PayrollLine/Summary + FySetting |
| reports | `/api/reports/*` | ReportDef + همه مدل‌ها |
| calendar | `/api/calendar` | CalendarEvent |
| settings | `/api/settings/*` | TaxBracket, PayrollItemConfig, AppSetting, User, AuditLog |

## امنیت و احراز هویت (نسخه ۰.۷)

- `src/middleware.ts` — محافظت سراسری از همه مسیرهای `/api/*`؛ بدون نشست معتبر پاسخ 401
- `src/lib/auth.ts` — ورود، نشست دیتابیسی، scrypt، قفل بعد از ۵ تلاش ناموفق
- `src/lib/audit.ts` — ثبت لاگ در دیتابیس + فایل روزانه در `logs/` کنار دیتابیس
- هویت کاربر در مسیرها از هدرهای `x-user-id/x-username/x-user-role/x-is-supervisor`
  (که middleware می‌گذارد) با `userFromHeaders(req)` خوانده می‌شود
- اکانت سوپروایزر (`isSupervisor=true`): مخفی، بدون لاگ، تنها ویرایشگر/حذف‌کننده لاگ‌ها
- ستاره ویرایش دستی حضور: فیلد `edited` در `AttendanceDaily` — نمایش ★ در ماژول حضور
