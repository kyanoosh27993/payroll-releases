#!/usr/bin/env python3
# مقایسه اسکیمای prisma با init.sql — یافتن ستون‌ها/جدول‌های جاافتاده
import re, sys

prisma = open('/home/z/my-project/prisma/schema.prisma', encoding='utf-8').read()
init = open('/home/z/my-project/prisma/init.sql', encoding='utf-8').read()

models = {}
for m in re.finditer(r'model\s+(\w+)\s*\{([^}]*)\}', prisma):
    name, body = m.group(1), m.group(2)
    cols = []
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith('//') or line.startswith('@@'):
            continue
        # فیلد: name Type @attr... (بدون رابطه)
        fm = re.match(r'(\w+)\s+(\w+[\[\]]?)', line)
        if not fm:
            continue
        fname, ftype = fm.group(1), fm.group(2)
        if ftype not in ('Int', 'String', 'Boolean', 'Float', 'DateTime', 'Int[]', 'String[]', 'Float[]'):
            continue  # فیلد رابطه است
        cols.append(fname)
    models[name] = cols

sql_tables = {}
for m in re.finditer(r'CREATE TABLE\s+"(\w+)"\s*\((.*?)\n\)', init, re.S):
    tname, body = m.group(1), m.group(2)
    cols = set(re.findall(r'^\s*"(\w+)"', body, re.M))
    sql_tables[tname] = cols

problems = []
for tname, cols in models.items():
    if tname not in sql_tables:
        problems.append(f'TABLE MISSING in init.sql: {tname}')
        continue
    for c in cols:
        if c not in sql_tables[tname]:
            problems.append(f'COLUMN MISSING in init.sql: {tname}.{c}')

if problems:
    print('DRIFT FOUND:')
    for p in problems:
        print(' -', p)
    sys.exit(1)
print('NO DRIFT — init.sql matches schema.prisma for all', len(models), 'models')
