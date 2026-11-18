@echo off
chcp 65001 >nul
title ساخت فایل exe نصبی و پرتابل - سامانه حقوق و دستمزد v1.0
echo ============================================================
echo   ساخت فایل exe نصبی و پرتابل - سامانه حقوق و دستمزد نسخه 0.6
echo   پیش‌نیاز: Node.js 20+ (nodejs.org) و اتصال اینترنت برای دانلود پکیج‌ها
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [خطا] Node.js نصب نیست. ابتدا از nodejs.org نصب کنید و دوباره اجرا کنید.
  pause
  exit /b 1
)

echo [1/5] نصب وابستگی‌های وب‌اپ...
cd /d "%~dp0webapp"
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo [2/5] تولید کلاینت Prisma...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [3/5] ساخت نسخه production وب‌اپ (standalone)...
call npx next build
if errorlevel 1 goto :fail
if not exist ".next\standalone\server.js" goto :fail
:: آماده‌سازی پوشه standalone کامل
xcopy /E /I /Y ".next\static" ".next\standalone\.next\static" >nul
xcopy /E /I /Y "public" ".next\standalone\public" >nul
if exist "%~dp0webapp-standalone" rmdir /S /Q "%~dp0webapp-standalone"
xcopy /E /I /Y ".next\standalone" "%~dp0webapp-standalone" >nul
echo      پوشه webapp-standalone ساخته شد.

echo.
echo [4/5] نصب وابستگی‌های Electron...
cd /d "%~dp0desktop"
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo [5/5] ساخت exe (نصبی + پرتابل)...
call npm run dist
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo   موفق! فایل‌های خروجی در پوشه desktop\dist:
echo    - PayrollSystem Setup 1.4.7.exe   (نصبی)
echo    - PayrollSystem-1.4.7 (نصبی فقط)
echo ============================================================
pause
exit /b 0

:fail
echo.
echo [خطا] ساخت ناموفق بود - پیام‌های بالا را بررسی کنید.
pause
exit /b 1
