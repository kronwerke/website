#!/bin/sh
# questbook.sh [PACK] [MODS] [GAME_JAR] [CORE_JAR]: rebuilds qb/, the data of questbuch.html.
# Runs pack/tools/quests/web.py and icons.py against the mod jars of a full server (CI has no
# jars, so qb/ is built here and committed), copies the quest shapes and the book background,
# and writes qb/search.json for the search. The item icons are the game's own renders where
# tools/icons-ingame has one.
set -e
cd "$(dirname "$0")/.."
PACK=${1:-/home/claude/kw/pack}
MODS=${2:-/home/claude/kw/srv/mods}
GAME=${3:-/home/claude/kw/mcclient/versions/1.21.1/1.21.1.jar}
CORE=${4:-$(ls /home/claude/kw/core/build/libs/kronwerke-*.jar 2>/dev/null | grep -v sources | sort -V | tail -1)}
python3 "$PACK/tools/quests/web.py" qb "$MODS" "$GAME" $CORE
python3 "$PACK/tools/quests/icons.py" qb/items.json qb/icons "$MODS" "$GAME" $CORE 2>/dev/null
rm -f qb/icons/missing.txt
# The icons the game itself draws win over the ones icons.py works out from the models:
# tools/icons-ingame holds every item as it looks in an inventory, 64 px, rendered by the test
# client (pack tools/iconclient notes in Core's IconExport: probe line "icons LIST 64"). An item
# that came into the book after the last render keeps its icons.py picture until the next one.
cp -r tools/icons-ingame/. qb/icons/
# A picture in a quest text that names an item texture the mod does not have (the item is a
# 3D model, or its texture has another name) gets the item's icon instead of a hole.
python3 - <<'PY'
import glob, json, os, re, shutil
for f in glob.glob("qb/chapters/*.json"):
    for ns, name in set(re.findall(r"\{image:([a-z0-9_.-]+):textures/item/([a-z0-9_./-]+)\.png", open(f, encoding="utf-8").read())):
        tex, icon = f"qb/tex/{ns}/item/{name}.webp", f"qb/icons/{ns}/{name}.webp"
        if not os.path.exists(tex) and os.path.exists(icon):
            os.makedirs(os.path.dirname(tex), exist_ok=True)
            shutil.copy(icon, tex)
            print("picture from icon:", ns + ":" + name)
PY
mkdir -p qb/shapes
# The quest shapes as masks for the page: the fill from the game's texture, set in from the
# edge so no side is cut off when the browser rounds, and one even ring as the outline.
python3 - "$PACK" <<'PY'
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
S, PAD, RING = 256, 8, 11
for shape in ("circle", "hexagon", "gear", "diamond", "square", "rsquare"):
    a = Image.open(f"{sys.argv[1]}/kubejs/assets/ftbquests/textures/shapes/{shape}/background.png").convert("RGBA").getchannel("A")
    a = a.resize((S - 2 * PAD, S - 2 * PAD), Image.LANCZOS).point(lambda v: 255 if v > 127 else 0)
    full = Image.new("L", (S, S), 0)
    full.paste(a, (PAD, PAD))
    solid = np.array(full) > 127
    depth = ndimage.distance_transform_edt(solid)  # how far inside the shape a pixel lies
    ring = Image.fromarray((solid & (depth <= RING)).astype("uint8") * 255)
    for name, m in (("background", full), ("outline", ring)):
        m = m.filter(ImageFilter.GaussianBlur(0.8))
        out = Image.new("RGBA", (S, S), (255, 255, 255, 0))
        out.putalpha(m)
        out.save(f"qb/shapes/{shape}-{name}.webp", lossless=True)
PY
python3 -c "from PIL import Image; Image.open('$PACK/kubejs/assets/kronwerke/textures/gui/quests/background.png').save('qb/background.webp', lossless=True)"
python3 - <<'PY'
import json, os
book = json.load(open("qb/book.json"))
out = []
for c in book["chapters"]:
    ch = json.load(open(f"qb/chapters/{c['name']}.json"))
    for q in ch["quests"]:
        items = sorted({t["item"]["id"] if isinstance(t.get("item"), dict) else t.get("item")
                        for t in q.get("tasks", []) if t.get("type") == "item"} - {None})
        out.append([c["name"], q["name"], q["title"]["de"], q["title"]["en"], items, q["id"]])
json.dump(out, open("qb/search.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "quests in qb/search.json;", sum(len(f) for _, _, f in os.walk("qb")), "files in qb/")
PY
