// The stream overlay: the active community goal from /api/status, drawn for OBS on a
// transparent page. Views: bar (default), card, feed. New deposits show up as they come
// in, and when a goal completes the stage that opens takes the middle of the screen.
// Opened in a normal browser (not OBS) the page explains itself over sample data.

(function () {
  "use strict";

  const q = new URLSearchParams(location.search);
  const view = ["bar", "card", "feed"].includes(q.get("view")) ? q.get("view") : "bar";
  const corner = ["tl", "tr", "bl", "br"].includes(q.get("corner")) ? q.get("corner") : view === "feed" ? "br" : "tr";
  const scale = Math.min(3, Math.max(0.4, parseFloat(q.get("scale")) || 1));
  const withFeed = q.get("feed") !== "0";
  const inObs = !!window.obsstudio;
  const setup = !inObs && !q.has("embed") && !q.has("demo");
  const demo = q.has("demo") || setup;
  const every = Math.max(10, parseInt(q.get("refresh"), 10) || 15) * 1000;
  const API = q.get("api") || "/api/status";

  document.documentElement.style.setProperty("--s", String(scale));
  if (setup) {
    document.body.classList.add("setup");
    document.getElementById("setup").hidden = false;
  }

  const N = window.KW && window.KW.names;
  const nf = { format: window.KW.fmt };
  const root = document.getElementById("stage-root");
  const feed = document.getElementById("feed");
  const MILESTONES = ["stone_gearbox", "source_keystone", "brass_heart", "rune_core", "steel_core", "elven_star"];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const itemName = (it) => (N ? N.item(it) : it.name || it.item);
  const isMilestone = (id) => id && id.startsWith("kronwerke:") && MILESTONES.includes(id.slice(10));
  const icon = (id) => "img/items/" + id.slice(10) + ".png";
  const pillarClass = (t) => (/magic|magie/i.test(t) ? "magic" : /stone|stein/i.test(t) ? "stone" : "tech");
  const weight = (it) => (it.weight > 0 ? it.weight : 1);

  // a pillar's share in points, the way the obelisk counts it
  function pillarFraction(p) {
    let have = 0, want = 0;
    for (const it of p.items || []) {
      const t = it.target || (N && N.base[it.item]) || 0;
      have += Math.min(it.have || 0, t) * weight(it);
      want += t * weight(it);
    }
    return want ? have / want : 0;
  }
  function goalFraction(g) {
    if (typeof g.percent === "number" && g.state !== "locked") return g.percent / 100;
    let have = 0, want = 0;
    for (const p of g.pillars || []) for (const it of p.items || []) {
      const t = it.target || (N && N.base[it.item]) || 0;
      have += Math.min(it.have || 0, t) * weight(it);
      want += t * weight(it);
    }
    return want ? have / want : 0;
  }
  function stageOf(g) {
    const s = N && N.stages[g.id];
    return s ? { n: s.n, stage: s.stage, goal: s.goal } : { n: "", stage: "", goal: g.title };
  }
  // the stage a goal opens is the next one
  function opens(g) {
    const s = N && N.stages[g.id];
    if (!s) return null;
    const next = Object.values(N.stages).find((x) => x.n === s.n + 1);
    return next || null;
  }

  // ---- drawing ------------------------------------------------------------------

  let built = null; // the DOM of the current goal, kept so the bars can animate

  function draw(g) {
    root.textContent = "";
    built = null;
    if (!g || view === "feed") return;
    const st = stageOf(g);
    const box = el("section", "box");
    box.id = view;
    if (view === "card") box.classList.add(corner);
    box.classList.add("st" + st.n);
    document.body.dataset.stage = st.n;
    const head = el("div", view === "card" ? "top" : "head");
    const titles = el("div");
    titles.append(el("div", "stage caps", "Stufe " + st.n + ", " + st.stage), el("div", "goal caps", st.goal));
    const pct = el("div", "pct caps");
    head.append(titles, pct);
    box.append(head);

    const pillars = el("div", "pillars");
    const refs = [];
    for (const p of g.pillars || []) {
      const cls = pillarClass(p.title);
      const pe = el("div", "pillar " + cls);
      const name = el("div", "pname caps");
      const pv = el("b");
      name.append(el("span", "", N ? N.pillar(p.title) : p.title), pv);
      const meter = el("div", "meter");
      const fill = el("i");
      meter.append(fill);
      pe.append(name, meter);
      const rows = [];
      if (view === "card") {
        for (const it of p.items || []) {
          if (isMilestone(it.item)) continue;
          const row = el("div", "row");
          const n = el("b");
          row.append(el("span", "", itemName(it)), n);
          pe.append(row);
          rows.push({ it: it.item, n });
        }
      }
      const miles = (p.items || []).filter((it) => isMilestone(it.item));
      let mileRefs = null;
      if (miles.length) {
        const m = el("div", "miles");
        mileRefs = [];
        for (const it of miles) {
          const t = it.target || (N && N.base[it.item]) || 0;
          const show = Math.min(t, 12);
          for (let i = 0; i < show; i++) {
            const img = el("img", "mile");
            img.src = icon(it.item);
            img.alt = "";
            m.append(img);
            mileRefs.push({ it: it.item, i, img });
          }
          const c = el("span", "mcount");
          m.append(c);
          mileRefs.push({ it: it.item, count: c });
        }
        pe.append(m);
      }
      pillars.append(pe);
      refs.push({ title: p.title, fill, pv, meter, rows, mileRefs });
    }
    box.append(pillars);

    let lead = null;
    if (view === "card") {
      lead = el("div", "lead");
      box.append(lead);
    }
    const note = el("div", "note caps");
    box.append(note);
    root.append(box);
    built = { id: g.id, pct, refs, lead, note };
    update(g);
  }

  function update(g) {
    if (!built || built.id !== g.id) { draw(g); return; }
    const f = goalFraction(g);
    built.pct.textContent = "";
    built.pct.append(String(Math.floor(f * 100)), el("small", "", "%"));
    (g.pillars || []).forEach((p, i) => {
      const r = built.refs[i];
      if (!r) return;
      const pf = pillarFraction(p);
      requestAnimationFrame(() => { r.fill.style.width = (pf * 100).toFixed(2) + "%"; });
      r.pv.textContent = Math.floor(pf * 100) + " %";
      r.meter.classList.toggle("hold", g.state === "held");
      for (const row of r.rows) {
        const it = p.items.find((x) => x.item === row.it);
        if (it) row.n.textContent = nf.format(it.have || 0) + " / " + nf.format(it.target || (N && N.base[it.item]) || 0);
      }
      if (r.mileRefs) {
        for (const m of r.mileRefs) {
          const it = p.items.find((x) => x.item === m.it);
          if (!it) continue;
          if (m.img) m.img.classList.toggle("have", m.i < (it.have || 0));
          if (m.count) m.count.textContent = (it.have || 0) + "/" + (it.target || (N && N.base[it.item]) || 0);
        }
      }
    });
    if (built.lead) {
      built.lead.textContent = "";
      const top = (g.top || []).slice(0, 3);
      if (top.length) {
        built.lead.append(el("span", "caps", "Meiste Beiträge"));
        const ol = el("ol");
        for (const t of top) {
          const li = el("li");
          li.append(el("b", "", t.name), " " + nf.format(t.amount));
          ol.append(li);
        }
        built.lead.append(ol);
      } else {
        built.lead.append("Noch keine Einzahlungen. Der Obelisk wartet.");
      }
    }
    built.note.textContent = g.state === "held" ? "Der Obelisk wartet auf das Event" : "";
  }

  // ---- deposits -----------------------------------------------------------------

  let seen = null; // newest deposit time already shown
  function deposits(g) {
    if (!withFeed || !g) return;
    const list = (g.recent || []).slice().sort((a, b) => a.at - b.at);
    if (seen === null) { seen = list.length ? list[list.length - 1].at : 0; return; }
    for (const r of list) {
      if (r.at <= seen) continue;
      seen = r.at;
      toast(r);
    }
  }
  function toast(r) {
    const mile = isMilestone(r.item);
    const t = el("div", "toast box" + (mile ? " milestone" : ""));
    if (mile) {
      const img = el("img");
      img.src = icon(r.item);
      img.alt = "";
      t.append(img);
    }
    t.append(el("span", "who", r.name), el("span", "n", "+" + nf.format(r.amount) + " " + (N ? N.item({ item: r.item, name: r.itemName }) : r.itemName)));
    feed.prepend(t);
    while (feed.children.length > 4) feed.lastChild.remove();
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 700); }, mile ? 9000 : 6000);
  }
  function placeFeed() {
    if (view === "bar") { feed.className = "above-bar"; return; }
    if (view === "card") {
      // under or above the card, on its side
      const side = corner[1] === "r" ? "right" : "left";
      feed.className = "";
      feed.style[side] = "calc(24px * var(--s))";
      if (corner[0] === "t") feed.style.bottom = "calc(24px * var(--s))";
      else feed.style.top = "calc(24px * var(--s))";
      feed.style.alignItems = side === "right" ? "flex-end" : "flex-start";
      return;
    }
    feed.className = corner;
    feed.style.flexDirection = corner[0] === "b" ? "column-reverse" : "column";
    feed.style.alignItems = corner[1] === "r" ? "flex-end" : "flex-start";
  }

  // ---- a stage opens ------------------------------------------------------------

  const states = {};
  function celebrate(g) {
    const next = opens(g);
    const box = document.getElementById("open");
    document.getElementById("open-kicker").textContent = next ? "Stufe " + next.n + " ist offen" : "Geschafft";
    document.getElementById("open-name").textContent = next ? next.stage : stageOf(g).goal;
    box.firstElementChild.className = "box st" + (next ? next.n : stageOf(g).n);
    box.hidden = false;
    setTimeout(() => { box.hidden = true; }, 14000);
  }

  // ---- data -----------------------------------------------------------------------

  function pick(goals) {
    if (!Array.isArray(goals)) return null;
    return goals.find((x) => x.state === "active" || x.state === "held") || null;
  }

  function apply(goals) {
    if (Array.isArray(goals)) {
      for (const g of goals) {
        if (states[g.id] && states[g.id] !== "done" && g.state === "done") celebrate(g);
        states[g.id] = g.state;
      }
    }
    const g = pick(goals);
    if (g) update(g); else draw(null);
    deposits(g);
  }

  async function load() {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      apply(data.goals);
    } catch (e) {
      // offline for a moment: keep what is on screen
    }
  }

  // sample data for setting it up, moving a little so the animations can be seen
  function sample() {
    const who = ["Elchi", "Kaiserin_Lu", "Brassbaron", "MagierMia", "Zahnrad42"];
    const g = {
      id: "stage2", title: "The Brass Engine", state: "active", percent: 0,
      pillars: [
        { title: "Tech", items: [
          { item: "create:brass_ingot", have: 1240, target: 2000, weight: 1 },
          { item: "create:precision_mechanism", have: 71, target: 150, weight: 5 },
          { item: "kronwerke:brass_heart", have: 3, target: 8, weight: 300 },
        ] },
        { title: "Magic", items: [
          { item: "botania:mana_pearl", have: 402, target: 600, weight: 2 },
          { item: "botania:terrasteel_ingot", have: 19, target: 50, weight: 20 },
          { item: "kronwerke:rune_core", have: 2, target: 8, weight: 300 },
        ] },
      ],
      top: [{ name: "Brassbaron", amount: 612 }, { name: "MagierMia", amount: 388 }, { name: "Elchi", amount: 240 }],
      recent: [],
    };
    let at = Date.now();
    function tick() {
      const p = g.pillars[Math.random() < 0.6 ? 0 : 1];
      const it = p.items[Math.random() < 0.08 ? 2 : Math.random() < 0.7 ? 0 : 1];
      const n = isMilestone(it.item) ? 1 : it.weight >= 5 ? 1 + Math.floor(Math.random() * 6) : 16 + Math.floor(Math.random() * 64);
      it.have = Math.min(it.target, it.have + n);
      at += 1000;
      g.recent.unshift({ at, name: who[Math.floor(Math.random() * who.length)], item: it.item, itemName: it.item, amount: n });
      g.recent.length = Math.min(g.recent.length, 20);
      let have = 0, want = 0;
      for (const pp of g.pillars) for (const x of pp.items) { have += x.have * x.weight; want += x.target * x.weight; }
      g.percent = Math.floor((100 * have) / want);
      apply([g]);
    }
    apply([g]);
    tick();
    setInterval(tick, 3500);
  }

  placeFeed();
  if (demo) sample();
  else {
    load();
    setInterval(load, every);
  }
})();
