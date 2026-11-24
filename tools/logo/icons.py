#!/usr/bin/env python3
"""Square icons from the logos: icons.py OUTDIR
crown.png (cut by crown.py) on the site's night colour, the clock tower, and the whole logo."""
import sys
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1] if len(sys.argv) > 1 else "out"
NIGHT = (16, 14, 24, 255)
logo = Image.open("src/logo.png").convert("RGBA")
crown = Image.open("out/crown.png").convert("RGBA")

def night(n):
    """the square the icons stand on: night sky, a little lighter in the middle"""
    im = Image.new("RGBA", (n, n), NIGHT)
    glow = Image.new("L", (n, n), 0)
    ImageDraw.Draw(glow).ellipse([n * 0.12, n * 0.18, n * 0.88, n * 0.94], fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.16))
    im.paste(Image.new("RGBA", (n, n), (58, 84, 150, 255)), (0, 0), glow.point(lambda v: v * 0.55))
    return im

def crown_icon(n, share=0.74):
    im = night(n)
    c = crown.copy()
    w = int(n * share); h = round(c.height * w / c.width)
    c = c.resize((w, h), Image.LANCZOS)
    im.alpha_composite(c, ((n - w) // 2, (n - h) // 2 - int(n * 0.01)))
    return im

def tower_icon(n):
    box = (880, 40, 1620, 780)
    im = night(740)
    im.alpha_composite(logo.crop(box))
    return im.resize((n, n), Image.LANCZOS)

def full_icon(n):
    im = night(n)
    w = int(n * 0.94); h = round(logo.height * w / logo.width)
    im.alpha_composite(logo.resize((w, h), Image.LANCZOS), ((n - w) // 2, (n - h) // 2))
    return im

if __name__ == "__main__":
    for name, f in (("crown", crown_icon), ("tower", tower_icon), ("full", full_icon)):
        f(1024).save(f"{out}/icon_{name}.png")
    # a sheet: each as Discord shows it (round), big and small
    sheet = Image.new("RGBA", (3 * 300 + 40, 420), (49, 51, 56, 255))
    d = ImageDraw.Draw(sheet)
    for i, name in enumerate(("crown", "tower", "full")):
        ic = Image.open(f"{out}/icon_{name}.png")
        for size, y in ((240, 20), (96, 290)):
            s = ic.resize((size, size), Image.LANCZOS)
            m = Image.new("L", (size * 4, size * 4), 0); ImageDraw.Draw(m).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
            sheet.paste(s, (40 + i * 300 + (240 - size) // 2, y), m.resize((size, size), Image.LANCZOS))
        d.text((40 + i * 300 + 100, 400), "ABC"[i], fill=(255, 255, 255, 255))
    sheet.convert("RGB").save(f"{out}/icon_sheet.png")
