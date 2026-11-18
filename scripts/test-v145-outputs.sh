#!/bin/bash
# تست زنده نسخه ۱.۴.۵ — خروجی ورد روی قالب رسمی کاربر + ردپای محاسبه + تسویه روزانه
set -e
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true
mkdir -p db
cp /tmp/test145.db db/test145.db 2>/dev/null || echo "no db"

DATABASE_URL="file:$(pwd)/db/test145.db" NODE_ENV=production PORT=3241 node server.js > /tmp/webapp-145.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3241/api/context && break || sleep 0.5; done

J="curl -s -b /tmp/cj145 -c /tmp/cj145"
rm -f /tmp/cj145
R=$($J -X POST http://127.0.0.1:3241/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}')
if echo "$R" | grep -q NO_SESSION; then
  rm -f /tmp/cj145
  R=$($J -X POST http://127.0.0.1:3241/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}')
fi
echo "LOGIN: $(echo "$R" | head -c 120)"
echo "CTX-VER: $($J http://127.0.0.1:3241/api/context | python3 -c "import sys,json;print(json.load(sys.stdin).get('version'))")"

# یافتن پرسنل علی محمدی
PID=$($J "http://127.0.0.1:3241/api/personnel?companyId=1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
rows = d.get('rows') or d.get('personnel') or d.get('rows') or []
for p in rows:
    if 'محمدی' in (p.get('lastName') or ''):
        print(p['id']); break
")
echo "PERSONNEL-ID: $PID"
if [ -z "$PID" ]; then echo "NO-PERSON — listing all:"; $J "http://127.0.0.1:3241/api/personnel?companyId=1" | head -c 400; exit 1; fi

# ۱) قرارداد docx (ساعتی)
$J -o /tmp/test-contract.docx "http://127.0.0.1:3241/api/contracts/generate?personnelId=$PID&kind=%D8%B3%D8%A7%D8%B9%D8%AA%DB%8C&format=docx"
echo "CONTRACT: $(file /tmp/test-contract.docx | head -c 100) size=$(stat -c%s /tmp/test-contract.docx)"

# ۲) حکم docx روی سربرگ
$J -o /tmp/test-decree.docx "http://127.0.0.1:3241/api/decrees/print?personnelId=$PID&format=docx"
echo "DECREE: $(file /tmp/test-decree.docx | head -c 100) size=$(stat -c%s /tmp/test-decree.docx)"

# ۳) تسویه docx روی سربرگ
$J -o /tmp/test-settle.docx "http://127.0.0.1:3241/api/settlement?personnelId=$PID&toDate=1405%2F08%2F30&format=docx"
echo "SETTLE: $(file /tmp/test-settle.docx | head -c 100) size=$(stat -c%s /tmp/test-settle.docx)"

# ۴) تسویه JSON — بررسی محاسبه روزانه + steps
$J "http://127.0.0.1:3241/api/settlement?personnelId=$PID&toDate=1405%2F08%2F30" > /tmp/settle.json
python3 - <<'PYEOF'
import json
d = json.load(open('/tmp/settle.json'))
print('serviceDays:', d.get('serviceDays'), '| daysThisYear:', d.get('daysThisYear'), '| mizanDaily:', d.get('mizanDaily'))
for l in d['lines']:
    print(f"  {l['title']}: {l['amount']:,.0f} ({'+' if l['sign']==1 else '-'}) steps={len(l.get('steps') or [])}")
print('totalDue:', d['totalDue'], 'totalDeduct:', d['totalDeduct'], 'net:', d['net'])
PYEOF

# ۵) ردپای محاسبه (بعد از یافتن دوره محاسبه‌شده)
PER=$($J "http://127.0.0.1:3241/api/payroll/periods?fyId=1" | python3 -c "import sys,json;d=json.load(sys.stdin);ps=d.get('periods') or d.get('rows') or [];print(ps[0]['id'] if ps else '')")
echo "PERIOD-ID: $PER"
if [ -n "$PER" ]; then
  $J "http://127.0.0.1:3241/api/payroll/trace?periodId=$PER&personnelId=$PID" > /tmp/trace.json
  python3 - <<'PYEOF'
import json
try:
    d = json.load(open('/tmp/trace.json'))
    tr = d.get('traces', {})
    print('TRACE keys:', len(tr), '| sample:', list(tr.keys())[:5])
    for k in list(tr.keys())[:3]:
        print(' ', k, '→', tr[k]['formula'][:50], '| steps:', len(tr[k]['steps']))
    print('summaryTraces:', list(d.get('summaryTraces', {}).keys()))
except Exception as e:
    print('TRACE-ERR:', e, open('/tmp/trace.json').read()[:200])
PYEOF
fi

# ۶) فیش — بررسی عکس + trace داخل HTML
$J "http://127.0.0.1:3241/api/exports/payslip?periodId=${PER:-1}&personnelId=$PID" > /tmp/fish.html
echo "FISH: size=$(stat -c%s /tmp/fish.html) photo=$(grep -c 'data:image' /tmp/fish.html || true) traceScript=$(grep -c 'var TRACES' /tmp/fish.html || true) amtClickable=$(grep -c 'class="amt"' /tmp/fish.html || true)"
echo "ALL-DONE"
