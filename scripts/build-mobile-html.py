# -*- coding: utf-8 -*-
"""Build single-file mobile HTML payroll app v1.4.0 with embedded real data."""
import json, io

d = json.load(open('/tmp/data14.json'))
jobs = json.load(open('/tmp/jobs14.json'))
people = d['people']; salaries = {s['code']: s for s in d['salaries']}

def num(v):
    try: return int(float(v))
    except: return 0

DATA = []
for p in people:
    s = salaries.get(p['code'], {})
    j = jobs.get(p['code'], {})
    DATA.append({
        'code': p['code'], 'first': p['first'], 'last': p['last'],
        'gender': p['gender'], 'marital': p['marital'], 'cost': p['cost'],
        'nid': p['nid'], 'phone': p['phone'], 'insNo': num(p['insNo']) or p['insNo'] if str(p['insNo']).isdigit() else p['insNo'],
        'bank': p['bank'], 'acc': p['acc'], 'fish': p['fish'], 'contract': p['contract'],
        'job': j.get('job',''), 'service': j.get('service',''), 'start': j.get('start',''),
        'decree': {k: num(s.get(k,0)) for k in ['mozdShoghl','mozdSanavat','hagheOlad','khavarbar','maskan','foghOladeB','hagheJazb','ezafekari','benKargari','ezafekarSabt','hagheAele']}
    })
payload = json.dumps(DATA, ensure_ascii=False)
print('embedded people:', len(DATA))

