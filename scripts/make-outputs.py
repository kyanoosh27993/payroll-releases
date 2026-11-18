# -*- coding: utf-8 -*-
"""Preview outputs for Mr. Mohammadi (fake data, 1405 labor minimum wage)."""
import os
from pathlib import Path

OUT = Path('/home/z/my-project/download/preview-outputs')
OUT.mkdir(parents=True, exist_ok=True)
FONT = '/home/z/my-project/scripts/fonts'

# ---------- number helpers ----------
def fa(n):
    """int -> Persian digits with thousands separator (٬); '' passthrough"""
    if n == '':
        return ''
    s = f"{n:,}".replace(",", "٬")
    return s.translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))

def fas(s):
    return str(s).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))

# ---------- 1405 labor-law figures (Council of Labor Supreme, 24 Esfand 1404) ----------
DAILY_MIN = 5_541_850          # حداقل مزد روزانه
BASE_30   = 166_255_500        # پایه حقوق ماهانه ۳۰ روزه
SENIORITY_M = 5_000_000        # پایه سنوات ماهانه
HOUSE = 30_000_000             # حق مسکن
BEN = 22_000_000               # بن کارگری
MARRIAGE = 5_000_000           # حق تاهل
CHILD = 16_625_550             # حق اولاد هر فرزند (۳ برابر مزد روزانه)
OT_HOUR = 1_058_470            # نرخ اضافه‌کاری هر ساعت

# ---------- employee (FAKE) ----------
emp = dict(
    name='علی', family='محمدی', father='رضا', dob='۱۳۶۸/۰۵/۱۲',
    nat='3050123456', ins='36912345', issued='رفسنجان',
    pn='14050201', mar='متأهل', dep='۲', edu='دیپلم', job='کارگر خدمات هتل',
    bank='بانک رفاه کارگران – شعبه رفسنجان', acc='418512090',
    sheba='IR5505600000000041851209001', phone='۰۹۱۳۴۵۶۷۸۹۰',
)
CO = dict(
    name='شرکت گردشگری و اقامتی آریان کویر رفسنجان', site='هتل هیلان',
    reg='۳۴۵۶', natid='10101234567', econ='411123456789',
    addr='رفسنجان، بلوار ولیعصر، مجموعه هتل هیلان',
    tel='۰۳۴-۳۴۲۲۱۱۰۰', ceo='محمود رضایی', coworker='محسن پورابوالقاسمی',
    bank='بانک رفاه کارگران – شعبه رفسنجان', acc='357601889',
)

children = 2
hokm_rows = [
    ('مزد شغل (پایه حقوق مصوب وزارت کار – ۳۰ روز)', BASE_30),
    ('مزد سنوات (یک سال سابقه)', SENIORITY_M),
    ('حق مسکن', HOUSE),
    ('بن کارگری (خواروبار)', BEN),
    ('حق تاهل (عائله‌مندی)', MARRIAGE),
    (f'حق اولاد ({fas(children)} فرزند × {fa(CHILD)})', CHILD*children),
]
hokm_total = sum(v for _, v in hokm_rows)   # 261,506,600

ot_hours = 40
ot_pay = ot_hours * OT_HOUR                  # 42,338,800
slip_income = [
    ('مزد شغل (پایه حقوق)', BASE_30),
    ('مزد سنوات', SENIORITY_M),
    ('حق مسکن', HOUSE),
    ('بن کارگری', BEN),
    ('حق تاهل', MARRIAGE),
    ('حق اولاد (۲ فرزند)', CHILD*children),
    (f'اضافه‌کاری ({fas(ot_hours)} ساعت × {fa(OT_HOUR)})', ot_pay),
]
sum_income = sum(v for _, v in slip_income)  # 303,845,400
ins_base = BASE_30 + SENIORITY_M + ot_pay    # 213,594,300
ins7 = round(ins_base * 7 / 100)             # 14,951,601
tax_monthly_exempt = BASE_30 * 12 * 2 // 12  # 332,511,000 monthly exemption
loan = 25_000_000
slip_deduct = [
    ('حق بیمه سهم کارگر (۷٪)', ins7),
    ('مالیات حقوق (در معافیت قانونی)', 0),
    ('اقساط وام رفاهی', loan),
]
sum_deduct = ins7 + loan                     # 39,951,601
net_pay = sum_income - sum_deduct            # 263,893,799

