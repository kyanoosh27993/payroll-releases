; بستن بی‌صدای نسخه در حال اجرا قبل از نصب/حذف — رفع پیام خطای «PayrollSystem is running»
; ماکروی رسمی electron-builder: اگر customCheckAppRunning تعریف شود به‌جای چک پیش‌فرض
; (که MessageBox انگلیسی نمایش می‌داد) استفاده می‌شود. برنامه بدون پرسش بسته می‌شود.
!macro customCheckAppRunning
  DetailPrint `بستن نسخه در حال اجرای "${PRODUCT_NAME}"...`
  nsExec::Exec `"$SYSDIR\cmd.exe" /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "USERNAME eq %USERNAME%"`
  Sleep 800
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    ; اگر هنوز در حال اجراست (مثلاً فرایند یخ‌زده) دوباره و با انتظار بیشتر
    Sleep 1500
    nsExec::Exec `"$SYSDIR\cmd.exe" /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /fi "USERNAME eq %USERNAME%"`
    Sleep 500
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${endIf}
!macroend
