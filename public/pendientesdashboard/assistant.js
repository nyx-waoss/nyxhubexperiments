/* Nio: asistente de voz del dashboard. Todo el entendimiento es local (reglas), sin IA ni APIs.
   Requiere window.NioBridge (ver instrucciones en app.js). */
(() => {
  'use strict';
  const SOUND_URL = '/public/pendientesdashboard/assets/sound/nioinvoked.mp3';
  const ERR_SOUND_URL = '/public/pendientesdashboard/assets/sound/nioerrorundst.mp3';
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const B = () => window.NioBridge;
  const norm = s => s.toLowerCase().replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');

  /* ================= Diccionarios ================= */
  const MONTHS = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
  const DAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const NUMW = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  // Sinonimos sin tildes (ñ = n). La clave debe existir en SUBJECTS de app.js.
  const SUBJ = {
    'Math': ['matematicas', 'matematica', 'mate', 'mates', 'algebra', 'geometria', 'calculo', 'aritmetica', 'math'],
    'Science': ['ciencias', 'ciencia', 'biologia', 'quimica', 'fisica', 'science'],
    'Español': ['espanol', 'lenguaje', 'literatura', 'ortografia', 'gramatica'],
    'Academic English': ['academic english', 'ingles academico', 'academico', 'academic'],
    'Conversational English': ['conversational english', 'ingles conversacional', 'conversacional', 'conversational'],
    '?english': ['ingles', 'english'],
    'Graphic Design': ['diseno grafico', 'graphic design', 'diseno'],
    'DME': ['dme'],
    'P.E.': ['educacion fisica', 'ed fisica', 'deportes', 'gimnasia'],
    'Guia': ['guia', 'orientacion'],
    'Music': ['musica', 'flauta', 'canto'],
    'Religion': ['religion'],
    'Social Studies': ['estudios sociales', 'social studies', 'sociales', 'historia', 'geografia'],
    'Civic': ['educacion civica', 'civica', 'civismo'],
    'Personal': ['personal']
  };
  const SUBJ_LIST = Object.entries(SUBJ).flatMap(([k, a]) => a.map(w => [w, k])).sort((a, b) => b[0].length - a[0].length);
  const TYPE_DETECT = [
    ['Documento Firmado', /\b(documento firmado|documento|firmar|firma|hoja firmada)\b/],
    ['Examen', /\b(examen|prueba|quiz|parcial|evaluacion)\b/],
    ['Proyecto', /\b(proyecto|exposicion|maqueta)\b/],
    ['Tarea', /\b(tarea|deber|asignacion|trabajo|ejercicios|practica)\b/],
    ['Recordatorio', /\b(recordatorio|recuerdame|recuerda|avisame)\b/]
  ];
  const NOUNS = /\b(?:(?:una?|la|el|mi|unos)\s+)?(tarea|deber|asignacion|trabajo|examen|prueba|quiz|parcial|evaluacion|proyecto|documento firmado|recordatorio)\b/;
  const FILL = /\b(?:que tengo que|que tengo|tengo que|tienes que|hay que|me puedes|me podrias|me podes|me gustaria|quiero que|necesito que|por favor|oye|hey|ey|hola|nio|disculpa|porfavor|porfa|porfis|plis|pliss|please|gracias|okay|ok|ponme|pon|agregame|agrega|agregar|anademe|anade|anotame|anota|anotar|apuntame|apunta|creame|crea|registrame|registra|programame|programa|guardame|guarda|recuerdame|recuerda|avisame|puedes|podrias|podes|quisiera|quiero|necesito|tengo|debo|debes)\b/;
  const CONN = /^(?:de|del|para|que|y|a|al|el|la|los|las|un|una|unos|unas|en|con|sobre|mi|me|por)\s+/i;
  const LEADV = /^(?:entregar|presentar|hacer|terminar|realizar|completar)?\s*(?:una?|la|el|mi)?\s*(?:tarea|trabajo|deber)\s+(?:de|sobre|que consiste en|que dice|para)\s+/i;
  const POD = { manana: '08:00', tarde: '15:00', noche: '19:00' };

  /* ================= Fechas y horas ================= */
  const startToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = k => { const d = startToday(); d.setDate(d.getDate() + k); return iso(d); };
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  function speakDate(s) {
    const diff = Math.round((fromIso(s) - startToday()) / 864e5);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'mañana';
    const d = fromIso(s);
    if (diff > 1 && diff < 7) return 'el ' + d.toLocaleDateString('es-CR', { weekday: 'long' });
    return 'el ' + d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  }
  function speakTime(t) {
    const [h, m] = t.split(':').map(Number);
    if (h === 12 && !m) return 'mediodía';
    return `${h % 12 || 12}${m ? ':' + pad(m) : ''} ${h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche'}`;
  }
  function mkTime(h, m, mer, rel) {
    if (rel === 'media') m = 30; else if (rel === 'cuarto') m = 15; else if (rel === 'menos') { h -= 1; m = 45; }
    const x = (mer || '').trim();
    if (/^p|tarde|noche/.test(x)) { if (h < 12) h += 12; }
    else if (/^a|manana|madrugada/.test(x)) { if (h === 12) h = 0; }
    else if (h >= 1 && h <= 6) h += 12;
    return h > 23 || m > 59 ? null : `${pad(h)}:${pad(m)}`;
  }

  function parseDate(cut) {
    const P = '(?:(?:para|pal|antes del?|hasta|el dia|dia|este|esta|el|la|proximo|proxima|siguiente)\\s+)*';
    const today = startToday();
    let m;
    if (cut(/\bpasado manana\b/)) return addDays(2);
    if (cut(new RegExp(`\\b${P}manana\\b`))) return addDays(1);
    if (cut(/\b(?:para\s+)?hoy\b/)) return addDays(0);
    if ((m = cut(/\b(?:en|dentro de)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(dias?|semanas?)\b/))) {
      const k = NUMW[m[1]] || parseInt(m[1], 10);
      return addDays(/sem/.test(m[2]) ? k * 7 : k);
    }
    if (cut(/\b(?:para\s+)?(?:la\s+)?(?:proxima|siguiente) semana\b/)) return addDays(7);
    if ((m = cut(new RegExp(`\\b${P}(${Object.keys(DAYS).join('|')})(?:\\s+(?:de la\\s+)?(?:proxima semana|que viene))?\\b`)))) {
      const diff = (DAYS[m[1]] - today.getDay() + 7) % 7 || 7;
      return addDays(diff);
    }
    if ((m = cut(new RegExp(`\\b${P}(\\d{1,2})\\s+de\\s+(${Object.keys(MONTHS).join('|')})(?:\\s+(?:del?\\s+)?(\\d{4}))?\\b`)))) {
      const d = new Date(m[3] ? +m[3] : today.getFullYear(), MONTHS[m[2]], +m[1]);
      if (!m[3] && d < today) d.setFullYear(d.getFullYear() + 1);
      return iso(d);
    }
    if ((m = cut(/\b(?:para el dia|para el|el dia|dia)\s+(\d{1,2})\b/))) {
      const d = new Date(today.getFullYear(), today.getMonth(), +m[1]);
      if (d < today) d.setMonth(d.getMonth() + 1);
      return iso(d);
    }
    if ((m = cut(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const d = new Date(m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : today.getFullYear(), +m[2] - 1, +m[1]);
      if (!m[3] && d < today) d.setFullYear(d.getFullYear() + 1);
      return iso(d);
    }
    return null;
  }

  /* ================= Extraccion de datos ================= */
  function extract(text) {
    let w = text, n = norm(text);
    const n0 = n;
    const blank = (s, e) => { const sp = ' '.repeat(e - s); w = w.slice(0, s) + sp + w.slice(e); n = n.slice(0, s) + sp + n.slice(e); };
    const cut = re => { const m = re.exec(n); if (m) blank(m.index, m.index + m[0].length); return m; };
    const cutAll = re => [...n.matchAll(new RegExp(re.source, 'g'))].forEach(m => blank(m.index, m.index + m[0].length));
    const r = { subject: null, type: null, date: null, time: null, priority: null, desc: null, title: null };

    for (const [t, re] of TYPE_DETECT) if (re.test(n0)) { r.type = t; break; }

    let m = cut(/\b(?:descripcion|notas?|detalles?|comentario)\b\s*(?::|de|es|que dice)?\s*(.*)$/);
    if (m && m[1].trim()) r.desc = w.slice(m.index + m[0].length - m[1].length).trim() || null;
    if (m && !r.desc) r.desc = null;
    if (m && !r.desc) { /* marcador sin contenido */ }

    if (cut(/\b(?:no es urgente|sin prisa|con calma|prioridad baja|baja prioridad|poco importante)\b/)) r.priority = 'Baja';
    else if (cut(/\b(?:muy importante|urgente|importante|prioridad alta|alta prioridad)\b/)) r.priority = 'Alta';

    // Hora
    if ((m = cut(/\b(?:a|para|como a|a eso de)\s+las?\s+(\d{1,2})(?:[:.h](\d{2}))?(?:\s+y\s+(media|cuarto)|\s+menos\s+(cuarto))?(?:\s*(a\.?\s?m\.?|p\.?\s?m\.?|de la manana|de la tarde|de la noche|de la madrugada))?/))) {
      r.time = mkTime(+m[1], m[2] ? +m[2] : 0, m[5], m[3] || (m[4] ? 'menos' : null));
    } else if ((m = cut(/\b(\d{1,2}):(\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/))) {
      r.time = mkTime(+m[1], +m[2], m[3]);
    } else if (cut(/\b(?:al\s+)?mediodia\b/)) r.time = '12:00';
    else if (cut(/\b(?:a\s+)?medianoche\b/)) r.time = '23:59';

    let podDate = null;
    if ((m = cut(/\b(esta|por la|en la)\s+(manana|tarde|noche)\b/))) {
      if (!r.time) r.time = POD[m[2]];
      if (m[1] === 'esta') podDate = addDays(0);
    }

    r.date = parseDate(cut) || podDate;

    // Materia
    for (const [word, key] of SUBJ_LIST) {
      if (cut(new RegExp(`\\b(?:(?:de|del|para|sobre|en|clase de|la clase de|materia de|la materia de)\\s+)?(?:(?:la|el)\\s+)?${word}\\b`))) { r.subject = key; break; }
    }

    cut(NOUNS);
    cutAll(FILL);

    // Titulo
    let rest = w.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1');
    const trim = s => s.replace(/^[\s,.;:!?¿¡-]+|[\s,.;:!?¿¡-]+$/g, '');
    rest = trim(rest);
    for (let i = 0; i < 4; i++) rest = trim(rest.replace(CONN, ''));
    const stripped = rest.replace(LEADV, '');
    if (stripped.trim().length > 2) rest = stripped;
    rest = trim(rest.replace(/,\s*y\s+/g, ' y ').replace(/,\s*,/g, ',').replace(/\s+(?:de|para|que|y|a|el|la|en|con)$/i, ''));
    if (rest.length > 1 && !/^(?:si|no|vale|listo)$/i.test(rest)) r.title = rest[0].toUpperCase() + rest.slice(1);
    return r;
  }

  /* ================= Dialogo ================= */
  let pending = null, lastAdded = null;
  const isCancel = n => n.length < 45 && /\b(cancela|cancelar|olvidalo|dejalo|no gracias|nada|ya no|mejor no)\b/.test(n) && !/\b(tarea|examen|proyecto)\b/.test(n);

  function need(d) {
    if (!d.type) d.type = 'Tarea';
    if (!d.subject && d.type === 'Recordatorio') d.subject = 'Personal';
    if (!d.subject) return 'subject';
    if (d.subject === '?english') return 'english';
    if (!d.title) {
      if (d.type === 'Documento Firmado') d.title = 'Documento firmado de ' + d.subject;
      else if (d.type === 'Examen' || d.type === 'Proyecto') d.title = `${d.type} de ${d.subject}`;
      else return 'title';
    }
    return d.date ? null : 'date';
  }
  const QUESTIONS = {
    subject: () => pick(['¿De qué materia es?', '¿Para qué materia sería?']),
    english: () => '¿Es de Academic English o de Conversational English?',
    title: d => `${pick(['Entendido.', 'Claro.'])} ${d.subject ? 'Es de ' + d.subject + '. ' : ''}¿Qué hay que hacer exactamente?`,
    date: () => pick(['¿Para cuándo es?', '¿Para qué fecha la dejo?'])
  };

  function stepAdd(d, ask) {
    const missing = need(d);
    if (missing) { pending = { kind: 'add', draft: d, ask: missing }; return { say: QUESTIONS[missing](d), listen: true }; }
    const t = B().add({
      title: d.title, subject: d.subject, type: d.type, date: d.date, time: d.time || '',
      priority: d.priority || (d.type === 'Examen' ? 'Alta' : 'Media'), desc: d.desc || ''
    });
    lastAdded = t.id; pending = null;
    return { say: `${pick(['Listo', 'Hecho', 'Anotado', 'Perfecto'])}, agregué “${t.title}” de ${t.subject} para ${speakDate(t.date)}${t.time ? ' a las ' + speakTime(t.time) : ''}.` };
  }

  function findTask(text, all) {
    const s = extract(text);
    const words = norm(s.title || '').split(/\s+/).filter(x => x.length > 3);
    const okSubj = t => !s.subject || (s.subject === '?english' ? /English/.test(t.subject) : t.subject === s.subject);
    const list = B().tasks().filter(t => all || !t.done).filter(okSubj).map(t => ({
      t, sc: (s.subject ? 2 : 0) + words.filter(x => norm(t.title).includes(x)).length * 2 + (s.date && t.date === s.date ? 1 : 0) + (s.type && t.type === s.type ? 1 : 0)
    })).filter(x => x.sc > 0);
    list.sort((a, b) => b.sc - a.sc || (a.t.date + a.t.time).localeCompare(b.t.date + b.t.time));
    return { task: list[0] && list[0].t, empty: !(s.subject || s.title || s.date || s.type) };
  }

  function act(kind, text) {
    const { task, empty } = findTask(text, kind === 'delete');
    if (!task) {
      if (empty) { pending = { kind: 'pick', action: kind }; return { say: '¿Cuál tarea? Dime la materia o el nombre.', listen: true }; }
      pending = null; return { say: 'No encontré una tarea que coincida.' };
    }
    if (kind === 'complete') { pending = null; B().complete(task.id); return { say: `Marcada como hecha: ${task.title}. ¡Buen trabajo!` }; }
    pending = { kind: 'confirm', id: task.id };
    return { say: `¿Seguro que quieres eliminar “${task.title}”?`, listen: true };
  }

  function listTasks(text) {
    const s = extract(text), n = norm(text);
    let items, label;
    if (!s.date && /\b(pendiente|pendientes|todo|todas|proxim)/.test(n)) {
      items = B().tasks().filter(t => !t.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); label = 'pendientes';
    } else {
      const d = s.date || addDays(0);
      items = B().tasks().filter(t => !t.done && (t.date === d || (d === addDays(0) && t.date < d)));
      label = 'para ' + speakDate(d);
    }
    if (!items.length) return { say: `No tienes nada ${label}. ¡Disfruta!` };
    const f = t => `${t.title} de ${t.subject}${t.time ? ' a las ' + speakTime(t.time) : ''}`;
    const shown = items.slice(0, 4).map(f), more = items.length - shown.length;
    const last = shown.pop();
    return { say: `Tienes ${items.length} ${items.length === 1 ? 'pendiente' : 'pendientes'} ${label}: ${shown.length ? shown.join(', ') + ' y ' : ''}${last}${more > 0 ? `, y ${more} más` : ''}.` };
  }

  function understand(text) {
    const n = norm(text).trim();
    if (pending && pending.kind === 'confirm') {
      const id = pending.id; pending = null;
      if (/^(si|sip|claro|dale|ok|okay|seguro|confirmo|elimin)/.test(n)) { B().remove(id); return { say: 'Eliminada.' }; }
      return { say: 'Está bien, no la elimino.' };
    }
    if (isCancel(n)) { const had = pending; pending = null; return { say: had ? 'Sin problema, lo dejamos así.' : 'Está bien. Aquí estoy si me necesitas.' }; }

    if (pending && pending.kind === 'pick') return act(pending.action, text);
    if (pending && pending.kind === 'add') {
      const d = pending.draft, ask = pending.ask, s = extract(text);
      if (ask === 'subject' && !s.subject && /\b(otro|otra|ninguna|no se)\b/.test(n)) s.subject = 'Otro';
      if (ask === 'subject' && !s.subject) { return { say: 'No reconocí esa materia. ¿Puedes repetirla?', listen: true }; }
      for (const k of Object.keys(s)) {
        if (!s[k]) continue;
        if (k === 'title' && d.title && ask !== 'title') continue;
        if (k === 'subject' && s[k] === '?english' && d.subject && d.subject !== '?english') continue;
        d[k] = s[k];
      }
      if (ask === 'english' && d.subject === '?english') return { say: 'Dime si es Academic o Conversational.', listen: true };
      if (ask === 'date' && !d.date) return { say: 'No entendí la fecha. Prueba con “el viernes”, “mañana” o “el 15 de octubre”.', listen: true };
      return stepAdd(d);
    }

    if (/\b(deshaz|deshacer|me equivoque|(quita|borra|elimina) la ultima)\b/.test(n)) {
      if (!lastAdded) return { say: 'No tengo nada reciente que deshacer.' };
      B().remove(lastAdded); lastAdded = null; return { say: 'Listo, deshice la última tarea.' };
    }
    if (/\b(borra|borrar|elimina|eliminar|quita|quitar)\b/.test(n)) return act('delete', text);
    if (/\b(complete|completa|completar|termine|ya hice|ya entregue|ya acabe|ya lo hice|marca|marcar|finalice)\b/.test(n)) return act('complete', text);
    if (/\b(que tengo|que tareas|cuales son mis|dime mis|leeme|lee mis|que hay (para|pendiente)|que pendientes|mis pendientes|mis tareas|que me falta)\b/.test(n)) return listTasks(text);
    if (/\b(ayuda|que puedes hacer|que sabes hacer)\b/.test(n) || /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|oye)?\s*,?\s*(nio)?\s*$/.test(n)) {
      return { say: `¡Hola ${B().name()}! Puedo agregar tareas, decirte qué tienes pendiente o marcarlas como hechas. ¿Qué necesitas?`, listen: true };
    }

    const s = extract(text);
    const cue = /\b(agrega|agregame|anade|anademe|pon|ponme|anota|anotame|apunta|apuntame|crea|creame|registra|programa|recuerda|recuerdame|avisame|tengo|hay que|necesito|quiero)\b/.test(n);
    if (cue || s.subject || s.type) return stepAdd(s);
    return { say: 'No te entendí bien. Prueba con “agrega una tarea de matemáticas para el viernes”.', listen: true };
  }

  /* ================= Voz e interfaz ================= */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const box = $('#nioContainer'), btn = $('#invokeNioBtn'), uiIn = $('.userInput'), uiOut = $('.nioResponse');
  if (!box || !btn) return;
  const sound = new Audio(SOUND_URL);
  const errSound = new Audio(ERR_SOUND_URL);
  const wave = document.createElement('span');
  wave.className = 'wave'; wave.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
  $('#nioContainer .input').prepend(wave);

  let active = false, cur = null, closeT, revT, session = 0, uiState = null;
  const setState = s => {
    uiState = s;
    box.classList.remove('listening', 'thinking', 'speaking');
    if (s) box.classList.add(s);
    btn.classList.toggle('listening', s === 'listening');
  };
  function killRec() {
    session++;
    if (cur) {
      cur.onend = cur.onerror = cur.onresult = cur.onstart = null;
      try { cur.abort(); } catch (e) {}
      cur = null;
    }
  }
  const close = () => {
    active = false; pending = null; setState(null);
    box.classList.remove('show'); btn.classList.remove('active'); document.body.classList.remove('nio-open');
  };
  const endSoon = () => { setState(null); clearTimeout(closeT); closeT = setTimeout(close, 6000); };
  function stopAll() {
    clearTimeout(closeT); clearInterval(revT);
    killRec();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    sound.pause(); close();
  }

  function reveal(text) {
    clearInterval(revT);
    const words = text.split(' '); let i = 0;
    uiOut.textContent = '';
    revT = setInterval(() => { uiOut.textContent = words.slice(0, ++i).join(' '); if (i >= words.length) clearInterval(revT); }, 55);
  }
  function speak(text, done) {
    if (!('speechSynthesis' in window)) return setTimeout(done, 500 + text.length * 45);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[“”"]/g, ''));
    const vs = speechSynthesis.getVoices();
    const v = vs.find(x => /^es[-_](MX|419|US|CR)/i.test(x.lang)) || vs.find(x => /^es/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'es-MX'; u.rate = 1.04; u.pitch = 1.05;
    let fin = false;
    const end = () => { if (!fin) { fin = true; clearTimeout(tm); done(); } };
    const tm = setTimeout(end, 2500 + text.length * 95);
    u.onend = end; u.onerror = end;
    speechSynthesis.speak(u);
  }

  function respond(r) {
    if (!active) return;
    setState('speaking'); reveal(r.say);
    speak(r.say, () => {
      if (!active) return;
      if ('speechSynthesis' in window) speechSynthesis.cancel(); // libera el audio
      if (r.listen || pending) setTimeout(() => listen(), 450);   // pausa antes de abrir el micrófono
      else endSoon();
    });
  }
  function handle(text) {
    uiIn.textContent = text; setState('thinking');
    setTimeout(() => {
      let r;
      try { r = understand(text); } catch (e) { console.error(e); errSound.play(); pending = null; r = { say: 'Uy, algo falló. ¿Lo intentamos de nuevo?' }; }
      respond(r);
    }, 400 + Math.random() * 300);
  }

  function typed() {
    setState('listening');
    uiIn.innerHTML = '<input class="nioType" placeholder="Escribe y pulsa Enter">';
    const i = uiIn.firstChild; i.focus();
    i.onkeydown = e => { if (e.key === 'Enter' && i.value.trim()) handle(i.value.trim()); };
  }
  function listen(attempt = 0) {
    if (!active) return;
    if (!SR) return typed();
    killRec();
    const id = ++session;
    const rec = new SR();
    rec.lang = 'es-CR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let text = '', err = '', started = false, done = false, wd1, wd2;
    setState('listening'); uiIn.textContent = 'Escuchando...'; uiIn.classList.add('ghost');

    const finish = () => {
      if (done || id !== session) return;
      done = true; clearTimeout(wd1); clearTimeout(wd2);
      if (cur === rec) cur = null;
      uiIn.classList.remove('ghost');
      if (!active) return;
      if (text) return handle(text);
      if (!started && !err && attempt < 2) return listen(attempt + 1); // nunca arrancó, reintenta
      const msg = err === 'not-allowed' || err === 'service-not-allowed' ? 'Necesito permiso para usar el micrófono.'
        : err === 'network' ? 'No pude conectar el reconocimiento de voz.' : 'No te escuché. Toca el micrófono cuando quieras.';
      reveal(msg); endSoon(); setTimeout(() => errSound.play().catch(() => {}), 300);
    };

    rec.onstart = () => { started = true; };
    rec.onresult = e => {
      text = [...e.results].map(r => r[0].transcript).join(' ').trim();
      if (text) { uiIn.textContent = text; uiIn.classList.remove('ghost'); }
    };
    rec.onerror = e => { if (e.error !== 'aborted') err = e.error; };
    rec.onend = finish;

    // Si en 2.5 s no arrancó, la descartamos y reintentamos
    wd1 = setTimeout(() => { if (!started) { try { rec.abort(); } catch (e) {} setTimeout(finish, 400); } }, 2500);
    // Tope de seguridad: si en 15 s no pasa nada, cerramos esta escucha
    wd2 = setTimeout(() => { try { rec.abort(); } catch (e) {} setTimeout(finish, 400); }, 15000);

    cur = rec;
    try { rec.start(); } catch (e) { err = 'start'; setTimeout(finish, 200); }
  }

  function startSession() {
    let started = false;
    const go = () => { if (!started) { started = true; listen(); } };
    uiIn.textContent = 'Escuchando...'; uiIn.classList.add('ghost'); setState('listening');
    sound.onended = null; sound.pause(); sound.currentTime = 0; sound.onended = go;
    sound.play().then(() => setTimeout(go, 1600)).catch(go);
  }
  function invoke() {
    if (active && uiState) return stopAll();
    clearTimeout(closeT);
    if (!active) {
      active = true; uiOut.textContent = '';
      box.classList.add('show'); btn.classList.add('active'); document.body.classList.add('nio-open');
    }
    startSession();
  }
  btn.addEventListener('click', invoke);
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
})();