#!/bin/bash
# انتشار ریلیز v1.4.7 — installer + source zip + ۴ فرم نمونه PDF (ماندگار روی گیت‌هاب)
set -e
TOKEN=$(grep -rhoE 'ghp_[A-Za-z0-9]{20,}' /home/z/my-project/scripts/ | head -1)
echo "$TOKEN" > /tmp/token147
DL=/home/z/my-project/download
VER=1.4.7
DATE=2026-11-18

BODY="نسخه ۱.۴.۷ — اصلاحات دقیق فرم‌ها طبق بازخورد کاربر (قرارداد / حکم / تسویه‌حساب / فیش)

**قرارداد:** عکس پرسنلی بالای صفحه اول سمت راست در فضای سفید سربرگ (باگ ذخیره رلیشن عکس رفع شد)؛ فقط بندهای ۱ تا ۱۱ در صفحه اول — صفحه دوم از «توافقات و شرایط کاری» شروع می‌شود؛ سطرهای جدول حقوق بلندتر و فاصله خطوط بالای جدول فشرده (چیدمان اجباری برای جا شدن بند ۱۱).
**حکم:** تاریخ و شماره سربرگ با رقم فارسی و فونت B Koodak؛ عرض همه جدول‌ها دقیقاً برابر عرض متن سربرگ (الاین کامل)؛ سلول «جمع کل حقوق ثابت و مزایای حکم» با سلول کناری مرج — بدون شکستگی متن.
**تسویه‌حساب:** هم‌عرضی کامل جدول‌ها؛ مرج شدن سطرهای جمع مطالبات / جمع بدهی (وام و مساعده) / خالص پرداخت؛ ارقام تاریخ با فونت کودک؛ متن اقرارنامه مطابق متن استاندارد فرم‌های رسمی تسویه‌حساب؛ جای امضا و اثر انگشت همکار و کارفرما با فضای کافی.
**فیش حقوقی:** لوگوی شرکت (نشان برش‌خورده از سربرگ رسمی) بالای فیش — باگ mime لوگو رفع شد.

فایل‌های نمونه خروجی (قرارداد، حکم، فیش، تسویه) به‌عنوان asset همین ریلیز ضمیمه‌اند."

# ۱) ساخت ریلیز با tag جدید
TAG="v$VER"
CREATE=$(curl -sS -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'tag_name': sys.argv[1], 'target_commitish': 'main', 'name': 'PayrollSystem v'+sys.argv[2], 'body': sys.argv[3]}))" "$TAG" "$VER" "$BODY")" \
  "https://api.github.com/repos/kyanoosh27993/payroll-releases/releases" -o /tmp/create-rel147.json)
REL=$(python3 -c "import json;d=json.load(open('/tmp/create-rel147.json'));print(d.get('id') or d)")
if [ "$REL" = "None" ] || [ -z "$REL" ]; then cat /tmp/create-rel147.json; exit 1; fi
echo "RELEASE-ID=$REL TAG=$TAG"

upload() {
  local f="$1"
  local name; name=$(basename "$f")
  local url=$(python3 -c "import json;d=json.load(open('/tmp/create-rel147.json'));print(d['upload_url'].split('{')[0] + '?name=' + '''$name''')")
  echo "  uploading $name ..."
  curl -sS -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/octet-stream" \
    --data-binary "@$f" "$url" -o "/tmp/up147-$name.json"
  python3 - "$name" <<'PYEOF'
import json, sys
name = sys.argv[1]
d = json.load(open(f'/tmp/up147-{name}.json'))
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

# ۲) راستی‌آزمایی دانلود واقعی
python3 - <<'PYEOF'
import urllib.request, json
rels = json.load(open('/tmp/create-rel147.json'))
for a in rels.get('assets', []):
    url = a['browser_download_url']
    req = urllib.request.Request(url, headers={'Authorization': 'token ' + open('/tmp/token147').read().strip()})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read(100)
            print(f"  VERIFY {a['name']}: HTTP {r.status} ({r.headers.get('Content-Length')} bytes total)")
    except Exception as e:
        print(f"  VERIFY-ERR {a['name']}: {e}")
PYEOF
echo "UPLOAD-DONE"
