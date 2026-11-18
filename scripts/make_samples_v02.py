# -*- coding: utf-8 -*-
"""تولید خروجی‌های نمونه نسخه ۰.۲ از داده واقعی کاربر (برای نمایش به مشتری)"""
import sys, os
sys.path.insert(0, '/home/z/my-project/app')
os.environ['QT_QPA_PLATFORM'] = 'offscreen'

import tempfile
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
_app = QApplication(sys.argv)
_app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)

tmp_db = tempfile.mktemp(suffix='.db')
from core.db import Database
from core.jalali import CalendarService

db = Database(tmp_db)
db.init_schema()
cal = CalendarService(db)
cal.seed_defaults()

# شرکت با اطلاعات کامل + لوگو نمونه
cur = db.conn.execute("""INSERT INTO companies(name, national_id, economic_code, sso_branch_code,
    sso_workshop_code, sso_contract_row, tax_file_code, postal_code, manager_name, address, phone)
    VALUES('شرکت گردشگری و اقامتی آریان کویر رفسنجان','14001234567','411222333','R55',
    '1234567890','000','998877','7718713518','مدیر عامل',
    'کرمان، رفسنجان، بلوار شهید رجایی، هتل چهار ستاره هیلان','03913233000')""")
cid = cur.lastrowid
db.conn.execute("INSERT INTO fiscal_years(company_id,jy,title) VALUES(?,1405,'سال مالی ۱۴۰۵')", (cid,))
db.conn.commit()
fy = db.conn.execute("SELECT id FROM fiscal_years WHERE company_id=?", (cid,)).fetchone()['id']
db.ensure_fy_settings(fy)
print('✓ شرکت و سال مالی')

# پرسنل از فایل واقعی
import openpyxl
from ui.pages_people import PERSONNEL_IMPORT_MAP
from core.numbers import normalize_digits, parse_number
wb = openpyxl.load_workbook('/home/z/my-project/upload/لیست پرسنل این ماه.xlsx', data_only=True)
sh = wb.active
header_row, colmap = None, {}
for r in range(1, min(sh.max_row, 12) + 1):
    vals = {}
    for c in range(1, sh.max_column + 1):
        v = sh.cell(r, c).value
        if v and isinstance(v, str):
            vals[c] = v.strip().lstrip(':').strip()
    if 'نام خانوادگی' in vals.values():
        header_row = r
        for c, name in vals.items():
            if name in PERSONNEL_IMPORT_MAP:
                colmap[PERSONNEL_IMPORT_MAP[name]] = c
        break
pids = []
for r in range(header_row + 1, sh.max_row + 1):
    rec = {}
    for field, c in colmap.items():
        v = sh.cell(r, c).value
        rec[field] = '' if v is None else (str(int(v)) if isinstance(v, float) and float(v) == int(v) else str(v).strip())
    code = normalize_digits(rec.get('personnel_code', ''))
    if not code or not rec.get('first_name'):
        continue
    data = dict(rec)
    data['personnel_code'] = code
    data['dependents'] = int(parse_number(rec.get('dependents', 0), 0))
    for k in ('national_id', 'sso_number', 'card_no', 'mobile', 'bank_account'):
        data[k] = normalize_digits(data.get(k, ''))
    cols = ['company_id'] + list(data.keys())
    vals = [cid] + list(data.values())
    cur = db.conn.execute(f"INSERT INTO personnel({','.join(cols)}) VALUES({','.join('?'*len(cols))})", vals)
    pids.append(cur.lastrowid)
db.conn.commit()
print(f'✓ پرسنل: {len(pids)} نفر')

