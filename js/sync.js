/* Synchronisation avec Supabase (optionnelle).
   Principe : le téléphone reste la source de travail (coffre chiffré). Quand un compte cloud est
   connecté, les changements sont envoyés et reçus automatiquement, ligne par ligne.
   En cas de modification des deux côtés, la plus récente (champ `u`) gagne.
   Les données d'exemple (x:1) ne sont jamais envoyées.
   La session Supabase est gardée dans le coffre chiffré : verrouiller l'application la coupe. */
const Sync = (() => {
  const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  const DAY = 86400000;
  const KINDS = { tx: { table: "expenses", key: "tx" }, cat: { table: "categories", key: "cats" }, goal: { table: "goals", key: "goals" } };
  let api = null, client = null, restored = false, busy = false, again = false, timer = 0, st = { state: "off" };

  const cfg = () => window.SIKA_CONFIG || {};
  const configured = () => !!(cfg().url && cfg().anonKey);
  const cloud = () => { const S = api && api.state(); return S && S.cloud && S.cloud.session ? S.cloud : null; };
  const setStatus = (state, msg) => { st = { state, msg: msg || "", at: Date.now() }; if (api && api.status) api.status(st); };

  /* ----- conversion ligne locale <-> ligne serveur ----- */
  function toRow(kind, it) {
    if (kind === "tx") return { id: it.id, d: it.d, a: it.a, c: it.c, n: it.n || "" };
    if (kind === "cat") return { id: it.id, name: it.name, budget: it.budget || 0, fixed: !!it.fixed, color: it.color };
    return { id: it.id, name: it.name, target: it.target, saved: it.saved, dl: it.dl };
  }
  function fromRow(kind, r) {
    if (kind === "tx") return { id: r.id, d: r.d, a: Number(r.a), c: r.c, n: r.n || "" };
    if (kind === "cat") { const c = { id: r.id, name: r.name, budget: Number(r.budget) || 0, color: r.color }; if (r.fixed) c.fixed = 1; return c; }
    return { id: r.id, name: r.name, target: Number(r.target), saved: Number(r.saved), dl: r.dl };
  }
  function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }
  const hashItem = (kind, it) => hashStr(JSON.stringify(toRow(kind, it)));
  const hashProf = S => hashStr(JSON.stringify([S.income, S.cur, S.thr]));

  /* ----- détection des changements locaux ----- */
  function reconcile(S) {
    const c = S.cloud, now = Date.now(); let dirty = 0;
    for (const kind of Object.keys(KINDS)) {
      const list = S[KINDS[kind].key], sh = c.shadow[kind] = c.shadow[kind] || {}, seen = new Set();
      for (const it of list) {
        if (it.x) continue; seen.add(it.id);
        const h = hashItem(kind, it), e = sh[it.id];
        if (!e || e.h !== h || e.del) { it.u = now; sh[it.id] = { h, u: now, dirty: 1 }; dirty++; } else if (e.dirty) dirty++;
      }
      for (const id of Object.keys(sh)) {
        const e = sh[id];
        if (seen.has(id)) continue;
        if (!e.del) { sh[id] = { h: e.h, u: now, del: 1, dirty: 1 }; dirty++; } else if (e.dirty) dirty++;
      }
    }
    const ph = hashProf(S), pe = c.shadow.prof;
    if (!pe || pe.h !== ph) { S.pu = now; c.shadow.prof = { h: ph, u: now, dirty: 1 }; dirty++; } else if (pe.dirty) dirty++;
    return dirty;
  }

  /* ----- réception ----- */
  function applyRemote(kind, r, first) {
    const S = api.state(), c = S.cloud, list = S[KINDS[kind].key], sh = c.shadow[kind] = c.shadow[kind] || {};
    const e = sh[r.id], i = list.findIndex(x => x.id === r.id), ru = Number(r.u) || 0;
    if (e && !first) { if (e.dirty && e.u >= ru) return 0; if (!e.dirty && e.u >= ru) return 0; }
    if (e && first && !e.dirty && e.u >= ru) return 0;
    if (r.deleted) { const had = i >= 0 || !!e; if (i >= 0) list.splice(i, 1); delete sh[r.id]; return had ? 1 : 0; }
    const it = fromRow(kind, r); it.u = ru;
    if (i >= 0) list[i] = it; else list.push(it);
    sh[r.id] = { h: hashItem(kind, it), u: ru };
    return 1;
  }
  async function pull(first) {
    const S = api.state(), c = S.cloud; let changed = 0, maxU = c.last || 0;
    const since = first ? 0 : Math.max(0, (c.last || 0) - DAY);
    for (const kind of Object.keys(KINDS)) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from(KINDS[kind].table).select("*").gt("u", since).order("u", { ascending: true }).order("id", { ascending: true }).range(from, from + 999);
        if (error) throw error;
        if (cloud() !== c) return changed;
        for (const r of data) { changed += applyRemote(kind, r, first); if (Number(r.u) > maxU) maxU = Number(r.u); }
        if (data.length < 1000) break;
      }
    }
    const { data: p, error: pe } = await client.from("profile").select("*").maybeSingle();
    if (pe) throw pe;
    if (cloud() !== c) return changed;
    if (p) {
      const ru = Number(p.u) || 0, e = c.shadow.prof;
      if (first || !e || (!e.dirty && ru > e.u) || (e.dirty && ru > e.u)) {
        if (S.income !== p.income || S.cur !== p.cur || S.thr !== p.thr) changed++;
        if (p.income != null) S.income = Number(p.income); if (p.cur) S.cur = p.cur; if (p.thr != null) S.thr = Number(p.thr);
        S.pu = ru; c.shadow.prof = { h: hashProf(S), u: ru };
      }
    }
    c.last = maxU;
    return changed;
  }

  /* ----- envoi ----- */
  async function push() {
    const S = api.state(), c = S.cloud, uid = c.uid;
    for (const kind of Object.keys(KINDS)) {
      const { table, key } = KINDS[kind], sh = c.shadow[kind] || {}, list = S[key], rows = [], sent = [];
      for (const id of Object.keys(sh)) {
        const e = sh[id]; if (!e.dirty) continue;
        if (e.del) rows.push({ user_id: uid, id, deleted: true, u: e.u });
        else { const it = list.find(x => x.id === id); if (!it) continue; rows.push({ user_id: uid, ...toRow(kind, it), deleted: false, u: e.u }); }
        sent.push([id, e.u]);
      }
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await client.from(table).upsert(rows.slice(i, i + 500), { onConflict: "user_id,id" });
        if (error) throw error;
      }
      if (cloud() !== c) return;
      for (const [id, u] of sent) { const e = sh[id]; if (e && e.u === u) { if (e.del) delete sh[id]; else e.dirty = 0; } }
    }
    const pe = c.shadow.prof;
    if (pe && pe.dirty) {
      const { error } = await client.from("profile").upsert({ user_id: uid, income: S.income, cur: S.cur, thr: S.thr, u: pe.u }, { onConflict: "user_id" });
      if (error) throw error;
      if (cloud() === c && c.shadow.prof === pe) pe.dirty = 0;
    }
  }

  /* ----- client Supabase ----- */
  function loadLib() {
    return new Promise((res, rej) => {
      if (window.supabase) return res();
      const s = document.createElement("script"); s.src = LIB; s.onload = () => res(); s.onerror = () => rej({ code: "offline", message: "Impossible de charger la connexion cloud (réseau ?)." });
      document.head.appendChild(s);
    });
  }
  async function ensure() {
    if (client) return client;
    if (!configured()) throw { code: "config", message: "La synchronisation n'est pas encore configurée." };
    if (!window.supabase) await loadLib();
    client = window.supabase.createClient(cfg().url, cfg().anonKey, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
    restored = false;
    client.auth.onAuthStateChange((ev, ses) => {
      const c = cloud();
      if (ses && c && ev === "TOKEN_REFRESHED") { c.session = { access_token: ses.access_token, refresh_token: ses.refresh_token }; api.saveQuiet(); }
    });
    return client;
  }
  async function restore() {
    if (restored) return;
    const c = cloud(), { data, error } = await client.auth.setSession({ access_token: c.session.access_token, refresh_token: c.session.refresh_token });
    if (error) throw error;
    if (data && data.session && cloud() === c) c.session = { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    restored = true;
  }
  function drop() { try { if (client) client.auth.stopAutoRefresh(); } catch (e) { } client = null; restored = false; }

  const isAuthErr = e => e && (e.status === 401 || e.status === 403 || /jwt|refresh token|not authenticated|invalid token/i.test(e.message || ""));
  const FR = [[/invalid login credentials/i, "E-mail ou mot de passe incorrect."], [/already registered|already been registered/i, "Un compte existe déjà avec cet e-mail. Connectez-vous."], [/password should be|at least \d+ char/i, "Mot de passe trop court (8 caractères minimum)."], [/email not confirmed/i, "Confirmez d'abord votre e-mail (lien reçu par message), puis connectez-vous."], [/rate limit|too many/i, "Trop de tentatives. Réessayez dans quelques minutes."], [/failed to fetch|network/i, "Pas de connexion internet."]];
  const frMsg = m => { for (const [re, t] of FR) if (re.test(m || "")) return t; return m || "Opération impossible."; };

  /* ----- cycle de synchronisation ----- */
  async function run() {
    const c = cloud();
    if (!c) { setStatus("off"); return; }
    if (!configured()) { setStatus("config"); return; }
    if (typeof navigator !== "undefined" && navigator.onLine === false) { setStatus("offline"); return; }
    if (busy) { again = true; return; }
    busy = true; setStatus("syncing");
    try {
      await ensure(); await restore();
      const S = api.state(), first = !!c.first;
      if (!first) reconcile(S);
      const changed = await pull(first);
      if (cloud() !== c) return;
      reconcile(S); await push();
      if (cloud() !== c) return;
      if (c.first) delete c.first;
      c.lastSync = Date.now(); api.saveQuiet(); if (changed) api.changed();
      setStatus("ok");
    } catch (e) {
      if (cloud() === c) setStatus(isAuthErr(e) ? "auth" : "error", frMsg(e && e.message));
    } finally { busy = false; if (again) { again = false; schedule(500); } }
  }
  function schedule(ms) { clearTimeout(timer); if (!cloud()) return; timer = setTimeout(run, ms == null ? 1500 : ms); }

  async function signIn(email, password, create) {
    const cl = await ensure();
    const r = create ? await cl.auth.signUp({ email, password }) : await cl.auth.signInWithPassword({ email, password });
    if (r.error) throw { message: frMsg(r.error.message) };
    const ses = r.data && r.data.session;
    if (!ses) throw { message: "Compte créé. Confirmez votre e-mail avec le lien reçu, puis connectez-vous." };
    const S = api.state();
    S.cloud = { email, uid: r.data.user.id, session: { access_token: ses.access_token, refresh_token: ses.refresh_token }, last: 0, shadow: { tx: {}, cat: {}, goal: {} }, first: true };
    restored = true; api.saveQuiet(); schedule(0);
  }
  async function signOut() {
    try { if (client) await client.auth.signOut(); } catch (e) { }
    drop(); clearTimeout(timer);
    const S = api.state(); if (S) { S.cloud = null; api.saveQuiet(); }
    setStatus("off");
  }
  function onLock() { clearTimeout(timer); drop(); st = { state: "off" }; }

  return {
    init(a) { api = a; },
    configured, schedule, signIn, signOut, onLock, run,
    connected: () => !!cloud(),
    status: () => st
  };
})();
