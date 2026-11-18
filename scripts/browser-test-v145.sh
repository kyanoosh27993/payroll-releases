#!/bin/bash
# تست مرورگری ۱.۴.۵ — ورود + داشبورد + جدول حقوق + دیالوگ مراحل محاسبه + فیش با عکس
set -e
cd /home/z/my-project/webapp-standalone
mkdir -p db
cp /tmp/test145.db db/browser145.db
DATABASE_URL="file:$(pwd)/db/browser145.db" NODE_ENV=production PORT=3242 node server.js > /tmp/webapp-br145.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3242/api/context && break || sleep 0.5; done
OUT=/home/z/my-project/download/preview-outputs
mkdir -p $OUT

B="agent-browser"
$B set viewport 1400 900 >/dev/null
$B open http://127.0.0.1:3242 >/dev/null 2>&1
$B wait --load networkidle >/dev/null 2>&1
$B find role textbox fill "admin" --name "نام کاربری" >/dev/null
$B find role textbox fill "New@1405!" --name "رمز عبور" >/dev/null || $B find role textbox fill "Admin@1405" --name "رمز عبور" >/dev/null
$B find role button click --name "ورود به برنامه" >/dev/null
sleep 2
# اگر باید رمز عوض شود
if $B eval "document.body.innerText.includes('تغییر رمز')" 2>/dev/null | grep -q true; then
  $B find role textbox fill "Admin@1405" --name "رمز فعلی" >/dev/null
  $B find role textbox fill "New@1405!" --name "رمز جدید (حداقل ۶ نویسه)" >/dev/null
  $B find role textbox fill "New@1405!" --name "تکرار رمز جدید" >/dev/null
  $B find role button click --name "ثبت رمز جدید" >/dev/null
  sleep 2
  $B find role textbox fill "admin" --name "نام کاربری" >/dev/null
  $B find role textbox fill "New@1405!" --name "رمز عبور" >/dev/null
  $B find role button click --name "ورود به برنامه" >/dev/null
fi
sleep 2
echo "AFTER-LOGIN: $($B eval 'location.href' 2>/dev/null)"

click_text() { $B eval "(() => { const els=[...document.querySelectorAll('button')]; const b=els.find(x=>x.textContent.replace(/\s+/g,' ').trim().includes('$1')); if(!b) return 'NOTFOUND:$1'; b.click(); return 'CLICKED:$1'; })()" ; }

# ۱) داشبورد — کارت جمع خالص → دیالوگ ریز محاسبه
sleep 1
$B screenshot "$OUT/v145-1-dashboard.png" >/dev/null
R=$(click_text "ریز محاسبه" || true)
# کارت‌ها div هستند — کلیک روی متن کارت
$B eval "(() => { const els=[...document.querySelectorAll('div')]; const c=els.find(x=>x.childElementCount===1 && x.className.includes('cursor-pointer')); if(!c) return 'NOCARD'; c.click(); return 'CARD-CLICKED'; })()"
sleep 1
$B screenshot "$OUT/v145-2-dashboard-trace.png" >/dev/null
$B eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='بستن'); if(b) b.click(); return 'CLOSED'; })()" >/dev/null
echo "DASH: $R"

# ۲) ماژول حقوق — جدول خلاصه → دکمه جزئیات محاسبه
click_text "محاسبه و فیش" >/dev/null || click_text "حقوق" >/dev/null
sleep 2
$B eval "(() => { const s=[...document.querySelectorAll('select')]; return 'selects:'+s.length; })()"
$B screenshot "$OUT/v145-3-payroll.png" >/dev/null
# انتخاب دوره اول از سلکت دوره
$B eval "(() => { const trig=document.querySelector('[data-slot=\"select-trigger\"]'); if(!trig) return 'NO-TRIGGER'; trig.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); trig.click(); return 'TRIG'; })()" >/dev/null
sleep 1
$B eval "(() => { const opts=[...document.querySelectorAll('[data-slot=\"select-item\"]')]; if(!opts.length) return 'NO-OPTS'; opts[0].click(); return 'OPT1'; })()" >/dev/null
sleep 2
$B screenshot "$OUT/v145-4-payroll-summary.png" >/dev/null
R2=$($B eval "(() => { const btns=[...document.querySelectorAll('button')].filter(x=>x.textContent.includes('محاسبه')); if(!btns.length) return 'NO-TRACE-BTN'; btns[btns.length-1].click(); return 'TRACE-CLICK:'+btns.length; })()")
echo "TRACE-BTN: $R2"
sleep 2
$B screenshot "$OUT/v145-5-payroll-trace-dialog.png" >/dev/null
echo DONE-ALL
