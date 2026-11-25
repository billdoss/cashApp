/* FedhApp : interface et logique. Les données passent par Store (js/storage.js). */
"use strict";
/* ---------- utilitaires ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const p2 = n => String(n).padStart(2, "0");
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const sum = a => a.reduce((x, y) => x + y, 0);
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const num = v => { const n = Number(String(v).replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; };
const ymd = d => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const mk = d => d.getFullYear() + "-" + p2(d.getMonth() + 1);
const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d || 1); };
const addM = (key, n) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return mk(d); };
const daysIn = key => { const [y, m] = key.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const monthsBetween = (a, b) => { const [y1, m1] = a.split("-").map(Number), [y2, m2] = b.split("-").map(Number); return (y2 - y1) * 12 + (m2 - m1); };
const monthLabel = key => parseD(key + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const monthShort = key => parseD(key + "-01").toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
const dayLabel = s => parseD(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
let S = null;
const fmt = n => Math.round(n).toLocaleString("fr-FR") + " " + (S ? S.cur : "FCFA");
const fmtN = n => Math.round(n).toLocaleString("fr-FR");
const fmtK = n => { const a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M" : a >= 1000 ? Math.round(n / 1000) + " k" : String(Math.round(n)); };
const pct = n => Math.round(n * 100) + " %";

/* ---------- données par défaut ---------- */
const COLORS = ["#3B82C4", "#E0883A", "#7C6BD6", "#2FA38A", "#D1558A", "#C9A227", "#5E7A8C", "#8CB04A", "#C2563E", "#7D8794", "#4F9DB5", "#A0674B"];
const BASE_CATS = [
  { id: "log", name: "Logement", budget: 85000, fixed: 1 },
  { id: "ali", name: "Alimentation", budget: 75000 },
  { id: "tra", name: "Transport", budget: 30000 },
  { id: "fac", name: "Eau & électricité", budget: 20000, fixed: 1 },
  { id: "tel", name: "Téléphone & internet", budget: 10000, fixed: 1 },
  { id: "san", name: "Santé", budget: 12000 },
  { id: "edu", name: "Éducation", budget: 15000, fixed: 1 },
  { id: "fam", name: "Famille & solidarité", budget: 20000 },
  { id: "loi", name: "Loisirs & sorties", budget: 20000 },
  { id: "aut", name: "Autres", budget: 10000 }
];
const freshState = () => ({ v: 1, cur: "FCFA", income: 350000, thr: 80, cats: BASE_CATS.map((c, i) => ({ ...c, color: COLORS[i % COLORS.length] })), tx: [], goals: [] });

/* Compte réel : on part de zéro (revenu et budgets à définir). */
const freshCloudState = () => ({ ...freshState(), income: 0, cats: BASE_CATS.map((c, i) => ({ ...c, budget: 0, color: COLORS[i % COLORS.length] })) });
const isDemo = () => Auth.mode() === "demo";
function suggestBudgets(income) { /* 85 % du revenu réparti comme le modèle de base, le reste est l'épargne */
  const tot = sum(BASE_CATS.map(c => c.budget));
  for (const c of S.cats) { const b = BASE_CATS.find(x => x.id === c.id); if (b) c.budget = Math.max(0, Math.round(income * 0.85 * b.budget / tot / 500) * 500); }
}

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function demoData(now) {
  const tx = [], r = rng(11), cur = mk(now);
  for (let k = -5; k <= 0; k++) {
    const key = addM(cur, k), dim = daysIn(key), last = k === 0 ? now.getDate() : dim;
    const add = (day, c, a, n) => { if (day >= 1 && day <= last) tx.push({ id: uid(), d: key + "-" + p2(day), a: Math.max(500, Math.round(a / 500) * 500), c, n, x: 1 }); };
    add(1, "log", 85000, "Loyer");
    add(4, "tel", 10000, "Forfait + data");
    add(6 + Math.floor(r() * 4), "fac", 14000 + r() * 9000, "CIE / SODECI");
    const shops = ["Marché", "Supermarché", "Marché", "Boutique du quartier"];
    for (let d = 2; d <= dim; d += 2 + Math.floor(r() * 2)) add(d, "ali", 2500 + r() * (r() < .2 ? 12000 : 5000), shops[Math.floor(r() * shops.length)]);
    for (let d = 1; d <= dim; d++) { const wd = new Date(parseD(key + "-01").getFullYear(), parseD(key + "-01").getMonth(), d).getDay(); if (wd > 0 && r() < .55) add(d, "tra", 700 + r() * 1100, "Taxi / gbaka"); }
    if (r() < .6) add(10 + Math.floor(r() * 12), "san", 4000 + r() * 9000, "Pharmacie");
    const nl = 2 + Math.floor(r() * 2); for (let i = 0; i < nl; i++) add(5 + Math.floor(r() * 22), "loi", 4000 + r() * (k === 0 ? 9000 : 8000), ["Maquis", "Sortie entre amis", "Cinéma"][i % 3]);
    add(15, "fam", 15000 + r() * 8000, "Aide à la famille");
    if (k % 2 === 0) add(5, "edu", 15000, "Scolarité");
    if (r() < .5) add(8 + Math.floor(r() * 15), "aut", 3000 + r() * 7000, "Divers");
  }
  const goals = [
    { id: uid(), name: "Fonds d'urgence (3 mois)", target: 900000, saved: 210000, dl: addM(cur, 12), x: 1 },
    { id: uid(), name: "Voyage au village", target: 250000, saved: 40000, dl: addM(cur, 8), x: 1 }
  ];
  return { tx, goals };
}

/* ---------- enregistrement (via Store, chiffré par Auth) ---------- */
let ptimer = 0, saving = Promise.resolve();
let cloudSt = { state: "off" };
function cloudLabel() {
  if (isDemo()) return "Mode démo";
  if (!S || !S.cloud || !S.cloud.session) return "";
  return { syncing: "Synchronisation…", ok: "Synchronisé", offline: "Hors ligne", error: "Synchro en erreur", auth: "Reconnexion requise", config: "Cloud non configuré" }[cloudSt.state] || "Cloud connecté";
}
const setSync = k => { const el = $("#sync"); if (el) el.textContent = { ok: cloudLabel(), sav: "Enregistrement…", err: "Erreur d'enregistrement" }[k] || ""; };
function persist() { clearTimeout(ptimer); setSync("sav"); ptimer = setTimeout(flushNow, 350); }
function flushNow() {
  clearTimeout(ptimer); ptimer = 0;
  if (!S || !Auth.unlocked()) return saving;
  const snap = JSON.parse(JSON.stringify(S));
  saving = saving.then(() => Store.save(snap)).then(() => setSync("ok")).catch(() => setSync("err"));
  return saving;
}
function saveQuiet() { /* enregistre sans relancer la synchronisation */
  if (!S || !Auth.unlocked()) return;
  const snap = JSON.parse(JSON.stringify(S));
  saving = saving.then(() => Store.adapter.save(snap)).catch(() => { });
}
function afterUnlock(state) {
  S = state && state.cats ? state : freshState(); nowKey = mk(new Date());
  ui = { tab: "home", month: nowKey, seg: "bilan", cat: "all", dep: null, undo: null };
  cloudSt = { state: "off" }; const lb = $('[data-act=lockNow]'); if (lb) lb.hidden = isDemo(); setSync("ok"); render(); window.scrollTo(0, 0); Sync.schedule(400);
}
function clearScreen() { Sync.onLock(); S = null; $("#view").innerHTML = ""; $("#nav").innerHTML = ""; closeSheet(); $("#toast").hidden = true; }

