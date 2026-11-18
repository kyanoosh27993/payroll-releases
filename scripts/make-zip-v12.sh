#!/bin/bash
# ساخت zip سورس نسخه ۰.۸ — webapp + desktop + bat + README
set -e
cd /home/z/my-project
STAGE=/tmp/stage-v12
rm -rf "$STAGE" /home/z/my-project/download/*.zip
mkdir -p "$STAGE/PayrollSystem_v1.2/webapp" "$STAGE/PayrollSystem_v1.2/desktop"

# --- webapp ---
cd webapp_src=$STAGE 2>/dev/null || true
cd /home/z/my-project
for item in src prisma public desktop_src; do :; done
cp -r src "$STAGE/PayrollSystem_v1.2/webapp/src"
cp -r public "$STAGE/PayrollSystem_v1.2/webapp/public"
rm -rf "$STAGE/PayrollSystem_v1.2/webapp/public/logos"
cp -r prisma "$STAGE/PayrollSystem_v1.2/webapp/prisma"
cp package.json tsconfig.json next.config.ts postcss.config.mjs components.json eslint.config.mjs .env "$STAGE/PayrollSystem_v1.2/webapp/" 2>/dev/null || true
# .env قابل‌حمل — دیتابیس در پوشه webapp/db ساخته می‌شود
echo 'DATABASE_URL="file:../db/custom.db"' > "$STAGE/PayrollSystem_v1.2/webapp/.env"
mkdir -p "$STAGE/PayrollSystem_v1.2/webapp/db"
cp scripts/test-core-ts.ts scripts/test-device-parse.ts "$STAGE/PayrollSystem_v1.2/webapp/" 2>/dev/null || true
mkdir -p "$STAGE/PayrollSystem_v1.2/webapp/scripts" && mv "$STAGE/PayrollSystem_v1.2/webapp/test-core-ts.ts" "$STAGE/PayrollSystem_v1.2/webapp/test-device-parse.ts" "$STAGE/PayrollSystem_v1.2/webapp/scripts/" 2>/dev/null || true

# --- docs (راهنمای معماری — همیشه همراه سورس) ---
if [ -d docs ]; then
  cp -r docs "$STAGE/PayrollSystem_v1.2/webapp/docs"
fi

# --- desktop + bat + README + تاریخچه تغییرات ---
cp desktop/main.js desktop/package.json desktop/icon.png desktop/installer.nsh "$STAGE/PayrollSystem_v1.2/desktop/"
cp build-exe.bat run-web.bat README-v1.2.md push-to-github.sh push-to-github.bat "تغییرات برنامه.txt" "$STAGE/PayrollSystem_v1.2/"
mv "$STAGE/PayrollSystem_v1.2/README-v1.2.md" "$STAGE/PayrollSystem_v1.2/README.md"

# --- چک بهداشت download: فقط فایل‌های نسخه جاری ---
echo "--- download/ (باید فقط ۳ فایل v1.0 باشد) ---"
ls -la /home/z/my-project/download/

cd "$STAGE"
zip -rq /home/z/my-project/download/PayrollSystem_v1.2_سورس.zip PayrollSystem_v1.2
cd /home/z/my-project
ls -lh /home/z/my-project/download/PayrollSystem_v1.2_سورس.zip
unzip -l /home/z/my-project/download/PayrollSystem_v1.2_سورس.zip | tail -3
