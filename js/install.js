// The install guide: pick a launcher, tick off its steps. The steps stay ticked in this
// browser, the mob next to them says something to each one, and the download links point
// at the pack version the server runs now, so nobody installs one it does not accept.

(function () {
  "use strict";

  const REL = "https://github.com/kronwerke/pack/releases";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY = "kw-install";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { saved = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* fine */ } }

  function show(id, scroll) {
    for (const g of document.querySelectorAll(".guide")) g.hidden = g.id !== "guide-" + id;
    for (const b of document.querySelectorAll("#launchers .choice")) b.setAttribute("aria-pressed", String(b.dataset.guide === id));
    history.replaceState(null, "", "#" + id);
    const el = document.getElementById("guide-" + id);
    if (el && scroll) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }
  for (const b of document.querySelectorAll("[data-guide]")) {
    b.addEventListener("click", () => show(b.dataset.guide, true));
  }

  // each guide: its checklist, its progress bar, its mob
  for (const g of document.querySelectorAll(".guide")) {
    const id = g.id.replace("guide-", "");
    const boxes = [...g.querySelectorAll(".check input")];
    const items = [...g.querySelectorAll(".check li")];
    const fill = g.querySelector(".progress .bar span");
    const txt = g.querySelector(".progress .txt");
    const mob = g.querySelector(".guide-mob");
    const bubble = mob.querySelector(".bubble");
    let tips = [];
    try { tips = JSON.parse(mob.querySelector("img").dataset.tips || "[]"); } catch (e) { tips = []; }
    const state = saved[id] || [];
    boxes.forEach((b, i) => { b.checked = !!state[i]; });

    function update() {
      const done = boxes.filter((b) => b.checked).length;
      fill.style.width = (100 * done / boxes.length).toFixed(0) + "%";
      txt.textContent = done + " von " + boxes.length + " Schritten";
      // the next open step is the current one; the mob talks about it
      const next = boxes.findIndex((b) => !b.checked);
      items.forEach((li, i) => li.classList.toggle("is", i === next));
      mob.classList.toggle("done", next === -1);
      bubble.textContent = next === -1 ? "Alles erledigt. Bis Mitte Januar auf dem Server." : (tips[next] || "");
      saved[id] = boxes.map((b) => b.checked);
      save();
    }
    for (const b of boxes) b.addEventListener("change", update);
    update();
  }

  const start = location.hash.slice(1);
  if (document.getElementById("guide-" + start)) show(start, false);

  // ---- the memory helper: what to give the game, from what the PC has
  const ram = document.getElementById("ram");
  if (ram) {
    const val = document.getElementById("ram-val");
    const out = document.getElementById("ram-out");
    const tell = () => {
      const gb = Number(ram.value);
      val.textContent = gb + " GB";
      let give, why;
      if (gb <= 8) { give = "6 GB"; why = "Das ist knapp. Das Pack läuft, aber schließ alles andere, auch den Browser. Mit 6 GB kann es beim Laden lange dauern."; }
      else if (gb <= 16) { give = "8 GB"; why = "Der Normalfall. Reicht für das Pack und einen Browser mit dem Stream nebenbei."; }
      else if (gb <= 24) { give = "10 GB"; why = "Etwas Luft nach oben, mehr bringt nichts. Zu viel Speicher macht Java sogar langsamer, weil das Aufräumen länger dauert."; }
      else { give = "10 bis 12 GB"; why = "Mehr als 12 GB bringen nichts, egal wie viel dein PC hat. Der Rest darf für OBS und den Browser bleiben."; }
      out.innerHTML = "Gib dem Spiel <b>" + give + "</b>. " + why;
    };
    ram.addEventListener("input", tell);
    tell();
  }

  // ---- the pack version the server runs, and download links to exactly that
  function setVersion(v) {
    if (!/^\d+\.\d+\.\d+$/.test(v)) return;
    document.getElementById("packver").textContent = v;
    const base = REL + "/download/v" + v + "/Kronwerke.Season.2-" + v;
    for (const a of document.querySelectorAll("a.dl")) {
      a.href = base + (a.dataset.kind === "zip" ? ".zip" : ".mrpack");
      a.textContent = "Kronwerke Season 2 " + v + " (." + a.dataset.kind + ")";
    }
    const mr = document.getElementById("mrurl");
    if (mr) {
      mr.dataset.copy = base + ".mrpack";
      mr.firstChild.textContent = base + ".mrpack";
    }
  }
  fetch("/api/status", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => setVersion(d.server && d.server.pack))
    .catch(() => {});
})();
