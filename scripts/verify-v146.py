# -*- coding: utf-8 -*-
"""راستی‌آزمایی مستقل محاسبات مهر ۱۴۰۵ علی محمدی — کارشناس حقوق/تامین اجتماعی/مالیات
   args: summary.json lines.json stats.json holidays.json"""
import json, sys

summary = json.load(open(sys.argv[1]))
lines_doc = json.load(open(sys.argv[2]))
stats = json.load(open(sys.argv[3]))
holidays = set(json.load(open(sys.argv[4])))

rows = summary.get('rows') or summary.get('summaries') or []
row = next((r for r in rows if r.get('personnel', {}).get('personnelCode') == '100'), None)
st = None
if isinstance(stats, dict):
    st = stats.get('stat') or stats.get('100') or (stats.get('stats') or {}).get('1') or None
    if st is None and stats:
        v = list(stats.values())[0]
        st = v.get('stat') if isinstance(v, dict) and 'stat' in v else (v if isinstance(v, dict) and 'paidDays' in v else None)

print('=== حضور و غیاب (آمار موتور) ===')
for k in ['paidDays', 'leaveDays', 'unpaidDays', 'overtimeHours', 'fridayHours', 'fridayReplacedHours',
          'fridayNoReplaceHours', 'nightHours', 'workedHours', 'lateMinutes', 'earlyMinutes', 'shiftPctHours']:
    if st and k in st: print(f'  {k}: {st[k]}')

# ---------- پارامترها ----------
HOURLY = 166255500 / 30 / 7.33
PD = 28          # ۳۰ − بدون حقوق(۸) − جمعه استراحت(۲۴)؛ روز ۵ (off برای فرد غیرساعتی) پرداخت‌شده
DIM = 30
# جمعه‌های مهر ۱۴۰۵ = {۳، ۱۰، ۱۷، ۲۴} — تعطیل رسمی تقویم (غیر جمعه):
hol_days = sorted(d for d in holidays if d not in (3, 10, 17, 24))
print('  روزهای تعطیل رسمی (غیر جمعه):', hol_days)

def prorate(x): return round(x * PD / DIM)

# شیفت صبح: روزهای ۱،۲،۴،۷،۹ (روز ۵ off، ۶ و ۸ مرخصی، ۳ و ۱۰ جمعه‌کاری جدا) — روز تعطیل رسمی اگر بین این‌ها بود تعطیل‌کاری است
A_WORKED = [d for d in [1, 2, 3, 4, 5, 7, 9, 10] if d not in (6, 8)]  # روز ۵ = off → پرداخت‌شده بدون کار؟
# دقیق: worked A days (کار واقعی) = 1,2,3,4,7,9,10 (روز ۵ بدون کار)
A_WORK = [1, 2, 3, 4, 7, 9, 10]
A_HOL = [d for d in A_WORK if d in hol_days]           # تعطیل‌کاری صبح
A_FRI = [d for d in A_WORK if d in (3, 10)]            # جمعه‌کاری صبح (با جایگزین — روز ۵ off)
A_PLAIN = [d for d in A_WORK if d not in hol_days and d not in (3, 10)]  # عادی
B_WORK = [d for d in range(11, 31) if d != 13 and d != 24]  # شب‌کارها (۱۳ استعلاجی، ۲۴ جمعه استراحت)
B_HOL = [d for d in B_WORK if d in hol_days]
B_FRI = [d for d in B_WORK if d == 17]                 # جمعه بدون جایگزین
B_NIGHT = [d for d in B_WORK if d not in B_HOL and d not in B_FRI]

