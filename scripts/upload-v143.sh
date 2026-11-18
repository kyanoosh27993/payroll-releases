#!/bin/bash
# به‌روزرسانی ریلیز v1.4.3 با بیلد نهایی امروز: حذف assetهای قدیمی + آپلود جدید + راستی‌آزمایی
set -e
TOKEN=$(grep -rhoE 'ghp_[A-Za-z0-9]{20,}' /home/z/my-project/scripts/ | head -1)
REL=448474373
DL=/home/z/my-project/download

BODY='نسخه ۱.۴.۳ — پارامترهای قانونی سال مالی، مدیریت دیتابیس، سربرگ و احکام، ممیزی امنیتی، نصب Assisted

**محاسبات و پارامترها (۱۸ مورد درخواستی مدیریت)**
- پارامترهای سال مالی جداگانه برای هر شرکت/سال: حداقل دستمزد، پایه سنوات ماهانه/روزانه، حق مسکن، بن خواروبار، حق عائله‌مندی (فقط متاهل)، حق اولاد هر فرزند × تعداد فرزند پرونده
- فرمول‌های قانونی: مزد روزانه = ماهانه ÷ ۳۰؛ مزد ساعتی = روزانه ÷ ۷٫۳۳ (۱/۲۲۰ ماده ۵۹)؛ شب‌کاری موظفی ۳۵٪، غیرموظفی ۱۷۵٪؛ اضافه‌کاری ۱۴۰٪؛ جمعه‌کاری ۴۰٪ با تعطیلی جایگزین و ۱۸۰٪ بدون جایگزین؛ نوبت‌کاری ۱۰/۱۵/۲۲.۵٪؛ مزد مبنا فقط مزایای مستمر (بدون مسکن/بن/اولاد/تاهل)
- جدول ساعات موظفی سالانه اداره کار در تنظیمات هر سال (۱۲ ماه جداگانه)
- سورت پیش‌فرض کد پرسنلی صعودی در سرتاسر برنامه
- «گریس تاخیر/تعجیل» → «زمان تاخیر مجاز / زمان تعجیل مجاز» با پیش‌فرض ۵ دقیقه

**جدول مشاغل تامین اجتماعی**
- بارگزاری فایل دستی (xlsx/xls/csv/md/txt) در تنظیمات ← جدول مشاغل + جایگزینی کامل بدون اخلال
- پشتیبانی کد شغل حرف‌وعددی (2035AG، OA2675 و ...) — فیلد جدید jobCode پرسنل + فایل‌های استاندارد بیمه

**مدیریت دیتابیس (ماژول جدید)**
- بک‌آپ دستی + ذخیره در مسیر دلخواه، بازیابی و حذف با هشدار و تائید
- بک‌آپ اتوماتیک بی‌صدا پس از هر محاسبه حقوق و هنگام خروج از برنامه + حذف خودکار پس از ۳۰ روز + صفحه جداگانه
- پاک‌سازی کامل دیتابیس فقط با اکانت سوپروایزر (هشدار چندمرحله‌ای + تائید تایپی + بک‌آپ ایمن قبل از پاک‌سازی)
- رفع باگ مسیر فایل دیتابیس در نسخه نصبی (data/payroll.db)

**سربرگ، قرارداد و احکام**
- چاپ حکم پرسنلی داخل سربرگ (چاپ/PDF و Word) — دکمه جدید در تب احکام
- سربرگ رسمی شرکت (از فایل رسمی) به‌صورت پیش‌فرض + قابلیت جایگزینی در تنظیمات
- قرارداد: لوگو + حساب/شبا + آدرس + عکس پرسنلی + رفع برعکس‌شدن تاریخ در Word + امضا بدون کادر به‌صورت footer هر صفحه
- فرم تسویه‌حساب: عکس پرسنلی + شماره حساب/شبا برای واریز + توضیح پرداخت
- شماره پرسنلی = شماره قرارداد

