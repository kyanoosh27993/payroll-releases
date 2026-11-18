#!/usr/bin/env python3
"""تست کامل API با سشن — نسخه ۱.۴.۱"""
import json, urllib.request, http.cookiejar, sys

BASE = 'http://127.0.0.1:3111'
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header('Content-Type', 'application/json')
    data = json.dumps(body).encode() if body is not None else None
    try:
        with op.open(req, data=data, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except Exception: return {'_http': e.code}

def show(label, d, keys=None):
    if keys and isinstance(d, dict):
        d = {k: d[k] for k in keys if k in d}
    s = json.dumps(d, ensure_ascii=False)
    print(f'{label}: {s[:400]}')

# ۱) ورود + تغییر رمز + ورود مجدد
print('login:', call('POST', '/api/auth/login', {'username': 'admin', 'password': 'Admin@1405'}))
print('change:', call('POST', '/api/auth/change-password', {'oldPassword': 'Admin@1405', 'newPassword': 'New@1405!'}))
print('relogin:', call('POST', '/api/auth/login', {'username': 'admin', 'password': 'New@1405!'}))

# ۲) کانتکست
ctx = call('GET', '/api/context')
show('context', ctx, ['version', 'companies', 'fiscalYears'])

# ۳) حضور و غیاب
ms = call('GET', '/api/attendance/months?fyId=1')
show('attendance/months', ms if not isinstance(ms, dict) or 'error' not in ms else ms, None)
months = ms.get('months') or ms.get('data') or (ms if isinstance(ms, list) else [])
if months:
    mid = months[0]['id'] if isinstance(months[0], dict) and 'id' in months[0] else 1
    dl = call('GET', f'/api/attendance/daily?monthId={mid}')
    rows = dl.get('rows') or dl.get('daily') or (dl if isinstance(dl, list) else [])
    print(f'attendance/daily month={mid}: {len(rows)} rows')
    interesting = [r for r in rows if r.get('lateMin', 0) > 0 or r.get('overtimeMin', 0) > 0 or r.get('leaveMin', 0) > 0 or r.get('status') != 'حاضر'][:8]
    for r in interesting:
        print('  day', r.get('day'), r.get('status'), 'in', r.get('entry1'), 'out', r.get('exit1'), 'late', r.get('lateMin'), 'ot', r.get('overtimeMin'), 'leave', r.get('leaveMin'), r.get('leaveKind', ''))

# ۴) دوره‌های حقوق
show('payroll/periods', call('GET', '/api/payroll/periods?fyId=1'))

# ۵) داشبورد
show('dashboard', call('GET', '/api/dashboard?companyId=1&fyId=1'))

# ۶) پرسنل کامل (فرم‌های همه بخش‌ها)
p = call('GET', '/api/personnel?companyId=1')
plist = p.get('personnel') if isinstance(p, dict) else p
print(f'personnel: {len(plist) if isinstance(plist, list) else "?"} rows')
if isinstance(plist, list) and plist:
    pid = plist[0]['id']
    one = call('GET', f'/api/personnel/{pid}')
    keys = list(one.keys()) if isinstance(one, dict) else []
    print(f'personnel/{pid} keys: {keys}')
    for k in ('contract', 'decree', 'leaves', 'advances', 'loans', 'openingBalances', 'shiftAssignments'):
        v = one.get(k)
        print(f'  {k}:', ('EMPTY' if not v else f'{len(v) if isinstance(v, list) else "ok"}'))

# ۷) شیفت‌ها + تخصیص‌ها
sh = call('GET', '/api/shifts?companyId=1')
slist = sh.get('shifts') if isinstance(sh, dict) else sh
print(f'shifts: {len(slist) if isinstance(slist, list) else "?"}')
if isinstance(slist, list):
    for s in slist: print('  -', s.get('name'), '| premium', s.get('premiumPct'))

# ۸) AI
r = call('POST', '/api/ai/chat', {'message': 'وضعیت حضور و غیاب را نشان بده', 'companyId': 1, 'fyId': 1})
print('AI:', r.get('answer', r)[:300])

# ۹) بازیابی رمز — کد واقعی از فایل
import re
code = None
try:
    txt = open('/home/z/my-project/webapp-standalone/recovery-key.txt', encoding='utf-8').read()
    m = re.search(r'[A-Za-z0-9\-]{16,}', txt.split('====')[-1])
    code = m.group(0) if m else None
except Exception as e:
    print('recovery-key read err', e)
print('recovery code found:', bool(code))
if code:
    rr = call('POST', '/api/auth/recover', {'username': 'admin', 'code': code, 'newPassword': 'Recovered@1!'})
    print('recover:', rr)
    print('login-after-recover:', call('POST', '/api/auth/login', {'username': 'admin', 'password': 'Recovered@1!'}))

print('ALL-API-TESTS-DONE')