# settlement (fake history)
monthly_wage = BASE_30 + SENIORITY_M         # 171,255,500
daily_wage = round(monthly_wage / 30)        # 5,708,517
start, lastday = '۱۴۰۴/۰۱/۰۱', '۱۴۰۵/۰۸/۱۴'
days_aban = 14
leave_days = 12
settle_items = [
    (f'مزد و سنوات {fas(days_aban)} روز آبان {fas(1405)}', round(monthly_wage/30*days_aban)),
    (f'مانده مرخصی ({fas(leave_days)} روز × {fa(daily_wage)})', leave_days*daily_wage),
    ('مانده عیدی و پاداش سال ۱۴۰۵ (۷ ماه)', round(2*monthly_wage*7/12)),
    ('حق سنوات پایان کار (۱۹ ماه کارکرد)', round(daily_wage*45*19/12)),
    (f'مسکن و بن {fas(days_aban)} روز آبان', round((HOUSE+BEN)/30*days_aban)),
]
sum_settle = sum(v for _, v in settle_items)
ins_base_settle = round(monthly_wage/30*days_aban) + leave_days*daily_wage + round(daily_wage*45*19/12)
ins7_settle = round(ins_base_settle * 7 / 100)
settle_deduct = [
    ('حق بیمه سهم کارگر (۷٪ مزایای مشمول)', ins7_settle),
    ('مالیات حقوق (در معافیت قانونی)', 0),
]
sum_settle_deduct = ins7_settle
net_settle = sum_settle - sum_settle_deduct

CSS = f"""
@font-face {{ font-family:'Vazirmatn'; src:url('file://{FONT}/Vazirmatn-Regular.ttf'); font-weight:400; }}
@font-face {{ font-family:'Vazirmatn'; src:url('file://{FONT}/Vazirmatn-Medium.ttf'); font-weight:500; }}
@font-face {{ font-family:'Vazirmatn'; src:url('file://{FONT}/Vazirmatn-Bold.ttf'); font-weight:700; }}
* {{ box-sizing:border-box; margin:0; padding:0; }}
@page {{ size:A4; margin:0; }}
body {{ font-family:'Vazirmatn'; direction:rtl; color:#1a1a1a; width:210mm; font-size:10.5pt; }}
.page {{ width:210mm; min-height:297mm; padding:14mm 15mm 12mm; position:relative; page-break-after:always; display:flex; flex-direction:column; }}
.page:last-child {{ page-break-after:auto; }}
/* header */
.head {{ display:flex; align-items:center; justify-content:space-between; border-bottom:2.5px solid #0f5c5a; padding-bottom:6px; margin-bottom:10px; }}
.logo {{ width:58px; height:58px; border:1.5px dashed #8aa; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:7pt; color:#689; text-align:center; line-height:1.5; flex-shrink:0; }}
.co-name {{ text-align:center; }}
.co-name h2 {{ font-size:14pt; font-weight:700; color:#0f5c5a; }}
.co-name .sub {{ font-size:8.5pt; color:#555; margin-top:2px; }}
.head-no {{ text-align:left; font-size:9pt; color:#444; line-height:1.9; }}
.head-no b {{ color:#0f5c5a; }}
.title-band {{ background:#0f5c5a; color:#fff; text-align:center; font-weight:700; font-size:12.5pt; padding:6px; border-radius:6px; margin-bottom:10px; letter-spacing:.5px; }}
table {{ width:100%; border-collapse:collapse; }}
th, td {{ border:1px solid #9fb8b7; padding:4.5px 7px; font-size:9.5pt; }}
th {{ background:#e2efee; color:#0f3f3d; font-weight:700; }}
.num {{ font-variant-numeric:tabular-nums; }}
.sum td {{ background:#e2efee; font-weight:700; color:#0f3f3d; }}
.muted {{ color:#666; font-size:8.5pt; }}
.grid2 {{ display:grid; grid-template-columns:1fr 1fr; gap:6px 18px; }}
.info td {{ border:none; border-bottom:1px dotted #aab; padding:4px 2px; font-size:9.5pt; }}
.info td b {{ color:#0f5c5a; }}
.photo {{ width:78px; height:95px; border:1.5px dashed #8aa; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:7.5pt; color:#689; text-align:center; }}
.sign-row {{ margin-top:auto; display:flex; justify-content:space-between; padding:0 6mm; }}
.sign {{ text-align:center; font-size:10pt; }}
.sign .lbl {{ margin-bottom:34px; font-weight:700; color:#0f5c5a; }}
.foot {{ border-top:1px solid #bbb; margin-top:8px; padding-top:5px; font-size:8pt; color:#666; text-align:center; }}
.foot .nm {{ font-weight:700; color:#0f5c5a; }}
.note {{ background:#fdf6e7; border:1px solid #e5cf96; border-radius:6px; padding:7px 10px; font-size:8.5pt; color:#6a5312; margin-top:8px; line-height:1.8; }}
.clause {{ margin-bottom:7px; line-height:1.9; font-size:10pt; text-align:justify; }}
.clause b {{ color:#0f5c5a; }}
.page-no {{ position:absolute; bottom:6mm; left:15mm; font-size:8pt; color:#888; }}
"""

