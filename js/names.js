// German names for what the server reports in English, shared by the pages that show goals.
// Base amounts are the planned ones for 30 players; the server sets the real ones when a
// stage opens, until then it reports 0.

window.KW = window.KW || {};
window.KW.names = {
  stages: {
    stage1: { n: 1, stage: "Steinwerk", goal: "Fundament des Kronwerks" },
    stage2: { n: 2, stage: "Messingwerk", goal: "Die Messingmaschine" },
    stage3: { n: 3, stage: "Stahlwerk", goal: "Der Ofen schläft nie" },
    stage4: { n: 4, stage: "Sternwerk", goal: "Licht des Drachen" },
    stage5: { n: 5, stage: "Chaoswerk", goal: "Der Chaoswächter" },
  },
  pillars: { Stone: "Stein", Tech: "Technik", Magic: "Magie" },
  items: {
    "#c:cobblestones": "Bruchstein",
    "create:andesite_alloy": "Andesitlegierung",
    "ars_nouveau:source_gem": "Source Gem",
    "create:brass_ingot": "Messingbarren",
    "create:precision_mechanism": "Präzisionsmechanismus",
    "botania:mana_pearl": "Mana Pearl",
    "botania:terrasteel_ingot": "Terrastahlbarren",
    "#c:ingots/steel": "Stahlbarren",
    "mekanism:advanced_control_circuit": "Advanced Control Circuit",
    "botania:elementium_ingot": "Elementiumbarren",
    "occultism:spirit_attuned_gem": "Spirit Attuned Gem",
    "mekanism:elite_control_circuit": "Elite Control Circuit",
    "draconicevolution:draconium_ingot": "Draconiumbarren",
    "botania:gaia_spirit": "Gaia Spirit",
    "mahoutsukai:mystic_staff": "Mystic Staff",
    "draconicevolution:awakened_draconium_block": "Erwachter Draconiumblock",
    "mekanism:pellet_antimatter": "Antimaterie-Pellet",
    "botania:gaia_ingot": "Gaia-Spirit-Barren",
    "ars_nouveau:wilden_tribute": "Wilden Tribute",
  },
  base: {
    "#c:cobblestones": 40000, "create:andesite_alloy": 3000, "ars_nouveau:source_gem": 1500,
    "create:brass_ingot": 4000, "create:precision_mechanism": 300, "botania:mana_pearl": 1500, "botania:terrasteel_ingot": 100,
    "#c:ingots/steel": 8000, "mekanism:advanced_control_circuit": 500, "botania:elementium_ingot": 500, "occultism:spirit_attuned_gem": 300,
    "mekanism:elite_control_circuit": 300, "draconicevolution:draconium_ingot": 2000, "botania:gaia_spirit": 128, "mahoutsukai:mystic_staff": 30,
    "draconicevolution:awakened_draconium_block": 64, "mekanism:pellet_antimatter": 200, "botania:gaia_ingot": 256, "ars_nouveau:wilden_tribute": 64,
  },
  states: { locked: "gesperrt", active: "läuft", held: "wartet auf das Event", done: "geschafft" },
  item(it) { return this.items[it.item] || it.name || it.item; },
  pillar(t) { return this.pillars[t] || t; },
  goal(g) { const s = this.stages[g.id]; return s ? s.goal : g.title; },
};
