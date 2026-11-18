# PROGRESS-STATE — وضعیت پیشرفت نسخه ۱.۴.۴

> طبق بخش ۱۲ قواعد (docs/06-conventions.md): پس از تکمیل هر مرحله این فایل به‌روز می‌شود.
> آخرین به‌روزرسانی: 2026-11-18 — مرحله ۷ (تکمیل باقی‌مانده‌های ۱.۴.۳) در نسخه ۱.۴.۴

## نسخه جاری: ۱.۴.۴ (در حال توسعه — از ۱.۴.۳ تحویل‌شده)

## وضعیت ممیزی‌شده کد موجود (خروجی ممیزی جامع — امین‌ترین مرجع)

### موارد به‌ارث‌رسیده از گزارش‌های قبلی:
- [x] A2. NSIS Assisted: `desktop/package.json` → oneClick:false, allowToChangeInstallationDirectory:true ✔ (تست اجرا در مرحله build)
- [x] A5. مدیریت کاربران + expiresAt + پیغام ۷روزه (app-shell ExpiryWarning) + API users/[id] + مرورگر-تست `scripts/users-expiry-browser.sh` — کد کامل است؛ تست اجرایی در مرحله build
- [x] A6. SmartScreen: صادقانه اعلام شده (نیاز به گواهی امضا)
- [~] A1. باگ ثبت شرکت: علت تاریخی = بریده‌شدن footer دیالوگ در پنجره 1100×640؛ کد فعلی footer چسبان دارد — تست runtime لازم
- [~] A4. ورود admin: seed admin/Admin@1405 (mustChangePassword) + supervisor/Sup@1405! موجود — تست runtime لازم

### موارد ۱ تا ۱۸:
- [x] ۱. قانون ذخیره‌سازی تدریجی → بخش ۱۲ conventions + این فایل
- [ ] ۲. حذف پرتابل: هنوز در desktop/package.json targets `nsis portable` است ← باید `--win nsis` شود + release-check.py تطبیق
- [~] ۳. پارامترهای سال مالی: FySetting per-FY موجود؛ FY_DEFAULTS در payroll-calc.ts شامل overtime 1.4, night 35, shift 10/15/22.5, minimum_wage_monthly, late/early grace. **مفقودها:** حداقل دستمزد روزانه، حق مسکن/بن/عائله‌مندی/حق اولاد/پایه سنوات در سطح سال، شب‌کاری غیرموظفی ۱۷۵٪، جمعه‌کاری ۱۸۰٪/۴۰٪ با تعطیلی جایگزین، مزد ساعتی=روزانه÷۷.۳۳ (الان مزد÷۱۷۶)، عدم نمایش minimum_wage و سقف‌ها در settings UI
- [~] ۴+۹. جدول مشاغل: builtin + دانلود خودکار تامین + جستجو در پرسنل + کد بیمه؛ **مفقود:** بارگزاری دستی فایل کاربر (MD/xlsx) و جایگزینی بدون اخلال
- [ ] ۵. «گریس تاخیر/تعجیل» هنوز در ~۲۰ جا (help.tsx, guide.ts, dashboard.tsx, settings.tsx)؛ کلیدها late_grace_minutes/early_grace_minutes پیش‌فرض ۱۰ ← باید نام فارسی + پیش‌فرض ۵ شود
- [x] ۶. اقلام فیش: تب «اقلام فیش» CRUD کامل + manual lines + payslip-extras ← آموزش جامع در help.tsx باید توسعه یابد
- [~] ۷. AI داخلی: smart-assistant + /api/ai/chat + guide.ts + insights.ts — فقط توضیح/پرسش؛ **اتوماسیون روتین مفقود**؛ 🔴 **بلوکر build:** `src/lib/ai/local-engine.ts` وجود ندارد ولی import شده!
- [ ] ۸. سورت پیش‌فرض کد پرسنلی: data-table defaultSort ندارد؛ API پرسنل orderBy نام ← باید کد پرسنلی صعودی شود
- [~] ۱۱. بک‌آپ: /api/backup (create/restore/delete/list) + بک‌آپ اتوماتیک پس از هر محاسبه حقوق با حذف ۳۰روزه؛ **مفقود:** بک‌آپ هنگام خروج برنامه (desktop/main.js)، صفحه جداگانه اتوماتیک‌ها، پاک‌سازی کامل دیتابیس فقط supervisor
- [~] ۱۲. قرارداد: شماره پرسنلی=شماره قرارداد ✔، عکس پرسنل ✔، شبا/حساب ✔، تاریخ جلالی ✔؛ **مفقود:** سربرگ کاربر (logoPath نادیده)، چاپ احکام، footer امضا بدون کادر در هر صفحه
- [~] ۱۴. تسویه‌حساب: لوگو ✔؛ **مفقود:** عکس پرسنل + شماره حساب پرسنل + توضیحات پرداخت
- [~] ۱۳. جداسازی داده: عمدتاً OK؛ **نشت:** contracts/generate از findFirst() شرکت می‌گیرد
- [~] ۱۵. ممیزی حسابرس: کار جداگانه در این نسخه
- [ ] ۱۶. بازطراحی UI + بهینه‌سازی ۴GB: کار جداگانه
- [ ] ۱۷. ممیزی امنیتی: کار جداگانه
- [x] ۱۲ب. نسخه ۱.۴.۳ در همه نقاط سینک شده (app-state, help, app-shell, context, desktop/package.json, build-exe.bat)
- [ ] ۱۸. build نهایی + تست + release-check + GitHub tag

