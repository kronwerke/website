// kronwerke.com/anmelden: the code from auth.kronwerke.com signs the browser in (bot, /api/auth/code).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const back = new URLSearchParams(location.search).get("back");
  const safeBack = back && /^[a-z0-9/_#-]+$/i.test(back) ? back : null;

  function show(me) {
    $("signin").hidden = !!me;
    $("account").hidden = !me;
    if (!me) return;
    $("acc-name").textContent = me.name;
    $("acc-head").src = "whitelist/head/" + encodeURIComponent(me.name);
    const w = me.whitelist || {};
    const p = $("acc-wl");
    $("row-wl").className = w.on ? "on" : "";
    p.textContent = w.on
      ? (w.by ? "Du bist drauf, über den Platz von " + w.by + "." : "Du bist drauf.")
      : "Noch nicht. Einen Platz gibt dir ein Streamer oder deine Community, frag im Discord.";
    const d = me.discord;
    $("row-dc").className = d ? "on" : "";
    $("acc-dc").textContent = d ? "Verknüpft" + (d.name ? " mit " + d.name : "") + "." : "Noch nicht verknüpft.";
    $("dc-link").hidden = !!d;
    $("dc-hint").hidden = !!d;
  }

  // what the trip to Discord answered, in the fragment so it reaches no log
  function note() {
    const m = /^#(discord|discordfehler)=(.*)$/.exec(location.hash);
    if (!m) return;
    const el = $("acc-note");
    el.hidden = false;
    el.className = "acc-note " + (m[1] === "discord" ? "ok" : "bad");
    try { el.textContent = decodeURIComponent(m[2].replace(/\+/g, " ")); } catch (e) { el.textContent = ""; }
    history.replaceState(null, "", location.pathname + location.search);
  }

  async function me() {
    try {
      const r = await fetch("api/me", { cache: "no-store", credentials: "same-origin" });
      const d = r.ok ? await r.json() : null;
      return d && d.name ? d : null;  // signed out is an empty name
    } catch (e) { return null; }
  }

  $("code-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("code-msg");
    const code = $("code").value.trim();
    msg.className = "code-msg";
    msg.textContent = "Prüfe den Code ...";
    try {
      const r = await fetch("api/auth/code", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        msg.className = "code-msg bad";
        msg.textContent = d.error || "Das hat nicht geklappt.";
        return;
      }
      msg.className = "code-msg ok";
      msg.textContent = "Angemeldet als " + d.name + ".";
      if (safeBack) { location.href = safeBack; return; }
      show(await me());
    } catch (err) {
      msg.className = "code-msg bad";
      msg.textContent = "Der Server antwortet gerade nicht.";
    }
  });
  $("code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });

  $("logout").addEventListener("click", async () => {
    await fetch("api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    try { localStorage.removeItem("kw-me"); } catch (e) {} // site.js keeps the head there
    location.reload();
  });

  note();
  me().then(show);
})();
