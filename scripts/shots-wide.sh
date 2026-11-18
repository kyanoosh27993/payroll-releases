#!/bin/bash
# اسکرین‌شات تمام‌عرض خروجی‌ها برای بررسی نمایش عکس پرسنلی
set -u
PORT=3231
BASE=http://127.0.0.1:$PORT
OUT=/home/z/my-project/download/preview-outputs
cd /home/z/my-project/.next/standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
KILLPIDS=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
[ -n "$KILLPIDS" ] && kill -9 $KILLPIDS 2>/dev/null
pkill -f "node server.js" 2>/dev/null; sleep 1.5
DATABASE_URL="file:/home/z/my-project/db/custom.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/app1405b.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do curl -s -o /dev/null $BASE/api/context && break || sleep 0.5; done
echo "SERVER-UP"

B="agent-browser"
$B set viewport 2400 1100 >/dev/null
$B open "$BASE/api/contracts/generate?personnelId=1&kind=%D9%85%D8%A7%D9%87%D8%A7%D9%86%D9%87&format=html" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-wide-contract.png --full
$B open "$BASE/api/decrees/print?personnelId=1&format=html" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-wide-hokm.png --full
$B open "$BASE/api/exports/payslip?periodId=1&personnelId=1&paper=a4" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-wide-fish.png --full
$B open "$BASE/api/settlement?personnelId=1&toDate=1405%2F08%2F14&format=html" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-wide-tasviye.png --full
# آیا عکس در HTML حکم/فیش/تسویه هست؟
for u in "api/decrees/print?personnelId=1&format=html" "api/exports/payslip?periodId=1&personnelId=1&paper=a4" "api/settlement?personnelId=1&toDate=1405%2F08%2F14&format=html"; do
  N=$(curl -s -b /tmp/cj2.txt "$BASE/$u" | grep -c 'img src="data:image')
  echo "IMG-IN-DATAURL $u = $N"
done
curl -s -b /tmp/cj2.txt "$BASE/api/settlement?personnelId=1&toDate=1405%2F08%2F14&format=html" | grep -o 'عکس پرسنلی\|عکس همکار\|photo' | sort | uniq -c
kill -9 $SRV 2>/dev/null
echo DONE
