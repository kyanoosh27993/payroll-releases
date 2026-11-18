@echo off
chcp 65001 >nul
title سامانه حقوق و دستمزد v1.4.7 - اجرای وب‌اپ لوکال
echo ============================================================
echo   اجرای وب‌اپ لوکال - سامانه حقوق و دستمزد نسخه 1.4.7
echo   پیش‌نیاز: Node.js 20+ (nodejs.org)
echo   پس از اجرا، مرورگر را روی آدرس http://localhost:3000 باز کنید
echo ============================================================
where node >nul 2>nul
if errorlevel 1 (
  echo [خطا] Node.js نصب نیست. از nodejs.org نصب کنید.
  pause
  exit /b 1
)
cd /d "%~dp0webapp"
if not exist node_modules (
  echo [1/3] نصب وابستگی‌ها (فقط بار اول)...
  call npm install --no-audit --no-fund
)
if not exist db mkdir db
echo [2/3] تولید کلاینت دیتابیس...
call npx prisma generate >nul
echo [3/3] اجرای سرور...
start "" http://localhost:3000
call npm run dev
pause
