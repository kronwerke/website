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

  // ---- the season strip: the current phase lights up by date
  const season = document.querySelector(".season");
  if (season) {
    const now = Date.now();
    const phase = now >= Date.parse("2027-01-16T18:00:00+01:00") ? 2 : now >= Date.parse("2026-12-01T00:00:00+01:00") ? 1 : 0;
    const items = season.querySelectorAll("li");
    items.forEach((li, i) => li.classList.toggle("now", i === phase));
    const here = season.querySelector(".here");
    if (here && items[phase] && here.parentElement !== items[phase]) items[phase].prepend(here);
  }

  // ---- how far away the start is
  // every script of a page shares one answer of /api/status; after five seconds it is asked again
  function statusOnce() {
    const w = window, now = Date.now();
    if (!w.kwStatus || now - w.kwStatus.at > 5000) {
      w.kwStatus = { at: now, p: fetch("/api/status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null) };
    }
    return w.kwStatus.p;
  }
  const cd = document.getElementById("countdown");
  if (cd) {
    // the planned start; the server's own (Kronwerke Core's seasonStart, through the bot) wins
    let start = Date.parse("2027-01-16T18:00:00+01:00");
    statusOnce()
      .then((d) => {
        const v = d && d.season && d.season.start;
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v || "")) return;
        // German time: CET in winter, CEST from the end of March to the end of October
        const m = Number(v.slice(5, 7));
        const t = Date.parse(v + ":00" + (m >= 4 && m <= 10 ? "+02:00" : "+01:00"));
        if (!isNaN(t)) { start = t; tick(); }
      })
      .catch(() => {});
    const tick = () => {
      const left = start - Date.now();
      const days = Math.floor(left / 86400000);
      const hours = Math.floor((left % 86400000) / 3600000);
      if (left <= 0) cd.textContent = left > -86400000 ? "Es geht los." : "";
      else if (days >= 2) cd.textContent = "Noch " + days + " Tage.";
      else if (days === 1) cd.textContent = "Morgen um 18 Uhr.";
      else cd.textContent = "Noch " + hours + " Stunden.";
    };
    tick();
    setInterval(tick, 60000);
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

  // ---- the overlay preview is the real thing at 1920 by 1080, scaled to the box it sits in
  const demo = document.querySelector(".demo");
  if (demo) {
    const fit = () => demo.style.setProperty("--k", (demo.clientWidth / 1920).toFixed(4));
    fit();
    let t = 0;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fit, 200); });
  }

  // ---- how many people are in the Discord right now, from Discord's widget
  const dc = document.getElementById("dc-online");
  if (dc) {
    fetch("https://discord.com/api/guilds/1473242451098472482/widget.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d && d.presence_count;
        if (!n) return;
        dc.textContent = n === 1 ? "Gerade ist eine Person im Discord online." : "Gerade sind " + n + " Leute im Discord online.";
        dc.hidden = false;
      })
      .catch(() => {});
  }

  // ---- the pill in the header: what the server does right now
  const live = document.getElementById("live");
  if (live) {
    const label = live.querySelector("span:not(.dot)");
    const nf = { format: (n) => inEn ? new Intl.NumberFormat("en").format(n) : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f") };
    statusOnce()
      .then((d) => {
        const s = d && d.server;
        if (d && d.season && !d.season.running) {
          // before the season the team builds on the server; no player count then
          live.classList.add("wip");
          label.textContent = "Work in Progress";
          return;
        }
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

  // ---- signed in with Minecraft (kronwerke.com/anmelden): a small head in the header, and
  // on the start page whether the account is on the whitelist
  const top = document.querySelector(".top");
  if (top && !document.querySelector(".top .who")) {
    const who = document.createElement("a");
    who.className = "who";
    who.href = (inEn ? "../" : "") + "anmelden";
    who.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><span>' + (inEn ? "Sign in" : "Anmelden") + "</span>";
    const btn = top.querySelector(".btn");
    top.insertBefore(who, btn);
    fetch((inEn ? "../" : "") + "api/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!me || !me.name) return;
        window.KW = window.KW || {};
        window.KW.me = me;
        who.classList.add("in");
        who.title = me.name;
        who.innerHTML = '<img alt="" width="24" height="24" src="' + (inEn ? "../" : "") + "whitelist/head/" + encodeURIComponent(me.name) + '"><span></span>';
        who.querySelector("span").textContent = me.name;
        const wl = document.getElementById("me-wl");
        if (wl) {
          const w = me.whitelist || {};
          wl.hidden = false;
          wl.classList.toggle("on", !!w.on);
          let t;
          if (w.on && w.by) t = (inEn ? "You are on the whitelist, on " : "Du bist auf der Whitelist, über den Platz von ") + w.by + ".";
          else if (w.on) t = inEn ? "You are on the whitelist." : "Du bist auf der Whitelist.";
          else t = inEn ? "Not on the whitelist yet. A streamer or your community gives you a place, ask in the Discord." : "Noch nicht auf der Whitelist. Einen Platz gibt dir ein Streamer oder deine Community, frag im Discord.";
          wl.querySelector("span").textContent = t;
          if (!me.discord) {
            const a = document.createElement("a");
            a.href = (inEn ? "../" : "") + "anmelden";
            a.textContent = inEn ? "Link Discord" : "Discord verknüpfen";
            wl.querySelector("span").append(" ", a);
          }
          wl.querySelector("b").textContent = me.name;
          wl.querySelector("img").src = (inEn ? "../" : "") + "whitelist/head/" + encodeURIComponent(me.name);
        }
      })
      .catch(() => {});
  }

  // ---- a visitor on the footer's line: another mob of the pack on every page view --------
  // the heights are in blocks, so a fox stays a fox next to an iron golem
  const VISITORS = { cat: 0.7, cat_black: 0.7, cat_b: 0.7, fox: 0.7, fox_snow: 0.7, axolotl: 0.5, axolotl_blue: 0.5, frog: 0.55, frog_green: 0.55,
    bee: 0.65, chicken: 0.75, rabbit: 0.55, parrot: 0.95, parrot_blue: 0.95, parrot_cyan: 0.95, turtle: 0.45, armadillo: 0.7, allay: 0.95,
    starbuncle: 0.75, robit: 0.95, owl: 0.8, crow: 0.5, sniffer: 1.75, camel: 2.4, panda: 1.25, goat: 1.3, sheep: 1.3, sheep_pink: 1.3,
    pig: 0.9, cow: 1.4, mooshroom: 1.4, snow_golem: 1.9, iron_golem: 2.7, villager_cleric: 1.95, villager_cartographer: 1.95,
    villager_mason: 1.95, villager_armorer: 1.95, witch: 2.3, wandering_trader: 1.95, llama: 1.87, creeper: 1.7, enderman: 2.9,
    skeleton: 2, strider: 1.7, slime: 1.05, slime_small: 0.52, piglin: 1.95, drygmy: 1, whirlisprig: 0.9, wixie: 1, mimic: 1,
    moa: 2.1, aerbunny: 0.7, phyg: 0.9, flying_cow: 1.4, polar_bear: 1.4, wolf: 0.85, wolf_spotted: 0.85, horse: 1.6, donkey: 1.5,
    glow_squid: 0.9, dolphin: 0.6 };
  const foot = document.querySelector("footer.bottom");
  if (foot) {
    const names = Object.keys(VISITORS);
    const box = document.createElement("button");
    box.type = "button";
    box.className = "scene visitor";
    box.setAttribute("aria-label", inEn ? "Another visitor" : "Anderer Besuch");
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.onload = () => { img.width = img.naturalWidth; img.height = img.naturalHeight; };
    let last = "";
    const pick = () => {
      let n;
      do { n = names[Math.floor(Math.random() * names.length)]; } while (n === last);
      last = n;
      img.style.setProperty("--h", VISITORS[n]);
      // the build writes a fingerprint of all pictures on <html>: the address then names one exact picture
      img.src = (inEn ? "../" : "") + "img/mobs/" + n + ".webp" + (document.documentElement.dataset.v ? "?v=" + document.documentElement.dataset.v : "");
    };
    pick();
    box.append(img);
    box.addEventListener("click", () => { box.classList.remove("hop"); void box.offsetWidth; box.classList.add("hop"); pick(); });
    foot.append(box);
  }
})();
