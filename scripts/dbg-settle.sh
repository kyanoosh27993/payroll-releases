#!/bin/bash
set -u
PORT=3231
BASE=http://127.0.0.1:$PORT
cd /home/z/my-project/.next/standalone
cp /home/z/my-project/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node node_modules/.prisma/client/ 2>/dev/null
KILLPIDS=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
[ -n "$KILLPIDS" ] && kill -9 $KILLPIDS 2>/dev/null
pkill -f "node server.js" 2>/dev/null; sleep 1.5
DATABASE_URL="file:/home/z/my-project/db/custom.db" NODE_ENV=production PORT=$PORT node server.js > /tmp/app1405d.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do curl -s -o /dev/null $BASE/api/context && break || sleep 0.5; done
B="agent-browser"
$B set viewport 1100 900 >/dev/null
$B open "$BASE/api/settlement?personnelId=1&toDate=1405%2F08%2F14&format=html" >/dev/null 2>&1
$B wait --load networkidle >/dev/null
$B eval "
(() => {
  const img = document.querySelector('img[alt=\"عکس پرسنلی\"]');
  const grid = document.querySelector('.box .grid');
  const cells = grid ? [...grid.children].map(c=>c.textContent.trim().slice(0,40)) : [];
  const box = document.querySelector('.box');
  const br = box ? box.getBoundingClientRect() : null;
  const out = {
    imgExists: !!img,
    imgComplete: img ? img.complete : null,
    imgNatural: img ? img.naturalWidth+'x'+img.naturalHeight : null,
    imgRect: img ? (r=>({t:Math.round(r.top),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}))(img.getBoundingClientRect()) : null,
    boxRect: br ? {t:Math.round(br.top),l:Math.round(br.left),w:Math.round(br.width),h:Math.round(br.height)} : null,
    cells
  };
  return JSON.stringify(out);
})()
"
kill -9 $SRV 2>/dev/null
echo DBG-DONE
