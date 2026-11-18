#!/bin/bash
# دیباگ لاگین: کنسول مرورگر + شبکه + اسکرین‌شات
set -u
PORT=3231
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/repro-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
B="agent-browser"
$B set viewport 1366 860 >/dev/null
$B open http://127.0.0.1:$PORT >/dev/null 2>&1 || $B open http://localhost:$PORT
$B wait --load networkidle >/dev/null
$B console --clear >/dev/null 2>&1

$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "Admin@1405" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
sleep 5
echo "=== URL ==="; $B get url
echo "=== snapshot ==="; $B snapshot -i -c 2>&1 | head -25
echo "=== console ==="; $B console 2>&1 | head -20
echo "=== page errors ==="; $B errors 2>&1 | head -10
echo "=== network ==="; $B network requests --filter auth 2>&1 | head -10
echo "=== server log tail ==="; tail -15 /tmp/repro-server.log
$B screenshot /tmp/repro-login.png --full
echo shot-saved
