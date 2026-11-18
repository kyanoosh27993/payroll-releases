#!/usr/bin/env python3
"""ساخت آیکون برنامه — مربع گرد با گرادیان سرمه‌ای و نمودار ستونی طلایی"""
from PIL import Image, ImageDraw
import math

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# پس‌زمینه: مربع گرد با گرادیان عمودی سرمه‌ای
grad = Image.new("RGBA", (S, S))
gd = ImageDraw.Draw(grad)
top = (23, 37, 63)      # #17253f
bot = (41, 60, 94)      # #293c5e
for y in range(S):
    t = y / S
    c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
    gd.line([(0, y), (S, y)], fill=c)
mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=255)
img.paste(grad, (0, 0), mask)

# حلقه نازک طلایی داخلی (حاشیه ظریف)
gold = (212, 175, 55, 255)
d.rounded_rectangle([26, 26, S - 27, S - 27], radius=210, outline=(255, 214, 102, 90), width=10)

# نمودار ستونی (نماد گزارش حقوق)
base_y = 730
cx = S // 2
bars = [(300, 250, 150), (460, 420, 150), (620, 300, 150)]
colors = [(125, 211, 252, 255), (255, 214, 102, 255), (134, 239, 172, 255)]
for (x0, h, w), c in zip(bars, colors):
    d.rounded_rectangle([x0, base_y - h, x0 + w, base_y], radius=28, fill=c)

# خط روند صعودی با نقطه
pts = [(280, 500), (450, 330), (560, 400), (740, 200)]
d.line(pts, fill=(255, 255, 255, 235), width=26, joint="curve")
for i, p in enumerate(pts):
    r = 34 if i == len(pts) - 1 else 22
    d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r],
              fill=(255, 255, 255, 255) if i == len(pts) - 1 else gold)

img.save("/home/z/my-project/desktop/icon.png")
print("icon saved:", img.size)
