(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = 'dashboard-tareas-v1';

  const SUBJECTS = {
    'Academic English': '#ff70ec',
    'Conversational English': '#e353ba',
    'Graphic Design': '#53d0e3',
    'DME': '#5385e3',
    'P.E.': '#869fd1',
    'Guia': '#ff8b6d',
    'Math': '#ff7f7f',
    'Music': '#ffb350',
    'Religion': '#c250ff',
    'Science': '#77e569',
    'Social Studies': '#4e7fe8',
    'Civic': '#4e60e8',
    'Español': '#ffc170',
    'Otro': '#6fd5e3',
    'Personal': '#ffb08a'
  };
  const TYPES = {
    'Tarea': 'fi-rr-edit',
    'Examen': 'fi-rr-graduation-cap',
    'Documento Firmado': 'fi fi-rr-document',
    'Proyecto': 'fi-rr-layers',
    'Recordatorio': 'fi-rr-bell'
  };
  const PRIORITY = {
    'Alta': 'var(--bad)',
    'Media': 'var(--warn)',
    'Baja': 'var(--ok)'
  };

  /* Estado */
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return dstr(d); };
  const uid = () => Math.random().toString(36).slice(2, 9);

  const seed = () => [
    /*{ id: uid(), title: 'Ejercicios de álgebra', subject: 'Matemática', date: plus(0), time: '16:00', type: 'Tarea', priority: 'Alta', desc: 'Páginas 42 a 45, ejercicios del 1 al 20. Llevar el cuaderno de práctica.', done: false },
    { id: uid(), title: 'Estudiar para el quiz', subject: 'Inglés', date: plus(0), time: '19:30', type: 'Examen', priority: 'Media', desc: 'Vocabulario de la unidad 5 y verbos irregulares.', done: false },
    { id: uid(), title: 'Entregar proyecto final', subject: 'Programación', date: plus(2), time: '23:59', type: 'Proyecto', priority: 'Alta', desc: 'Subir el repositorio y el documento en PDF a la plataforma.', done: false },
    { id: uid(), title: 'Leer capítulo 3', subject: 'Español', date: plus(1), time: '18:00', type: 'Tarea', priority: 'Baja', desc: 'Hacer un resumen de media página.', done: false },
    { id: uid(), title: 'Pagar la cuota del curso', subject: 'Personal', date: plus(3), time: '10:00', type: 'Recordatorio', priority: 'Media', desc: '', done: false }*/
  ];

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
  if (!state || !Array.isArray(state.tasks)) state = { name: 'Pepe', tasks: seed() };
  if (!state.deleted) state.deleted = {};
  if (typeof state.notes !== 'string') state.notes = '';
  const save = () => {
    try { window.DashSync && DashSync.stamp(state); } catch (e) {}
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    window.DashSync && DashSync.schedule();
  };

  let filter = 'all';
  let sfilter = 'today';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const color = s => SUBJECTS[s] || '#8ab4ff';

  /* Fechas */
  const cmp = (a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99'));
  const fmtDate = ds => {
    if (ds === plus(0)) return 'Hoy';
    if (ds === plus(1)) return 'Mañana';
    if (ds === plus(-1)) return 'Ayer';
    const [y, m, d] = ds.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const fmtTime = t => {
    if (!t) return 'Sin hora';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
  };
  const isLate = t => !t.done && (t.date < plus(0) || (t.date === plus(0) && t.time && t.time < `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`));
  /* Helper para filtrar las fechas de la sección Pronto */
  const isSFilterMatch = (taskDate, sfilter) => {
    const today = plus(0);
    if (sfilter === 'today') {
      return taskDate === today || (taskDate < today);
    }
    if (sfilter === 'tomorrow') {
      return taskDate === plus(1);
    }
    if (sfilter === 'in2days') {
      return taskDate === plus(2);
    }
    if (sfilter === 'nextweek') {
      // Rango desde mañana (+1) hasta dentro de 7 días (+7)
      return taskDate > today && taskDate <= plus(7);
    }
    return true;
  };

  /* Saludo y reloj */
  function greet() {
    const h = new Date().getHours();
    $('#hello').textContent = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }
  const nameEl = $('#name');
  nameEl.textContent = state.name;
  nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
  nameEl.addEventListener('blur', () => {
    state.name = nameEl.textContent.trim() || 'Pepe';
    nameEl.textContent = state.name;
    save();
  });
  
  const notesEl = $('#quickNotes');
  notesEl.value = state.notes;
  let notesT;
  const saveNotes = () => {
    clearTimeout(notesT);
    if (state.notes !== notesEl.value) { state.notes = notesEl.value; save(); }
  };
  notesEl.addEventListener('input', () => { clearTimeout(notesT); notesT = setTimeout(saveNotes, 600); });
  notesEl.addEventListener('blur', saveNotes);

  function tick() {
    const n = new Date();
    $('#hm').textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    const s = $('#sec');
    s.textContent = pad(n.getSeconds());
    s.classList.add('tick');
    setTimeout(() => s.classList.remove('tick'), 160);
    $('#date').textContent = n.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
    greet();
  }
  setInterval(tick, 1000);
  tick();

  /* Clima con Open-Meteo */
  const WX = c => {
    if (c === 0) return ['fi-rr-sun', 'Despejado'];
    if (c <= 2) return ['fi-rr-cloud-sun', 'Parcialmente nublado'];
    if (c === 3) return ['fi-rr-cloud', 'Nublado'];
    if (c <= 48) return ['fi-rr-fog', 'Neblina'];
    if (c <= 67 || (c >= 80 && c <= 82)) return ['fi-rr-cloud-rain', 'Lluvia'];
    if (c <= 77) return ['fi-rr-snowflake', 'Nieve'];
    return ['fi-rr-bolt', 'Tormenta'];
  };
  function obtenerDetallesClima(code) {
    if (code === 0) {
      return {
        texto: 'Soleado',
        bg: 'https://images.unsplash.com/photo-1615286628718-4a4c8924d0eb?q=80&w=1170&auto=format&fit=crop'
      };
    } else if ([1, 2, 3].includes(code)) {
      return {
        texto: 'Parcialmente nublado',
        bg: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=800&auto=format&fit=crop'
      };
    } else if ([51, 53, 55, 61, 63, 65, 80, 81].includes(code)) {
      return {
        texto: 'Lluvia leve',
        bg: 'https://images.unsplash.com/photo-1507027682794-35e6c12ad5b4?q=80&w=687&auto=format&fit=crop'
      };
    } else if ([95, 96, 99].includes(code)) {
      return {
        texto: 'Tormenta',
        bg: 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?q=80&w=800&auto=format&fit=crop'
      };
    }
    return {
      texto: 'Nublado',
      bg: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=800&auto=format&fit=crop'
    };
  }

  let lastBg = '';
  function setWeatherBg(url) {
    if (url === lastBg) return;
    lastBg = url;
    const img = new Image();
    img.onload = () => {
      const card = $('.weather');
      card.style.setProperty('--wbg', `url("${url}")`);
      card.classList.add('has-bg');
    };
    img.src = url;
  }

  async function weather(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
      const r = await (await fetch(url)).json();
      const c = r.current;
      const [icon] = WX(c.weather_code);
      const det = obtenerDetallesClima(c.weather_code);
      $('#w-icon').className = `fi ${icon} w-icon`;
      $('#w-temp').textContent = `${Math.round(c.temperature_2m)}°C`;
      $('#w-desc').textContent = det.texto;
      setWeatherBg(det.bg);
      $('#w-extra').innerHTML =
        `<span><i class="fi fi-rr-droplet"></i>${c.relative_humidity_2m}%</span>` +
        `<span><i class="fi fi-rr-wind"></i>${Math.round(c.wind_speed_10m)} km/h</span>` +
        `<span><i class="fi fi-rr-temperature-high"></i>${Math.round(r.daily.temperature_2m_max[0])}° / ${Math.round(r.daily.temperature_2m_min[0])}°</span>`;
    } catch (e) {
      $('#w-desc').textContent = 'Sin conexión';
    }
  }
  const fallback = () => weather(10.0163, -84.2116);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => weather(p.coords.latitude, p.coords.longitude), fallback, { timeout: 6000 });
  } else fallback();
  setInterval(() => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => weather(p.coords.latitude, p.coords.longitude), fallback, { timeout: 6000 }) : fallback(), 30 * 60 * 1000);

  /* Render */
  function taskHTML(t, n) {
    return `<div class="task ${t.done ? 'done' : ''} ${isLate(t) ? 'late' : ''}" data-id="${t.id}" style="--c:${color(t.subject)};--n:${n}">
      <button class="check" aria-label="Completar"><i class="fi fi-rr-check"></i></button>
      <div>
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-meta">
          <span class="subject"><i class="fi fi-rr-book"></i>${esc(t.subject)}</span>
          <span class="when"><i class="fi fi-rr-clock"></i>${fmtDate(t.date)}, ${fmtTime(t.time)}</span>
          <span><i class="fi ${TYPES[t.type]}"></i>${esc(t.type)}</span>
        </div>
      </div>
      <i class="fi fi-rr-angle-small-right chev"></i>
    </div>`;
  }
  const empty = (icon, text) => `<div class="empty"><i class="fi ${icon}"></i><span>${text}</span></div>`;

  function render() {
    const today = plus(0);
    const all = [...state.tasks].sort(cmp);

    const todays = all.filter(t => {
      if (!isSFilterMatch(t.date, sfilter)) return false;
      if (sfilter === 'today') return t.date === today || !t.done;
      return !t.done;
    });

    const rest = all.filter(t => !t.done && (filter === 'all' || t.type === filter));

    $('#today').innerHTML = todays.length 
      ? todays.map((t, i) => taskHTML(t, i)).join('') 
      : empty('fi-rr-sparkles', 'No hay nada para esta fecha.');

    $('#upcoming').innerHTML = rest.length 
      ? rest.map((t, i) => taskHTML(t, i)).join('') 
      : empty('fi-rr-list-check', 'No hay pendientes en esta vista.');

    const todayTasks = all.filter(t => t.date === today || (t.date < today && !t.done));
    const doneCount = todayTasks.filter(t => t.done).length;
    const pct = todayTasks.length ? Math.round(doneCount / todayTasks.length * 100) : 0;

    $('#ring').style.strokeDashoffset = 264 - (264 * pct / 100);
    $('#pct').textContent = `${pct}%`;
    $('#pct-sub').textContent = `${doneCount} de ${todayTasks.length}`;

    const left = todayTasks.length - doneCount;
    $('#sub').textContent = left 
      ? `Tienes ${left} ${left === 1 ? 'pendiente' : 'pendientes'} para hoy.` 
      : 'Estás al día con todo. ¡Buen trabajo!';
  }

  document.addEventListener('click', e => {
    const f = e.target.closest('#filters button');
    if (f) {
      filter = f.dataset.f;
      document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('on', b === f));
      render();
      return;
    }

    const sf = e.target.closest('#soonFilters button');
    if (sf) {
      sfilter = sf.dataset.sf;
      console.log(sfilter);
      document.querySelectorAll('#soonFilters button').forEach(b => b.classList.toggle('on', b === sf));
      render();
      return;
    }

    const row = e.target.closest('.task');
    if (!row) return;
    const t = state.tasks.find(x => x.id === row.dataset.id);
    if (!t) return;
    if (e.target.closest('.check')) toggle(t, e.target.closest('.check'));
    else openDetail(t, row);
  });

  function toggle(t, el) {
    t.done = !t.done;
    save();
    if (t.done) { confetti(el); toast('fi-rr-check', 'Tarea completada'); }
    const row = el.closest('.task');
    row.classList.toggle('done', t.done);
    setTimeout(render, 650);
    refreshRing();
  }
  function refreshRing() {
    const today = plus(0);
    const ts = state.tasks.filter(t => t.date === today || (t.date < today && !t.done));
    const d = ts.filter(t => t.done).length;
    const pct = ts.length ? Math.round(d / ts.length * 100) : 0;
    $('#ring').style.strokeDashoffset = 264 - (264 * pct / 100);
    $('#pct').textContent = `${pct}%`;
    $('#pct-sub').textContent = `${d} de ${ts.length}`;
  }

  /* Panel animado */
  const ov = $('#overlay'), panel = $('#panel');
  let origin = null;
  function openPanel(html, from, c) {
    panel.style.setProperty('--c', c || '#8ab4ff');
    panel.innerHTML = html;
    ov.classList.add('open');
    origin = from ? from.getBoundingClientRect() : null;
    const to = panel.getBoundingClientRect();
    if (origin) {
      panel.animate([
        { transform: `translate(${origin.left - to.left}px,${origin.top - to.top}px) scale(${origin.width / to.width},${origin.height / to.height})`, opacity: .3, borderRadius: '20px' },
        { transform: 'none', opacity: 1, borderRadius: '32px' }
      ], { duration: 520, easing: 'cubic-bezier(.2,.9,.2,1)' });
    } else {
      panel.animate([{ transform: 'translateY(40px) scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2,.9,.2,1)' });
    }
    panel.querySelector('.x')?.addEventListener('click', closePanel);
  }
  function closePanel() {
    if (!ov.classList.contains('open')) return;
    const to = panel.getBoundingClientRect();
    const frame = origin
      ? [{ transform: 'none', opacity: 1 }, { transform: `translate(${origin.left - to.left}px,${origin.top - to.top}px) scale(${origin.width / to.width},${origin.height / to.height})`, opacity: 0 }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'translateY(30px) scale(.94)', opacity: 0 }];
    panel.animate(frame, { duration: 340, easing: 'ease-in' }).onfinish = () => {panel.style.display = "none"; ov.classList.remove('open'); setTimeout(() => { panel.style.display = "block"; }, 240)};
  }
  ov.addEventListener('click', e => { if (e.target === ov) closePanel(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  function openDetail(t, row) {
    openPanel(`
      <button class="x" aria-label="Cerrar"><i class="fi fi-rr-cross-small"></i></button>
      <div class="d-subject"><i class="fi fi-rr-book"></i>${esc(t.subject)}</div>
      <div class="d-title">${esc(t.title)}</div>
      <div class="d-grid">
        <div class="d-item"><small><i class="fi fi-rr-calendar"></i>Fecha</small><b>${fmtDate(t.date)}</b></div>
        <div class="d-item"><small><i class="fi fi-rr-clock"></i>Hora</small><b>${fmtTime(t.time)}</b></div>
        <div class="d-item"><small><i class="fi ${TYPES[t.type]}"></i>Tipo</small><b>${esc(t.type)}</b></div>
        <div class="d-item"><small><i class="fi fi-rr-flag"></i>Prioridad</small><b style="color:${PRIORITY[t.priority]}">${esc(t.priority)}</b></div>
      </div>
      <div class="d-desc">${t.desc ? esc(t.desc) : 'Sin descripción.'}</div>
      <div class="d-actions">
        <button class="btn primary" id="d-done"><i class="fi fi-rr-check"></i><span>${t.done ? 'Marcar pendiente' : 'Completar'}</span></button>
        <button class="btn danger" id="d-del"><i class="fi fi-rr-trash"></i><span>Eliminar</span></button>
      </div>`, row, color(t.subject));
    $('#d-done').onclick = () => {
      t.done = !t.done; save();
      if (t.done) { confetti($('#d-done')); toast('fi-rr-check', 'Tarea completada'); }
      closePanel(); setTimeout(render, 300);
    };
    $('#d-del').onclick = () => {
      state.tasks = state.tasks.filter(x => x.id !== t.id); save();
      closePanel(); setTimeout(render, 300); toast('fi-rr-trash', 'Tarea eliminada');
    };
  }

  /* Formulario nueva tarea */
  const opts = o => Object.keys(o).map(k => `<option>${k}</option>`).join('');
  $('#add').addEventListener('click', () => {
    openPanel(`
      <button class="x" aria-label="Cerrar"><i class="fi fi-rr-cross-small"></i></button>
      <div class="f-title">Nueva tarea</div>
      <div class="field"><label for="f-title">Título</label><input id="f-title" placeholder="Ej: Entregar tarea de DME" maxlength="80"></div>
      <div class="two">
        <div class="field"><label for="f-subject">Materia</label><select id="f-subject">${opts(SUBJECTS)}</select></div>
        <div class="field"><label for="f-type">Tipo</label><select id="f-type">${opts(TYPES)}</select></div>
        <div class="field"><label for="f-date">Fecha</label><input type="date" id="f-date" value="${plus(0)}"></div>
        <div class="field"><label for="f-time">Hora</label><input type="time" id="f-time" value="${pad(new Date().getHours() + 1 > 23 ? 23 : new Date().getHours() + 1)}:00"></div>
      </div>
      <div class="field"><label for="f-prio">Prioridad</label><select id="f-prio"><option>Media</option><option>Alta</option><option>Baja</option></select></div>
      <div class="field"><label for="f-desc">Descripción</label><textarea id="f-desc" placeholder="Ingrese detalles, páginas, links, o lo que necesite recordar"></textarea></div>
      <div class="d-actions"><button class="btn primary" id="f-save"><i class="fi fi-rr-check"></i><span>Guardar tarea</span></button></div>`, $('#add'));
    setTimeout(() => $('#f-title').focus(), 500);
    $('#f-save').onclick = () => {
      const title = $('#f-title').value.trim();
      if (!title) {
        $('#f-title').animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 260 });
        $('#f-title').focus();
        return;
      }
      state.tasks.push({
        id: uid(), title,
        subject: $('#f-subject').value, type: $('#f-type').value,
        date: $('#f-date').value || plus(0), time: $('#f-time').value,
        priority: $('#f-prio').value, desc: $('#f-desc').value.trim(), done: false
      });
      save(); closePanel(); setTimeout(render, 300); toast('fi-rr-check', 'Tarea guardada');
    };
  });

  /* Toasts y confeti */
  function toast(icon, text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<i class="fi ${icon}"></i><span>${esc(text)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2600);
  }
  function confetti(el) {
    const r = el.getBoundingClientRect();
    const cols = Object.values(SUBJECTS);
    for (let i = 0; i < 18; i++) {
      const b = document.createElement('div');
      b.className = 'bit';
      b.style.background = cols[i % cols.length];
      b.style.left = `${r.left + r.width / 2}px`;
      b.style.top = `${r.top + r.height / 2}px`;
      document.body.appendChild(b);
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
      b.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 40}px) rotate(${Math.random() * 540}deg)`, opacity: 0 }
      ], { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.4,1)' }).onfinish = () => b.remove();
    }
  }

  /* Avisos cuando llega la hora */
  const alerted = new Set();
  setInterval(() => {
    const n = new Date(), now = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    state.tasks.forEach(t => {
      if (!t.done && t.date === plus(0) && t.time === now && !alerted.has(t.id)) {
        alerted.add(t.id);
        toast('fi-rr-bell', `Ahora: ${t.title}`);
      }
    });
    render();
  }, 30000);

    /* Verificar materiales (temporal: solo en memoria, no se guarda ni se sincroniza) */
  const MATERIALS = {
    dg: { title: 'Diseño Gráfico', color: SUBJECTS['Graphic Design'], items: 
      ['Paleta de colores', 'Pinceles', 'Témperas',
        'Brochas', 'Hojas', 'Caja de arte', 'Gabacha',
      ] },
    dme: { title: 'DME', color: SUBJECTS['DME'], items: 
      ['Antología', 'Caja de arte', 'Reglas',
        'Escuadras', 'Compás', 'Trapito', 'Alcohol',
        'Escalimetro', 'Gabacha', 
      ] },
  };
  const matDone = { dg: new Set(), dme: new Set() };

  document.querySelectorAll('[data-mat]').forEach(b => b.addEventListener('click', () => openMaterials(b.dataset.mat, b)));

  function openMaterials(key, from) {
    const m = MATERIALS[key], done = matDone[key];
    openPanel(`
      <button class="x" aria-label="Cerrar"><i class="fi fi-rr-cross-small"></i></button>
      <div class="d-subject"><i class="fi fi-rr-box"></i>Verificar materiales</div>
      <div class="d-title">${m.title}</div>
      <div class="mat-count muted" id="mat-count"></div>
      <div class="tasks mat-list">${m.items.map((it, i) => `
        <div class="task mat ${done.has(i) ? 'done' : ''}" data-i="${i}" style="--c:${m.color};--n:${i}">
          <button class="check" aria-label="Marcar"><i class="fi fi-rr-check"></i></button>
          <div class="t-title">${esc(it)}</div>
        </div>`).join('')}
      </div>
      <div class="d-actions"><button class="btn ghost" id="mat-reset"><i class="fi fi-rr-refresh"></i><span>Desmarcar todo</span></button></div>`, from, m.color);

    const list = panel.querySelector('.mat-list'), count = $('#mat-count');
    const update = () => { count.textContent = done.size === m.items.length ? '¡Llevas todo!' : `${done.size} de ${m.items.length} listos`; };
    update();
    list.addEventListener('click', e => {
      const row = e.target.closest('.mat');
      if (!row) return;
      const i = Number(row.dataset.i);
      if (done.has(i)) done.delete(i); else done.add(i);
      row.classList.toggle('done', done.has(i));
      update();
      if (done.size === m.items.length) confetti(row.querySelector('.check'));
    });
    $('#mat-reset').onclick = () => { done.clear(); list.querySelectorAll('.mat').forEach(r => r.classList.remove('done')); update(); };
  }

  window.DashApp = {
    getState: () => state,
    toast,
    setState(s) {
      state = s;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      nameEl.textContent = state.name;
      if (document.activeElement !== notesEl) notesEl.value = state.notes || '';
      render();
    }
  };

  window.NioBridge = {
    name: () => state.name,
    tasks: () => state.tasks,
    add(t) {
      const task = { id: uid(), done: false, priority: 'Media', desc: '', time: '', ...t };
      state.tasks.push(task); save(); render();
      toast('fi-rr-check', 'Tarea guardada');
      return task;
    },
    complete(id) {
      const t = state.tasks.find(x => x.id === id);
      if (t) { t.done = true; save(); render(); toast('fi-rr-check', 'Tarea completada'); }
    },
    remove(id) {
      state.tasks = state.tasks.filter(x => x.id !== id); save(); render();
    }
  };

  render();
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/public/pendientesdashboard/sw.js');
}