#!/bin/bash
# تست کامل fresh-DB نسخه 1.4.3 — همه تست‌ها در یک اجرا (سرور + curl)
set -e
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null || true
rm -rf db && mkdir -p db
rm -f recovery-key.txt

DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=3235 node server.js > /tmp/webapp-143.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3235/api/context && break || sleep 0.5; done

J="curl -s -b /tmp/cj143 -c /tmp/cj143"
PASS=""; FAIL=""
ok() { if [ "$2" = "1" ]; then PASS="$PASS $1"; else FAIL="$FAIL $1"; echo "  FAIL[$1]: $3"; fi; }

# ورود + تغییر رمز
R=$($J -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}')
ok "login" "$(echo "$R" | grep -c mustChangePassword)" "$R"
R=$($J -X POST http://127.0.0.1:3235/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"Admin@1405","newPassword":"New@1405!"}')
ok "change-password" "$(echo "$R" | grep -c '"ok":true')" "$R"
rm -f /tmp/cj143
R=$($J -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}')
ok "re-login" "$(echo "$R" | grep -c '"username":"admin"')" "$R"

# context + نسخه
R=$($J http://127.0.0.1:3235/api/context)
ok "context-143" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if d.get('version')=='1.4.4' and len(d.get('companies',[]))>=1 and any(f['jy']==1405 for f in d.get('fiscalYears',[])) else 0)")" "$R"
ok "seed-company" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if any('فرضی' in c['name'] for c in d.get('companies',[])) else 0)")" "$R"

# job-titles
R=$($J http://127.0.0.1:3235/api/job-titles)
ok "job-titles" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);t=d.get('titles',[]);print(1 if len(t)>=30 and all('code' in x for x in t) else 0)")" "$R"

# cost-centers GET + POST
R=$($J "http://127.0.0.1:3235/api/cost-centers?companyId=1")
ok "cost-centers-get" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if len(d.get('costCenters',[]))>=8 else 0)")" "$R"
R=$($J -X POST http://127.0.0.1:3235/api/cost-centers -H 'Content-Type: application/json' -d '{"fyId":1,"companyId":1,"costCenters":["پذیرش","خانه‌داری (هاوس‌کیپینگ)","رستوران","آشپزخانه","نگهبانی","حسابداری","فروشگاه","تاسیسات","انبار"]}')
ok "cost-centers-post" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if 'انبار' in d.get('costCenters',[]) else 0)")" "$R"

# payroll-groups POST (تعریف اول) + GET
R=$($J -X POST http://127.0.0.1:3235/api/payroll-groups -H 'Content-Type: application/json' -d '{"companyId":1,"name":"گروه اداری"}')
ok "payroll-groups-post" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if 'گروه اداری' in d.get('groups',[]) else 0)")" "$R"
R=$($J "http://127.0.0.1:3235/api/payroll-groups?companyId=1")
ok "payroll-groups-get" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if len(d.get('groups',[]))>=2 else 0)")" "$R"

# پرسنل نمونه — فیلدهای کلیدی گزاره‌ها
R=$($J "http://127.0.0.1:3235/api/personnel?companyId=1")
ok "personnel-seed" "$(echo "$R" | python3 -c "
import sys,json;d=json.load(sys.stdin);p=d['personnel']
ok=0
if p:
  x=p[0]
  ok=1 if (x['jobTitle'] and x['department'] and x['costCenter'] and x['payslipGroup'] and x['workLocation'] and x['militaryStatus'] and x['endWorkDate']) else 0
print(ok)")" "$R"

# شیفت‌ها + استثنای روزانه
R=$($J "http://127.0.0.1:3235/api/shifts?companyId=1")
ok "shifts-seed" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if len(d.get('shifts',[]))>=3 else 0)")" "$R"
R=$($J "http://127.0.0.1:3235/api/shifts/override?jy=1405&jm=8&personnelId=1")
ok "shift-override-seed" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);o=d.get('overrides',d.get('rows',[]));print(1 if o else 0)")" "$R"

# حضور و غیاب + بازمحاسبه
R=$($J "http://127.0.0.1:3235/api/attendance/months?fyId=1")
ok "att-months" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if len(d.get('months',[]))>=1 else 0)")" "$R"