/* ---------- analyse ---------- */
function totals(key) { const by = {}; let t = 0; for (const x of S.tx) if (x.d.startsWith(key)) { by[x.c] = (by[x.c] || 0) + x.a; t += x.a; } return { by, t }; }
const RANK = { ok: 0, proj: 1, near: 2, over: 3 };
function analyze(now = new Date()) {
  const key = mk(now), dim = daysIn(key), day = now.getDate(), rem = dim - day;
  const cur = totals(key);
  const prev = [1, 2, 3].map(i => addM(key, -i)).map(k => ({ k, ...totals(k) })).filter(p => p.t > 0);
  const cats = S.cats.map(c => {
    const spent = cur.by[c.id] || 0, hv = prev.map(p => p.by[c.id] || 0), avg = hv.length ? sum(hv) / hv.length : 0;
    let proj;
    if (c.fixed) proj = Math.max(spent, avg);
    else { const rate = day >= 7 ? (spent / day) * .7 + (avg / dim) * .3 : avg / dim; proj = spent + rate * rem; }
    const b = c.budget || 0; let lvl = "ok";
    if (b > 0) { if (spent > b) lvl = "over"; else if (spent / b >= S.thr / 100) lvl = "near"; else if (proj > b * 1.02) lvl = "proj"; }
    return { ...c, spent, avg, proj, lvl, ratio: b > 0 ? spent / b : 0 };
  });
  const totalBudget = sum(S.cats.map(c => c.budget || 0)), projT = sum(cats.map(c => c.proj));
  const weights = [.5, .3, .2]; let fc = projT;
  if (prev.length) { const w = weights.slice(0, prev.length); fc = sum(prev.map((p, i) => p.t * w[i])) / sum(w); }
  const trend = prev.length >= 2 ? (prev[0].t - (sum(prev.slice(1).map(p => p.t)) / (prev.length - 1))) / (sum(prev.slice(1).map(p => p.t)) / (prev.length - 1) || 1) : 0;
  return { now, key, dim, day, rem, spent: cur.t, byCat: cats, totalBudget, projT, fc, trend, prev, income: S.income || 0, left: totalBudget - cur.t, capacity: (S.income || 0) - projT, hasData: S.tx.length > 0 };
}
function alertsOf(A) {
  const out = [];
  for (const c of A.byCat) if (c.lvl !== "ok") out.push({ lvl: c.lvl, c });
  out.sort((a, b) => RANK[b.lvl] - RANK[a.lvl] || b.c.ratio - a.c.ratio);
  return out;
}
const LVL_TXT = { over: "Dépassé", near: "Bientôt atteint", proj: "Dépassement prévu" };
function goalInfo(g, A) {
  const left = Math.max(0, g.target - g.saved), mLeft = Math.max(1, monthsBetween(A.key, g.dl)), need = left / mLeft;
  const cap = Math.max(0, A.capacity), done = left <= 0;
  return { left, mLeft, need, done, ok: done || need <= cap, eta: !done && cap > 0 ? addM(A.key, Math.ceil(left / cap)) : null, p: Math.min(1, g.saved / (g.target || 1)) };
}
function tipsOf(A) {
  const tips = []; const catName = c => c.name;
  if (!A.hasData) return [{ lvl: "info", title: "Commencez par noter vos dépenses", text: "Appuyez sur « Dépense » pour enregistrer votre première dépense. Après quelques jours, Sika calcule vos prévisions et vous alerte avant que vous dépassiez vos budgets." }];
  for (const c of A.byCat) {
    if (c.lvl === "over") tips.push({ lvl: "bad", title: `${catName(c)} : budget dépassé`, text: `Vous avez dépensé ${fmt(c.spent)} pour un budget de ${fmt(c.budget)} (${fmt(c.spent - c.budget)} de trop). Évitez toute nouvelle dépense ici jusqu'à la fin du mois, ou prenez la différence sur une catégorie plus souple.` });
    else if (c.lvl === "near") tips.push({ lvl: "warn", title: `${catName(c)} : ${pct(c.ratio)} du budget utilisé`, text: `Il reste ${fmt(c.budget - c.spent)} pour ${A.rem} jour${A.rem > 1 ? "s" : ""}${A.rem > 0 ? `, soit ${fmt((c.budget - c.spent) / Math.max(1, A.rem))} par jour` : ""}.` });
    else if (c.lvl === "proj") tips.push({ lvl: "warn", title: `${catName(c)} : dépassement prévu`, text: `À ce rythme, vous finirez le mois à ${fmt(c.proj)} pour un budget de ${fmt(c.budget)}.${A.rem > 0 ? ` Limitez-vous à ${fmt((c.budget - c.spent) / A.rem)} par jour pour rester dans l'enveloppe.` : ""}` });
  }
  if (A.income > 0 && A.projT > A.income) tips.push({ lvl: "bad", title: "Déficit prévu ce mois-ci", text: `Vos dépenses prévues (${fmt(A.projT)}) dépassent votre revenu (${fmt(A.income)}). Il manque ${fmt(A.projT - A.income)} : réduisez d'abord les catégories variables comme les loisirs ou l'alimentation hors maison.` });
  if (A.income > 0) {
    const rate = A.capacity / A.income;
    if (rate >= .2) tips.push({ lvl: "ok", title: "Bon rythme d'épargne", text: `Vous devriez épargner environ ${fmt(A.capacity)} ce mois (${pct(rate)} du revenu). Mettez cette somme de côté dès le début du mois suivant, avant de dépenser.` });
    else if (rate >= 0 && A.projT <= A.income) tips.push({ lvl: "warn", title: "Épargne en dessous de 20 %", text: `Épargne prévue : ${fmt(A.capacity)} (${pct(rate)}). Pour atteindre 20 %, soit ${fmt(A.income * .2)}, il faudrait trouver ${fmt(Math.max(0, A.income * .2 - A.capacity))} d'économies.` });
  }
  const variable = A.byCat.filter(c => !c.fixed && c.spent > 0).sort((a, b) => b.spent - a.spent);
  if (variable[0] && A.spent > 0 && variable[0].spent / A.spent > .35) tips.push({ lvl: "info", title: `${catName(variable[0])} pèse ${pct(variable[0].spent / A.spent)} de vos dépenses`, text: `C'est votre plus gros poste variable (${fmt(variable[0].spent)}). Une baisse de 10 % libérerait ${fmt(variable[0].spent * .1)} ce mois, soit ${fmt(variable[0].spent * 1.2)} sur un an.` });
  for (const c of A.byCat) if (c.avg > 0 && c.spent > c.avg * 1.3 && c.spent - c.avg > 5000 && c.lvl === "ok") tips.push({ lvl: "info", title: `${catName(c)} en hausse`, text: `Déjà ${fmt(c.spent)} ce mois, contre ${fmt(c.avg)} en moyenne sur les mois précédents.` });
  const gs = S.goals.map(g => ({ g, i: goalInfo(g, A) })).filter(x => !x.i.done);
  const need = sum(gs.map(x => x.i.need));
  if (gs.length && need > Math.max(0, A.capacity)) tips.push({ lvl: "warn", title: "Objectifs d'épargne trop ambitieux", text: `Vos objectifs demandent ${fmt(need)} par mois, mais vous pouvez en mettre ${fmt(Math.max(0, A.capacity))} de côté. Repoussez une échéance ou réduisez une dépense variable de ${fmt(need - Math.max(0, A.capacity))}.` });
  if (!tips.length) tips.push({ lvl: "ok", title: "Tout est sous contrôle", text: "Aucun budget n'est menacé pour l'instant. Continuez à noter vos dépenses pour garder des prévisions fiables." });
  const order = { bad: 0, warn: 1, info: 2, ok: 3 };
  return tips.sort((a, b) => order[a.lvl] - order[b.lvl]);
}

/* ---------- graphiques ---------- */
function barChart(items, lines, label) {
  const W = 360, H = 190, pl = 6, pr = 6, pt = 18, pb = 24;
  const max = Math.max(1, ...items.map(i => i.v + (i.v2 || 0)), ...lines.map(l => l.v)) * 1.12;
  const bw = (W - pl - pr) / items.length, y = v => pt + (H - pt - pb) * (1 - v / max), by = H - pb;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><line class="base" x1="${pl}" x2="${W - pr}" y1="${by}" y2="${by}"/>`;
  items.forEach((it, i) => {
    const x = pl + i * bw + bw * .18, w = bw * .64, top = y(it.v);
    if (it.kind === "fc") s += `<rect class="b-fc" x="${x}" y="${top}" width="${w}" height="${Math.max(0, by - top)}" rx="3"/>`;
    else { s += `<rect class="b-act" x="${x}" y="${top}" width="${w}" height="${Math.max(0, by - top)}" rx="3"/>`; if (it.v2) s += `<rect class="b-proj" x="${x}" y="${y(it.v + it.v2)}" width="${w}" height="${Math.max(0, top - y(it.v + it.v2))}" rx="3"/>`; }
    s += `<text x="${x + w / 2}" y="${y(it.v + (it.v2 || 0)) - 4}" text-anchor="middle">${fmtK(it.v + (it.v2 || 0))}</text><text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(it.label)}</text>`;
  });
  for (const l of lines) s += `<line class="${l.cls}" x1="${pl}" x2="${W - pr}" y1="${y(l.v)}" y2="${y(l.v)}" stroke-width="1.5"/>`;
  return s + "</svg>";
}
function donut(parts, total, label) {
  const r = 42, C = 2 * Math.PI * r; let off = 0, s = `<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="${esc(label)}">`;
  for (const p of parts) { const len = total > 0 ? p.v / total * C : 0; s += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; }
  return s + `<text x="60" y="64" text-anchor="middle" font-size="15">${fmtK(total)}</text></svg>`;
}

/* ---------- interface ---------- */
const ICON = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  tx: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  bud: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  sav: '<path d="M5 12a7 6 0 0 1 12-4l3 0-1 3a5 5 0 0 1-2 3v3h-3v-2h-3v2H8v-3a6 6 0 0 1-3-2z"/><path d="M15 9.5h.01"/>',
  adv: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/>'
};
const TABS = [["home", "Accueil"], ["tx", "Dépenses"], ["bud", "Budgets"], ["stats", "Analyse"], ["sav", "Épargne"], ["adv", "Conseil"]];
let nowKey = mk(new Date());
let ui = { tab: "home", month: nowKey, seg: "bilan", cat: "all", dep: null, undo: null };
const catOf = id => S.cats.find(c => c.id === id) || S.cats.find(c => c.id === "aut") || S.cats[0];

function renderNav(A) {
  const n = alertsOf(A).filter(a => a.lvl !== "proj").length;
  $("#nav").innerHTML = TABS.map(([k, l]) => `<button data-act="tab" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>${l}${k === "home" && n ? `<span class="badge" aria-label="${n} alertes">${n}</span>` : ""}</button>`).join("");
}
function monthNav() {
  return `<div class="card mnav"><button class="icon-btn" data-act="mprev" aria-label="Mois précédent"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><b>${esc(monthLabel(ui.month))}</b><button class="icon-btn" data-act="mnext" aria-label="Mois suivant" ${ui.month >= nowKey ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
}
const demoBanner = () => isDemo() ? `<div class="banner"><span><b>Mode démo</b> : exemples stockés sur cet appareil, sans sauvegarde.</span><span style="display:flex;gap:6px;flex:none"><button class="btn ghost sm" data-act="cleardemo">Vider</button><button class="btn sm" data-act="exitdemo">Créer un compte</button></span></div>` : "";
const setupCard = () => (!isDemo() && !S.income) ? `<section class="card"><h2>Bienvenue ! Configurons votre budget</h2><p class="small muted" style="margin:0 0 12px">Indiquez votre revenu mensuel. Nous répartissons automatiquement des budgets par catégorie (modifiables ensuite dans Budgets) et gardons 15 % pour l'épargne.</p><div class="field"><label for="setinc">Revenu mensuel (${esc(S.cur)})</label><input type="text" id="setinc" inputmode="numeric" placeholder="ex. 350000"></div><button class="btn" data-act="setupinc">Enregistrer</button></section>` : "";

function viewHome(A) {
  const al = alertsOf(A), tips = tipsOf(A).slice(0, 2), lvl = A.left < 0 ? "over" : (A.spent / (A.totalBudget || 1) >= S.thr / 100 ? "near" : "ok");
  const daily = A.rem >= 0 && A.left > 0 ? A.left / (A.rem + 1) : 0, paceP = Math.min(100, A.day / A.dim * 100), usedP = Math.min(100, A.spent / (A.totalBudget || 1) * 100);
  const projLvl = A.totalBudget && A.projT > A.totalBudget ? "over" : "ok";
  const recent = [...S.tx].sort((a, b) => b.d.localeCompare(a.d) || 0).slice(0, 5);
  return `<div class="hello">${Auth.name() ? `Bonjour, <b>${esc(Auth.name())}</b>` : "Bonjour"}</div>${demoBanner()}${setupCard()}
  <section class="card hero"><div class="eyebrow">${A.left < 0 ? "Budget dépassé de" : "Reste à dépenser"} · ${esc(monthLabel(A.key))}</div>
    <div class="big">${fmtN(Math.abs(A.left))} <small>${esc(S.cur)}</small></div>
    <div class="bar ${lvl}" role="img" aria-label="${Math.round(usedP)} % du budget utilisé"><i style="width:${usedP}%"></i></div>
    <div class="row"><span>Dépensé <b>${fmt(A.spent)}</b></span><span>Budget <b>${fmt(A.totalBudget)}</b></span></div>
    <div class="chips">${daily > 0 ? `<span class="pill">${fmt(daily)} / jour possible</span>` : ""}<span class="pill ${projLvl}">Fin de mois prévue : ${fmt(A.projT)}</span><span class="pill">${A.rem} jour${A.rem > 1 ? "s" : ""} restant${A.rem > 1 ? "s" : ""}</span></div>
  </section>
  <div class="grid3"><div class="kpi"><div class="l">Revenu</div><div class="v">${fmtK(A.income)}</div></div><div class="kpi"><div class="l">Épargne prévue</div><div class="v" style="color:${A.capacity < 0 ? "var(--bad)" : "var(--ok)"}">${A.capacity < 0 ? "−" : ""}${fmtK(Math.abs(A.capacity))}</div></div><div class="kpi"><div class="l">Taux d'épargne</div><div class="v">${A.income ? pct(Math.max(0, A.capacity) / A.income) : "–"}</div></div></div>
  <section class="card"><h2>À surveiller</h2>${al.length ? `<div class="list">${al.slice(0, 4).map(a => `<div class="alert"><span class="pill ${a.lvl}">${LVL_TXT[a.lvl]}</span><div class="grow"><div class="t1">${esc(a.c.name)}</div><div class="t2">${fmt(a.c.spent)} sur ${fmt(a.c.budget)}${a.lvl === "proj" ? ` · prévu ${fmt(a.c.proj)}` : ""}</div></div></div>`).join("")}</div>` : `<div class="t2">Aucun budget menacé. Tout va bien.</div>`}</section>
  <section class="card"><h2>Le conseil du jour</h2>${tips.map(t => `<div class="tip ${t.lvl}"><div class="tt">${esc(t.title)}</div><p>${esc(t.text)}</p></div>`).join("")}<div style="margin-top:12px"><button class="btn ghost sm" data-act="tab" data-tab="adv">Tous les conseils</button></div></section>
  <section class="card"><h2>Dernières dépenses</h2>${recent.length ? `<div class="list">${recent.map(txRow).join("")}</div>` : `<div class="empty">Aucune dépense enregistrée.</div>`}</section>`;
}
function txRow(t) {
  const c = catOf(t.c);
  return `<div class="item"><span class="cb" style="--c:${c.color}">${esc(c.name.charAt(0))}</span><div class="grow"><div class="t1">${esc(t.n || c.name)}</div><div class="t2">${esc(c.name)} · ${esc(parseD(t.d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</div></div><div class="amt">−${fmtN(t.a)}</div><button class="x-btn" data-act="del" data-id="${t.id}" aria-label="Supprimer cette dépense"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
}
function viewTx() {
  let list = S.tx.filter(t => t.d.startsWith(ui.month) && (ui.cat === "all" || t.c === ui.cat)).sort((a, b) => b.d.localeCompare(a.d));
  const groups = {}; list.forEach(t => (groups[t.d] = groups[t.d] || []).push(t));
  const total = sum(list.map(t => t.a));
  return `${monthNav()}
  <div class="card"><div class="field" style="margin:0"><label for="fcat">Catégorie</label><select id="fcat"><option value="all">Toutes les catégories</option>${S.cats.map(c => `<option value="${c.id}" ${ui.cat === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
  <div class="row"><span>${list.length} dépense${list.length > 1 ? "s" : ""}</span><span>Total <b>${fmt(total)}</b></span></div></div>
  ${list.length ? Object.keys(groups).map(d => `<section class="card"><div class="dayh" style="padding-top:0"><span>${esc(dayLabel(d))}</span><span class="num">${fmt(sum(groups[d].map(t => t.a)))}</span></div><div class="list">${groups[d].map(txRow).join("")}</div></section>`).join("") : `<div class="card empty">Aucune dépense pour cette sélection.</div>`}`;
}
function viewBud(A) {
  const un = A.income - A.totalBudget;
  return `${demoBanner()}
  <section class="card"><h2>Mon revenu et mes budgets</h2>
    <div class="grid3"><div class="kpi"><div class="l">Revenu</div><div class="v">${fmtK(A.income)}</div></div><div class="kpi"><div class="l">Budgets</div><div class="v">${fmtK(A.totalBudget)}</div></div><div class="kpi"><div class="l">Non affecté</div><div class="v" style="color:${un < 0 ? "var(--bad)" : "var(--ok)"}">${un < 0 ? "−" : ""}${fmtK(Math.abs(un))}</div></div></div>
    <p class="small muted" style="margin:10px 0 0">${un < 0 ? "Vos budgets dépassent votre revenu : revoyez-les à la baisse." : `Ce montant non affecté peut aller à l'épargne. Visez au moins ${fmt(A.income * .2)} (20 % du revenu).`}</p></section>
  <section class="card"><h2>Budget mensuel par catégorie</h2><div class="list">${A.byCat.map(c => `<div class="bitem"><div class="brow"><span class="cb" style="--c:${c.color}">${esc(c.name.charAt(0))}</span><div class="grow"><div class="t1">${esc(c.name)}${c.fixed ? ' <span class="small muted">· fixe</span>' : ""}</div><div class="t2">${fmtN(c.spent)} dépensés${c.budget ? ` · ${pct(c.ratio)}` : ""}</div></div><input class="bud-in" type="text" inputmode="numeric" data-bud="${c.id}" value="${c.budget || 0}" aria-label="Budget ${esc(c.name)}"></div><div class="bar thin ${c.lvl}"><i style="width:${Math.min(100, c.ratio * 100)}%"></i></div></div>`).join("")}</div></section>`;
}
function viewStats(A) {
  const seg = `<div class="seg" role="group" aria-label="Type d'analyse"><button data-act="seg" data-seg="bilan" aria-pressed="${ui.seg === "bilan"}">Bilan</button><button data-act="seg" data-seg="prev" aria-pressed="${ui.seg === "prev"}">Prévisions</button></div>`;
  return seg + (ui.seg === "bilan" ? statsBilan(A) : statsPrev(A));
}
function statsBilan(A) {
  const tt = totals(ui.month), prevKey = addM(ui.month, -1), pt = totals(prevKey).t, isCur = ui.month === A.key;
  const days = isCur ? A.day : daysIn(ui.month), avgDay = tt.t / days, delta = pt > 0 ? (tt.t - pt) / pt : null;
  const parts = S.cats.map(c => ({ name: c.name, color: c.color, v: tt.by[c.id] || 0, b: c.budget })).filter(p => p.v > 0).sort((a, b) => b.v - a.v);
  const wd = [0, 0, 0, 0, 0, 0, 0], names = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  S.tx.filter(t => t.d.startsWith(ui.month)).forEach(t => { const g = (parseD(t.d).getDay() + 6) % 7; wd[g] += t.a; }); const wmax = Math.max(1, ...wd);
  const top = S.tx.filter(t => t.d.startsWith(ui.month)).sort((a, b) => b.a - a.a).slice(0, 5);
  const hist = [5, 4, 3, 2, 1, 0].map(i => { const k = addM(ui.month, -i); return { label: monthShort(k), v: totals(k).t, kind: "act" }; });
  return `${monthNav()}
  <div class="grid3"><div class="kpi"><div class="l">Total</div><div class="v">${fmtK(tt.t)}</div></div><div class="kpi"><div class="l">Par jour</div><div class="v">${fmtK(avgDay)}</div></div><div class="kpi"><div class="l">vs mois préc.</div><div class="v" style="color:${delta === null ? "var(--muted)" : delta > 0 ? "var(--bad)" : "var(--ok)"}">${delta === null ? "–" : (delta > 0 ? "+" : "") + Math.round(delta * 100) + " %"}</div></div></div>
  <section class="card"><h2>Où part l'argent</h2>${parts.length ? `<div class="donut-wrap">${donut(parts, tt.t, "Répartition des dépenses par catégorie")}<div class="grow list" style="min-width:150px">${parts.slice(0, 6).map(p => `<div class="item" style="padding:6px 0"><span class="dot" style="background:${p.color}"></span><div class="grow t2" style="color:var(--ink)">${esc(p.name)}</div><div class="t2 num">${pct(p.v / tt.t)}</div></div>`).join("")}</div></div>` : `<div class="empty">Pas de dépenses ce mois-ci.</div>`}</section>
  <section class="card"><h2>Les six derniers mois</h2>${barChart(hist, [{ v: A.income, cls: "ln-inc" }, { v: A.totalBudget, cls: "ln-bud" }], "Dépenses des six derniers mois")}<div class="legend"><span style="--c:var(--accent)">Dépenses</span><span style="--c:var(--ok)">Revenu</span><span style="--c:var(--warn)">Budget total</span></div></section>
  <section class="card"><h2>Jours de la semaine</h2>${wd.map((v, i) => `<div class="hbar"><span>${names[i]}</span><div class="bar"><i style="width:${v / wmax * 100}%"></i></div><span class="num">${fmtK(v)}</span></div>`).join("")}</section>
  <section class="card"><h2>Plus grosses dépenses</h2>${top.length ? `<div class="list">${top.map(txRow).join("")}</div>` : `<div class="empty">Rien à afficher.</div>`}</section>`;
}
function statsPrev(A) {
  const hist = [4, 3, 2, 1].map(i => { const k = addM(A.key, -i); return { label: monthShort(k), v: totals(k).t, kind: "act" }; });
  const items = [...hist, { label: monthShort(A.key), v: A.spent, v2: Math.max(0, A.projT - A.spent), kind: "act" }, ...[1, 2, 3].map(i => ({ label: monthShort(addM(A.key, i)), v: A.fc, kind: "fc" }))];
  const ins = A.byCat.filter(c => c.proj > 0).sort((a, b) => b.proj - a.proj);
  const trendTxt = A.prev.length >= 2 ? (A.trend > .05 ? `Vos dépenses augmentent (${Math.round(A.trend * 100)} % de plus que la moyenne des mois d'avant).` : A.trend < -.05 ? `Vos dépenses baissent (${Math.abs(Math.round(A.trend * 100))} % de moins que la moyenne des mois d'avant).` : "Vos dépenses sont stables d'un mois à l'autre.") : "Il faut au moins deux mois d'historique pour dégager une tendance.";
  let cum = 0;
  const rows = [1, 2, 3].map(i => { const sv = A.income - A.fc; cum += sv; return `<tr><td>${esc(cap1(monthLabel(addM(A.key, i))))}</td><td class="r">${fmtN(A.fc)}</td><td class="r" style="color:${sv < 0 ? "var(--bad)" : "var(--ok)"}">${sv < 0 ? "−" : ""}${fmtN(Math.abs(sv))}</td><td class="r">${cum < 0 ? "−" : ""}${fmtN(Math.abs(cum))}</td></tr>`; }).join("");
  return `<section class="card"><div class="eyebrow">Fin ${esc(monthLabel(A.key))}</div><div class="big">${fmtN(A.projT)} <small>${esc(S.cur)}</small></div>
    <div class="chips"><span class="pill ${A.totalBudget && A.projT > A.totalBudget ? "over" : "ok"}">${A.totalBudget ? (A.projT > A.totalBudget ? `${fmt(A.projT - A.totalBudget)} au-dessus du budget` : `${fmt(A.totalBudget - A.projT)} sous le budget`) : "Aucun budget défini"}</span><span class="pill ${A.capacity < 0 ? "over" : "ok"}">${A.capacity < 0 ? "Déficit" : "Épargne"} : ${fmt(Math.abs(A.capacity))}</span></div>
    <p class="small muted" style="margin:12px 0 0">Calcul : ce que vous avez déjà dépensé, plus le rythme des jours écoulés pour les dépenses variables. Les charges fixes (loyer, factures) sont estimées d'après vos mois précédents.</p></section>
  <section class="card"><h2>Évolution et projection</h2>${barChart(items, [{ v: A.income, cls: "ln-inc" }, { v: A.totalBudget, cls: "ln-bud" }], "Dépenses passées et prévisions des trois prochains mois")}<div class="legend"><span style="--c:var(--accent)">Réel</span><span style="--c:#9fd1d6">Reste du mois (prévu)</span><span style="--c:var(--accent-soft);outline:0">Mois à venir</span><span style="--c:var(--ok)">Revenu</span><span style="--c:var(--warn)">Budget</span></div><p class="small muted" style="margin:10px 0 0">${esc(trendTxt)}</p></section>
  <section class="card"><h2>Les trois prochains mois</h2><div class="scroll-x"><table><thead><tr><th>Mois</th><th class="r">Dépenses</th><th class="r">Épargne</th><th class="r">Cumul</th></tr></thead><tbody>${rows}</tbody></table></div><p class="small muted" style="margin:10px 0 0">Prévision fondée sur la moyenne pondérée de vos trois derniers mois complets.</p></section>
  <section class="card"><h2>Prévision par catégorie</h2><div class="scroll-x"><table><thead><tr><th>Catégorie</th><th class="r">Prévu</th><th class="r">Budget</th></tr></thead><tbody>${ins.map(c => `<tr><td><span class="dot" style="background:${c.color};display:inline-block;margin-right:8px"></span>${esc(c.name)}</td><td class="r" style="color:${c.budget && c.proj > c.budget ? "var(--bad)" : "inherit"}">${fmtN(c.proj)}</td><td class="r">${fmtN(c.budget)}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">Pas encore de données.</td></tr>'}</tbody></table></div></section>`;
}
function viewSav(A) {
  const cap = Math.max(0, A.capacity), gs = S.goals.map(g => ({ g, i: goalInfo(g, A) })), need = sum(gs.filter(x => !x.i.done).map(x => x.i.need));
  const target20 = A.income * .2;
  return `${demoBanner()}
  <section class="card"><div class="eyebrow">Épargne possible ce mois</div><div class="big" style="color:${A.capacity < 0 ? "var(--bad)" : "var(--ink)"}">${A.capacity < 0 ? "−" : ""}${fmtN(Math.abs(A.capacity))} <small>${esc(S.cur)}</small></div>
    <div class="bar ${A.capacity >= target20 ? "ok" : "near"}" role="img" aria-label="Objectif d'épargne de 20 %"><i style="width:${Math.min(100, cap / (target20 || 1) * 100)}%"></i></div>
    <div class="row"><span>Taux <b>${A.income ? pct(Math.max(0, A.capacity) / A.income) : "–"}</b></span><span>Objectif 20 % <b>${fmt(target20)}</b></span></div>
    <p class="small muted" style="margin:10px 0 0">Astuce : virez cette somme vers un compte séparé (épargne ou mobile money dédié) dès la réception de votre revenu, puis dépensez le reste.</p></section>
  <section class="card"><h2>Mes objectifs</h2>${gs.length ? gs.map(({ g, i }) => `<div class="tip" style="background:transparent;padding:12px 0;border:0;border-top:1px solid var(--line);border-radius:0">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div class="t1">${esc(g.name)}</div><span class="pill ${i.done ? "ok" : i.ok ? "ok" : "warn"}">${i.done ? "Atteint" : i.ok ? "En bonne voie" : "En retard"}</span></div>
      <div class="bar" style="margin:10px 0 6px"><i style="width:${i.p * 100}%"></i></div>
      <div class="row" style="margin:0"><span><b>${fmt(g.saved)}</b> sur ${fmt(g.target)}</span><span>${pct(i.p)}</span></div>
      <p class="small muted" style="margin:8px 0 0">${i.done ? "Objectif atteint, bravo." : `Pour tenir ${esc(cap1(monthLabel(g.dl)))} : ${fmt(i.need)} par mois.${i.eta ? ` Au rythme actuel : ${esc(monthLabel(i.eta))}.` : ""}`}</p>
      ${ui.dep === g.id ? `<div class="inline-form"><input type="text" id="depamt" inputmode="numeric" placeholder="Montant versé" aria-label="Montant versé"><button class="btn sm" data-act="depok" data-id="${g.id}">Valider</button></div>` : `<div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm" data-act="dep" data-id="${g.id}">Verser</button><button class="btn ghost sm" data-act="goaldel" data-id="${g.id}">Supprimer</button></div>`}</div>`).join("") : `<div class="empty">Aucun objectif. Créez-en un pour savoir combien mettre de côté chaque mois.</div>`}
    ${gs.length ? `<p class="small muted" style="margin:6px 0 0">Total requis : <b>${fmt(need)}</b> par mois · capacité prévue : <b>${fmt(cap)}</b>.</p>` : ""}
    <div style="margin-top:12px"><button class="btn" data-act="goaladd">Nouvel objectif</button></div></section>
  <section class="card"><h2>Idées pour épargner plus</h2>${savIdeas(A)}</section>`;
}
function savIdeas(A) {
  const v = A.byCat.filter(c => !c.fixed && c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 3);
  if (!v.length) return `<div class="t2">Ajoutez quelques dépenses pour obtenir des pistes personnalisées.</div>`;
  return v.map(c => `<div class="tip"><div class="tt">Réduire ${esc(c.name)} de 10 %</div><p>Gain d'environ ${fmt(c.spent * .1)} ce mois, soit ${fmt(c.spent * 1.2)} par an.</p></div>`).join("");
}
function viewAdv(A) {
  const tips = tipsOf(A);
  return `<section class="card"><h2>Mon conseiller</h2>${tips.map(t => `<div class="tip ${t.lvl}"><div class="tt">${esc(t.title)}</div><p>${esc(t.text)}</p></div>`).join("")}<p class="small muted" style="margin:12px 0 0">Conseils indicatifs calculés à partir de vos propres chiffres. Ils ne remplacent pas l'avis d'un professionnel.</p></section>`;
}
function render() {
  if (!S) return; const A = analyze();
  const v = { home: viewHome, tx: viewTx, bud: viewBud, stats: viewStats, sav: viewSav, adv: viewAdv }[ui.tab];
  $("#view").innerHTML = v(A); renderNav(A);
  const fab = $("#fab"), fm = { bud: ["addbud", "Budget"], sav: ["goaladd", "Objectif"] }[ui.tab] || ["add", "Dépense"];
  fab.dataset.act = fm[0]; fab.lastChild.textContent = fm[1];
}

/* ---------- feuilles (formulaires) ---------- */
function openSheet(html, focusSel) {
  const sh = $("#sheet"); sh.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`; sh.hidden = false;
  const f = focusSel && $(focusSel, sh); if (f) setTimeout(() => f.focus(), 30);
}
function closeSheet() { const sh = $("#sheet"); sh.hidden = true; sh.innerHTML = ""; }
let lastCat = "ali";
function sheetAdd() {
  openSheet(`<h2>Nouvelle dépense</h2><form id="fadd">
    <div class="field"><label for="amt">Montant (${esc(S.cur)})</label><input class="amount-in" type="text" id="amt" inputmode="decimal" placeholder="0" autocomplete="off" required></div>
    <div class="field"><span class="lbl">Catégorie</span><div class="cats">${S.cats.map(c => `<span><input type="radio" name="cat" id="c-${c.id}" value="${c.id}" ${c.id === lastCat ? "checked" : ""}><label for="c-${c.id}"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</label></span>`).join("")}</div></div>
    <div class="field"><label for="dte">Date</label><input type="date" id="dte" value="${ymd(new Date())}"></div>
    <div class="field"><label for="note">Note (facultatif)</label><input type="text" id="note" placeholder="Ex. Marché d'Adjamé" maxlength="60"></div>
    <div class="actions"><button type="button" class="btn ghost" data-act="close">Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form>`, "#amt");
  $("#fadd").addEventListener("submit", e => {
    e.preventDefault(); const a = num($("#amt").value);
    if (!(a > 0)) { $("#amt").setAttribute("aria-invalid", "true"); $("#amt").focus(); return; }
    const c = ($("input[name=cat]:checked") || {}).value || "aut", d = $("#dte").value || ymd(new Date()); lastCat = c;
    const before = analyze(); S.tx.push({ id: uid(), d, a: Math.round(a), c, n: $("#note").value.trim() }); if (S.tx.length > 2500) S.tx = S.tx.sort((x, y) => y.d.localeCompare(x.d)).slice(0, 2500);
    const after = analyze(); persist(); closeSheet(); render();
    const b = before.byCat.find(x => x.id === c), f = after.byCat.find(x => x.id === c);
    if (f && RANK[f.lvl] > RANK[b.lvl]) toast(`Alerte ${f.name} : ${f.lvl === "over" ? "budget dépassé de " + fmt(f.spent - f.budget) : f.lvl === "near" ? pct(f.ratio) + " du budget utilisé" : "dépassement prévu à " + fmt(f.proj)}`, 7000);
    else if (before.totalBudget && before.left >= 0 && after.left < 0) toast("Alerte : votre budget total du mois est dépassé.", 7000);
    else toast(`Dépense de ${fmt(Math.round(a))} enregistrée`);
  });
}
function sheetSettings() {
  openSheet(`<h2>Paramètres</h2><form id="fset">
    <div class="field"><label for="s-inc">Revenu mensuel (${esc(S.cur)})</label><input type="text" id="s-inc" inputmode="numeric" value="${S.income}"></div>
    <div class="field"><label for="s-cur">Devise</label><input type="text" id="s-cur" value="${esc(S.cur)}" maxlength="6"></div>
    <div class="field"><label for="s-thr">Alerte quand un budget atteint (%)</label><input type="text" id="s-thr" inputmode="numeric" value="${S.thr}"></div>
    <div class="actions"><button type="button" class="btn ghost" data-act="close">Fermer</button><button class="btn" type="submit">Enregistrer</button></div></form>
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
    <div class="lbl" style="margin-bottom:8px">Mes données</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${isDemo() ? '<button class="btn ghost sm" data-act="loaddemo">Recharger les exemples</button>' : ""}<button class="btn ghost sm" data-act="reset1" id="resetbtn">Tout effacer</button></div>
    <p class="small muted">Les alertes apparaissent dans l'application, à l'ouverture et à chaque dépense ajoutée.</p>
    ${cloudBlock()}
    ${isDemo() ? "" : `<hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
    <div class="lbl" style="margin-bottom:8px">Sécurité</div>
    <div class="field"><label for="s-lock">Verrouillage automatique</label><select id="s-lock">${[[0, "Dès que je quitte l'application"], [1, "Après 1 minute"], [2, "Après 2 minutes"], [5, "Après 5 minutes"], [15, "Après 15 minutes"]].map(([m, l]) => `<option value="${m}" ${Lock.delay() === m ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="lockNow">Verrouiller maintenant</button><button class="btn ghost sm" data-act="chpin">Changer le PIN</button></div>`}`, "#s-inc");
  $("#fset").addEventListener("submit", e => {
    e.preventDefault(); const i = num($("#s-inc").value), t = num($("#s-thr").value);
    if (i >= 0) S.income = Math.round(i); if (t >= 50 && t <= 100) S.thr = Math.round(t); S.cur = $("#s-cur").value.trim() || "FCFA";
    persist(); closeSheet(); render(); toast("Paramètres enregistrés");
  });
}
function cloudBlock() {
  const hr = '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><div class="lbl" style="margin-bottom:8px">Compte</div>';
  if (isDemo()) return `${hr}<p class="small muted" style="margin:0 0 10px">Vous êtes en mode démo : rien n'est sauvegardé dans le cloud. Créez un compte pour garder vos vraies données et les retrouver sur tous vos appareils.</p><button class="btn sm" data-act="exitdemo">Créer un compte ou me connecter</button>`;
  const c = S.cloud || {};
  const t = c.lastSync ? new Date(c.lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "pas encore";
  const msg = cloudSt.state === "error" || cloudSt.state === "auth" ? `<br><b style="color:var(--bad)">${esc(cloudSt.msg || (cloudSt.state === "auth" ? "Session expirée : déconnectez-vous puis reconnectez-vous." : "Erreur de synchronisation."))}</b>` : "";
  return `${hr}<p class="small" style="margin:0 0 10px"><b>${esc(c.username || "")}</b> · ${esc(c.email || "")}<br><span class="muted">État : ${esc(cloudLabel())} · dernière synchro : ${esc(t)}</span>${msg}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="cloudsync">Synchroniser maintenant</button><button class="btn ghost sm" data-act="logout">Se déconnecter</button></div>
    <p class="small muted">Vos données sont sauvegardées automatiquement et partagées entre vos appareils. « Tout effacer » s'applique aussi au cloud.</p>`;
}
function sheetGoal() {
  openSheet(`<h2>Nouvel objectif</h2><form id="fgoal">
    <div class="field"><label for="g-name">Nom</label><input type="text" id="g-name" placeholder="Ex. Rentrée scolaire" maxlength="40" required></div>
    <div class="field"><label for="g-tar">Montant à atteindre (${esc(S.cur)})</label><input type="text" id="g-tar" inputmode="numeric" required></div>
    <div class="field"><label for="g-sav">Déjà mis de côté</label><input type="text" id="g-sav" inputmode="numeric" value="0"></div>
    <div class="field"><label for="g-dl">Échéance</label><input type="month" id="g-dl" value="${addM(nowKey, 6)}" min="${addM(nowKey, 1)}"></div>
    <div class="actions"><button type="button" class="btn ghost" data-act="close">Annuler</button><button class="btn" type="submit">Créer</button></div></form>`, "#g-name");
  $("#fgoal").addEventListener("submit", e => {
    e.preventDefault(); const tar = num($("#g-tar").value), sv = num($("#g-sav").value) || 0;
    if (!(tar > 0)) { $("#g-tar").focus(); return; }
    S.goals.push({ id: uid(), name: $("#g-name").value.trim() || "Objectif", target: Math.round(tar), saved: Math.max(0, Math.round(sv)), dl: $("#g-dl").value || addM(nowKey, 6) });
    persist(); closeSheet(); render(); toast("Objectif créé");
  });
}
function sheetBudget() {
  openSheet(`<h2>Ajouter un budget</h2><form id="fbud">
    <div class="field"><label for="b-name">Catégorie</label><input type="text" id="b-name" list="b-list" placeholder="Choisir ou créer (ex. Abonnements)" maxlength="40" autocomplete="off" required><datalist id="b-list">${S.cats.map(c => `<option value="${esc(c.name)}">`).join("")}</datalist></div>
    <div class="field"><label for="b-amt">Budget mensuel (${esc(S.cur)})</label><input class="amount-in" type="text" id="b-amt" inputmode="numeric" placeholder="0" required></div>
    <p class="small muted" style="margin:0 0 12px">Si la catégorie existe déjà, son budget est mis à jour. Sinon, elle est créée.</p>
    <div class="actions"><button type="button" class="btn ghost" data-act="close">Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form>`, "#b-name");
  $("#fbud").addEventListener("submit", e => {
    e.preventDefault(); const n = $("#b-name").value.trim(), v = num($("#b-amt").value);
    if (!n) { $("#b-name").focus(); return; } if (!(v >= 0)) { $("#b-amt").focus(); return; }
    const ex = S.cats.find(c => c.name.toLowerCase() === n.toLowerCase());
    if (ex) ex.budget = Math.round(v); else S.cats.push({ id: "c" + uid(), name: n, budget: Math.round(v), color: COLORS[S.cats.length % COLORS.length] });
    persist(); closeSheet(); render(); toast(ex ? `Budget ${ex.name} mis à jour` : `Catégorie « ${n} » créée`);
  });
}
let tt = 0;
function toast(msg, ms = 3500, action) {
  const t = $("#toast"); t.hidden = false; t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button data-act="undo">${esc(action)}</button>` : ""}`; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- événements ---------- */
let resetArmed = false;
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) { if (e.target.id === "sheet") closeSheet(); return; }
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case "tab": ui.tab = el.dataset.tab; ui.month = ui.tab === "home" ? ui.month : ui.month; render(); window.scrollTo(0, 0); break;
    case "add": sheetAdd(); break;
    case "addbud": sheetBudget(); break;
    case "settings": sheetSettings(); break;
    case "close": closeSheet(); break;
    case "cloudsync": Sync.schedule(0); toast("Synchronisation lancée"); break;
    case "logout": {
      if (!el.dataset.armed) {
        const n = Sync.pending(); el.dataset.armed = "1"; el.classList.add("danger"); el.classList.remove("ghost");
        el.textContent = n > 0 ? `${n} modification${n > 1 ? "s" : ""} non synchronisée${n > 1 ? "s" : ""} : confirmer quand même` : "Confirmer la déconnexion";
        if (n > 0) Sync.schedule(0);
      } else { closeSheet(); Lock.logout(); }
      break;
    }
    case "exitdemo": if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Les données de la démo seront supprimées : confirmer"; } else { closeSheet(); Lock.exitDemo(); } break;
    case "setupinc": { const v = num($("#setinc").value); if (!(v > 0)) { $("#setinc").focus(); break; } S.income = Math.round(v); suggestBudgets(S.income); persist(); render(); toast("Budget configuré. Ajustez-le dans Budgets."); break; }
    case "mprev": ui.month = addM(ui.month, -1); render(); break;
    case "mnext": if (ui.month < nowKey) { ui.month = addM(ui.month, 1); render(); } break;
    case "seg": ui.seg = el.dataset.seg; render(); break;
    case "del": { const i = S.tx.findIndex(t => t.id === id); if (i >= 0) { ui.undo = S.tx.splice(i, 1)[0]; persist(); render(); toast("Dépense supprimée", 6000, "Annuler"); } break; }
    case "undo": if (ui.undo) { S.tx.push(ui.undo); ui.undo = null; persist(); render(); $("#toast").hidden = true; } break;
    case "addcat": { const n = $("#newcat").value.trim(), b = num($("#newcatb").value) || 0; if (!n) { $("#newcat").focus(); break; } S.cats.push({ id: "c" + uid(), name: n, budget: Math.max(0, Math.round(b)), color: COLORS[S.cats.length % COLORS.length] }); persist(); render(); toast("Catégorie ajoutée"); break; }
    case "goaladd": sheetGoal(); break;
    case "goaldel": S.goals = S.goals.filter(g => g.id !== id); persist(); render(); break;
    case "dep": ui.dep = id; render(); setTimeout(() => { const i = $("#depamt"); if (i) i.focus(); }, 20); break;
    case "depok": { const v = num($("#depamt").value), g = S.goals.find(x => x.id === id); if (g && v > 0) { g.saved += Math.round(v); ui.dep = null; persist(); render(); toast(`${fmt(v)} ajoutés à « ${g.name} »`); } break; }
    case "cleardemo": S.tx = S.tx.filter(t => !t.x); S.goals = S.goals.filter(g => !g.x); persist(); render(); toast("Exemples supprimés. Essayez d'ajouter vos propres dépenses."); break;
    case "loaddemo": { const d = demoData(new Date()); S.tx = S.tx.filter(t => !t.x).concat(d.tx); S.goals = S.goals.filter(g => !g.x).concat(d.goals); persist(); closeSheet(); render(); toast("Exemples chargés"); break; }
    case "reset1": if (!resetArmed) { resetArmed = true; el.textContent = "Confirmer l'effacement"; el.classList.add("danger"); el.classList.remove("ghost"); } else { resetArmed = false; const cl = S.cloud; S = isDemo() ? freshState() : freshCloudState(); if (cl) S.cloud = cl; persist(); closeSheet(); render(); toast("Toutes les données ont été effacées"); } break;
  }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset && t.dataset.bud) { const c = S.cats.find(x => x.id === t.dataset.bud), v = num(t.value); if (c && v >= 0) { c.budget = Math.round(v); persist(); render(); } else if (c) t.value = c.budget; }
  else if (t.id === "fcat") { ui.cat = t.value; render(); }
  else if (t.id === "s-lock") Lock.setDelay(Number(t.value));
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

function sheetPin() {
  openSheet(`<h2>Changer le PIN</h2><form id="fpin">
    <div class="field"><label for="p-old">PIN actuel</label><input type="password" id="p-old" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" required></div>
    <div class="field"><label for="p-new">Nouveau PIN (6 chiffres)</label><input type="password" id="p-new" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" required></div>
    <div class="field"><label for="p-new2">Confirmer le nouveau PIN</label><input type="password" id="p-new2" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" required></div>
    <p class="small muted" id="p-err" role="alert" style="min-height:20px;color:var(--bad);margin:0 0 8px"></p>
    <div class="actions"><button type="button" class="btn ghost" data-act="close">Annuler</button><button class="btn" type="submit">Changer</button></div></form>`, "#p-old");
  $("#fpin").addEventListener("submit", async e => {
    e.preventDefault(); const o = $("#p-old").value, n = $("#p-new").value, n2 = $("#p-new2").value, er = $("#p-err");
    if (!/^\d{6}$/.test(n)) { er.textContent = "Le nouveau PIN doit avoir 6 chiffres."; return; }
    if (n !== n2) { er.textContent = "Les deux nouveaux PIN sont différents."; return; }
    if (Lock.weak(n)) { er.textContent = "PIN trop simple. Évitez 123456 ou 111111."; return; }
    try { await flushNow(); await Sync.changePin(o, n); saveQuiet(); closeSheet(); toast("PIN modifié"); }
    catch (x) { er.textContent = x && x.code === "bad_pin" ? "Le PIN actuel est incorrect." : x && x.message || "Impossible de changer le PIN."; }
  });
}

/* ---------- synchronisation : branchement et déclencheurs ---------- */
Sync.init({
  state: () => S,
  saveQuiet,
  changed: () => { if (S) render(); },
  status: st => { cloudSt = st; if (S) setSync("ok"); }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) Sync.schedule(300); });
window.addEventListener("online", () => Sync.schedule(300));
setInterval(() => { if (!document.hidden) Sync.schedule(0); }, 60000);
