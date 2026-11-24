#!/usr/bin/env python3
"""The logo files the game takes: game.py /path/to/core
server_icon.png: the crown, 64 by 64 on nothing, for the server list.
wordmark.png, wordmark_small.png: the lettering, for the server list entry, the join screen and
the header of Core's windows. They are drawn smaller than they are, with smoothing (.mcmeta blur)."""
import sys, os
from PIL import Image, ImageFilter
os.chdir(os.path.dirname(os.path.abspath(__file__)))
core = sys.argv[1]
crown = Image.open("out/crown.png").convert("RGBA")
def server_icon(n=64):
    big = Image.new("RGBA", (n * 8, n * 8), (0, 0, 0, 0))
    w = int(n * 8 * 0.94); h = round(crown.height * w / crown.width)
    c = crown.resize((w, h), Image.LANCZOS)
    pos = ((n * 8 - w) // 2, (n * 8 - h) // 2)
    # a soft dark edge, so the ice stands out on any list background
    sh = Image.new("RGBA", big.size, (0, 0, 0, 0))
    sh.paste((6, 10, 30, 255), pos, c.getchannel("A"))
    sh = sh.filter(ImageFilter.GaussianBlur(n * 0.14))
    big.alpha_composite(sh); big.alpha_composite(sh)
    big.alpha_composite(c, pos)
    return big.resize((n, n), Image.LANCZOS)
def bleed(im, rounds=6):
    """Colour under the transparent pixels next to the edge: smoothing mixes neighbours, and
    black under nothing would draw a dark rim."""
    import numpy as np
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3].copy(), a[..., 3]
    known = al > 8
    for _ in range(rounds):
        acc = np.zeros_like(rgb); cnt = np.zeros(al.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * k[..., None]; cnt += k
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        known = known | new
    out = np.dstack([rgb, al]).clip(0, 255).astype("uint8")
    return Image.fromarray(out, "RGBA")
def wordmark(w):
    t = Image.open("src/text.png").convert("RGBA")
    t = t.crop(t.getchannel("A").getbbox())
    t = t.resize((w, round(t.height * w / t.width)), Image.LANCZOS)
    pad = Image.new("RGBA", (t.width + 4, t.height + 4), (0, 0, 0, 0))   # a clear rim, so smoothing never wraps
    pad.alpha_composite(t, (2, 2))
    return bleed(pad)
out = f"{core}/src/main/resources/assets/kronwerke/textures/gui/brand"
os.makedirs(out, exist_ok=True)
server_icon().save(f"{out}/server_icon.png", optimize=True)
print(os.path.getsize(f"{out}/server_icon.png"), "bytes")
for name, w in (("wordmark", 660), ("wordmark_small", 330)):
    im = wordmark(w)
    im.save(f"{out}/{name}.png", optimize=True)
    open(f"{out}/{name}.png.mcmeta", "w").write('{"texture": {"blur": true, "clamp": true}}\n')
    print(name, im.size, os.path.getsize(f"{out}/{name}.png") // 1024, "KB")
