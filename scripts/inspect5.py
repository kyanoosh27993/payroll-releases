# -*- coding: utf-8 -*-
"""سرستون‌های کامل 5.xlsx و تعداد رکوردها"""
import openpyxl

UP = "/home/z/my-project/upload/"
wb = openpyxl.load_workbook(UP + "5.xlsx", data_only=True)
sh = wb.active
hdr = [sh.cell(1, c).value for c in range(1, sh.max_column + 1)]
print("هدر کامل 5.xlsx (43 ستون):")
for i, h in enumerate(hdr, 1):
    print(f"  {i}: {h}")
print("\nتعداد ردیف داده:", sh.max_row - 1)

wb2 = openpyxl.load_workbook(UP + "لیست احکام حقوق.xlsx", data_only=True)
print("\nاحکام حقوق - تعداد ردیف:", wb2.active.max_row - 6)

wb3 = openpyxl.load_workbook(UP + "لیست پرسنل این ماه.xlsx", data_only=True)
print("پرسنل این ماه - تعداد ردیف:", wb3.active.max_row - 4)

wb4 = openpyxl.load_workbook(UP + "لیست مشخصات پرسنل.xlsx", data_only=True)
print("مشخصات پرسنل - تعداد ردیف:", wb4.active.max_row - 6)
