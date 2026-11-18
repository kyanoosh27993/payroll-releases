#!/bin/bash
# ثبت کامل اطلاعات فیک آقای محمدی در برنامه + عکس پرسنلی فیک + اسکرین‌شات خروجی‌ها
set -u
PORT=3231
BASE=http://127.0.0.1:$PORT
OUT=/home/z/my-project/download/preview-outputs
mkdir -p $OUT

# --- آماده‌سازی standalone ---
cd /home/z/my-project/.next/standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null

# کشتن سرور قدیمی روی پورت
KILLPIDS=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
[ -n "$KILLPIDS" ] && kill -9 $KILLPIDS 2>/dev/null
pkill -f "node server.js" 2>/dev/null; sleep 1.5

DATABASE_URL="file:/home/z/my-project/db/custom.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/app1405.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do curl -s -o /dev/null $BASE/api/context && break || sleep 0.5; done
echo "SERVER-UP pid=$SRV"

# --- آماده‌سازی payload پرسنل با عکس ---
python3 - <<'EOF'
import base64, json
b64 = base64.b64encode(open('/home/z/my-project/download/preview-outputs/fake-photo-3x4.jpg','rb').read()).decode()
p = {
  "personnelCode":"100","cardNo":"1234567",
  "firstName":"علی","lastName":"محمدی","fatherName":"رضا",
  "photo":"data:image/jpeg;base64,"+b64,
  "nationalId":"3050123451","idNumber":"3040","idSerial":"12345","idIssuePlace":"رفسنجان",
  "birthDate":"1368/05/12","birthPlace":"رفسنجان","gender":"مرد","maritalStatus":"متاهل","dependents":2,
  "education":"دیپلم","mobile":"09134567890",
  "jobTitle":"کارگر خدمات هتل","jobCode":"","department":"خدمات","costCenter":"خدمات","payslipGroup":"خدمات",
  "bankName":"بانک رفاه کارگران - شعبه رفسنجان","bankAccount":"418512090","bankSheba":"IR5505600000000041851209001",
  "ssoNumber":"36912345","ssoInsurer":"گردشگری و اقامتی آریان کویر رفسنجان",
  "militaryStatus":"معاف از خدمت","isVeteran":False,"workLocation":"هتل هیلان","permanentNight":False,
  "address":"رفسنجان، خیابان شهدا، پلاک ۲۵","postalCode":"7713896444",
  "insuranceType":2,"employmentType":1,"taxExemptionCode":1,
  "status":"شاغل","hireDate":"1404/01/01","endWorkDate":"","notes":"اطلاعات آزمایشی (فیک) برای تست نمایش عکس"
}
open('/tmp/personnel-payload.json','w').write(json.dumps(p, ensure_ascii=False))
dec = {"effectiveDate":"1405/01/01","jobWage":166255500,"seniorityWage":5000000,"housing":30000000,
       "food":22000000,"familyAllowance":5000000,"childAllowance":33251100,"workerBen":22000000,
       "notes":"حکم سال ۱۴۰۵ بر مبنای حداقل دستمزد مصوب شورای عالی کار"}
open('/tmp/decree-payload.json','w').write(json.dumps(dec, ensure_ascii=False))
con = {"contractType":"ماهانه ثابت","monthlyWage":0,"startDate":"1405/01/01","endDate":"1405/12/29",
       "payCycle":"ماهانه","insuranceRequired":True,"notes":"قرارداد موقت یک‌ساله ۱۴۰۵"}
open('/tmp/contract-payload.json','w').write(json.dumps(con, ensure_ascii=False))
print('PAYLOADS-OK', len(b64))
EOF

# --- ورود با API (رمز از قبل بازنشانی شده: New@1405!) ---
echo "--- login ---"
curl -s -c /tmp/cj2.txt -H 'Content-Type: application/json' -d '{"username":"admin","password":"New@1405!"}' $BASE/api/auth/login | head -c 200; echo

echo "--- PUT personnel 1 ---"
curl -s -b /tmp/cj2.txt -X PUT -H 'Content-Type: application/json' --data-binary @/tmp/personnel-payload.json $BASE/api/personnel/1 | python3 -c "import sys,json; d=json.load(sys.stdin); print('PUT-OK photo_len=', len(d.get('personnel',{}).get('photo','')) if 'personnel' in d else d)"
echo "--- POST decree ---"
curl -s -b /tmp/cj2.txt -X POST -H 'Content-Type: application/json' --data-binary @/tmp/decree-payload.json $BASE/api/personnel/1/decrees | head -c 200; echo
echo "--- POST base contract ---"
curl -s -b /tmp/cj2.txt -X POST -H 'Content-Type: application/json' --data-binary @/tmp/contract-payload.json $BASE/api/personnel/1/contracts | head -c 200; echo
echo "--- POST contracts/generate ---"
curl -s -b /tmp/cj2.txt -X POST -H 'Content-Type: application/json' -d '{"personnelId":1,"kind":"ماهانه"}' $BASE/api/contracts/generate | python3 -c "import sys,json; d=json.load(sys.stdin); print('GEN:', {k:(len(v) if isinstance(v,str) and len(v)>80 else v) for k,v in d.items() if k!='contract'})"

# --- مرورگر ---
B="agent-browser"
$B set viewport 1366 900 >/dev/null
$B open $BASE/ >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "New@1405!" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --load networkidle >/dev/null
sleep 2

click_text() {
  $B eval "(() => { const els=[...document.querySelectorAll('button,a')]; const b=els.find(x=>x.textContent.replace(/\s+/g,' ').trim().includes('$1')); if(!b) return 'NOTFOUND:$1'; b.click(); return 'CLICKED:$1'; })()"
}

echo "--- personnel module ---"
click_text "پرسنل"
sleep 1.5
$B eval "(() => { const inp=document.querySelector('input[placeholder*=\"جستجو\"], input[type=\"search\"]'); if(!inp) return 'NO-SEARCH'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'محمدی'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SEARCHED'; })()"
sleep 1.5
$B screenshot $OUT/app-1-personnel-list.png --full
$B eval "(() => { const btns=[...document.querySelectorAll('table button[title]')]; const b=btns.find(x=>(x.getAttribute('title')||'').includes('ویرایش')); if(!b) return 'NO-EDIT'; b.click(); return 'EDIT-CLICKED'; })()"
sleep 1.5
$B screenshot $OUT/app-2-personnel-form.png --full

echo "--- contract print ---"
$B open "$BASE/api/contracts/generate?personnelId=1&kind=%D9%85%D8%A7%D9%87%D8%A7%D9%86%D9%87&format=html" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-3-contract.png --full
echo "--- decree print ---"
$B open "$BASE/api/decrees/print?personnelId=1&format=html" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-4-hokm.png --full
echo "--- payslip print ---"
$B open "$BASE/api/exports/payslip?periodId=1&personnelId=1&paper=a4" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-5-fish.png --full
echo "--- settlement print ---"
$B open "$BASE/api/settlement?personnelId=1&toDate=1405%2F08%2F14&format=html" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B screenshot $OUT/app-6-tasviye.png --full

kill -9 $SRV 2>/dev/null
echo "ALL-DONE"
ls -la $OUT/app-*.png
