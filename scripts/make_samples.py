# -*- coding: utf-8 -*-
"""تولید نمونه خروجی‌های واقعی از داده‌های کاربر (مهر ۱۴۰۵ هتل هیلان) برای نمایش"""
import sys, os, tempfile, shutil
sys.path.insert(0, '/home/z/my-project/app')

tmp = tempfile.mkdtemp()
from core.db import Database
from core.security import AuthService
from core.jalali import CalendarService
from core.context import AppContext
from core import attendance_import as AI
from core import payroll_engine as PE
from core import exports as EX
from core.numbers import to_persian_digits

db = Database(os.path.join(tmp, 'demo.db'))
db.init_schema()
auth = AuthService(db); auth.ensure_admin_exists(); auth.login('admin', 'admin123')
cal = CalendarService(db); cal.seed_defaults()

db.conn.execute("INSERT INTO companies(name, national_id, sso_branch_code) VALUES(?,?,?)",
                ('شرکت گردشگری و اقامتی آریان کویر رفسنجان', '', ''))
db.conn.commit()
db.conn.execute("INSERT INTO fiscal_years(company_id,jy,title) VALUES(1,1405,'سال مالی ۱۴۰۵')")
db.conn.commit()
db.ensure_fy_settings(1)

# پرسنل از فایل واقعی
import openpyxl
from ui.pages_people import PERSONNEL_IMPORT_MAP
from core.numbers import normalize_digits
wb = openpyxl.load_workbook('/home/z/my-project/upload/لیست پرسنل این ماه.xlsx', data_only=True)
sh = wb.active
for r in range(1, 8):
    vals = {}
    for c in range(1, sh.max_column + 1):
        v = sh.cell(r, c).value
        if isinstance(v, str):
            vals[c] = v.strip()
    if 'نام خانوادگی' in vals.values():
        hdr_row = r
        colmap = {PERSONNEL_IMPORT_MAP[nm]: c for c, nm in vals.items() if nm in PERSONNEL_IMPORT_MAP}
        break
for r in range(hdr_row + 1, sh.max_row + 1):
    rec = {}
    for fld, c in colmap.items():
        v = sh.cell(r, c).value
        rec[fld] = str(v).strip() if v is not None else ''
    code = normalize_digits(rec.get('personnel_code', ''))
    if not code or not rec.get('first_name') or rec['first_name'] == 'نام':
        continue
    data = dict(rec)
    data['personnel_code'] = code
    for k in ('national_id', 'card_no', 'mobile', 'sso_number', 'bank_account'):
        data[k] = normalize_digits(data.get(k, ''))
    cols = ['company_id'] + list(data.keys())
    ph = ', '.join('?' * len(cols))
    db.conn.execute(f"INSERT OR IGNORE INTO personnel({','.join(cols)}) VALUES({ph})",
                    [1] + list(data.values()))
db.conn.commit()

# حضور و غیاب از فایل دستگاه
parsed = AI.parse_device_file('/home/z/my-project/upload/ساعات کارکرد دستگاه mehr1405.xls')
res = AI.save_to_db(db, 1, parsed)
print('حضور:', res['saved'], 'نفر — بدون تطبیق:', [n for _, n in res['unmatched']])