**دستیار هوشمند آفلاین (ارتقا)**
- پاسخ با توضیح کامل «چرا این عدد» — تفکیک قلم به قلم و فرمول هر قلم
- کارهای روتین اتوماتیک با دکمه «اجرای خودکار»: پرینت فیش فلانی، تسویه‌حساب فلانی، فرم پرداخت بانک

**اقلام فیش حقوقی**
- ویرایش و افزودن قلم جدید (آموزش جزءبه‌جزء در راهنمای F1 — بخش محاسبه حقوق)

**ممیزی امنیتی کامل (دیدگاه نفوذگر؛ درپشتی سوپروایزر عمدا حفظ شد)**
- کنترل نقش به بیش از ۲۵ عملیات تغییردهنده اضافه شد (قبلا کاربر «بازدیدکننده» می‌توانست داده حذف کند!)
- محدودیت تلاش مسیر ریست رمز، رفع XSS اسناد چاپی، اعتبارسنجی تصاویر، سقف حجم بارگزاری، دانلود دیتابیس فقط مدیر، محدودیت ناوبری پنجره الکترون

**نصب و بسته‌بندی**
- نصاب Assisted (مسیر نصب + مراحل Next/Next) — فایل پرتابل دیگر تولید نمی‌شود
- حذف از Control Panel / Apps & Features ویندوز

**نصب و اجرا**: مانند قبل — دانلود exe نصبی، اجرا، Next/Next؛ SmartScreen فقط با گواهی امضای کد پولی حذف می‌شود (اعلام قبلی)'

curl -sS -X PATCH -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'body': sys.argv[1]}))" "$BODY")" \
  "https://api.github.com/repos/kyanoosh27993/payroll-releases/releases/$REL" \
  -o /tmp/patch-rel.json
python3 -c "import json;d=json.load(open('/tmp/patch-rel.json'));print('PATCHED:', d.get('tag_name'), '| body_len:', len(d.get('body','')))"

upload() {
  local f="$1"
  local name; name=$(basename "$f")
  # حذف asset قبلی با همین نام
  local AID
  AID=$(curl -sS -H "Authorization: token $TOKEN" "https://api.github.com/repos/kyanoosh27993/payroll-releases/releases/$REL/assets" | python3 -c "
import sys,json
for a in json.load(sys.stdin):
  if a['name']=='$name': print(a['id']); break")
  if [ -n "$AID" ]; then
    echo "deleting old asset $name (id=$AID)"
    curl -sS -X DELETE -H "Authorization: token $TOKEN" "https://api.github.com/repos/kyanoosh27993/payroll-releases/releases/assets/$AID" -o /dev/null -w "  delete status=%{http_code}\n"
    sleep 2
  fi
  echo "uploading $name ..."
  curl -sS -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$f" \
    "https://uploads.github.com/repos/kyanoosh27993/payroll-releases/releases/$REL/assets?name=$name" \
    -o /tmp/up.json
  python3 - "$f" <<'PY'
import json, hashlib, os, sys
local = sys.argv[1]
d = json.load(open('/tmp/up.json'))
if 'errors' in d:
    print('  UPLOAD FAILED:', json.dumps(d)[:300]); sys.exit(1)
lsha = hashlib.sha256(open(local,'rb').read()).hexdigest()
ok = (d.get('digest') or '').endswith(lsha)
print(f"  name={d['name']} state={d['state']} size={d['size']} (local={os.path.getsize(local)}) sha256_match={ok}")
if d['size'] != os.path.getsize(local): print('  SIZE MISMATCH!'); sys.exit(1)
if not ok: sys.exit(1)
PY
}

upload "$DL/PayrollSystem_v1.4.3_2026-11-17_installer.exe"
# پرتابل از نسخه ۱.۴٫۳ تولید نمی‌شود (درخواست کاربر)
upload "$DL/PayrollSystem_v1.4.3_2026-11-17_source.zip"
echo "ALL UPLOADS DONE"
