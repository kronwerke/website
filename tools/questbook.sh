#!/bin/sh
# questbook.sh [PACK] [MODS] [GAME_JAR] [CORE_JAR]: rebuilds qb/, the data of questbuch.html.
# Runs pack/tools/quests/web.py and icons.py against the mod jars of a full server (CI has no
# jars, so qb/ is built here and committed), copies the quest shapes and the book background,
# and writes qb/search.json for the search.
set -e
cd "$(dirname "$0")/.."
PACK=${1:-/home/claude/kw/pack}
MODS=${2:-/home/claude/kw/srv/mods}
GAME=${3:-/home/claude/kw/mcclient/versions/1.21.1/1.21.1.jar}
CORE=${4:-$(ls /home/claude/kw/core/build/libs/kronwerke-*.jar 2>/dev/null | grep -v sources | sort -V | tail -1)}
python3 "$PACK/tools/quests/web.py" qb "$MODS" "$GAME" $CORE
python3 "$PACK/tools/quests/icons.py" qb/items.json qb/icons "$MODS" "$GAME" $CORE 2>/dev/null
rm -f qb/icons/missing.txt
mkdir -p qb/shapes
for s in circle hexagon gear diamond square rsquare; do
  for k in background outline; do
    python3 -c "from PIL import Image; Image.open('$PACK/kubejs/assets/ftbquests/textures/shapes/$s/$k.png').save('qb/shapes/$s-$k.webp', lossless=True)"
  done
done
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