# احکام: از فایل واقعی لیست احکام حقوق
wb2 = openpyxl.load_workbook('/home/z/my-project/upload/لیست احکام حقوق.xlsx', data_only=True)
sh2 = wb2.active
# ستون‌های حکم در ردیف 6: مزد شغل(1) سنوات(2) اولاد(3) مسکن(4) خواروبار(5) تطبیق(6) سرپرستی(7) تحصیلی(8) بازارکار(9) درصدجذب(10) مبلغجذب(11) سایر(12) بن(13) اضافه‌کارثابت(14) عائله(15) نام(16) کد(17)
inserted = 0
for rr in range(7, sh2.max_row + 1):
    code = normalize_digits(str(sh2.cell(rr, 17).value or ''))
    if not code:
        continue
    row_p = db.conn.execute("SELECT id FROM personnel WHERE personnel_code=?", (code,)).fetchone()
    if not row_p:
        continue
    g = lambda c: float(str(sh2.cell(rr, c).value or 0).replace(',', '')) if sh2.cell(rr, c).value is not None else 0.0
    db.conn.execute("""INSERT OR REPLACE INTO decrees(personnel_id,effective_date,job_wage,seniority_wage,
        child_allowance,housing,food,adjustment_diff,supervision,education_aid,labor_market,
        attraction_percent,attraction_amount,other_benefits,worker_ben,fixed_overtime,family_allowance)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (row_p['id'], '1405/01/01', g(1), g(2), g(3), g(4), g(5), g(6), g(7), g(8), g(9),
         g(10), g(11), g(12), g(13), g(14), g(15)))
    inserted += 1
db.conn.commit()
print('احکام واقعی ثبت‌شده:', inserted)

# محاسبه حقوق مهر ۱۴۰۵
fy, jy, jm, dim = 1, 1405, 7, 30
db.conn.execute("INSERT OR IGNORE INTO payroll_periods(fiscal_year_id,jy,jm) VALUES(?,?,?)", (fy, jy, jm))
db.conn.commit()
period_id = db.conn.execute("SELECT id FROM payroll_periods WHERE jy=? AND jm=?", (jy, jm)).fetchone()['id']
settings = {k: db.get_fy_setting(fy, k) for k in
            ['monthly_required_hours', 'sso_worker_rate', 'sso_employer_rate', 'sso_unemployment_rate',
             'sso_ceiling_30d', 'sso_ceiling_31d', 'overtime_factor', 'holiday_work_factor',
             'friday_work_factor', 'night_work_percent', 'm84_monthly_exemption']}
brackets = db.get_tax_brackets(fy)
items = [dict(r) for r in db.conn.execute("SELECT * FROM payroll_items_config WHERE active=1 ORDER BY sort").fetchall()]
people = [dict(r) for r in db.conn.execute("SELECT * FROM personnel WHERE company_id=1").fetchall()]
att = PE.month_attendance_stats(db, res['month_id'], cal)
db.conn.execute("DELETE FROM payroll_lines WHERE period_id=?", (period_id,))
db.conn.execute("DELETE FROM payroll_summary WHERE period_id=?", (period_id,))
for p in people:
    d = db.conn.execute("SELECT * FROM decrees WHERE personnel_id=? ORDER BY effective_date DESC LIMIT 1",
                        (p['id'],)).fetchone()
    decree = dict(d) if d else {'job_wage': 0}
    contract = {'contract_type': 'ماهانه ثابت', 'hourly_rate': 0, 'daily_rate': 0, 'project_amount': 0}
    a = att.get(p['id'], {'paid_days': 0, 'overtime_hours': 0, 'holiday_hours': 0, 'friday_hours': 0, 'leave_days': 0})
    if not (p.get('marital_status') == 'متاهل' and (p.get('dependents') or 0) > 0):
        decree['child_allowance'] = 0
    if p.get('marital_status') != 'متاهل':
        decree['family_allowance'] = 0
    cctx = PE.EmployeeCalcContext(settings, brackets, decree, contract, [], {}, {},
                                  days_in_month=dim, paid_days=a['paid_days'],
                                  overtime_hours=a['overtime_hours'], holiday_hours=a['holiday_hours'],
                                  friday_hours=a['friday_hours'], leave_days=a['leave_days'])
    lines, summary = PE.calc_employee(cctx, items)
    for l in lines:
        db.conn.execute("INSERT INTO payroll_lines(period_id,personnel_id,item_code,amount) VALUES(?,?,?,?)",
                        (period_id, p['id'], l['item_code'], l['amount']))
    db.conn.execute("""INSERT INTO payroll_summary(period_id,personnel_id,worked_days,leave_days,gross,
        insured_base,worker_ins,employer_ins,unemployment_ins,tax_base,tax,total_deductions,net_pay,overtime_min)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (period_id, p['id'], a['paid_days'], a['leave_days'], summary['gross'], summary['insured_base'],
         summary['worker_ins'], summary['employer_ins'], summary['unemployment_ins'], summary['tax_base'],
         summary['tax'], summary['total_deductions'], summary['net_pay'], int(a['overtime_hours'] * 60)))
