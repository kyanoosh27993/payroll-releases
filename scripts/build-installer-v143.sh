#!/bin/bash
# ساخت exe نصبی NSIS Assisted روی لینوکس بدون wine رسمی — نسخه ۱٫۴٫۳
# پیش‌نیازها (یک‌بار):
#   1) wine wow64 پرتابل: ~/.local/opt/wine-wow64 (Kron4ek wine-9.22-amd64-wow64)
#      لینک: https://github.com/Kron4ek/Wine-Builds/releases/download/9.22/wine-9.22-amd64-wow64.tar.xz
#   2) وصله‌ها (این اسکریپت خودش اعمال می‌کند):
#      - desktop/build/installer.nsi = قالب رسمی + WriteUninstaller در زمان نصب + include همیشگی uninstaller.nsh
#        (با اسکریپت سفارشی، electron-builder مرحله wine/ساخت uninstaller را رد می‌کند و
#         uninstaller را NSIS خودش در زمان نصب روی ویندوز می‌سازد)
#      - وصله node_modules/app-builder-lib/templates/nsis/include/installer.nsh:
#        سطر File /oname=${UNINSTALL_FILENAME} فقط وقتی UNINSTALLER_OUT_FILE خالی نباشد
set -e
cd /home/z/my-project/desktop

# --- اعمال وصله template include (در صورت ازبین‌رفتن با npm install دوباره اعمال می‌شود) ---
INC=node_modules/app-builder-lib/templates/nsis/include/installer.nsh
if ! grep -q 'UNINSTALLER_OUT_FILE}" != ""' "$INC"; then
  python3 - "$INC" <<'PYEOF'
import sys, pathlib
p = pathlib.Path(sys.argv[1])
s = p.read_text()
s = s.replace("""  File "/oname=${UNINSTALL_FILENAME}" "${UNINSTALLER_OUT_FILE}"
!macroend""", """  !if "${UNINSTALLER_OUT_FILE}" != ""
    File "/oname=${UNINSTALL_FILENAME}" "${UNINSTALLER_OUT_FILE}"
  !endif
!macroend""")
p.write_text(s)
print('patched include')
PYEOF
fi

# --- اطمینان از وجود build/installer.nsi ---
if [ ! -f build/installer.nsi ]; then
  mkdir -p build
  cp node_modules/app-builder-lib/templates/nsis/installer.nsi build/installer.nsi
  python3 - <<'PYEOF'
import pathlib
p = pathlib.Path('build/installer.nsi')
s = p.read_text()
s = s.replace("""  !ifdef BUILD_UNINSTALLER
    WriteUninstaller "${UNINSTALLER_OUT_FILE}"
    !insertmacro quitSuccess
  !else
    !insertmacro check64BitAndSetRegView""", """  !ifdef BUILD_UNINSTALLER
    WriteUninstaller "${UNINSTALLER_OUT_FILE}"
    !insertmacro quitSuccess
  !else
    ; بیلد بدون wine: انستالر حذف به‌صورت استاندارد توسط NSIS در زمان نصب ساخته می‌شود
    WriteUninstaller "$INSTDIR\\${UNINSTALL_FILENAME}"
    !insertmacro check64BitAndSetRegView""")
s = s.replace("""!ifdef BUILD_UNINSTALLER
  !include "uninstaller.nsh"
!endif""", """; بیلد بدون wine: بخش Uninstall همیشه کامپایل می‌شود
!include "uninstaller.nsh\"""")
p.write_text(s)
print('created build/installer.nsi')
PYEOF
fi

# --- build ---
export PATH=/home/z/.local/opt/wine-wow64/bin:$PATH
export WINEPREFIX=/home/z/.wine64
export WINEDLLOVERRIDES="mscoree,mshtml="
npm run dist
echo "--- خروجی ---"
ls -la dist/*.exe