## گزارش مراحل

### مرحله ۰ — ثبت قوانین و موارد ✔
### مرحله ۰ب — ممیزی کامل کد موجود ✔ (۱۸ مورد وضعیت‌گذاری شد)
### مرحله ۱ ✔ — رفع بلوکر build + موارد سریع:
- `src/lib/ai/local-engine.ts` ساخته شد (بلوکر build رفع شد) — پاسخ داده‌ای + توضیح «چرا این عدد» + فرمان‌های روتین (پرینت فیش/تسویه/فرم بانک با action برای UI)
- مورد ۵: «گریس تاخیر/تعجیل» → «زمان تاخیر مجاز / زمان تعجیل مجاز» در ۶ فایل؛ پیش‌فرض ۵ دقیقه در FY_DEFAULTS
- مورد ۸: سورت پیش‌فرض کد پرسنلی صعودی — data-table defaultSort prop + orderBy کد پرسنلی در personnel API، payroll-calc، payroll-views (ترتیب فیش گروهی)، eidi + جدول‌های personnel/payroll-summary/payroll-bank(+ستون کد جدید)/report-eidi
- tsc بدون خطا (src/)
### مرحله ۲ ✔ — مورد ۳ (پارامترهای سال مالی + فرمول‌های قانونی) + مورد ۱۰:
- payroll-engine.ts: مزد مبنا = مزد شغل + مزد سنوات (کلید mizan_include_seniority)؛ مزد روزانه = مبنای ماهانه ÷ ۳۰ (daily_divisor_days)؛ مزد ساعتی = روزانه ÷ ۷٫۳۳ (hourly_divisor_hours — معادل ۱/۲۲۰ ماده ۵۹)
- فرمول جدید night_ot_175 (شب‌کاری غیرموظفی ۱۰۰+۷۵=۱۷۵٪) و friday_work_180 (بدون تعطیلی جایگزین ۱٫۸)
- حق اولاد = مبلغ هر فرزند × تعداد فرزند پرسنل (dependents) فقط متأهل؛ حق عائله‌مندی فقط متأهل؛ fallback به مقادیر سطح سال (housing_monthly, worker_ben_monthly, family_allowance_monthly, child_allowance_monthly, seniority_base_monthly)
- FY_DEFAULTS: ۱۳ کلید جدید؛ settings.tsx: فیلدهای جدید با راهنمای فرمول + جدول ۱۲ ماه ساعات موظفی (required_hours_m1..m12) با helper requiredHoursOfMonth
- payslip-extras.ts: همگام با فرمول‌های جدید (hourly جدید، عیدی فقط مزد شغل+سنوات، reqH از جدول ماهانه)
- tsc بدون خطا
### مرحله ۳ ✔ — مورد ۴+۹ (جدول مشاغل):
- فیلد `Personnel.jobCode` در سه‌گانه (schema.prisma + init.sql + migrateIfNeeded) — پشتیبانی کد حرف‌وعددی مثل 2035AG/OA2675
- API job-titles: نوع code → string؛ **PUT** جدید = بارگزاری فایل کاربر (xlsx/xls/csv/md/tsv) با پارس هوشمند (parseJobRowsFromText) و جایگزینی کامل؛ **DELETE** = بازگشت به فهرست داخلی
- فرم پرسنل: انتخاب شغل → ذخیره jobTitle + jobCode (+jobCategory عددی وقتی کد عددی است)
- settings.tsx: تب جدید «جدول مشاغل» — بارگزاری فایل، بازگشت به داخلی، نمایش تعداد عناوین فعال
- tsc بدون خطا
### مرحله ۴ ✔ — موارد ۱۳، ۱۱، ۱۴، ۱۲ و ۲:
- مورد ۱۳: نشت شرکت در contracts/generate و settlement رفع شد (هر دو از companyId پرسنل می‌گیرند؛ findFirst حذف)
- مورد ۱۴: فرم تسویه‌حساب + عکس پرسنلی + شماره حساب/شبا + توضیح پرداخت (settlementHtml پارامتر extra)
- مورد ۱۲: تصویر سربرگ از docx کاربر استخراج و در public/letterhead/letterhead-default.jpeg بسته شد؛ API /api/letterhead (GET/PUT/DELETE) + تب «سربرگ» در تنظیمات؛ قرارداد: سربرگ بالای سند + لوگو شرکت + تاریخ‌ها با dateLtr (رفع برعکس‌شدن تاریخ در Word) + امضا بدون کادر به‌صورت footer (چسبیده پایین صفحه در چاپ)؛ **چاپ احکام**: API /api/decrees/print (html/doc داخل سربرگ) + دکمه چاپ/Word در تب احکام
- باگ واقعی پشتیبان‌گیری پیدا و رفع شد: مسیر دیتابیس exe = data/payroll.db ولی API از DATA_DIR/custom.db می‌خواند؛ dbFilePath اصلاح شد
- مورد ۱۱: API backup گسترش یافت (scope=auto، دانلود فایل به مسیر دلخواه، action=wipe فقط supervisor با تائید PAK-KON)؛ ماژول جدید **«مدیریت دیتابیس»** (database.tsx) با سه تب دستی/اتوماتیک/پاک‌سازی + رجیستری و منو؛ بک‌آپ اتوماتیک هنگام خروج در desktop/main.js (بی‌صدا، حذف خودکار ۳۰روزه)
- مورد ۲: پرتابل از desktop/package.json حذف شد (target فقط nsis) + release-check.py تطبیق شد
- tsc بدون خطا
### مرحله ۵ ✔ — مورد ۶ (آموزش)، مورد ۷ (اتوماسیون)، مورد ۱۷ (ممیزی امنیتی):
- help.tsx: بخش کامل «ویرایش و افزودن اقلام فیش حقوقی — آموزش جزء به جزء» (۵ مرحله + هشدارها) + به‌روزرسانی فرمول‌ها (مزد مبنا/روزانه/ساعتی، شب‌کاری ۱۷۵٪، جمعه‌کاری ۴۰٪/۱٫۸، عیدی و مانده مرخصی) + پیش‌فرض زمان تاخیر مجاز ۵ دقیقه در متن
- smart-assistant.tsx: دکمه «اجرای خودکار» برای action؛ payroll.tsx: شنونده payroll-assistant-command (انتخاب دوره + بازکردن فیش فرد با کد پرسنلی)؛ settlement.tsx: انتخاب خودکار فرد؛ اصلاح useState خراب manualTaxFree (باگ واقعی)
- **ممیزی امنیتی کامل (مورد ۱۷)** — ۱۲ یافته؛ رفع شد:
  1. HIGH — حداقل ۲۵+ endpoint تغییردهنده بدون hasRole → guard اضافه شد (companies، fiscal-years، personnel، contracts، decrees، payroll calculate/manual/approve/periods، settings، tax-brackets، payroll-items، attendance import/recalc/daily، calendar، shifts، override، payroll-groups، ai-config، audit)
  2. HIGH — brute force مسیر forgot-password → محدودیت ۵ تلاش/۱۵ دقیقه + پیام یکسان (رفع شمارش نام کاربری)
  3. HIGH — XSS ذخیره‌شده در اسناد چاپی → escapeHtml در contract-doc (فیلدهای فرد/شرکت + عکس validated)، decrees/print، settlement، payroll-views (slipInfoCell)؛ Personnel.photo فقط data URL تصویر سالم
  4. MEDIUM — دانلود فایل دیتابیس → فقط admin
  5. MEDIUM — سقف حجم بارگزاری (attendance 10MB، job-titles 10MB)
  6. LOW — Electron will-navigate محدود به 127.0.0.1
  - تایید شد: scrypt+salt+timingSafeEqual، هدرهای هویتی از سمت سرور (middleware حذف هدرهای کلاینت)، بدون SQL injection، مسیر traversal بسته