html = """<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#0f766e">
<title>سیستم حقوق و دستمزد — نسخه موبایل ۱.۴.۳</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{--p:#0f766e;--pd:#115e59;--bg:#f1f5f4;--card:#fff;--tx:#1c2b2a;--mut:#5b7470;--line:#d9e4e2;--red:#b91c1c;--grn:#15803d}
body{font-family:Tahoma,'Segoe UI',Vazirmatn,sans-serif;background:var(--bg);color:var(--tx);font-size:14px;padding-bottom:70px}
.hdr{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,#0f766e,#134e4a);color:#fff;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.hdr h1{font-size:16px;font-weight:700}
.hdr .sub{font-size:11px;opacity:.85;margin-top:3px}
.wrap{padding:12px;max-width:560px;margin:0 auto}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.card{background:var(--card);border-radius:14px;padding:14px;border:1px solid var(--line);box-shadow:0 1px 3px rgba(0,0,0,.05)}
.card .lbl{font-size:11px;color:var(--mut)}
.card .val{font-size:17px;font-weight:700;color:var(--pd);margin-top:5px}
.card .val.sm{font-size:13px}
.sec{margin-top:16px}
.sec h2{font-size:13px;color:var(--mut);margin-bottom:8px;font-weight:600}
table{width:100%;border-collapse:collapse;background:var(--card);border-radius:12px;overflow:hidden;border:1px solid var(--line);font-size:12px}
th{background:#e8f2f1;color:var(--pd);padding:8px 6px;text-align:right;white-space:nowrap}
td{padding:7px 6px;border-top:1px solid var(--line);white-space:nowrap}
tr.click:active{background:#eaf6f5}
.search{width:100%;padding:11px 14px;border:1.5px solid var(--line);border-radius:12px;font-size:14px;font-family:inherit;background:var(--card);color:var(--tx);margin-bottom:10px}
.search:focus{outline:none;border-color:var(--p)}
.btn{display:inline-block;background:var(--p);color:#fff;border:none;border-radius:11px;padding:11px 16px;font-size:13px;font-family:inherit;font-weight:600;cursor:pointer}
.btn.sec2{background:#e8f2f1;color:var(--pd)}
.btn.red{background:#fee2e2;color:var(--red)}
.btn.full{width:100%;margin-top:8px}
.nav{position:fixed;bottom:0;left:0;right:0;background:var(--card);border-top:1px solid var(--line);display:flex;z-index:10;padding-bottom:env(safe-area-inset-bottom)}
.nav button{flex:1;background:none;border:none;padding:9px 2px 7px;font-family:inherit;font-size:10px;color:var(--mut);cursor:pointer}
.nav button svg{display:block;margin:0 auto 3px;width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nav button.on{color:var(--p);font-weight:700}
.page{display:none}.page.on{display:block}
.detail .row{display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--line);font-size:13px}
.detail .row .k{color:var(--mut)}
.detail .row .v{font-weight:600;text-align:left}
.money{font-variant-numeric:tabular-nums}
.slip-h{background:#e8f2f1;border-radius:12px;padding:12px 14px;margin-bottom:10px}
.slip-h .n{font-size:15px;font-weight:700;color:var(--pd)}
.slip-h .m{font-size:12px;color:var(--mut);margin-top:3px}
.amt-t{display:flex;justify-content:space-between;padding:8px 14px;font-size:13px;border-bottom:1px dashed var(--line)}
.amt-t b{color:var(--grn)} .amt-d b{color:var(--red)}
.tot{display:flex;justify-content:space-between;padding:11px 14px;font-size:14px;font-weight:700;background:#f0fdf9;border-radius:12px;margin-top:8px}
select.m{width:100%;padding:11px 14px;border:1.5px solid var(--line);border-radius:12px;font-size:14px;font-family:inherit;background:var(--card);color:var(--tx);margin-bottom:10px}
.badge{display:inline-block;background:#e8f2f1;color:var(--pd);border-radius:8px;padding:2px 8px;font-size:11px}
.empty{text-align:center;color:var(--mut);padding:30px 10px;font-size:13px}
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#134e4a;color:#fff;padding:10px 18px;border-radius:20px;font-size:12px;opacity:0;transition:.3s;pointer-events:none;z-index:99}
.toast.show{opacity:1}
</style>
</head>
<body>
<div class="hdr"><h1 id="hTitle">سیستم حقوق و دستمزد</h1><div class="sub">نسخه موبایل ۱.۴.۳ — شرکت گردشگری و اقامتی آریان کویر رفسنجان</div></div>
<div class="wrap">

<div class="page on" id="pgDash">
  <div class="cards" id="dashCards"></div>
  <div class="sec"><h2>بیشترین حقوق ماهانه (حکم)</h2><div id="dashTop"></div></div>
  <div class="sec"><h2>تفکیک مرکز هزینه</h2><div id="dashCost"></div></div>
</div>

<div class="page" id="pgPeople">
  <input class="search" id="qPeople" placeholder="جستجو: نام، کد پرسنل، شغل...">
  <div id="peopleList"></div>
</div>

<div class="page" id="pgSalaries">
  <input class="search" id="qSal" placeholder="جستجوی پرسنل...">
  <div id="salList"></div>
</div>

<div class="page" id="pgSlip">
  <select class="m" id="slipSel"></select>
  <select class="m" id="slipMonth"></select>
  <div id="slipOut"></div>
</div>

<div class="page" id="pgSet">
  <div class="sec"><h2>پشتیبان‌گیری و بازیابی</h2>
    <button class="btn sec2 full" onclick="doBackup()">دریافت فایل پشتیبان (JSON)</button>
    <button class="btn sec2 full" onclick="document.getElementById('impFile').click()">بازیابی از فایل پشتیبان</button>
    <input type="file" id="impFile" accept=".json" style="display:none" onchange="doImport(this)">
  </div>
  <div class="sec"><h2>درباره</h2>
    <div class="card">
      <div class="lbl">نسخه</div><div class="val sm">۱.۴.۰ — همگام با نسخه دسکتاپ 2026-11-15</div>
      <div class="lbl" style="margin-top:10px">نوع نسخه</div><div class="val sm">موبایل (HTML آفلاین) — داده‌های پرسنل و احکام حقوق واقعی مهر ۱۴۰۵ داخل فایل تعبیه شده است. تغییرات در حافظه مرورگر (localStorage) ذخیره می‌شود.</div>
    </div>
  </div>
</div>

</div>
<div class="nav">
  <button class="on" onclick="go('Dash',this)"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>داشبورد</button>
  <button onclick="go('People',this)"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>پرسنل</button>
  <button onclick="go('Salaries',this)"><svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>احکام حقوق</button>
  <button onclick="go('Slip',this)"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg>فیش حقوقی</button>
  <button onclick="go('Set',this)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>تنظیمات</button>
</div>
<div class="toast" id="toast"></div>
<script>
const SEED = __DATA__;
const KEY='payrollMobile1405';
let DB;
try{ DB = JSON.parse(localStorage.getItem(KEY)) || null; }catch(e){ DB=null; }
if(!DB || !DB.people || DB.people.length!==SEED.length){ DB={people:JSON.parse(JSON.stringify(SEED))}; save(); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){ toast('حجم تغییرات زیاد است'); } }
const fa = n => Number(n||0).toLocaleString('fa-IR');
const esc = s => String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }
function go(p,btn){ document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.getElementById('pg'+p).classList.add('on');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('on')); if(btn)btn.classList.add('on');
  window.scrollTo(0,0); }
const MON=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const fullName=p=>p.first+' '+p.last;
const decreeSum=d=>Object.values(d).reduce((a,b)=>a+b,0);

function renderDash(){
  const ps=DB.people;
  const tot=ps.reduce((a,p)=>a+decreeSum(p.decree),0);
  const avg=Math.round(tot/ps.length);
  const maxD=ps.reduce((a,p)=>decreeSum(p.decree)>decreeSum(a.decree)?p:a);
  document.getElementById('dashCards').innerHTML=
    card('تعداد پرسنل',fa(ps.length))+
    card('جمع حقوق ماهانه',fa(tot)+' ریال')+
    card('میانگین هر نفر',fa(avg)+' ریال')+
    card('بیشترین حکم',fullName(maxD));
  const tops=[...ps].sort((a,b)=>decreeSum(b.decree)-decreeSum(a.decree)).slice(0,5);
  document.getElementById('dashTop').innerHTML='<table><tr><th>پرسنل</th><th>شغل</th><th>جمع حکم (ریال)</th></tr>'+
    tops.map(p=>'<tr><td>'+esc(fullName(p))+'</td><td>'+esc(p.job||'—')+'</td><td class="money">'+fa(decreeSum(p.decree))+'</td></tr>').join('')+'</table>';
  const costs={}; ps.forEach(p=>{ costs[p.cost||'نامشخص']=(costs[p.cost||'نامشخص']||0)+1; });
  document.getElementById('dashCost').innerHTML='<table><tr><th>مرکز هزینه</th><th>تعداد</th></tr>'+
    Object.entries(costs).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+fa(v)+'</td></tr>').join('')+'</table>';
}
function card(l,v,sm){ return '<div class="card"><div class="lbl">'+l+'</div><div class="val'+(sm?' sm':'')+'">'+v+'</div></div>'; }

function renderPeople(q){
  q=(q||'').trim();
  const ps=DB.people.filter(p=>!q||(fullName(p)+' '+p.code+' '+p.job+' '+p.cost+' '+p.nid).includes(q));
  document.getElementById('peopleList').innerHTML = ps.length?
    '<table><tr><th>کد</th><th>نام</th><th>شغل</th><th>مرکز</th></tr>'+
    ps.map(p=>'<tr class="click" onclick="showPerson(\\''+p.code+'\\')"><td>'+esc(p.code)+'</td><td>'+esc(fullName(p))+'</td><td>'+esc(p.job||'—')+'</td><td>'+esc(p.cost||'—')+'</td></tr>').join('')+'</table>'
    : '<div class="empty">موردی یافت نشد</div>';
}
function renderSal(q){
  q=(q||'').trim();
  const ps=DB.people.filter(p=>!q||(fullName(p)+' '+p.code).includes(q));
  document.getElementById('salList').innerHTML = ps.length?
    '<table><tr><th>پرسنل</th><th>جمع اقلام (ریال)</th><th></th></tr>'+
    ps.map(p=>'<tr class="click" onclick="showSal(\\''+p.code+'\\')"><td>'+esc(fullName(p))+'</td><td class="money">'+fa(decreeSum(p.decree))+'</td><td><span class="badge">جزئیات</span></td></tr>').join('')+'</table>'
    : '<div class="empty">موردی یافت نشد</div>';
}
const DECREE_FIELDS=[['mozdShoghl','مزد شغل'],['mozdSanavat','مزد سنوات'],['hagheOlad','حق اولاد'],['khavarbar','خواروبار'],['maskan','مسکن'],['foghOladeB','فوق‌العاده بن'],['hagheJazb','حق جذب'],['ezafekari','اضافه‌کاری'],['benKargari','بن کارگری'],['ezafekarSabt','اضافه‌کار ثابت'],['hagheAele','حق عائله‌مندی']];
function personHtml(p){
  return '<div class="detail card" style="padding:0">'+
   row('نام و نام خانوادگی',fullName(p))+row('کد پرسنل',p.code)+row('کد ملی',p.nid)+
   row('شغل',p.job||'—')+row('محل خدمت',p.service||'—')+row('تاریخ شروع کار',p.start||'—')+
   row('مرکز هزینه',p.cost||'—')+row('جنسیت',p.gender)+row('وضعیت تأهل',p.marital)+
   row('نوع قرارداد',p.contract||'—')+row('تلفن همراه',p.phone||'—')+
   row('شماره بیمه',p.insNo||'—')+row('بانک',p.bank||'—')+row('شماره حساب',p.acc||'—')+'</div>';
}
function row(k,v){ return '<div class="row"><span class="k">'+k+'</span><span class="v">'+esc(v)+'</span></div>'; }
function showPerson(code){
  const p=DB.people.find(x=>x.code===code); if(!p)return;
  document.getElementById('peopleList').innerHTML='<button class="btn sec2 full" onclick="renderPeople(document.getElementById(\\'qPeople\\').value)">« بازگشت به لیست</button>'+
    '<div class="sec"><h2>مشخصات پرسنل</h2>'+personHtml(p)+'</div>'+
    '<div class="sec"><h2>اقلام حکم حقوق (مهر ۱۴۰۵)</h2><table><tr><th>قلم</th><th>مبلغ (ریال)</th></tr>'+
    DECREE_FIELDS.map(([k,l])=>'<tr><td>'+l+'</td><td class="money">'+fa(p.decree[k])+'</td></tr>').join('')+
    '<tr><th>جمع</th><th class="money">'+fa(decreeSum(p.decree))+'</th></tr></table></div>';
  window.scrollTo(0,0);
}
function showSal(code){
  const p=DB.people.find(x=>x.code===code); if(!p)return;
  document.getElementById('salList').innerHTML='<button class="btn sec2 full" onclick="renderSal(document.getElementById(\\'qSal\\').value)">« بازگشت به لیست</button>'+
    '<div class="sec"><h2>حکم حقوق — '+esc(fullName(p))+'</h2>'+personHtml(p)+'</div>'+
    '<div class="sec"><h2>اقلام حکم</h2><table><tr><th>قلم</th><th>مبلغ (ریال)</th></tr>'+
    DECREE_FIELDS.map(([k,l])=>'<tr><td>'+l+'</td><td class="money">'+fa(p.decree[k])+'</td></tr>').join('')+
    '<tr><th>جمع کل</th><th class="money">'+fa(decreeSum(p.decree))+'</th></tr></table></div>';
  window.scrollTo(0,0);
}
function renderSlip(){
  const sel=document.getElementById('slipSel');
  const code=sel.value||DB.people[0].code;
  const p=DB.people.find(x=>x.code===code); if(!p)return;
  const mIdx=parseInt(document.getElementById('slipMonth').value)||6;
  const mName=MON[mIdx]+' ۱۴۰۵';
  const d=p.decree;
  const sum=decreeSum(d);
  const ins=Math.round(sum*0.07);
  const net=sum-ins;
  document.getElementById('slipOut').innerHTML=
   '<div class="slip-h"><div class="n">'+esc(fullName(p))+' — کد '+esc(p.code)+'</div><div class="m">فیش حقوقی '+mName+' — '+esc(p.job||'پرسنل')+' — '+esc(p.cost||'')+'</div></div>'+
   '<div class="card" style="padding:0"><div style="padding:9px 14px;background:#f0fdf9;font-weight:700;font-size:12px;color:var(--pd)">دریافتی‌ها</div>'+
   DECREE_FIELDS.filter(([k])=>d[k]>0).map(([k,l])=>'<div class="amt-t"><span>'+l+'</span><b class="money">'+fa(d[k])+'</b></div>').join('')+
   '<div class="amt-t"><span>جمع دریافتی‌ها</span><b class="money">'+fa(sum)+'</b></div>'+
   '<div style="padding:9px 14px;background:#fef2f2;font-weight:700;font-size:12px;color:var(--red);border-top:1px solid var(--line)">کسورات</div>'+
   '<div class="amt-t amt-d"><span>بیمه سهم کارگر (۷٪)</span><b class="money">'+fa(ins)+'</b></div>'+
   '<div class="tot"><span>خالص پرداختی</span><span class="money">'+fa(net)+' ریال</span></div></div>'+
   '<div style="font-size:11px;color:var(--mut);margin-top:8px;line-height:1.8">نرخ بیمه ۷٪ قانونی است. مالیات حقوق و سایر کسورات در این نسخه موبایل محاسبه نمی‌شود؛ مبالغ رسمی، فیش صادرشده از نسخه دسکتاپ است.</div>';
}
function doBackup(){
  const blob=new Blob([JSON.stringify(DB,null,1)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='payroll-backup-1405.json'; a.click(); toast('فایل پشتیبان دریافت شد');
}
function doImport(inp){
  const f=inp.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=e=>{ try{ const d=JSON.parse(e.target.result); if(!d.people)throw 0;
    DB=d; save(); renderAll(); toast('بازیابی انجام شد'); }catch(err){ toast('فایل نامعتبر است'); } };
  r.readAsText(f); inp.value='';
}
function renderAll(){ renderDash(); renderPeople(document.getElementById('qPeople').value); renderSal(document.getElementById('qSal').value);
  const sel=document.getElementById('slipSel');
  sel.innerHTML=DB.people.map(p=>'<option value="'+p.code+'">'+esc(fullName(p))+' ('+esc(p.code)+')</option>').join('');
  document.getElementById('slipMonth').innerHTML=MON.map((m,i)=>'<option value="'+i+'"'+(i===6?' selected':'')+'>'+m+' ۱۴۰۵</option>').join('');
  renderSlip(); }
document.getElementById('qPeople').addEventListener('input',e=>renderPeople(e.target.value));
document.getElementById('qSal').addEventListener('input',e=>renderSal(e.target.value));
document.getElementById('slipSel').addEventListener('change',renderSlip);
document.getElementById('slipMonth').addEventListener('change',renderSlip);
document.getElementById('hTitle').textContent='سیستم حقوق و دستمزد';
renderAll();
</script>
</body>
</html>"""
html = html.replace('__DATA__', payload)
out = '/home/z/my-project/download/PayrollSystem_v1.4.1_2026-11-16_mobile.html'
open(out, 'w', encoding='utf-8').write(html)
import os
print('written:', out, os.path.getsize(out), 'bytes')
