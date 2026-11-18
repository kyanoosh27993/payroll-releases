#!/bin/bash
# ساخت webapp-standalone از خروجی تازه build — با رفع سیم‌لینک‌ها (قانون اجباری نسخه ۱.۴)
# سیم‌لینک @prisma/client-* در پک electron-builder به فایل متنی تبدیل می‌شود و
# روی ویندوز همه صفحات Internal Server Error می‌دهند — به‌جای سیم‌لینک، کپی واقعی قرار می‌گیرد.
set -e
cd /home/z/my-project
rm -rf webapp-standalone
mkdir -p webapp-standalone
cp -r .next/standalone/. webapp-standalone/
cp -r .next/static webapp-standalone/.next/static
# ترِیسینگ Turbopack همه chunkهای ssr را در standalone کپی نمی‌کند (خطای ChunkLoadError در _not-found/_global-error)
# → کل .next/server را روی نسخه standalone کپی می‌کنیم (همان یک build، محتوای یکسان)
cp -rT .next/server webapp-standalone/.next/server
cp -r public webapp-standalone/public
mkdir -p webapp-standalone/prisma
cp prisma/init.sql prisma/schema.prisma webapp-standalone/prisma/
printf 'DATABASE_URL=file:./db/payroll.db\n' > webapp-standalone/.env
cd webapp-standalone
# حذف هر چیز غیرلازم که در کپی standalone وارد شده
for item in Caddyfile README-v0.4.md README-v0.6.md README-v0.7.md README-v1.0.md README-v1.2.md README-v1.3.md README-v1.4.md README-v1.3.md agent-ctx examples mini-services download research recovery-key.txt tsconfig.tsbuildinfo webapp-standalone build-exe.bat bun.lock components.json db desktop desktop-app docs eslint.config.mjs legacy-desktop-py legacy-py-app next.config.ts package-lock.json push-to-github.bat push-to-github.sh run-web.bat scripts skills src tailwind.config.ts tests tmp-v1-upgrade tool-results tsconfig.json upload "تغییرات برنامه.txt" postcss.config.mjs; do
  rm -rf "./$item"
done
# حذف وابستگی‌های بومی بی‌مصرف روی ویندوز
rm -rf node_modules/sharp node_modules/@img 2>/dev/null || true
# حذف موتور لینوکسی پرازیما (فقط موتور ویندوز لازم است)
rm -f node_modules/.prisma/client/libquery_engine-*.so.node 2>/dev/null || true
# ⚠️ جایگزینی همه سیم‌لینک‌ها با کپی واقعی (خطای بحرانی نسخه ۱.۳/۱.۴)
LINKS=$(find . -type l || true)
if [ -n "$LINKS" ]; then
  echo "symlinks found — replacing with real copies:"
  echo "$LINKS"
  while IFS= read -r l; do
    target=$(readlink "$l")
    rm "$l"
    mkdir -p "$(dirname "$l")"
    cp -r "$(realpath -m "$(dirname "$l")/$target")" "$l"
  done <<< "$LINKS"
fi
COUNT=$(find . -type l | wc -l)
echo "remaining symlinks: $COUNT (must be 0)"
[ "$COUNT" = "0" ] || { echo "FAIL: symlinks remain"; exit 1; }
du -sh .
echo "webapp-standalone OK"
