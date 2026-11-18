# -*- coding: utf-8 -*-
"""آماده‌سازی قالب‌های ورد «برنامه‌محور» از فایل‌های رسمی کاربر — نسخه ۱٫۴٫۶
ورودی: upload/قرارداد خام عادی.docx، قرارداد خام با مبلغ معین.docx، سربرگ شرکت آریان کویر رفسنجان رسمی و نهایی.docx، نمونه قرارداد.docx
خروجی: public/templates/contract-hourly.docx، contract-fixed.docx، letterhead.docx
نسخه ۱٫۴٫۶:
  • بلوک بالای قرارداد (شماره/تاریخ/پیوست + عکس شناور) دقیقاً از نمونه قرارداد کاربر کپی می‌شود
  • همه ارقام متن به ارقام فارسی تبدیل می‌شوند (مطابق نمایش Word کاربر)
  • نقطه‌چین «امضای همکار» در فوتر → توکن نام پرسنل {{P_SIGN_NAME}}
  • فونت‌های «2  Nazanin»/Aldhabi بلوک بالا → B Nazanin (روی سیستم چاپ موجود است)"""
import re, os, shutil, zipfile

UP = '/home/z/my-project/upload'
OUT = '/home/z/my-project/public/templates'
os.makedirs(OUT, exist_ok=True)

def runs_of(xml):
    return [(m.start(), m.end(), m.group(2)) for m in re.finditer(r'(<w:t[^>]*>)([^<]*)(</w:t>)', xml)]

def replace_dots_with_tokens(xml, tokens):
    idx = 0
    def sub(m):
        nonlocal idx
        head, text, tail = m.group(1), m.group(2), m.group(3)
        cnt = len(re.findall(r'\.{6,}', text))
        out = re.sub(r'\.{6,}', tokens[idx] if idx < len(tokens) else lambda d: d.group(0), text) if cnt == 1 and idx < len(tokens) else re.sub(r'\.{6,}', lambda d: tokens[idx] if idx < len(tokens) else d.group(0), text)
        idx += cnt
        return head + out + tail
    return re.sub(r'(<w:t[^>]*>)([^<]*)(</w:t>)', sub, xml), idx


def fix_checkboxes(xml):
    """نسخه ۱٫۴٫۶ — چک‌باکس‌های Wingdings 2 → یونی‌کد ☐/☑ (رندر درست در چاپ و Word — همان run حفظ می‌شود)"""
    xml = xml.replace('<w:sym w:font="Wingdings 2" w:char="F035"/>', '<w:t>☐</w:t>')
    xml = xml.replace('<w:sym w:font="Wingdings 2" w:char="F052"/>', '<w:t>☑</w:t>')
    return xml

def fa_digits_in_wt(xml):
    """تبدیل ارقام لاتین داخل w:t به ارقام فارسی — مطابق نمایش Word (سایر اجزا: instrText/sym/attrs دست‌نخورده)"""
    def sub(m):
        head, text, tail = m.group(1), m.group(2), m.group(3)
        if '{{' in text:
            return m.group(0)
        return head + text.translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')) + tail
    return re.sub(r'(<w:t[^>]*>)([^<]*)(</w:t>)', sub, xml)

# ---------------- استخراج بلوک بالای قرارداد از نمونه کاربر ----------------
def extract_top_block():
    with zipfile.ZipFile(os.path.join(UP, 'نمونه قرارداد.docx')) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    body_start = xml.find('<w:body>') + len('<w:body>')
    # عنوان «قرارداد ساعت‌کاری با مدت مشخص» (در XML چند run شکسته) = پایان بلوک بالا
    ti = xml.find(' با مدت مشخص')
    assert ti > body_start
    pstart = xml.rfind('<w:p ', 0, ti)
    block = xml[body_start:pstart]
    # توکن‌گذاری مقادیر + عکس + فونت‌ها
    block = block.replace('14050170', '{{C_DOC_NUM}}')
    block = block.replace('09/08/1405', '{{C_DOC_DATE}}')
    block = block.replace('ندارد', '{{C_PIAVAST}}')
    block = block.replace('rId7', '{{RID_PHOTO}}')
    # فونت‌های نمونه که در سیستم چاپ نیستند → B Nazanin
    block = block.replace('2  Nazanin', 'B Nazanin').replace('Aldhabi', 'B Nazanin')
    assert '{{C_DOC_NUM}}' in block and '{{RID_PHOTO}}' in block, 'بلوک بالا توکن نشد'
    return block

TOP_BLOCK = extract_top_block()
print('TOP-BLOCK extracted:', len(TOP_BLOCK), 'chars — tokens OK')

def inject_top(xml):
    """درج بلوک بالا در ابتدای بدنه"""
    at = xml.find('<w:body>') + len('<w:body>')
    return xml[:at] + TOP_BLOCK + xml[at:]

def save_docx(dst, names, data):
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in names:
            z.writestr(n, data[n])

