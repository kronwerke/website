#!/usr/bin/env python3
"""art.py RENDERS: the mobs and blocks of the pages, from the game's own renders.

RENDERS is the folder the test client wrote (Core's probe lines "icons LIST 256 DIR" and
"entities LIST 720 DIR", see IconExport and EntityExport in Core): big/, fail256/ and more256/
hold every item as the inventory draws it, ents/ and ents2/ the mobs. Both come with true
transparency, so nothing here needs cutting out by hand. This script crops each picture to
what is drawn and writes

  img/mobs/<name>.webp      every mob that came out whole
  img/blocks/<name>.webp    the blocks and items the pages use, by a short name
  img/origins/<name>.png    the icons of the origins and roles, the items the game shows for them
  img/art.json              width and height of every picture, for the pages' <img> tags
"""
import glob
import json
import os
import sys

from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/kw/renders"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

# mobs that did not fit their cell or came out wrong
SKIP_MOBS = {"ghast", "leviathan", "shulker", "luminofish", "ender_dragon", "lunar_monstrosity", "aerwhale", "phantom"}

BLOCKS = {
    # stage 1
    "water_wheel": "create:water_wheel", "millstone": "create:millstone", "cogwheel": "create:cogwheel",
    "large_cogwheel": "create:large_cogwheel", "mechanical_press": "create:mechanical_press",
    "andesite_casing": "create:andesite_casing", "mechanical_mixer": "create:mechanical_mixer", "basin": "create:basin",
    "source_jar": "ars_nouveau:source_jar", "mana_pool": "botania:mana_pool", "nature_altar": "naturesaura:nature_altar",
    "cobblestone": "minecraft:cobblestone", "andesite_alloy": "create:andesite_alloy", "source_gem": "ars_nouveau:source_gem",
    "waystone": "waystones:waystone", "drawer": "functionalstorage:oak_1", "depot": "create:depot",
    # stage 2
    "brass_casing": "create:brass_casing", "blaze_burner": "create:blaze_burner", "mechanical_crafter": "create:mechanical_crafter",
    "brass_ingot": "create:brass_ingot", "obsidian": "minecraft:obsidian", "netherrack": "minecraft:netherrack",
    "runic_altar": "botania:runic_altar", "mana_spreader": "botania:mana_spreader", "metallurgic_infuser": "mekanism:metallurgic_infuser",
    "precision_mechanism": "create:precision_mechanism", "steam_engine": "create:steam_engine", "glowstone": "minecraft:glowstone",
    "deployer": "create:deployer", "mechanical_arm": "create:mechanical_arm", "cuckoo_clock": "create:cuckoo_clock",
    "fluid_tank": "create:fluid_tank",
    # stage 3
    "steel_casing": "mekanism:steel_casing", "steel_ingot": "mekanism:ingot_steel", "steel_block": "mekanism:block_steel",
    "me_controller": "ae2:controller", "me_drive": "ae2:drive", "terrasteel_ingot": "botania:terrasteel_ingot",
    "digital_miner": "mekanism:digital_miner", "fluix_crystal": "ae2:fluix_crystal", "metal_press": "immersiveengineering:metal_press",
    "crafting_unit": "ae2:crafting_unit", "rs_controller": "refinedstorage:controller", "energy_tablet": "mekanism:energy_tablet",
    "certus_crystal": "ae2:certus_quartz_crystal", "enrichment_chamber": "mekanism:enrichment_chamber", "quantum_ring": "ae2:quantum_ring",
    # stage 4
    "end_stone": "minecraft:end_stone", "dragon_egg": "minecraft:dragon_egg", "draconium_ingot": "draconicevolution:draconium_ingot",
    "draconium_block": "draconicevolution:draconium_block", "gaia_ingot": "botania:gaia_ingot", "gaia_pylon": "botania:gaia_pylon",
    "chorus_flower": "minecraft:chorus_flower", "elite_circuit": "mekanism:elite_control_circuit", "elytra": "minecraft:elytra",
    "shulker_box": "minecraft:purple_shulker_box", "dragon_head": "minecraft:dragon_head", "ender_eye": "minecraft:ender_eye",
    "wyvern_core": "draconicevolution:wyvern_core", "ender_chest": "minecraft:ender_chest", "end_rod": "minecraft:end_rod",
    # stage 5
    "awakened_block": "draconicevolution:awakened_draconium_block", "antimatter_pellet": "mekanism:pellet_antimatter",
    "reactor_core": "draconicevolution:reactor_core", "sps_casing": "mekanism:sps_casing", "chaotic_core": "draconicevolution:chaotic_core",
    "nether_star": "minecraft:nether_star", "beacon": "minecraft:beacon", "awakened_core": "draconicevolution:awakened_core",
    "energy_core": "draconicevolution:draconic_energy_core", "wither_skull": "minecraft:wither_skeleton_skull",
    "fusion_controller": "mekanismgenerators:fusion_reactor_controller", "respawn_anchor": "minecraft:respawn_anchor",
    "crying_obsidian": "minecraft:crying_obsidian",
    # everyday things
    "bell": "minecraft:bell", "cake": "minecraft:cake", "firework_rocket": "minecraft:firework_rocket", "jukebox": "minecraft:jukebox",
    "note_block": "minecraft:note_block", "lectern": "minecraft:lectern", "bookshelf": "minecraft:bookshelf", "chest": "minecraft:chest",
    "lantern": "minecraft:lantern", "campfire": "minecraft:campfire", "grass_block": "minecraft:grass_block",
    "crafting_table": "minecraft:crafting_table", "writable_book": "minecraft:writable_book", "filled_map": "minecraft:filled_map",
    "compass": "minecraft:compass", "spyglass": "minecraft:spyglass", "name_tag": "minecraft:name_tag", "emerald": "minecraft:emerald",
    "redstone_lamp": "minecraft:redstone_lamp", "observer": "minecraft:observer", "hopper": "minecraft:hopper", "torch": "minecraft:torch",
    "oak_sign": "minecraft:oak_sign", "anvil": "minecraft:anvil", "enchanting_table": "minecraft:enchanting_table",
    "barrel": "minecraft:barrel", "hay_block": "minecraft:hay_block", "poppy": "minecraft:poppy", "oak_sapling": "minecraft:oak_sapling",
    "amethyst_cluster": "minecraft:amethyst_cluster", "diamond": "minecraft:diamond", "golden_apple": "minecraft:golden_apple",
    "totem": "minecraft:totem_of_undying", "wrench": "create:wrench", "goggles": "create:goggles",
    "spell_book": "ars_nouveau:novice_spell_book", "cooking_pot": "farmersdelight:cooking_pot", "shield": "minecraft:shield",
    "backpack": "sophisticatedbackpacks:backpack", "player_head": "minecraft:player_head", "ender_pearl": "minecraft:ender_pearl",
    "iron_pickaxe": "minecraft:iron_pickaxe", "furnace": "minecraft:furnace", "tnt": "minecraft:tnt", "clock": "minecraft:clock",
    "experience_bottle": "minecraft:experience_bottle", "enchanted_book": "minecraft:enchanted_book", "painting": "minecraft:painting",
    "red_bed": "minecraft:red_bed", "oak_boat": "minecraft:oak_boat", "minecart": "minecraft:minecart",
    "stone_gearbox": "kronwerke:stone_gearbox",
}

