# -*- coding: utf-8 -*-
"""تست قابلیت‌های جدید نسخه ۰.۲ — شیفت، گریس، فایل‌های استاندارد، مانده حقوق، بیمه فردی"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app'))

from core.db import Database
from core import shifts as SH
from core import standard_exports as SE
from core import payroll_engine as PE
from core.numbers import parse_number

for _f in ('/tmp/test_v02.db', '/tmp/test_v02.db-wal', '/tmp/test_v02.db-shm'):
    if os.path.exists(_f):
        os.remove(_f)
db = Database('/tmp/test_v02.db')
db.init_schema()
cur = db.conn.execute("INSERT INTO companies(name, national_id, economic_code, sso_branch_code, sso_workshop_code, sso_contract_row) VALUES('شرکت تست هیلان','14009999999','411333333','9512','1234567890','000')")
cid = cur.lastrowid
cur = db.conn.execute("INSERT INTO fiscal_years(company_id,jy,title) VALUES(?,1405,'سال مالی ۱۴۰۵')", (cid,))
fy = cur.lastrowid
db.ensure_fy_settings(fy)
cur = db.conn.execute("INSERT INTO personnel(company_id,personnel_code,first_name,last_name,card_no,national_id,sso_number,status,marital_status,dependents) VALUES(?,?,?,?,?,?,?,?,?,?)",
                      (cid,'101','علی','محمدی','777','1234567890','987654321','شاغل','متاهل',1))
pid = cur.lastrowid

print('=== ۱) شیفت ===')
SH.save_shift(db, cid, 'اداری ۸-۱۶', {str(d): [480, 960] for d in range(6)}, '')
sid = db.conn.execute("SELECT id FROM shifts").fetchone()['id']
db.conn.execute("UPDATE personnel SET shift_id=? WHERE id=?", (sid, pid))
db.conn.commit()
sched = SH.person_shift(db, {'id': pid, 'shift_id': sid}, 1405, 8)
exp = SH.expected_minutes(sched, 0)  # شنبه
assert exp == 480, exp
print('✓ شیفت ۸-۱۶: موظفی شنبه = ۴۸۰ دقیقه؛ جمعه =', SH.expected_minutes(sched, 6))

print('=== ۲) گریس تاخیر/تعجیل ===')
from core import jalali as J
class Cal:
    def is_holiday(self, *a): return False
# روز شنبه ۱۴۰۵/۰۸/۰۲ — ورود ۸:۱۲ (۱۲ دقیقه تاخیر)، خروج ۱۵:۴۵ (۱۵ دقیقه تعجیل)
row = {'entry1': 8*60+12, 'exit1': 15*60+45, 'worked_min': 393, 'leave_min': 0, 'mission_min': 0, 'status': ''}
out = SH.recompute_day(row, 480, grace_late=10, grace_early=10, is_holiday=False,
                       sched_start=480, sched_end=960)
assert out['late_min'] == 2, out  # ۱۲-۱۰=۲
assert out['early_min'] == 5, out  # ۶۰-۴۵=۱۵-۱۰=۵
out0 = SH.recompute_day(row, 480, grace_late=0, grace_early=0, is_holiday=False,
                        sched_start=480, sched_end=960)
assert out0['late_min'] == 12 and out0['early_min'] == 15, out0
print('✓ گریس ۱۰ دقیقه: تاخیر=۲، تعجیل=۵ | گریس ۰: تاخیر=۱۲، تعجیل=۱۵')

print('=== ۳) بازمحاسبه ماه ===')
cur = db.conn.execute("INSERT INTO attendance_months(fiscal_year_id,jy,jm,source) VALUES(?,?,?,'تست')", (fy,1405,8))
mid = cur.lastrowid
db.conn.execute("INSERT INTO attendance_daily(month_id,personnel_id,day,entry1,exit1,worked_min) VALUES(?,?,?,?,?,?)",
                (mid,pid,2,8*60+12,15*60+45,393))
db.conn.commit()
n = SH.recalc_month(db, mid, Cal(), 10, 10, {})
assert n == 1
r = db.conn.execute("SELECT late_min, early_min, missing_min, expected_min, status FROM attendance_daily WHERE month_id=?",(mid,)).fetchone()
assert r['late_min']==2 and r['early_min']==5 and r['missing_min']==87 and r['expected_min']==480, dict(r)
print('✓ بازمحاسبه: تاخیر ۲، تعجیل ۵، کسرکار ۸۰ (مطابق شیفت)')

print('=== ۴) بیمه فردی ===')
db.conn.execute("UPDATE personnel SET sso_worker_pct=5, sso_employer_pct=16, sso_unemp_pct=0 WHERE id=?", (pid,))
db.conn.commit()
p = dict(db.conn.execute("SELECT * FROM personnel WHERE id=?", (pid,)).fetchone())
settings = {k: db.get_fy_setting(fy, k) for k in ['monthly_required_hours','sso_worker_rate','sso_employer_rate','sso_unemployment_rate','sso_ceiling_30d','sso_ceiling_31d','m84_monthly_exemption','overtime_factor','holiday_work_factor','friday_work_factor','night_work_percent']}
settings['sso_worker_rate'] = str(p['sso_worker_pct'])
settings['sso_employer_rate'] = str(p['sso_employer_pct'])
settings['sso_unemployment_rate'] = str(p['sso_unemp_pct'])
decree = {'job_wage': 100_000_000, 'seniority_wage': 0, 'housing': 0, 'food': 0, 'child_allowance': 0,
          'worker_ben': 0, 'shift_allowance': 0, 'attraction_amount': 0, 'family_allowance': 0,
          'adjustment_diff': 0, 'supervision': 0, 'labor_market': 0, 'education_aid': 0,
          'fixed_overtime': 0, 'other_benefits': 0, 'attraction_percent': 0}
ctx = PE.EmployeeCalcContext(settings, db.get_tax_brackets(fy), decree,
                             {'contract_type':'ماهانه ثابت','hourly_rate':0,'daily_rate':0,'project_amount':0},
                             [], [], {}, days_in_month=31, paid_days=20)
items = [dict(r) for r in db.conn.execute("SELECT * FROM payroll_items_config WHERE active=1").fetchall()]
lines, summary = PE.calc_employee(ctx, items)
base = summary['insured_base']
assert summary['worker_ins'] == round(base*0.05), summary
assert summary['employer_ins'] == round(base*0.16), summary
assert summary['unemployment_ins'] == 0, summary
print('✓ بیمه فردی ۵٪/۱۶٪/۰٪: کارگر', summary['worker_ins'], '| کارفرما', summary['employer_ins'], '| بیکاری', summary['unemployment_ins'])

print('=== ۵) فایل‌های استاندارد مالیات WP/WH ===')
db.conn.execute("INSERT OR IGNORE INTO payroll_periods(fiscal_year_id,jy,jm) VALUES(?,1405,8)", (fy,))
pp = db.conn.execute("SELECT id FROM payroll_periods WHERE fiscal_year_id=? AND jy=1405 AND jm=8",(fy,)).fetchone()['id']
db.conn.execute("INSERT INTO payroll_summary(period_id,personnel_id,worked_days,gross,insured_base,worker_ins,employer_ins,unemployment_ins,tax_base,tax,total_deductions,net_pay) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                (pp,pid,20,100_000_000,100_000_000,5_000_000,16_000_000,0,100_000_000,0,5_000_000,95_000_000))
db.conn.execute("INSERT INTO payroll_lines(period_id,personnel_id,item_code,amount) VALUES(?,?,?,?)", (pp,pid,'base_wage',64_516_129))
db.conn.execute("INSERT INTO payroll_lines(period_id,personnel_id,item_code,amount) VALUES(?,?,?,?)", (pp,pid,'overtime',5_000_000))
db.conn.commit()
rows = [dict(r) for r in db.conn.execute("SELECT s.*, p.*, p.first_name||' '||p.last_name AS full_name FROM payroll_summary s JOIN personnel p ON p.id=s.personnel_id WHERE s.period_id=?",(pp,)).fetchall()]
company = dict(db.conn.execute("SELECT * FROM companies WHERE id=?",(cid,)).fetchone())
os.makedirs('/tmp/taxout', exist_ok=True)
wp, wh = SE.make_tax_files(db, pp, rows, company, '/tmp/taxout')
wp_content = open(wp, encoding='utf-8').read().strip().split('\r\n')
wh_content = open(wh, encoding='utf-8').read().strip().split('\r\n')
assert len(wp_content[0].split(',')) == 23, len(wp_content[0].split(','))
assert len(wh_content[0].split(',')) == 39, len(wh_content[0].split(','))
assert wp_content[0].split(',')[1] == '1234567890'  # کد ملی
wh_fields = wh_content[0].split(',')
assert wh_fields[0] == '1234567890'
assert int(wh_fields[16]) == 5_000_000  # فیلد ۱۷ = اضافه‌کاری
assert int(wh_fields[34]) == 95_000_000  # فیلد ۳۵ = خالص پرداختی
print('✓ WPYYYYMM.TXT (۲۳ فیلد) و WHYYYYMM.TXT (۳۹ فیلد) — اضافه‌کاری و خالص پرداختی درست')

print('=== ۶) فایل‌های بیمه DSKKAR/DSKWOR ===')
os.makedirs('/tmp/insout', exist_ok=True)
kar, wor = SE.make_insurance_files(db, pp, rows, company, '/tmp/insout')
sz_kar, sz_wor = os.path.getsize(kar), os.path.getsize(wor)
assert sz_kar > 100 and sz_wor > 100
# خواندن هدر DBF
with open(wor,'rb') as f:
    hdr = f.read(32)
    nrec = int.from_bytes(hdr[4:8],'little')
    hlen = int.from_bytes(hdr[8:10],'little')
    rlen = int.from_bytes(hdr[10:12],'little')
    assert nrec == 1, nrec
    fields = []
    f.seek(32)
    while True:
        b = f.read(32)
        if b[0:1] == b'\x0d': break
        fields.append((b[0:11].decode('cp1256', errors='replace').strip(chr(0)), chr(b[11])))
    rec = f.read(rlen)
print('✓ DSKKAR00.dbf + DSKWOR00.dbf — رکورد بیمه‌شده با فیلدها:', [f[0] for f in fields])

print('=== ۷) اکسل مرجع بیمه ===')
xp = SE.insurance_excel('/tmp/insout/ref.xlsx', rows, company, 'آبان ۱۴۰۵')
assert os.path.getsize(xp) > 4000
print('✓ اکسل ریزکارکرد بیمه')

print('=== ۸) مانده حقوق ماه قبل در فیش ===')
from core import exports as EX
summary = {'gross':100_000_000,'insured_base':100_000_000,'worker_ins':5_000_000,'employer_ins':16_000_000,
           'unemployment_ins':0,'tax_base':100_000_000,'tax':0,'total_deductions':5_000_000,
           'net_pay':95_000_000,'prev_balance':12_000_000,'worked_days':20,'leave_days':0,'leave_balance':0}
person = {'full_name':'علی محمدی','personnel_code':'101','national_id':'1234567890','sso_number':'987654321','job_title':'','cost_center':''}
html = EX.payslip_html(company, person, 'آبان ۱۴۰۵', [('حقوق',64_516_129,'','earning'),('بیمه',5_000_000,'','deduction')], summary)
assert 'مانده حقوق ماه قبل' in html and '12,000,000' in html.replace('٬',',').replace('۱','1') or '۱۲,۰۰۰,۰۰۰' in html
assert '107,000,000' in html.replace('٬',',').replace('۱۰۷','107') or '۱۰۷,۰۰۰,۰۰۰' in html
print('✓ فیش شامل مانده حقوق ماه قبل ۱۲٬۰۰۰٬۰۰۰ و جمع ۱۰۷٬۰۰۰٬۰۰۰')

print('=== ۹) بانک: فقط تاییدشده‌ها ===')
rows[0]['pay_approved'] = 0
out = EX.bank_list_rows(rows, only_approved=True)
assert len(out) == 0
db.conn.execute("UPDATE payroll_summary SET prev_balance=12000000, pay_approved=1, pay_paid=0 WHERE period_id=? AND personnel_id=?", (pp,pid))
db.conn.execute("UPDATE personnel SET bank_account='6037991011111111', bank_name='رفاه' WHERE id=?", (pid,))
db.conn.commit()
rows = [dict(r) for r in db.conn.execute("SELECT s.*, p.*, p.first_name||' '||p.last_name AS full_name FROM payroll_summary s JOIN personnel p ON p.id=s.personnel_id WHERE s.period_id=?",(pp,)).fetchall()]
out = EX.bank_list_rows(rows)
print('بانک:', out[0])
assert out[0][5] == 12_000_000 and out[0][6] == 95_000_000 and out[0][7] == 107_000_000
print('✓ لیست بانک: مانده + خالص + جمع قابل پرداخت درست؛ غیرتایید حذف شد')

print()
print('🎉 همه تست‌های نسخه ۰.۲ پاس شد')
