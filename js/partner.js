// The Tavuru card: the glow follows the pointer, and on screens without hover the card
// wakes up when it scrolls into view, so touch visitors see the animation too.
(function () {
  "use strict";
  const cards = document.querySelectorAll(".tavuru");
  if (!cards.length) return;
  const hover = window.matchMedia("(hover: hover)").matches;
  for (const card of cards) {
    if (hover) {
      card.addEventListener("pointermove", function (e) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      });
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        for (const en of entries) en.target.classList.toggle("awake", en.isIntersecting);
      }, { threshold: 0.55 }).observe(card);
    }
  }
})();
