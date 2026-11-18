#!/bin/bash
# ممیزی اجرایی دکمه‌ها ۰ تا ۱۰۰ — کلیک تک‌تک دکمه‌های همه ماژول‌ها روی دیتابیس یک‌بارمصرف
set -u
PORT=3232
# کشتن سرور قدیمی روی پورت (نام پروسه next-server است — با ss می‌کشیم)
KILLPIDS=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
[ -n "$KILLPIDS" ] && kill -9 $KILLPIDS 2>/dev/null
sleep 1
cd /home/z/my-project/webapp-standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
rm -rf db && mkdir -p db && rm -f recovery-key.txt
DATABASE_URL="file:$(pwd)/db/payroll.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/audit-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:$PORT/api/context && break || sleep 0.5; done
B="agent-browser"
# اگر مرورگر از اجرای قبلی با دیالوگ pending بلوکه شده، آن را ببند و صفحه تازه باز کن
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
$B wait --text "شرکت و سال مالی" --timeout 30000
sleep 1

# تزریق جمع‌کننده خطاهای سراسری + پاسخ خودکار confirm/alert (دیتابیس یک‌بارمصرف — حذف‌ها تأیید می‌شوند)
$B eval "(() => { window.__auditErrs=[]; window.addEventListener('error',e=>window.__auditErrs.push('ERR:'+String(e.message).slice(0,120))); window.addEventListener('unhandledrejection',e=>window.__auditErrs.push('REJ:'+String(e.reason).slice(0,120))); window.confirm=()=>true; window.alert=()=>{}; return 'hooks installed'; })()"

MODULES=("داشبورد" "پرسنل" "قرارداد و احکام" "شیفت‌های کاری" "حضور و غیاب" "محاسبه و فیش" "خروجیهای استاندارد" "گزارشساز" "تسویه حساب" "تقویم و تعطیلات" "شرکت و سال مالی" "تنظیمات" "پرینت فرمهای ضروری" "گزارش تغییرات (لاگ)" "مدیریت کاربران" "راهنما (F1)")

for MOD in "${MODULES[@]}"; do
  echo "###### MODULE: $MOD"
  $B eval "(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.textContent.replace(/\\s+/g,' ').trim().includes('$MOD')); if(!b) return 'MODNOTFOUND'; b.click(); return 'MOD-OK'; })()"
  sleep 2
  # فهرست دکمه‌های ناحیه main (فعال‌ها فقط)
  $B eval "
  (() => {
    const scope = document.querySelector('main');
    if (!scope) return '[]';
    const btns = [...scope.querySelectorAll('button')].filter(b => !b.disabled && b.getBoundingClientRect().width > 0);
    const seen = {};
    const list = btns.map(b => {
      const name = (b.textContent||'').replace(/\\s+/g,' ').trim() || ('title:'+(b.getAttribute('title')||'icon'));
      seen[name] = (seen[name]||0);
      const idx = seen[name]++;
      return { name, idx };
    });
    window.__btnList = list;
    return JSON.stringify(list.length);
  })()
  "
  # تکرار روی همه دکمه‌ها با خواندن از window.__btnList
  N=$($B eval "window.__btnList ? String(window.__btnList.length) : '0'" | tr -dc '0-9')
  echo "buttons: $N"
  for i in $(seq 0 $((N-1))); do
    NAME=$($B eval "window.__btnList[$i] ? window.__btnList[$i].name : ''" | tr -d '"' )
    IDXL=$($B eval "String(window.__btnList[$i] ? window.__btnList[$i].idx : 0)")
    [ -z "$NAME" ] && continue
    RES=$($B eval "
    (() => {
      const scope = document.querySelector('main');
      const name = ${NAME@Q};
      const idx = $IDXL;
      const btns = [...scope.querySelectorAll('button')].filter(b => !b.disabled && b.getBoundingClientRect().width > 0);
      const matches = btns.filter(b => ((b.textContent||'').replace(/\\s+/g,' ').trim() === name || ('title:'+(b.getAttribute('title')||'icon')) === name));
      const b = matches[idx];
      if (!b) return 'GONE';
      b.click();
      return 'CLICKED';
    })()
    ")
    sleep 0.6
    EFF=$($B eval "
    (() => {
      const dlg = !!document.querySelector('[data-slot=\"dialog-content\"]');
      const al = !!document.querySelector('[data-slot=\"alert-dialog-content\"]');
      const menu = !!document.querySelector('[data-slot=\"dropdown-menu-content\"], [data-radix-popper-content-wrapper] > *');
      const toasts = [...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent.trim().slice(0,70));
      const errs = (window.__auditErrs||[]).splice(0);
      return JSON.stringify({dlg, al, menu, toasts, errs});
    })()
    ")
    echo "BTN[$i] <$NAME> click=$RES eff=$EFF"
    # ریست UI: بستن دیالوگ/منو/تاییدیه
    $B eval "
    (() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
      const xc = document.querySelector('[data-slot=\"dialog-content\"] [data-slot=\"dialog-close\"]');
      if (xc) xc.click();
      const cans = [...document.querySelectorAll('[data-slot=\"alert-dialog-content\"] button')].find(b=>b.textContent.includes('انصراف'));
      if (cans) cans.click();
      return 'r';
    })()
    " >/dev/null
    sleep 0.4
  done
done

echo "###### FINAL ERRORS"
$B eval "JSON.stringify(window.__auditErrs||[])"
$B console 2>&1 | tail -15
$B errors 2>&1 | tail -10
echo "###### SERVER LOG (errors)"
grep -iE "error|prisma" /tmp/audit-server.log | grep -v "GET\|POST" | tail -10
echo "###### DONE"
pkill -f "PORT=$PORT" 2>/dev/null
kill %1 2>/dev/null
