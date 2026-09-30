// A mob peeks in from the lower edge of the page and says one thing: a tip for the page
// you are on, or something about Kronwerke. Closing it keeps it away for this visit.

(function () {
  "use strict";

  const KEY = "kw-mascot-off";
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { /* no storage, show it anyway */ }

  const page = document.body.dataset.page || "start";
  const TIPS = {
    start: [
      'Neu hier? Unter <a href="installieren.html">Installieren</a> bist du in fünf Minuten im Spiel.',
      'Was in welcher Stufe offen ist, steht bei den <a href="stufen.html">Stufen</a>.',
    ],
    stufen: [
      "Stufen öffnen für alle zugleich. Allein schaltest du nichts frei, zusammen alles.",
      "Beide Säulen müssen voll werden. Wer nur Maschinen baut, wartet auf die Magier.",
      "Später dazugekommen? Die Starterkits der offenen Stufen gibt es im Questbuch.",
    ],
    mods: [
      "Tipp: Die Suche findet auch Wörter aus der Beschreibung, probier mal „ore“.",
      "Bibliotheken machen nichts Sichtbares, aber ohne sie läuft der Rest nicht.",
    ],
    installieren: [
      "Das Wichtigste: 8 GB Speicher für das Spiel. Mit 2 GB wird das nichts.",
      "Die Modrinth App ist am einfachsten, und sie ist kostenlos.",
    ],
    faq: [
      'Deine Frage fehlt? Frag auf dem <a href="https://discord.gg/DZs3XyyHDj">Discord</a>.',
    ],
    status: [
      "Alles, was am Obelisken abgegeben wird, zählt hier mit. Einmal pro Minute neu.",
      "Bei 98 Prozent hält der Obelisk an. Der Rest kommt beim Event rein, live.",
    ],
  };
  const ANY = [
    "Season 2 startet Mitte Januar 2027, die Beta im Dezember.",
    "Mit FTB Chunks schützt du dein Grundstück, einfach auf der Karte markieren.",
    "Voice Chat ist im Pack. Die Taste zum Sprechen stellst du im Menü ein.",
  ];

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const tips = (TIPS[page] || []).concat(ANY);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // it peeks in a moment after the page is there, and costs nothing before
  function show() {
    fetch("img/mascots/mascots.json")
      .then((r) => r.json())
      .then((mobs) => {
        if (!Array.isArray(mobs) || !mobs.length) return;
        const mob = pick(mobs);
        const side = Math.random() < 0.5 ? "left" : "right";
        const box = document.createElement("aside");
        box.className = "mascot " + side;
        box.setAttribute("aria-label", "Tipp");

        const img = new Image();
        img.src = "img/mascots/" + mob.file;
        img.alt = "";
        img.width = mob.w;
        img.height = mob.h;
        // look into the page: a mob drawn facing left stands on the left edge mirrored
        if (mob.facing === side) img.className = "flip";

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        const p = document.createElement("p");
        p.style.margin = "0";
        p.innerHTML = pick(tips);
        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Schließen");
        close.textContent = "×";
        const leave = () => {
          box.classList.remove("show");
          setTimeout(() => box.remove(), reduced ? 0 : 700);
        };
        close.addEventListener("click", () => {
          try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* fine */ }
          leave();
        });
        bubble.append(p, close);
        box.append(img, bubble);

        img.addEventListener("load", () => {
          document.body.append(box);
          setTimeout(() => box.classList.add("show"), reduced ? 0 : 2500);
          // it says its thing and goes, so it never sits on the page for good
          setTimeout(leave, 20000);
        });
      })
      .catch(() => {});
  }
  function later() { setTimeout(show, 1500); }
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
})();
