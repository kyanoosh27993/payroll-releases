#!/bin/bash
# بازتولید مشکل کاربر: دیتابیس خالی → ثبت شرکت → دکمه ثبت کار نمی‌کند
set -u
PORT=3231
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/repro-server.log 2>&1 &
SRV=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
echo "=== server up (pid $SRV) ==="

B="agent-browser"
$B set viewport 1366 860 >/dev/null
$B open http://127.0.0.1:$PORT >/dev/null 2>&1 || $B open http://localhost:$PORT
$B wait --load networkidle >/dev/null

echo "--- STEP 1: login (mustChangePassword expected) ---"
$B snapshot -i -c 2>&1 | grep -E "textbox|button" | head -8
$B find label "نام کاربری" fill "admin" 2>/dev/null || $B find role textbox fill "admin" --name "نام کاربری"
$B find label "رمز عبور" fill "Admin@1405" 2>/dev/null
$B find role button click --name "ورود"
sleep 2
$B snapshot -i -c 2>&1 | grep -E "textbox|button|رمز|گذر" | head -10

echo "--- STEP 2: change password ---"
$B find label "رمز عبور فعلی" fill "Admin@1405" 2>/dev/null || true
$B snapshot -i -c 2>&1 | grep -E "textbox|button" | head -10
echo "--- (manual snapshot above; continue with refs) ---"
$B snapshot -i 2>&1 | head -40