def head(doc_no, date, extra=''):
    return f"""
<div class="head">
  <div class="logo">لوگوی<br/>شرکت</div>
  <div class="co-name">
    <h2>{CO['name']}</h2>
    <div class="sub">مجموعه {CO['site']} — شماره ثبت {fas(CO['reg'])} · شناسه ملی {fas(CO['natid'])}</div>
  </div>
  <div class="head-no">شماره سند: <b>{fas(doc_no)}</b><br/>تاریخ: <b>{date}</b>{extra}</div>
</div>"""

def foot():
    return f"""
<div class="foot">امضای مدیرعامل: <span class="nm">{CO['ceo']}</span> &nbsp;&nbsp;|&nbsp;&nbsp; امضای همکار: <span class="nm">{CO['coworker']}</span> &nbsp;&nbsp;|&nbsp;&nbsp; {CO['name']}</div>"""

# ================= 1) قرارداد =================
contract = f"""<!DOCTYPE html><html lang="fa"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="page">
{head('۱۴۰۵۰۲۰۱', '۱۴۰۵/۰۱/۰۱')}
<div class="title-band">قرارداد پیمانکاری</div>
<p class="muted" style="margin-bottom:8px">شماره قرارداد: <b>{fas(emp['pn'])}</b> (شماره پرسنلی همکار) — این قرارداد به استناد ماده ۱۰ قانون کار ایران بین طرفین زیر منعقد می‌گردد.</p>

<table class="info" style="margin-bottom:10px"><tr>
<td><b>کارفرما:</b> {CO['name']} — نماینده: آقای {CO['ceo']} (مدیرعامل)</td>
<td><b>کارگر:</b> آقای {emp['name']} {emp['family']} — کد پرسنلی {fas(emp['pn'])}</td></tr>
<tr><td><b>شناسه ملی کارفرما:</b> {fas(CO['natid'])} · کد اقتصادی: {fas(CO['econ'])}</td>
<td><b>کد ملی:</b> {fas(emp['nat'])} · شماره بیمه: {fas(emp['ins'])}</td></tr></table>

<div class="clause"><b>بند ۱ – موضوع قرارداد:</b> انجام کار در سمت «{emp['job']}» در مجموعه {CO['site']}، مطابق آیین‌نامه‌های داخلی و دستورات مافوق.</div>
<div class="clause"><b>بند ۲ – مدت قرارداد:</b> از تاریخ <b>۱۴۰۵/۰۱/۰۱</b> تا تاریخ <b>۱۴۰۵/۱۲/۲۹</b> (قرارداد موقت یک‌ساله). در صورت ادامه کار با توافق کتبی طرفین، تمدید می‌گردد.</div>
<div class="clause"><b>بند ۳ – محل انجام کار:</b> {CO['addr']}.</div>
<div class="clause"><b>بند ۴ – مزد و مزایا:</b> مزد مبنا بر اساس <b>حداقل دستمزد مصوب شورای عالی کار سال ۱۴۰۵</b> تعیین شده و همه مزایای قانونی (سنوات، مسکن، بن کارگری، حق تاهل و حق اولاد) به‌علاوه اضافه‌کاری و اضافه‌پرداخت‌های قانونی طبق جدول حکم پرسنلی پیوست پرداخت می‌شود.</div>
<div class="clause"><b>بند ۵ – ساعات کار:</b> ۴۴ ساعت در هفته طبق جدول کارکنان مجموعه؛ کارکرد مازاد طبق ماده ۵۹ قانون کار به‌عنوان اضافه‌کاری محاسبه و پرداخت می‌گردد.</div>
<div class="clause"><b>بند ۶ – بیمه:</b> از تاریخ شروع به کار، کارگر بیمه‌شده تأمین اجتماعی شعبه رفسنجان است و حق بیمه سهم کارگر به‌طور ماهانه از مزد او کسر می‌شود.</div>
<div class="clause"><b>بند ۷ – تعطیلات:</b> جمعه‌ها روز تعطیل هفتگی است و مطابق قانون کار پرداخت می‌شود. مرخصی‌ها طبق ماده ۶۴ قانون کار.</div>
<div class="clause"><b>بند ۸ – وظایف و انضباط:</b> کارگر متعهد است قوانین، آیین‌نامه‌های انضباطی و اصول ایمنی و بهداشت کار مجموعه را رعایت کند.</div>
<div class="clause"><b>بند ۹ – محرمانگی:</b> هرگونه اطلاعات محرمانه مجموعه (مالی، اداری، مشتریان) صرفاً جهت انجام وظایف استفاده و برای غیر قابل افشا نیست.</div>
<div class="clause"><b>بند ۱۰ – فسخ قرارداد:</b> طرفین می‌توانند مطابق مواد ۲۱ و ۲۷ قانون کار قرارداد را فسخ نمایند؛ تسویه‌حساب نهایی طبق ضوابط قانون کار انجام می‌شود.</div>
<div class="clause"><b>بند ۱۱ – حل اختلاف:</b> در صورت بروز اختلاف، موضوع از طریق مراجع حل اختلاف قانون کار رسیدگی می‌شود.</div>
<div class="clause"><b>بند ۱۲ – تعداد نسخ:</b> این قرارداد در ۱۲ بند و ۲ نسخه واحدالاعتبار تنظیم و در تاریخ ۱۴۰۵/۰۱/۰۱ امضا شد.</div>

<div class="sign-row">
  <div class="sign"><div class="lbl">امضای کارفرما</div>{CO['ceo']} (مدیرعامل)</div>
  <div class="sign"><div class="lbl">امضای کارگر</div>{emp['name']} {emp['family']} — {fas(emp['pn'])}</div>
</div>
<div class="page-no">صفحه ۱ از ۲</div>
</div>

<div class="page">
<div class="title-band" style="background:#e2efee;color:#0f3f3d">جدول مزایا و پیوست‌های قرارداد — شماره {fas(emp['pn'])}</div>
<table>
<tr><th style="width:15%">ردیف</th><th>شرح مزایا</th><th style="width:30%">مبلغ ماهانه (ریال)</th></tr>
{''.join(f'<tr><td class="num">{fas(i+1)}</td><td>{t}</td><td class="num">{fa(v)}</td></tr>' for i, (t, v) in enumerate(hokm_rows))}
<tr class="sum"><td colspan="2">جمع کل مزایا (ماهانه)</td><td class="num">{fa(hokm_total)}</td></tr>
</table>
<div class="note">مبالغ فوق بر مبنای مصوبه شورای عالی کار سال ۱۴۰۵ (حداقل مزد روزانه {fa(DAILY_MIN)} ریال، پایه حقوق ماهانه {fa(BASE_30)} ریال) محاسبه شده است و با هر تغییر قانونی، به‌روزرسانی می‌شود.</div>
<table class="info" style="margin-top:10px">
<tr><td><b>شماره حساب حقوق:</b> {fas(emp['acc'])} — {emp['bank']}</td><td><b>شبا:</b> {fas(emp['sheba'])}</td></tr>
<tr><td><b>نشانی محل کار:</b> {CO['addr']}</td><td><b>تلفن مجموعه:</b> {CO['tel']}</td></tr>
</table>
<div class="sign-row">
  <div class="sign"><div class="lbl">امضای مدیرعامل</div>{CO['ceo']}</div>
  <div class="sign"><div class="lbl">امضای همکار</div>{CO['coworker']}</div>
</div>
<div class="page-no">صفحه ۲ از ۲</div>
{foot()}
</div></body></html>"""

