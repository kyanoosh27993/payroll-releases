#!/usr/bin/env python3
# تبدیل خروجی‌ها به PDF و عکس — جبران ۴۰۴
import subprocess, os, glob

OUT = '/home/z/my-project/download/preview-outputs'
os.makedirs(OUT, exist_ok=True)
os.chdir(OUT)

# ۱) docx → PDF با LibreOffice
pairs = [
    ('tmp-contract.docx', '01-gharardad-mohammadi.pdf'),
    ('tmp-hokm.docx',     '02-hokm-mohammadi.pdf'),
    ('tmp-tasviye.docx',  '04-tasviye-hesab-mohammadi.pdf'),
]
for src, dst in pairs:
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', OUT, src], check=True,
                   capture_output=True, timeout=120)
    # نام خروجی LO = src با پسوند pdf → تغییر نام
    produced = src.rsplit('.', 1)[0] + '.pdf'
    os.replace(produced, dst)
    print('PDF OK:', dst, os.path.getsize(dst))

# ۲) فیش HTML → PDF با Playwright
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': 1100, 'height': 1600})
    pg.goto('file://' + OUT + '/tmp-fish.html')
    pg.wait_for_timeout(1500)
    pg.pdf(path=OUT + '/03-fish-hoghughi-mohammadi.pdf', prefer_css_page_size=True, print_background=True)
    b.close()
print('PDF OK: 03-fish-hoghughi-mohammadi.pdf', os.path.getsize(OUT + '/03-fish-hoghughi-mohammadi.pdf'))

# ۳) PDF → JPEG صفحات
jobs = [
    ('01-gharardad-mohammadi.pdf', 'contract'),
    ('02-hokm-mohammadi.pdf', 'hokm'),
    ('03-fish-hoghughi-mohammadi.pdf', 'fish'),
    ('04-tasviye-hesab-mohammadi.pdf', 'tasviye'),
]
for pdf, tag in jobs:
    subprocess.run(['pdftoppm', '-r', '90', '-jpeg', '-jpegopt', 'quality=80', pdf, f'{OUT}/page-{tag}'], check=True, timeout=60)
pages = sorted(glob.glob(OUT + '/page-*.jpg'))
for p in pages:
    print('IMG:', os.path.basename(p), os.path.getsize(p))
print('CONVERT-DONE')