- npm run build موفق
### مرحله ۶ ✔ — مورد ۱۶ + تست کامل + build + تحویل:
- مورد ۱۶ (بخش اصلی): sidebar با hover اتومات باز/جمع می‌شود (hoverOpen)؛ دسته‌بندی منوها موجود (NAV_GROUPS)؛ منوی آبشاری سرصفحه ماژول‌ها پیاده نشد (باقی‌مانده)
- تست‌ها: test-v143-fresh.sh = 42/42 PASS؛ test-v143-features.sh (جدید — ۱۹ سناریو شامل بارگزاری مشاغل، سربرگ، بک‌آپ، wipe-denied، RBAC viewer، پارامترها، منقضی، AI) = 19/19 PASS؛ users-expiry-browser.sh (مرورگر واقعی: ورود، انقضا، بنر ۷روزه، بدون خطای کنسول) = PASS
- تست دیتابیس قدیمی: کپی db ۲۹ جدولی → مایگریت خودکار (jobCode، expiresAt) موفق، ورود و همه APIها سالم
- bilyld exe نصبی: با wine wow64 پرتابل + اسکریپت سفارشی installer.nsi (رفع وابستگی wine uninstaller-stub) → PayrollSystem Setup 1.4.3.exe = 139,724,496 bytes — scripts/build-installer-v143.sh ذخیره شد
- zip سورس با PROGRESS-STATE + ابزارهای بیلد
- release-check.py: RELEASE-OK — installer md5 728c34ff5dcada07af8bcbabfaf126c3 / source md5 e3fb03f48d81d19393bdf4fc31fd06b4
- GitHub release v1.4.3 (id 448474373): بیلد نهایی آپلود شد (sha256 verified)، پرتابل قدیمی حذف شد، لینک‌ها سمت سرور + دانلود واقعی (206) راستی‌آزمایی شد

