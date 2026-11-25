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
})();
