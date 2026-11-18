#!/bin/bash
# بازتولید خروجی‌های چهارگانه (قرارداد/حکم/فیش/تسویه) + عکس‌ها برای جبران ۴۰۴
set -x
cd /home/z/my-project/webapp-standalone
OUT=/home/z/my-project/download/preview-outputs
mkdir -p "$OUT"

cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true
mkdir -p db
[ -f db/payroll.db ] || cp /home/z/my-project/db/custom.db db/payroll.db

DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=3241 node server.js > /tmp/webapp-404.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3241/api/context && break || sleep 0.5; done

J="curl -s -b /tmp/cj404 -c /tmp/cj404"
rm -f /tmp/cj404
R=$($J -X POST http://127.0.0.1:3241/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}')
echo "LOGIN1: $(echo "$R" | head -c 120)"
if echo "$R" | grep -q NO_SESSION; then
  rm -f /tmp/cj404
  R=$($J -X POST http://127.0.0.1:3241/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}')
  echo "LOGIN2: $(echo "$R" | head -c 120)"
fi
echo "CTX: $($J http://127.0.0.1:3241/api/context | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('version'))" 2>&1)"

PID=$($J "http://127.0.0.1:3241/api/personnel?companyId=1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rows = d.get('personnel') or d.get('rows') or []
for p in rows:
    if 'محمدی' in (p.get('lastName') or ''):
        print(p['id']); break
")
echo "PERSONNEL-ID: $PID"

# ۱) قرارداد docx
$J -o "$OUT/tmp-contract.docx" "http://127.0.0.1:3241/api/contracts/generate?personnelId=$PID&kind=%D8%B3%D8%A7%D8%B9%D8%AA%DB%8C&format=docx"
# ۲) حکم docx روی سربرگ
$J -o "$OUT/tmp-hokm.docx" "http://127.0.0.1:3241/api/decrees/print?personnelId=$PID&format=docx"
# ۳) تسویه docx روی سربرگ
$J -o "$OUT/tmp-tasviye.docx" "http://127.0.0.1:3241/api/settlement?personnelId=$PID&toDate=1405%2F08%2F30&format=docx"
# ۴) فیش HTML
PER=$($J "http://127.0.0.1:3241/api/payroll/periods?fyId=1" | python3 -c "import sys,json;d=json.load(sys.stdin);ps=d.get('periods') or d.get('rows') or [];print(ps[0]['id'] if ps else '')")
echo "PERIOD-ID: $PER"
$J -o "$OUT/tmp-fish.html" "http://127.0.0.1:3241/api/exports/payslip?periodId=${PER:-1}&personnelId=$PID"
ls -la "$OUT"/tmp-*
echo "ALL-DONE"
