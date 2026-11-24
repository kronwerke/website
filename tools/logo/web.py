#!/usr/bin/env python3
"""The logo files of the website: web.py /path/to/website
img/brand/logo-480.webp, logo-720.webp, logo-1080.webp, logo-1600.webp (the whole logo), wordmark.webp, wordmark-2x.webp (the lettering),
favicon.png (64), apple-touch-icon.png (180), img/brand/icon-512.png."""
import sys, os
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import icons
site = sys.argv[1]
os.makedirs(f"{site}/img/brand", exist_ok=True)
logo = Image.open("src/logo.png").convert("RGBA")
logo = logo.crop(logo.getchannel("A").getbbox())
text = Image.open("src/text.png").convert("RGBA")
text = text.crop(text.getchannel("A").getbbox())
def fit(im, w):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
for w in (480, 720, 1080, 1600):
    fit(logo, w).save(f"{site}/img/brand/logo-{w}.webp", quality=80, method=6)
for name, w in (("wordmark", 240), ("wordmark-2x", 480)):
    fit(text, w).save(f"{site}/img/brand/{name}.webp", quality=90, method=6)
def rounded(im, r):
    n = im.width
    m = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, n * 4 - 1, n * 4 - 1], radius=r * 4, fill=255)
    out = im.copy(); out.putalpha(m.resize((n, n), Image.LANCZOS)); return out
big = icons.crown_icon(1024, share=0.8)
rounded(big.resize((64, 64), Image.LANCZOS), 14).save(f"{site}/favicon.png", optimize=True)
big.resize((180, 180), Image.LANCZOS).convert("RGB").save(f"{site}/apple-touch-icon.png", optimize=True)
rounded(big.resize((512, 512), Image.LANCZOS), 112).save(f"{site}/img/brand/icon-512.png", optimize=True)
for f in ("img/brand/logo-480.webp", "img/brand/logo-720.webp", "img/brand/logo-1080.webp", "img/brand/logo-1600.webp", "img/brand/wordmark.webp", "img/brand/wordmark-2x.webp", "favicon.png", "apple-touch-icon.png", "img/brand/icon-512.png"):
    im = Image.open(f"{site}/{f}"); print(f, im.size, os.path.getsize(f"{site}/{f}") // 1024, "KB")
