// The Tavuru card. Builds Elchi as a 3D figure from his skin (each body part a box of six
// faces cut from the 64 x 64 texture, like the game does), lets him jump out of the
// picture when the card wakes up, turns his head to the pointer and moves the scene a
// little with it. On screens without hover the card wakes up when it scrolls into view.
(function () {
  "use strict";
  const cards = document.querySelectorAll(".tavuru");
  if (!cards.length) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hover = window.matchMedia("(hover: hover)").matches;

  function face(box, S, tex, tw, th, w, h, fx, fy, fw, fh, tf) {
    const f = document.createElement("div");
    f.className = "face";
    f.style.width = fw * S + "px";
    f.style.height = fh * S + "px";
    f.style.left = (w - fw) / 2 * S + "px";
    f.style.top = (h - fh) / 2 * S + "px";
    f.style.backgroundImage = "url(" + tex + ")";
    f.style.backgroundSize = tw * S + "px " + th * S + "px";
    f.style.backgroundPosition = -fx * S + "px " + -fy * S + "px";
    f.style.transform = tf;
    box.appendChild(f);
  }
  // u, v: where the box starts in the texture; w, h, d: its size in texture pixels
  function box(S, tex, tw, th, u, v, w, h, d, grow) {
    const b = document.createElement("div");
    b.className = "box";
    b.style.width = w * S + "px";
    b.style.height = h * S + "px";
    b.style.left = -w / 2 * S + "px";
    const z = d / 2 * S, x = w / 2 * S, y = h / 2 * S;
    face(b, S, tex, tw, th, w, h, u + d, v + d, w, h, "translateZ(" + z + "px)");
    face(b, S, tex, tw, th, w, h, u + 2 * d + w, v + d, w, h, "rotateY(180deg) translateZ(" + z + "px)");
    face(b, S, tex, tw, th, w, h, u, v + d, d, h, "rotateY(-90deg) translateZ(" + x + "px)");
    face(b, S, tex, tw, th, w, h, u + d + w, v + d, d, h, "rotateY(90deg) translateZ(" + x + "px)");
    face(b, S, tex, tw, th, w, h, u + d, v, w, d, "rotateX(90deg) translateZ(" + y + "px)");
    face(b, S, tex, tw, th, w, h, u + d + w, v, w, d, "rotateX(-90deg) translateZ(" + y + "px)");
    if (grow) {
      b.style.transform = "scale3d(" + (w + 2 * grow) / w + "," + (h + 2 * grow) / h + "," + (d + 2 * grow) / d + ")";
      b.style.transformOrigin = "50% 50%";
    }
    return b;
  }

  function build(player) {
    const S = parseFloat(getComputedStyle(player).getPropertyValue("--s")) || 7;
    const skin = player.dataset.skin, cape = player.dataset.cape;
    const mc = player.querySelector(".mc");
    mc.textContent = "";
    const bob = document.createElement("div");
    bob.className = "part body-bob";
    // a part sits at its pivot (x, height above the feet, z); its boxes hang from there
    function part(into, cls, x, y, z, boxes, top) {
      const p = document.createElement("div");
      p.className = "part";
      p.style.transform = "translate3d(" + x * S + "px," + -y * S + "px," + z * S + "px)";
      const j = document.createElement("div");
      j.className = "part " + cls;
      for (const b of boxes) { b.style.top = (top || 0) * S + "px"; j.appendChild(b); }
      p.appendChild(j);
      into.appendChild(p);
      return j;
    }
    const T = [skin, 64, 64];
    part(mc, "leg-r", -2, 12, 0, [box(S, ...T, 0, 16, 4, 12, 4), box(S, ...T, 0, 32, 4, 12, 4, 0.25)]);
    part(mc, "leg-l", 2, 12, 0, [box(S, ...T, 16, 48, 4, 12, 4), box(S, ...T, 0, 48, 4, 12, 4, 0.25)]);
    mc.appendChild(bob);
    part(bob, "body", 0, 24, 0, [box(S, ...T, 16, 16, 8, 12, 4), box(S, ...T, 16, 32, 8, 12, 4, 0.25)]);
    part(bob, "arm-r", -5.5, 24, 0, [box(S, ...T, 40, 16, 3, 12, 4), box(S, ...T, 40, 32, 3, 12, 4, 0.25)]);
    part(bob, "arm-l", 5.5, 24, 0, [box(S, ...T, 32, 48, 3, 12, 4), box(S, ...T, 48, 48, 3, 12, 4, 0.25)]);
    player._head = part(bob, "head", 0, 24, 0, [box(S, ...T, 0, 0, 8, 8, 8), box(S, ...T, 32, 0, 8, 8, 8, 0.5)], -8);
    if (cape) {
      const c = part(bob, "cape-pivot", 0, 24, -2.6, [box(S, cape, 64, 32, 0, 0, 10, 16, 1)]);
      c.style.transform = "rotateY(180deg)";
      const swing = document.createElement("div");
      swing.className = "part cape";
      while (c.firstChild) swing.appendChild(c.firstChild);
      c.appendChild(swing);
    }
  }

  for (const card of cards) {
    const player = card.querySelector(".tv-player");
    const hop = card.querySelector(".tv-hop");
    const mc = card.querySelector(".mc");
    if (player) {
      build(player);
      let w = window.innerWidth;
      window.addEventListener("resize", function () {
        if ((w > 760) !== (window.innerWidth > 760)) build(player);
        w = window.innerWidth;
      });
    }
    function wake(on) {
      if (card.classList.contains("out") === on) return;
      card.classList.toggle("out", on);
      if (on) {
        for (const img of card.querySelectorAll("img[data-src]")) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
      }
      if (hop && !still) {
        hop.classList.remove("go");
        void hop.offsetWidth;
        hop.classList.add("go");
      }
    }
    if (hop) hop.addEventListener("animationend", function (e) { if (e.target === hop) hop.classList.remove("go"); });

    if (hover) {
      card.addEventListener("pointerenter", function () { wake(true); });
      card.addEventListener("pointerleave", function () {
        wake(false);
        card.style.setProperty("--px", 0); card.style.setProperty("--py", 0);
        if (mc) { mc.style.removeProperty("--ry"); mc.style.removeProperty("--rx"); }
        if (player && player._head) player._head.style.transform = "";
      });
      card.addEventListener("pointermove", function (e) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        if (!still) { card.style.setProperty("--px", px.toFixed(3)); card.style.setProperty("--py", py.toFixed(3)); }
        if (!player || !player._head || !card.classList.contains("out")) return;
        // the head looks at the pointer, the body turns a little after it
        const pr = player.getBoundingClientRect();
        const dx = (e.clientX - (pr.left + pr.width / 2)) / r.width;
        const dy = (e.clientY - (pr.top + pr.height * 0.12)) / r.height;
        const yaw = Math.max(-70, Math.min(70, dx * 140));
        const pitch = Math.max(-35, Math.min(35, -dy * 70));
        player._head.style.transform = "rotateY(" + (yaw * 0.6).toFixed(1) + "deg) rotateX(" + pitch.toFixed(1) + "deg)";
        mc.style.setProperty("--ry", (yaw * 0.4).toFixed(1) + "deg");
      });
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        for (const en of entries) wake(en.isIntersecting);
      }, { threshold: 0.6 }).observe(card);
    }
    card.addEventListener("focus", function () { wake(true); });
    card.addEventListener("blur", function () { wake(false); });
  }
})();
