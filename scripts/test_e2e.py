# -*- coding: utf-8 -*-
"""تست راه‌اندازی UI در حالت offscreen + سناریوی کامل: شرکت → پرسنل → حکم → حضور → حقوق → خروجی"""
import sys, os
sys.path.insert(0, '/home/z/my-project/app')
os.environ['QT_QPA_PLATFORM'] = 'offscreen'

import tempfile
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

# دیتابیس موقت
tmp_db = tempfile.mktemp(suffix='.db')
os.environ['PAYROLL_DB_PATH'] = tmp_db

from core.db import Database
from core.security import AuthService
from core.jalali import CalendarService
from core.context import AppContext
from ui.theme import ThemeManager

app = QApplication(sys.argv)
app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)

db = Database(tmp_db)
db.init_schema()
auth = AuthService(db)
auth.ensure_admin_exists()
user = auth.login('admin', 'admin123')
assert user, 'login failed'
cal = CalendarService(db)
cal.seed_defaults()
theme_mgr = ThemeManager(db)
theme_mgr.apply(app)

ctx = AppContext(db, auth, theme_mgr, cal)

# --- ثبت شرکت و سال مالی (شبیهسازی UI) ---
db.conn.execute("INSERT INTO companies(name, national_id, sso_branch_code) VALUES(?,?,?)",
                ('شرکت گردشگری و اقامتی آریان کویر رفسنجان', '12345', 'R55'))
db.conn.commit()
db.conn.execute("INSERT INTO fiscal_years(company_id,jy,title) VALUES(1,1405,'سال مالی ۱۴۰۵')")
db.conn.commit()
ctx.set_company(1)
assert ctx.fy_jy == 1405
db.ensure_fy_settings(ctx.fy_id)
print('✓ شرکت و سال مالی ۱۴۰۵')

# --- ایمپورت پرسنل از فایل واقعی کاربر ---
import openpyxl
from ui.pages_people import PERSONNEL_IMPORT_MAP
from core.numbers import normalize_digits
wb = openpyxl.load_workbook('/home/z/my-project/upload/لیست پرسنل این ماه.xlsx', data_only=True)
sh = wb.active
hdr_row, colmap = None, {}
for r in range(1, 8):
    vals = {}
    for c in range(1, sh.max_column + 1):
        v = sh.cell(r, c).value
        if isinstance(v, str):
            vals[c] = v.strip()
    if 'نام خانوادگی' in vals.values():
        hdr_row = r
        for c, nm in vals.items():
            if nm in PERSONNEL_IMPORT_MAP:
                colmap[PERSONNEL_IMPORT_MAP[nm]] = c
        break
assert hdr_row, 'header not found'
added = 0
for r in range(hdr_row + 1, sh.max_row + 1):
    rec = {}
    for fld, c in colmap.items():
        v = sh.cell(r, c).value
        rec[fld] = str(v).strip() if v is not None else ''
    code = normalize_digits(rec.get('personnel_code', ''))
    fname = rec.get('first_name', '')
    if not code or not fname or fname == 'نام':
        continue
    data = dict(rec)
    data['personnel_code'] = code
    data['national_id'] = normalize_digits(rec.get('national_id', ''))
    data['card_no'] = normalize_digits(rec.get('card_no', ''))
    data['mobile'] = normalize_digits(rec.get('mobile', ''))
    data['sso_number'] = normalize_digits(rec.get('sso_number', ''))
    data['bank_account'] = normalize_digits(rec.get('bank_account', ''))
    cols = ['company_id'] + list(data.keys())
    vals = [1] + list(data.values())
    ph = ', '.join('?' * len(cols))
    db.conn.execute(f"INSERT OR IGNORE INTO personnel({','.join(cols)}) VALUES({ph})", vals)
    added += 1
db.conn.commit()
print(f'✓ ایمپورت پرسنل: {added} نفر')
assert added >= 25, added

# --- ایمپورت حضور و غیاب از فایل دستگاه ---
from core import attendance_import as AI
parsed = AI.parse_device_file('/home/z/my-project/upload/ساعات کارکرد دستگاه mehr1405.xls')
res = AI.save_to_db(db, ctx.fy_id, parsed)
print(f"✓ حضور و غیاب: ذخیره {res['saved']} نفر، بدون تطبیق {len(res['unmatched'])}")
assert res['saved'] >= 20, res
if res['unmatched']:
    print('  بدون تطبیق:', [n for _, n in res['unmatched']][:6])

# --- حکم برای همه پرسنل (نمونه: حداقل دستمزد ۱۴۰۵) ---
cur = db.conn.execute("SELECT id FROM personnel")
pids = [r['id'] for r in cur.fetchall()]
for pid in pids:
    db.conn.execute("""INSERT INTO decrees(personnel_id,effective_date,job_wage,seniority_wage,
        housing,worker_ben,food) VALUES(?,?,?,?,?,?,?)""",
        (pid, '1405/01/01', 166_255_530, 9_392_039, 30_000_000, 22_000_000, 0))
db.conn.commit()
print(f'✓ احکام پرسنلی: {len(pids)} حکم ثبت شد')

# --- محاسبه حقوق مهر ۱۴۰۵ ---
from core import payroll_engine as PE
fy = ctx.fy_id
jy, jm = 1405, 7
dim = 30
db.conn.execute("INSERT OR IGNORE INTO payroll_periods(fiscal_year_id,jy,jm) VALUES(?,?,?)", (fy, jy, jm))
db.conn.commit()
period_id = db.conn.execute("SELECT id FROM payroll_periods WHERE fiscal_year_id=? AND jy=? AND jm=?",
                            (fy, jy, jm)).fetchone()['id']
