// German names for what the server reports in English, shared by the pages that show goals.
// Base amounts are the planned ones for 30 players; the server sets the real ones when a
// stage opens, until then it reports 0.

window.KW = window.KW || {};
// numbers with a thin space as thousands separator, like the rest of the site
window.KW.fmt = function (n) { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f"); };

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
    "occultism:afrit_essence": "Afrit-Essenz",
    "kronwerke:stone_gearbox": "Steinwerk-Getriebe",
    "kronwerke:source_keystone": "Quellschlussstein",
    "kronwerke:brass_heart": "Messingherz",
    "kronwerke:rune_core": "Runenkern",
    "kronwerke:steel_core": "Stahlkern",
    "kronwerke:elven_star": "Elfenstern",
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
    "#c:cobblestones": 20000, "create:andesite_alloy": 1500, "kronwerke:stone_gearbox": 12, "ars_nouveau:source_gem": 800, "kronwerke:source_keystone": 12,
    "create:brass_ingot": 2000, "create:precision_mechanism": 150, "kronwerke:brass_heart": 8, "botania:mana_pearl": 600, "botania:terrasteel_ingot": 50, "kronwerke:rune_core": 8,
    "#c:ingots/steel": 4000, "mekanism:advanced_control_circuit": 250, "kronwerke:steel_core": 8, "botania:elementium_ingot": 400, "occultism:afrit_essence": 150, "kronwerke:elven_star": 8,
    "mekanism:elite_control_circuit": 150, "draconicevolution:draconium_ingot": 1000, "botania:gaia_spirit": 128, "mahoutsukai:mystic_staff": 30,
    "draconicevolution:awakened_draconium_block": 64, "mekanism:pellet_antimatter": 100, "botania:gaia_ingot": 128, "ars_nouveau:wilden_tribute": 64,
  },

  // the planned goals, for the status page before the server reports them
  planned: [
    { id: "stage1", pillars: [
      { title: "Stone", items: ["#c:cobblestones"] },
      { title: "Tech", items: ["create:andesite_alloy", "kronwerke:stone_gearbox"] },
      { title: "Magic", items: ["ars_nouveau:source_gem", "kronwerke:source_keystone"] } ] },
    { id: "stage2", pillars: [
      { title: "Tech", items: ["create:brass_ingot", "create:precision_mechanism", "kronwerke:brass_heart"] },
      { title: "Magic", items: ["botania:mana_pearl", "botania:terrasteel_ingot", "kronwerke:rune_core"] } ] },
    { id: "stage3", pillars: [
      { title: "Tech", items: ["#c:ingots/steel", "mekanism:advanced_control_circuit", "kronwerke:steel_core"] },
      { title: "Magic", items: ["botania:elementium_ingot", "occultism:afrit_essence", "kronwerke:elven_star"] } ] },
    { id: "stage4", pillars: [
      { title: "Tech", items: ["mekanism:elite_control_circuit", "draconicevolution:draconium_ingot"] },
      { title: "Magic", items: ["botania:gaia_spirit", "mahoutsukai:mystic_staff"] } ] },
    { id: "stage5", pillars: [
      { title: "Tech", items: ["draconicevolution:awakened_draconium_block", "mekanism:pellet_antimatter"] },
      { title: "Magic", items: ["botania:gaia_ingot", "ars_nouveau:wilden_tribute"] } ] },
  ],
  fixed: ["kronwerke:stone_gearbox", "kronwerke:source_keystone", "kronwerke:brass_heart", "kronwerke:rune_core", "kronwerke:steel_core", "kronwerke:elven_star", "botania:gaia_spirit", "mahoutsukai:mystic_staff", "draconicevolution:awakened_draconium_block", "ars_nouveau:wilden_tribute"],
  icons: { "kronwerke:stone_gearbox": "stone_gearbox", "kronwerke:source_keystone": "source_keystone", "kronwerke:brass_heart": "brass_heart", "kronwerke:rune_core": "rune_core", "kronwerke:steel_core": "steel_core", "kronwerke:elven_star": "elven_star" },
  mobs: { stage1: "villager", stage2: "blaze", stage3: "allay", stage4: "enderman", stage5: "wither" },

  states: { planned: "geplant", locked: "gesperrt", active: "läuft", held: "wartet auf das Event", done: "geschafft" },
  item(it) { return this.items[it.item] || it.name || it.item; },
  pillar(t) { return this.pillars[t] || t; },
  goal(g) { const s = this.stages[g.id]; return s ? s.goal : g.title; },
};
