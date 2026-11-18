#!/usr/bin/env python3
"""ممیزی استاتیک دکمه‌ها و اکشن‌های سرتاسر برنامه (چک صفر تا صد)"""
import re, os, sys, json

SRC = '/home/z/my-project/src'
issues = []
warn = []

# ---------- 1) دکمه‌های Button بدون onClick و بدون type="submit" ----------
btn_re = re.compile(r'<Button(?P<attrs>[^>]*)>', re.S)
files = []
for root, _, fs in os.walk(os.path.join(SRC, 'components')):
    for f in fs:
        if f.endswith('.tsx'):
            files.append(os.path.join(root, f))

for path in files:
    text = open(path, encoding='utf-8').read()
    # بریدن کامنت‌ها لازم نیست؛ فقط چندخطی بودن attr ها مهم است
    for m in btn_re.finditer(text):
        attrs = m.group('attrs')
        line = text[:m.start()].count('\n') + 1
        has_onclick = 'onClick' in attrs or 'onclick' in attrs
        is_submit = 'type="submit"' in attrs or "type='submit'" in attrs
        is_aschild = 'asChild' in attrs
        # دکمه داخل DialogPrimitive.Close یا DropdownMenuTrigger (asChild) هم نیازی به onClick ندارد
        if not has_onclick and not is_submit and not is_aschild:
            snippet = attrs.replace('\n', ' ')[:90]
            issues.append(f"BTN-NO-HANDLER {os.path.relpath(path, '/home/z/my-project')}:{line} attrs={snippet}")

# ---------- 2) مقصدهای navigateTo/setFocusPersonnel در برابر registry ----------
reg_text = open(os.path.join(SRC, 'components/modules/registry.tsx'), encoding='utf-8').read()
reg_keys = set(re.findall(r"'([a-z\-]+)'\s*:", reg_text)) | set(re.findall(r'"([a-z\-]+)"\s*:', reg_text))
nav_targets = set()
for path in files:
    text = open(path, encoding='utf-8').read()
    for m in re.finditer(r"navigateTo\('([^']+)'\)", text):
        nav_targets.add(m.group(1))
for t in sorted(nav_targets):
    if t not in reg_keys:
        issues.append(f"NAV-UNKNOWN-TARGET '{t}' not in MODULE_REGISTRY keys {sorted(reg_keys)}")

# ---------- 3) endpoint های api* در برابر route.ts های موجود ----------
api_dirs = set()
for root, _, fs in os.walk(os.path.join(SRC, 'app/api')):
    if 'route.ts' in fs:
        rel = os.path.relpath(root, os.path.join(SRC, 'app/api'))
        api_dirs.add(rel)
api_call_re = re.compile(r"""api(Get|Post|Put|Delete)[<(]?[^'"\n]*['"`](/api/[^'"`?]+)""")
for root, _, fs in os.walk(SRC):
    for f in fs:
        if f.endswith(('.tsx', '.ts')) and not f.endswith('.d.ts'):
            path = os.path.join(root, f)
            text = open(path, encoding='utf-8').read()
            for m in api_call_re.finditer(text):
                ep = m.group(2).replace('/api/', '')
                ep = re.sub(r'\$\{[^}]*\}', '*', ep)
                # تطبیق با wildcard یک‌سطحی
                ok = ep in api_dirs
                if not ok:
                    parts = ep.split('/')
                    for d in api_dirs:
                        dp = d.split('/')
                        if len(dp) == len(parts) and all(pp == '*' or pp == dpp for pp, dpp in zip(parts, dp)):
                            ok = True; break
                if not ok:
                    issues.append(f"API-MISSING-ROUTE '{m.group(2)}' in {os.path.relpath(path, '/home/z/my-project')}")

# ---------- 4) window.confirm/alert خام (ناسازگار با electron) ----------
for path in files:
    text = open(path, encoding='utf-8').read()
    for m in re.finditer(r'window\.confirm\(', text):
        line = text[:m.start()].count('\n') + 1
        warn.append(f"WINDOW-CONFIRM {os.path.relpath(path, '/home/z/my-project')}:{line}")

# ---------- 5) toast.error بدون duration طولانی برای خطاهای مهم (اطلاعی) ----------
print(f"=== ISSUES: {len(issues)} ===")
for i in issues: print(' !', i)
print(f"=== WARNINGS: {len(warn)} ===")
for w in warn: print(' ~', w)
print(f"=== registry keys: {sorted(reg_keys)} ===")
