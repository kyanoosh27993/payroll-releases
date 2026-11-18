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

# باز کردن دستیار
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('دستیار هوشمند')); b?.click(); return b?'opened':'nf'; })()"
sleep 1.5
# ارسال پرسش نمونه کاربر
agent-browser eval "(() => { const i=document.querySelector('input[placeholder*=\"پرسش\"]'); if(!i) return 'no-input'; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'چجوری میتونم ساعات کاری پرسنل را ببینم یا اصلاح کنم؟'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'filled'; })()"
sleep 0.5
agent-browser eval "(() => { const f=document.querySelector('form'); const btn=f?.querySelector('button[type=submit]'); btn?.click(); return 'sent'; })()"
sleep 3
agent-browser screenshot /tmp/render/10-ai-answer.png

# کلیک روی دکمه ناوبری
agent-browser eval "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('رفتن به بخش')); if(!b) return 'no-nav-btn'; b.click(); return 'nav-clicked'; })()"
sleep 2
agent-browser screenshot /tmp/render/11-ai-navigated.png

agent-browser close
kill $SRV 2>/dev/null
ls -la /tmp/render/10-ai-answer.png /tmp/render/11-ai-navigated.png
