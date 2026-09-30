// The mod list: loads data/mods.json (built from the pack by tools/modlist.py), filters by
// group and by what is typed into the search box. The state lives in the address (#tech, ?q=).

(function () {
  "use strict";

  const GROUPS = [
    ["all", "Alle"], ["tech", "Technik"], ["magic", "Magie"], ["world", "Welt"], ["gear", "Ausrüstung"],
    ["food", "Essen"], ["build", "Bauen"], ["comfort", "Komfort"], ["performance", "Leistung"], ["library", "Bibliotheken"],
  ];
  const list = document.getElementById("mods");
  const q = document.getElementById("q");
  const count = document.getElementById("count");
  const chips = document.getElementById("groups");
  let mods = [];
  let group = (location.hash || "#all").slice(1);

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
    const body = make("div");
    body.append(make("h3", "", m.name));
    if (m.text) body.append(make("p", "", m.text));
    const links = make("p", "links");
    if (m.modrinth) links.append(link(m.modrinth, "Modrinth"));
    if (m.curseforge) links.append(link(m.curseforge, "CurseForge"));
    if (m.source) links.append(link(m.source, "Quelle"));
    if (m.side === "server") links.append(make("span", "pill", "nur Server"));
    if (m.side === "client") links.append(make("span", "pill", "nur Client"));
    body.append(links);
    li.append(body);
    return li;
  }

  function render() {
    const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = mods.filter((m) => {
      if (group !== "all" && m.group !== group) return false;
      const hay = (m.name + " " + (m.text || "")).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    list.textContent = "";
    const frag = document.createDocumentFragment();
    for (const m of shown) frag.append(item(m));
    list.append(frag);
    count.textContent = shown.length === mods.length ? mods.length + " Mods" : shown.length + " von " + mods.length + " Mods";
    for (const b of chips.children) b.setAttribute("aria-pressed", String(b.dataset.group === group));
  }

  for (const [id, label] of GROUPS) {
    const b = make("button", "chip", label);
    b.type = "button";
    b.dataset.group = id;
    b.addEventListener("click", () => {
      group = id;
      history.replaceState(null, "", id === "all" ? location.pathname + location.search : "#" + id);
      render();
    });
    chips.append(b);
  }
  if (!GROUPS.some(([id]) => id === group)) group = "all";
  q.value = new URLSearchParams(location.search).get("q") || "";
  q.addEventListener("input", render);

  fetch("data/mods.json")
    .then((r) => r.json())
    .then((data) => { mods = data; render(); })
    .catch(() => { count.textContent = "Die Liste konnte nicht geladen werden."; });
})();
