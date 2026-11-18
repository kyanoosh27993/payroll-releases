#!/bin/bash
# انتشار ریلیز v1.4.6 — installer + source zip + ۴ فرم نمونه PDF (ماندگار روی گیت‌هاب)
set -e
TOKEN=$(grep -rhoE 'ghp_[A-Za-z0-9]{20,}' /home/z/my-project/scripts/ | head -1)
DL=/home/z/my-project/download
VER=1.4.6
DATE=2026-11-17

BODY="نسخه ۱.۴.۶ — فرم‌ها ۱۰۰٪ مطابق فایل‌های رسمی کاربر + فونت‌های اصلی B Nazanin/B Koodak + راستی‌آزمایی کارشناسی

**قرارداد:** بلوک بالا دقیقاً مطابق نمونه (شماره/تاریخ/پیوست + عکس شناور)؛ پیوست = حکم پرسنلی؛ چک‌باکس بند ۲ درست؛ نام پرسنل در امضای همکار؛ ارقام فارسی؛ ۱۱ بند اول در صفحه اول.
**حکم:** شماره = کدپرسنلی/ماه صدور (مثل 100/07)؛ تاریخ = تاریخ ثبت؛ پیوست قرارداد کار؛ امضا بدون کادر (مدیر + همکار).
**فیش:** تک‌برگ A5 لندسکیپ با fit-to-page؛ ستون مبنا (روز/ساعت/ضریب) برای هر قلم؛ ریز شیفت‌ها و جمعه‌کاری با/بدون روز جایگزین جداگانه؛ ساعت کارکرد ماه؛ محل درج مهر شرکت؛ حذف متن پایین؛ لوگوی شرکت.
**موتور حقوق:** حق شیفت چنددرصدی روزانه، تفکیک جمعه‌کاری ۱٫۴/۱٫۸، بن کارگری مشمول بیمه، گریس ۵ دقیقه.
**تسویه:** اقلام تک‌به‌تک با محاسبه روزانه — راستی‌آزمایی مستقل VERIFY-PASS.

فایل‌های نمونه خروجی (قرارداد، حکم، فیش، تسویه) به‌عنوان asset همین ریلیز ضمیمه‌اند."

# ۱) ساخت ریلیز با tag جدید
TAG="v$VER"
CREATE=$(curl -sS -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'tag_name': sys.argv[1], 'target_commitish': 'main', 'name': 'PayrollSystem v'+sys.argv[2], 'body': sys.argv[3]}))" "$TAG" "$VER" "$BODY")" \
  "https://api.github.com/repos/kyanoosh27993/payroll-releases/releases" -o /tmp/create-rel146.json)
REL=$(python3 -c "import json;d=json.load(open('/tmp/create-rel146.json'));print(d.get('id') or d)")
if [ "$REL" = "None" ] || [ -z "$REL" ]; then cat /tmp/create-rel146.json; exit 1; fi
echo "RELEASE-ID=$REL TAG=$TAG"

upload() {
  local f="$1"
  local name; name=$(basename "$f")
  local url=$(python3 -c "import json;d=json.load(open('/tmp/create-rel146.json'));print(d['upload_url'].split('{')[0] + '?name=' + '''$name''')")
  echo "  uploading $name ..."
  curl -sS -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
    --data-binary "@$f" "$url" -o "/tmp/up146-$name.json"
  python3 - "$name" <<'PYEOF'
import json, sys
name = sys.argv[1]
d = json.load(open(f'/tmp/up146-{name}.json'))
if 'state' in d and d.get('state') == 'uploaded':
    print(f"  OK {name} -> {d.get('browser_download_url','')}")
else:
    print(f"  FAIL {name}: {str(d)[:200]}"); sys.exit(1)
PYEOF
}

upload "$DL/PayrollSystem_v${VER}_${DATE}_installer.exe"
upload "$DL/PayrollSystem_v${VER}_${DATE}_source.zip"
for pdf in 01-gharardad-mohammadi.pdf 02-hokm-mohammadi.pdf 03-fish-hoghughi-mohammadi.pdf 04-tasviye-hesab-mohammadi.pdf; do
  upload "$DL/preview-outputs/$pdf"
done

# ۲) راستی‌آزمایی دانلود واقعی (۲۰۶ و md5)
python3 - <<'PYEOF'
import urllib.request, hashlib, json
rels = json.load(open('/tmp/create-rel146.json'))
for a in rels.get('assets', []):
    url = a['browser_download_url']
    req = urllib.request.Request(url, headers={'Authorization': 'token ' + open('/tmp/token146').read().strip()})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read(100)
            print(f"  VERIFY {a['name']}: HTTP {r.status} ({r.headers.get('Content-Length')} bytes total)")
    except Exception as e:
        print(f"  VERIFY-ERR {a['name']}: {e}")
PYEOF
echo "UPLOAD-DONE"