settings = {k: db.get_fy_setting(fy, k) for k in
            ['monthly_required_hours', 'sso_worker_rate', 'sso_employer_rate', 'sso_unemployment_rate',
             'sso_ceiling_30d', 'sso_ceiling_31d', 'overtime_factor', 'holiday_work_factor',
             'friday_work_factor', 'night_work_percent', 'm84_monthly_exemption']}
brackets = db.get_tax_brackets(fy)
items = [dict(r) for r in db.conn.execute("SELECT * FROM payroll_items_config WHERE active=1 ORDER BY sort").fetchall()]
people = [dict(r) for r in db.conn.execute("SELECT * FROM personnel WHERE company_id=1 AND status='شاغل'").fetchall()]
att = PE.month_attendance_stats(db, res['month_id'], cal)
db.conn.execute("DELETE FROM payroll_lines WHERE period_id=?", (period_id,))
db.conn.execute("DELETE FROM payroll_summary WHERE period_id=?", (period_id,))
for p in people:
    decree = dict(db.conn.execute(
        "SELECT * FROM decrees WHERE personnel_id=? AND effective_date<='1405/07/30' ORDER BY effective_date DESC LIMIT 1",
        (p['id'],)).fetchone() or {'job_wage': 0})
    contract = dict(db.conn.execute(
        "SELECT * FROM contracts WHERE personnel_id=? ORDER BY id DESC LIMIT 1", (p['id'],)).fetchone()
        or {'contract_type': 'ماهانه ثابت', 'hourly_rate': 0, 'daily_rate': 0, 'project_amount': 0})
    a = att.get(p['id'], {'paid_days': 0, 'overtime_hours': 0, 'holiday_hours': 0, 'friday_hours': 0, 'leave_days': 0})
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
tot = db.conn.execute("SELECT COUNT(*) c, SUM(net_pay) n FROM payroll_summary WHERE period_id=?",
                      (period_id,)).fetchone()
print(f"✓ محاسبه حقوق: {tot['c']} نفر — جمع قابل پرداخت: {tot['n']:,.0f} ریال")
assert tot['c'] >= 20

# --- خروجی‌ها ---
from core import exports as EX
os.makedirs('/tmp/test_out', exist_ok=True)
per, rows = EX.get_period_data(db, period_id)
EX.export_table_xlsx('/tmp/test_out/bank.xlsx', 'لیست بانک', per['company_name'],
                     ['ردیف', 'نام', 'کد ملی', 'شماره حساب', 'مبلغ'], EX.bank_list_rows(rows),
                     money_cols={4}, sum_cols={4})
EX.export_table_xlsx('/tmp/test_out/tax.xlsx', 'لیست مالیات', per['company_name'],
                     ['ردیف', 'نام', 'کد ملی', 'درآمد', 'مشمول', 'مالیات'], EX.tax_list_rows(rows),
                     money_cols={3, 4, 5})
EX.export_table_xlsx('/tmp/test_out/ins.xlsx', 'لیست بیمه', per['company_name'],
                     ['ردیف', 'شماره بیمه', 'نام', 'روز', 'مشمول بیمه', 'کارگر', 'کارفرما', 'بیکاری'],
                     EX.insurance_list_rows(rows), money_cols={4, 5, 6, 7})
print('✓ خروجی اکسل بانک/مالیات/بیمه')

# فیش PDF (نیاز به QApplication — داریم)
person = rows[0]
cur = db.conn.execute("""SELECT i.title, l.amount, i.kind FROM payroll_lines l
    JOIN payroll_items_config i ON i.code=l.item_code
    WHERE l.period_id=? AND l.personnel_id=? ORDER BY i.sort""", (period_id, person['personnel_id']))
items_rows = [(r['title'], r['amount'], '', r['kind']) for r in cur.fetchall()]
EX.payslip_pdf('/tmp/test_out/fish.pdf', per, person, 'حقوق مهر ۱۴۰۵', items_rows, person)
assert os.path.getsize('/tmp/test_out/fish.pdf') > 5000
print('✓ فیش حقوقی PDF:', os.path.getsize('/tmp/test_out/fish.pdf'), 'bytes')

# --- گزارش‌ساز ---
from ui.pages_reports import REPORT_VIEWS, DEFAULT_REPORTS, build_query
db.conn.executescript(REPORT_VIEWS)
db.conn.commit()
for r in DEFAULT_REPORTS:
    sql, headers, money, args = build_query(r)
    rows_r = db.conn.execute(sql, args).fetchall()
    print(f"  گزارش «{r['name']}»: {len(rows_r)} سطر")
sql0, h0, m0, a0 = build_query(DEFAULT_REPORTS[0])
assert len(db.conn.execute(sql0, a0).fetchall()) >= 20
print('✓ گزارش‌ساز و ۶ گزارش پیش‌فرض')

# --- UI صفحات واقعی (ساخت بدون کرش) ---
from ui.main_window import MainWindow
ctx.set_company(1)
win = MainWindow(ctx)
win.load_companies()
win.reapply_theme()
win.show()
win._nav('پرسنل'); win._nav('احکام'); win._nav('حضور'); win._nav('حقوق')
win._nav('تقویم'); win._nav('اطلاعات اصلی'); win._nav('گزارش‌ساز'); win._nav('مدیریت')
win._nav('داشبورد')
print('✓ همه صفحات UI ساخته و ناوبری شد')

print()
print('🎉🎉 تست انتها به انتا کامل پاس شد')
