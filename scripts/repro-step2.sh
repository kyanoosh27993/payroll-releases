#!/bin/bash
# ادامه بازتولید: تغییر رمز → ورود → ماژول شرکت → ثبت شرکت جدید
set -u
PORT=3231
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/repro-server.log 2>&1 &
SRV=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
echo "=== server up ==="
B="agent-browser"
$B set viewport 1366 860 >/dev/null
$B open http://127.0.0.1:$PORT >/dev/null 2>&1 || $B open http://localhost:$PORT
$B wait --load networkidle >/dev/null

echo "--- STEP 1: login ---"
$B find role textbox click --name "نام کاربری" >/dev/null
$B fill @e12 "admin"
$B fill @e13 "Admin@1405"
$B click @e14
sleep 2

echo "--- STEP 2: change password (refs from fresh snapshot) ---"
$B snapshot -i >/dev/null 2>&1
$B fill @e19 "Admin@1405"
$B fill @e20 "New@1405!"
$B fill @e21 "New@1405!"
$B click @e22
sleep 2

echo "--- STEP 3: re-login ---"
$B snapshot -i -c 2>&1 | grep -E "textbox|button" | head -8
$B fill @e12 "admin" 2>/dev/null
$B fill @e13 "New@1405!" 2>/dev/null
$B click @e14 2>/dev/null || $B find role button click --name "ورود به برنامه"
sleep 3
echo "--- after login: ---"
$B snapshot -i -c 2>&1 | head -30

echo "--- STEP 4: navigate to company module ---"
$B find text "شرکت و سال مالی" click 2>/dev/null || $B find role link click --name "شرکت و سال مالی" 2>/dev/null || $B find role button click --name "شرکت و سال مالی"
sleep 2
$B snapshot -i -c 2>&1 | head -25

echo "--- STEP 5: open new-company dialog ---"
$B find role button click --name "شرکت جدید"
sleep 1.5
$B snapshot -i 2>&1 | head -50
