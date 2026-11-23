/* Écrans d'accès : création du compte, saisie du code, verrouillage automatique. */
const Lock = (() => {
  const host = () => document.getElementById("lock");
  const PREF = "sika:prefs";
  const prefs = () => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (e) { return {}; } };
  let mode = "login", pin = "", first = "", name = "", demo = true, busy = false, err = "", hiddenAt = 0, tick = 0;

  const delay = () => { const d = prefs().lock; return typeof d === "number" ? d : 2; };
  const setDelay = m => { try { localStorage.setItem(PREF, JSON.stringify({ ...prefs(), lock: m })); } catch (e) { } };
  const weak = p => /^(\d)\1{5}$/.test(p) || "0123456789012345".includes(p) || "9876543210987654".includes(p);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const MARK = '<div class="mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l5-5 4 4 7-8"/></svg></div>';
  const DEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M13 9.5l4 5M17 9.5l-4 5"/></svg>';
  const keypad = () => `<div class="pad" role="group" aria-label="Clavier du code">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}" aria-label="${n}">${n}</button>`).join("")}<span></span><button type="button" data-k="0" aria-label="0">0</button><button type="button" class="ghost" data-k="del" aria-label="Effacer">${DEL}</button></div>`;
  const dots = () => `<div class="dots" id="dots" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < pin.length ? "on" : ""}"></i>`).join("")}</div>`;

  function view() {
    const h = host(); let html = "";
    if (mode === "welcome") {
      html = `<div class="lk">${MARK}<h1>Bienvenue sur Sika</h1><p>Suivez vos dépenses, respectez vos budgets et épargnez mieux.</p>
        <form id="wf"><div class="field"><label for="nm">Votre prénom</label><input type="text" id="nm" maxlength="30" autocomplete="given-name" value="${esc(name)}" required></div>
        <label class="chk"><input type="checkbox" id="dm" ${demo ? "checked" : ""}><span>Commencer avec des données d'exemple, pour voir comment tout fonctionne. Vous pourrez les effacer en un geste.</span></label>
        <button class="btn" type="submit">Continuer</button></form>
        <div class="note">Vos données restent sur ce téléphone, chiffrées par un code secret à 6 chiffres que vous allez choisir. Personne d'autre n'y a accès.</div></div>`;
    } else if (mode === "new" || mode === "confirm") {
      html = `<div class="lk">${MARK}<h1>${mode === "new" ? "Choisissez votre code" : "Confirmez votre code"}</h1><p>${mode === "new" ? "6 chiffres, faciles à retenir pour vous seul." : "Saisissez le même code une seconde fois."}</p>${dots()}<div class="msg ${err ? "bad" : ""}" id="msg" role="alert">${esc(err)}</div>${keypad()}
        <p class="small muted" style="margin-top:16px;font-size:12.5px">Si vous oubliez ce code, vos données ne pourront pas être récupérées.</p></div>`;
    } else if (mode === "forgot") {
      html = `<div class="lk">${MARK}<h1>Code oublié</h1><p>Le code chiffre vos données : sans lui, elles ne peuvent pas être lues, même par nous. La seule option est de tout effacer et de recommencer.</p>
        <div style="width:100%;margin-top:22px"><button class="btn danger" id="wipe">Effacer et recommencer</button><button class="link" id="back">Retour</button></div></div>`;
    } else {
      html = `<div class="lk">${MARK}<h1>Bonjour, ${esc(Auth.name())}</h1><p>Entrez votre code pour ouvrir Sika.</p>${dots()}<div class="msg ${err ? "bad" : ""}" id="msg" role="alert">${esc(err)}</div>${keypad()}<button class="link" id="fg">Code oublié ?</button></div>`;
    }
    h.innerHTML = html; h.hidden = false;
    const f = h.querySelector("#nm"); if (f) f.focus();
  }
  function show(m) { mode = m; pin = ""; first = m === "new" ? "" : first; busy = false; view(); countdown(); }

  function countdown() {
    clearInterval(tick);
    if (mode !== "login") return;
    const w = Auth.waitLeft(); if (w <= 0) return;
    const upd = () => { const s = Auth.waitLeft(); const m = document.getElementById("msg"); if (s <= 0) { clearInterval(tick); err = ""; if (m) { m.textContent = ""; m.classList.remove("bad"); } return; } err = `Trop d'essais. Réessayez dans ${s} s.`; if (m) { m.textContent = err; m.classList.add("bad"); } };
    upd(); tick = setInterval(upd, 1000);
  }
  function shake(msg) {
    err = msg; pin = ""; busy = false; view(); countdown();
    const d = document.getElementById("dots"); if (d) { d.classList.add("shake"); setTimeout(() => d.classList.remove("shake"), 400); }
    if (navigator.vibrate) navigator.vibrate(120);
  }
  function done(state) { clearInterval(tick); pin = ""; first = ""; err = ""; host().hidden = true; host().innerHTML = ""; afterUnlock(state); }

  async function submit() {
    busy = true;
    const m = document.getElementById("msg"); if (m) { m.classList.remove("bad"); m.textContent = "Vérification…"; }
    if (mode === "login") {
      try { done(await Auth.unlock(pin)); }
      catch (e) { shake(e.code === "locked" || (e.wait > 0) ? `Trop d'essais. Réessayez dans ${e.wait} s.` : e.code === "bad_pin" ? "Code incorrect" : "Impossible d'ouvrir le coffre"); }
    } else if (mode === "new") {
      if (weak(pin)) return shake("Code trop simple. Évitez 123456 ou 111111.");
      first = pin; pin = ""; mode = "confirm"; busy = false; err = ""; view();
    } else if (mode === "confirm") {
      if (pin !== first) { first = ""; mode = "new"; return shake("Les deux codes sont différents. Recommencez."); }
      try {
        const st = freshState();
        if (demo) { const d = demoData(new Date()); st.tx = d.tx; st.goals = d.goals; }
        done(await Auth.create(name, pin, st));
      } catch (e) { shake(e && e.code === "storage" ? "Le stockage du téléphone est indisponible (mode privé ?)." : "Impossible de créer le compte."); }
    }
  }
  function press(k) {
    if (busy || (mode !== "login" && mode !== "new" && mode !== "confirm")) return;
    if (k === "del") pin = pin.slice(0, -1); else if (pin.length < 6) pin += k;
    document.querySelectorAll("#dots i").forEach((d, i) => d.classList.toggle("on", i < pin.length));
    if (pin.length === 6) setTimeout(submit, 120);
  }

  document.addEventListener("click", e => {
    if (host().hidden) return;
    const k = e.target.closest("[data-k]"); if (k) return press(k.dataset.k);
    if (e.target.closest("#fg")) return show("forgot");
    if (e.target.closest("#back")) return show("login");
    const w = e.target.closest("#wipe");
    if (w) { if (!w.dataset.armed) { w.dataset.armed = "1"; w.textContent = "Confirmer : tout effacer"; } else { Auth.wipe(); name = ""; show("welcome"); } }
  });
  document.addEventListener("submit", e => {
    if (e.target.id !== "wf") return; e.preventDefault();
    name = document.getElementById("nm").value.trim(); demo = document.getElementById("dm").checked;
    if (name) show("new");
  });
  document.addEventListener("keydown", e => {
    if (host().hidden || e.target.matches("input,textarea")) return;
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del");
  });

  async function lockNow() {
    if (!Auth.unlocked()) return;
    await flushNow(); Auth.lock(); clearScreen(); err = ""; show("login");
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); if (Auth.unlocked()) flushNow(); return; }
    if (Auth.unlocked() && hiddenAt && Date.now() - hiddenAt >= delay() * 60000) lockNow();
  });
  window.addEventListener("pagehide", () => { if (Auth.unlocked()) flushNow(); });

  function start() { err = ""; show(Auth.exists() ? "login" : "welcome"); }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => { });
  start();
  return { lockNow, delay, setDelay, weak };
})();