### مرحله ۷ ✔ — نسخه ۱.۴.۴: تکمیل سه مورد باقی‌مانده ۱.۴.۳ + بازسازی موتور AI:
- کشف بحرانی: `src/lib/ai/local-engine.ts` مفقود شده بود (build می‌شکست) ← کامل بازسازی شد: فهم پرسش فارسی (ماه، نام پرسنل، کد پرسنلی)، جمع دوره، وضعیت فرد (مالیات/بیمه/مرخصی/خالص/ناخالص)، توضیح کامل «چرا این عدد» با ریز فرمول‌ها، فرمان‌های اجرای خودکار (پرینت فیش، تسویه، محاسبه دوره)، تعداد پرسنل
- مورد ۱۳ — انتقال از سال قبل با تائید: POST fiscal-years گزینه carryFromPrevious (تنظیمات FY + پله‌های مالیاتی + دوره‌های ۱۲گانه)؛ UI: چک‌باکس تأیید در دیالوگ «افزودن سال مالی» با ذکر سال مبدأ؛ بدون skipDuplicates (سازگار SQLite)
- مورد ۱۶ — منوی آبشاری سرصفحه: `nav-groups.tsx` مشترک جدید (NAV_GROUPS + navigateToModule/navigateListener)؛ PageHeader اکنون ModuleQuickNav دارد (دروپ‌داون پرش سریع با نقش‌محوری admin/supervisor)؛ app-shell با رویداد app-navigate و window.__payrollActiveModule سینک است
- مورد ۱۲ — Footer Word هر صفحه: @page WordSection1 + mso-footer: f1 + mso-element:footer در contract-doc.ts؛ امضاها در Word واقعاً Footer همه صفحات می‌شوند؛ در مرورگر همان انتهای سند + چاپ ثابت پایین
- نسخه ۱.۴.۴ در همه نقاط سینک شد (app-state, help, app-shell, layout, context, batها, desktop/package.json) + رکورد changelog
- tsc بدون خطا

