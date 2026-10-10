(() => {
  const I = window.Intel, $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== HERO ===== */
  let typeT, lastSig = '', lastAt = 0;
  function typeInto(el, text) {
    clearInterval(typeT);
    if (reduce) { el.textContent = text; return; }
    el.textContent = ''; let i = 0;
    typeT = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typeT); }, 16);
  }
  function renderHero(force) {
    if (!window.DashApp) return;
    const g = I.greeter.compose(), hero = $('#hero');
    if (!force && g.sig === lastSig && Date.now() - lastAt < 4 * 60e3) return;     // no cambia el mensaje sin motivo
    lastSig = g.sig; lastAt = Date.now();
    hero.dataset.mood = g.mood;
    $('#heroKicker').textContent = new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#heroTitle').textContent = g.title;
    typeInto($('#heroText'), g.text);
    $('#heroChips').innerHTML = g.chips.map(([i, t]) => `<span class="chip"><i class="fi ${i}"></i>${esc(t)}</span>`).join('');
  }

  /* ===== SUGERENCIAS ===== */
  const KIND_ICON = { add: 'fi-rr-plus', complete: 'fi-rr-check', reschedule: 'fi-rr-calendar', notice: 'fi-rr-info', stale: 'fi-rr-trash', new_subject: 'fi-rr-book' };
  const ago = ts => { if (!ts) return 'nunca'; const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };

  function sgHTML(s, i) {
    const act = (a, ic, t) => `<button data-act="${a}" title="${t}" aria-label="${t}"><i class="fi ${ic}"></i></button>`;
    let buttons = '';
    if (s.kind === 'add')         buttons = act('add', 'fi-rr-plus', 'Agregar') + act('edit', 'fi-rr-edit', 'Editar y agregar') + act('snooze', 'fi-rr-clock', 'Después') + act('dismiss', 'fi-rr-cross-small', 'Ignorar');
    else if (s.kind === 'complete')    buttons = act('do', 'fi-rr-check', 'Marcar hecha') + act('dismiss', 'fi-rr-cross-small', 'Ignorar');
    else if (s.kind === 'reschedule')  buttons = act('do', 'fi-rr-calendar', 'Actualizar fecha') + act('dismiss', 'fi-rr-cross-small', 'Ignorar');
    else if (s.kind === 'stale')       buttons = act('do', 'fi-rr-check', 'Marcar hecha') + act('remove', 'fi-rr-trash', 'Eliminar') + act('snooze', 'fi-rr-clock', 'Después');
    else if (s.kind === 'new_subject') buttons = act('do', 'fi-rr-plus', 'Crear como materia nueva') + act('map', 'fi-rr-link', 'Vincular a una materia que ya tengo') + act('dismiss', 'fi-rr-cross-small', 'Ignorar');
    else                               buttons = act('dismiss', 'fi-rr-check', 'Enterado');
    const when = s.date ? `<span><i class="fi fi-rr-calendar"></i>${esc(DashApp.fmtDate(s.date))}${s.time ? ', ' + esc(DashApp.fmtTime(s.time)) : ''}</span>` : '';
    return `<div class="task sg" data-sg="${esc(s.id)}" style="--c:${s.color};--n:${i}">
      <div class="sg-ic"><i class="fi ${KIND_ICON[s.kind] || 'fi-rr-bulb'}"></i></div>
      <div>
        <div class="t-title">${esc(s.title)}</div>
        <div class="t-meta">${s.subtitle ? `<span>${esc(s.subtitle)}</span>` : ''}${when}<span class="sg-score">${s.score}%</span></div>
        <div class="sg-why">${(s.why || []).map(w => `<em>${esc(w)}</em>`).join('')}</div>
      </div>
      <div class="sg-actions">${buttons}</div>
    </div>`;
  }

  function renderSuggestions() {
    const S = I.state, list = $('#sgList'), conn = I.google.isConnected() || I.mockOn;
    $('#sgConnect').style.display = conn ? 'none' : '';
    $('#sgCount').textContent = S.suggestions.length ? S.suggestions.length : '';
    $('#sgRefresh').classList.toggle('spin', S.scanning);
    $('#sgStatus').textContent = !conn ? 'Conecta tu cuenta para que revise Classroom y Calendar por ti.'
      : S.scanning ? 'Revisando Classroom y Calendar…'
      : S.error ? S.error
      : `Última revisión ${ago(S.lastScan)}${I.mockOn ? ' (datos de prueba)' : ''}`;
    list.innerHTML = S.suggestions.length ? S.suggestions.map(sgHTML).join('')
      : `<div class="empty"><i class="fi fi-rr-sparkles"></i><span>${conn ? 'Todo al día. No hay nada nuevo que sugerir.' : 'Sin conexión todavía.'}</span></div>`;
  }

  /* ===== Acciones ===== */
  const keysOf = s => [`${s.kind === 'add' ? (s.id.startsWith('cw') ? 'coursework' : s.id.startsWith('an') ? 'announcement' : s.id.startsWith('ev') ? 'event' : 'derived') : s.kind}|${s.subject || '-'}`, `type|${(s.draft && s.draft.type) || '-'}`];
  const mark = (map, id, val) => { const it = I.store.intel(); it[map][id] = val; I.store.commit(); };

  document.addEventListener('click', e => {
    const b = e.target.closest('#sgList [data-act]'); if (!b) return;
    const row = b.closest('[data-sg]'), s = I.state.suggestions.find(x => x.id === row.dataset.sg); if (!s) return;
    const act = b.dataset.act;

    if (act === 'add') {
      NioBridge.add(s.draft); mark('accepted', s.id, Date.now()); I.store.bump(keysOf(s), 'acc');
    } else if (act === 'edit') {
      DashApp.openNewTask(s.draft, b); I.store.bump(keysOf(s), 'acc');           // se registra "accepted" cuando exista la tarea (match por src)
    } else if (act === 'snooze') {
      mark('snoozed', s.id, Date.now() + 2 * 864e5);
    } else if (act === 'dismiss') {
      mark('dismissed', s.id, Date.now()); I.store.bump(keysOf(s), 'dis');
    } else if (act === 'remove') {
      NioBridge.remove(s.taskId); mark('dismissed', s.id, Date.now());
    } else if (act === 'do') {
      if (s.kind === 'complete' || s.kind === 'stale') NioBridge.complete(s.taskId);
      if (s.kind === 'reschedule') { DashApp.updateTask(s.taskId, s.patch); DashApp.toast('fi-rr-calendar', 'Fecha actualizada'); }
      if (s.kind === 'new_subject') { DashApp.addSubject(s.draft.name, s.draft.color);
        const it = I.store.intel(); it.courseMap[s.draft.courseId] = s.draft.name; I.store.commit(); DashApp.toast('fi-rr-check', 'Materia agregada'); }
      mark('accepted', s.id, Date.now());
    } else if (act === 'map') {
      I.settings.open('courses', s.draft.courseId);     // abre el panel y resalta esa clase
      return;
    }
    I.recompute();
  });

  $('#sgRefresh').addEventListener('click', () => I.scan());
  $('#sgConnect').addEventListener('click', async () => {
    try { const r = await I.google.connect(); if (!r.allScopes) DashApp.toast('fi-rr-exclamation', 'Faltaron permisos, acepta todos'); I.scan(); }
    catch (e) { DashApp.toast('fi-rr-exclamation', 'No se pudo conectar'); console.warn(e); }
  });

  I.ui = { renderHero, renderSuggestions };
})();