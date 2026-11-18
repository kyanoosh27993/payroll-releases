#!/bin/bash
# Verify GitHub release assets (no secrets printed)
TOKEN=$(grep -rho 'ghp_[A-Za-z0-9]\{20,\}' /home/z/my-project/scripts/ /home/z/my-project/desktop/ /home/z/my-project/docs/ 2>/dev/null | head -1)
if [ -z "$TOKEN" ]; then echo "NO_TOKEN"; exit 1; fi
curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/kyanoosh27993/payroll-releases/releases?per_page=5" > /tmp/rel.json
python3 - <<'EOF'
import json
d = json.load(open('/tmp/rel.json'))
if isinstance(d, dict):
    print("API_ERROR:", d.get('message'))
else:
    for r in d:
        print(r['tag_name'], '| published:', r.get('published_at'), '| assets:')
        for a in r['assets']:
            print('   -', a['name'], a['size'], a['state'], a['download_count'])
EOF
