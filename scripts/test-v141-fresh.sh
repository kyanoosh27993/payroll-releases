#!/bin/bash
# تست کامل fresh-DB با سشن کوکی — ورود + تغییر رمز + بررسی داده نمونه + AI + بازیابی رمز
set -e
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true
rm -rf db && mkdir -p db
rm -f recovery-key.txt

DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=3111 node server.js > /tmp/webapp-test.log 2>&1 &
SRV=$!
for i in $(seq 1 30); do sleep 1; curl -s -o /dev/null http://127.0.0.1:3111/api/context && break; done

J="curl -s -b /tmp/cj -c /tmp/cj"

echo "=== 1) login admin ==="
$J -X POST http://127.0.0.1:3111/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}' | head -c 200; echo

echo "=== 2) change password ==="
$J -X POST http://127.0.0.1:3111/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"Admin@1405","newPassword":"New@1405!"}' | head -c 200; echo

echo "=== 2b) re-login with new password ==="
rm -f /tmp/cj
$J -X POST http://127.0.0.1:3111/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}' | head -c 200; echo

echo "=== 3) context ==="
$J http://127.0.0.1:3111/api/context | python3 -c "import sys,json;d=json.load(sys.stdin);print('companies:',[(c['id'],c['name'][:35]) for c in d.get('companies',[])]);print('fiscalYears:',[(f['companyId'],f['jy']) for f in d.get('fiscalYears',[])]);print('version:',d.get('version'))"

echo "=== 4) personnel ==="
$J "http://127.0.0.1:3111/api/personnel?companyId=1" | head -c 300; echo

echo "=== 5) shifts ==="
$J "http://127.0.0.1:3111/api/shifts?companyId=1" | head -c 400; echo

echo "=== 6) attendance months ==="
$J "http://127.0.0.1:3111/api/attendance?fyId=1" | head -c 400; echo

echo "=== 7) contracts + decrees ==="
$J "http://127.0.0.1:3111/api/contracts?companyId=1" | head -c 250; echo
$J "http://127.0.0.1:3111/api/decrees?companyId=1" | head -c 250; echo

echo "=== 8) AI chat ==="
$J -X POST http://127.0.0.1:3111/api/ai/chat -H 'Content-Type: application/json' -d '{"message":"چند نفر پرسنل داریم؟","companyId":1,"fyId":1}' | head -c 500; echo

echo "=== 9) recovery-key file + recover endpoint ==="
ls -la recovery-key.txt 2>/dev/null && head -c 120 recovery-key.txt; echo
$J -X POST http://127.0.0.1:3111/api/auth/recover -H 'Content-Type: application/json' -d '{"username":"nobody","code":"bad","newPassword":"X@12345678"}' | head -c 200; echo

echo "=== 10) payroll periods ==="
$J "http://127.0.0.1:3111/api/payroll?fyId=1" | head -c 300; echo

kill $SRV 2>/dev/null || true
sleep 1
echo "=== log tail ==="
tail -3 /tmp/webapp-test.log
