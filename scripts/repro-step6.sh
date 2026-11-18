#!/bin/bash
# تست هسته v2: دیالوگ ثبت شرکت جدید + هندسه دکمه‌های ثبت/انصراف (ناوبری مقاوم با eval)
set -u
PORT=3231
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/repro-server.log 2>&1 &
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

echo "--- nav to company module (eval click) ---"
click_text "شرکت و سال مالی"
sleep 1
echo "--- open new-company dialog ---"
click_text "شرکت جدید"
$B wait --text "ثبت شرکت جدید" --timeout 8000
echo "--- fill form ---"
$B find role textbox fill "شرکت تستی پردیس" --name "مثال: آریان کویر رفسنجان"
$B find role textbox fill "10101234567" --name "۱۰۱۰۰۰۰۰۰۰۰"
$B screenshot /tmp/company-dialog.png --full
echo "--- dialog geometry (save/cancel buttons) ---"
$B eval "
(() => {
  const dlg = document.querySelector('[data-slot=\"dialog-content\"]');
  if (!dlg) return JSON.stringify({error:'no dialog'});
  const dr = dlg.getBoundingClientRect();
  const cs = getComputedStyle(dlg);
  const btns = [...dlg.querySelectorAll('button')].map(b => {
    const r = b.getBoundingClientRect();
    const st = getComputedStyle(b);
    // چه عنصری روی نقطه مرکز دکمه است؟
    const cx = r.x + r.width/2, cy = r.y + r.height/2;
    const top = document.elementFromPoint(cx, cy);
    return { text: b.textContent.trim().slice(0,20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      inDialog: (r.bottom <= dr.bottom + 2 && r.top >= dr.top - 2 && r.left >= dr.left - 2 && r.right <= dr.right + 2),
      topElem: top ? (top === b || b.contains(top) ? 'self' : top.tagName + '.' + String(top.className).slice(0,40)) : 'none' };
  });
  const foot = dlg.querySelector('[data-slot=\"dialog-footer\"]');
  const fr = foot ? foot.getBoundingClientRect() : null;
  return JSON.stringify({ dialog: {x:Math.round(dr.x),y:Math.round(dr.y),w:Math.round(dr.width),h:Math.round(dr.height),overflow:cs.overflow,display:cs.display,scrollH:dlg.scrollHeight,clientH:dlg.clientHeight}, footer: fr ? {y:Math.round(fr.y),h:Math.round(fr.height)} : null, btns }, null, 1);
})()
"
echo "--- click save (eval) ---"
click_text "ذخیره"
sleep 3
echo "=== toasts ==="
$B eval "JSON.stringify([...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim()))"
echo "=== dialog still open? ==="
$B eval "JSON.stringify({dialogOpen: !!document.querySelector('[data-slot=\"dialog-content\"]')})"
echo "=== companies in DB via API (in-browser fetch) ==="
$B eval "fetch('/api/companies').then(r=>r.json()).then(d=>JSON.stringify({count:(d.companies||[]).length, names:(d.companies||[]).map(c=>c.name)}))"
echo ""
echo "=== server log companies ==="
grep -i "companies" /tmp/repro-server.log | tail -5
echo "=== console ==="
$B console 2>&1 | tail -10
$B errors 2>&1 | tail -5
