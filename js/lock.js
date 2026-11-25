/* Écrans d'accès : connexion / création de compte (même page), démo, saisie du PIN, verrouillage. */
const Lock = (() => {
  const host = () => document.getElementById("lock");
  const PREF = "sika:prefs";
  const prefs = () => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (e) { return {}; } };
  /* mode : "auth" (page de connexion), "pin" (clavier), "busy" (chargement) */
  let mode = "auth", tab = "login", reset = false, pin = "", busy = false, err = "", ok = "", hiddenAt = 0, tick = 0, keep = {};

  const delay = () => { const d = prefs().lock; return typeof d === "number" ? d : 2; };
  const setDelay = m => { try { localStorage.setItem(PREF, JSON.stringify({ ...prefs(), lock: m })); } catch (e) { } };
  const weak = p => /^(\d)\1{5}$/.test(p) || "0123456789012345".includes(p) || "9876543210987654".includes(p);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $l = s => host().querySelector(s);

  const MARK = '<div class="mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l5-5 4 4 7-8"/></svg></div>';
  const DEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M13 9.5l4 5M17 9.5l-4 5"/></svg>';
  const keypad = () => `<div class="pad" role="group" aria-label="Clavier du PIN">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}" aria-label="${n}">${n}</button>`).join("")}<span></span><button type="button" data-k="0" aria-label="0">0</button><button type="button" class="ghost" data-k="del" aria-label="Effacer">${DEL}</button></div>`;
  const dots = () => `<div class="dots" id="dots" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < pin.length ? "on" : ""}"></i>`).join("")}</div>`;
  const pinField = (id, label, auto) => `<div class="field"><label for="${id}">${label}</label><input type="password" id="${id}" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="${auto || "off"}" placeholder="6 chiffres" required></div>`;
  const v = k => esc(keep[k] || "");

  function authView() {
    const login = tab === "login", cfg = Sync.configured();
    const form = !cfg ? `<div class="note">La connexion au cloud n'est pas encore configurée. Vous pouvez essayer la démo.</div>`
      : login ? `<form id="af" novalidate autocomplete="on">
          <div class="field"><label for="a-id">Nom d'utilisateur</label><input type="text" id="a-id" autocomplete="username" autocapitalize="none" spellcheck="false" value="${v("id")}" required></div>
          <div class="field"><label for="a-pw">Mot de passe</label><input type="password" id="a-pw" autocomplete="current-password" required></div>
          ${pinField("a-pin", reset ? "Nouveau PIN" : "PIN")}
          ${reset ? `<div class="note" style="margin:0 0 12px">Mot de passe correct = c'est bien vous : ce nouveau PIN remplacera l'ancien sur tous vos appareils.</div>` : ""}
          <div class="msg ${err ? "bad" : ""}" id="msg" role="alert">${esc(err || ok)}</div>
          <button class="btn" type="submit">${reset ? "Réinitialiser mon PIN et me connecter" : "Se connecter"}</button>
          <button class="link" type="button" id="rst">${reset ? "Annuler" : "PIN oublié ?"}</button>
        </form>`
      : `<form id="af" novalidate autocomplete="on">
          <div class="field"><label for="a-mail">E-mail</label><input type="email" id="a-mail" autocomplete="email" autocapitalize="none" spellcheck="false" value="${v("mail")}" required></div>
          <div class="field"><label for="a-id">Nom d'utilisateur</label><input type="text" id="a-id" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="lettres, chiffres, _" value="${v("id")}" required></div>
          <div class="field"><label for="a-pw">Mot de passe</label><input type="password" id="a-pw" autocomplete="new-password" placeholder="8 caractères minimum" required></div>
          ${pinField("a-pin", "PIN")}
          ${pinField("a-pin2", "Confirmer le PIN")}
          <div class="msg ${err ? "bad" : ""}" id="msg" role="alert">${esc(err || ok)}</div>
          <button class="btn" type="submit">Créer mon compte</button>
          <p class="small muted" style="font-size:12.5px;margin-top:10px">Le PIN protège l'application sur ce téléphone. À la première connexion sur un nouvel appareil, il faut le nom d'utilisateur, le mot de passe et le PIN ; ensuite le PIN suffit.</p>
        </form>`;
    return `<div class="lk wide">${MARK}<h1>Sika</h1><p>Votre budget, vos alertes, vos économies.</p>
      ${cfg ? `<div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${login}" data-tab="login">Connexion</button><button type="button" role="tab" aria-selected="${!login}" data-tab="register">Créer un compte</button></div>` : ""}
      ${form}
      <div class="sep"><span>ou</span></div>
      <button class="btn ghost" type="button" id="demo">${Auth.hasDemo() ? "Reprendre la démo" : "Essayer la démo"}</button>
      <p class="small muted" style="font-size:12.5px;margin-top:8px">La démo fonctionne sans compte, avec des données d'exemple stockées seulement sur cet appareil. Sans PIN ni sauvegarde.</p></div>`;
  }
  function pinView() {
    return `<div class="lk">${MARK}<h1>Bonjour, ${esc(Auth.name())}</h1><p>Entrez votre PIN pour ouvrir Sika.</p>${dots()}<div class="msg ${err ? "bad" : ""}" id="msg" role="alert">${esc(err)}</div>${keypad()}
      <button class="link" id="fg">PIN oublié ?</button><button class="link" id="other" style="margin-top:0">Autre compte</button></div>`;
  }
  function view() {
    const h = host(); h.hidden = false;
    if (mode === "pin") h.innerHTML = pinView();
    else if (mode === "busy") h.innerHTML = `<div class="lk">${MARK}<h1>Un instant…</h1><p id="busytxt">${esc(keep.busy || "Chargement de vos données…")}</p></div>`;
    else { h.innerHTML = authView(); }
  }
  function showAuth(t, opts) {
    clearInterval(tick); mode = "auth"; tab = t || "login"; reset = !!(opts && opts.reset); err = ""; ok = (opts && opts.ok) || ""; busy = false; pin = "";
    if (opts && opts.keep) keep = opts.keep; else keep = {};
    view(); const f = $l("#a-id") || $l("#a-mail"); if (f && !(opts && opts.quiet)) { try { f.focus({ preventScroll: true }); } catch (e) { } }
  }
  function showPin() { mode = "pin"; pin = ""; busy = false; keep = {}; view(); countdown(); }

  function countdown() {
    clearInterval(tick);
    if (mode !== "pin") return;
    if (Auth.waitLeft() <= 0) return;
    const upd = () => { const s = Auth.waitLeft(), m = document.getElementById("msg"); if (s <= 0) { clearInterval(tick); err = ""; if (m) { m.textContent = ""; m.classList.remove("bad"); } return; } err = `Trop d'essais. Réessayez dans ${s} s.`; if (m) { m.textContent = err; m.classList.add("bad"); } };
    upd(); tick = setInterval(upd, 1000);
  }
  function shake(msg) {
    err = msg; pin = ""; busy = false; view(); countdown();
    const d = document.getElementById("dots"); if (d) { d.classList.add("shake"); setTimeout(() => d.classList.remove("shake"), 400); }
    if (navigator.vibrate) navigator.vibrate(120);
  }
  function enter(state) { clearInterval(tick); pin = ""; err = ""; keep = {}; host().hidden = true; host().innerHTML = ""; afterUnlock(state); }

  /* ----- PIN (appareil déjà connu) ----- */
  async function submitPin() {
    busy = true;
    const m = document.getElementById("msg"); if (m) { m.classList.remove("bad"); m.textContent = "Vérification…"; }
    try { enter(await Auth.unlock(pin)); }
    catch (e) { shake(e.code === "locked" || e.wait > 0 ? `Trop d'essais. Réessayez dans ${e.wait} s.` : e.code === "bad_pin" ? "PIN incorrect" : "Impossible d'ouvrir le coffre"); }
  }
  function press(k) {
    if (busy || mode !== "pin") return;
    if (k === "del") pin = pin.slice(0, -1); else if (pin.length < 6) pin += k;
    document.querySelectorAll("#dots i").forEach((d, i) => d.classList.toggle("on", i < pin.length));
    if (pin.length === 6) setTimeout(submitPin, 120);
  }

  /* ----- compte réel : on remplace tout ce qui était sur l'appareil, puis première synchronisation ----- */
  async function finishCloud(info, pin6) {
    mode = "busy"; keep = { busy: "Chargement de vos données…" }; view();
    Auth.exitDemo(); Auth.wipe();
    const st = freshCloudState(); st.cloud = Sync.newCloud(info);
    await Auth.create(info, pin6, st);
    afterUnlock(st);
    await Promise.race([Sync.run(), new Promise(r => setTimeout(r, 20000))]);
    enter(S);
  }
  function fail(msg) { busy = false; err = msg; const m = $l("#msg"); if (m) { m.textContent = msg; m.classList.add("bad"); } const b = $l("#af button[type=submit]"); if (b) b.disabled = false; }

  async function submitAuth() {
    if (busy) return; err = "";
    const id = $l("#a-id").value.trim(), pw = $l("#a-pw").value, p1 = $l("#a-pin").value;
    const m = $l("#msg"); const submitBtn = $l("#af button[type=submit]");
    const bad = t => { fail(t); };
    keep = { id, mail: ($l("#a-mail") || {}).value || "" };
    if (tab === "login") {
      if (!id || !pw) return bad("Entrez votre nom d'utilisateur et votre mot de passe.");
      if (!/^\d{6}$/.test(p1)) return bad("Le PIN comporte 6 chiffres.");
      if (reset && weak(p1)) return bad("PIN trop simple. Évitez 123456 ou 111111.");
      busy = true; if (submitBtn) submitBtn.disabled = true; m.classList.remove("bad"); m.textContent = "Connexion…";
      try { const r = await Sync.login({ login: id, password: pw, pin: p1, resetPin: reset }); await finishCloud(r.info, p1); }
      catch (e) { if (mode === "busy") { showAuth("login", { keep }); } fail(e && e.message || "Connexion impossible."); }
    } else {
      const mail = keep.mail.trim(), un = id.toLowerCase(), p2 = $l("#a-pin2").value;
      if (!/^\S+@\S+\.\S+$/.test(mail)) return bad("Adresse e-mail invalide.");
      if (!/^[a-z0-9_]{3,20}$/.test(un)) return bad("Nom d'utilisateur : 3 à 20 caractères (lettres, chiffres, _).");
      if (pw.length < 8) return bad("Mot de passe : 8 caractères minimum.");
      if (!/^\d{6}$/.test(p1)) return bad("Le PIN comporte 6 chiffres.");
      if (weak(p1)) return bad("PIN trop simple. Évitez 123456 ou 111111.");
      if (p1 !== p2) return bad("Les deux PIN sont différents.");
      busy = true; if (submitBtn) submitBtn.disabled = true; m.classList.remove("bad"); m.textContent = "Création du compte…";
      try {
        const r = await Sync.register({ email: mail, username: un, password: pw, pin: p1 });
        if (r.needsConfirm) return showAuth("login", { keep: { id: un }, ok: "Compte créé. Confirmez votre e-mail avec le lien reçu, puis connectez-vous (nom d'utilisateur, mot de passe, PIN)." });
        await finishCloud(r.info, p1);
      } catch (e) { if (mode === "busy") { showAuth("register", { keep }); } fail(e && e.message || "Création impossible."); }
    }
  }

  /* ----- démo ----- */
  function startDemo() {
    let st = Auth.loadDemo();
    if (!st) { st = freshState(); const d = demoData(new Date()); st.tx = d.tx; st.goals = d.goals; Auth.startDemo(st); }
    enter(st);
  }

  document.addEventListener("click", e => {
    if (host().hidden) return;
    const k = e.target.closest("[data-k]"); if (k) return press(k.dataset.k);
    const t = e.target.closest("[data-tab]"); if (t) { keep = { id: ($l("#a-id") || {}).value || "", mail: ($l("#a-mail") || {}).value || "" }; return showAuth(t.dataset.tab, { keep, quiet: true }); }
    if (e.target.closest("#demo")) return startDemo();
    if (e.target.closest("#rst")) { keep = { id: ($l("#a-id") || {}).value || "" }; return showAuth("login", { reset: !reset, keep, quiet: true }); }
    if (e.target.closest("#fg")) return showAuth("login", { reset: true, keep: { id: Auth.name() }, ok: "Entrez votre mot de passe pour choisir un nouveau PIN." });
    const o = e.target.closest("#other");
    if (o) { if (!o.dataset.armed) { o.dataset.armed = "1"; o.textContent = "Confirmer : seules les modifications non synchronisées seront perdues"; } else { Auth.wipe(); showAuth("login"); } }
  });
  document.addEventListener("submit", e => { if (e.target.id !== "af") return; e.preventDefault(); submitAuth(); });
  document.addEventListener("keydown", e => {
    if (host().hidden || mode !== "pin" || e.target.matches("input,textarea")) return;
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del");
  });

  /* ----- verrouillage, déconnexion ----- */
  async function lockNow() {
    if (!Auth.unlocked() || Auth.mode() === "demo") return;
    await flushNow(); Auth.lock(); clearScreen(); err = ""; showPin();
  }
  async function logout() { /* quitte le compte et efface les données de l'appareil */
    clearTimeout(ptimer); await saving; await Sync.leave(); Auth.lock(); Auth.wipe(); clearScreen(); showAuth("login", { quiet: true });
  }
  function exitDemo() { Auth.exitDemo(); clearTimeout(ptimer); clearScreen(); showAuth("register", { quiet: true }); }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); if (Auth.unlocked()) flushNow(); return; }
    if (Auth.unlocked() && Auth.mode() === "cloud" && hiddenAt && Date.now() - hiddenAt >= delay() * 60000) lockNow();
  });
  window.addEventListener("pagehide", () => { if (Auth.unlocked()) flushNow(); });

  function start() {
    err = "";
    if (Auth.hasCloud()) showPin();
    else if (Auth.hasDemo()) startDemo();
    else showAuth("login", { quiet: true });
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => { });
  start();
  return { lockNow, logout, exitDemo, delay, setDelay, weak };
})();
