#!/bin/bash
# تست مرورگری ۱.۴.۳ — ماژول مدیریت کاربران + تاریخ انقضای اعتبار + بنر ۷ روز مانده
set -u
PORT=3237
# کشتن هر سرور قدیمی روی همین پورت — نام پروسه next-server است و lsof آن را نمی‌بیند؛ با ss می‌کشیم
KILLPIDS=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
[ -n "$KILLPIDS" ] && kill -9 $KILLPIDS 2>/dev/null
pkill -f "node server.js" 2>/dev/null; sleep 1.5
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/users-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
B="agent-browser"
$B set viewport 1366 860 >/dev/null
$B open http://127.0.0.1:$PORT >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "Admin@1405" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --text "تغییر رمز عبور" --timeout 15000
$B find role textbox fill "Admin@1405" --name "رمز فعلی"
$B find role textbox fill "New@1405!" --name "رمز جدید (حداقل ۶ نویسه)"
$B find role textbox fill "New@1405!" --name "تکرار رمز جدید"
$B find role button click --name "ثبت رمز جدید"
sleep 2
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "New@1405!" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --text "شرکت و سال مالی" --timeout 20000

click_text() {
  $B eval "(() => { const els=[...document.querySelectorAll('button')]; const b=els.find(x=>x.textContent.replace(/\\s+/g,' ').trim().includes('$1')); if(!b) return 'NOTFOUND:$1'; b.click(); return 'CLICKED:$1'; })()"
}
# پر کردن ورودی i-ام دیالوگ با مقدار — سازگار با اینپوت‌های کنترل‌شده React
fill_input() {
  $B eval "(() => { const inps=[...document.querySelectorAll('[data-slot=\"dialog-content\"] input')]; const el=inps[$1]; if(!el) return 'NO-INPUT'; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(el,'$2'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'FILLED'; })()"
}
echo "--- nav to users module ---"
click_text "مدیریت کاربران"
sleep 1
echo "--- users table headers ---"
$B eval "JSON.stringify([...document.querySelectorAll('table th')].map(t=>t.textContent.trim()))"
echo "--- open new-user dialog ---"
click_text "کاربر جدید"
$B wait --text "کاربر جدید" --timeout 8000
echo "--- fill new user form (با تاریخ انقضا ۱۴۰۶/۰۱/۰۱) ---"
fill_input 0 "karbar1"
fill_input 1 "علی رضایی"
fill_input 2 "Test@1234"
fill_input 3 "1406/01/01"
echo "--- dialog buttons geometry (ثبت/انصراف داخل کادر و کلیک‌پذیر) ---"
$B eval "
(() => {
  const dlg = document.querySelector('[data-slot=\"dialog-content\"]');
  if (!dlg) return JSON.stringify({error:'no dialog'});
  const dr = dlg.getBoundingClientRect();
  const btns = [...dlg.querySelectorAll('button')].map(b => {
    const r = b.getBoundingClientRect();
    if (!b.textContent.trim()) return null;
    return { text: b.textContent.trim().slice(0,15), inDialog: (r.bottom <= dr.bottom + 2 && r.top >= dr.top - 2), topSelf: (() => { const t = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return t ? (t === b || b.contains(t)) : false; })() };
  }).filter(Boolean);
  return JSON.stringify(btns);
})()
"
echo "--- save user ---"
click_text "ثبت"
sleep 2
echo "=== toasts ==="
$B eval "JSON.stringify([...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim()))"
echo "=== users rows (username + expiry cell) ==="
$B eval "JSON.stringify([...document.querySelectorAll('table tbody tr')].map(r=>r.textContent.replace(/\\s+/g,' ').trim().slice(0,120)))"

echo ""
echo "--- تنظیم اعتبار admin به ۵ روز دیگر (نشست جاری حفظ می‌شود — فیکس ۱.۴.۳) ---"
FIVE=$(node -e "const J=require('/home/z/my-project/node_modules/jalaali-js'); const d=new Date(Date.now()+5*86400000); const j=J.toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate()); console.log(j.jy+'/'+String(j.jm).padStart(2,'0')+'/'+String(j.jd).padStart(2,'0'))")
echo "admin expiry = $FIVE"
$B eval "fetch('/api/users').then(r=>r.json()).then(d=>{const a=d.users.find(u=>u.username==='admin'); return fetch('/api/users/'+a.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresAt:'$FIVE'})}).then(r=>r.json())}).then(x=>JSON.stringify(x))"
sleep 1
$B eval "location.reload(); 'reloaded'"
$B wait --load networkidle >/dev/null
sleep 2
echo "=== expiry banner visible? ==="
$B eval "(() => { const b=document.querySelector('[data-slot=\"expiry-warning\"]'); return b ? 'BANNER: '+b.textContent.trim() : 'NO-BANNER'; })()"

echo ""
echo "--- منقضی‌کردن karbar1 (تاریخ گذشته) ---"
$B eval "fetch('/api/users').then(r=>r.json()).then(d=>{const a=d.users.find(u=>u.username==='karbar1'); return fetch('/api/users/'+a.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresAt:'1405/01/01'})}).then(r=>r.json())}).then(x=>JSON.stringify(x))"
$B eval "(()=>{const b=document.querySelector('button[title=\"خروج از حساب\"]'); if(b){b.click();return 'clicked'} return 'notfound'})()"
sleep 2
$B wait --text "ورود به برنامه" --timeout 15000
$B find role textbox fill "karbar1" --name "نام کاربری"
$B find role textbox fill "Test@1234" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
sleep 2
echo "=== login error message (اکانت منقضی) ==="
$B eval "(() => { const els=[...document.querySelectorAll('p,div,span')].filter(e=>e.textContent.includes('اعتبار') && e.children.length===0); return els.length ? 'MSG: '+els[0].textContent.trim().slice(0,140) : 'NO-MSG'; })()"

echo ""
echo "--- ورود مجدد admin → بنر ۷ روز مانده (اعتبار ۱۴۰۵/۰۹/۰۱ = ۵ روز دیگر) ---"
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "New@1405!" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --text "شرکت و سال مالی" --timeout 20000
sleep 1
echo "=== expiry banner visible? ==="
$B eval "(() => { const b=document.querySelector('[data-slot=\"expiry-warning\"]'); return b ? 'BANNER: '+b.textContent.trim() : 'NO-BANNER'; })()"
echo "=== console errors ==="
$B errors 2>&1 | tail -5
echo "=== screenshot ==="
$B screenshot /tmp/users-test.png --full
