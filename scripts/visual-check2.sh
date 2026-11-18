#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/custom.db" NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
node webapp-standalone/server.js > server-prod.log 2>&1 &
SRV=$!
sleep 3
agent-browser set viewport 1560 900
agent-browser open http://127.0.0.1:3000/
agent-browser wait --load networkidle
sleep 2

agent-browser find text "حقوق و دستمزد" click
sleep 2.5
agent-browser screenshot /tmp/render/05-payroll.png

agent-browser find text "حضور و غیاب" click
sleep 2.5
agent-browser screenshot /tmp/render/06-attendance.png

agent-browser find text "تنظیمات" click
sleep 2.5
agent-browser screenshot /tmp/render/07-settings.png

# تست فیلتر ستون: در پرسنل فیلتر نام را باز و مقدار وارد کن
agent-browser find text "پرسنل" click
sleep 2
agent-browser eval "document.querySelectorAll('button[title=\"فیلتر این ستون\"]')[0]?.click()"
sleep 1
agent-browser eval "const i=document.querySelector('thead input'); if(i){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'بختیاری'); i.dispatchEvent(new Event('input',{bubbles:true}));}"
sleep 1.5
agent-browser screenshot /tmp/render/08-personnel-filtered.png

agent-browser close
kill $SRV 2>/dev/null
ls -la /tmp/render/
