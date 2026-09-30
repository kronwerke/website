// The questions page: the search box narrows the questions as you type, a question opened
// by a link in the address opens on arrival, and only one question per group stays open.

(function () {
  "use strict";

  const q = document.getElementById("faq-q");
  const groups = [...document.querySelectorAll(".faq-group")];
  const empty = document.getElementById("faq-empty");
  const all = [...document.querySelectorAll("details")];
  const texts = new Map(all.map((d) => [d, d.textContent.toLowerCase()]));

  function render() {
    const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let any = false;
    for (const g of groups) {
      let shown = 0;
      for (const d of g.querySelectorAll("details")) {
        const hit = words.every((w) => texts.get(d).includes(w));
        d.hidden = !hit;
        if (hit) shown++;
        if (hit && words.length) d.open = true;
      }
      g.hidden = shown === 0;
      any = any || shown > 0;
    }
    empty.hidden = any;
  }
  q.addEventListener("input", render);
  const start = new URLSearchParams(location.search).get("q");
  if (start) { q.value = start; render(); }

  // a link to a question opens it
  function openHash() {
    const d = location.hash && document.getElementById(location.hash.slice(1));
    if (d && d.tagName === "DETAILS") d.open = true;
  }
  openHash();
  window.addEventListener("hashchange", openHash);

  // opening one closes the others in its group, unless a search is on
  for (const d of all) {
    d.addEventListener("toggle", () => {
      if (!d.open || q.value.trim()) return;
      for (const o of d.parentElement.querySelectorAll("details[open]")) if (o !== d) o.open = false;
      history.replaceState(null, "", "#" + d.id);
    });
  }
})();