# ================= 2) حکم پرسنلی =================
hokm = f"""<!DOCTYPE html><html lang="fa"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="page">
{head('۱۴۰۵-۰۲۱', '۱۴۰۵/۰۱/۰۱', extra='<br/>پیوست: قرارداد شماره ' + fas(emp['pn']))}
<div class="title-band">حکم پرسنلی و حکم حقوق</div>
<table style="margin-bottom:10px"><tr>
<td style="width:11%"><div class="photo">عکس<br/>همکار</div></td>
<td style="width:47%"><table class="info">
<tr><td><b>نام و نام خانوادگی:</b> {emp['name']} {emp['family']}</td></tr>
<tr><td><b>نام پدر:</b> {emp['father']} · <b>تاریخ تولد:</b> {emp['dob']}</td></tr>
<tr><td><b>کد ملی:</b> {fas(emp['nat'])} · <b>کد پرسنلی:</b> {fas(emp['pn'])}</td></tr>
<tr><td><b>شماره بیمه تأمین اجتماعی:</b> {fas(emp['ins'])}</td></tr>
<tr><td><b>وضعیت تأهل:</b> {emp['mar']} · <b>تحت تکفل:</b> {emp['dep']}</td></tr>
<tr><td><b>مدرک تحصیلی:</b> {emp['edu']} · <b>سمت:</b> {emp['job']}</td></tr></table></td>
<td><table class="info">
<tr><td><b>نوع قرارداد:</b> موقت یک‌ساله</td></tr>
<tr><td><b>تاریخ شروع:</b> ۱۴۰۵/۰۱/۰۱</td></tr>
<tr><td><b>تاریخ پایان:</b> ۱۴۰۵/۱۲/۲۹</td></tr>
<tr><td><b>محل خدمت:</b> {CO['site']}</td></tr>
<tr><td><b>مرکز هزینه:</b> خدمات</td></tr>
<tr><td><b>بانک حقوق:</b> {emp['bank']}</td></tr></table></td></tr></table>

<p class="clause">بسمه تعالی؛ حسب ماده ۳۳ قانون کار، آقای <b>{emp['name']} {emp['family']}</b> به سمت «{emp['job']}» در مجموعه {CO['site']} منصوب می‌گردد. مزایای قانونی حکم از تاریخ <b>۱۴۰۵/۰۱/۰۱</b> به شرح جدول زیر برقرار است:</p>

<table>
<tr><th style="width:12%">ردیف</th><th>شرح</th><th style="width:32%">مبلغ ماهانه (ریال)</th></tr>
{''.join(f'<tr><td class="num">{fas(i+1)}</td><td>{t}</td><td class="num">{fa(v)}</td></tr>' for i, (t, v) in enumerate(hokm_rows))}
<tr class="sum"><td colspan="2">جمع مزایای ماهانه حکم</td><td class="num">{fa(hokm_total)}</td></tr>
</table>

<div class="note">۱) مبنا: مصوبه شورای عالی کار سال ۱۴۰۵ — حداقل مزد روزانه <b>{fa(DAILY_MIN)}</b> ریال و پایه حقوق ماهانه (۳۰ روز) <b>{fa(BASE_30)}</b> ریال؛ نرخ اضافه‌کاری هر ساعت <b>{fa(OT_HOUR)}</b> ریال.<br/>
۲) حق اولاد صرفاً به ازای فرزندان مشمول تحت تکفل (حداکثر ۶ فرزند) طبق قانون پرداخت می‌شود.<br/>
۳) این حکم جایگزین حکم شماره ۱۴۰۴-۱۹۸ در همان سمت با همین مزایا در سال قبل است.</div>

<div class="sign-row">
  <div class="sign"><div class="lbl">امضای مدیرعامل</div>{CO['ceo']}</div>
  <div class="sign"><div class="lbl">امضای همکار / اداری</div>{CO['coworker']}</div>
  <div class="sign"><div class="lbl">امضای همکار</div>{emp['name']} {emp['family']}</div>
</div>
<div class="page-no">صفحه ۱ از ۱</div>
{foot()}
</div></body></html>"""

