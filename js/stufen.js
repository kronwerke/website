// The finder on the stages page: type a mod, see in which stages it gets something new.

(function () {
  "use strict";

  const q = document.getElementById("finder-q");
  const out = document.getElementById("finder-out");
  if (!q || !out) return;
  const ST = window.KW.modstages;
  const NAMES = window.KW.stageNames;
  const all = Object.entries(ST).map(([k, v]) => ({ key: k, name: v.name, by: v.by }));

  function make(tag, cls, s) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (s !== undefined) el.textContent = s;
    return el;
  }
  function card(m) {
    const li = make("div", "mod");
    li.style.gridTemplateColumns = "1fr";
    const h = make("h3", "", m.name);
    const strip = make("span", "strip");
    const total = Object.values(m.by).reduce((a, b) => a + b, 0);
    for (let n = 1; n <= 5; n++) {
      const i = document.createElement("i");
      const c = m.by[n] || 0;
      if (c) i.className = "s" + n + (c / total < 0.15 ? " half" : "");
      strip.append(i);
    }
    const note = make("span", "stage-note");
    note.append(strip);
    h.append(note);
    li.append(h);
    const stages = Object.keys(m.by).map(Number).sort();
    const parts = stages.map((n) => NAMES[n] + " (Stufe " + n + "): " + m.by[n] + (m.by[n] === 1 ? " Item" : " Items"));
    const p = make("p", "", stages.length === 1 && stages[0] === 1 ? "Alles ab Tag 1, nichts gesperrt." : parts.join(". ") + ".");
    li.append(p);
    return li;
  }
  function render() {
    const words = q.value.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
    out.textContent = "";
    if (!words.length) return;
    const hits = all.filter((m) => words.every((w) => m.key.includes(w) || m.name.toLowerCase().includes(w))).slice(0, 12);
    if (!hits.length) {
      out.append(make("p", "note", "Keine Mod mit diesem Namen hat gestufte Items. Entweder ist sie von Anfang an offen, oder sie heißt anders: Die vollständige Liste steht unter Mods."));
      return;
    }
    for (const m of hits) out.append(card(m));
  }
  q.addEventListener("input", render);
  const start = new URLSearchParams(location.search).get("mod");
  if (start) { q.value = start; render(); }
})();
