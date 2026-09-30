// The install guide: pick a launcher, see its steps. The download links point at the pack
// version the server runs now, so nobody installs one the server does not accept.

(function () {
  "use strict";

  const REL = "https://github.com/kronwerke/pack/releases";
  const buttons = document.querySelectorAll("[data-guide]");

  function show(id) {
    for (const g of document.querySelectorAll(".guide")) g.hidden = g.id !== "guide-" + id;
    for (const b of document.querySelectorAll("#launchers .choice")) b.setAttribute("aria-pressed", String(b.dataset.guide === id));
    history.replaceState(null, "", "#" + id);
  }

  for (const b of buttons) {
    b.addEventListener("click", () => {
      show(b.dataset.guide);
      const el = document.getElementById("guide-" + b.dataset.guide);
      if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  }
  const start = location.hash.slice(1);
  if (document.getElementById("guide-" + start)) show(start);

  function setVersion(v) {
    if (!/^\d+\.\d+\.\d+$/.test(v)) return;
    document.getElementById("packver").textContent = v;
    const base = REL + "/download/v" + v + "/Kronwerke.Season.2-" + v;
    for (const a of document.querySelectorAll("a.dl")) {
      a.href = base + (a.dataset.kind === "zip" ? ".zip" : ".mrpack");
      a.textContent = "Kronwerke Season 2 " + v + " (." + a.dataset.kind + ")";
    }
    document.getElementById("mrurl").textContent = base + ".mrpack";
  }

  fetch("/api/status", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => setVersion(d.server && d.server.pack))
    .catch(() => {});
})();