# ================= 3) فیش حقوقی =================
fish = f"""<!DOCTYPE html><html lang="fa"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="page">
{head('۱۴۰۵۰۲۰۱', '۱۴۰۵/۰۸/۳۰')}
<div class="title-band">فیش حقوقی و دستمزد — ماه آبان ۱۴۰۵</div>
<table style="margin-bottom:10px"><tr>
<td style="width:10%"><div class="photo" style="width:60px;height:75px">عکس</div></td>
<td><table class="info">
<tr><td><b>نام و نام خانوادگی:</b> {emp['name']} {emp['family']}</td><td><b>کد پرسنلی:</b> {fas(emp['pn'])}</td></tr>
<tr><td><b>سمت:</b> {emp['job']} — {CO['site']}</td><td><b>کد ملی:</b> {fas(emp['nat'])}</td></tr>
<tr><td><b>شماره بیمه:</b> {fas(emp['ins'])}</td><td><b>وضعیت:</b> {emp['mar']} / تحت تکفل {emp['dep']}</td></tr>
<tr><td><b>حساب حقوق:</b> {fas(emp['acc'])} — {emp['bank']}</td><td><b>کارکرد:</b> ۳۰ روز · اضافه‌کاری: {fas(ot_hours)} ساعت</td></tr>
</table></td></tr></table>

<table><tr>
<th style="width:50%">جمع درآمد (مزایا)</th><th>مبلغ (ریال)</th>
<th style="width:3px;border-right:none;border-left:none;background:#fff"></th>
<th style="width:50%;border-right:1px solid #9fb8b7">کسورات</th><th>مبلغ (ریال)</th></tr>
{''.join(f'<tr><td>{t}</td><td class="num">{fa(v)}</td><td style="border:none"></td><td>{d}</td><td class="num">{fa(dv)}</td></tr>' for (t, v), (d, dv) in zip(slip_income + [('','')]*(len(slip_deduct)-len(slip_income)), slip_deduct + [('','')]*(len(slip_income)-len(slip_deduct))))}
<tr class="sum"><td>جمع کل درآمد</td><td class="num">{fa(sum_income)}</td><td style="border:none"></td><td>جمع کسورات</td><td class="num">{fa(sum_deduct)}</td></tr>
</table>

<table style="margin-top:10px">
<tr class="sum"><td>مزد مشمول بیمه (ماهانه)</td><td class="num">{fa(ins_base)}</td><td>حق بیمه سهم کارفرما (۲۳٪)</td><td class="num">{fa(round(ins_base*23/100))}</td></tr>
<tr class="sum"><td><b>خالص قابل پرداخت (ریال)</b></td><td class="num">{fa(net_pay)}</td><td>مالیات حقوق</td><td class="num">۰ (در معافیت قانونی)</td></tr>
</table>

<div class="note">مبالغ بر اساس حداقل دستمزد مصوب شورای عالی کار سال ۱۴۰۵ محاسبه شده است؛ معافیت مالیاتی ماهانه حقوق در سال ۱۴۰۵ معادل {fa(tax_monthly_exempt)} ریال است و درآمد مشمول مالیات این همکار کمتر از آن است. این فیش صرفاً جهت اطلاع همکار صادر شده و مبنای بیمه و مالیات همان مبالغ اعلامی به تأمین اجتماعی و سازمان امور مالیاتی است.</div>

<div class="sign-row">
  <div class="sign"><div class="lbl">مهر و امضای کارفرما</div>{CO['ceo']}</div>
  <div class="sign"><div class="lbl">امضای همکار (وصول حقوق)</div>{emp['name']} {emp['family']}</div>
</div>
<div class="page-no">صفحه ۱ از ۱</div>
{foot()}
</div></body></html>"""

