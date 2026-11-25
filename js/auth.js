/* Accès et stockage local.
   - Compte réel (cloud) : l'appareil garde un coffre chiffré (AES-GCM) ; la clé est dérivée du PIN
     (PBKDF2). Le PIN n'est jamais enregistré. Un mauvais PIN ne déchiffre rien.
   - Mode démo : données d'exemple en clair sur l'appareil, sans PIN ni synchronisation.
   Pour qu'un nouvel appareil puisse vérifier le PIN à la première connexion, un hash du PIN
   (sel aléatoire + PBKDF2) est aussi enregistré dans le profil cloud : voir pinHash(). */
const Auth = (() => {
  const K_ACCT = "sika2:account", K_VAULT = "sika2:vault", K_FAIL = "sika2:fails", K_DEMO = "sika2:demo";
  const LEGACY = ["sika:account", "sika:vault", "sika:fails"];
  const ITER = 310000, enc = new TextEncoder(), dec = new TextDecoder();
  let key = null, acct = null, demoOn = false;

  const b64 = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { throw { code: "storage", message: "Stockage de l'appareil indisponible" }; } };
  const rm = k => { try { localStorage.removeItem(k); } catch (e) { } };
  const readJSON = k => { try { return JSON.parse(rd(k)); } catch (e) { return null; } };

  async function derive(pin, salt, iter) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function seal(obj, k) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(obj)));
    return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) });
  }
  async function open(txt, k) {
    const o = JSON.parse(txt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, k, unb64(o.ct));
    return JSON.parse(dec.decode(pt));
  }

  /* Limite les essais de PIN : 5 erreurs, puis 30 s, 60 s, 120 s... (plafond 1 h). */
  const fails = () => readJSON(K_FAIL) || { n: 0, until: 0 };
  function waitLeft() { const f = fails(); return Math.max(0, Math.ceil((f.until - Date.now()) / 1000)); }
  function failed() { const f = fails(); f.n++; if (f.n >= 5) f.until = Date.now() + Math.min(3600, 30 * Math.pow(2, f.n - 5)) * 1000; wr(K_FAIL, JSON.stringify(f)); }
  const cleared = () => rm(K_FAIL);

  return {
    /* ----- état ----- */
    account: () => acct || readJSON(K_ACCT),
    hasCloud() { return !!readJSON(K_ACCT) && !!rd(K_VAULT); },
    hasDemo() { return !!rd(K_DEMO); },
    mode() { return demoOn ? "demo" : "cloud"; },
    name() { return demoOn ? "" : ((acct || readJSON(K_ACCT) || {}).username || ""); },
    unlocked() { return !!key || demoOn; },
    waitLeft,
    randomSalt: () => b64(crypto.getRandomValues(new Uint8Array(16))),

    /* Hash du PIN pour la vérification sur un autre appareil (≠ clé de chiffrement du coffre). */
    async pinHash(pin, saltB64) {
      const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(saltB64), iterations: 210000, hash: "SHA-256" }, base, 256);
      return b64(bits);
    },

    /* ----- démo ----- */
    startDemo(state) { demoOn = true; key = null; wr(K_DEMO, JSON.stringify(state)); return state; },
    loadDemo() { const s = readJSON(K_DEMO); if (!s) return null; demoOn = true; key = null; return s; },
    exitDemo() { demoOn = false; rm(K_DEMO); },

    /* ----- compte réel ----- */
    async create(info, pin, state) {
      demoOn = false;
      const salt = crypto.getRandomValues(new Uint8Array(16));
      key = await derive(pin, salt, ITER);
      acct = { mode: "cloud", username: info.username, email: info.email, uid: info.uid, salt: b64(salt), iter: ITER, created: Date.now() };
      wr(K_VAULT, await seal(state, key)); wr(K_ACCT, JSON.stringify(acct)); cleared();
      return state;
    },
    async unlock(pin) {
      const a = readJSON(K_ACCT), v = rd(K_VAULT);
      if (!a || !v) throw { code: "none" };
      const w = waitLeft(); if (w > 0) throw { code: "locked", wait: w };
      const k = await derive(pin, unb64(a.salt), a.iter || ITER);
      try { const st = await open(v, k); key = k; acct = a; demoOn = false; cleared(); return st; }
      catch (e) { failed(); throw { code: "bad_pin", wait: waitLeft() }; }
    },
    async write(state) {
      if (demoOn) { wr(K_DEMO, JSON.stringify(state)); return; }
      if (!key) throw { code: "locked" };
      wr(K_VAULT, await seal(state, key));
    },
    lock() { key = null; },
    /* Vérifie le PIN actuel sans toucher au compteur d'essais. */
    async verifyPin(pin) {
      const a = readJSON(K_ACCT), v = rd(K_VAULT); if (!a || !v) return false;
      try { await open(v, await derive(pin, unb64(a.salt), a.iter || ITER)); return true; } catch (e) { return false; }
    },
    /* Change la clé du coffre (nouveau PIN). L'ancien PIN doit avoir été vérifié avant. */
    async rekey(newPin, state) {
      const a = readJSON(K_ACCT), salt = crypto.getRandomValues(new Uint8Array(16)), nk = await derive(newPin, salt, ITER);
      const vault = await seal(state, nk);
      acct = { ...a, salt: b64(salt), iter: ITER }; key = nk;
      wr(K_VAULT, vault); wr(K_ACCT, JSON.stringify(acct));
    },
    /* Efface le compte de l'appareil (et l'ancien format de la v1). La démo n'est pas touchée. */
    wipe() { key = null; acct = null; [K_VAULT, K_ACCT, K_FAIL, ...LEGACY].forEach(rm); }
  };
})();
