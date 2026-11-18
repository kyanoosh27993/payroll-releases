#!/bin/bash
# تست مورد ۱۳ (۱.۴.۴) — انتقال داده‌ها از سال مالی قبل با تائید کاربر
# سناریو: سال ۱۴۰۵ seed → تغییر پله مالیاتی ۱۴۰۶ → ایجاد ۱۴۰۷ با carryFromPrevious → تطبیق
set -e
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true
rm -rf db && mkdir -p db
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=3237 node server.js > /tmp/webapp-144c.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3237/api/context && break || sleep 0.5; done

J="curl -s -b /tmp/cj144c -c /tmp/cj144c"
PASS=""; FAIL=""
ok() { if [ "$2" = "1" ]; then PASS="$PASS $1"; else FAIL="$FAIL $1"; echo "  FAIL[$1]: $3"; fi; }

# ورود
$J -X POST http://127.0.0.1:3237/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}' > /dev/null
$J -X POST http://127.0.0.1:3237/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"Admin@1405","newPassword":"New@1405!"}' > /dev/null
rm -f /tmp/cj144c
$J -X POST http://127.0.0.1:3237/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}' > /dev/null

# سال ۱۴۰۵ دموی seed
FYLIST=$($J http://127.0.0.1:3237/api/companies/1/fiscal-years)
ok "fy1405-exists" "$(echo "$FYLIST" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if any(f['jy']==1405 for f in d['fiscalYears']) else 0)")" "$FYLIST"

# تغییر یک پله مالیاتی در ۱۴۰۵ تا اثر انتقال قابل تشخیص باشد
TB05=$($J "http://127.0.0.1:3237/api/settings/tax-brackets?fyId=$(echo "$FYLIST" | python3 -c "import sys,json;print(next(f['id'] for f in json.load(sys.stdin)['fiscalYears'] if f['jy']==1405))")")
BID=$(echo "$TB05" | python3 -c "import sys,json;print(json.load(sys.stdin)['brackets'][0]['id'])")
R=$($J -X PUT "http://127.0.0.1:3237/api/settings/tax-brackets" -H 'Content-Type: application/json' -d '{"id":'"$BID"',"ratePercent":77.7}')
ok "set-tax-1405" "$(echo "$R" | grep -c '77.7')" "$R"

# ایجاد سال ۱۴۰۶ بدون انتقال (گروه کنترل) — پله باید پیش‌فرض باشد نه ۷۷.۷
R=$($J -X POST http://127.0.0.1:3237/api/companies/1/fiscal-years -H 'Content-Type: application/json' -d '{"jy":1406}')
ok "create-1406-nocarry" "$(echo "$R" | grep -c '"carried":\[\]')" "$R"
FY06=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['fiscalYear']['id'])")
R=$($J "http://127.0.0.1:3237/api/settings/tax-brackets?fyId=$FY06")
ok "nocarry-tax-default" "$(echo "$R" | grep -vc '77.7')" "$R"

# ایجاد سال ۱۴۰۷ با انتقال از آخرین سال قبل (۱۴۰۶) — پله‌ها باید پیش‌فرض منتقل شوند
# برای اثبات انتقال تنظیمات، پله ۱۴۰۶ را هم ۸۸.۸ می‌کنیم
TB06=$($J "http://127.0.0.1:3237/api/settings/tax-brackets?fyId=$FY06")
BID6=$(echo "$TB06" | python3 -c "import sys,json;print(json.load(sys.stdin)['brackets'][0]['id'])")
$J -X PUT "http://127.0.0.1:3237/api/settings/tax-brackets" -H 'Content-Type: application/json' -d '{"id":'"$BID6"',"ratePercent":88.8}' > /dev/null

R=$($J -X POST http://127.0.0.1:3237/api/companies/1/fiscal-years -H 'Content-Type: application/json' -d '{"jy":1407,"carryFromPrevious":true}')
ok "create-1407-carry" "$(echo "$R" | grep -c 'tax-brackets')" "$R"
FY07=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['fiscalYear']['id'])")

R=$($J "http://127.0.0.1:3237/api/settings/tax-brackets?fyId=$FY07")
ok "carry-tax-bracket-88.8" "$(echo "$R" | grep -c '88.8')" "$R"

# دوره‌های ۱۲گانه ۱۴۰۷ باید از قبل ساخته شده باشند
R=$($J "http://127.0.0.1:3237/api/payroll/periods?fyId=$FY07")
ok "carry-periods-12" "$(echo "$R" | python3 -c "import sys,json;print(1 if len(json.load(sys.stdin).get('periods',[]))>=12 else 0)")" "$R"

# تنظیمات سال ۱۴۰۷ باید منتقل شده باشد (کلیدهای FY_DEFAULTS موجود)
R=$($J "http://127.0.0.1:3237/api/settings?fyId=$FY07")
ok "carry-settings-keys" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);s=d.get('settings',{});print(1 if len(s)>=10 else 0)")" "$R"

echo
echo "=== PASS:$(echo $PASS | wc -w)  FAIL:$(echo $FAIL | wc -w) ==="
[ "$(echo $FAIL | wc -w)" = "0" ] && echo "ALL-OK"
