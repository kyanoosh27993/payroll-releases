#!/bin/bash
# تست جامع ۱٫۴٫۶ + تولید خروجی چهارگانه — یک‌بار اجرا (سرور بین فراخوانی‌ها می‌میرد)
set -u
cd /home/z/my-project/webapp-standalone
OUT=/home/z/my-project/download/preview-outputs
mkdir -p "$OUT"
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true

DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=3241 node server.js > /tmp/webapp-146.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3241/api/context && break || sleep 0.5; done

J="curl -s -b /tmp/cj146 -c /tmp/cj146"
rm -f /tmp/cj146
R=$($J -X POST http://127.0.0.1:3241/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}')
echo "$R" | grep -q NO_SESSION && { rm -f /tmp/cj146; $J -X POST http://127.0.0.1:3241/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}' > /dev/null; }
echo "CTX-VER: $($J http://127.0.0.1:3241/api/context | python3 -c "import sys,json;print(json.load(sys.stdin).get('version'))")"

PID=1
# ۱) بازمحاسبه حضور مهر
cd /home/z/my-project/webapp-standalone
AM=$(DATABASE_URL="file:$(pwd)/db/payroll.db" node -e "
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
db.attendanceMonth.findFirst({where:{jy:1405,jm:7}}).then(m=>{console.log(m.id);return db.payrollPeriod.update({where:{id:1},data:{status:'پیش‌نویس'}})}).then(()=>db.\$disconnect());
")
cd - > /dev/null
echo "ATT-MONTH: $AM"
$J -X POST http://127.0.0.1:3241/api/attendance/recalc -H 'Content-Type: application/json' -d "{\"monthId\":$AM}" > /tmp/recalc.json
echo "RECALC: $(cat /tmp/recalc.json | head -c 100)"
$J "http://127.0.0.1:3241/api/attendance/stats?monthId=$AM&personnelId=$PID" > /tmp/stats.json
echo "--- STATS ---"
python3 -m json.tool /tmp/stats.json | head -20

# ۲) محاسبه حقوق مهر
PER=$($J "http://127.0.0.1:3241/api/payroll/periods?fyId=1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps = d.get('periods') or d.get('rows') or []
for p in ps:
    if p.get('jm')==7 and p.get('jy')==1405: print(p['id']); break
")
echo "PERIOD: $PER"
$J -X POST http://127.0.0.1:3241/api/payroll/calculate -H 'Content-Type: application/json' -d "{\"periodId\":$PER}" > /tmp/calc.json
echo "CALC: $(head -c 200 /tmp/calc.json)"

# ۳) راستی‌آزمایی محاسبات (مقایسه با محاسبه مستقل)
$J "http://127.0.0.1:3241/api/payroll/summary?periodId=$PER" > /tmp/summary.json
$J "http://127.0.0.1:3241/api/payroll/lines?periodId=$PER&personnelId=1" > /tmp/lines.json
cd /home/z/my-project/webapp-standalone
DATABASE_URL="file:$(pwd)/db/payroll.db" node -e "
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
  const ev = await db.calendarEvent.findMany({where:{jy:1405,jm:7,kind:'holiday'},select:{jd:true}});
  require('fs').writeFileSync('/tmp/holidays.json', JSON.stringify(ev.map(e=>e.jd)));
  await db.\$disconnect();
})();
" > /dev/null 2>&1
cd - > /dev/null
python3 /home/z/my-project/scripts/verify-v146.py /tmp/summary.json /tmp/lines.json /tmp/stats.json /tmp/holidays.json

# ۴) خروجی چهارگانه
$J -o "$OUT/tmp-contract.docx" "http://127.0.0.1:3241/api/contracts/generate?personnelId=$PID&kind=%D8%B3%D8%A7%D8%B9%D8%AA%DB%8C&format=docx"
$J -o "$OUT/tmp-hokm.docx" "http://127.0.0.1:3241/api/decrees/print?personnelId=$PID&format=docx"
$J -o "$OUT/tmp-tasviye.docx" "http://127.0.0.1:3241/api/settlement?personnelId=$PID&toDate=1405%2F08%2F30&format=docx"
$J -o "$OUT/tmp-fish.html" "http://127.0.0.1:3241/api/exports/payslip?periodId=$PER&personnelId=$PID"
ls -la "$OUT"/tmp-*
echo "ALL-DONE"
