#!/bin/bash
# عیب‌یابی: ورود در viewport کوچک
set -u
PORT=3231
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/repro-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
B="agent-browser"
$B set viewport 1100 640 >/dev/null
$B open http://127.0.0.1:$PORT >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "Admin@1405" --name "رمز عبور"
$B screenshot /tmp/s1-login.png --full
$B find role button click --name "ورود به برنامه"
sleep 4
$B screenshot /tmp/s2-after-login.png --full
echo "=== URL ==="
$B get url
echo "=== toasts ==="
$B eval "JSON.stringify([...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim()))"
echo "=== body text sample ==="
$B eval "document.body.innerText.slice(0,600)"
echo "=== server log tail ==="
tail -20 /tmp/repro-server.log
