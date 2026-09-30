#!/usr/bin/env python3
"""Builds js/modstages.js: in which stage every mod gets something new, counted in items.

Usage: modstages.py <checkout of kronwerke/pack> <folder with the mod jars> [output]

The pack's stage files (kubejs/data/kronwerke/chapters/stages/stage*.json) list the items
of stages 2 to 5; everything else in tools/stages/items.txt is stage 1. The jars give the
display name of every mod id, so the page can match the entries to data/mods.json by name.
"""
import json
import pathlib
import re
import sys
import zipfile
from collections import Counter, defaultdict

# display names whose normalised form differs from the name Modrinth uses in mods.json
ALIAS = {
    "advancedae": "advancedae", "ae2wtlib": "appliedenergistics2wirelessterminals", "appliedflux": "appliedflux",
    "buildinggadgets2": "buildinggadgets", "forbiddenarcanus": "forbiddenandarcanus", "megacells": "mega",
    "createpowergrid": "powergrid", "eidolonrepraised": "eidolon", "theundergarden": "undergarden",
    "reliquaryreincarnations": "reliquary", "nuclearcraftneoteric": "nuclearcraft",
}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\d+\.\d+(\.\d+)?", "", s.lower()))


def main(pack, jars, out):
    pack = pathlib.Path(pack)
    stage_of = {}
    for n in (2, 3, 4, 5):
        for it in json.loads((pack / f"kubejs/data/kronwerke/chapters/stages/stage{n}.json").read_text())["items"]:
            stage_of[it] = max(stage_of.get(it, 1), n)
    items = [l.strip() for l in (pack / "tools/stages/items.txt").read_text().splitlines() if l.strip()]
    by_ns = defaultdict(Counter)
    for it in items:
        by_ns[it.split(":")[0]][stage_of.get(it, 1)] += 1

    names = {}
    for jar in pathlib.Path(jars).glob("*.jar"):
        try:
            z = zipfile.ZipFile(jar)
        except zipfile.BadZipFile:
            continue
        for cand in ("META-INF/neoforge.mods.toml", "META-INF/mods.toml"):
            if cand not in z.namelist():
                continue
            text = z.read(cand).decode("utf-8", "replace")
            for m in re.finditer(r"\[\[mods\]\](.*?)(?=\[\[|\Z)", text, re.S):
                block = m.group(1)
                mid = re.search(r'modId\s*=\s*"([^"]+)"', block)
                dn = re.search(r'displayName\s*=\s*"([^"]+)"', block)
                if mid:
                    names[mid.group(1)] = dn.group(1) if dn else mid.group(1)
            break

    data = {}
    for ns, counts in sorted(by_ns.items()):
        if ns == "minecraft":
            continue
        name = names.get(ns, ns).replace(" 1.21.1", "")
        key = norm(name)
        key = ALIAS.get(key, key)
        data[key] = {"name": name, "by": {int(k): v for k, v in sorted(counts.items())}}

    js = (
        "// In which stage every mod gets something new, counted in items. Built by\n"
        "// tools/modstages.py from the pack's stage files; the key is the mod name without spaces,\n"
        "// version numbers or punctuation, so it matches data/mods.json by name.\n\n"
        "window.KW = window.KW || {};\n"
        "window.KW.modstages = " + json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + ";\n"
        'window.KW.stageKey = function (name) { return name.toLowerCase().replace(/\\d+\\.\\d+(\\.\\d+)?/g, "").replace(/[^a-z0-9]/g, ""); };\n'
        'window.KW.stageNames = { 1: "Steinwerk", 2: "Messingwerk", 3: "Stahlwerk", 4: "Sternwerk", 5: "Chaoswerk" };\n'
    )
    pathlib.Path(out).write_text(js)
    print(len(data), "mods,", sum(1 for v in data.values() if max(v["by"]) > 1), "with something in a later stage")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "js/modstages.js")