## وضعیت نهایی موارد (تحویل ۱.۴.۳):
- [x] ۱ قانون ذخیره تدریجی | [x] ۲ حذف پرتابل | [x] ۳ پارامترها+فرمول‌ها | [x] ۴+۹ جدول مشاغل | [x] ۵ نام‌ها+۵دقیقه | [x] ۶ اقلام فیش+آموزش | [x] ۷ AI (توضیح+اتوماسیون) | [x] ۸ سورت کد پرسنلی | [x] ۱۰ ساعات موظفی | [x] ۱۱ مدیریت دیتابیس | [x] ۱۲ سربرگ/قرارداد/احکام (footer Word هر صفحه: ترفند mso اعمال نشد — چسبیده پایین در چاپ) | [~] ۱۳ جداسازی+رفع نشت (انتقال سال قبل با تائید: باقی‌مانده) | [x] ۱۴ تسویه | [x] ۱۵ گزارش حسابرس (در پیام نهایی) | [~] ۱۶ hover sidebar (منوی آبشاری سرصفحه: باقی‌مانده) | [x] ۱۷ ممیزی امنیتی+رفع | [x] ۱۸ build+GitHub
- [x] A2 NSIS Assisted | [x] A3 کنترل‌پنل | [x] A5 مدیریت کاربران/اعتبار (از جلسه قبل، تست شد) | [x] A1 ثبت شرکت (فوتر sticky — از جلسه قبل) | [x] A4 ورود admin (seed + تست مرورگری)


## تحویل ۱.۴.۴ ✔ (2026-11-18)
- تست‌ها: test-v143-fresh 42/42 + test-v143-features 19/19 + test-v144-carryover 8/8 (جدید) — همگی PASS
- build: npm run build ✔ + webapp-standalone (0 symlink) ✔ + نصبی NSIS Assisted (wine wow64 بازنصب شد — sandbox بازیابی شده بود)
- release-check.py: RELEASE-OK
- installer: PayrollSystem_v1.4.4_2026-11-17_installer.exe = 139,709,991 B — md5 00f67cd64badc32f46b687f0305ff343
- source: PayrollSystem_v1.4.4_2026-11-17_source.zip = 1,056,224 B — md5 e8f5dc1cd19763813be7a5ba72f2ff57
- GitHub release v1.4.4 (id 449135477, tag v1.4.4) — هر دو asset uploaded و دانلود واقعی راستی‌آزمایی شد (VERIFY-OK)