db.conn.commit()

# خروجی‌های نمونه
OUT = '/home/z/my-project/download/نمونه خروجی‌های برنامه'
os.makedirs(OUT, exist_ok=True)
per, rows = EX.get_period_data(db, period_id)
title = f"{per['company_name']} — {to_persian_digits('1405/07')}"
EX.export_table_xlsx(f'{OUT}/لیست بانک - مهر ۱۴۰۵.xlsx', 'لیست پرداخت حقوق از بانک', title,
                     ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'شماره حساب', 'بانک', 'مبلغ قابل پرداخت (ریال)'],
                     EX.bank_list_rows(rows), money_cols={5}, sum_cols={5})
EX.export_table_xlsx(f'{OUT}/لیست مالیات - مهر ۱۴۰۵.xlsx', 'فهرست مالیات حقوق (ماده ۹۷)', title,
                     ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'جمع درآمد', 'درآمد مشمول مالیات', 'مالیات پرداختی'],
                     EX.tax_list_rows(rows), money_cols={3, 4, 5}, sum_cols={3, 4, 5})
EX.export_table_xlsx(f'{OUT}/لیست بیمه - مهر ۱۴۰۵.xlsx', 'لیست بیمه تامین اجتماعی', title,
                     ['ردیف', 'شماره بیمه', 'نام و نام خانوادگی', 'روز بیمه', 'حقوق مشمول بیمه',
                      'سهم کارگر (۷٪)', 'سهم کارفرما (۲۳٪)', 'بیکاری (۳٪)'],
                     EX.insurance_list_rows(rows), money_cols={4, 5, 6, 7}, sum_cols={4, 5, 6, 7})
headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'کارکرد (روز)', 'جمع درآمد', 'مشمول بیمه',
           'بیمه کارگر', 'مشمول مالیات', 'مالیات', 'جمع کسورات', 'قابل پرداخت']
data = [[r['personnel_code'], r['full_name'], r['worked_days'], r['gross'], r['insured_base'],
         r['worker_ins'], r['tax_base'], r['tax'], r['total_deductions'], r['net_pay']] for r in rows]
EX.export_table_xlsx(f'{OUT}/خلاصه حقوق - مهر ۱۴۰۵.xlsx', 'خلاصه حقوق و دستمزد', title,
                     headers, data, money_cols=set(range(3, 10)), sum_cols=set(range(3, 10)))
# دو فیش نمونه
from PySide6.QtWidgets import QApplication
import os as _os
_os.environ['QT_QPA_PLATFORM'] = 'offscreen'
app = QApplication([])
for r in rows[:2]:
    cur = db.conn.execute("""SELECT i.title, l.amount, i.kind FROM payroll_lines l
        JOIN payroll_items_config i ON i.code=l.item_code
        WHERE l.period_id=? AND l.personnel_id=? ORDER BY i.sort""", (period_id, r['personnel_id']))
    items_rows = [(x['title'], x['amount'], '', x['kind']) for x in cur.fetchall()]
    fname = f"فیش حقوقی {r['personnel_code']} {r['last_name']}.pdf".replace('/', '-')
    EX.payslip_pdf(os.path.join(OUT, fname), per, r, 'حقوق و دستمزد مهر ۱۴۰۵', items_rows, r)
tot = sum(r['net_pay'] for r in rows)
print(f'جمع قابل پرداخت مهر ۱۴۰۵: {tot:,.0f} ریال برای {len(rows)} نفر')
print('نمونه‌ها ذخیره شد در', OUT)
shutil.rmtree(tmp, ignore_errors=True)
