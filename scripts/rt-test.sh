#!/bin/bash
# تست اجرای سرور production با دیتابیس تازه و قدیمی — تست سینک اجزا
set -u
cd /home/z/my-project

mode="${1:-fresh}"   # fresh | old
PORT=4399

if [ "$mode" = "old" ]; then
  # شبیه‌سازی دیتابیس قدیمی نسخه ۱.۱: حذف ShiftOverride و PrintForm و ستون‌های جدید
  rm -rf /tmp/rt-old && mkdir -p /tmp/rt-old/db
  DBURL="file:/tmp/rt-old/db/payroll.db"
else
  rm -rf /tmp/rt-test && mkdir -p /tmp/rt-test/db
  DBURL="file:/tmp/rt-test/db/payroll.db"
fi

echo "=== START server ($mode) DB=$DBURL"
DATABASE_URL="$DBURL" PORT=$PORT NODE_ENV=production HOSTNAME=127.0.0.1 node .next/standalone/server.js > /tmp/rt-server.log 2>&1 &
SRV=$!
sleep 4

echo "--- homepage:"
curl -s --max-time 15 -o /tmp/rt-home.html -w "HTTP:%{http_code}\n" "http://127.0.0.1:$PORT/"
echo "--- login attempt (triggers migrateIfNeeded):"
curl -s --max-time 20 -X POST "http://127.0.0.1:$PORT/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' -o /tmp/rt-login.json -w "HTTP:%{http_code}\n"
head -c 200 /tmp/rt-login.json; echo
echo "--- context:"
curl -s --max-time 20 "http://127.0.0.1:$PORT/api/context" -o /tmp/rt-ctx.json -w "HTTP:%{http_code}\n"
head -c 300 /tmp/rt-ctx.json; echo
echo "--- ai/chat (offline engine):"
curl -s --max-time 25 -X POST "http://127.0.0.1:$PORT/api/ai/chat" -H 'Content-Type: application/json' -d '{"message":"تعداد پرسنل","companyId":1,"fyId":1}' -o /tmp/rt-chat.json -w "HTTP:%{http_code}\n"
head -c 300 /tmp/rt-chat.json; echo
echo "--- ai/insights:"
curl -s --max-time 25 "http://127.0.0.1:$PORT/api/ai/insights?fyId=1&companyId=1" -o /tmp/rt-ins.json -w "HTTP:%{http_code}\n"
head -c 200 /tmp/rt-ins.json; echo

if [ "$mode" = "fresh" ]; then
  # تست API شیفت تک‌روزه: ایجاد شرکت/پرسنل موقت لازم است؛ فقط بررسی خطای پارامتر
  echo "--- shifts/override (validation error expected 400):"
  curl -s --max-time 20 -X POST "http://127.0.0.1:$PORT/api/shifts/override" -H 'Content-Type: application/json' -d '{}' -o /tmp/rt-ov.json -w "HTTP:%{http_code}\n"
  head -c 200 /tmp/rt-ov.json; echo
  echo "--- shifts/override GET:"
  curl -s --max-time 20 "http://127.0.0.1:$PORT/api/shifts/override?jy=1405&jm=8" -o /tmp/rt-ovg.json -w "HTTP:%{http_code}\n"
  head -c 200 /tmp/rt-ovg.json; echo
fi

echo "--- server log tail:"
tail -6 /tmp/rt-server.log
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null

echo "=== DB schema check ($mode)"
python3 - "$DBURL" <<'PYEOF'
import sqlite3, sys, re
url = sys.argv[1]
path = re.sub(r'^file:', '', url)
db = sqlite3.connect(path)
cur = db.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
print('tables:', len(tables))
for t in ['ShiftOverride','PrintForm','Personnel','User']:
    print(' ', t, 'OK' if t in tables else 'MISSING')
if 'ShiftOverride' in tables:
    print('  ShiftOverride cols:', [r[1] for r in cur.execute("PRAGMA table_info('ShiftOverride')")])
if 'User' in tables:
    print('  users:', cur.execute("SELECT COUNT(*) FROM User").fetchone()[0])
PYEOF
echo "=== DONE $mode"
