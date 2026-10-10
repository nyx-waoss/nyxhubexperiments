(() => {
  const I = window.Intel, cfg = I.config;
  I.state = { suggestions: [], lastScan: 0, scanning: false, error: null };
  I.mockOn = false;

  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

  I.recompute = () => {
    const cache = I.mockOn ? I.mockCache() : I.store.cache();
    I.state.suggestions = cache
      ? I.analyze({ cache, tasks: DashApp.getState().tasks, intel: I.store.intel(), stats: I.store.stats() })
      : [];
    I.ui.renderSuggestions();
    I.ui.renderHero(false);
  };

  I.scan = async () => {
    if (I.state.scanning) return;
    if (I.mockOn) { I.state.lastScan = Date.now(); I.recompute(); return; }
    if (!I.google.isConnected()) return;
    I.state.scanning = true; I.state.error = null; I.ui.renderSuggestions();
    try {
      const res = await I.collector.scan();
      I.state.lastScan = res.at;
      const errs = Object.entries(res.errors).map(([k, v]) => `${k}: ${v}`);
      I.state.error = errs.length ? 'Problema al revisar → ' + errs.join(' · ') : null;
    } catch (e) {
      I.state.error = 'No se pudo conectar con Google. Toca ↻ para reintentar.';
      console.warn(e);
    } finally { I.state.scanning = false; }
    I.recompute();
  };

  // Reaccionar a cambios (completaste algo, sync trajo datos nuevos, etc.)
  document.addEventListener('dash:changed', debounce(() => { I.recompute(); I.ui.renderHero(false); }, 400));
  setInterval(() => I.ui.renderHero(false), 60 * 1000);                                    // el mensaje se actualiza con la hora
  setInterval(() => { if (!document.hidden) I.scan(); }, cfg.SCAN_EVERY_MIN * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - I.state.lastScan > 5 * 60 * 1000) I.scan();
  });

  // Consola de depuración: Intel.debug()
  I.debug = () => {
    const cache = I.mockOn ? I.mockCache() : I.store.cache();
    const sigs = I._internals.buildSignals(cache, I.store.intel(), new Date());
    console.table(sigs.map(s => ({ key: s.key, kind: s.kind, title: s.title, subject: s.subject, date: s.date, type: s.type,
      ...I._internals.scoreSignal(s, new Date(), I.store.stats()) })));
    console.log('Sugerencias finales:', I.state.suggestions);
  };

  // Arranque
  const boot = () => {
    if (!window.DashApp) return setTimeout(boot, 100);
    I.state.lastScan = (I.store.cache() || {}).at || 0;
    I.recompute();                               // muestra la caché al instante, sin esperar red
    I.ui.renderHero(true);
    if (I.google.isConnected()) I.scan();
  };
  boot();
})();