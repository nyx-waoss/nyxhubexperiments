(() => {
  const I = window.Intel, $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hex = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#8ab4ff';
  const panel = $('#panel');
  let tab = 'subjects', sel = null, order = null, focusId = null;

  /* ============ Pestaña 1: Mis materias ============ */
  function subjectsHTML() {
    const rows = Object.entries(DashApp.SUBJECTS).map(([n, c]) => `
      <div class="st-row" data-name="${esc(n)}">
        <label class="st-color" style="--c:${hex(c)}"><input type="color" value="${hex(c)}" data-role="color" aria-label="Color de ${esc(n)}"></label>
        <input class="st-name" data-role="name" value="${esc(n)}" maxlength="30" ${n === 'Otro' ? 'disabled' : ''} aria-label="Nombre de la materia">
        ${n === 'Otro' ? '<span style="width:42px"></span>' : '<button class="st-del" data-role="del" title="Eliminar" aria-label="Eliminar"><i class="fi fi-rr-trash"></i></button>'}
      </div>`).join('');
    return `
      <p class="muted st-hint">Cambia el nombre o el color de tus materias. Al renombrar una, también se actualizan sus tareas y sus vínculos con Classroom.</p>
      ${rows}
      <div class="st-row st-add">
        <label class="st-color" style="--c:#8ab4ff"><input type="color" id="stNewColor" value="#8ab4ff" aria-label="Color nuevo"></label>
        <input class="st-name" id="stNewName" placeholder="Nueva materia" maxlength="30">
        <button class="btn primary st-addbtn" data-role="add" aria-label="Agregar"><i class="fi fi-rr-plus"></i></button>
      </div>`;
  }

  /* ============ Pestaña 2: Clases de Classroom ============ */
  function coursesHTML() {
    const cache = I.mockOn ? I.mockCache() : I.store.cache();
    const cl = cache && cache.classroom, courses = (cl && cl.courses) || [];
    const S = DashApp.SUBJECTS, names = Object.keys(S), intel = I.store.intel();
    if (!sel || !S[sel]) sel = names[0];
    if (!courses.length) return `<p class="muted st-hint">Todavía no hay clases de Classroom. Conéctate desde la tarjeta de Sugerencias y vuelve aquí.</p>`;

    // El orden se calcula una vez (clases sin reconocer primero) para que no salten al tocarlas
    if (!order) {
      const rank = c => intel.courseMap[c.id] ? 1 : I.classify.subject(c, intel) ? 2 : 0;
      order = [...courses].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).map(c => c.id);
    }
    const byId = new Map(courses.map(c => [c.id, c]));

    let note = '';
    if (cl.teachersStatus === 'denied')
      note = `<div class="st-note">Para ver el nombre de los profes falta un permiso nuevo. <button class="btn ghost" id="stReconnect"><i class="fi fi-rr-refresh"></i><span>Reconectar</span></button></div>`;
    else if (cl.teachersStatus === 'ok' && !courses.some(c => (c.teachers || []).length))
      note = `<div class="st-note">Tu colegio no comparte el nombre de los profes con apps externas.</div>`;

    const rows = order.map(id => byId.get(id)).filter(Boolean).map(c => {
      const explicit = intel.courseMap[c.id], auto = explicit ? null : I.classify.subject(c, intel);
      let chip = '';
      if (explicit && explicit !== sel && S[explicit]) chip = `<span class="st-chip" style="--c:${hex(S[explicit])}">${esc(explicit)}</span>`;
      else if (!explicit && auto) chip = `<span class="st-chip auto">Auto · ${esc(auto)}</span>`;
      else if (!explicit) chip = `<span class="st-chip none">Sin vincular</span>`;
      const teacher = (c.teachers || []).length ? `<small class="st-teacher"><i class="fi fi-rr-user"></i>${esc(c.teachers.join(', '))}</small>` : '';
      return `<button class="st-course ${explicit === sel ? 'on' : ''}" data-course="${esc(c.id)}">
        <span class="st-check"><i class="fi fi-rr-check"></i></span>
        <span class="st-cinfo"><b>${esc(c.name)}</b>${c.section ? `<small>${esc(c.section)}</small>` : ''}${teacher}</span>
        ${chip}
      </button>`;
    }).join('');

    return `
      <div class="field"><label for="stMapSubject">Vincular a la materia</label>
        <select id="stMapSubject">${names.map(n => `<option value="${esc(n)}" ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      </div>
      <p class="muted st-hint">Toca una clase para vincularla (o desvincularla) de <b style="color:${hex(S[sel])}">${esc(sel)}</b>. Las sugerencias usarán esta materia para sus tareas y avisos.</p>
      ${note}
      <div class="st-courses" style="--c:${hex(S[sel])}">${rows}</div>`;
  }

  /* ============ Panel ============ */
  function renderTab() {
    const body = $('#stBody'); if (!body) return;
    const y = panel.scrollTop;
    document.querySelectorAll('#stTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    body.innerHTML = tab === 'subjects' ? subjectsHTML() : coursesHTML();
    panel.scrollTop = y;
    if (focusId) {
      const el = body.querySelector(`[data-course="${CSS.escape(focusId)}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('pulse'); }
      focusId = null;
    }
  }

  function open(t = 'subjects', focus = null) {
    tab = t; order = null; focusId = focus;
    DashApp.openPanel(`
      <button class="x" aria-label="Cerrar"><i class="fi fi-rr-cross-small"></i></button>
      <div class="f-title">Materias</div>
      <div class="seg st-tabs" id="stTabs">
        <button data-tab="subjects">Mis materias</button>
        <button data-tab="courses">Clases de Classroom</button>
      </div>
      <div id="stBody"></div>`, $('#subjectsBtn'));
    renderTab();
  }

  function addSubject() {
    const name = $('#stNewName').value.trim(), c = $('#stNewColor').value;
    if (!name) return DashApp.toast('fi-rr-exclamation', 'Escribe un nombre');
    if (!DashApp.addSubject(name, c)) return DashApp.toast('fi-rr-exclamation', 'Ya existe esa materia');
    DashApp.toast('fi-rr-check', 'Materia agregada');
    renderTab();
  }

  /* ============ Eventos (delegados sobre el panel, que se reutiliza) ============ */
  panel.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('#stNewColor')) { el.parentNode.style.setProperty('--c', el.value); return; }
    if (!el.matches('[data-role="color"]')) return;
    el.parentNode.style.setProperty('--c', el.value);
    DashApp.setSubjectColor(el.closest('.st-row').dataset.name, el.value, false);      // vista previa en vivo
  });

  panel.addEventListener('change', e => {
    const el = e.target, row = el.closest('.st-row');
    if (el.matches('[data-role="color"]') && row) {
      DashApp.setSubjectColor(row.dataset.name, el.value, true);                        // al soltar: guarda
      I.recompute();
    } else if (el.matches('[data-role="name"]') && row) {
      const r = DashApp.renameSubject(row.dataset.name, el.value);
      if (r !== true) DashApp.toast('fi-rr-exclamation', r);
      I.recompute(); renderTab();
    } else if (el.id === 'stMapSubject') {
      sel = el.value; renderTab();
    }
  });

  panel.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'stNewName') addSubject();
    else if (e.target.matches('[data-role="name"]')) e.target.blur();
  });

  panel.addEventListener('click', async e => {
    const tb = e.target.closest('#stTabs button');
    if (tb) { tab = tb.dataset.tab; order = null; renderTab(); return; }

    const role = e.target.closest('[data-role]');
    if (role && role.dataset.role === 'add') return addSubject();
    if (role && role.dataset.role === 'del') {
      const n = role.closest('.st-row').dataset.name;
      if (confirm(`¿Eliminar "${n}"? Sus tareas pasarán a "Otro".`)) { DashApp.removeSubject(n); I.recompute(); renderTab(); }
      return;
    }

    if (e.target.closest('#stReconnect')) {
      try { await I.google.connect(); await I.scan(); } catch (err) { DashApp.toast('fi-rr-exclamation', 'No se pudo reconectar'); }
      order = null; renderTab(); return;
    }

    const row = e.target.closest('.st-course');
    if (row) {
      const it = I.store.intel(), id = row.dataset.course;
      if (it.courseMap[id] === sel) { it.courseMap[id] = ''; DashApp.toast('fi-rr-cross-small', 'Vínculo quitado'); }   // '' = desvinculada (se sincroniza)
      else { it.courseMap[id] = sel; DashApp.toast('fi-rr-check', `Vinculada a ${sel}`); }
      I.store.commit(); I.recompute(); renderTab();
    }
  });

  $('#subjectsBtn').addEventListener('click', () => open('subjects'));
  const mapBtn = $('#sgMap'); if (mapBtn) mapBtn.addEventListener('click', () => open('courses'));

  I.settings = { open };
})();