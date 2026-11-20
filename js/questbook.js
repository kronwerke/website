// The quest book in the browser. Data from qb/ (built by tools/questbook.sh from the pack):
// book.json for the chapter list, one file per chapter with the quests where the game puts
// them, items.json for item names, words.json for mobs, dimensions and keys, search.json for
// the search and help/<chapter>.json for the help written for the web. Chapters are drawn
// like the game draws them: quest shapes, item icons, banners, dependency lines. Signed in
// players see what their team has done (from /api/me/quests).
(function () {
  "use strict";

  const Q = "/qb/";
  const U = 44;                 // pixels per quest grid unit at zoom 1
  const STAGES = {
    de: ["", "Steinwerk", "Messingwerk", "Stahlwerk", "Sternwerk", "Chaoswerk"],
    en: ["", "Stone Works", "Brass Works", "Steel Works", "Star Works", "Chaos Works"],
  };
  const T = {
    de: { stage: "Stufe", tasks: "Aufgaben", rewards: "Belohnungen", help: "Hilfe", before: "Davor", after: "Danach",
      close: "Schließen", optional: "Optional", consumed: "wird abgegeben", xp: "Level Erfahrung", loot: "Kiste",
      kill: "Besiege", dim: "Betritt", check: "Abhaken", advancement: "Fortschritt", nohits: "Nichts gefunden.",
      quests: "Quests", done: "Erledigt", open: "Offen", locked: "Noch gesperrt", key: "Taste", search: "Quest oder Item suchen",
      hint: "Ziehen zum Bewegen, Mausrad oder zwei Finger zum Zoomen, Klick auf eine Quest für Text und Hilfe.",
      progress: "Dein Fortschritt", of: "von", signin: "Mit Minecraft anmelden, um deinen Fortschritt zu sehen" },
    en: { stage: "Stage", tasks: "Tasks", rewards: "Rewards", help: "Help", before: "Before", after: "After",
      close: "Close", optional: "Optional", consumed: "is handed in", xp: "levels of experience", loot: "crate",
      kill: "Defeat", dim: "Enter", check: "Tick off", advancement: "Advancement", nohits: "Nothing found.",
      quests: "quests", done: "Done", open: "Open", locked: "Still locked", key: "Key", search: "Search quest or item",
      hint: "Drag to move, wheel or two fingers to zoom, click a quest for its text and help.",
      progress: "Your progress", of: "of", signin: "Sign in with Minecraft to see your progress" },
  };
  const MC = { "0": "#000000", "1": "#3f3fd0", "2": "#3fa63f", "3": "#3fb0b0", "4": "#d04040", "5": "#b65ad6",
    "6": "#f0b24a", "7": "#b8b0c4", "8": "#7f7890", "9": "#7f8cff", a: "#7fe07f", b: "#6fe0e8", c: "#ff7676",
    d: "#ff8ef0", e: "#f6e07a", f: "#ffffff" };

  const $ = (id) => document.getElementById(id);
  let lang = "de";
  try { lang = localStorage.getItem("qb-lang") || ((navigator.language || "de").slice(0, 2) === "de" ? "de" : "en"); } catch (e) { /* storage off */ }
  if (lang !== "de" && lang !== "en") lang = "de";

  let book = null, items = {}, words = {}, search = null;
  const chapters = {}, helps = {};
  let progress = null;        // { done: Set of "chapter/quest", started: Set }
  let current = null, selected = null;
  let view = { x: 0, y: 0, z: 1 };

  // the build writes a fingerprint of the quest book's data (qd) and of its pictures (qi)
  // on <html>: with it an address names one exact content and never has to be asked for again
  const DS = document.documentElement.dataset;
  const VD = DS.qd ? "?v=" + DS.qd : "", VI = DS.qi ? "?v=" + DS.qi : "";
  const get = (url) => fetch(url + VD, VD ? { cache: "force-cache" } : {}).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // item names are only needed once a quest is open or the search runs: they load after the map
  let itemsReady = null, itemsLoaded = false;
  const needItems = () => itemsReady || (itemsReady = get(Q + "items.json").then((it) => { items = it || {}; itemsLoaded = true; }));
  const tr = (o) => (o && typeof o === "object" ? o[lang] || o.de || "" : o || "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function iconUrl(id) {
    if (!id) return "";
    const [ns, path] = id.split(":");
    return Q + "icons/" + ns + "/" + path + ".webp" + VI;
  }
  function itemName(id) {
    const it = items[id];
    return it ? it[lang] || it.de : id.split(":").pop().replace(/_/g, " ");
  }
  function icon(id, cls) {
    const img = document.createElement("img");
    img.className = cls || "qb-icon";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = iconUrl(id);
    img.onerror = () => { img.onerror = null; img.classList.add("none"); img.removeAttribute("src"); };
    return img;
  }

  // ---- text: & colour codes, {image:...}, {key:...} as the book writes them -------------
  function plain(s) { return String(s || "").replace(/&[0-9a-fk-or]/g, ""); }
  function styled(line) {
    let out = "", open = 0, i = 0;
    const re = /&([0-9a-fk-or])|\{key:([A-Za-z0-9_.$-]+)\}|\{image:([a-z0-9_.-]+):([a-z0-9_./-]+)([^}]*)\}/g;
    let m;
    while ((m = re.exec(line))) {
      out += esc(line.slice(i, m.index));
      i = re.lastIndex;
      if (m[1]) {
        const c = m[1];
        if (c === "r") { out += "</span>".repeat(open); open = 0; }
        else if (MC[c]) { out += "</span>".repeat(open); open = 1; out += '<span style="color:' + MC[c] + '">'; }
        else if (c === "l") { out += '<span class="b">'; open++; }
        else if (c === "o") { out += '<span class="i">'; open++; }
        else if (c === "n") { out += '<span class="u">'; open++; }
        else if (c === "m") { out += '<span class="s">'; open++; }
      } else if (m[2]) {
        const w = words[m[2]];
        out += '<kbd title="' + esc(T[lang].key) + '">' + esc(w ? w[lang] || w.de : m[2]) + "</kbd>";
      } else if (m[3]) {
        const path = m[4].replace(/^textures\//, "").replace(/\.png$/, ".webp");
        const wm = /width:(\d+)/.exec(m[5]), hm = /height:(\d+)/.exec(m[5]);
        const big = /\/shots\//.test(path);
        out += '<img class="' + (big ? "qb-shot" : "qb-pic") + '" alt="" loading="lazy" src="' + Q + "tex/" + m[3] + "/" + path + '"'
          + (wm && !big ? ' width="' + wm[1] * 2 + '" height="' + hm[1] * 2 + '"' : "") + ">";
      }
    }
    out += esc(line.slice(i)) + "</span>".repeat(open);
    return out;
  }
  function paragraphs(lines) {
    const out = [];
    let cur = [];
    for (const l of lines || []) {
      if (l === "") { if (cur.length) out.push(cur); cur = []; } else cur.push(l);
    }
    if (cur.length) out.push(cur);
    return out.map((p) => {
      if (p.length === 1 && /^\{image:/.test(p[0].trim())) return '<figure>' + styled(p[0]) + "</figure>";
      return "<p>" + p.map(styled).join("<br>") + "</p>";
    }).join("");
  }
  // help markup: [[ns:item]], {{chapter/quest}}, **bold**
  function helpHtml(text) {
    let s = esc(text);
    s = s.replace(/\[\[([a-z0-9_.-]+:[a-z0-9_./-]+)\]\]/g, (_, id) =>
      '<span class="qb-chip"><img alt="" loading="lazy" src="' + iconUrl(id) + '" data-miss="remove">' + esc(itemName(id)) + "</span>");
    s = s.replace(/\{\{([a-z0-9_]+)\/([a-z0-9_]+)\}\}/g, (_, c, q) =>
      '<a href="#' + c + "/" + q + '" data-link="' + c + "/" + q + '">' + esc(c + "/" + q) + "</a>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return s;
  }
  // links to quests of other chapters show their titles once those chapters are loaded
  async function nameLinks(root) {
    for (const a of root.querySelectorAll("a[data-link]")) {
      const [c, q] = a.dataset.link.split("/");
      const ch = await chapter(c);
      const quest = ch && ch.quests.find((x) => x.name === q);
      if (quest) a.textContent = plain(tr(quest.title));
    }
  }

  // ---- data -------------------------------------------------------------------------
  async function chapter(name) {
    if (!chapters[name]) chapters[name] = get(Q + "chapters/" + name + ".json");
    return chapters[name];
  }
  async function help(name) {
    if (!(name in helps)) helps[name] = get(Q + "help/" + name + ".json");
    return helps[name];
  }

  // ---- chapter list -----------------------------------------------------------------
  function drawList() {
    const nav = $("qb-chapters");
    nav.textContent = "";
    for (const g of book.groups) {
      const list = book.chapters.filter((c) => c.group === g.name);
      if (!list.length) continue;
      const sec = document.createElement("section");
      const h = document.createElement("h2");
      h.textContent = plain(tr(g.title));
      sec.append(h);
      const ul = document.createElement("ul");
      for (const c of list) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#" + c.name;
        a.dataset.chapter = c.name;
        a.style.setProperty("--c", "var(--s" + c.stage + ")");
        a.append(icon(c.icon));
        const t = document.createElement("span");
        t.className = "t";
        t.textContent = plain(tr(c.title));
        const n = document.createElement("span");
        n.className = "n";
        n.dataset.count = c.name;
        n.textContent = c.quests;
        a.append(t, n);
        if (current && current.name === c.name) a.setAttribute("aria-current", "page");
        li.append(a);
        ul.append(li);
      }
      sec.append(ul);
      nav.append(sec);
    }
    countProgress();
  }

  // ---- the canvas ---------------------------------------------------------------------
  function applyView() {
    $("qb-world").style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.z + ")";
    $("qb-canvas").style.setProperty("--z", view.z);
    // icons are 64 px: smooth when shown smaller, crisp pixels when shown larger
    $("qb-world").classList.toggle("near", view.z * U * 0.64 >= 64);
  }
  function fit(ch) {
    const box = $("qb-canvas").getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y, w, h) => { x0 = Math.min(x0, x - w / 2); y0 = Math.min(y0, y - h / 2); x1 = Math.max(x1, x + w / 2); y1 = Math.max(y1, y + h / 2); };
    for (const q of ch.quests) grow(q.x, q.y, q.size || 1, q.size || 1);
    for (const im of ch.images || []) grow(im.x, im.y, im.w, im.h);
    const w = (x1 - x0 + 2) * U, h = (y1 - y0 + 2) * U;
    const all = Math.min(box.width / w, box.height / h);
    // a finger needs 24 px: on touch screens a wide chapter opens at its start instead of
    // shrinking until nothing can be hit
    const least = matchMedia("(pointer: coarse)").matches ? 26 / U : 0.25;
    view.z = Math.max(least, Math.min(1.4, all));
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (all < least) {
      const roots = ch.quests.filter((q) => !(q.deps || []).length);
      const first = roots.sort((a, b) => (b.size || 1) - (a.size || 1))[0] || ch.quests[0];
      if (first) {
        // the start in view, and as much of the chapter beside it as fits
        const halfW = box.width / 2 / (U * view.z), halfH = box.height / 2 / (U * view.z);
        cx = Math.min(Math.max(first.x, x0 - 1 + halfW), Math.max(x0 - 1 + halfW, x1 + 1 - halfW));
        cy = Math.min(Math.max(first.y, y0 - 1 + halfH), Math.max(y0 - 1 + halfH, y1 + 1 - halfH));
        if (w * view.z <= box.width) cx = (x0 + x1) / 2;
        if (h * view.z <= box.height) cy = (y0 + y1) / 2;
      }
    }
    view.x = box.width / 2 - cx * U * view.z;
    view.y = box.height / 2 - cy * U * view.z;
    applyView();
  }
  function centerOn(q) {
    const box = $("qb-canvas").getBoundingClientRect();
    const open = !$("qb-quest").hidden && window.innerWidth > 900 ? 440 : 0;
    view.x = (box.width - open) / 2 - q.x * U * view.z;
    view.y = box.height / 2 - q.y * U * view.z;
    $("qb-world").classList.add("glide");
    applyView();
    setTimeout(() => $("qb-world").classList.remove("glide"), 450);
  }

  function state(ch, q) {
    if (!progress) return "";
    if (progress.done.has(q.id)) return "done";
    if (progress.started.has(q.id)) return "started";
    const deps = q.deps || [];
    return deps.every((d) => { const p = ch.quests.find((x) => x.name === d); return p && progress.done.has(p.id); }) ? "" : "locked";
  }

  // the progress arrived after the map was drawn: mark the quests and lines, leave the view alone
  function restate() {
    if (!current) return;
    const by = {};
    for (const q of current.quests) by[q.name] = q;
    const states = ["done", "started", "locked", "open"];
    for (const b of document.querySelectorAll(".qb-q")) {
      const s = by[b.dataset.quest] && state(current, by[b.dataset.quest]);
      b.classList.remove(...states);
      if (s) b.classList.add(s);
    }
    for (const l of document.querySelectorAll(".qb-lines line")) {
      const s = by[l.dataset.to] && state(current, by[l.dataset.to]);
      l.classList.remove(...states);
      if (s) l.classList.add(s === "done" ? "done" : s === "locked" ? "locked" : "open");
    }
  }
  async function draw(name, questName) {
    const ch = await chapter(name);
    if (!ch) return;
    current = ch;
    for (const a of document.querySelectorAll(".qb-chapters a")) {
      if (a.dataset.chapter === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
    $("qb-title").innerHTML = styled(tr(ch.title));
    const st = $("qb-stage");
    st.textContent = T[lang].stage + " " + ch.stage + ", " + STAGES[lang][ch.stage] + " · " + ch.quests.length + " " + T[lang].quests;
    st.style.setProperty("--c", "var(--s" + ch.stage + ")");
    document.title = plain(tr(ch.title)) + ", Questbuch, Kronwerke";

    const world = $("qb-world");
    world.textContent = "";
    const byName = {};
    for (const q of ch.quests) byName[q.name] = q;
    const children = {};
    for (const q of ch.quests) for (const d of q.deps || []) children[d] = (children[d] || 0) + 1;

    // pictures and banners under the quests
    for (const im of (ch.images || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))) {
      const img = document.createElement("img");
      // lettering is a picture of words: in English its English twin, which has its own width
      const pic = lang === "en" && im.en ? im.en : im;
      const w = pic.w || im.w;
      const [ns, p] = pic.image.split(":");
      img.src = Q + "tex/" + ns + "/" + p.replace(/^textures\//, "").replace(/\.png$/, ".webp") + VI;
      if (!world.firstChild) img.fetchPriority = "high";  // the chapter's banner is the first thing to see
      img.alt = "";
      img.className = "qb-img " + (im.kind || "");
      img.style.left = (im.x - w / 2) * U + "px";
      img.style.top = (im.y - im.h / 2) * U + "px";
      img.style.width = w * U + "px";
      img.style.height = im.h * U + "px";
      if (im.rot) img.style.transform = "rotate(" + im.rot + "deg)";
      world.append(img);
    }

    // dependency lines, as the game hides them: none for a quest with more than three
    // parents, none out of a quest with more than four children, none in a chapter that says so
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "qb-lines");
    svg.setAttribute("overflow", "visible");
    if (!ch.hideLines) {
      for (const q of ch.quests) {
        if ((q.deps || []).length > 3) continue;
        for (const d of q.deps || []) {
          const p = byName[d];
          if (!p || (children[d] || 0) > 4) continue;
          const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
          l.setAttribute("x1", p.x * U); l.setAttribute("y1", p.y * U);
          l.setAttribute("x2", q.x * U); l.setAttribute("y2", q.y * U);
          l.dataset.from = d; l.dataset.to = q.name;
          const s = state(ch, q);
          if (s) l.classList.add(s === "done" ? "done" : s === "locked" ? "locked" : "open");
          svg.append(l);
        }
      }
    }
    world.append(svg);

    for (const q of ch.quests) {
      const size = (q.size || 1) * U;
      const shape = q.shape || ch.shape || "circle";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qb-q " + shape + (q.optional ? " optional" : "");
      const s = state(ch, q);
      if (s) b.classList.add(s);
      b.style.left = q.x * U - size / 2 + "px";
      b.style.top = q.y * U - size / 2 + "px";
      b.style.width = size + "px";
      b.style.height = size + "px";
      b.style.setProperty("--bg", "url(" + Q + "shapes/" + shape + "-background.webp" + VI + ")");
      b.style.setProperty("--ol", "url(" + Q + "shapes/" + shape + "-outline.webp" + VI + ")");
      b.dataset.quest = q.name;
      b.setAttribute("aria-label", plain(tr(q.title)));
      const ic = q.icon || firstItem(q);
      b.append(document.createElement("i"));
      // a chapter has at most some 80, all on the map: fetched at once, but after the banners
      if (ic) { const im = icon(ic); im.loading = "eager"; im.fetchPriority = "low"; b.append(im); }
      else { const t = document.createElement("span"); t.className = "qb-check"; t.innerHTML = mark("check"); b.append(t); }
      b.addEventListener("click", () => openQuest(ch, q, true));
      b.addEventListener("pointerenter", () => tip(b, q));
      b.addEventListener("pointerleave", untip);
      world.append(b);
    }
    if (questName && byName[questName]) {
      fit(ch);
      openQuest(ch, byName[questName], false);
      centerOn(byName[questName]);
    } else {
      closeQuest(false);
      fit(ch);
    }
    document.body.classList.remove("qb-list-open");
  }
  function firstItem(q) {
    for (const t of q.tasks || []) if (t.type === "item") return t.item && t.item.id ? t.item.id : t.item;
    return null;
  }

  let tipEl = null;
  function tip(b, q) {
    untip();
    tipEl = document.createElement("div");
    tipEl.className = "qb-tip";
    tipEl.innerHTML = "<b>" + styled(tr(q.title)) + "</b>" + (q.subtitle ? "<span>" + styled(tr(q.subtitle)) + "</span>" : "");
    document.body.append(tipEl);
    const r = b.getBoundingClientRect();
    tipEl.style.left = Math.min(window.innerWidth - tipEl.offsetWidth - 8, r.left + r.width / 2 - tipEl.offsetWidth / 2) + "px";
    tipEl.style.top = r.top - tipEl.offsetHeight - 8 + "px";
  }
  function untip() { if (tipEl) { tipEl.remove(); tipEl = null; } }

  // ---- one quest ----------------------------------------------------------------------
  async function openQuest(ch, q, push) {
    selected = q;
    untip();
    // opened before the names are there: show it now, and once more with the names
    if (!itemsLoaded) needItems().then(() => { if (selected === q) openQuest(ch, q, false); });
    for (const b of document.querySelectorAll(".qb-q")) b.classList.toggle("sel", b.dataset.quest === q.name);
    for (const l of document.querySelectorAll(".qb-lines line")) l.classList.toggle("hl", l.dataset.to === q.name || l.dataset.from === q.name);
    if (push) history.replaceState(null, "", "#" + ch.name + "/" + q.name);
    const box = $("qb-quest");
    const t = T[lang];
    const s = state(ch, q);
    let html = '<button type="button" class="qb-x" aria-label="' + t.close + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    html += '<div class="qb-qhead">' + (q.icon || firstItem(q) ? '<img class="qb-big" alt="" src="' + iconUrl(q.icon || firstItem(q)) + '" data-miss="remove">' : "")
      + "<div><h2>" + styled(tr(q.title)) + "</h2>" + (q.subtitle ? "<p>" + styled(tr(q.subtitle)) + "</p>" : "") + "</div></div>";
    html += '<p class="qb-meta"><span class="qb-st" style="--c:var(--s' + ch.stage + ')">' + t.stage + " " + ch.stage + "</span>"
      + (q.optional ? "<span>" + t.optional + "</span>" : "")
      + (s ? '<span class="qb-state ' + s + '">' + (s === "done" ? t.done : s === "locked" ? t.locked : t.open) + "</span>" : "") + "</p>";
    const desc = tr(q.description);
    if (desc && desc.length) html += '<div class="qb-desc">' + paragraphs(desc) + "</div>";
    html += '<div class="qb-help" id="qb-help"></div>';
    if ((q.tasks || []).length) {
      html += "<h3>" + t.tasks + "</h3><ul class=\"qb-list\">";
      for (const k of q.tasks) html += "<li>" + task(k) + "</li>";
      html += "</ul>";
    }
    if ((q.rewards || []).length) {
      html += "<h3>" + t.rewards + "</h3><ul class=\"qb-list r\">";
      for (const r of q.rewards) html += "<li>" + reward(r) + "</li>";
      html += "</ul>";
    }
    const before = (q.deps || []).map((d) => ch.quests.find((x) => x.name === d)).filter(Boolean);
    const after = ch.quests.filter((x) => (x.deps || []).includes(q.name));
    if (before.length) html += "<h3>" + t.before + "</h3><p class=\"qb-links\">" + before.map((x) => link(ch, x)).join("") + "</p>";
    if (after.length) html += "<h3>" + t.after + "</h3><p class=\"qb-links\">" + after.map((x) => link(ch, x)).join("") + "</p>";
    box.innerHTML = html;
    box.hidden = false;
    box.scrollTop = 0;
    document.body.classList.add("qb-quest-open");
    // beside the map on a wide screen: bring the quest back if the panel took its place
    const sel = document.querySelector('.qb-q.sel'), cvBox = $("qb-canvas").getBoundingClientRect();
    if (sel && push) {
      const r = sel.getBoundingClientRect();
      if (r.right > cvBox.right - 12 || r.left < cvBox.left + 12 || r.bottom > cvBox.bottom - 12 || r.top < cvBox.top + 12) centerOn(q);
    }
    box.querySelector(".qb-x").addEventListener("click", () => closeQuest(true));
    const h = await help(ch.name);
    const entry = h && h[q.name];
    if (entry && selected === q) {
      const el = $("qb-help");
      const paras = entry[lang] || entry.de || [];
      el.innerHTML = '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9M12 17h.01"/></svg>' + t.help + "</h3>"
        + paras.map((p) => "<p>" + helpHtml(p) + "</p>").join("");
      nameLinks(el);
    }
  }
  function link(ch, x) {
    return '<a href="#' + ch.name + "/" + x.name + '">' + (x.icon || firstItem(x) ? '<img alt="" src="' + iconUrl(x.icon || firstItem(x)) + '" data-miss="remove">' : "") + esc(plain(tr(x.title))) + "</a>";
  }
  function task(k) {
    const t = T[lang];
    if (k.type === "item") {
      const id = k.item && k.item.id ? k.item.id : k.item;
      return '<img alt="" src="' + iconUrl(id) + '" data-miss="none"><span>' + (k.count > 1 ? "<b>" + k.count + "×</b> " : "")
        + esc(k.title ? plain(tr(k.title)) : itemName(id)) + (k.consume_items ? ' <small>' + t.consumed + "</small>" : "") + "</span>";
    }
    if (k.type === "kill") {
      const w = words[k.entity];
      // the mob's spawn egg, as the game shows it; the sword where there is none
      // a task for every variant of a mob names a tag, not one entity: the sword then
      return (k.entity ? '<img alt="" src="' + iconUrl(k.entity + "_spawn_egg") + '" data-mark="kill" data-miss="mark">' : mark("kill")) + "<span>" + t.kill + ": "
        + (k.value > 1 ? "<b>" + k.value + "×</b> " : "") + esc(k.title ? plain(tr(k.title)) : w ? w[lang] : k.entity) + "</span>";
    }
    if (k.type === "dimension") {
      const w = words[k.dimension];
      return mark("dim") + "<span>" + t.dim + ": " + esc(w ? w[lang] : k.dimension) + "</span>";
    }
    if (k.type === "advancement") {
      const w = words[k.advancement];
      // "any of these" tasks are advancements with an item to show (one of the variants)
      const icon = k.icon_item || (k.icon && (k.icon.id || k.icon));
      return (icon ? '<img alt="" src="' + iconUrl(icon) + '" data-miss="none">' : mark("adv"))
        + "<span>" + esc(k.title ? plain(tr(k.title)) : w ? w[lang] || w.de : k.advancement) + "</span>";
    }
    return mark("check") + "<span>" + esc(k.title ? plain(tr(k.title)) : t.check) + "</span>";
  }
  // small drawn marks for what has no item: they sit centred, whatever font is loaded
  const MARKS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    kill: '<path d="M14.5 3.5H20v5.500L9.5 19.500M4 20l3-3M6.5 14.500l3 3M3.5 17l3.5 3.5"/>',
    dim: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M10 7v10M14 7v10"/>',
    adv: '<path d="M12 3.500l2.6 5.3 5.9.900-4.2 4.1 1 5.800L12 16.900l-5.3 2.7 1-5.800L3.5 9.700l5.9-.900z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  function mark(kind, cls) {
    return '<span class="qb-k' + (cls ? " " + cls : "") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MARKS[kind] + "</svg></span>";
  }
  // a picture that does not load: what stands there instead is written on its tag (data-miss).
  // One listener for all of them, so no page needs a script inside its markup.
  document.addEventListener("error", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLImageElement) || !t.dataset.miss) return;
    if (t.dataset.miss === "remove") t.remove();
    else if (t.dataset.miss === "mark") t.outerHTML = mark(t.dataset.mark);
    else t.classList.add("none");
  }, true);
  function reward(r) {
    const t = T[lang];
    if (r.type === "item") {
      const id = r.item && r.item.id ? r.item.id : r.item;
      return '<img alt="" src="' + iconUrl(id) + '" data-miss="none"><span>' + ((r.count || 1) > 1 ? "<b>" + r.count + "×</b> " : "") + esc(itemName(id)) + "</span>";
    }
    if (r.type === "xp_levels") return '<span class="qb-k xp">XP</span><span><b>' + r.xp_levels + "</b> " + t.xp + "</span>";
    if (r.type === "loot") return '<img alt="" src="' + iconUrl(r.icon || "ftbquests:lootcrate") + '" data-miss="none"><span>' + esc(plain(tr(r.title))) + "</span>";
    return mark("plus") + "<span>" + esc(r.type) + "</span>";
  }
  function closeQuest(push) {
    selected = null;
    $("qb-quest").hidden = true;
    document.body.classList.remove("qb-quest-open");
    for (const b of document.querySelectorAll(".qb-q.sel")) b.classList.remove("sel");
    for (const l of document.querySelectorAll(".qb-lines line.hl")) l.classList.remove("hl");
    if (push && current) history.replaceState(null, "", "#" + current.name);
  }

  // ---- pan and zoom -------------------------------------------------------------------
  function zoomAt(f, cx, cy) {
    const z = Math.max(0.2, Math.min(3, view.z * f));
    f = z / view.z;
    view.x = cx - (cx - view.x) * f;
    view.y = cy - (cy - view.y) * f;
    view.z = z;
    applyView();
  }
  function wire() {
    const cv = $("qb-canvas");
    const pts = new Map();
    let last = null, moved = 0;
    const hintOff = () => $("qb-hint").classList.add("gone");
    setTimeout(hintOff, 9000);
    cv.addEventListener("wheel", hintOff, { passive: true, once: true });
    cv.addEventListener("pointerdown", (e) => {
      hintOff();
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
      cv.classList.add("drag");
    });
    window.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const others = [...pts.entries()].find(([id]) => id !== e.pointerId)[1];
        const d0 = Math.hypot(prev.x - others.x, prev.y - others.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
        const r = cv.getBoundingClientRect();
        if (d0 > 0) zoomAt(d1 / d0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        moved += 10;
        return;
      }
      if (!last) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) {
        view.x += dx; view.y += dy; applyView();
        untip();
      }
      last = { x: e.clientX, y: e.clientY };
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (!pts.size) { last = null; cv.classList.remove("drag"); }
      else last = [...pts.values()][0];
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    // a drag must not count as a click on the quest it started on
    cv.addEventListener("click", (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); } }, true);
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    cv.addEventListener("keydown", (e) => {
      const step = 60;
      if (e.key === "ArrowLeft") view.x += step; else if (e.key === "ArrowRight") view.x -= step;
      else if (e.key === "ArrowUp") view.y += step; else if (e.key === "ArrowDown") view.y -= step;
      else if (e.key === "+" || e.key === "=") { const r = cv.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); return; }
      else if (e.key === "-") { const r = cv.getBoundingClientRect(); zoomAt(1 / 1.2, r.width / 2, r.height / 2); return; }
      else return;
      e.preventDefault();
      applyView();
    });
    $("qb-in").addEventListener("click", () => { const r = cv.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
    $("qb-out").addEventListener("click", () => { const r = cv.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
    $("qb-fit").addEventListener("click", () => current && fit(current));
    $("qb-menu").addEventListener("click", () => document.body.classList.toggle("qb-list-open"));
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && selected) closeQuest(true); });

    for (const b of document.querySelectorAll(".qb-lang button")) {
      b.addEventListener("click", () => setLang(b.dataset.lang));
    }

    const input = $("qb-q");
    let timer = 0;
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => find(input.value), 120); });

    window.addEventListener("hashchange", route);
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href^='#']");
      if (!a) return;
      // same hash: hashchange does not fire, open it anyway
      if (a.getAttribute("href") === location.hash) { e.preventDefault(); route(); }
    });
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem("qb-lang", l); } catch (e) { /* storage off */ }
    document.documentElement.lang = l;
    for (const b of document.querySelectorAll(".qb-lang button")) b.setAttribute("aria-pressed", String(b.dataset.lang === l));
    $("qb-q").placeholder = T[l].search;
    $("qb-hint").textContent = T[l].hint;
    drawList();
    me();
    if (current) draw(current.name, selected ? selected.name : null);
    if ($("qb-q").value) find($("qb-q").value);
  }

  // ---- search ---------------------------------------------------------------------------
  async function find(text) {
    const hits = $("qb-hits");
    const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) { hits.hidden = true; $("qb-chapters").hidden = false; return; }
    if (!search) search = await get(Q + "search.json");
    await needItems();
    if (!search) return;
    const res = [];
    for (const [c, n, de, en, its] of search) {
      const hay = (plain(de) + " " + plain(en) + " " + its.map((i) => (items[i] ? items[i].de + " " + items[i].en : i)).join(" ")).toLowerCase();
      if (words.every((w) => hay.includes(w))) res.push([c, n, lang === "en" ? en : de, its[0]]);
      if (res.length >= 60) break;
    }
    hits.textContent = "";
    if (!res.length) { const li = document.createElement("li"); li.className = "none"; li.textContent = T[lang].nohits; hits.append(li); }
    for (const [c, n, title, it] of res) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + c + "/" + n;
      if (it) a.append(icon(it));
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = plain(title);
      const ch = book.chapters.find((x) => x.name === c);
      const s = document.createElement("small");
      s.textContent = ch ? plain(tr(ch.title)) : c;
      t.append(s);
      a.append(t);
      li.append(a);
      hits.append(li);
    }
    hits.hidden = false;
    $("qb-chapters").hidden = true;
  }

  // ---- progress of the signed in player -------------------------------------------------
  async function loadProgress() {
    try {
      const r = await fetch("/api/me/quests", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (!d || !d.name) return;  // not signed in
      progress = { done: new Set(d.done || []), started: new Set(d.started || []), name: d.name, team: d.team };
    } catch (e) { /* not signed in, or no server */ }
  }
  async function countProgress() {
    if (!progress) return;
    if (!search) search = await get(Q + "search.json");
    if (!search) return;
    const per = {};
    for (const e of search) if (progress.done.has(e[5])) per[e[0]] = (per[e[0]] || 0) + 1;
    for (const n of document.querySelectorAll("[data-count]")) {
      const c = book.chapters.find((x) => x.name === n.dataset.count);
      if (!c) continue;
      const d = per[c.name] || 0;
      n.textContent = d + "/" + c.quests;
      n.classList.toggle("full", d >= c.quests);
    }
  }
  function me() {
    const el = $("qb-me");
    if (!progress) {
      el.innerHTML = '<a class="qb-signin" href="/anmelden?back=questbuch">' + T[lang].signin + "</a>";
      return;
    }
    const total = book.chapters.reduce((s, c) => s + c.quests, 0);
    el.innerHTML = '<div class="qb-prog"><img alt="" src="/whitelist/head/' + encodeURIComponent(progress.name || "") + '"><div><b>' + esc(progress.name || "") + "</b><span>"
      + T[lang].progress + ": " + progress.done.size + " " + T[lang].of + " " + total + "</span></div></div>";
  }

  // ---- routing --------------------------------------------------------------------------
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [c, q] = h.split("/");
    const name = book.chapters.some((x) => x.name === c) ? c : book.chapters[0].name;
    if (current && current.name === name && q) {
      const quest = current.quests.find((x) => x.name === q);
      if (quest) { openQuest(current, quest, false); centerOn(quest); return; }
    }
    draw(name, q);
  }

  async function start() {
    // the chapter the address names (or the first one) is asked for together with the book,
    // not after it
    const want = decodeURIComponent(location.hash.slice(1)).split("/")[0] || document.body.dataset.first;
    if (want && /^[a-z0-9_]+$/.test(want)) chapter(want);
    // the map does not wait for the sign in: who is signed in gets the progress drawn in afterwards
    loadProgress().then(() => {
      if (!progress || !book) return;
      me();
      countProgress();
      restate();
      if (current && selected) openQuest(current, selected, false);
    });
    const [b, w] = await Promise.all([get(Q + "book.json"), get(Q + "words.json")]);
    if (!b) { $("qb-title").textContent = "Das Questbuch konnte nicht geladen werden."; return; }
    book = b; words = w || {};
    wire();
    setLang(lang);
    route();
    (window.requestIdleCallback || setTimeout)(needItems);
  }
  start();
})();
