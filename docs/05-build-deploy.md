# ۰۵ — ساخت و توزیع (Build & Deploy)

## ۱) Build وب (منبع هر دو حالت)

```bash
cd /home/z/my-project
npm run build        # خروجی: .next/standalone + کپی static و public
```

پس از build، پوشه `webapp-standalone/` به‌روز می‌شود (server.js + .next + node_modules).

## ۲) اجرای وب روی سیستم کاربر

```bash
DATABASE_URL="file:../db/custom.db" NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
  node webapp-standalone/server.js
# یا ساده‌تر در ویندوز: run-web.bat
```

## ۳) ساخت exe (نصبی + پرتابل)

```bash
cd desktop
npx electron-builder --win nsis portable --x64
```

نکات حیاتی (در غیر این صورت build روی لینوکس شکست می‌خورد):

1. **باینری Prisma ویندوز:** در `prisma/schema.prisma` باید
   `binaryTargets = ["native", "windows"]` باشد تا موتور ویندوزی داخل exe قرار گیرد.
   بعد از تغییر، `npx prisma generate` را فراموش نکنید.
2. **شامل‌شدن init.sql و موتورها:** در `next.config.ts` →
   `outputFileTracingIncludes: {"/**": ["./prisma/init.sql", "./node_modules/.prisma/client/**"]}`
3. **حذف sharp/@img** از خروجی standalone (وابستگی بومی ویندوز ندارد و exe را می‌شکند).
4. **سبک‌سازی webapp-standalone**: فقط خروجی `.next/standalone` (شامل node_modules
   ترِیس‌شده‌ی لازم برای اجرا) در `webapp-standalone` کپی شود؛ هرگز `node_modules`
   کامل پروژه، `.next/cache` یا پکیج‌های سه‌بعدی داخل آن قرار نگیرد — در نسخه ۰.۸
   ورود node_modules اضافی حجم exe را به ~۴۲۰ مگابایت رساند؛ با بسته‌بندی درست حجم
   به‌طور محسوس کاهش می‌یابد.
5. **پچ بدون wine** برای electron-builder: فایل
   `desktop/node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js`
   در بخش ساخت Uninstaller باید از `UninstallerReader.exec(installerPath, uninstallerPath)`
   استفاده کند (wine روی این ماشین نصب نیست).
   ⚠️ **این پچ با هر `npm install` داخل desktop از بین می‌رود — قبل از build مجدد چک/اعمال شود.**
   همچنین `signAndEditExecutable: false` در `desktop/package.json` باشد.
6. **سیم‌لینک‌ها ممنوع (خطای بحرانی ۱.۳/۱.۴):** `find webapp-standalone -type l` باید
   صفر باشد؛ سیم‌لینک‌ها در پک ۷ز به فایل متنی تبدیل و روی ویندوز `@prisma/client`
   را می‌شکنند (Internal Server Error). با `cp -r` واقعی جایگزین شوند.
7. خروجی‌ها در `desktop/dist/` ساخته می‌شوند و سپس به `download/` با نام‌های:
   - `PayrollSystem Setup 1.4.0.exe` (نصبی)
   - `PayrollSystem-1.4.0-Portable.exe` (پرتابل)
   کپی می‌شوند.

## ۴) دیتابیس در حالت exe

- Electron در اولین اجرا، پوشه `%APPDATA%/PayrollSystem/data` را می‌سازد و
  `DATABASE_URL` را به فایلی همان‌جا تنظیم می‌کند (`desktop/main.js` → `DB_DIR`).
- در اولین اجرا، `src/lib/core/migrate.ts` اسکیمای `prisma/init.sql` را روی
  دیتابیس خالی اعمال می‌کند (خودکار، بدون Prisma CLI).

## ۵) zip سورس

```bash
bash scripts/make-zip-v04.sh
```

محتوا: `webapp/src` + `prisma` + `public` + فایل‌های پیکربندی + `desktop` (فقط
main.js/package.json/icon.png) + `build-exe.bat` + `run-web.bat` + `README.md` + **`docs/`**.

⚠️ هرگز پوشه desktop را کامل کپی نکنید (node_modules و dist آن حجم را به ۱۵۰MB+ می‌رساند).

## ۶) به‌روزرسانی نسخه

- شماره نسخه در `desktop/package.json` (build محصول) و عناوین فایل‌های خروجی.
- تغییرات مهم را در همین اسناد (`docs/`) نیز به‌روز کنید — این کار **الزامی** است
  تا سند همیشه با کد هماهنگ بماند.