# قرارداد و حکم
R=$($J "http://127.0.0.1:3235/api/personnel/1/contracts")
ok "contracts-seed" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if d.get('contracts') else 0)")" "$R"
R=$($J "http://127.0.0.1:3235/api/personnel/1/decrees")
ok "decrees-seed" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if d.get('decrees') else 0)")" "$R"

# دوره‌ها و محاسبه
R=$($J "http://127.0.0.1:3235/api/payroll/periods?fyId=1")
PID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);ps=d.get('periods',[]);print(ps[0]['id'] if ps else 0)")
ok "periods" "$([ "$PID" != "0" ] && echo 1 || echo 0)" "$R"
R=$($J -X POST http://127.0.0.1:3235/api/payroll/calculate -H 'Content-Type: application/json' -d "{\"periodId\":$PID}")
ok "payroll-calc" "$(echo "$R" | grep -c '"ok":true\|"periodId"')" "$R"

# NO_SESSION نبودن در همه خروجی‌ها (گزاره ۱۶)
for EP in "/api/exports/payslip?personnelId=1&periodId=$PID" "/api/contracts/generate?personnelId=1&kind=contract&format=html" "/api/settlement?personnelId=1&format=html"; do
  NAME=$(echo "$EP" | cut -d'?' -f1 | tr '/' '_')
  CODE=$(curl -s -b /tmp/cj143 -o "/tmp/f143$NAME" -w "%{http_code}" "http://127.0.0.1:3235$EP")
  BAD=$(grep -c "NO_SESSION" "/tmp/f143$NAME" || true)
  ok "print-no-session$NAME" "$([ "$CODE" = "200" ] && [ "$BAD" = "0" ] && echo 1 || echo 0)" "http=$CODE no_session=$BAD"
done

# گزارش عیدی/سنوات (گزاره ۱۴ — بدون خطا)
CODE=$(curl -s -b /tmp/cj143 -o /tmp/f143-eidi.json -w "%{http_code}" "http://127.0.0.1:3235/api/reports/eidi?fyId=1")
ok "eidi-report" "$([ "$CODE" = "200" ] && echo 1 || echo 0)" "$(head -c 200 /tmp/f143-eidi.json)"

# بازیابی رمز — endpoint عمومی
R=$(curl -s -X POST http://127.0.0.1:3235/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"username":"nobodyx"}')
ok "forgot-password-err" "$(echo "$R" | grep -c 'error\|یافت')" "$R"

# ============ ۱.۴.۳ — مدیریت کاربران و انقضای اعتبار اکانت ============
UID_BY_NAME() { echo "$1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for u in d.get('users',[]):
  if u['username']=='$2': print(u['id']); break"; }

R=$($J http://127.0.0.1:3235/api/users)
ok "users-list" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if any(u['username']=='admin' for u in d.get('users',[])) else 0)")" "$R"
ok "users-expiry-field" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);u=d['users'][0];print(1 if 'expiryJalali' in u and 'daysLeft' in u else 0)")" "$R"

# کاربر با تاریخ انقضای گذشته → ورود مسدود
R=$($J -X POST http://127.0.0.1:3235/api/users -H 'Content-Type: application/json' -d '{"username":"expired_user","password":"Test@1234","role":"viewer","fullName":"کاربر منقضی","expiresAt":"1405/01/01"}')
ok "create-expired-user" "$(echo "$R" | grep -c '"user":')" "$R"
R=$(curl -s -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"expired_user","password":"Test@1234"}')
ok "expired-login-blocked" "$(echo "$R" | grep -c 'اعتبار')" "$R"

# کاربر با تاریخ انقضای آینده → ورود آزاد
R=$($J -X POST http://127.0.0.1:3235/api/users -H 'Content-Type: application/json' -d '{"username":"valid_user","password":"Test@1234","role":"operator","fullName":"کاربر معتبر","expiresAt":"1406/06/01"}')
ok "create-valid-user" "$(echo "$R" | grep -c '"user":')" "$R"
R=$(curl -s -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"valid_user","password":"Test@1234"}')
ok "valid-user-login" "$(echo "$R" | grep -c '"username":"valid_user"')" "$R"

# تاریخ شمسی در لیست کاربران تبدیل شده باشد
R=$($J http://127.0.0.1:3235/api/users)
ok "expiry-jalali-1405" "$(echo "$R" | grep -c '"expiryJalali":"1405/01/01"')" "$R"
EXPIRED_ID=$(UID_BY_NAME "$R" "expired_user")
VALID_ID=$(UID_BY_NAME "$R" "valid_user")

# تمدید اعتبار کاربر منقضی (PUT expiresAt آینده) → ورود مجددا باز می‌شود
R=$($J -X PUT "http://127.0.0.1:3235/api/users/$EXPIRED_ID" -H 'Content-Type: application/json' -d '{"expiresAt":"1406/01/01"}')
ok "renew-expiry" "$(echo "$R" | grep -c '"ok":true')" "$R"
R=$(curl -s -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"expired_user","password":"Test@1234"}')
ok "renewed-login-ok" "$(echo "$R" | grep -c '"username":"expired_user"')" "$R"

# حذف محدودیت اعتبار (expiresAt خالی)
R=$($J -X PUT "http://127.0.0.1:3235/api/users/$EXPIRED_ID" -H 'Content-Type: application/json' -d '{"expiresAt":""}')
ok "clear-expiry" "$(echo "$R" | grep -c '"ok":true')" "$R"
R=$($J http://127.0.0.1:3235/api/users)
ok "expiry-now-empty" "$(echo "$R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(1 if all(u['expiresAt'] is None for u in d['users'] if u['username']=='expired_user') else 0)")" "$R"

# تغییر نام کاربری (نام ورود) بعد از تعریف
R=$($J -X PUT "http://127.0.0.1:3235/api/users/$VALID_ID" -H 'Content-Type: application/json' -d '{"username":"renamed_user"}')
ok "rename-user" "$(echo "$R" | grep -c '"ok":true')" "$R"
R=$(curl -s -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"renamed_user","password":"Test@1234"}')
ok "renamed-login-ok" "$(echo "$R" | grep -c '"username":"renamed_user"')" "$R"
# نام تکراری رد شود
R=$($J -X PUT "http://127.0.0.1:3235/api/users/$VALID_ID" -H 'Content-Type: application/json' -d '{"username":"admin"}')
ok "duplicate-username-rejected" "$(echo "$R" | grep -c 'قبلاً ثبت شده')" "$R"

# کاربر عادی (viewer) حق دیدن لیست کاربران ندارد
VUID=$(UID_BY_NAME "$($J http://127.0.0.1:3235/api/users)" "expired_user")
R=$(curl -s -c /tmp/cj143v -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"expired_user","password":"Test@1234"}')
R=$(curl -s -b /tmp/cj143v http://127.0.0.1:3235/api/users)
ok "viewer-cannot-list-users" "$(echo "$R" | grep -c 'دسترسی مجاز نیست')" "$R"
rm -f /tmp/cj143v

# سوپروایزر می‌تواند کاربران را مدیریت کند
rm -f /tmp/cj143s
R=$(curl -s -c /tmp/cj143s -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"supervisor","password":"Sup@1405!"}')
ok "supervisor-login" "$(echo "$R" | grep -c '"isSupervisor":true')" "$R"
R=$(curl -s -b /tmp/cj143s -c /tmp/cj143s -X POST http://127.0.0.1:3235/api/auth/change-password -H 'Content-Type: application/json' -d '{"oldPassword":"Sup@1405!","newPassword":"Sup@1405!x"}')
ok "supervisor-changepw" "$(echo "$R" | grep -c '"ok":true')" "$R"
rm -f /tmp/cj143s
R=$(curl -s -c /tmp/cj143s -X POST http://127.0.0.1:3235/api/auth/login -H 'Content-Type: application/json' -d '{"username":"supervisor","password":"Sup@1405!x"}')
R=$(curl -s -b /tmp/cj143s http://127.0.0.1:3235/api/users)
ok "supervisor-manages-users" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if any(u['username']=='admin' for u in d.get('users',[])) else 0)")" "$R"
# سوپروایزر اکانت خودش را در لیست نمی‌بیند و قابل حذف نیست
ok "supervisor-hidden-in-list" "$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(1 if not any(u['username']=='supervisor' for u in d.get('users',[])) else 0)")" "$R"
rm -f /tmp/cj143s

echo ""
echo "=== PASS:$(echo $PASS | wc -w)  FAIL:$(echo $FAIL | wc -w) ==="
[ -z "$FAIL" ] && echo "ALL-OK" || { echo "FAILED:$FAIL"; exit 1; }
