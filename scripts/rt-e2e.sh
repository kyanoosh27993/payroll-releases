#!/bin/bash
# تست E2E کامل: لاگین → شرکت → سال مالی → پرسنل → شیفت → شیفت تک‌روزه → AI
set -u
cd /home/z/my-project
PORT=4399
rm -rf /tmp/rt-e2e && mkdir -p /tmp/rt-e2e/db
DBURL="file:/tmp/rt-e2e/db/payroll.db"
JAR=/tmp/rt-e2e/cookies.txt

DATABASE_URL="$DBURL" PORT=$PORT NODE_ENV=production HOSTNAME=127.0.0.1 node .next/standalone/server.js > /tmp/rt-server.log 2>&1 &
SRV=$!
sleep 4
B="http://127.0.0.1:$PORT"

j() { python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps(d,ensure_ascii=False)[:400])" 2>/dev/null; }

echo "--- login:"
curl -s -c $JAR -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@1405"}' | j
echo "--- change password:"
curl -s -b $JAR -c $JAR -X POST "$B/api/auth/change-password" -H 'Content-Type: application/json' -d '{"oldPassword":"Admin@1405","newPassword":"NewPass@1405"}' | j
echo "--- re-login:"
curl -s -c $JAR -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"NewPass@1405"}' | j
echo "--- create company:"
CID=$(curl -s -b $JAR -X POST "$B/api/companies" -H 'Content-Type: application/json' -d '{"name":"هتل تست آریان","nationalId":"1111111111"}' -o /tmp/rt-co.json -w "%{http_code}"); cat /tmp/rt-co.json | j; CID=$(cat /tmp/rt-co.json | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('company',d).get('id',0))" 2>/dev/null)
echo "companyId=$CID"
echo "--- create fy:"
FY=$(curl -s -b $JAR -X POST "$B/api/companies/$CID/fiscal-years" -H 'Content-Type: application/json' -d '{"jy":1405}')
echo "$FY" | j
FYID=$(echo "$FY" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('fy',d).get('id',1))" 2>/dev/null || echo 1)
echo "fyId=$FYID"
echo "--- create personnel:"
PID=$(curl -s -b $JAR -X POST "$B/api/personnel" -H 'Content-Type: application/json' -d "{\"companyId\":$CID,\"personnelCode\":\"1001\",\"firstName\":\"علی\",\"lastName\":\"محمدی\",\"cardNo\":\"777\",\"status\":\"شاغل\",\"nationalId\":\"9876543210\"}" -o /tmp/rt-pe.json -w "%{http_code}"); cat /tmp/rt-pe.json | j; PID=$(cat /tmp/rt-pe.json | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('personnel',d).get('id',0))" 2>/dev/null)
echo "personnelId=$PID"
echo "--- create shift:"
SID=$(curl -s -b $JAR -X POST "$B/api/shifts" -H 'Content-Type: application/json' -d "{\"companyId\":$CID,\"name\":\"شیفت صبح\",\"premiumPct\":10,\"schedule\":{\"0\":[480,960],\"1\":[480,960],\"2\":[480,960],\"3\":[480,960],\"4\":[480,960]}}" -o /tmp/rt-sh.json -w "%{http_code}"); cat /tmp/rt-sh.json | j; SID=$(cat /tmp/rt-sh.json | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('shift',d).get('id',0))" 2>/dev/null)
echo "shiftId=$SID"
echo "--- assign month:"
curl -s -b $JAR -X POST "$B/api/shifts/assign" -H 'Content-Type: application/json' -d "{\"personnelId\":$PID,\"jy\":1405,\"jm\":8,\"shiftId\":$SID}" | j
echo "--- override day 15 custom 10-18:"
curl -s -b $JAR -X POST "$B/api/shifts/override" -H 'Content-Type: application/json' -d "{\"personnelId\":$PID,\"jy\":1405,\"jm\":8,\"jd\":15,\"kind\":\"custom\",\"startMin\":600,\"endMin\":1080,\"note\":\"آموزش\"}" | j
echo "--- override day 16 off:"
curl -s -b $JAR -X POST "$B/api/shifts/override" -H 'Content-Type: application/json' -d "{\"personnelId\":$PID,\"jy\":1405,\"jm\":8,\"jd\":16,\"kind\":\"off\"}" | j
echo "--- override invalid (end<=start) expect 400:"
curl -s -b $JAR -o /dev/null -w "HTTP:%{http_code}\n" -X POST "$B/api/shifts/override" -H 'Content-Type: application/json' -d "{\"personnelId\":$PID,\"jy\":1405,\"jm\":8,\"jd\":17,\"kind\":\"custom\",\"startMin\":600,\"endMin\":500}"
echo "--- get overrides:"
curl -s -b $JAR "$B/api/shifts/override?companyId=$CID&jy=1405&jm=8" | j
echo "--- ai/chat: تعداد پرسنل"
curl -s -b $JAR -X POST "$B/api/ai/chat" -H 'Content-Type: application/json' -d "{\"message\":\"تعداد پرسنل\",\"companyId\":$CID,\"fyId\":$FYID}" | j
echo "--- ai/chat: شیفت روزانه (nav expected)"
curl -s -b $JAR -X POST "$B/api/ai/chat" -H 'Content-Type: application/json' -d '{"message":"چطور شیفت روزانه تعریف کنم؟","companyId":1,"fyId":1}' | j
echo "--- ai/chat: شیفت علی محمدی"
curl -s -b $JAR -X POST "$B/api/ai/chat" -H 'Content-Type: application/json' -d "{\"message\":\"شیفت علی محمدی\",\"companyId\":$CID,\"fyId\":$FYID}" | j
echo "--- ai/insights:"
curl -s -b $JAR "$B/api/ai/insights?fyId=$FYID&companyId=$CID" | j
echo "--- ai/config GET:"
curl -s -b $JAR "$B/api/ai/config" | j
echo "--- recalc attendance (no month, expect 200/404):"
curl -s -b $JAR -X POST "$B/api/attendance/recalc" -H 'Content-Type: application/json' -d '{"monthId":9999}' -o /dev/null -w "HTTP:%{http_code}\n"
tail -3 /tmp/rt-server.log
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
echo "=== E2E DONE"
