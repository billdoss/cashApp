/* Authentification locale : un code à 6 chiffres protège un coffre chiffré (AES-GCM)
   stocké dans le navigateur du téléphone. Le code n'est jamais enregistré : il sert à
   dériver la clé (PBKDF2). Un mauvais code ne déchiffre rien. */
const Auth = (() => {
  const K_ACCT = "sika:account", K_VAULT = "sika:vault", K_FAIL = "sika:fails";
  const ITER = 310000, enc = new TextEncoder(), dec = new TextDecoder();
  let key = null, acct = null;

  const b64 = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { throw { code: "storage", message: "Stockage du téléphone indisponible" }; } };
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

  /* Limite les essais : 5 erreurs, puis 30 s, 60 s, 120 s... (plafond 1 h). */
  const fails = () => readJSON(K_FAIL) || { n: 0, until: 0 };
  function waitLeft() { const f = fails(); return Math.max(0, Math.ceil((f.until - Date.now()) / 1000)); }
  function failed() { const f = fails(); f.n++; if (f.n >= 5) f.until = Date.now() + Math.min(3600, 30 * Math.pow(2, f.n - 5)) * 1000; wr(K_FAIL, JSON.stringify(f)); }
  function cleared() { try { localStorage.removeItem(K_FAIL); } catch (e) { } }

  return {
    exists() { return !!readJSON(K_ACCT) && !!rd(K_VAULT); },
    name() { return (acct || readJSON(K_ACCT) || {}).name || ""; },
    unlocked() { return !!key; },
    waitLeft,

    async create(name, pin, state) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      key = await derive(pin, salt, ITER);
      acct = { id: "u" + b64(crypto.getRandomValues(new Uint8Array(9))).replace(/[^A-Za-z0-9]/g, "x"), name: name, salt: b64(salt), iter: ITER, created: Date.now() };
      wr(K_VAULT, await seal(state, key)); wr(K_ACCT, JSON.stringify(acct)); cleared();
      return state;
    },
    async unlock(pin) {
      const a = readJSON(K_ACCT), v = rd(K_VAULT);
      if (!a || !v) throw { code: "none" };
      const w = waitLeft(); if (w > 0) throw { code: "locked", wait: w };
      const k = await derive(pin, unb64(a.salt), a.iter || ITER);
      try { const st = await open(v, k); key = k; acct = a; cleared(); return st; }
      catch (e) { failed(); throw { code: "bad_pin", wait: waitLeft() }; }
    },
    async write(state) { if (!key) throw { code: "locked" }; wr(K_VAULT, await seal(state, key)); },
    lock() { key = null; },
    async changePin(oldPin, newPin, state) {
      const a = readJSON(K_ACCT), v = rd(K_VAULT);
      const ok = await derive(oldPin, unb64(a.salt), a.iter || ITER);
      try { await open(v, ok); } catch (e) { throw { code: "bad_pin" }; }
      const salt = crypto.getRandomValues(new Uint8Array(16)), nk = await derive(newPin, salt, ITER);
      const vault = await seal(state, nk);
      acct = { ...a, salt: b64(salt), iter: ITER }; key = nk;
      wr(K_VAULT, vault); wr(K_ACCT, JSON.stringify(acct));
    },
    wipe() { key = null; acct = null; try { localStorage.removeItem(K_VAULT); localStorage.removeItem(K_ACCT); localStorage.removeItem(K_FAIL); } catch (e) { } }
  };
})();
