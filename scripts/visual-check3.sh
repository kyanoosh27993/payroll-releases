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

nav() {
  agent-browser eval "(() => { const btns=[...document.querySelectorAll('button, a, [role=menuitem]')]; const b=btns.find(x=>x.textContent.trim().includes('$1')); if(b){b.click(); return 'ok';} return 'not-found'; })()"
  sleep 2.5
}

nav "حقوق و دستمزد"
agent-browser screenshot /tmp/render/05-payroll.png
nav "قرارداد و احکام"
agent-browser screenshot /tmp/render/09-contracts.png
nav "حضور و غیاب"
agent-browser screenshot /tmp/render/06-attendance.png

agent-browser close
kill $SRV 2>/dev/null
ls -la /tmp/render/*payroll* /tmp/render/*contracts* /tmp/render/*attendance*
