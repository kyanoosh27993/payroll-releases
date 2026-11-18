#!/bin/bash
# تست زمان اجرای v1.2.0 — همه قابلیت‌های جدید
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
PORT=3131
rm -f /tmp/v12-test.log /tmp/v12-cookies.txt
if [ -f .next/standalone/server.js ]; then
  PORT=$PORT NODE_ENV=production DATABASE_URL=$DATABASE_URL nohup node .next/standalone/server.js > /tmp/v12-test.log 2>&1 &
else
  PORT=$PORT DATABASE_URL=$DATABASE_URL nohup npx next start -p $PORT > /tmp/v12-test.log 2>&1 &
fi
for i in $(seq 1 40); do
  sleep 1
  curl -s -o /dev/null http://localhost:$PORT/api/context 2>/dev/null && break
done
echo "context:$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/api/context)"

LOGIN=$(curl -s -c /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin1405x"}')
echo "login:$(echo "$LOGIN" | head -c 80)"

# پاکسازی داده‌های تست قبلی (idempotent)
OLD=$(curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/personnel?companyId=1&q=9001" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const a=Array.isArray(j)?j:(j.personnel||[]);const x=a.find(p=>p.personnelCode==='9001');console.log(x?x.id:'')})")
[ -n "$OLD" ] && curl -s -b /tmp/v12-cookies.txt -X DELETE "http://localhost:$PORT/api/personnel/$OLD" > /dev/null

echo "--- گزاره ۱: کد ملی فیک باید رد شود (400) ---"
curl -s -b /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/personnel -H 'Content-Type: application/json' -d '{"companyId":1,"personnelCode":"9001","firstName":"تست","lastName":"فیک","nationalId":"1234567890","status":"شاغل"}' | head -c 150; echo
echo "--- کد ملی معتبر → 201 ---"
NEW=$(curl -s -b /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/personnel -H 'Content-Type: application/json' -d '{"companyId":1,"personnelCode":"9001","firstName":"تست","lastName":"معتبر","nationalId":"1368720242","status":"شاغل"}')
echo "$NEW" | head -c 120; echo
TESTPID=$(echo "$NEW" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).personnel.id)})")
echo "testPid=$TESTPID"
echo "--- پرسنل بدون کد ملی شاغل → 400 ---"
curl -s -b /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/personnel -H 'Content-Type: application/json' -d '{"companyId":1,"personnelCode":"9002","firstName":"بی","lastName":"کدملی","status":"شاغل"}' | head -c 130; echo

echo "--- گزاره ۲: شماره بیمه ۵ رقمی → ۱۰ رقم با صفر ---"
curl -s -b /tmp/v12-cookies.txt -X PUT "http://localhost:$PORT/api/personnel/$TESTPID" -H 'Content-Type: application/json' -d "{\"companyId\":1,\"personnelCode\":\"9001\",\"firstName\":\"تست\",\"lastName\":\"معتبر\",\"nationalId\":\"1368720242\",\"ssoNumber\":\"12345\",\"status\":\"شاغل\"}" > /dev/null
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/personnel/$TESTPID" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const p=JSON.parse(d).personnel;console.log('ssoNumber:',p.ssoNumber,'(باید 0000012345 باشد)')})"

echo "--- گزاره ۴: تاریخ ۸ رقمی — ذخیره با / (تست روی تاریخ استخدام) ---"
curl -s -b /tmp/v12-cookies.txt -X PUT "http://localhost:$PORT/api/personnel/$TESTPID" -H 'Content-Type: application/json' -d "{\"companyId\":1,\"personnelCode\":\"9001\",\"firstName\":\"تست\",\"lastName\":\"معتبر\",\"nationalId\":\"1368720242\",\"ssoNumber\":\"12345\",\"hireDate\":\"14040215\",\"status\":\"شاغل\"}" > /dev/null
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/personnel/$TESTPID" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const p=JSON.parse(d).personnel;console.log('hireDate:',p.hireDate,'(باید 1404/02/15 باشد)')})"

