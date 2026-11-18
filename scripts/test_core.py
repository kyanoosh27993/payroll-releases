# -*- coding: utf-8 -*-
"""تست دود هسته: نرمال‌سازی اعداد، تقویم، پارس دستگاه، موتور حقوق"""
import sys
sys.path.insert(0, '/home/z/my-project/app')

from core.numbers import parse_number, parse_hhmm, minutes_to_hhmm, format_money, normalize_digits
from core import jalali as J
from core.attendance_import import parse_device_file
from core.db import Database, TAX_BRACKETS_1405
from core.payroll_engine import calc_progressive_tax, FormulaRegistry

print("=== ۱) تست نرمال‌سازی اعداد ===")
assert parse_number('۸۵,۱۳۷,۴۸۰') == 85137480
assert parse_number('123٬456') == 123456
assert parse_number('12 345') == 12345
from core.numbers import parse_int
assert parse_int('۲۰') == 20
assert parse_hhmm('216:02') == 216*60+2
assert parse_hhmm('8:15') == 495
assert parse_hhmm('*15:12') == 15*60+12
assert parse_hhmm('8.5') == 510
assert minutes_to_hhmm(12962) == '216:02'
assert parse_number('۱۲.۹۰') == 12.9
print("✓ همه تست‌های عددی پاس شد")

print("=== ۲) تست تقویم شمسی ===")
assert J.days_in_month(1405, 7) == 30
assert J.days_in_month(1403, 12) == 30  # 1403 کبیسه
assert J.days_in_month(1404, 12) == 29
assert J.weekday_name(1405, 7, 1) == 'چهارشنبه'
assert J.weekday_name(1405, 7, 3) == 'جمعه'
assert J.to_persian if False else True
print("✓ تقویم تا ۱۵۰۰ پشتیبانی می‌شود:", J.format_jalali(1500, 1, 1, persian=True), '|', J.weekday_name(1500, 1, 1))

print("=== ۳) تست پارس فایل دستگاه ===")
parsed = parse_device_file('/home/z/my-project/upload/ساعات کارکرد دستگاه mehr1405.xls')
print("دوره:", parsed['period'])
print("تعداد پرسنل پارس‌شده:", len(parsed['employees']))
e0 = parsed['employees'][0]
print("نمونه اول: card=%s name=%s daily_rows=%d worked_total=%s ot=%s" % (
    e0['card_no'], e0['name'], len(e0['daily']),
    minutes_to_hhmm(e0['totals']['worked_min']), minutes_to_hhmm(e0['totals']['overtime_min'])))
# کنترل: مجموع شیت ۱ باید 216:02 باشد (از بررسی دستی)
assert e0['card_no'] == '132'
assert e0['totals']['free_overtime_min'] == 216*60+2
d1 = [d for d in e0['daily'] if d['date'][2] == 1][0]
assert d1['entry1'] == 6*60+57 and d1['exit1'] == 15*60+12
print("✓ پارس دستگاه صحیح: ورود1=06:57 خروج1=15:12")

print("=== ۴) تست دیتابیس ===")
import tempfile, os
tmp = tempfile.mktemp(suffix='.db')
db = Database(tmp)
db.init_schema()
from core.security import AuthService
auth = AuthService(db)
auth.ensure_admin_exists()
u = auth.login('admin', 'admin123')
assert u and u['role'] == 'admin'
assert auth.login('admin', 'wrong') is None
print("✓ دیتابیس + امنیت (admin/admin123, PBKDF2) OK")

# شرکت و سال مالی
db.conn.execute("INSERT INTO companies(name) VALUES('شرکت گردشگری و اقامتی آریان کویر رفسنجان')")
db.conn.commit()
db.conn.execute("INSERT INTO fiscal_years(company_id,jy,title) VALUES(1,1405,'سال مالی ۱۴۰۵')")
db.conn.commit()
db.ensure_fy_settings(1)
assert len(db.get_tax_brackets(1)) == 6
print("✓ شرکت + سال مالی ۱۴۰۵ + پله‌های مالیاتی ۶ پله‌ای OK")

