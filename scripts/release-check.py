#!/usr/bin/env python3
"""چک اجباری قبل از ارسال لینک دانلود — قانون بخش ۱۰ سند قوانین (docs/06-conventions.md).

کارکردها:
۱) تطابق شماره نسخه در همه اجزا (سورس + دسکتاپ + batها + changelog + README)
۲) بهداشت download/: فقط فایل‌های نسخه جاری؛ حذف هر فایل نسخه قبلی
۳) تازگی فایل‌ها: mtime فایل تحویلی باید بعد از زمان build جاری باشد
۴) md5 هر سه فایل تحویلی برای گزارش در پیام تحویل

خروجی: RELEASE-OK یا RELEASE-FAIL با دلیل — در صورت FAIL ارسال لینک ممنوع است.
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path("/home/z/my-project")
DL = ROOT / "download"

CHECKS = []      # (name, ok, detail)
FAILED = []


def check(name, ok, detail=""):
    CHECKS.append((name, ok, detail))
    if not ok:
        FAILED.append(name)
    print(f"{'PASS' if ok else 'FAIL'} | {name} {('— ' + detail) if detail else ''}")


def version_from_desktop_pkg():
    data = json.loads((ROOT / "desktop" / "package.json").read_text(encoding="utf-8"))
    return data["version"], ""


def main():
    version, _unused = version_from_desktop_pkg()
    v = version  # مثل 1.4.0
    print(f"=== release-check برای نسخه {v} ===")

    # ۱) تطابق نسخه در اجزای سورس
    # برای layout.tsx نسخه با ارقام فارسی و جداکننده ٫ یا . نوشته می‌شود
    fa_d = {c: fa for c, fa in zip("0123456789", "۰۱۲۳۴۵۶۷۸۹")}
    v_fa_layout = "".join(fa_d.get(c, c) for c in v).replace(".", "[٫.]")
    src_checks = [
        ("src/components/app-state.tsx", re.compile(r"['\"]" + re.escape(v) + r"['\"]")),
        ("src/components/modules/help.tsx", re.compile(re.escape(v))),
        ("src/components/app-shell.tsx", re.compile(re.escape(v))),
        ("src/app/api/context/route.ts", re.compile(r"['\"]" + re.escape(v) + r"['\"]")),
        ("src/app/layout.tsx", re.compile(v_fa_layout)),
        ("build-exe.bat", re.compile(re.escape(v))),
        ("run-web.bat", re.compile(re.escape(v))),
    ]
    for rel, pat in src_checks:
        p = ROOT / rel
        ok = p.exists() and bool(pat.search(p.read_text(encoding="utf-8", errors="ignore")))
        check(f"نسخه {v} در {rel}", ok)

    # changelog: نسخه جاری باید در ابتدای فایل (اولین رکورد) باشد
    ch = (ROOT / "تغییرات برنامه.txt").read_text(encoding="utf-8", errors="ignore")
    head = ch[:2500]
    # حذف کاراکترهای نامرئی (RLM/LRM/ZWNJ/ZWJ) قبل از تطبیق
    head_clean = re.sub(r"[\u200b-\u200f\u202a-\u202e\ufeff]", "", head)
    fa_map = {"0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴", "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹"}
    v_fa = "".join(fa_map.get(ch, ch) for ch in v)
    head_ok = re.search(re.escape(v_fa) + "|" + re.escape(v), head_clean) is not None
    m = re.search(r"نسخه[^\n]{0,40}", head_clean)
    check("رکورد نسخه جاری در ابتدای تغییرات برنامه.txt", head_ok,
          f"اولین رکورد: {(m.group(0) if m else '?').strip()}")

    # drift اسکیما
    drift = os.system("cd %s && python3 scripts/check-schema-drift.py >/dev/null 2>&1" % ROOT)
    check("schema.prisma ↔ init.sql بدون drift", drift == 0)

    # ۲) بهداشت download — هر سه فایل نسخه جاری با نام لاتین + نسخه + تاریخ ساخت
    # قانون بخش ۱۰: نام لاتین (سازگار با پنل دانلود چت) + تاریخ ساخت تا رکوردهای
    # کهنه با محتوای نسخه‌های قبلی قابل تشخیص باشند.
    import datetime
    build_date = datetime.date.today().isoformat()
    # نسخه ۱.۴٫۳: دیگر فایل پرتابل تولید نمی‌شود (درخواست کاربر) — فقط نصبی + zip سورس
    expected = {
        "installer": DL / f"PayrollSystem_v{v}_{build_date}_installer.exe",
        "source": DL / f"PayrollSystem_v{v}_{build_date}_source.zip",
    }
    for key, p in expected.items():
        check(f"فایل {key} نسخه جاری در download", p.exists(), p.name)

    # تطابق حجم با خروجی واقعی build — کشف فایل قدیمی با نام جدید (اشتباه تاریخی نسخه ۱.۴)
    dist_inst = ROOT / "desktop" / "dist" / f"PayrollSystem Setup {v}.exe"
    if dist_inst.exists() and expected["installer"].exists():
        same = dist_inst.stat().st_size == expected["installer"].stat().st_size
        check("حجم installer تحویلی = خروجی build جاری", same,
              f"dist={dist_inst.stat().st_size} vs dl={expected['installer'].stat().st_size}")
    # حذف فایل‌های نسخه‌های قبلی (خودکار — اجباری)
    removed = []
    for p in DL.iterdir():
        name = p.name
        has_current = re.search(re.escape(v), name)
        is_current_deliverable = has_current and (
            name.endswith(".exe") or name.endswith(".zip") or name.startswith("تغییرات")
        )
        if not is_current_deliverable and (
            re.search(r"PayrollSystem", name) and (name.endswith(".exe") or name.endswith(".zip"))
        ):
            p.unlink()
            removed.append(name)
    check("حذف فایل‌های نسخه‌های قبلی از download", True,
          ("حذف شد: " + ", ".join(removed)) if removed else "چیزی برای حذف نبود")

    # فایل‌های دیگر باقی‌مانده (بدون شماره نسخه — مثل theme pack) فقط گزارش می‌شوند
    others = [p.name for p in DL.iterdir() if p.name not in [e.name for e in expected.values()]]
    if others:
        print(f"INFO | فایل‌های غیرنسخه‌ای مجاز در download: {', '.join(others)}")

    # ۳) تازگی فایل‌ها — mtime بعد از dist تازه
    dist = ROOT / "desktop" / "dist"
    if all(p.exists() for p in expected.values()):
        newest_src = max(
            (ROOT / "src" / f).stat().st_mtime
            for f in ["components/app-state.tsx", "app/api/context/route.ts"]
        )
        for key, p in expected.items():
            fresh = p.stat().st_mtime >= newest_src
            check(f"فایل {key} در همین راند build تولید شده", fresh,
                  f"mtime={p.stat().st_mtime:.0f} >= src={newest_src:.0f}")

        # ۴) md5 + حجم دقیق بایت (برای گزارش تحویل — قابل مقایسه توسط کاربر)
        print("--- md5 و حجم دقیق فایل‌های تحویلی:")
        for key, p in expected.items():
            h = hashlib.md5(p.read_bytes()).hexdigest()
            size = p.stat().st_size
            print(f"  {key}: {h}  {size:,} bytes  {p.name}")

    print("=== نتیجه ===")
    if FAILED:
        print(f"RELEASE-FAIL — ارسال لینک ممنوع است. موارد ناموفق: {', '.join(FAILED)}")
        sys.exit(1)
    print("RELEASE-OK — همه چک‌ها سبز است؛ لینک‌ها قابل ارسال‌اند.")


if __name__ == "__main__":
    main()