# the icons the game shows for the origins and roles (pack: kubejs/data/kronwerke/origins/origins)
ORIGINS = {
    # chaosgezeichnete keeps its drawn icon: the game shows the chaos shard through a shader
    # that comes out as a black shape in a render
    "aurakind": "naturesaura:nature_altar", "kronbuerger": "waystones:waystone",
    "messingblut": "create:brass_ingot", "muehlenkind": "create:water_wheel", "quellgeborene": "ars_nouveau:source_gem",
    "arkanist": "ars_nouveau:novice_spell_book", "baumeister": "create:andesite_casing", "entdecker": "naturescompass:naturescompass",
    "haendler": "bountiful:bountyboard", "hueter": "minecraft:shield", "ingenieur": "create:wrench",
    "versorger": "farmersdelight:cooking_pot", "runentraeger": "botania:rune_of_earth",
    "sternensplitter": "eternal_starlight:blue_starlight_crystal_shard", "tiefgraeber": "kronwerke:grubenrahmen",
}


def item(iid):
    ns, path = iid.split(":")
    for d in ("fail256", "more256", "big"):
        f = os.path.join(SRC, d, ns, path + ".png")
        if os.path.exists(f):
            im = Image.open(f).convert("RGBA")
            if im.getbbox():
                return im.crop(im.getbbox())
    return None


def main():
    art = {"mobs": {}, "blocks": {}}
    os.makedirs(os.path.join(ROOT, "img", "mobs"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "img", "blocks"), exist_ok=True)
    for d in ("ents", "ents2"):
        for f in sorted(glob.glob(os.path.join(SRC, d, "*.png"))):
            name = os.path.basename(f)[:-4]
            if name in SKIP_MOBS:
                continue
            im = Image.open(f).convert("RGBA")
            im = im.crop(im.getbbox())
            im.save(os.path.join(ROOT, "img", "mobs", name + ".webp"), lossless=True, method=6)
            art["mobs"][name] = [im.width, im.height]
    for name, iid in sorted(BLOCKS.items()):
        im = item(iid)
        if im is None:
            print("no render:", name, iid)
            continue
        im.save(os.path.join(ROOT, "img", "blocks", name + ".webp"), lossless=True, method=6)
        art["blocks"][name] = [im.width, im.height]
    for name, iid in sorted(ORIGINS.items()):
        im = item(iid)
        if im is None:
            print("no render:", name, iid)
            continue
        side = max(im.size)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
        sq.resize((128, 128), Image.NEAREST if side <= 128 else Image.LANCZOS).save(os.path.join(ROOT, "img", "origins", name + ".png"))
    with open(os.path.join(ROOT, "img", "art.json"), "w") as f:
        json.dump(art, f, separators=(",", ":"), sort_keys=True)
    print(len(art["mobs"]), "mobs,", len(art["blocks"]), "blocks")


if __name__ == "__main__":
    main()
