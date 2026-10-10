(() => {
  const I = window.Intel, T = I.text, C = I.classify, cfg = I.config;
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseD = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayDiff = (ds, now) => Math.round((parseD(ds) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const dayName = ds => WD[parseD(ds).getDay()];

  /* ---- Classroom: dueDate/dueTime vienen en UTC → hora local ---- */
  function dueOf(d, t) {
    if (!d) return null;
    if (t) {
      const dt = new Date(Date.UTC(d.year, d.month - 1, d.day, t.hours || 0, t.minutes || 0));
      return { date: dstr(dt), time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
    }
    return { date: `${d.year}-${pad(d.month)}-${pad(d.day)}`, time: '' };
  }

  /* ---- 1. Señales ---- */
  function buildSignals(cache, intel, now) {
    const sigs = [], cl = cache && cache.classroom;
    if (cl) {
      const courses = new Map(cl.courses.map(c => [c.id, c]));
      const subs = new Map(cl.subs.map(s => [s.courseId + ':' + s.courseWorkId, s]));
      for (const w of cl.work) {
        const c = courses.get(w.courseId), s = subs.get(w.courseId + ':' + w.id), due = dueOf(w.dueDate, w.dueTime);
        const text = `${w.title} ${w.description}`;
        sigs.push({ key: `cw:${w.courseId}:${w.id}`, kind: 'coursework', title: w.title, text, course: c, courseId: w.courseId,
          subject: C.subject(c, intel), date: due && due.date, time: due ? due.time : '', type: C.type(text, 'Tarea'),
          points: w.maxPoints, sub: (s && s.state) || 'NEW', late: !!(s && s.late), url: w.link, created: Date.parse(w.created) });
      }
      for (const a of cl.announcements) {
        const created = new Date(a.created);
        if ((now - created) / 864e5 > cfg.ANNOUNCE_DAYS) continue;
        const c = courses.get(a.courseId), intent = C.intent(a.text);
        const dates = T.findDates(a.text, created).map(d => dstr(d.date));      // ← relativo a CUANDO se escribió
        sigs.push({ key: `an:${a.courseId}:${a.id}`, kind: 'announcement', title: a.text.split(/[.\n!?]/)[0].slice(0, 80), text: a.text,
          course: c, courseId: a.courseId, subject: C.subject(c, intel), intent, dates, time: T.findTime(a.text),
          created: +created, url: a.link, type: C.type(a.text, 'Recordatorio') });
      }
    }
    const cal = cache && cache.calendar;
    if (cal) for (const e of cal.events) {
      // OJO: los eventos de "todo el día" traen 'YYYY-MM-DD'. new Date('2026-10-12') es UTC y en CR cae el día anterior.
      let date, time = '';
      if (e.allDay) date = e.start.slice(0, 10);
      else { const d = new Date(e.start); date = dstr(d); time = `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
      const text = `${e.title} ${e.desc}`;
      sigs.push({ key: `ev:${e.id}:${date}`, kind: 'event', title: e.title, text, date, time, allDay: e.allDay, recurring: e.recurring,
        isHoliday: e.isHoliday, cal: e.cal, attendees: e.attendees, url: e.link, type: C.type(text, 'Recordatorio'), subject: null });
    }
    return sigs;
  }

  /* ---- 2. ¿Ya lo apunté? ---- */
  function findTask(sig, tasks, now) {
    const exact = tasks.find(t => t.src === sig.key);
    if (exact) return { task: exact, how: 'src', score: 1 };
    let best = null;
    for (const t of tasks) {
      const ts = T.similarity(sig.title, t.title);
      const dd = sig.date && t.date ? Math.abs(dayDiff(sig.date, now) - dayDiff(t.date, now)) : 9;
      const dateScore = dd === 0 ? 1 : dd <= 1 ? .7 : dd <= 3 ? .3 : 0;
      const subj = sig.subject && sig.subject === t.subject ? 1 : 0;
      const score = ts * .6 + dateScore * .25 + subj * .15;          // ← ajusta estos pesos si ves falsos positivos/negativos
      if (!best || score > best.score) best = { task: t, how: 'fuzzy', score };
    }
    return best && best.score >= .55 ? best : null;
  }

  /* ---- 3. Puntaje explicable ---- */
  function learned(stats, keys) {
    let adj = 0;
    for (const k of keys) { const s = stats[k]; if (s) adj += ((s.acc - s.dis) / (s.acc + s.dis + 3)) * 10; }
    return adj;
  }
  function scoreSignal(sig, now, stats) {
    let s = ({ coursework: 40, announcement: 32, event: 22 })[sig.kind] || 20;
    const why = [], d = sig.date ? dayDiff(sig.date, now) : null;

    const tb = { 'Examen': 30, 'Documento Firmado': 20, 'Proyecto': 18, 'Tarea': 8, 'Recordatorio': 6 }[sig.type] || 0;
    s += tb; if (sig.type === 'Examen') why.push('Es un examen'); else if (tb >= 18) why.push(sig.type);

    if (d === null)      { s -= 8;  why.push('Sin fecha límite'); }
    else if (d < -14)    { s -= 40; why.push('Venció hace mucho'); }
    else if (d < 0)      { if (sig.kind === 'coursework') { s += 22; why.push(`Atrasada ${-d} d`); } else s -= 25; }
    else if (d === 0)    { s += 28; why.push('Es hoy'); }
    else if (d === 1)    { s += 24; why.push('Es mañana'); }
    else if (d <= 3)     { s += 18; why.push(`En ${d} días`); }
    else if (d <= 7)     { s += 10; why.push(`En ${d} días`); }
    else if (d <= 14)    { s += 3; }
    else                 { s -= 10; why.push('Todavía falta bastante'); }

    if (sig.points >= 50) { s += 8; why.push(`Vale ${sig.points} pts`); } else if (sig.points >= 20) s += 4;
    if (C.isUrgent(sig.text)) { s += 10; why.push('Marcado como importante'); }

    if (sig.kind === 'announcement') {
      const age = (now - sig.created) / 36e5;
      if (age < 48) { s += 8; why.push('Aviso reciente'); } else if (age > 240) s -= 10;
    }
    if (sig.kind === 'event') {
      if (sig.isHoliday) s -= 35;
      if (/cumple|birthday/i.test(sig.title)) s -= 40;
      if (sig.recurring && sig.allDay) s -= 25;
      if (sig.recurring && !sig.allDay) { s -= 20; why.push('Se repite (¿tu horario?)'); }
      if (!C.looksAcademic(sig.title + ' ' + (sig.cal || ''))) s -= 8;
    }
    s += learned(stats, [`${sig.kind}|${sig.subject || '-'}`, `type|${sig.type}`]);
    return { score: clamp(Math.round(s), 0, 100), why: why.slice(0, 4) };
  }

  const prio = sc => sc >= 75 ? 'Alta' : sc >= 50 ? 'Media' : 'Baja';
  const subjectColor = name => (DashApp.SUBJECTS[name] || '#8ab4ff');

  /* ---- 4/5. Pipeline completo ---- */
  function analyze({ cache, tasks, intel, stats, now = new Date() }) {
    const sigs = buildSignals(cache, intel, now), out = [];
    const hidden = id => intel.dismissed[id] || intel.accepted[id] || (intel.snoozed[id] && intel.snoozed[id] > Date.now());
    const push = s => { if (!hidden(s.id)) out.push(s); };
    const cwSigs = sigs.filter(s => s.kind === 'coursework');

    // Materias nuevas
    for (const c of ((cache && cache.classroom && cache.classroom.courses) || [])) {
      if (C.subject(c, intel)) continue;
      const used = Object.values(DashApp.SUBJECTS);
      const color = cfg.PALETTE.find(p => !used.includes(p)) || '#8ab4ff';
      push({ id: `subj:${c.id}`, kind: 'new_subject', title: `Nueva materia: ${c.name}`, score: 70, why: ['No coincide con ninguna de tus materias'],
        draft: { name: c.name.slice(0, 30), color, courseId: c.id }, subject: null });
    }

    for (const sig of sigs) {
      const m = findTask(sig, tasks, now);

      /* —— Classroom: tareas —— */
      if (sig.kind === 'coursework') {
        const submitted = sig.sub === 'TURNED_IN' || sig.sub === 'RETURNED';
        if (m) {
          const t = m.task;
          if (submitted && !t.done) push({ id: `done:${sig.key}`, kind: 'complete', title: `¿Ya entregaste "${t.title}"?`, subtitle: 'Classroom dice que ya la entregaste',
            score: 62, why: ['Ya está entregada en Classroom'], taskId: t.id, subject: t.subject });
          else if (!submitted && !t.done && sig.date && t.date !== sig.date && (m.how === 'src' || m.score > .7))
            push({ id: `date:${sig.key}:${sig.date}`, kind: 'reschedule', title: `Cambió la fecha de "${t.title}"`,
              subtitle: `Tú: ${t.date} → Classroom: ${sig.date}`, score: 68, why: ['La fecha en Classroom es distinta'],
              taskId: t.id, patch: { date: sig.date, ...(sig.time ? { time: sig.time } : {}) }, subject: t.subject });
          continue;
        }
        if (submitted) continue;
        const { score, why } = scoreSignal(sig, now, stats);
        if (score < cfg.MIN_SCORE) continue;
        push({ id: sig.key, kind: 'add', title: sig.title, subtitle: sig.course ? sig.course.name : '', subject: sig.subject, score, why, url: sig.url,
          date: sig.date, time: sig.time,
          draft: { title: sig.title, subject: sig.subject || 'Otro', type: sig.type, date: sig.date || DashApp.plus(1), time: sig.time || '',
                   priority: prio(score), desc: (sig.text || '').slice(sig.title.length).trim().slice(0, 400), src: sig.key, url: sig.url } });
        continue;
      }

      /* —— Calendar: eventos —— */
      if (sig.kind === 'event') {
        if (m) continue;
        if (dayDiff(sig.date, now) < 0) continue;
        if (cwSigs.some(c => c.date === sig.date && T.similarity(c.title, sig.title) > .6)) continue;   // el evento es la tarea de Classroom reflejada
        const { score, why } = scoreSignal(sig, now, stats);
        if (score < cfg.MIN_SCORE) continue;
        push({ id: sig.key, kind: 'add', title: sig.title, subtitle: `Calendar${sig.cal ? ' · ' + sig.cal : ''}`, subject: null, score, why, url: sig.url, date: sig.date, time: sig.time,
          draft: { title: sig.title, subject: 'Otro', type: sig.type, date: sig.date, time: sig.time, priority: prio(score), desc: sig.text.slice(sig.title.length).trim().slice(0, 300), src: sig.key, url: sig.url } });
        continue;
      }

      /* —— Avisos de profes —— */
      if (sig.kind === 'announcement') {
        const label = { exam: 'Examen', deadline: 'Entrega', bring: 'Traer material', sign: 'Documento firmado', meeting: 'Actividad', change: 'Cambio de fecha', cancel: 'Aviso', info: 'Aviso' }[sig.intent];
        const who = sig.subject || (sig.course && sig.course.name) || '';
        const future = sig.dates.filter(ds => { const d = dayDiff(ds, now); return d >= 0 && d <= 30; });
        if (sig.intent === 'cancel') {
          if (sig.dates.some(ds => dayDiff(ds, now) >= 0))
            push({ id: sig.key, kind: 'notice', title: `${who}: ${sig.title}`, subtitle: 'Cancelación / suspensión', score: 60, why: ['Afecta tu horario'], url: sig.url, subject: sig.subject });
          continue;
        }
        if (!future.length) continue;
        if (sig.intent === 'info' && !C.isUrgent(sig.text)) continue;
        const date = future[0];
        // ¿ya es una tarea de Classroom o ya la apunté?
        if (cwSigs.some(c => c.courseId === sig.courseId && c.date && Math.abs(dayDiff(c.date, now) - dayDiff(date, now)) <= 1)) continue;
        const tm = findTask({ title: `${label} ${who}`, date, subject: sig.subject }, tasks, now);
        if (tm) continue;
        const sc = scoreSignal({ ...sig, date, type: sig.intent === 'exam' ? 'Examen' : sig.type }, now, stats);
        if (sc.score < cfg.MIN_SCORE) continue;
        const type = sig.intent === 'exam' ? 'Examen' : sig.intent === 'sign' ? 'Documento Firmado' : sig.intent === 'deadline' ? 'Tarea' : 'Recordatorio';
        push({ id: sig.key, kind: 'add', title: `${label}${who ? ' · ' + who : ''}`, subtitle: `Aviso: "${sig.title}"`, subject: sig.subject, score: sc.score, why: ['Lo mencionó el profe', ...sc.why].slice(0, 4),
          date, time: sig.time, url: sig.url,
          draft: { title: `${label} de ${who || 'clase'}`, subject: sig.subject || 'Otro', type, date, time: sig.time, priority: prio(sc.score), desc: sig.text.slice(0, 400), src: sig.key, url: sig.url } });
      }
    }

    /* —— Sugerencias basadas SOLO en tu dashboard —— */
    const pending = tasks.filter(t => !t.done);

    // Plan de estudio antes de exámenes
    for (const t of pending.filter(t => t.type === 'Examen')) {
      const d = dayDiff(t.date, now);
      if (d < 2 || d > 10) continue;
      const has = pending.some(x => x.id !== t.id && /estudi|repas/.test(T.norm(x.title)) && dayDiff(x.date, now) <= d - 1 && T.similarity(x.title, t.title) > .25);
      if (has) continue;
      const when = d - 2 >= 0 ? dayDiff(t.date, now) - 2 : 0;
      const date = dstr(new Date(now.getFullYear(), now.getMonth(), now.getDate() + when));
      push({ id: `study:${t.id}`, kind: 'add', title: `Estudiar para: ${t.title}`, subtitle: `El examen es el ${dayName(t.date)}`, subject: t.subject,
        score: clamp(55 + (7 - d) * 3, 40, 90), why: [`Examen en ${d} días`, 'No tienes tiempo de estudio apuntado'], date,
        draft: { title: `Estudiar para ${t.title}`, subject: t.subject, type: 'Recordatorio', date, time: '', priority: 'Alta', desc: 'Repasar apuntes y hacer práctica.', src: `study:${t.id}` } });
    }

    // Días sobrecargados
    const byDay = {};
    for (const t of pending) { const d = dayDiff(t.date, now); if (d >= 0 && d <= 7) (byDay[t.date] = byDay[t.date] || []).push(t); }
    for (const [date, list] of Object.entries(byDay)) if (list.length >= 4)
      push({ id: `load:${date}`, kind: 'notice', title: `El ${dayName(date)} tienes ${list.length} cosas`, subtitle: 'Considera adelantar algo antes',
        score: 50 + list.length * 2, why: ['Día sobrecargado'], date });

    // Pendientes viejos
    for (const t of pending) {
      const d = -dayDiff(t.date, now);
      if (d >= 7) push({ id: `stale:${t.id}`, kind: 'stale', title: `"${t.title}" lleva ${d} días vencida`, subtitle: '¿Sigue vigente?',
        score: clamp(30 + d, 30, 60), why: ['Sigue pendiente hace tiempo'], taskId: t.id, subject: t.subject });
    }

    // Deduplicar por id, ordenar y recortar
    const seen = new Set();
    return out.filter(s => !seen.has(s.id) && seen.add(s.id))
      .sort((a, b) => b.score - a.score).slice(0, cfg.MAX_SUGGESTIONS)
      .map(s => ({ ...s, color: s.subject ? subjectColor(s.subject) : '#8ab4ff' }));
  }

  I.analyze = analyze;
  I._internals = { buildSignals, findTask, scoreSignal, dueOf };   // para depurar en consola
})();