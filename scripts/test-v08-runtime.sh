#!/bin/bash
# تست زمان اجرای v0.8.0 — سرور + تست‌ها در یک دستور (سرور بین دستورها می‌میرد)
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
PORT=3111
rm -f /tmp/v08-test.log
# شروع سرور پروداکشن از standalone اگر هست، وگرنه dev
if [ -f .next/standalone/server.js ]; then
  PORT=$PORT NODE_ENV=production DATABASE_URL=$DATABASE_URL nohup node .next/standalone/server.js > /tmp/v08-test.log 2>&1 &
else
  echo "standalone not found — using next dev"
  PORT=$PORT DATABASE_URL=$DATABASE_URL nohup npx next dev -p $PORT > /tmp/v08-test.log 2>&1 &
fi
SRV=$!
# صبر برای بالا آمدن
for i in $(seq 1 60); do
  sleep 1
  if curl -s -o /dev/null http://localhost:$PORT/api/context 2>/dev/null; then break; fi
done
echo "--- health ---"
curl -s -o /dev/null -w "context:%{http_code}\n" http://localhost:$PORT/api/context

echo "--- login ---"
LOGIN=$(curl -s -c /tmp/v08-cookies.txt -X POST http://localhost:$PORT/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN" | head -c 200; echo
# تغییر رمز اجباری (اگر فعال باشد) و ورود مجدد
curl -s -b /tmp/v08-cookies.txt -c /tmp/v08-cookies.txt -X POST http://localhost:$PORT/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"admin123","newPassword":"Admin1405x"}' | head -c 120; echo
LOGIN=$(curl -s -c /tmp/v08-cookies.txt -X POST http://localhost:$PORT/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin1405x"}')
echo "$LOGIN" | head -c 150; echo

echo "--- fake identity headers must be ignored (login is public; test protected route) ---"
curl -s -b /tmp/v08-cookies.txt -H 'x-user-id: 999' -H 'x-user-role: admin' http://localhost:$PORT/api/users | head -c 120; echo

echo "--- opening balances CRUD ---"
PID=$(curl -s -b /tmp/v08-cookies.txt "http://localhost:$PORT/api/personnel?companyId=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const arr=Array.isArray(j)?j:(j.personnel||j.rows||[]);console.log(arr.length?arr[0].id:'')})")
echo "personnelId=$PID"
OB=$(curl -s -b /tmp/v08-cookies.txt -X POST "http://localhost:$PORT/api/personnel/$PID/opening-balances" -H 'Content-Type: application/json' -d '{"title":"مانده مرخصی ۱۴۰۴","kind":"leave_balance","unit":"days","amount":12.5,"effect":"none"}')
echo "$OB" | head -c 200; echo
OBID=$(echo "$OB" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).row.id))")
curl -s -b /tmp/v08-cookies.txt -X PUT "http://localhost:$PORT/api/personnel/$PID/opening-balances" -H 'Content-Type: application/json' -d "{\"id\":$OBID,\"title\":\"مانده مرخصی ۱۴۰۴ ویرایش\",\"kind\":\"leave_balance\",\"unit\":\"days\",\"amount\":13,\"effect\":\"none\"}" | head -c 150; echo
curl -s -b /tmp/v08-cookies.txt "http://localhost:$PORT/api/personnel/$PID/opening-balances" | head -c 300; echo

echo "--- eidi report ---"
FY=$(curl -s -b /tmp/v08-cookies.txt "http://localhost:$PORT/api/context" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.activeFyId||'')})")
echo "fyId=$FY"
curl -s -b /tmp/v08-cookies.txt "http://localhost:$PORT/api/reports/eidi?fyId=$FY" | head -c 400; echo

echo "--- cost centers ---"
curl -s -b /tmp/v08-cookies.txt "http://localhost:$PORT/api/reports/cost-centers?fyId=$FY" | head -c 300; echo

echo "--- backup create + list ---"
curl -s -b /tmp/v08-cookies.txt -X POST http://localhost:$PORT/api/backup -H 'Content-Type: application/json' -d '{"action":"create"}' | head -c 300; echo
curl -s -b /tmp/v08-cookies.txt http://localhost:$PORT/api/backup | head -c 300; echo

echo "--- period lock ---"
PER=$(node -e "const{PrismaClient}=require('/home/z/my-project/node_modules/@prisma/client');const db=new PrismaClient({datasources:{db:{url:'file:/home/z/my-project/db/custom.db'}}});db.payrollPeriod.findFirst().then(p=>{console.log(p?p.id:'');return db.\$disconnect()})")
echo "periodId=$PER"
echo "--- lock/unlock ---"
curl -s -b /tmp/v08-cookies.txt -X PUT http://localhost:$PORT/api/payroll/status -H 'Content-Type: application/json' -d "{\"periodId\":$PER,\"status\":\"نهایی\"}" | head -c 120; echo
curl -s -b /tmp/v08-cookies.txt -X PUT http://localhost:$PORT/api/payroll/status -H 'Content-Type: application/json' -d "{\"periodId\":$PER,\"status\":\"قفل‌شده\"}" | head -c 120; echo
echo "unlock without reason (must fail 400):"
curl -s -b /tmp/v08-cookies.txt -X PUT http://localhost:$PORT/api/payroll/status -H 'Content-Type: application/json' -d "{\"periodId\":$PER,\"status\":\"پیش‌نویس\"}" | head -c 160; echo
echo "unlock with reason (must succeed):"
curl -s -b /tmp/v08-cookies.txt -X PUT http://localhost:$PORT/api/payroll/status -H 'Content-Type: application/json' -d "{\"periodId\":$PER,\"status\":\"پیش‌نویس\",\"reason\":\"اصلاح مانده مرخصی درخواست مدیر\"}" | head -c 120; echo

echo "--- payslip HTML (a4) ---"
curl -s -b /tmp/v08-cookies.txt "http://localhost:$PORT/api/exports/payslip?periodId=$PER&paper=a4" | head -c 200; echo

echo "--- opening balance delete ---"
curl -s -b /tmp/v08-cookies.txt -X DELETE "http://localhost:$PORT/api/personnel/$PID/opening-balances?id=$OBID"; echo

kill $SRV 2>/dev/null
sleep 1
echo "--- server log tail ---"
tail -5 /tmp/v08-test.log