# ---------------- قرارداد خام عادی (ساعتی) ----------------
TOK_HOURLY = ['{{P_NAME}}','{{P_FATHER}}','{{P_BIRTH}}','{{P_IDNUM}}','{{P_NATID}}','{{P_EDU}}',
              '{{P_ADDR0}}','{{P_ADDR1}}','{{P_ADDR2}}','{{P_ADDR3}}','{{P_ADDR4}}','{{P_ADDR5}}',
              '{{P_POSTAL}}','{{P_PHONE0}}','{{P_PHONE1}}','{{P_PHONE2}}',
              '{{P_MOBILE0}}','{{P_MOBILE1}}','{{P_MOBILE2}}',
              '{{P_JOB0}}','{{P_JOB1}}','{{P_JOB2}}','{{P_DEPT}}',
              '{{OTHER_BEN}}','{{ATTRACTION}}',
              '{{P_SHEBA0}}','{{P_SHEBA1}}','{{P_SHEBA2}}','{{P_BANK}}',
              '{{C_START0}}','{{C_START1}}','{{C_START2}}','{{C_END0}}','{{C_END1}}','{{C_END2}}']

def build_contract_hourly():
    src = os.path.join(UP, 'قرارداد خام عادی.docx')
    dst = os.path.join(OUT, 'contract-hourly.docx')
    shutil.copy(src, dst)
    with zipfile.ZipFile(dst) as z:
        names = z.namelist()
        data = {n: z.read(n) for n in names}
    xml = data['word/document.xml'].decode('utf-8')
    xml, n = replace_dots_with_tokens(xml, TOK_HOURLY)
    assert n == len(TOK_HOURLY), f'عادی: {n} توالی نقطهچین (انتظار ۳۵)'
    labels = {
        'حقوق پایه ساعتی :': '{{HOURLY_WAGE}}',
        'حقوق ماهانه 30 روز :': '{{MONTHLY_WAGE}}',
        'حق مسکن :': '{{HOUSING}}',
        'بن کارگری :': '{{WORKER_BEN}}',
    }
    for lab, tok in labels.items():
        pos = xml.find(lab)
        assert pos > 0, f'برچسب یافت نشد: {lab}'
        after = xml[pos+len(lab):pos+len(lab)+2000]
        seg_runs = []
        for m2 in re.finditer(r'<w:t[^>]*>([^<]*)</w:t>', after):
            t = m2.group(1)
            ts = t.strip()
            if not ts: continue
            if re.fullmatch(r'[\d\.]+', ts):
                seg_runs.append(m2)
                continue
            num_head = re.match(r'[\d\.\s]+(?=\s*ريال)', t)
            if num_head and seg_runs:
                seg_runs.append(m2)
                break
            break
        assert seg_runs, f'عدد جدول برای {lab} یافت نشد'
        last = seg_runs[-1]
        seg_start = pos+len(lab)+seg_runs[0].start()
        seg_end = pos+len(lab)+last.end()
        last_full = last.group(0)
        last_text = last.group(1)
        m_last = re.match(r'([\d\.\s]+)(\s*ريال.*)?$', last_text, re.S)
        if m_last:
            kept_tail = m_last.group(2) or ''
            last_xml_new = re.sub(r'(<w:t[^>]*>)[^<]*(</w:t>)', lambda mm: mm.group(1) + kept_tail + mm.group(2), last_full, count=1)
        else:
            last_xml_new = ''
        xml = xml[:seg_start] + '<w:t xml:space="preserve">{{NUM}}</w:t>' + last_xml_new + xml[seg_end:]
        xml = xml.replace('{{NUM}}', tok, 1)
    xml = xml.replace('<w:t xml:space="preserve">16.625.550</w:t>', '<w:t xml:space="preserve">{{CHILD_ALLOW}}</w:t>')
    xml = xml.replace('<w:t xml:space="preserve">5.000.000</w:t>', '<w:t xml:space="preserve">{{FAMILY_ALLOW}}</w:t>')
    if '{{CHILD_ALLOW}}' not in xml:
        xml = xml.replace('>16.625.550<', '>{{CHILD_ALLOW}}<')
        xml = xml.replace('>5.000.000<', '>{{FAMILY_ALLOW}}<')
    assert '{{CHILD_ALLOW}}' in xml and '{{FAMILY_ALLOW}}' in xml, 'حق اولاد/عائله‌مندی توکن نشد'
    # نسخه ۱٫۴٫۶ — بلوک بالا از نمونه + ارقام فارسی
    xml = inject_top(xml)
    xml = fix_checkboxes(xml)
    xml = fa_digits_in_wt(xml)
    data['word/document.xml'] = xml.encode('utf-8')
    # فوتر: نام پرسنل جای نقطه‌چین امضای همکار
    f = data['word/footer1.xml'].decode('utf-8')
    assert '........................................' in f, 'نقطه‌چین امضا در فوتر یافت نشد'
    f = f.replace('........................................', '{{P_SIGN_NAME}}')
    data['word/footer1.xml'] = f.encode('utf-8')
    save_docx(dst, names, data)
    print('OK contract-hourly: توکن‌ها + بلوک بالا + ارقام فارسی + امضای همکار')

