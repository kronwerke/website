// Live state from the bot: server online and players, and the active community goal.
// Until the API answers, the page shows what it says in the HTML.

(function () {
  "use strict";

  // the bot serves this page and the API from the same host
  const API = "/api/status";
  const statusEl = document.getElementById("status");
  const goalEl = document.getElementById("goal");
  const nf = new Intl.NumberFormat("de-DE");

  function text(el, s) { el.textContent = s; return el; }
  function make(tag, cls, s) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (s !== undefined) el.textContent = s;
    return el;
  }

  function showServer(server) {
    // before the season the bot has no server to ask; keep the page's own line then
    if (!statusEl || !server || (!server.online && !server.state)) return;
    statusEl.textContent = "";
    const dot = make("span", server.online ? "dot on" : "dot");
    statusEl.append(dot);
    if (server.online) {
      const who = server.players === 1 ? "1 Spieler" : nf.format(server.players || 0) + " Spieler";
      statusEl.append("Server online, " + who + " gerade drauf.");
    } else {
      statusEl.append("Server gerade offline.");
    }
  }

  function showGoal(goals) {
    if (!goalEl || !Array.isArray(goals)) return;
    const g = goals.find((x) => x.state === "active" || x.state === "held");
    if (!g) return;
    text(goalEl.querySelector(".label"), g.state === "held" ? "Wartet auf das Event" : "Aktuelles Ziel");
    text(document.getElementById("goal-title"), g.title);
    const box = document.getElementById("goal-pillars");
    box.textContent = "";
    for (const p of g.pillars || []) {
      const pillar = make("div", "pillar");
      pillar.append(make("p", "pillar-name", p.title));
      for (const it of p.items || []) {
        const row = make("p", "row");
        row.append(make("span", "", it.name || it.item), make("span", "", nf.format(it.have) + " / " + nf.format(it.target)));
        const meter = make("div", "meter");
        const fill = make("span");
        fill.style.width = Math.min(100, it.target ? (100 * it.have) / it.target : 0).toFixed(1) + "%";
        meter.append(fill);
        pillar.append(row, meter);
      }
      box.append(pillar);
    }
    const note = document.getElementById("goal-note");
    if (note) {
      note.textContent = g.state === "held"
        ? "Der Obelisk hält bei 98 Prozent. Der Rest kommt beim gemeinsamen Event rein, den Termin gibt es auf dem Discord."
        : "Insgesamt " + g.percent + " Prozent. Bei 98 Prozent hält der Obelisk an, der Rest kommt beim gemeinsamen Event rein.";
    }
  }

  async function load() {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      showServer(data.server);
      showGoal(data.goals);
    } catch (e) {
      // not live yet, or offline: keep the text from the page
    }
  }

  load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
