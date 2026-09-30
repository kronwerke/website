// The mod list: loads data/mods.json (built from the pack by tools/modlist.py), filters by
// group, by stage and by what is typed into the search box. The state lives in the address
// (#tech, ?q=, ?stufe=). Which stage a mod opens in comes from modstages.js.

(function () {
  "use strict";

  const list = document.getElementById("mods");
  const q = document.getElementById("q");
  const count = document.getElementById("count");
  const chips = document.getElementById("groups");
  const stageChips = document.getElementById("stages");
  const ST = window.KW.modstages;
  const key = window.KW.stageKey;
  const params = new URLSearchParams(location.search);
  let mods = [];
  let group = (location.hash || "#all").slice(1);
  let stage = Number(params.get("stufe")) || 0;

  function make(tag, cls, s) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (s !== undefined) el.textContent = s;
    return el;
  }
  function link(href, s) {
    const a = make("a", "", s);
    a.href = href;
    a.rel = "noopener";
    return a;
  }

  // the five fields: full colour where the mod has most of its items, faint where a few
  function strip(by) {
    const el = make("span", "strip");
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    const parts = [];
    for (let n = 1; n <= 5; n++) {
      const i = document.createElement("i");
      const c = by[n] || 0;
      if (c) { i.className = "s" + n + (c / total < 0.15 ? " half" : ""); parts.push("Stufe " + n + ": " + c); }
      el.append(i);
    }
    el.setAttribute("title", parts.join(", ") + " Items");
    return el;
  }
  function stageInfo(m) {
    const st = ST[key(m.name)];
    if (!st) return null;
    const stages = Object.keys(st.by).map(Number).sort();
    return { by: st.by, first: stages[0], last: stages[stages.length - 1] };
  }
  function stageText(info) {
    if (!info) return "";
    if (info.first === info.last) return "ab Stufe " + info.first;
    return "ab Stufe " + info.first + ", voll ab Stufe " + info.last;
  }

  function item(m) {
    const li = make("li", "mod");
    if (m.icon) {
      const img = make("img");
      img.src = m.icon;
      img.alt = "";
      img.loading = "lazy";
      img.width = 48;
      img.height = 48;
      li.append(img);
    } else {
      li.append(make("span", "noicon"));
    }
    const h = make("h3", "", m.name);
    li.append(h);
    const info = stageInfo(m);
    if (info) {
      const note = make("p", "stage-note");
      note.append(strip(info.by), stageText(info));
      li.append(note);
    } else if (m.group !== "library") {
      li.append(make("p", "stage-note", "immer offen"));
    }
    if (m.text) li.append(make("p", "", m.text));
    const links = make("p", "links");
    if (m.modrinth) links.append(link(m.modrinth, "Modrinth"));
    if (m.curseforge) links.append(link(m.curseforge, "CurseForge"));
    if (m.source) links.append(link(m.source, "Quelle"));
    if (info && info.last > 1) links.append(link("stufen.html?mod=" + encodeURIComponent(m.name) + "#finder", "Wann öffnet was"));
    if (m.side === "server") links.append(make("span", "pill", "nur Server"));
    if (m.side === "client") links.append(make("span", "pill", "nur Client"));
    li.append(links);
    return li;
  }

  function render() {
    const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = mods.filter((m) => {
      if (group !== "all" && m.group !== group) return false;
      if (stage) {
        const info = stageInfo(m);
        if (!info || !info.by[stage]) return false;
      }
      const hay = (m.name + " " + (m.text || "")).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    list.textContent = "";
    const frag = document.createDocumentFragment();
    for (const m of shown) frag.append(item(m));
    list.append(frag);
    count.textContent = shown.length === mods.length ? mods.length + " Mods" : shown.length + " von " + mods.length + " Mods";
    // every group chip says how many mods it holds, with the search and the stage applied
    const per = {};
    for (const m of mods) {
      if (stage) { const info = stageInfo(m); if (!info || !info.by[stage]) continue; }
      const hay = (m.name + " " + (m.text || "")).toLowerCase();
      if (!words.every((w) => hay.includes(w))) continue;
      per[m.group] = (per[m.group] || 0) + 1;
      per.all = (per.all || 0) + 1;
    }
    for (const b of chips.children) {
      b.setAttribute("aria-pressed", String(b.dataset.group === group));
      let n = b.querySelector(".n");
      if (!n) { n = make("span", "n"); b.append(n); }
      n.textContent = per[b.dataset.group] || 0;
    }
    for (const b of stageChips.children) b.setAttribute("aria-pressed", String(Number(b.dataset.stage) === stage));
    const url = new URL(location.href);
    if (q.value.trim()) url.searchParams.set("q", q.value.trim()); else url.searchParams.delete("q");
    if (stage) url.searchParams.set("stufe", stage); else url.searchParams.delete("stufe");
    url.hash = group === "all" ? "" : "#" + group;
    history.replaceState(null, "", url);
  }

  for (const b of chips.children) {
    b.addEventListener("click", () => { group = b.dataset.group; render(); });
  }
  for (const b of stageChips.children) {
    b.addEventListener("click", () => { const n = Number(b.dataset.stage); stage = stage === n ? 0 : n; render(); });
  }
  if (![...chips.children].some((b) => b.dataset.group === group)) group = "all";
  q.value = params.get("q") || "";
  q.addEventListener("input", render);

  fetch("data/mods.json")
    .then((r) => r.json())
    .then((data) => { mods = data; render(); })
    .catch(() => { count.textContent = "Die Liste konnte nicht geladen werden."; });
})();