## وضعیت نهایی موارد پس از ۱.۴.۴:
- [x] ۱۳ انتقال سال قبل با تائید (چک‌باکس در دیالوگ + API carryFromPrevious) — بسته شد
- [x] ۱۶ منوی آبشاری سرصفحه (ModuleQuickNav در PageHeader همه ماژول‌ها) — بسته شد
- [x] ۱۲ Footer امضا در همه صفحات Word (mso-footer/mso-element) — بسته شد
- [x] ۷ موتور AI بازسازی شد (فایل مفقود local-engine.ts بازنویسی و همتراز با تست‌ها شد)
- ⚠️ یادداشت: نسخه‌های بعدی؛ اگر sandbox دوباره بازیابی شد، desktop/node_modules و wine (~/.local/opt) باید بازنصب شوند (npm install در desktop + دانلود wine-wow64)

## رفع باگ در جلسه ۲۰۲۶-۱۱-۱۸ (بعد از تحویل ۱.۴.۴)
- 🔴 باگ واقعی — نمایش عکس پرسنلی در تسویه‌حساب: `settlementHtml` در src/lib/core/settlement.ts عکس ذخیره‌شده (data URL کامل jpeg/png) را بی‌قید و شرط با پیشوند `data:image/png;base64,` بازسازی می‌کرد؛ اعتبارسنجی isSafeImageDataUrl همیشه رد می‌شد و عکس هرگز رندر نمی‌شد. فیکس: پذیرش data URL کامل به‌همراه سازگاری با raw base64 قدیمی. npm run build ✔ + راستی‌آزمایی مرورگری زنده (img complete، 600x800، رندر واقعی) ✔
- یافته تست با اطلاعات فیک «علی محمدی» (کد پرسنلی ۱۰۰): عکس پرسنلی در **فرم پرسنل ✔** و **قرارداد زیر سربرگ ✔** و **تسویه‌حساب ✔ (پس از فیکس)** نمایش داده می‌شود؛ در **حکم پرسنلی ✗** و **فیش حقوقی ✗** فیلد عکس اصلاً در قالب وجود ندارد — در نسخه بعد باید به دو قالب اضافه شود.
- نکته ابزار: اسکرین‌شات `--full` در agent-browser تصاویر data-URL را پینت نمی‌کند؛ برای سند تک‌صفحه‌ای از screenshot معمولی با viewport بلند استفاده شود.

## نسخه ۱.۴.۵ — ۲۰۲۶-۱۱-۱۸ (خروجی ورد روی قالب رسمی + محاسبه روزانه + ردپای محاسبه)
- مورد قرارداد: فایل ورد واقعی روی قالب‌های خود کاربر (قرارداد خام عادی/با مبلغ معین) —
  قالب‌های توکن‌گذاری‌شده: `public/templates/contract-hourly.docx`، `contract-fixed.docx`، `letterhead.docx`
  (تولید با `scripts/make-word-templates.py` از upload/. توکن‌گذاری نقطه‌چین‌ها + جدول بند۴ + شماره/تاریخ هدر سربرگ)
- `src/lib/core/docx-template.ts`: پرکن docx با jszip (جایگزینی توکن + افزودن عکس پرسنل media/rels/content-type)
  ⚠️ نکته LibreOffice: توکن‌های خالی نباید با نقطه‌چین پر شوند (لی‌اوت LO قفل می‌کند) — خالی می‌مانند؛ MS Word مشکلی ندارد