# حکم واقعی (فایل احکام: هدر در ردیف ۶)
wb2 = openpyxl.load_workbook('/home/z/my-project/upload/لیست احکام حقوق.xlsx', data_only=True)
sh2 = wb2.active
DFIELDS = {'مزد شغل': 'job_wage', 'مزد سنوات': 'seniority_wage', 'حق اولاد': 'child_allowance',
           'مسکن': 'housing', 'خواروبار': 'food', 'تفاوت تطبیق': 'adjustment_diff',
           'حق سرپرستی': 'supervision', 'تح': 'education_aid', 'بازار': 'labor_market',
           'مبلغ حق جذب': 'attraction_amount', 'بن کارگری': 'worker_ben',
           'اضافه کار ثابت': 'fixed_overtime', 'عائله': 'family_allowance',
           'اضافه کاری': 'other_benefits'}
hdr = {str(sh2.cell(6, c).value).strip(): c for c in range(1, sh2.max_column + 1) if sh2.cell(6, c).value}
def _num(v):
    return parse_number(normalize_digits(str(v or '')).replace('٬', '').replace(',', ''), 0)
n_dec = 0
for r in range(7, sh2.max_row + 1):
    code = normalize_digits(str(sh2.cell(r, hdr.get('کد پرسنل', 17)).value or '').strip())
    if not code:
        continue
    prow = db.conn.execute("SELECT id FROM personnel WHERE company_id=? AND personnel_code=?", (cid, code)).fetchone()
    if not prow:
        continue
    vals = {'effective_date': '1405/07/01', 'attraction_percent': 0}
    for title, field in DFIELDS.items():
        c = hdr.get(title)
        vals[field] = _num(sh2.cell(r, c).value) if c else 0
    db.conn.execute("""INSERT INTO decrees(personnel_id,effective_date,job_wage,seniority_wage,child_allowance,
        housing,food,adjustment_diff,supervision,education_aid,labor_market,attraction_percent,attraction_amount,
        other_benefits,worker_ben,fixed_overtime,family_allowance,shift_allowance)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (prow['id'], vals['effective_date'], vals['job_wage'], vals['seniority_wage'],
         vals['child_allowance'], vals['housing'], vals['food'], vals['adjustment_diff'],
         vals['supervision'], vals['education_aid'], vals['labor_market'], vals['attraction_percent'],
         vals.get('attraction_amount', 0), vals.get('other_benefits', 0), vals['worker_ben'],
         vals.get('fixed_overtime', 0), vals.get('family_allowance', 0), 0))
    n_dec += 1
db.conn.commit()
print(f'✓ احکام: {n_dec}')

# حضور و غیاب واقعی (مهر ۱۴۰۵)
from core import attendance_import as AI
parsed = AI.parse_device_file('/home/z/my-project/upload/ساعات کارکرد دستگاه mehr1405.xls')
res = AI.save_to_db(db, fy, parsed, cal, company_id=cid)
print(f"✓ حضور و غیاب: {res['saved']} نفر — پرسنل جدید خودکار: {res.get('new_employees', [])}")

# محاسبه حقوق مهر ۱۴۰۵ (ماه فایل دستگاه)
from core import payroll_engine as PE
from core import shifts as SH
jy, jm = 1405, 7
db.conn.execute("INSERT OR IGNORE INTO payroll_periods(fiscal_year_id,jy,jm) VALUES(?,?,?)", (fy, jy, jm))
pp = db.conn.execute("SELECT id FROM payroll_periods WHERE fiscal_year_id=? AND jy=? AND jm=?", (fy, jy, jm)).fetchone()['id']
dim = __import__('core.jalali', fromlist=['days_in_month']).days_in_month(jy, jm)
settings = {k: db.get_fy_setting(fy, k) for k in ['monthly_required_hours','sso_worker_rate','sso_employer_rate','sso_unemployment_rate','sso_ceiling_30d','sso_ceiling_31d','overtime_factor','holiday_work_factor','friday_work_factor','night_work_percent','m84_monthly_exemption']}
brackets = db.get_tax_brackets(fy)
items = [dict(r) for r in db.conn.execute("SELECT * FROM payroll_items_config WHERE active=1 ORDER BY sort").fetchall()]
people = [dict(r) for r in db.conn.execute("SELECT * FROM personnel WHERE company_id=? AND status='شاغل'", (cid,)).fetchall()]
am = db.conn.execute("SELECT id FROM attendance_months WHERE fiscal_year_id=? AND jy=? AND jm=?", (fy, jy, jm)).fetchone()
att = SH.month_stats(db, am['id'], cal) if am else {}
month_end = f'{jy}/{jm:02d}/{dim:02d}'
for p in people:
    dec = db.conn.execute("SELECT * FROM decrees WHERE personnel_id=? AND effective_date<=? ORDER BY effective_date DESC LIMIT 1", (p['id'], month_end)).fetchone()
    decree = dict(dec) if dec else {k: 0 for k in ['job_wage','seniority_wage','housing','food','child_allowance','worker_ben','shift_allowance','attraction_amount','family_allowance','adjustment_diff','supervision','labor_market','education_aid','fixed_overtime','other_benefits','attraction_percent']}
    contract = {'contract_type': 'ماهانه ثابت', 'hourly_rate': 0, 'daily_rate': 0, 'project_amount': 0}
    manual = {}
    a = att.get(p['id'], {'paid_days': dim, 'overtime_hours': 0, 'holiday_hours': 0, 'friday_hours': 0, 'leave_days': 0})
    if not (p.get('marital_status') == 'متاهل' and (p.get('dependents') or 0) > 0):
        decree['child_allowance'] = 0
    if p.get('marital_status') != 'متاهل':
        decree['family_allowance'] = 0
    ctxc = PE.EmployeeCalcContext(settings, brackets, decree, contract, [], [], manual,
                                  days_in_month=dim, paid_days=a['paid_days'],
                                  overtime_hours=a['overtime_hours'], holiday_hours=a['holiday_hours'],
                                  friday_hours=a['friday_hours'], leave_days=a['leave_days'])
    lines, summary = PE.calc_employee(ctxc, items)
    for l in lines:
        db.conn.execute("INSERT INTO payroll_lines(period_id,personnel_id,item_code,amount) VALUES(?,?,?,?)",
                        (pp, p['id'], l['item_code'], l['amount']))
    db.conn.execute("""INSERT INTO payroll_summary(period_id,personnel_id,worked_days,leave_days,overtime_min,
        gross,insured_base,worker_ins,employer_ins,unemployment_ins,tax_base,tax,total_deductions,net_pay,
        prev_balance,pay_approved,pay_paid) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0)""",
        (pp, p['id'], a['paid_days'], a['leave_days'], int(a['overtime_hours']*60), summary['gross'],
         summary['insured_base'], summary['worker_ins'], summary['employer_ins'], summary['unemployment_ins'],
         summary['tax_base'], summary['tax'], summary['total_deductions'], summary['net_pay'], 0))
db.conn.commit()
total = db.conn.execute("SELECT SUM(net_pay) s FROM payroll_summary WHERE period_id=?", (pp,)).fetchone()['s']
print(f"✓ حقوق مهر ۱۴۰۵: {len(people)} نفر — جمع قابل پرداخت {total:,.0f} ریال")

# ---------- خروجی‌های نمونه ----------
from core import exports as EX
from core import standard_exports as SE
outdir = '/home/z/my-project/download/نمونه خروجی‌های برنامه نسخه ۰.۲'
os.makedirs(outdir, exist_ok=True)
per, rows = EX.get_period_data(db, pp)
company = dict(db.conn.execute("SELECT * FROM companies WHERE id=?", (cid,)).fetchone())
title_fa = f"مهر {1405}"

# ۱) لیست بانک
EX.export_table_xlsx(os.path.join(outdir, '۱- لیست بانک.xlsx'), 'لیست پرداخت حقوق از بانک',
                     f"{company['name']} — {title_fa}",
                     ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'شماره حساب', 'بانک', 'مانده ماه قبل',
                      'خالص حقوق', 'جمع قابل پرداخت (ریال)', 'وضعیت'],
                     EX.bank_list_rows(rows), money_cols={5, 6, 7}, sum_cols={5, 6, 7}, company=company)
# ۲) مالیات ماده ۹۷
EX.export_table_xlsx(os.path.join(outdir, '۲- لیست مالیات ماده ۹۷.xlsx'), 'فهرست مالیات حقوق (ماده ۹۷)',
                     f"{company['name']} — {title_fa}",
                     ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'جمع درآمد', 'درآمد مشمول مالیات', 'مالیات پرداختی'],
                     EX.tax_list_rows(rows), money_cols={3, 4, 5}, sum_cols={3, 4, 5}, company=company)
# ۳) بیمه کامل
EX.export_table_xlsx(os.path.join(outdir, '۳- لیست بیمه تامین اجتماعی.xlsx'), 'لیست بیمه تامین اجتماعی',
                     f"{company['name']} — {title_fa}",
                     ['ردیف', 'شماره بیمه', 'نام و نام خانوادگی', 'روز بیمه', 'حقوق مشمول بیمه',
                      'سهم کارگر (۷٪)', 'سهم کارفرما (۲۰٪)', 'بیکاری (۳٪)', 'جمع حق بیمه'],
                     EX.insurance_list_rows(rows), money_cols={4, 5, 6, 7, 8}, sum_cols={4, 5, 6, 7, 8},
                     company=company)
# ۴) فایل‌های استاندارد مالیات
taxdir = os.path.join(outdir, '۴- فایل‌های استاندارد مالیات')
os.makedirs(taxdir, exist_ok=True)
wp, wh = SE.make_tax_files(db, pp, rows, company, taxdir)
SE.make_wh_excel(os.path.join(taxdir, 'کنترل WH اکسل.xlsx'),
                 SE.tax_wh_records(db, pp, rows), company, title_fa)
# ۵) فایل‌های استاندارد بیمه
insdir = os.path.join(outdir, '۵- فایل‌های استاندارد بیمه ای‌سرویس')
os.makedirs(insdir, exist_ok=True)
SE.make_insurance_files(db, pp, rows, company, insdir)
SE.insurance_excel(os.path.join(insdir, 'ریزکارکرد بیمه اکسل مرجع.xlsx'), rows, company, title_fa)
# ۶) حضور و غیاب فردی مطابق دستگاه
from ui.pages_attendance import DEVICE_EXPORT_COLS
am_row = db.conn.execute("SELECT * FROM attendance_months WHERE fiscal_year_id=? AND jy=? AND jm=?", (fy, jy, jm)).fetchone()
per0 = db.conn.execute("SELECT s.*, p.* FROM payroll_summary s JOIN personnel p ON p.id=s.personnel_id WHERE s.period_id=? AND s.gross>0 ORDER BY s.gross DESC LIMIT 1", (pp,)).fetchone()
pd_ = db.conn.execute("SELECT * FROM attendance_daily WHERE month_id=? AND personnel_id=? ORDER BY day",
                      (am_row['id'], per0['personnel_id'])).fetchall()
drows = {r['day']: dict(r) for r in pd_}
days_data = []
for d in range(1, dim + 1):
    r = drows.get(d)
    def t(key):
        if not r: return ''
        v = r.get(key)
        if key in ('entry1','exit1','entry2','exit2','entry3','exit3'):
            from core.numbers import minutes_to_hhmm
            return minutes_to_hhmm(v) if v is not None and v >= 0 else ''
        from core.numbers import minutes_to_hhmm
        return minutes_to_hhmm(v or 0)
    days_data.append({
        'date': d, 'wd': __import__('core.jalali', fromlist=['weekday_name']).weekday_name(jy, jm, d),
        'entry1': t('entry1'), 'exit1': t('exit1'), 'entry2': t('entry2'), 'exit2': t('exit2'),
        'entry3': t('entry3'), 'exit3': t('exit3'), 'worked_min': t('worked_min'),
        'work_min': t('worked_min'), 'mission_min': t('mission_min'), 'leave_min': t('leave_min'),
        'late_min': t('late_min'), 'early_min': t('early_min'), 'missing_min': t('missing_min'),
        'overtime_min': t('overtime_min'), 'free_overtime_min': t('free_overtime_min'),
        'status': r.get('status') or '' if r else ''})
full_name = f"{per0['first_name']} {per0['last_name']}"
EX.export_table_xlsx(os.path.join(outdir, '۶- گزارش روزانه فردی مطابق دستگاه.xlsx'),
                     'گزارش روزانه فردی',
                     f"{company['name']} — {full_name} — {title_fa}",
                     [c[0] for c in DEVICE_EXPORT_COLS],
                     [[str(r[c[1]]) for c in DEVICE_EXPORT_COLS] for r in days_data],
                     company=company)
# ۷) فیش PDF دو نمونه
for r in rows[:2]:
    cur2 = db.conn.execute("""SELECT i.title, l.amount, i.kind FROM payroll_lines l
        JOIN payroll_items_config i ON i.code=l.item_code
        WHERE l.period_id=? AND l.personnel_id=? ORDER BY i.sort""", (pp, r['personnel_id']))
    items_rows = [(x['title'], x['amount'], '', x['kind']) for x in cur2.fetchall()]
    EX.payslip_pdf(os.path.join(outdir, f"۷- فیش حقوقی {r['last_name']}.pdf"),
                   per, r, title_fa, items_rows, r)
# ۸) چاپ PDF لیست بیمه (نمونه گزارش عمومی)
EX.report_pdf(os.path.join(outdir, '۸- چاپ PDF لیست بیمه.pdf'), company,
              'لیست بیمه تامین اجتماعی', title_fa,
              ['ردیف', 'شماره بیمه', 'نام و نام خانوادگی', 'روز بیمه', 'مشمول بیمه',
               'سهم کارگر', 'سهم کارفرما', 'بیکاری', 'جمع'],
              EX.insurance_list_rows(rows), money_cols={4, 5, 6, 7, 8})

# ۹) خروجی‌های HTML (پیش‌نمایش مرورگری)
EX.report_html_save = None
html_ins = EX.report_html(company, 'لیست بیمه تامین اجتماعی', title_fa,
                          ['ردیف', 'شماره بیمه', 'نام و نام خانوادگی', 'روز بیمه', 'مشمول بیمه',
                           'سهم کارگر', 'سهم کارفرما', 'بیکاری', 'جمع'],
                          EX.insurance_list_rows(rows), money_cols={4, 5, 6, 7, 8})
open(os.path.join(outdir, '۹- لیست بیمه (HTML).html'), 'w', encoding='utf-8').write(html_ins)
html_bank = EX.report_html(company, 'لیست پرداخت حقوق از بانک', title_fa,
                           ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'شماره حساب', 'بانک',
                            'مانده ماه قبل', 'خالص حقوق', 'جمع قابل پرداخت', 'وضعیت'],
                           EX.bank_list_rows(rows), money_cols={5, 6, 7})
open(os.path.join(outdir, '۹- لیست بانک (HTML).html'), 'w', encoding='utf-8').write(html_bank)
_items_fish = [(x['title'], x['amount'], '', x['kind']) for x in
    db.conn.execute("""SELECT i.title, l.amount, i.kind FROM payroll_lines l
       JOIN payroll_items_config i ON i.code=l.item_code
       WHERE l.period_id=? AND l.personnel_id=? ORDER BY i.sort""",
       (pp, rows[1]['personnel_id'])).fetchall()]
html_fish = EX.payslip_html(per, rows[1], title_fa, _items_fish, rows[1])
open(os.path.join(outdir, '۹- فیش حقوقی (HTML).html'), 'w', encoding='utf-8').write(
    '<!DOCTYPE html><html dir=rtl lang=fa><head><meta charset=utf-8><title>فیش</title></head>'
    '<body style="margin:0;background:#f0f0f0"><div style="max-width:900px;margin:20px auto;'
    'background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.15)">' + html_fish + '</div></body></html>')
print('✅ خروجی‌های HTML هم ساخته شد')

print('✅ همه خروجی‌های نمونه در:', outdir)
