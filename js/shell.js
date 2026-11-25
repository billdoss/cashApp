/* Comportement "application native" : pas de zoom, pas de rebond, pas de menu contextuel. */
(() => {
  const stop = e => e.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach(t => document.addEventListener(t, stop, { passive: false }));
  document.addEventListener("touchmove", e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("wheel", e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault(); });
  let last = 0;
  document.addEventListener("touchend", e => { const n = Date.now(); if (n - last < 320 && !e.target.closest("input,textarea,select")) e.preventDefault(); last = n; }, { passive: false });
  document.addEventListener("contextmenu", e => { if (!e.target.closest("input,textarea")) e.preventDefault(); });
  document.addEventListener("dragstart", stop);
  /* Installation : bouton natif sur Android, mode d'emploi sur iPhone. Rien n'est affiché une fois installée. */
  window.Install = {
    standalone: () => matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true,
    ios: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    ev: null,
    async prompt() { if (!this.ev) return false; const e = this.ev; this.ev = null; e.prompt(); try { await e.userChoice; } catch (x) { } return true; }
  };
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); Install.ev = e; const b = document.getElementById("inst"); if (b) b.hidden = false; });
})();
