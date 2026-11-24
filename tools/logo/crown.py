#!/usr/bin/env python3
"""Cuts the ice crown out of the full logo, for square uses (favicon, server icon).
The crown stands behind the K, a leaf and a tree: a hand-set outline keeps the area,
and inside it everything orange (the K) or green (leaf, tree) goes."""
import colorsys, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

src, out = sys.argv[1], sys.argv[2]
X0, Y0, X1, Y1 = 150, 430, 620, 820
im = Image.open(src).convert("RGBA").crop((X0, Y0, X1, Y1))
w, h = im.size
# the outline, a little outside the crown; the bottom edge runs along the top of the K
poly = [(12, 96), (175, 28), (205, 28), (425, 80), (402, 150), (386, 205), (381, 240), (363, 295), (350, 333),
        (250, 323), (150, 312), (64, 303), (48, 270), (30, 200)]
mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(mask).polygon(poly, fill=255)
a = np.asarray(im).astype(np.float32) / 255
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
hue = np.zeros_like(mx)
d = np.maximum(mx - mn, 1e-6)
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
warm = (sat > 0.25) & ((hue < 75) | (hue > 330))       # the K: yellow, orange, brown
green = (sat > 0.22) & (hue >= 75) & (hue < 170)        # leaf and tree
keep = (np.asarray(mask) > 0) & ~warm & ~green & (al > 0.05)
k = Image.fromarray((keep * 255).astype(np.uint8))
# close pinholes, drop specks, soften the edge by a pixel
k = k.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(3))
from PIL import ImageChops
k = ImageChops.multiply(k.filter(ImageFilter.GaussianBlur(0.8)), im.getchannel("A"))
res = im.copy(); res.putalpha(k)
bb = k.point(lambda v: 255 if v > 20 else 0).getbbox()
res.crop(bb).save(out)
print("crown", res.crop(bb).size)