- `src/lib/core/word-outputs.ts`: بدنه WordML حکم و تسویه — روی سربرگ واقعی کاربر جانمایی می‌شوند
- API: contracts/generate?format=docx | decrees/print?format=docx | settlement?format=docx
- محاسبات روزانه (settlement.ts): عیدی = روزمزد مبنا ×۶۰÷۳۶۵×روزهای کارکرد امسال (سقف ۹۰ روز حداقل روزمزد)؛
  سنوات = روزمزد ثابت ×۳۰÷۳۶۵×کل روزهای کارکرد؛ مرخصی = روزمزد مبنا × مانده روز؛
  اقلام تسویه تک‌به‌تک (مزد شغل/سنوات/مسکن/بن/اولاد/عائله‌مندی/سایر/مرخصی/عیدی/سنوات/وام/مساعده) + steps هر قلم
- عیدی فیش (payslip-extras.ts) هم روزانه شد
- قابلیت ردپای محاسبه: payroll-engine traces/summaryTraces + `payroll-trace.ts` + API `/api/payroll/trace` +
  کلیک روی مبالغ فیش و تسویه (اسکریپت داخل HTML) + دکمه «جزئیات محاسبه» جدول خلاصه حقوق + ریز محاسبه کارت‌های داشبورد
- عکس پرسنلی در فیش اضافه شد (SlipInput.photo)
- نسخه ۱.۴.۵ در همه نقاط سینک شد؛ رکورد changelog ثبت شد
- تست: tsc بدون خطا؛ build ✔؛ تست زنده با دیتای علی محمدی (کد ۱۰۰): قرارداد ۱۴۷KB، حکم سربرگ ۳۴۱KB،
  تسویه سربرگ ۳۴۲KB، فیش ۱۴۰KB با عکس+ردپا؛ تست مرورگری: دیالوگ داشبورد/جدول حقوق/فیش همگی PASS
  (اسکرین‌شات‌ها: download/preview-outputs/v145-*.png)
- باقی‌مانده برای build/تحویل: installer NSIS + source zip + release-check + GitHub release v1.4.5

## تحویل ۱.۴.۵ ✔ (2026-11-18)
- installer: PayrollSystem_v1.4.5_2026-11-17_installer.exe = 120,698,482 B — md5 99b506dc84ee4163f1d7269918a2c42a
- source: PayrollSystem_v1.4.5_2026-11-17_source.zip = 1,472,481 B — md5 9f373dbb184072dce17a8443b8befd07
- GitHub release v1.4.5 (id 449230241, tag v1.4.5) — هر دو asset uploaded + دانلود واقعی VERIFY-OK
- release-check.py: RELEASE-OK
- یادداشت فنی برای جلسات بعد: قالب‌های ورد توکن‌دار در public/templates (بازتولید: python3 scripts/make-word-templates.py)؛
  توکن‌های بی‌مقدار در پرکن نباید به نقطه‌چین تبدیل شوند (hang در LibreOffice)؛
  webapp-standalone پس از هر build باید از فایل‌های اضافی ناشی از tracing توربوپک پاک شود
  (Caddyfile، README-*.md، docs، src، desktop، download، upload، research، skills، tests، ...)

## نسخه ۱.۴.۶ — ۲۰۲۶-۱۱-۱۸ (فرم‌ها ۱۰۰٪ مطابق فایل‌های رسمی + فونت‌های اصلی + راستی‌آزمایی کارشناسی) ✔ تحویل شد
- فونت‌های اصلی B Nazanin / B Koodak / B Titr / B Yekan دانلود و نصب شد (scripts/fonts/bseries — منبع: SixLabors/Fonts LFS + ImanMh/ParsiFonts)
- قرارداد: بلوک بالا از نمونه کاربر کپی شد (شماره/تاریخ/پیوست وسط‌چین + عکس شناور)؛ پیوست = حکم پرسنلی؛
  چک‌باکس بند ۲ یونی‌کد ☐/☑؛ نام پرسنل در فوتر «امضای همکار»؛ ارقام متن فارسی؛ ۱۱ بند در صفحه اول
