#!/bin/bash
# تست بصری جدول‌ها — سرور + مرورگر در یک نشست
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db" NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
node webapp-standalone/server.js > server-prod.log 2>&1 &
SRV=$!
sleep 3
rm -rf /tmp/render && mkdir -p /tmp/render

agent-browser set viewport 1560 900
agent-browser open http://127.0.0.1:3000/
agent-browser wait --load networkidle
sleep 2
agent-browser screenshot /tmp/render/01-dashboard.png

# صفحه پرسنل
agent-browser find text "پرسنل" click 2>/dev/null || agent-browser find role button click --name "پرسنل"
sleep 2
agent-browser screenshot /tmp/render/02-personnel.png

# صفحه حقوق و دستمزد
agent-browser find text "حقوق" click
sleep 2.5
agent-browser screenshot /tmp/render/03-payroll.png

# صفحه گزارش‌ساز + اجرای گزارش
agent-browser find text "گزارش" click
sleep 2
agent-browser find role button click --name "اجرای گزارش"
sleep 2.5
agent-browser screenshot /tmp/render/04-reports.png

agent-browser close
kill $SRV 2>/dev/null
ls -la /tmp/render/
