# -*- coding: utf-8 -*-
"""بررسی ساختار دقیق فایل دستگاه حضور و غیاب - نسخه فشرده"""
import xlrd
import openpyxl

UP = "/home/z/my-project/upload/"

print("###### بخش 1: فایل دستگاه mehr1405 (xlrd خام) ######")
wb = xlrd.open_workbook(UP + "ساعات کارکرد دستگاه mehr1405.xls", formatting_info=False)
print("تعداد شیت:", wb.nsheets)
for si in range(min(wb.nsheets, 6)):
    sh = wb.sheet_by_index(si)
    print(f"\n--- Sheet{si+1}: {sh.nrows} rows x {sh.ncols} cols ---")
    for r in range(min(sh.nrows, 12)):
        vals = []
        for c in range(min(sh.ncols, 45)):
            v = sh.cell_value(r, c)
            if v not in ("", None):
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                vals.append(f"[{c}]{v}")
        if vals:
            print(f"  r{r}: " + " | ".join(str(x) for x in vals)[:400])
