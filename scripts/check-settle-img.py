import re, base64, io
from PIL import Image
h = open('/tmp/settle.html').read()
m = re.search(r'<img src="data:image/jpeg;base64,([^"]+)"', h)
print('img found:', bool(m), 'len', len(m.group(1)) if m else 0)
if m:
    im = Image.open(io.BytesIO(base64.b64decode(m.group(1))))
    print('decoded OK:', im.size, im.mode)
