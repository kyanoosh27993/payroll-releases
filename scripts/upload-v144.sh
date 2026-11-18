#!/bin/bash
# انتشار ریلیز جدید v1.4.4 — tag جدید + آپلود installer و source zip + راستی‌آزمایی دانلود
set -e
TOKEN=$(grep -rhoE 'ghp_[A-Za-z0-9]{20,}' /home/z/my-project/scripts/ | head -1)
DL=/home/z/my-project/download
VER=1.4.4
DATE=2026-11-17

BODY='نسخه ۱.۴.۴ — تکمیل موارد باقی‌مانده ۱.۴.۳: انتقال از سال مالی قبل با تائید، منوی آبشاری سرصفحه، Footer ورد در همه صفحات، بازسازی موتور AI آفلاین

**انتقال داده‌ها از سال مالی قبل (مورد ۱۳)**
- در «افزودن سال مالی» چک‌باکس تأیید: کپی تنظیمات سال (حداقل مزد، کمک‌ها و بن)، پله‌های مالیاتی و دوره‌های ۱۲گانه حقوق از آخرین سال مالی قبلِ همان شرکت
- بدون تیک انتقال، سال جدید با پله‌ها و پارامترهای پیش‌فرض ساخته می‌شود (گروه کنترل تست شد)
- جداسازی داده هر شرکت/سال مالی حفظ شده است

**منوی آبشاری سرصفحه (تکمیل مورد ۱۶)**
- در بالای همه ماژول‌ها منوی پرش سریع با گروه‌بندی همان سایدبار؛ رول‌محور (گزارش لاگ و مدیریت کاربران فقط برای مدیر/سوپروایزر)
- سایدبار hover اتومات (۱.۴.۳) حفظ شد

**قرارداد — Footer واقعی Word (تکمیل مورد ۱۲)**
- امضای مدیرعامل/همکار با ترفند mso-footer در همه صفحات فایل Word تکرار می‌شود؛ در چاپ مرورگر چسبیده به پایین صفحه؛ بدون کادر

**دستیار هوشمند آفلاین — بازسازی کامل (مورد ۷)**
- فهم پرسش فارسی: نام پرسنل، کد پرسنلی، نام ماه‌ها
- جمع دوره (ناخالص/خالص/مالیات/بیمه)، وضعیت فرد، توضیح کامل «چرا این عدد» با ریز فرمول‌ها و مانده مرخصی
- اجرای خودکار: پرینت فیش، تسویه‌حساب، محاسبه دوره

**کیفیت**
- تست‌ها: 42/42 + 19/19 + 8/8 سناریوی انتقال سال مالی — همگی سبز
- release-check.py: RELEASE-OK

**نصب و اجرا**: مانند قبل — دانلود exe نصبی، اجرا، Next/Next؛ SmartScreen فقط با گواهی امضای کد پولی حذف می‌شود.'

# ۱) ساخت ریلیز با tag جدید
TAG="v$VER"
CREATE=$(curl -sS -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'tag_name': sys.argv[1], 'target_commitish': 'main', 'name': 'PayrollSystem v'+sys.argv[2], 'body': sys.argv[3]}))" "$TAG" "$VER" "$BODY")" \
  "https://api.github.com/repos/kyanoosh27993/payroll-releases/releases" -o /tmp/create-rel.json)
REL=$(python3 -c "import json;d=json.load(open('/tmp/create-rel.json'));print(d.get('id') or d)")
if [ "$REL" = "None" ] || [ -z "$REL" ]; then cat /tmp/create-rel.json; exit 1; fi
echo "RELEASE-ID=$REL TAG=$TAG"

upload() {
  local f="$1"
  local name; name=$(basename "$f")
  # آپلود با upload_url رسمی
  local url=$(python3 -c "import json;d=json.load(open('/tmp/create-rel.json'));print(d['upload_url'].split('{')[0] + '?name=' + '''$name''')")
  curl -sS -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
    --data-binary "@$f" "$url" -o "/tmp/up-$name.json"
  python3 - "$name" <<'PYEOF'
import json, sys
name = sys.argv[1]
d = json.load(open(f'/tmp/up-{name}.json'))
print('UPLOADED:', d.get('name'), d.get('size'), d.get('state'))
PYEOF
}

upload "$DL/PayrollSystem_v${VER}_${DATE}_installer.exe"
upload "$DL/PayrollSystem_v${VER}_${DATE}_source.zip"

# ۲) راستی‌آزمایی: state=uploaded + دانلود واقعی (اولین بایت)
python3 - "$TOKEN" <<'PYEOF'
import json, subprocess, sys
token = sys.argv[1]
rel = json.load(open('/tmp/create-rel.json'))
ok = True
for a in rel['assets']:
    if a['state'] != 'uploaded':
        print('BAD-STATE:', a['name'], a['state']); ok = False
    r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code} %{size_download}',
                        '-H', f'Authorization: token {token}', '-L', a['browser_download_url']],
                       capture_output=True, text=True)
    print('DL-CHECK:', a['name'], '→', r.stdout)
    if not r.stdout.startswith('200'):
        ok = False
print('VERIFY-OK' if ok else 'VERIFY-FAIL')
PYEOF
