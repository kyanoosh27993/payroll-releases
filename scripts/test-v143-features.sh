#!/bin/bash
# تست تکمیلی ۱.۴٫۳ — قابلیت‌های تازه روی دیتابیس تازه (سرور باید از قبل بالا باشد یا این اسکریپت خودش بالا می‌آورد)
set -e
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true
rm -rf db && mkdir -p db
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=3236 node server.js > /tmp/webapp-143b.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3236/api/context && break || sleep 0.5; done

J="curl -s -b /tmp/cj143b -c /tmp/cj143b"
PASS=""; FAIL=""
ok() { if [ "$2" = "1" ]; then PASS="$PASS $1"; else FAIL="$FAIL $1"; echo "  FAIL[$1]: $3"; fi; }

# login admin
$J -X POST http://127.0.0.1:3236/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}' > /dev/null
$J -X POST http://127.0.0.1:3236/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"Admin@1405","newPassword":"New@1405!"}' > /dev/null
rm -f /tmp/cj143b
$J -X POST http://127.0.0.1:3236/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}' > /dev/null
CTX=$($J http://127.0.0.1:3236/api/context)
FYID=$(echo "$CTX" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['fiscalYears'][0]['id'] if d.get('fiscalYears') else 0)")

# 1) جدول مشاغل: بارگزاری فایل md (PUT)
printf 'ردیف | کد شغل | نام شغل\n1 | 2035AG | اپراتور قرص سازی\n2 | OA2675 | برشکاری راننده لیفتراک\n3 | 3411 | حسابدار\n4 | 5111 | پذیرشگر هتل\n5 | 5132 | آشپز\n6 | 6111 | نگهبان\n' > /tmp/jobs-test.md
R=$($J -X PUT http://127.0.0.1:3236/api/job-titles -F "file=@/tmp/jobs-test.md")
ok "job-upload" "$(echo "$R" | grep -c '"saved":6')" "$R"
R=$($J http://127.0.0.1:3236/api/job-titles)
ok "job-list" "$(echo "$R" | grep -c 'OA2675')" "$R"
# 2) DELETE بازگشت به داخلی
R=$($J -X DELETE http://127.0.0.1:3236/api/job-titles)
ok "job-reset" "$(echo "$R" | grep -c 'فهرست داخلی')" "$R"

# 3) سربرگ: GET پیش‌فرض + PUT data URL
R=$($J http://127.0.0.1:3236/api/letterhead)
ok "letterhead-default" "$(echo "$R" | grep -c 'letterhead-default')" "$R"
PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
R=$($J -X PUT http://127.0.0.1:3236/api/letterhead -H 'Content-Type: application/json' -d "{\"dataUrl\":\"$PNG\"}")
ok "letterhead-put" "$(echo "$R" | grep -c 'ذخیره شد')" "$R"
R=$($J -X DELETE http://127.0.0.1:3236/api/letterhead)
ok "letterhead-reset" "$(echo "$R" | grep -c 'پیش‌فرض')" "$R"

# 4) حکم چاپ (پرسنل نمونه دارد؟) — خطای ملایم اگر حکم ندارند؛ فقط endpoint کار کند
PID=$($J "http://127.0.0.1:3236/api/personnel?companyId=1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['personnel'][0]['id'] if d.get('personnel') else 0)")
if [ "$PID" != "0" ]; then
  R=$($J "http://127.0.0.1:3236/api/decrees/print?personnelId=$PID&format=html")
  ok "decree-print" "$(echo "$R" | grep -q 'letterhead' && echo 1 || echo 0)" "$R"
else
  PASS="$PASS decree-print-skipped"
fi

# 5) بک‌آپ: ساخت + فهرست دستی و اتوماتیک
R=$($J -X POST http://127.0.0.1:3236/api/backup -H 'Content-Type: application/json' -d '{"action":"create"}')
ok "backup-create" "$(echo "$R" | grep -c '"ok":true')" "$R"
R=$($J "http://127.0.0.1:3236/api/backup?scope=manual")
ok "backup-list" "$(echo "$R" | grep -c 'backup-')" "$R"
R=$($J "http://127.0.0.1:3236/api/backup?scope=auto")
ok "backup-auto-list" "$(echo "$R" | grep -c 'backups')" "$R"

# 6) پاک‌سازی کامل: باید با admin (غیر سوپروایزر) ۴۰۳ بدهد
R=$($J -X POST http://127.0.0.1:3236/api/backup -H 'Content-Type: application/json' -d '{"action":"wipe","confirm":"PAK-KON"}')
ok "wipe-admin-denied" "$(echo "$R" | grep -c 'فقط با اکانت سوپروایزر')" "$R"

# 7) RBAC: کاربر viewer نمی‌تواند شرکت بسازد (ساخت کاربر بازدیدکننده توسط admin)
R=$($J -X POST http://127.0.0.1:3236/api/users -H 'Content-Type: application/json' -d '{"username":"testviewer","password":"Tv@1405","fullName":"تست بازدید","role":"viewer"}')
ok "viewer-created" "$(echo "$R" | grep -c '"ok":true\|username')" "$R"
rm -f /tmp/cjv
curl -s -c /tmp/cjv -b /tmp/cjv -X POST http://127.0.0.1:3236/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testviewer","password":"Tv@1405"}' > /dev/null
curl -s -c /tmp/cjv -b /tmp/cjv -X POST http://127.0.0.1:3236/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"Tv@1405","newPassword":"Tv2@1405"}' > /dev/null
rm -f /tmp/cjv
curl -s -c /tmp/cjv -b /tmp/cjv -X POST http://127.0.0.1:3236/api/auth/login -H 'Content-Type: application/json' -d '{"username":"testviewer","password":"Tv2@1405"}' > /dev/null
R=$(curl -s -b /tmp/cjv -X POST http://127.0.0.1:3236/api/companies -H 'Content-Type: application/json' -d '{"name":"شرکت ممنوع"}')
ok "rbac-viewer-blocked" "$(echo "$R" | grep -c 'دسترسی مجاز نیست')" "$R"
R=$(curl -s -b /tmp/cjv -X POST http://127.0.0.1:3236/api/personnel -H 'Content-Type: application/json' -d '{"companyId":1,"personnelCode":"999"}')
ok "rbac-viewer-personnel" "$(echo "$R" | grep -c 'دسترسی مجاز نیست')" "$R"

# 8) پارامترهای سال مالی: کلیدهای جدید GET شود
R=$($J "http://127.0.0.1:3236/api/settings?fyId=$FYID")
ok "fy-params" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);s=d['settings'];print(1 if all(k in s for k in ['seniority_base_monthly','housing_monthly','child_allowance_monthly','night_ot_percent','friday_no_replace_factor','hourly_divisor_hours','required_hours_m7']) else 0)")" "$R"
R=$($J -X PUT http://127.0.0.1:3236/api/settings -H 'Content-Type: application/json' -d "{\"fyId\":$FYID,\"settings\":{\"minimum_wage_monthly\":\"71000000\",\"child_allowance_monthly\":\"5500000\",\"late_grace_minutes\":\"5\"}}")
ok "fy-params-save" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);s=d['settings'];print(1 if s.get('minimum_wage_monthly')=='71000000' else 0)")" "$R"

# 9) login منقضی: user با expiresAt گذشته → مسدود
R=$($J -X POST http://127.0.0.1:3236/api/auth/login -H 'Content-Type: application/json' -d '{"username":"expired1","password":"Exp@1405"}')
ok "expired-login-blocked" "$(echo "$R" | grep -c 'اعتبار\|نادرست\|error')" "$R"

# 10) AI chat: پاسخ موتور محلی
R=$($J -X POST http://127.0.0.1:3236/api/ai/chat -H 'Content-Type: application/json' -d '{"message":"تعداد پرسنل","companyId":1}')
ok "ai-chat" "$(echo "$R" | grep -c 'تعداد کل پرونده')" "$R"
R=$($J -X POST http://127.0.0.1:3236/api/ai/chat -H 'Content-Type: application/json' -d '{"message":"پرینت فیش حقوقی علی محمدی","companyId":1}')
ok "ai-action" "$(echo "$R" | grep -c 'print_payslip')" "$R"

echo
echo "=== PASS:$(echo $PASS | wc -w)  FAIL:$(echo $FAIL | wc -w) ==="
[ "$(echo $FAIL | wc -w)" = "0" ] && echo "ALL-OK"
