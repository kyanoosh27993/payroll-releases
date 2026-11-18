#!/bin/bash
# تست لینوکسی پایگاه‌داده تازه نسخه 1.4.1 — اجرای واقعی سرور + curl
set -e
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true
rm -rf /tmp/freshtest && mkdir -p /tmp/freshtest/db
PORT=4899
DATABASE_URL="file:/tmp/freshtest/db/payroll.db" PORT=$PORT node server.js > /tmp/freshtest/server.log 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
for i in $(seq 1 40); do
  curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5
done
echo "--- login admin"
curl -s -c /tmp/freshtest/cookies -X POST http://127.0.0.1:$PORT/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}' | head -c 200; echo
echo "--- change password"
curl -s -b /tmp/freshtest/cookies -c /tmp/freshtest/cookies -X POST http://127.0.0.1:$PORT/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"Admin@1405","newPassword":"New@1405x"}' | head -c 120; echo
curl -s -c /tmp/freshtest/cookies -X POST http://127.0.0.1:$PORT/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405x"}' > /dev/null
echo "--- context"
curl -s -b /tmp/freshtest/cookies http://127.0.0.1:$PORT/api/context | head -c 300; echo
echo "--- personnel list"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/personnel?companyId=1" | head -c 600; echo
echo "--- cost-centers"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/cost-centers?companyId=1"; echo
echo "--- payroll-groups"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/payroll-groups?companyId=1"; echo
echo "--- shifts"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/shifts?companyId=1" | head -c 400; echo
echo "--- attendance daily sample"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/attendance?companyId=1&monthId=8" | head -c 400; echo
echo "--- attendance stats"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/attendance/stats?companyId=1&jy=1405&jm=8" | head -c 400; echo
echo "--- contracts of sample personnel"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/personnel/1/contracts" | head -c 400; echo
echo "--- decrees of sample personnel"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/personnel/1/decrees" | head -c 300; echo
echo "--- periods list"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/payroll/periods" | head -c 300; echo
echo "--- periods list"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/payroll/periods?fyId=1" | head -c 300; echo
echo "--- محاسبه دوره (periodId=8)"
curl -s -b /tmp/freshtest/cookies -X POST http://127.0.0.1:$PORT/api/payroll/calculate -H 'Content-Type: application/json' -d '{"periodId":8}' | head -c 300; echo
echo "--- payslip html (with session — نباید NO_SESSION باشد)"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/exports/payslip?personnelId=1&periodId=8" -o /tmp/freshtest/payslip.html -w "HTTP %{http_code} bytes %{size_download}\n"
grep -m1 -o "NO_SESSION" /tmp/freshtest/payslip.html || echo "NO NO_SESSION error"
echo "--- contract html"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/contracts/generate?personnelId=1&kind=contract&format=html" -o /tmp/freshtest/contract.html -w "HTTP %{http_code} bytes %{size_download}\n"
grep -m1 -o "NO_SESSION" /tmp/freshtest/contract.html || echo "NO NO_SESSION error"
echo "--- settlement html"
curl -s -b /tmp/freshtest/cookies "http://127.0.0.1:$PORT/api/settlement?personnelId=1&format=html" -o /tmp/freshtest/settle.html -w "HTTP %{http_code} bytes %{size_download}\n"
echo "--- payslip بدون نشست (باید NO_SESSION باشد — صحت میدلور)"
curl -s "http://127.0.0.1:$PORT/api/exports/payslip?personnelId=1" | head -c 120; echo
echo "--- forgot-password رمز غلط"
curl -s -X POST http://127.0.0.1:$PORT/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"username":"admin","adminPassword":"nope"}' | head -c 150; echo
echo "--- forgot-password رمز درست سوپروایزر"
curl -s -X POST http://127.0.0.1:$PORT/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"username":"admin","adminPassword":"Sup@1405!"}' | head -c 220; echo
echo "--- db:"; ls -la /tmp/freshtest/db/payroll.db
echo "--- seed check (sqlite)"
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient({datasources:{db:{url:'file:/tmp/freshtest/db/payroll.db'}}});
(async()=>{
 const [comp,fy,pers,sh,ov,att,con,dec]=await Promise.all([
  p.company.count(),p.fiscalYear.count(),p.personnel.count(),p.shift.count(),
  p.shiftOverride.count(),p.attendanceDaily.count(),p.contract.count(),p.decree.count()]);
 console.log(JSON.stringify({comp,fy,pers,sh,ov,att,con,dec}));
 await p.\$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
"
