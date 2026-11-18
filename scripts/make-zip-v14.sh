#!/bin/bash
# ساخت zip سورس نسخه ۰.۸ — webapp + desktop + bat + README
set -e
ZIPV="${1:-1.4.3}"
cd /home/z/my-project
STAGE=/tmp/stage-v14
rm -rf "$STAGE" /home/z/my-project/download/PayrollSystem_v*.zip
mkdir -p "$STAGE/PayrollSystem_v1.4/webapp" "$STAGE/PayrollSystem_v1.4/desktop"

# --- webapp ---
cd webapp_src=$STAGE 2>/dev/null || true
cd /home/z/my-project
for item in src prisma public desktop_src; do :; done
cp -r src "$STAGE/PayrollSystem_v1.4/webapp/src"
cp -r public "$STAGE/PayrollSystem_v1.4/webapp/public"
rm -rf "$STAGE/PayrollSystem_v1.4/webapp/public/logos"
cp -r prisma "$STAGE/PayrollSystem_v1.4/webapp/prisma"
cp package.json tsconfig.json next.config.ts postcss.config.mjs components.json eslint.config.mjs .env "$STAGE/PayrollSystem_v1.4/webapp/" 2>/dev/null || true
# .env قابل‌حمل — دیتابیس در پوشه webapp/db ساخته می‌شود
echo 'DATABASE_URL="file:../db/custom.db"' > "$STAGE/PayrollSystem_v1.4/webapp/.env"
mkdir -p "$STAGE/PayrollSystem_v1.4/webapp/db"
cp scripts/test-core-ts.ts scripts/test-device-parse.ts "$STAGE/PayrollSystem_v1.4/webapp/" 2>/dev/null || true
mkdir -p "$STAGE/PayrollSystem_v1.4/webapp/scripts" && mv "$STAGE/PayrollSystem_v1.4/webapp/test-core-ts.ts" "$STAGE/PayrollSystem_v1.4/webapp/test-device-parse.ts" "$STAGE/PayrollSystem_v1.4/webapp/scripts/" 2>/dev/null || true

# --- docs (راهنمای معماری — همیشه همراه سورس) ---
if [ -d docs ]; then
  cp -r docs "$STAGE/PayrollSystem_v1.4/webapp/docs"
fi

# --- desktop + bat + README + تاریخچه تغییرات ---
cp desktop/main.js desktop/package.json desktop/icon.png desktop/installer.nsh "$STAGE/PayrollSystem_v1.4/desktop/"
# وضعیت پیشرفت (بخش ۱۲ قوانین) + اسکریپت بیلد نصبی بدون wine + ابزارهای تحویل
cp PROGRESS-STATE.md "$STAGE/PayrollSystem_v1.4/" 2>/dev/null || true
mkdir -p "$STAGE/PayrollSystem_v1.4/desktop/build"
cp desktop/build/installer.nsi "$STAGE/PayrollSystem_v1.4/desktop/build/" 2>/dev/null || true
mkdir -p "$STAGE/PayrollSystem_v1.4/scripts"
for sh in build-installer-v143.sh make-webapp-standalone.sh make-zip-v14.sh release-check.py make-changelog.py check-schema-drift.py test-v143-fresh.sh test-v143-features.sh upload-v143.sh; do
  cp "scripts/$sh" "$STAGE/PayrollSystem_v1.4/scripts/" 2>/dev/null || true
done
cp build-exe.bat run-web.bat README-v1.4.md push-to-github.sh push-to-github.bat "تغییرات برنامه.txt" "$STAGE/PayrollSystem_v1.4/"
mv "$STAGE/PayrollSystem_v1.4/README-v1.4.md" "$STAGE/PayrollSystem_v1.4/README.md"

# --- چک بهداشت download: فقط فایل‌های نسخه جاری ---
echo "--- download/ ---"
ls -la /home/z/my-project/download/

cd "$STAGE"
ZOUT="/home/z/my-project/download/PayrollSystem_v${ZIPV}_$(date +%F)_source.zip"
rm -f /home/z/my-project/download/PayrollSystem_v*.zip
zip -rq "$ZOUT" PayrollSystem_v1.4
cd /home/z/my-project
ls -lh "$ZOUT"
unzip -l "$ZOUT" | tail -3
