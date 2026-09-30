// The status page: server state, who is online, and every community goal with its pillars.

(function () {
  "use strict";

  const API = "/api/status";
  const N = window.KW.names;
  const nf = new Intl.NumberFormat("de-DE");
  const $ = (id) => document.getElementById(id);

  function make(tag, cls, s) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (s !== undefined) el.textContent = s;
    return el;
  }

  function showServer(s) {
    if (!s) return;
    const state = $("s-state");
    state.textContent = "";
    let pill;
    if (s.online) pill = make("span", "pill on", "online");
    else if (s.state === "starting") pill = make("span", "pill hold", "startet");
    else pill = make("span", "pill off", "offline");
    state.append(pill);
    $("s-players").textContent = s.online ? nf.format(s.players || 0) + " / " + nf.format(s.max || 0) : "-";
    $("s-pack").textContent = s.pack || "-";
    const names = Array.isArray(s.names) ? s.names : [];
    $("s-names").textContent = s.online ? (names.length ? "Gerade drauf: " + names.join(", ") : "Gerade ist niemand drauf.") : "";
  }

  function goalCard(g) {
    const meta = N.stages[g.id] || {};
    const card = make("article", "goalcard " + g.state);
    const h = make("h3");
    h.append(make("span", "", (meta.n ? "Stufe " + meta.n + ": " : "") + (meta.stage || "")));
    const pillCls = { active: "on", held: "hold", done: "on", locked: "" }[g.state] || "";
    h.append(make("span", "pill " + pillCls, N.states[g.state] || g.state));
    card.append(h);
    card.append(make("p", "theme", N.goal(g) + (g.state === "locked" ? "" : ", " + g.percent + " Prozent")));
    if (g.state !== "locked") {
      const bar = make("div", "bigbar");
      const fill = make("span");
      fill.style.width = Math.max(0, Math.min(100, g.percent)) + "%";
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
      const box = make("div", "pillar");
      box.append(make("p", "pillar-name", N.pillar(p.title)));
      for (const it of p.items || []) {
        let target = it.target;
        if (!target) { target = N.base[it.item] || 0; planned = true; }
        const row = make("p", "row");
        const amount = g.state === "locked" ? nf.format(target) : nf.format(it.have) + " / " + nf.format(target);
        row.append(make("span", "", N.item(it)), make("span", "", amount));
        box.append(row);
        if (g.state !== "locked") {
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
    if (planned && g.state === "locked") {
      card.append(make("p", "note", "Geplante Mengen für 30 Spieler. Beim Öffnen der Stufe passt der Server sie an die echte Spielerzahl an."));
    }
    if (Array.isArray(g.top) && g.top.length) {
      const top = g.top.slice(0, 5).map((t, i) => (i + 1) + ". " + t.name + " (" + nf.format(t.amount) + ")");
      card.append(make("p", "top5", "Am meisten beigetragen: " + top.join(", ")));
    }
    return card;
  }

  function showGoals(goals) {
    if (!Array.isArray(goals) || !goals.length) return;
    const box = $("goals");
    box.textContent = "";
    for (const g of goals) box.append(goalCard(g));
  }

  async function load() {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      showServer(data.server);
      showGoals(data.goals);
    } catch (e) {
      $("s-state").textContent = "keine Antwort";
    }
  }

  load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
