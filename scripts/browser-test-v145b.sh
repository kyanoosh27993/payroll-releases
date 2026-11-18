#!/bin/bash
# فیش با عکس + کلیک روی مبلغ → مراحل محاسبه
set -e
cd /home/z/my-project/webapp-standalone
DATABASE_URL="file:$(pwd)/db/browser145.db" NODE_ENV=production PORT=3242 node server.js > /tmp/webapp-br145b.log 2>&1 &
SRV=$!
cleanup() { kill $SRV 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3242/api/context && break || sleep 0.5; done
OUT=/home/z/my-project/download/preview-outputs
B="agent-browser"
$B open "http://127.0.0.1:3242/api/exports/payslip?periodId=1&personnelId=1" >/dev/null
$B wait --load networkidle >/dev/null 2>&1 || sleep 2
sleep 1
$B screenshot "$OUT/v145-6-fish-with-photo.png" >/dev/null
# کلیک روی مبلغ اضافه‌کاری (خط‌چین)
$B eval "(() => { const els=[...document.querySelectorAll('.amt')]; const el=els.find(x=>x.dataset.code==='overtime') || els[3]; if(!el) return 'NO-AMT'; el.click(); return 'CLICKED:'+el.dataset.code; })()"
sleep 1
$B screenshot "$OUT/v145-7-fish-trace-overlay.png" >/dev/null
$B eval "(() => { const b=document.getElementById('traceClose'); if(b) b.click(); return 'CLOSED'; })()" >/dev/null
echo FISH-DONE
