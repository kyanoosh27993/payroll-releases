#!/bin/bash
# ساخت zip سورس نسخه ۰.۴ — webapp + desktop + bat + README
set -e
cd /home/z/my-project
STAGE=/tmp/stage-v04
rm -rf "$STAGE" /home/z/my-project/download/*.zip
mkdir -p "$STAGE/PayrollSystem_v0.4.0/webapp" "$STAGE/PayrollSystem_v0.4.0/desktop"

# --- webapp ---
cd webapp_src=$STAGE 2>/dev/null || true
cd /home/z/my-project
for item in src prisma public desktop_src; do :; done
cp -r src "$STAGE/PayrollSystem_v0.4.0/webapp/src"
cp -r public "$STAGE/PayrollSystem_v0.4.0/webapp/public"
rm -rf "$STAGE/PayrollSystem_v0.4.0/webapp/public/logos"
cp -r prisma "$STAGE/PayrollSystem_v0.4.0/webapp/prisma"
cp package.json tsconfig.json next.config.ts postcss.config.mjs components.json eslint.config.mjs .env "$STAGE/PayrollSystem_v0.4.0/webapp/" 2>/dev/null || true
# .env قابل‌حمل — دیتابیس در پوشه webapp/db ساخته می‌شود
echo 'DATABASE_URL="file:../db/custom.db"' > "$STAGE/PayrollSystem_v0.4.0/webapp/.env"
mkdir -p "$STAGE/PayrollSystem_v0.4.0/webapp/db"
cp scripts/test-core-ts.ts scripts/test-device-parse.ts "$STAGE/PayrollSystem_v0.4.0/webapp/" 2>/dev/null || true
mkdir -p "$STAGE/PayrollSystem_v0.4.0/webapp/scripts" && mv "$STAGE/PayrollSystem_v0.4.0/webapp/test-core-ts.ts" "$STAGE/PayrollSystem_v0.4.0/webapp/test-device-parse.ts" "$STAGE/PayrollSystem_v0.4.0/webapp/scripts/" 2>/dev/null || true

# --- docs (راهنمای معماری — همیشه همراه سورس) ---
if [ -d docs ]; then
  cp -r docs "$STAGE/PayrollSystem_v0.4.0/webapp/docs"
fi

# --- desktop + bat + README ---
cp desktop/main.js desktop/package.json desktop/icon.png "$STAGE/PayrollSystem_v0.4.0/desktop/"
cp build-exe.bat run-web.bat README-v0.4.md "$STAGE/PayrollSystem_v0.4.0/"
mv "$STAGE/PayrollSystem_v0.4.0/README-v0.4.md" "$STAGE/PayrollSystem_v0.4.0/README.md"

# --- چک بهداشت download: فقط فایل‌های نسخه ۰.۴ ---
echo "--- download/ (باید فقط ۳ فایل v0.4 باشد) ---"
ls -la /home/z/my-project/download/

cd "$STAGE"
zip -rq /home/z/my-project/download/PayrollSystem_v0.4.0_سورس.zip PayrollSystem_v0.4.0
cd /home/z/my-project
ls -lh download/PayrollSystem_v0.4.0_سورس.zip
unzip -l download/PayrollSystem_v0.4.0_سورس.zip | tail -3
