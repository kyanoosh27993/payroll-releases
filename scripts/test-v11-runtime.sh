#!/bin/bash
# تست زمان اجرای v1.1.0 — سرور + تست‌ها در یک دستور (سرور بین دستورها می‌میرد)
# تست‌های جدید: Explainable AI، گزارش مرکز هزینه، فیلد department پرسنل
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
PORT=3113
rm -f /tmp/v11-test.log
# شروع سرور پروداکشن از standalone اگر هست، وگرنه dev
if [ -f .next/standalone/server.js ]; then
  PORT=$PORT NODE_ENV=production DATABASE_URL=$DATABASE_URL nohup node .next/standalone/server.js > /tmp/v11-test.log 2>&1 &
else
  echo "standalone not found — using next dev"
  PORT=$PORT DATABASE_URL=$DATABASE_URL nohup npx next dev -p $PORT > /tmp/v11-test.log 2>&1 &
fi
SRV=$!
for i in $(seq 1 60); do
  sleep 1
  if curl -s -o /dev/null http://localhost:$PORT/api/context 2>/dev/null; then break; fi
done
echo "--- health ---"
curl -s -o /dev/null -w "context:%{http_code}\n" http://localhost:$PORT/api/context

echo "--- login ---"
LOGIN=$(curl -s -c /tmp/v11-cookies.txt -X POST http://localhost:$PORT/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN" | head -c 200; echo
curl -s -b /tmp/v11-cookies.txt -c /tmp/v11-cookies.txt -X POST http://localhost:$PORT/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"admin123","newPassword":"Admin1405x"}' | head -c 120; echo
LOGIN=$(curl -s -c /tmp/v11-cookies.txt -X POST http://localhost:$PORT/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin1405x"}')
echo "$LOGIN" | head -c 150; echo

echo "--- AI chat 1: تعداد پرسنل ---"
curl -s -b /tmp/v11-cookies.txt -X POST http://localhost:$PORT/api/ai/chat -H 'Content-Type: application/json' -d '{"message":"تعداد پرسنل چند نفر است؟"}' | head -c 400; echo

echo "--- AI chat 2: EXPLAINABLE — چرا مالیات محمدی؟ ---"
curl -s -b /tmp/v11-cookies.txt -X POST http://localhost:$PORT/api/ai/chat -H 'Content-Type: application/json' -d '{"message":"چرا مالیات آقای محمدی این‌قدر شد؟"}' | head -c 900; echo

echo "--- AI chat 3: توضیح محاسبه فیش ---"
curl -s -b /tmp/v11-cookies.txt -X POST http://localhost:$PORT/api/ai/chat -H 'Content-Type: application/json' -d '{"message":"توضیح محاسبه فیش علی محمدی"}' | head -c 600; echo

echo "--- personnel update department ---"
PID=$(curl -s -b /tmp/v11-cookies.txt "http://localhost:$PORT/api/personnel?companyId=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const arr=Array.isArray(j)?j:(j.personnel||j.rows||[]);console.log(arr.length?arr[0].id:'')})")
echo "personnelId=$PID"
ROW=$(curl -s -b /tmp/v11-cookies.txt "http://localhost:$PORT/api/personnel?companyId=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const arr=Array.isArray(j)?j:(j.personnel||j.rows||[]);console.log(JSON.stringify(arr[0]))})")
node -e "
const row=JSON.parse(process.argv[1]); row.department='پذیرش';
require('fs').writeFileSync('/tmp/v11-put.json', JSON.stringify(row));
" "$ROW"
curl -s -b /tmp/v11-cookies.txt -X PUT "http://localhost:$PORT/api/personnel/$PID" -H 'Content-Type: application/json' -d @/tmp/v11-put.json | head -c 150; echo
echo "verify department in list:"
curl -s -b /tmp/v11-cookies.txt "http://localhost:$PORT/api/personnel?companyId=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const arr=Array.isArray(j)?j:(j.personnel||j.rows||[]);console.log('department =', arr.find(x=>x.id===$PID).department)})"

echo "--- cost-center report 1405/07 ---"
curl -s -b /tmp/v11-cookies.txt "http://localhost:$PORT/api/reports/cost-center?fyId=1&jy=1405&jm=7" | head -c 600; echo

echo "--- cost-center report without params (must 400) ---"
curl -s -b /tmp/v11-cookies.txt "http://localhost:$PORT/api/reports/cost-center" | head -c 200; echo

echo "--- cost-center report unauthenticated (must 403) ---"
curl -s "http://localhost:$PORT/api/reports/cost-center?fyId=1&jy=1405&jm=7" | head -c 150; echo

echo "--- payroll calc still works (recalc draft period must be blocked — دوره نهایی) ---"
curl -s -b /tmp/v11-cookies.txt -X POST http://localhost:$PORT/api/payroll/calculate -H 'Content-Type: application/json' -d '{"periodId":1}' | head -c 200; echo

kill $SRV 2>/dev/null
sleep 1
echo "--- server log tail ---"
tail -5 /tmp/v11-test.log
