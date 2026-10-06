// The status page: server state, who is online, and every community goal with its pillars
// and the last deposits at the obelisk.
// Before the season, or when the server does not answer, the planned goals are shown.

(function () {
  "use strict";

  const API = "/api/status";
  const N = window.KW.names;
  const nf = { format: window.KW.fmt };
  const $ = (id) => document.getElementById(id);

  function make(tag, cls, s) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (s !== undefined) el.textContent = s;
    return el;
  }

  function showServer(s, season) {
    const state = $("s-state");
    state.textContent = "";
    const names = $("s-names");
    names.textContent = "";
    if (season && !season.running) {
      // the team builds and tests on the server before the season; no player count then
      state.append(make("span", "pill wip", "Work in Progress"));
      $("s-players").textContent = "im Aufbau";
      $("s-pack").textContent = s && s.pack ? s.pack : "in Arbeit";
      return;
    }
    if (!s || (!s.online && !s.state)) {
      state.append(make("span", "pill", "öffnet Mitte Januar"));
      $("s-players").textContent = "0";
      $("s-pack").textContent = s && s.pack ? s.pack : "in Arbeit";
      return;
    }
    let pill;
    if (s.online) pill = make("span", "pill on", "online");
    else if (s.state === "starting") pill = make("span", "pill hold", "startet");
    else pill = make("span", "pill off", "offline");
    state.append(pill);
    $("s-players").textContent = s.online ? nf.format(s.players || 0) + " / " + nf.format(s.max || 0) : "0";
    $("s-pack").textContent = s.pack || "in Arbeit";
    const list = Array.isArray(s.names) ? s.names : [];
    if (s.online && list.length) for (const n of list) names.append(make("span", "", n));
    else if (s.online) names.append(make("span", "", "Gerade ist niemand drauf"));
  }

  function itemName(id) {
    const span = make("span");
    const icon = N.icons[id];
    if (icon) {
      const img = make("img");
      img.src = "img/items/" + icon + ".png";
      img.alt = "";
      img.width = 24;
      img.height = 24;
      span.append(img, " ");
      span.style.display = "inline-flex";
      span.style.alignItems = "center";
      span.style.gap = "0.5rem";
    }
    span.append(N.item({ item: id }));
    return span;
  }

  function ago(at) {
    const s = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (s < 60) return "gerade eben";
    const m = Math.round(s / 60);
    if (m < 60) return m === 1 ? "vor einer Minute" : "vor " + m + " Minuten";
    const h = Math.round(m / 60);
    if (h < 24) return h === 1 ? "vor einer Stunde" : "vor " + h + " Stunden";
    const d = Math.round(h / 24);
    return d === 1 ? "gestern" : "vor " + d + " Tagen";
  }

  function goalCard(g) {
    const meta = N.stages[g.id] || {};
    const card = make("article", "goalcard s" + (meta.n || 1) + " " + g.state);
    const h = make("h3");
    h.append(make("span", "", (meta.n ? "Stufe " + meta.n + ": " : "") + (meta.stage || "")));
    const pillCls = { active: "on", held: "hold", done: "on", locked: "", planned: "" }[g.state] || "";
    h.append(make("span", "pill " + pillCls, N.states[g.state] || g.state));
    card.append(h);
    const mob = N.mobs[g.id];
    if (mob) {
      const img = make("img", "mob mob-" + mob);
      img.src = "img/mascots/" + mob + ".webp";
      img.alt = "";
      img.loading = "lazy";
      card.append(img);
    }
    const live = g.state === "active" || g.state === "held" || g.state === "done";
    card.append(make("p", "theme", N.goal(g) + (live ? ", " + g.percent + " Prozent" : "")));
    if (live) {
      const bar = make("div", "bigbar");
      const fill = make("span");
      fill.style.width = "0%";
      requestAnimationFrame(() => { fill.style.width = Math.max(0, Math.min(100, g.percent)) + "%"; });
      bar.append(fill);
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuenow", g.percent);
      bar.setAttribute("aria-valuemin", 0);
      bar.setAttribute("aria-valuemax", 100);
      card.append(bar);
    }
    const pillars = make("div", "pillars");
    let planned = false;
    for (const p of g.pillars || []) {
      const box = make("div", "pillar " + (p.title || "").toLowerCase());
      box.append(make("p", "pillar-name", N.pillar(p.title)));
      for (const it of p.items || []) {
        let target = it.target;
        if (!target) { target = N.base[it.item] || 0; planned = true; }
        const row = make("p", "row");
        const amount = make("span", "", live ? nf.format(it.have) + " / " + nf.format(target) : nf.format(target));
        if (!live && N.fixed.includes(it.item)) amount.append(" ", make("small", "fixed", "fest"));
        row.append(itemName(it.item), amount);
        box.append(row);
        if (live) {
          const meter = make("div", "meter");
          const fill = make("span");
          fill.style.width = Math.min(100, target ? (100 * it.have) / target : 0).toFixed(1) + "%";
          meter.append(fill);
          box.append(meter);
        }
      }
      pillars.append(box);
    }
    card.append(pillars);
    if (g.state === "held") {
      card.append(make("p", "hint", "Der Obelisk hält bei 98 Prozent. Der Rest kommt beim gemeinsamen Event rein, den Termin gibt es auf dem Discord."));
    }
    if (planned && !live) {
      card.append(make("p", "note", "Geplante Mengen für 30 Spieler. Beim Öffnen der Stufe passt der Server sie an die echte Spielerzahl an."));
    }
    if (Array.isArray(g.recent) && g.recent.length) {
      card.append(make("p", "recent-head", "Gerade abgegeben"));
      const list = make("ol", "recent");
      for (const r of g.recent.slice(0, 8)) {
        const li = make("li");
        li.append(make("span", "who", r.name), make("span", "what", nf.format(r.amount) + " " + N.item({ item: r.item, name: r.itemName })), make("span", "when", ago(r.at)));
        list.append(li);
      }
      card.append(list);
    }
    if (Array.isArray(g.top) && g.top.length) {
      const top = g.top.slice(0, 5).map((t, i) => (i + 1) + ". " + t.name + " (" + nf.format(t.amount) + ")");
      card.append(make("p", "top5", "Am meisten beigetragen: " + top.join(", ")));
    }
    return card;
  }

  function showGoals(goals) {
    const box = $("goals");
    box.textContent = "";
    if (!Array.isArray(goals) || !goals.length) {
      goals = N.planned.map((p) => ({ id: p.id, state: "planned", pillars: p.pillars.map((pl) => ({ title: pl.title, items: pl.items.map((i) => ({ item: i, have: 0, target: 0 })) })) }));
    }
    for (const g of goals) box.append(goalCard(g));
  }

  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

  // the obelisk's own line: which stage stands and whether the stone sleeps
  function showObelisk(season) {
    const el = $("obelisk-state");
    if (!el) return;
    el.textContent = "";
    if (!season || !season.running) return;
    const tier = season.tier || 0;
    const stage = tier === 0 ? "Noch steht keine Stufe." : "Stufe " + ROMAN[Math.min(tier, 6)] + " steht.";
    el.append(make("span", "pill " + (season.slumbering ? "hold" : "on"), season.slumbering ? "schläft" : "wach"), " " + stage
      + (season.slumbering ? " Seit einem Tag kam keine Gabe; die erste weckt den Stein." : ""));
  }

  async function load() {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      showServer(data.server, data.season);
      showObelisk(data.season);
      showGoals(data.goals);
    } catch (e) {
      showServer(null);
      showGoals(null);
    }
  }

  load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
