// Who of the Kronwerke streamers is live right now, from the Twitch bot. The section
// stays hidden while nobody is, and when the bot cannot be reached.

(function () {
  "use strict";
  const box = document.getElementById("live-now");
  const list = document.getElementById("streams");
  if (!box || !list) return;
  const api = "https://ttv.kronwerke.com/api/live";

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function since(t) {
    const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000));
    if (!isFinite(m) || m > 100000) return "";
    return m < 60 ? "seit " + m + " Min." : "seit " + Math.floor(m / 60) + " Std.";
  }

  function render(live) {
    list.textContent = "";
    for (const s of live.slice(0, 6)) {
      const a = el("a", "stream");
      a.href = s.url;
      a.rel = "noopener";
      a.target = "_blank";
      const shot = el("div", "shot");
      const img = el("img");
      img.src = s.thumbnail + (s.thumbnail.includes("?") ? "&" : "?") + "t=" + Math.floor(Date.now() / 300000);
      img.alt = "";
      img.loading = "lazy";
      img.width = 640;
      img.height = 360;
      shot.append(img, el("span", "viewers", s.viewers.toLocaleString("de-DE") + " Zuschauer"));
      const who = el("p", "who");
      if (s.image) {
        const face = el("img", "face");
        face.src = s.image;
        face.alt = "";
        face.width = 28;
        face.height = 28;
        who.append(face);
      }
      who.append(el("strong", "", s.name));
      const meta = [s.game, since(s.started_at)].filter(Boolean).join(" · ");
      a.append(shot, who, el("p", "title", s.title), el("p", "meta", meta));
      list.append(a);
    }
    box.hidden = live.length === 0;
  }

  async function load() {
    try {
      const r = await fetch(api, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      render(data.live || []);
    } catch (e) {
      box.hidden = true;
    }
  }

  load();
  setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
