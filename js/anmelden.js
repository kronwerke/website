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
    p.className = w.on ? "wl on" : "wl";
    p.textContent = w.on
      ? (w.by ? "Auf der Whitelist, über den Platz von " + w.by + "." : "Auf der Whitelist.")
      : "Noch nicht auf der Whitelist. Einen Platz gibt dir ein Streamer oder deine Community, frag im Discord.";
  }

  async function me() {
    try {
      const r = await fetch("api/me", { cache: "no-store", credentials: "same-origin" });
      return r.ok ? await r.json() : null;
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
    location.reload();
  });

  me().then(show);
})();