# ================= 4) تسویه حساب و پایان کار =================
tasviye = f"""<!DOCTYPE html><html lang="fa"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="page">
{head('۱۴۰۵۰۲۰۱-ت', '۱۴۰۵/۰۸/۱۴')}
<div class="title-band">فرم تسویه‌حساب و پایان کار</div>
<table style="margin-bottom:10px"><tr>
<td style="width:10%"><div class="photo">عکس<br/>همکار</div></td>
<td><table class="info">
<tr><td><b>نام و نام خانوادگی:</b> {emp['name']} {emp['family']}</td><td><b>کد پرسنلی:</b> {fas(emp['pn'])}</td></tr>
<tr><td><b>کد ملی:</b> {fas(emp['nat'])} · <b>شماره بیمه:</b> {fas(emp['ins'])}</td><td><b>سمت:</b> {emp['job']}</td></tr>
<tr><td><b>تاریخ شروع به کار:</b> {start}</td><td><b>آخرین روز کار:</b> {lastday}</td></tr>
<tr><td><b>سابقه کار در مجموعه:</b> ۱ سال و ۷ ماه</td><td><b>علت خروج:</b> پایان قرارداد — توافق طرفین</td></tr>
</table></td></tr></table>

<p style="font-size:9.5pt;margin-bottom:6px"><b>وضعیت حساب همکار هنگام تسویه (ریال):</b></p>
<table>
<tr><th style="width:8%">ردیف</th><th>شرح</th><th style="width:30%">مبلغ (ریال)</th></tr>
{''.join(f'<tr><td class="num">{fas(i+1)}</td><td>{t}</td><td class="num">{fa(v)}</td></tr>' for i, (t, v) in enumerate(settle_items))}
<tr class="sum"><td colspan="2">جمع مطالبات</td><td class="num">{fa(sum_settle)}</td></tr>
{''.join(f'<tr><td class="num">{fas(len(settle_items)+i+1)}</td><td>کسورات — {t}</td><td class="num">{fa(v)}</td></tr>' for i, (t, v) in enumerate(settle_deduct))}
<tr class="sum"><td colspan="2">جمع کسورات</td><td class="num">{fa(sum_settle_deduct)}</td></tr>
<tr class="sum"><td colspan="2" style="font-size:11pt"><b>خالص قابل پرداخت بابت تسویه‌حساب</b></td><td class="num" style="font-size:11pt">{fa(net_settle)}</td></tr>
</table>

<p style="font-size:9.5pt;margin-top:8px"><b>مشخصات حساب پرداخت تسویه‌حساب:</b></p>
<table>
<tr><th>نام صاحب حساب</th><th>شماره حساب</th><th>بانک / شعبه</th><th>شبا</th></tr>
<tr><td>{emp['name']} {emp['family']}</td><td class="num">{fas(emp['acc'])}</td><td>{emp['bank']}</td><td class="num">{fas(emp['sheba'])}</td></tr>
</table>

<div class="note"><b>توضیحات:</b><br/>
۱) مانده مرخصی بر اساس ماده ۶۶ قانون کار و عیدی/پاداش بر اساس ماده ۸۹ قانون کار محاسبه شده است.<br/>
۲) حق سنوات پایان کار بر مبنای ۴۵ روز مزد به ازای هر سال کارکرد (ماده ۲۴ قانون کار) پرداخت می‌شود.<br/>
۳) کارت بیمه و لیست بیمه تیرماه تا پایان دوره در سیستم تأمین اجتماعی صادر و تحویل همکار خواهد شد.<br/>
۴) با دریافت کامل مبالغ فوق، همکار هیچ‌گونه طلب دیگری از مجموعه نداشته و رسید کامل محسوب می‌شود.</div>

<div class="sign-row" style="margin-top:14px">
  <div class="sign"><div class="lbl">امضای مدیرعامل</div>{CO['ceo']}</div>
  <div class="sign"><div class="lbl">امضای همکار / اداری</div>{CO['coworker']}</div>
  <div class="sign"><div class="lbl">امضای و مهر همکار</div>{emp['name']} {emp['family']}</div>
</div>
<div class="page-no">صفحه ۱ از ۱</div>
{foot()}
</div></body></html>"""

docs = {
    '01-gharardad-mohammadi.html': contract,
    '02-hokm-mohammadi.html': hokm,
    '03-fish-hoghughi-mohammadi.html': fish,
    '04-tasviye-hesab-mohammadi.html': tasviye,
}
for name, html in docs.items():
    (OUT / name).write_text(html, encoding='utf-8')
    print('written', name)

# sanity check arithmetic
print('hokm_total =', hokm_total)          # expect 261,506,600
print('sum_income =', sum_income)          # 303,845,400
print('ins7 =', ins7, 'net_pay =', net_pay)  # 263,893,799
print('sum_settle =', sum_settle, 'ins7_settle =', ins7_settle, 'net_settle =', net_settle)
