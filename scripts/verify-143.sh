#!/bin/bash
# راستی‌آزمایی نهایی v1.4.3: عرض دیالوگ + توست مرئی + ذخیره موفق
set -u
PORT=3240
pkill -9 -f "node server.js" 2>/dev/null
for i in $(seq 1 20); do ss -tln | grep -q ":$PORT " || break; sleep 1; done
ss -tln | grep ":$PORT " && { echo "PORT STILL BUSY — ABORT"; exit 1; }
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/repro-server.log 2>&1 &
SRV_OK=0
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && SRV_OK=1 && break || sleep 0.5; done
[ "$SRV_OK" = "1" ] || { echo "SERVER FAILED TO START"; tail -5 /tmp/repro-server.log; exit 1; }
B="agent-browser"
$B set viewport 1366 860 >/dev/null
$B open http://127.0.0.1:$PORT >/dev/null 2>&1 || $B open http://localhost:$PORT
$B wait --load networkidle >/dev/null
# جلوگیری از باز شدن مودال یادآور تولد در فلوی تست — بعد از ورود، مودال را با ref پویا می‌بندیم
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "Admin@1405" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --text "تغییر رمز عبور" --timeout 15000
$B find role textbox fill "Admin@1405" --name "رمز فعلی"
$B find role textbox fill "New@1405!" --name "رمز جدید (حداقل ۶ نویسه)"
$B find role textbox fill "New@1405!" --name "تکرار رمز جدید"
$B find role button click --name "ثبت رمز جدید"
$B wait --text "ورود به برنامه" --timeout 15000
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "New@1405!" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --text "شرکت و سال مالی" --timeout 20000
sleep 2
echo "--- dismiss birthday modal (dynamic ref) ---"
REF=$($B snapshot -i 2>/dev/null | grep -E 'button "(بعداً|بستن|متوجه|فهمیدم|تائید)' | grep -oE '\[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
echo "dismiss-ref: $REF"
[ -n "$REF" ] && $B click @$REF
sleep 1
$B find role button click --name "شرکت و سال مالی"
sleep 1.5
$B find role button click --name "شرکت جدید"
$B wait --text "ثبت شرکت جدید" --timeout 8000
$B snapshot -i >/dev/null 2>&1

echo "--- TEST 1: dialog width (expect ~672) ---"
$B eval "Math.round(document.querySelector('[data-slot=\"dialog-content\"]').getBoundingClientRect().width)"

echo "--- TEST 2: empty-name save -> visible error toast ---"
$B find role button click --name "ذخیره"
sleep 1
$B eval "JSON.stringify([...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim().slice(0,60)))"

echo "--- TEST 3: valid save -> POST + dialog closes + success toast ---"
$B find role textbox fill "شرکت تستی پردیس" --name "مثال: آریان کویر رفسنجان"
$B find role textbox fill "10101234567" --name "۱۰۱۰۰۰۰۰۰۰۰"
$B find role button click --name "ذخیره"
sleep 2.5
$B eval "JSON.stringify({dialogOpen: !!document.querySelector('[data-slot=\"dialog-content\"]'), toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim().slice(0,60))})"
echo "=== network POST ==="
$B network requests --filter companies 2>&1 | grep POST | tail -2
echo "=== db check ==="
cd /home/z/my-project/webapp-standalone
DATABASE_URL="file:$(pwd)/db/payroll.db" node -e "
const {PrismaClient} = require('./node_modules/.prisma/client');
const p = new PrismaClient();
p.company.findMany({select:{id:true,name:true,nationalId:true},orderBy:{id:'asc'}}).then(r=>{console.log(JSON.stringify(r));process.exit(0)}).catch(e=>{console.log('ERR',e.message);process.exit(1)})
"
$B screenshot /tmp/verify-143.png --full
