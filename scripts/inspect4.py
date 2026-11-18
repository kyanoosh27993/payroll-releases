# -*- coding: utf-8 -*-
"""بررسی ۴ فایل xlsx پرسنلی"""
import openpyxl

UP = "/home/z/my-project/upload/"

def dump(path, label, max_rows=8):
    wb = openpyxl.load_workbook(path, data_only=True)
    print(f"\n{'#'*90}\n# {label} | شیت‌ها: {wb.sheetnames}")
    for sh in wb.worksheets:
        print(f"\n--- شیت «{sh.title}»: {sh.max_row} سطر × {sh.max_column} ستون ---")
        for r in range(1, min(sh.max_row, max_rows) + 1):
            vals = []
            for c in range(1, sh.max_column + 1):
                v = sh.cell(r, c).value
                if v is not None and str(v).strip() != "":
                    vals.append(f"[{c}]{v}")
            if vals:
                print(f"r{r}: " + " | ".join(str(x) for x in vals)[:600])

dump(UP + "5.xlsx", "5.xlsx", 12)
dump(UP + "لیست احکام حقوق.xlsx", "لیست احکام حقوق", 12)
dump(UP + "لیست پرسنل این ماه.xlsx", "لیست پرسنل این ماه", 12)
dump(UP + "لیست مشخصات پرسنل.xlsx", "لیست مشخصات پرسنل", 12)