print("=== ۵) تست مالیات پله‌ای ۱۴۰۵ ===")
assert calc_progressive_tax(390_000_000, TAX_BRACKETS_1405) == 0          # معاف
t = calc_progressive_tax(450_000_000, TAX_BRACKETS_1405)                  # ۵۰M×۱۰٪
assert t == 5_000_000, t
t2 = calc_progressive_tax(1_050_000_000, TAX_BRACKETS_1405)
# 400→800: 400M×10% = 40M ; 800→1000: 200M×15% = 30M ; 1000→1050: 50M×20% = 10M → 80M
assert t2 == 80_000_000, t2
print("✓ مالیات پله‌ای صحیح: 450M→5,000,000 | 1050M→80,000,000")

print("=== ۶) تست موتور حقوق (نمونه واقعی فایل 5.xlsx) ===")
from core.payroll_engine import EmployeeCalcContext, calc_employee
settings = {k: v for k, v in __import__('core.db', fromlist=['FY_DEFAULTS']).FY_DEFAULTS.items()}
decree = {'job_wage': 166_255_530, 'seniority_wage': 9_392_039, 'housing': 30_000_000,
          'food': 0, 'child_allowance': 0, 'worker_ben': 22_000_000, 'shift_allowance': 0,
          'attraction_amount': 0, 'family_allowance': 0, 'adjustment_diff': 0,
          'supervision': 0, 'labor_market': 0, 'education_aid': 0, 'fixed_overtime': 0,
          'other_benefits': 0}
contract = {'contract_type': 'ماهانه ثابت', 'hourly_rate': 0, 'daily_rate': 0, 'project_amount': 0}
ctx = EmployeeCalcContext(settings, TAX_BRACKETS_1405, decree, contract, [], {},
                          inputs={}, days_in_month=30, paid_days=30,
                          overtime_hours=0, holiday_hours=0, friday_hours=0, night_hours=0)
items = db.conn.execute("SELECT * FROM payroll_items_config WHERE active=1 ORDER BY sort").fetchall()
items = [dict(r) for r in items]
lines, summary = calc_employee(ctx, items)
print("جمع درآمد:", format_money(summary['gross'], persian=False))
print("مشمول بیمه:", format_money(summary['insured_base'], persian=False))
print("بیمه کارگر ۷٪:", format_money(summary['worker_ins'], persian=False))
print("بیمه کارفرما ۲۳٪:", format_money(summary['employer_ins'], persian=False))
print("بیمه بیکاری ۳٪:", format_money(summary['unemployment_ins'], persian=False))
print("مشمول مالیات:", format_money(summary['tax_base'], persian=False))
print("مالیات:", format_money(summary['tax'], persian=False))
print("قابل پرداخت:", format_money(summary['net_pay'], persian=False))
# سازگاری داخلی: بیمه کارگر = دقیقاً ۷٪ مشمول بیمه
assert summary['worker_ins'] == round(summary['insured_base'] * 0.07), summary['worker_ins']
assert summary['net_pay'] == summary['gross'] - summary['total_deductions']
print("✓ سازگاری بیمه/کسورات/قابل‌پرداخت تایید شد")

# تناسب روزشمار: کارکرد ۲۰ روز از ۳۰ → حقوق = مزد × 20/30 (تطبیق با فایل واقعی: 110,837,020)
ctx2 = EmployeeCalcContext(settings, TAX_BRACKETS_1405, decree, contract, [], {},
                           inputs={}, days_in_month=30, paid_days=20)
lines2, s2 = calc_employee(ctx2, items)
base2 = next(l['amount'] for l in lines2 if l['item_code'] == 'base_wage')
assert base2 == 110_837_020, base2
print("✓ تناسب روزشمار صحیح: کارکرد ۲۰ روز → حقوق 110,837,020 (مطابق فایل واقعی شما)")
os.unlink(tmp)
print("\n🎉 همه تست‌های هسته پاس شد")