- حکم: شماره = کدپرسنلی/ماه صدور، تاریخ = تاریخ ثبت؛ پیوست قرارداد کار؛ امضا بدون کادر (مدیر + همکار)
- فیش: تک‌برگ A5 لندسکیپ fit-to-page (zoom خودکار)؛ ستون مبنا هر قلم؛ ریز شیفت‌ها جدا؛ جمعه با/بدون جایگزین جدا؛
  ساعت کارکرد + اضافه‌کار در سربرگ؛ «محل درج مهر شرکت»؛ حذف متن پایین؛ لوگو پیش‌فرض سربرگ
- موتور: shiftPctHours (حق شیفت چنددرصدی روزانه) + fridayReplaced/NoReplace + basisShort traces
- رفع باگ: شیفت‌های استثنای kind=shift در shiftById واکشی نمی‌شدند؛ پنجره تشخیص جایگزین جمعه ±۶ روز
- کارشناسی: worker_ben مشمول بیمه؛ گریس ۵ دقیقه در DB
- دیتای آزمون کامل علی محمدی + VERIFY-PASS (scripts/verify-v146.py — همه اقلام با محاسبه مستقل منطبق)
- installer: PayrollSystem_v1.4.6_2026-11-17_installer.exe = 140,684,057 B — md5 500bbbf3c68f8465ea417de923a996d2
- source: PayrollSystem_v1.4.6_2026-11-17_source.zip — md5 ed2ae80acc83957da75064bab409e699
- خروجی‌های نمونه (قرارداد/حکم/فیش/تسویه) هم به‌عنوان asset روی GitHub release ذخیره شد تا با ریست sandbox از بین نرود


## نسخه ۱.۴.۷ — ۲۰۲۶-۱۱-۱۸ (اصلاحات دقیق فرم‌ها طبق بازخورد کاربر) ✔ تحویل شد
- قرارداد: عکس پرسنلی بالای صفحه اول سمت راست (باگ رلیشن عکس رفع شد — عکس واقعاً چاپ می‌شود)؛
  فقط بندهای ۱-۱۱ در صفحه اول (شکست صفحه قبل از «توافقات و شرایط کاری»)؛ سطرهای جدول حقوق ۴۲۰twips؛
  فشرده‌سازی فاصله خطوط مشخصات و بندهای ۵-۱۱ (compactParagraphsBeforeTable — مقاوم به متن شکسته بین runها)
- حکم: ارقام تاریخ/شماره سربرگ فارسی با فونت B Koodak (koodakHeaderRun)؛ عرض جدول‌ها = ۹۶۳۸twips؛
  مرج سلول «جمع کل حقوق ثابت و مزایا» (gridSpan 2 + noWrap در wTable)
- تسویه: هم‌عرضی کامل؛ مرج سطرهای جمع مطالبات/بدهی/خالص؛ فونت کودک برای تاریخ‌ها؛
  متن اقرارنامه استاندارد (منبع: نمونه فرم‌های رسمی — bidbarg.net/irhesabdaran.ir)؛
  امضا و اثر انگشت همکار و کارفرما با فضای کافی
- فیش: لوگوی شرکت = نشان برش‌خورده از سربرگ رسمی (public/letterhead/company-logo.jpeg) +
  رفع باگ mime لوگو (logoHtml تشخیص از امضای بایت‌ها)
- release-check: RELEASE-OK؛ installer 140,743,938B md5 613198203c75a9d4d14e0125c090ef62؛
  source zip 1,508,605B md5 e9c026fb4ef87bfd39f45ea8cdeb903e
- GitHub release v1.4.7 (id 449384145) — installer + source + ۴ فرم نمونه PDF + سورس کامل روی branch main (commit 65935f4)
- نکته امنیتی: scripts/upload-v141.sh حاوی توکن بود — از پوش سورس حذف شد
