// What every page shares: the live pill in the header, copy buttons, the countdown, the
// letters of the name, the sky that follows the pointer, sections that come in when
// scrolled to, and the rail that follows the reading position.

(function () {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const inEn = document.documentElement.lang === "en";

  // ---- the name: every letter on its own, so it can be poked
  const name = document.getElementById("name");
  if (name && !reduced) {
    const text = name.textContent;
    name.textContent = "";
    for (const ch of text) {
      const s = document.createElement("span");
      s.className = "l";
      s.textContent = ch;
      name.append(s);
    }
    name.setAttribute("aria-label", text);
  }

  // ---- the sky moves a little with the pointer, the page stays where it is
  if (!reduced && matchMedia("(pointer: fine)").matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const step = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      root.style.setProperty("--px", cx.toFixed(2) + "px");
      root.style.setProperty("--py", cy.toFixed(2) + "px");
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(step) : 0;
    };
    window.addEventListener("pointermove", (e) => {
      tx = (e.clientX / innerWidth - 0.5) * -22;
      ty = (e.clientY / innerHeight - 0.5) * -14;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
  }

  // ---- copy buttons: a command, an address
  for (const b of document.querySelectorAll(".copy[data-copy]")) {
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        b.classList.add("did");
        setTimeout(() => b.classList.remove("did"), 1400);
      } catch (e) {
        // no clipboard: select the text so it can be copied by hand
        const r = document.createRange();
        r.selectNodeContents(b);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      }
    });
  }

  // ---- how far away the start is, in rough terms because the day is not fixed yet
  const cd = document.getElementById("countdown");
  if (cd) {
    const start = new Date("2027-01-15T18:00:00+01:00");
    const days = Math.round((start - Date.now()) / 86400000);
    if (days > 60) cd.textContent = "Noch etwa " + Math.round(days / 7) + " Wochen.";
    else if (days > 1) cd.textContent = "Noch etwa " + days + " Tage.";
    else if (days >= -1) cd.textContent = "Es geht los.";
    else cd.textContent = "";
  }

  // ---- sections come in when they arrive on screen
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add("rv"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -12% 0px" }) : null;
  for (const s of document.querySelectorAll(".band, .sec, .intro")) {
    if (io) io.observe(s); else s.classList.add("rv");
  }

  // ---- the rail on long pages follows the section being read
  const rail = document.querySelector(".rail");
  if (rail && "IntersectionObserver" in window) {
    const links = [...rail.querySelectorAll("a[href^='#']")];
    const secs = links.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    let current = null;
    const spy = new IntersectionObserver(() => {
      // the section whose top is closest above the reading line wins
      const line = innerHeight * 0.3;
      let best = null, bestTop = -Infinity;
      for (const s of secs) {
        const top = s.getBoundingClientRect().top;
        if (top <= line && top > bestTop) { best = s; bestTop = top; }
      }
      if (!best) best = secs[0];
      if (best === current) return;
      current = best;
      for (const a of links) a.classList.toggle("is", a.getAttribute("href") === "#" + best.id);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    for (const s of secs) spy.observe(s);
  }

  // ---- mobs can be poked on touch screens, where there is no hover
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img[class*='mob-']");
    if (!img || e.target.closest("a, button")) return;
    img.classList.add("poke");
    setTimeout(() => img.classList.remove("poke"), 1500);
  });

  // ---- the pill in the header: what the server does right now
  const live = document.getElementById("live");
  if (live) {
    const label = live.querySelector("span:not(.dot)");
    const nf = { format: (n) => inEn ? new Intl.NumberFormat("en").format(n) : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f") };
    fetch((inEn ? "../" : "") + "api/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s = d && d.server;
        if (!s || (!s.online && !s.state)) return;
        if (s.online) {
          live.classList.add("on");
          const n = s.players || 0;
          label.textContent = inEn ? "Online, " + nf.format(n) + (n === 1 ? " player" : " players") : "Online, " + nf.format(n) + " Spieler";
        } else if (s.state === "starting") {
          label.textContent = inEn ? "Starting" : "Startet gerade";
        } else {
          live.classList.add("off");
          label.textContent = inEn ? "Offline" : "Gerade offline";
        }
      })
      .catch(() => {});
  }
})();
