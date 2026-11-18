#!/bin/bash
# تست v4: سناریوی واقعی کاربر — دیتابیس خالی (seed شکست خورده) + viewport کوچک 1100x640
set -u
PORT=3231
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/repro-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
B="agent-browser"
$B set viewport 1100 640 >/dev/null
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
$B wait --text "شرکت و سال مالی" --timeout 30000
echo "=== state check ==="
$B eval "JSON.stringify({welcome: document.body.innerText.includes('خوش آمدید')})"

click_text() {
  $B eval "(() => { const els=[...document.querySelectorAll('button')]; const b=els.find(x=>x.textContent.replace(/\\s+/g,' ').trim().includes('$1')); if(!b) return 'NOTFOUND:$1'; b.click(); return 'CLICKED:$1'; })()"
}

echo "--- navigate: gate button if welcome, else sidebar module ---"
$B eval "
(() => {
  const els=[...document.querySelectorAll('button')];
  let b = els.find(x=>x.textContent.includes('رفتن به ثبت شرکت'));
  if (!b) b = els.find(x=>x.textContent.trim()==='شرکت و سال مالی');
  if (!b) return 'NOTFOUND-NAV';
  b.click();
  return 'CLICKED-NAV';
})()
"
echo "--- open new-company dialog ---"
sleep 1.5
click_text "شرکت جدید"
$B wait --text "ثبت شرکت جدید" --timeout 8000
echo "--- fill form via eval ---"
$B eval "
(() => {
  function setVal(el, v) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const dlg = document.querySelector('[data-slot=\"dialog-content\"]');
  const inputs = [...dlg.querySelectorAll('input')];
  const vals = ['شرکت تستی پردیس', '10101234567', '411223355', '2417', '318562', '2', '517380226', '1591634571', 'مدیر تست', '02188776655'];
  inputs.forEach((el, i) => { if (vals[i] !== undefined) setVal(el, vals[i]); });
  return 'filled ' + inputs.length + ' inputs';
})()
"
sleep 0.5
$B screenshot /tmp/company-empty-small.png --full
echo "--- dialog geometry at 1100x640 ---"
$B eval "
(() => {
  const dlg = document.querySelector('[data-slot=\"dialog-content\"]');
  if (!dlg) return JSON.stringify({error:'no dialog'});
  const dr = dlg.getBoundingClientRect();
  const btns = [...dlg.querySelectorAll('button')].map(b => {
    const r = b.getBoundingClientRect();
    const cx = r.x + r.width/2, cy = r.y + r.height/2;
    const top = document.elementFromPoint(cx, cy);
    return { text: b.textContent.trim().slice(0,20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      inDialog: (r.bottom <= dr.bottom + 2 && r.top >= dr.top - 2 && r.left >= dr.left - 2 && r.right <= dr.right + 2),
      topElem: top ? (top === b || b.contains(top) ? 'self' : top.tagName + '.' + String(top.className).slice(0,40)) : 'none' };
  });
  return JSON.stringify({ viewport: {w: innerWidth, h: innerHeight}, dialog: {x:Math.round(dr.x),y:Math.round(dr.y),w:Math.round(dr.width),h:Math.round(dr.height),scrollH:dlg.scrollHeight,clientH:dlg.clientHeight}, btns }, null, 1);
})()
"
echo "--- click save (eval) ---"
click_text "ذخیره"
sleep 3
echo "=== toasts ==="
$B eval "JSON.stringify([...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim()))"
echo "=== dialog still open? ==="
$B eval "JSON.stringify({dialogOpen: !!document.querySelector('[data-slot=\"dialog-content\"]')})"
echo "=== POST /api/companies network entries ==="
$B eval "JSON.stringify(performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/companies')).map(e=>({name:e.name.slice(-30),status:e.responseStatus})))"
echo "=== server log POST ==="
grep -A2 "POST /api/companies" /tmp/repro-server.log | tail -10
$B screenshot /tmp/after-save.png --full