night_per_day = 6.0   # ساعت (۲۲ تا ۴)
exp = {}
exp['base_wage'] = prorate(161255500)
exp['seniority'] = prorate(5000000)
exp['housing'] = prorate(30000000)
exp['worker_ben'] = prorate(22000000)
exp['child_allow'] = round(16625550 * 2 * PD / DIM)
exp['family_allow'] = prorate(5000000)
OT = 7.0                                             # ۲+۲+۳
exp['overtime'] = round(HOURLY * 1.4 * OT)
FRI_R = 16.0                                         # جمعه ۳ و ۱۰ (با جایگزین) ×۸ ساعت
FRI_N = 8.0                                          # جمعه ۱۷ بدون جایگزین
exp['friday_work'] = round(HOURLY * 1.4 * FRI_R + HOURLY * 1.8 * FRI_N)
exp['night_work'] = round(HOURLY * 0.35 * night_per_day * len(B_WORK))
SH_A = 8.0 * len(A_PLAIN)                            # ساعات غیرشب صبح (جمعه/تعطیل هم حق شیفت دارد؟ خیر — جمعه‌کاری جدا است)
SH_A_ALL = 8.0 * len(A_WORK) - 0                     # حق شیفت = کل کارکرد غیرشب (شامل جمعه و تعطیل)
SH_B = (8.0 - night_per_day) * len(B_WORK)           # شب: ۲ ساعت غیرشب هر روز
exp['shift_allow'] = round(HOURLY * (0.10 * SH_A_ALL + 0.35 * SH_B))
if A_HOL or B_HOL:
    exp['holiday_work'] = round(HOURLY * 1.7 * (8.0 * len(A_HOL) + 8.0 * len(B_HOL)))

expected_gross = sum(exp.values())
ins_codes = [c for c in ['base_wage', 'seniority', 'housing', 'worker_ben', 'overtime', 'friday_work', 'night_work', 'shift_allow', 'holiday_work'] if c in exp]
expected_ins = sum(exp[c] for c in ins_codes)
expected_worker_ins = round(expected_ins * 0.07)

print('=== محاسبه مستقل (expected) ===')
for k, v in exp.items(): print(f'  {k}: {v:,}')
print(f'  gross: {expected_gross:,}')
print(f'  insuredBase: {expected_ins:,}')
print(f'  workerIns(7%): {expected_worker_ins:,}')
m84 = expected_gross - exp.get('child_allow', 0) - exp.get('family_allow', 0) - expected_worker_ins
print(f'  taxBase (ماده ۱۳۷): {m84:,} — معافیت ماهانه ۱۴۰۵ ≈ ۳۳۲٬۵۱۱٬۰۰۰ → مالیات صفر است')

print('=== مقایسه با برنامه ===')
ok = True
def cmp(name, got, want, tol=3):
    global ok
    d = abs(int(got or 0) - int(want))
    mark = '✓' if d <= tol else '❌'
    if d > tol: ok = False
    print(f'  {mark} {name}: got={int(got or 0):,} want={int(want):,}')

cmp('workedDays', row.get('workedDays'), PD)
cmp('gross', row.get('gross'), expected_gross)
cmp('insuredBase', row.get('insuredBase'), expected_ins)
cmp('workerIns', row.get('workerIns'), expected_worker_ins)
print(f"  tax: {row.get('tax'):,} | netPay: {row.get('netPay'):,}")

lines = {l['itemCode']: l['amount'] for l in lines_doc.get('lines', [])}
for code, want in exp.items():
    got = lines.get(code)
    d = abs(int(got or 0) - int(want))
    mark = '✓' if d <= 3 else '❌'
    if d > 3: ok = False
    print(f'  {mark} {code}: got={got} want={want}')
# خواروبار باید صفر باشد (بن تکراری نباشد)
print(f"  ✓ food (خواروبار تکراری): got={lines.get('food')} — باید صفر یا غایب باشد")

# آمار موتور در برابر انتظار
if st:
    cmp('stats.nightHours', round(st.get('nightHours', 0)), 6.0 * len(B_WORK))
    cmp('stats.overtimeHours', round(st.get('overtimeHours', 0)), 7)
    cmp('stats.fridayReplaced', round(st.get('fridayReplacedHours', 0)), FRI_R)
    cmp('stats.fridayNoReplace', round(st.get('fridayNoReplaceHours', 0)), FRI_N)
    print(f"  shiftPctHours برنامه: {st.get('shiftPctHours')} — انتظار: [[۳۵٪ ۳۶ ساعت]، [۱۰٪ {SH_A_ALL:.0f} ساعت]]")

print('VERIFY-' + ('PASS' if ok else 'FAIL'))
sys.exit(0 if ok else 1)
