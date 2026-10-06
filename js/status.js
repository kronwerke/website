// Live state from the bot: server online and players, and the active community goal.
// Until the API answers, the page shows what it says in the HTML.

(function () {
  "use strict";

  // the bot serves this page and the API from the same host
  const API = "/api/status";
  const statusEl = document.getElementById("status");
  const goalEl = document.getElementById("goal");
  const nf = { format: window.KW.fmt };

  function text(el, s) { el.textContent = s; return el; }
  function make(tag, cls, s) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (s !== undefined) el.textContent = s;
    return el;
  }

  function showServer(server, season) {
    if (statusEl && season && !season.running) {
      statusEl.textContent = "";
      statusEl.append(make("span", "dot wip"), inEn() ? "Work in progress: the team is building the server." : "Work in Progress: das Team baut gerade am Server.");
      return;
    }
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

  function inEn() {
    return document.documentElement.lang === "en";
  }

  // "vor 3 Minuten" from a time in milliseconds
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

  // the last deposits at the obelisk, newest first
  function recentList(g, n) {
    const list = make("ol", "recent");
    for (const r of (g.recent || []).slice(0, n)) {
      const li = make("li");
      const N = window.KW && window.KW.names;
      const item = N ? N.item({ item: r.item, name: r.itemName }) : r.itemName || r.item;
      li.append(make("span", "who", r.name), make("span", "what", nf.format(r.amount) + " " + item), make("span", "when", ago(r.at)));
      list.append(li);
    }
    return list;
  }

  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

  function showGoal(goals, season) {
    if (!goalEl || !Array.isArray(goals)) return;
    const g = goals.find((x) => x.state === "active" || x.state === "held");
    if (!g) return;
    // the season carries the obelisk's stage: completed goals, so the active one is the next
    const stage = season && season.tier >= 0 && ROMAN[season.tier + 1] ? ", Stufe " + ROMAN[season.tier + 1] : "";
    text(goalEl.querySelector(".label"), (g.state === "held" ? "Wartet auf das Event" : "Aktuelles Ziel") + stage);
    const N = window.KW && window.KW.names;
    text(document.getElementById("goal-title"), N ? N.goal(g) : g.title);
    const box = document.getElementById("goal-pillars");
    box.textContent = "";
    for (const p of g.pillars || []) {
      const pillar = make("div", "pillar");
      pillar.append(make("p", "pillar-name", N ? N.pillar(p.title) : p.title));
      for (const it of p.items || []) {
        const row = make("p", "row");
        row.append(make("span", "", N ? N.item(it) : it.name || it.item), make("span", "", nf.format(it.have) + " / " + nf.format(it.target)));
        const meter = make("div", "meter");
        const fill = make("span");
        const w = Math.min(100, it.target ? (100 * it.have) / it.target : 0).toFixed(1) + "%";
        fill.style.width = "0%";
        requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = w; }));
        meter.append(fill);
        pillar.append(row, meter);
      }
      box.append(pillar);
    }
    const old = goalEl.querySelector(".recent-box");
    if (old) old.remove();
    if (Array.isArray(g.recent) && g.recent.length) {
      const wrap = make("div", "recent-box");
      wrap.append(make("p", "label", "Gerade abgegeben"), recentList(g, 5));
      box.after(wrap);
    }
    const note = document.getElementById("goal-note");
    if (note) {
      note.textContent = g.state === "held"
        ? "Der Obelisk hält bei 98 Prozent. Der Rest kommt beim gemeinsamen Event rein, den Termin gibt es auf dem Discord."
        : "Insgesamt " + g.percent + " Prozent. Bei 98 Prozent hält der Obelisk an, der Rest kommt beim gemeinsamen Event rein.";
      if (season && season.slumbering) note.textContent += " Der Obelisk schläft gerade: seit einem Tag kam keine Gabe. Die erste weckt ihn.";
    }
  }

  async function load() {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      showServer(data.server, data.season);
      showGoal(data.goals, data.season);
    } catch (e) {
      // not live yet, or offline: keep the text from the page
    }
  }

  // after the page has loaded, so the first paint does not wait for the server
  if (document.readyState === "complete") load();
  else window.addEventListener("load", load, { once: true });
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