# ---------------- قرارداد خام با مبلغ معین ----------------
TOK_FIXED = ['{{P_NAME}}','{{P_FATHER}}','{{P_BIRTH}}','{{P_IDNUM}}','{{P_NATID}}','{{P_EDU}}',
             '{{P_ADDR0}}','{{P_ADDR1}}','{{P_ADDR2}}','{{P_ADDR3}}','{{P_ADDR4}}','{{P_ADDR5}}',
             '{{P_POSTAL}}','{{P_PHONE0}}','{{P_PHONE1}}','{{P_PHONE2}}',
             '{{P_MOBILE0}}','{{P_MOBILE1}}','{{P_MOBILE2}}',
             '{{P_JOB0}}','{{P_JOB1}}','{{P_JOB2}}','{{P_DEPT}}',
             '{{DAILY_WAGE}}','{{MOAIN0}}','{{MOAIN1}}','{{MOAIN2}}',
             '{{P_SHEBA0}}','{{P_SHEBA1}}','{{P_SHEBA2}}','{{P_SHEBA3}}','{{P_SHEBA4}}','{{P_BANK}}',
             '{{C_START0}}','{{C_START1}}','{{C_START2}}','{{C_END0}}','{{C_END1}}','{{C_END2}}']

def build_contract_fixed():
    src = os.path.join(UP, 'قرارداد خام با مبلغ معین.docx')
    dst = os.path.join(OUT, 'contract-fixed.docx')
    shutil.copy(src, dst)
    with zipfile.ZipFile(dst) as z:
        names = z.namelist(); data = {n: z.read(n) for n in names}
    xml = data['word/document.xml'].decode('utf-8')
    xml, n = replace_dots_with_tokens(xml, TOK_FIXED)
    assert n == len(TOK_FIXED), f'معین: {n} توالی (انتظار ۳۹)'
    xml = inject_top(xml)
    xml = fix_checkboxes(xml)
    xml = fa_digits_in_wt(xml)
    data['word/document.xml'] = xml.encode('utf-8')
    f = data['word/footer1.xml'].decode('utf-8')
    if '........................................' in f:
        f = f.replace('........................................', '{{P_SIGN_NAME}}')
    data['word/footer1.xml'] = f.encode('utf-8')
    save_docx(dst, names, data)
    print('OK contract-fixed: توکن‌ها + بلوک بالا + ارقام فارسی + امضای همکار')

# ---------------- سربرگ رسمی ----------------
def build_letterhead():
    src = os.path.join(UP, 'سربرگ شرکت آریان کویر رفسنجان رسمی و نهایی.docx')
    dst = os.path.join(OUT, 'letterhead.docx')
    shutil.copy(src, dst)
    with zipfile.ZipFile(dst) as z:
        names = z.namelist(); data = {n: z.read(n) for n in names}
    xml = data['word/document.xml'].decode('utf-8')
    body_start = xml.find('<w:body>') + len('<w:body>')
    sect = xml.find('<w:sectPr')
    assert body_start > 8 and sect > body_start
    body = '<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:t xml:space="preserve">{{LH_BODY}}</w:t></w:r></w:p>'
    xml = xml[:body_start] + body + xml[sect:]
    data['word/document.xml'] = xml.encode('utf-8')
    h = data['word/header1.xml'].decode('utf-8')
    def rep2(x, old, new):
        assert x.count(old) >= 1, f'هدر: {old} یافت نشد'
        return x.replace(old, new)
    h = rep2(h, '<w:t>2154</w:t>', '<w:t>{{LH_NUM}}</w:t>')
    h = rep2(h, '<w:t>01</w:t>', '<w:t>{{LH_NUM2}}</w:t>')
    h = rep2(h, '<w:t>09</w:t>', '<w:t>{{LH_D}}</w:t>')
    h = rep2(h, '<w:t>08</w:t>', '<w:t>{{LH_M}}</w:t>')
    h = rep2(h, '<w:t>/140</w:t>', '<w:t>/</w:t>')
    h = rep2(h, '<w:t>5</w:t>', '<w:t>{{LH_Y}}</w:t>')
    for tok in ['{{LH_NUM}}','{{LH_NUM2}}','{{LH_D}}','{{LH_M}}','{{LH_Y}}']:
        assert tok in h, f'سربرگ: توکن {tok} در هدر نشست'
    data['word/header1.xml'] = h.encode('utf-8')
    save_docx(dst, names, data)
    print('OK letterhead')

build_contract_hourly()
build_contract_fixed()
build_letterhead()

# ---------------- راستی‌آزمایی ----------------
import subprocess
for f in ['contract-hourly.docx', 'contract-fixed.docx', 'letterhead.docx']:
    p = os.path.join(OUT, f)
    txt = subprocess.run(['pandoc', p, '-t', 'plain'], capture_output=True, text=True).stdout
    toks = sorted(set(re.findall(r'\{\{[A-Z_0-9]+\}\}', txt)))
    print(f, '→', len(toks), 'توکن:', ' '.join(toks[:12]), '...')
print('DONE')
