#!/bin/bash
# تست زمان اجرا نسخه ۰.۷.۰ — سرور و تست‌ها در یک دستور (قاعده §۵)
cd /home/z/my-project/webapp-standalone
export PORT=3000
node server.js > /tmp/v07-server.log 2>&1 &
SRV=$!
PASS=0; FAIL=0
say() { echo "$1"; }

# صبر برای بالا آمدن سرور
for i in $(seq 1 40); do
  curl -s -o /dev/null http://127.0.0.1:3000/api/context && break
  sleep 0.5
done

# ۱) بدون نشست → 401
code=$(curl -s -o /tmp/v07-r1.json -w '%{http_code}' http://127.0.0.1:3000/api/personnel)
if [ "$code" = "401" ]; then say "PASS 1: بدون نشست → 401"; PASS=$((PASS+1)); else say "FAIL 1: بدون نشست کد=$code"; cat /tmp/v07-r1.json; FAIL=$((FAIL+1)); fi

# ۲) لاگین با admin (رمز فعلی دیتابیس موجود)
login=$(curl -s -c /tmp/v07-cookies.txt -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@1405"}')
echo "$login" | head -c 300; echo
if echo "$login" | grep -q '"ok":true\|"mustChangePassword"\|"token"'; then say "PASS 2: لاگین جواب می‌دهد"; PASS=$((PASS+1)); else say "FAIL 2: لاگین"; FAIL=$((FAIL+1)); fi

# اگر لاگین موفق بود، context را با نشست بگیر
if echo "$login" | grep -q '"ok":true'; then
  ctx=$(curl -s -b /tmp/v07-cookies.txt http://127.0.0.1:3000/api/context)
  echo "$ctx" | head -c 300; echo
  if echo "$ctx" | grep -q '0\.7\.0'; then say "PASS 3: نسخه در context = 0.7.0"; PASS=$((PASS+1)); else say "FAIL 3: نسخه"; FAIL=$((FAIL+1)); fi

  # ۴) ورود با نشست معتبر → 200
  code=$(curl -s -o /tmp/v07-r4.json -w '%{http_code}' -b /tmp/v07-cookies.txt http://127.0.0.1:3000/api/personnel)
  if [ "$code" = "200" ]; then say "PASS 4: با نشست → 200"; PASS=$((PASS+1)); else say "FAIL 4: با نشست کد=$code"; FAIL=$((FAIL+1)); fi

  # ۵) کاربران: سوپروایزر نباید در لیست باشد
  users=$(curl -s -b /tmp/v07-cookies.txt http://127.0.0.1:3000/api/users)
  if echo "$users" | grep -q 'supervisor'; then say "FAIL 5: سوپروایزر در لیست کاربران دیده می‌شود"; FAIL=$((FAIL+1)); else say "PASS 5: سوپروایزر مخفی است"; PASS=$((PASS+1)); fi

  # ۶) لاگ‌گیری کار کرد؟ (رویداد لاگین ثبت شده باشد)
  audit=$(curl -s -b /tmp/v07-cookies.txt "http://127.0.0.1:3000/api/audit?pageSize=5")
  if echo "$audit" | grep -q 'ورود'; then say "PASS 6: لاگ ورود ثبت شده"; PASS=$((PASS+1)); else say "WARN 6: لاگ ورود یافت نشد"; fi
fi

# ۷) فایل لاگ روزانه ساخته شده؟
ls /home/z/my-project/db/logs/ 2>/dev/null | tail -3

kill $SRV 2>/dev/null
echo "== RESULT: PASS=$PASS FAIL=$FAIL =="
tail -5 /tmp/v07-server.log
