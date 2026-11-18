#!/bin/bash
# وریفای دکمه بازگشایی قفل دوره — دیالوگ جدید جایگزین window.prompt
set -u
PORT=3232
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/unlock-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
B="agent-browser"
$B dialog dismiss >/dev/null 2>&1
$B dialog accept >/dev/null 2>&1
$B set viewport 1280 800 >/dev/null
$B open http://127.0.0.1:$PORT >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "Admin@1405" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --text "تغییر رمز عبور" --timeout 30000
$B find role textbox fill "Admin@1405" --name "رمز فعلی"
$B find role textbox fill "New@1405!" --name "رمز جدید (حداقل ۶ نویسه)"
$B find role textbox fill "New@1405!" --name "تکرار رمز جدید"
$B find role button click --name "ثبت رمز جدید"
sleep 2
$B find role textbox fill "admin" --name "نام کاربری"
$B find role textbox fill "New@1405!" --name "رمز عبور"
$B find role button click --name "ورود به برنامه"
$B wait --text "محاسبه و فیش" --timeout 30000
sleep 1

click_text() {
  $B eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.replace(/\\s+/g,' ').trim().includes('$1')); if(!b) return 'NOTFOUND:$1'; b.click(); return 'CLICKED:$1'; })()"
}

echo "--- go to payroll module ---"
click_text "محاسبه و فیش"
sleep 2
echo "--- lock the period ---"
click_text "قفل کردن دوره"
sleep 2
$B eval "JSON.stringify([...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim()))"
echo "--- click unlock (must open DIALOG, not prompt) ---"
click_text "بازگشایی قفل"
sleep 1.5
$B eval "JSON.stringify({dialogOpen: !!document.querySelector('[data-slot=\"dialog-content\"]'), title: (document.querySelector('[data-slot=\"dialog-title\"]')||{}).textContent || ''})"
echo "--- fill reason and confirm ---"
$B find role textbox fill "اصلاح تستی حضور و غیاب ماه" --name "دلیل بازگشایی"
click_text "بازگشایی قفل"
sleep 2
$B eval "JSON.stringify({dialogStillOpen: !!document.querySelector('[data-slot=\"dialog-content\"]'), toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim())})"
echo "--- window errors ---"
$B errors 2>&1 | tail -3
