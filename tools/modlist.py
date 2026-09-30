#!/usr/bin/env python3
"""Builds data/mods.json and img/mods/ from the pack repository.

Usage: modlist.py <path to a checkout of kronwerke/pack> <output folder>

Every mod file of the pack becomes one entry: name, a short description, a group,
which side it runs on, and links to Modrinth and CurseForge. Descriptions, groups and
icons come from the Modrinth API; mods that are only on CurseForge are looked up on
Modrinth by name, and keep their CurseForge link either way. Icons are downloaded and
scaled down, so the page loads nothing from other hosts.
"""
import io
import json
import pathlib
import re
import sys
import tomllib
import urllib.parse
import urllib.request

from PIL import Image

API = "https://api.modrinth.com/v2"
UA = "kronwerke-website/modlist (github.com/kronwerke/website)"

# Modrinth categories to the groups on the page, first match wins
GROUPS = [
    ("magic", "magic"), ("technology", "tech"), ("storage", "tech"), ("transportation", "tech"),
    ("adventure", "world"), ("worldgen", "world"), ("mobs", "world"),
    ("equipment", "gear"), ("food", "food"), ("decoration", "build"),
    ("optimization", "performance"), ("library", "library"),
    ("utility", "comfort"), ("management", "comfort"), ("social", "comfort"),
    ("game-mechanics", "comfort"),
]
# projects whose Modrinth categories put them in the wrong group
OVERRIDE = {
    "kronwerke-core": "tech", "botania": "magic", "jei": "comfort", "jade": "comfort",
}
# mods Modrinth does not know: (group, description)
KNOWN = {
    "Ars Elemental": ("magic", "Elemental schools, foci and armour for Ars Nouveau."),
    "Ars Technica": ("magic", "Ars Nouveau meets Create: arcane machinery and automation."),
    "Botania": ("magic", "Natural magic: flowers that make mana and flowers that use it."),
    "Brandon's Core": ("library", "Library for Draconic Evolution."),
    "Building Gadgets": ("build", "Gadgets that place, copy and remove many blocks at once."),
    "CodeChicken Lib": ("library", "Library for several mods."),
    "Compact Machines": ("tech", "Whole rooms inside a single block, for factories in a small space."),
    "Cupboard": ("library", "Shared code and fixes for several mods."),
    "FTB Backups 3": ("comfort", "Automatic backups of the world."),
    "FTB Chunks": ("comfort", "Map, claimed chunks and chunk loading."),
    "FTB Library": ("library", "Library for the FTB mods."),
    "FTB Quests": ("comfort", "The quest book."),
    "FTB Teams": ("comfort", "Teams for claims and quests."),
    "FTB Ultimine": ("comfort", "Mine a whole vein or tree at once."),
    "FTB XMod Compat": ("library", "Connects the FTB mods with other mods."),
    "Just Dire Things": ("tech", "Tools and machines made from Ferricore, Blazegold and Celestigem."),
    "Kronwerke Core": ("tech", "The server mod of Kronwerke: whitelist slots, community goals, the obelisk and the stages."),
    "LaserIO": ("tech", "Moves items, fluids and energy between blocks with laser nodes."),
    "Mining Gadgets": ("tech", "Laser mining tools with upgrades."),
    "Productive Metalworks": ("tech", "A foundry for melting and casting metals."),
}


# emoji and pictographs, variation selectors, and the long dashes some pages use
NOISE = re.compile("[\U0001F000-\U0001FFFF\u2600-\u27BF\u2B00-\u2BFF\uFE0E\uFE0F\u200D]")
DASH = re.compile("\\s*[\u2013\u2014]\\s*")


def tidy(text):
    """Plain text as the page shows it: no emoji, commas for long dashes, one space."""
    text = DASH.sub(", ", NOISE.sub("", text))
    text = re.sub(r"\s+('s\b)", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def clean(name):
    return re.sub(r"\s*(\(NeoForge\)|1\.8\.\+)$", "", tidy(name)).strip()


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def group(categories):
    for cat, g in GROUPS:
        if cat in categories:
            return g
    return "comfort"


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main(pack, out):
    pack, out = pathlib.Path(pack), pathlib.Path(out)
    icons = out / "img" / "mods"
    icons.mkdir(parents=True, exist_ok=True)
    (out / "data").mkdir(parents=True, exist_ok=True)

    mods = []
    for f in sorted((pack / "mods").glob("*.pw.toml")):
        d = tomllib.loads(f.read_text())
        u = d.get("update", {})
        m = {"key": f.name.removesuffix(".pw.toml"), "name": d["name"], "side": d.get("side", "both")}
        if "modrinth" in u:
            m["modrinth"] = u["modrinth"]["mod-id"]
        if "curseforge" in u:
            m["curseforge"] = u["curseforge"]["project-id"]
        if "modrinth" not in m and "curseforge" not in m:
            url = d["download"]["url"]
            m["source"] = "/".join(url.split("/")[:5])  # https://github.com/owner/repo
        mods.append(m)

    # Modrinth details in batches
    ids = [m["modrinth"] for m in mods if "modrinth" in m]
    info = {}
    for i in range(0, len(ids), 80):
        q = urllib.parse.quote(json.dumps(ids[i:i + 80]))
        for p in json.loads(get(f"{API}/projects?ids={q}")):
            info[p["id"]] = p
    # CurseForge-only mods: try Modrinth by name for a description and an icon
    for m in mods:
        if "modrinth" in m or "curseforge" not in m:
            continue
        q = urllib.parse.quote(m["name"])
        facets = urllib.parse.quote('[["project_type:mod"],["categories:neoforge"]]')
        hits = json.loads(get(f"{API}/search?query={q}&facets={facets}&limit=3")).get("hits", [])
        for h in hits:
            if slug(h["title"]) == slug(m["name"]):
                p = json.loads(get(f"{API}/project/{h['project_id']}"))
                info[p["id"]] = p
                m["lookup"] = p["id"]
                break

    out_mods = []
    for m in mods:
        p = info.get(m.get("modrinth") or m.get("lookup"))
        e = {"name": clean(m["name"]), "side": m["side"]}
        if p:
            e["name"] = clean(p["title"])
            e["text"] = tidy(p["description"])
            e["group"] = OVERRIDE.get(m["key"], group(p.get("categories", []) + p.get("additional_categories", [])))
            if "modrinth" in m:
                e["modrinth"] = "https://modrinth.com/mod/" + p["slug"]
            if p.get("icon_url"):
                try:
                    img = Image.open(io.BytesIO(get(p["icon_url"]))).convert("RGBA")
                    img.thumbnail((64, 64), Image.LANCZOS)
                    name = m["key"] + ".webp"
                    img.save(icons / name, "WEBP", quality=85)
                    e["icon"] = "img/mods/" + name
                except Exception as err:  # an icon is nice to have, not worth failing for
                    print(f"icon of {m['key']}: {err}", file=sys.stderr)
        elif e["name"] in KNOWN:
            e["group"], e["text"] = KNOWN[e["name"]]
        else:
            e["group"] = OVERRIDE.get(m["key"], "comfort")
            print(f"no description for {e['name']}", file=sys.stderr)
        if "curseforge" in m:
            e["curseforge"] = f"https://www.curseforge.com/projects/{m['curseforge']}"
        if "source" in m:
            e["source"] = m["source"]
        out_mods.append(e)

    out_mods.sort(key=lambda e: e["name"].lower())
    (out / "data" / "mods.json").write_text(json.dumps(out_mods, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(out_mods)} mods, {sum(1 for e in out_mods if 'icon' in e)} icons")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