echo "--- گزاره ۶: تسویه حساب JSON ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/settlement?personnelId=1&toDate=1405/08/30" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);console.log('lines:',r.lines?.length,'| totalDue:',r.totalDue,'| net:',r.net,'| serviceYears:',r.serviceYears)})"
echo "--- تسویه حساب HTML ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/settlement?personnelId=1&format=html" | grep -c "امضا و اثر انگشت"

echo "--- گزاره ۵: تنظیمات اقلام فیش ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/payslip-extras?fyId=1" | head -c 200; echo
curl -s -b /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/payslip-extras -H 'Content-Type: application/json' -d '{"fyId":1,"options":{"month_days":true,"ot_rate":true,"eidi_ytd":true,"night_shifts":true}}' | head -c 80; echo
echo "--- محاسبه اقلام تکمیلی (دوره 1، پرسنل 2) ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/payslip-extras?periodId=1&personnelId=1" | head -c 300; echo

echo "--- گزاره ۷: آپلود فرم چاپی ---"
B64=$(printf 'test-form-content' | base64)
UP=$(curl -s -b /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/print-forms -H 'Content-Type: application/json' -d "{\"title\":\"فرم مرخصی تست\",\"fileName\":\"t.png\",\"dataBase64\":\"$B64\"}")
echo "$UP" | head -c 150; echo
FID=$(echo "$UP" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).form.id)})")
echo "--- دانلود فایل فرم (FID=$FID) ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/print-forms/$FID/file"; echo
echo "--- فهرست فرم‌ها ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/print-forms" | head -c 200; echo

echo "--- گزاره ۸: پیش‌نمایش قرارداد ساعتی (پرسنل 2) ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/contracts/generate?personnelId=1&kind=%D8%B3%D8%A7%D8%B9%D8%AA%DB%8C" | grep -c "قرارداد کار"
echo "--- پیش‌نمایش قرارداد مبلغ معین ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/contracts/generate?personnelId=1&kind=%D9%85%D8%A8%D9%84%D8%BA%20%D9%85%D8%B9%DB%8C%D9%86" | grep -c "مبلغ معین"
echo "--- قرارداد پایه (در صورت نبود) ---"
curl -s -b /tmp/v12-cookies.txt -X POST "http://localhost:$PORT/api/personnel/1/contracts" -H 'Content-Type: application/json' -d '{"contractType":"ساعتی","hourlyRate":3636364,"startDate":"1405/07/01","endDate":"1405/09/30"}' | head -c 100; echo
echo "--- ذخیره قرارداد هوشمند ساعتی ---"
curl -s -b /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/contracts/generate -H 'Content-Type: application/json' -d '{"personnelId":1,"kind":"ساعتی"}' | head -c 300; echo
echo "--- گزاره ۸: تغییر حکم → نسخه جدید قرارداد خودکار ---"
DID=$(curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/personnel/1/decrees" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.decrees[0]?.id||'')})")
curl -s -b /tmp/v12-cookies.txt -X PUT "http://localhost:$PORT/api/decrees/$DID" -H 'Content-Type: application/json' -d '{"effectiveDate":"1405/08/01","jobWage":800000000}' > /dev/null
node -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.contract.findMany({where:{personnelId:1,docKind:'ساعتی'},orderBy:{id:'desc'},take:3}).then(cs=>{
  console.log('ساعتی versions:', JSON.stringify(cs.map(c=>({id:c.id,periodKey:c.periodKey,isValid:c.isValid}))));
  process.exit(0);
})"
echo "--- فیش با اقلام تکمیلی (چک HTML) ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/exports/payslip?periodId=1&personnelId=1" | grep -c "اطلاعات تکمیلی کارکرد"

echo "--- گزارش مرکز هزینه هنوز سالم (رگرسیون) ---"
curl -s -b /tmp/v12-cookies.txt "http://localhost:$PORT/api/reports/cost-center?fyId=1&jy=1405&jm=7" -o /dev/null -w "cost-center:%{http_code}\n"
curl -s -b /tmp/v12-cookies.txt -X POST http://localhost:$PORT/api/ai/chat -H 'Content-Type: application/json' -d '{"message":"تعداد پرسنل چند نفر است؟"}' -o /dev/null -w "ai-chat:%{http_code}\n"

kill %1 2>/dev/null
echo "=== تست v1.2.0 تمام شد ==="
