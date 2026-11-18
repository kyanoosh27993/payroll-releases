# -*- coding: utf-8 -*-
"""ساختار کامل یک شیت از فایل دستگاه + فهرست همه افراد"""
import xlrd

UP = "/home/z/my-project/upload/"
wb = xlrd.open_workbook(UP + "ساعات کارکرد دستگاه mehr1405.xls")

print("###### شیت 1 کامل (همه ردیف‌ها) ######")
sh = wb.sheet_by_index(0)
for r in range(sh.nrows):
    vals = []
    for c in range(sh.ncols):
        v = sh.cell_value(r, c)
        if v not in ("", None):
            if isinstance(v, float) and v == int(v):
                v = int(v)
            vals.append(f"[{c}]{v}")
    if vals:
        print(f"r{r}: " + " | ".join(str(x) for x in vals)[:500])

print("\n###### فهرست همه شیت‌ها (نام و کد قسمت) ######")
for si in range(wb.nsheets):
    sh = wb.sheet_by_index(si)
    name, code = "", ""
    for r in range(min(14, sh.nrows)):
        for c in range(sh.ncols):
            v = sh.cell_value(r, c)
            if isinstance(v, str) and ":" in v and "نام" in v:
                name = sh.cell_value(r, 33) if c < 33 else ""
            if isinstance(v, str) and "قسمت" in v:
                code = sh.cell_value(r, c + 6)
    print(f"Sheet{si+1}: code={code} name={name}")
