// Origins: a card opens its powers, the three questions point at one origin and one role.

(function () {
  "use strict";

  const cards = [...document.querySelectorAll("#origins .origin")];
  function openCard(c, on) {
    const d = document.getElementById(c.getAttribute("aria-controls"));
    c.setAttribute("aria-expanded", String(on));
    d.hidden = !on;
  }
  for (const c of cards) {
    c.addEventListener("click", () => {
      const on = c.getAttribute("aria-expanded") !== "true";
      for (const o of cards) openCard(o, false);
      openCard(c, on);
      if (on) history.replaceState(null, "", "#" + c.dataset.id);
    });
  }
  const start = location.hash.slice(1);
  const first = cards.find((c) => c.dataset.id === start);
  if (first) openCard(first, true);

  // ---- which one fits: every answer gives points, the highest wins
  const form = document.getElementById("quiz-form");
  const out = document.getElementById("quiz-out");
  const NAMES = {
    kronbuerger: "Kronbürger", muehlenkind: "Mühlenkind", tiefgraeber: "Tiefgräber", messingblut: "Messingblut", aurakind: "Aurakind",
    quellgeborene: "Quellgeborene", runentraeger: "Runenträger", sternensplitter: "Sternensplitter", chaosgezeichnete: "Chaosgezeichnete",
    ingenieur: "Ingenieur", arkanist: "Arkanist", baumeister: "Baumeister", entdecker: "Entdecker", hueter: "Hüter", versorger: "Versorger", haendler: "Händler",
  };
  const IMPACT = { kronbuerger: 1, muehlenkind: 1, tiefgraeber: 2, messingblut: 2, aurakind: 2, quellgeborene: 2, runentraeger: 2, sternensplitter: 3, chaosgezeichnete: 3 };
  const DO = {
    build: { o: { kronbuerger: 2, muehlenkind: 2, tiefgraeber: 1 }, r: "baumeister" },
    tech: { o: { messingblut: 3, muehlenkind: 1, tiefgraeber: 1 }, r: "ingenieur" },
    magic: { o: { quellgeborene: 3, aurakind: 2 }, r: "arkanist" },
    fight: { o: { chaosgezeichnete: 3, runentraeger: 2 }, r: "hueter" },
    explore: { o: { sternensplitter: 3, aurakind: 1, kronbuerger: 1 }, r: "entdecker" },
    mine: { o: { tiefgraeber: 3, muehlenkind: 1 }, r: "baumeister" },
  };
  const WHY = {
    kronbuerger: "nichts zu managen, und Regeneration, sobald jemand bei dir ist",
    muehlenkind: "Wasser ist dein Element, und Stufe 1 spielt am Fluss",
    tiefgraeber: "unter Tage schnell und mit Nachtsicht, dafür scheust du den Tag",
    messingblut: "der Nether tut dir weniger weh, und Messing ist das Ziel von Stufe 2",
    aurakind: "heilt im Wald, hat Glück, und braucht Freunde im Nether",
    quellgeborene: "mehr Mana für beide Zaubersysteme, dafür weniger Herzen",
    runentraeger: "Rüstung und Magieschutz für die Bosskämpfe, dafür langsamer",
    sternensplitter: "der Sternensprung bringt dich überall hin, für zwei Herzen",
    chaosgezeichnete: "mehr Schaden und Heilung im Kampf, danach heilst du langsam",
  };
  function judge() {
    const f = new FormData(form);
    const d = f.get("do"), care = f.get("care"), who = f.get("who");
    if (!d || !care || !who) return;
    const score = {};
    for (const k in IMPACT) score[k] = 0;
    for (const [k, v] of Object.entries(DO[d].o)) score[k] += v;
    const want = { low: 1, mid: 2, high: 3 }[care];
    for (const k in IMPACT) score[k] -= Math.abs(IMPACT[k] - want) * 1.5;
    if (who === "group") { score.kronbuerger += 1.5; score.aurakind += 0.5; }
    if (who === "solo") { score.kronbuerger -= 1; score.aurakind -= 1; score.chaosgezeichnete -= 0.5; }
    const best = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const o = best[0][0], alt = best[1][0];
    let role = DO[d].r;
    if (who === "group" && d === "build") role = "versorger";
    out.innerHTML = "Zu dir passt <b>" + NAMES[o] + "</b>: " + WHY[o] + ". Als Rolle <b>" + NAMES[role] + "</b>. Zweite Wahl: " + NAMES[alt] + ".";
    out.hidden = false;
    for (const c of cards) c.classList.toggle("hit", c.dataset.id === o);
    const hit = cards.find((c) => c.dataset.id === o);
    if (hit) { for (const c of cards) openCard(c, false); openCard(hit, true); }
  }
  form.addEventListener("change", judge);
})();
