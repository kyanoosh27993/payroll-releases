# -*- coding: utf-8 -*-
"""بررسی دقیق فایل‌های اکسل ارسالی کاربر"""
import pandas as pd
import sys

UP = "/home/z/my-project/upload/"

def show_sheet(name, df, max_cols=40, max_rows=15):
    print("=" * 100)
    print(f"### فایل/شیت: {name}  |  ابعاد: {df.shape[0]} سطر × {df.shape[1]} ستون")
    print("-" * 100)
    print("ستون‌ها:", list(df.columns)[:max_cols])
    print("-" * 100)
    with pd.option_context('display.max_columns', max_cols, 'display.width', 250,
                           'display.max_colwidth', 25):
        print(df.head(max_rows))
    print()

def inspect_xlsx(path, label):
    xl = pd.ExcelFile(path, engine="openpyxl")
    print(f"\n{'#'*100}\n# فایل: {label}\n# شیت‌ها: {xl.sheet_names}\n{'#'*100}")
    for sh in xl.sheet_names:
        df = xl.parse(sh, header=None, nrows=20)
        show_sheet(f"{label} :: {sh}", df)

def inspect_xls(path, label):
    xl = pd.ExcelFile(path, engine="xlrd")
    print(f"\n{'#'*100}\n# فایل: {label}\n# شیت‌ها: {xl.sheet_names}\n{'#'*100}")
    for sh in xl.sheet_names:
        df = xl.parse(sh, header=None, nrows=20)
        show_sheet(f"{label} :: {sh}", df)

# 1) فایل دستگاه حضور و غیاب (xls قدیمی)
inspect_xls(UP + "ساعات کارکرد دستگاه mehr1405.xls", "دستگاه حضور و غیاب mehr1405")

# 2) سایر فایل‌ها
inspect_xlsx(UP + "5.xlsx", "5.xlsx")
inspect_xlsx(UP + "لیست احکام حقوق.xlsx", "لیست احکام حقوق")
inspect_xlsx(UP + "لیست پرسنل این ماه.xlsx", "لیست پرسنل این ماه")
inspect_xlsx(UP + "لیست مشخصات پرسنل.xlsx", "لیست مشخصات پرسنل")
