(() => {
  const I = window.Intel;
  const LAST = 'dash-intel-lastvisit', USED = 'dash-intel-greet-used';
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const plural = (n, s, p) => n === 1 ? s : p;

  function context() {
    const A = window.DashApp, st = A.getState(), now = new Date(), h = now.getHours();
    const today = A.plus(0), hhmm = `${A.pad(h)}:${A.pad(now.getMinutes())}`;
    const tasks = st.tasks, pending = tasks.filter(t => !t.done);
    const todayList = tasks.filter(t => t.date === today || (t.date < today && !t.done));
    const done = todayList.filter(t => t.done).length;
    const late = pending.filter(t => t.date < today || (t.date === today && t.time && t.time < hhmm)).sort(A.cmp);
    const dueToday = pending.filter(t => t.date === today).sort(A.cmp);
    const upcoming = pending.filter(t => t.date >= today).sort(A.cmp);
    const days = t => Math.round((new Date(t.date + 'T00:00') - new Date(today + 'T00:00')) / 864e5);
    const exam = upcoming.find(t => t.type === 'Examen');
    const nextTimed = dueToday.find(t => t.time && t.time >= hhmm);
    const minsToNext = nextTimed ? (+nextTimed.time.slice(0, 2) * 60 + +nextTimed.time.slice(3)) - (h * 60 + now.getMinutes()) : null;
    const notes = st.notes || '';
    const noteHit = (notes.match(/\b(examen|entregar|urgente|recordar|ma[ñn]ana|tarea)\b/i) || [])[0];
    const sg = (I.state && I.state.suggestions) || [];
    const last = +localStorage.getItem(LAST) || 0;
    return {
      name: st.name, h, dow: now.getDay(), slot: h < 5 ? 'madrugada' : h < 12 ? 'manana' : h < 14 ? 'mediodia' : h < 19 ? 'tarde' : 'noche',
      total: pending.length, todayN: todayList.length, done, pct: todayList.length ? Math.round(done / todayList.length * 100) : 0,
      left: todayList.length - done, late, dueToday, next: upcoming[0], exam, examDays: exam ? days(exam) : null,
      nextTimed, minsToNext, notes, noteHit, notesEmpty: !notes.trim(),
      weekAhead: upcoming.filter(t => days(t) <= 7).length, mondayN: upcoming.filter(t => new Date(t.date + 'T00:00').getDay() === 1 && days(t) <= 2).length,
      sg, topSg: sg[0], away: last ? (Date.now() - last) / 36e5 : null,
      weather: ((document.getElementById('w-desc') || {}).textContent || '').toLowerCase(),
      temp: (document.getElementById('w-temp') || {}).textContent || ''
    };
  }

  const R = [];
  const rule = (id, w, when, mood, say) => R.push({ id, w, when, mood, say });

  rule('next-soon', 95, c => c.minsToNext != null && c.minsToNext <= 90, 'urgent',
    c => [`En ${c.minsToNext} min: "${c.nextTimed.title}". Ve preparándote.`, `Se acerca "${c.nextTimed.title}" (${c.minsToNext} min).`]);
  rule('exam-tomorrow', 100, c => c.examDays === 1, 'urgent',
    c => [`Mañana tienes "${c.exam.title}". Hoy toca repasar, tú puedes.`, `Examen mañana: ${c.exam.title}. Un repaso corto hoy hace mucha diferencia.`]);
  rule('exam-soon', 88, c => c.examDays != null && c.examDays >= 2 && c.examDays <= 4, 'busy',
    c => [`"${c.exam.title}" es en ${c.examDays} días. Empieza a repasar sin prisa pero sin pausa.`]);
  rule('late', 85, c => c.late.length > 0, 'urgent',
    c => [`Tienes ${c.late.length} ${plural(c.late.length, 'pendiente atrasado', 'pendientes atrasados')}. Empieza por "${c.late[0].title}".`,
          `"${c.late[0].title}" ya pasó su hora. Mejor quitártela de encima primero.`]);
  rule('night-left', 75, c => (c.slot === 'noche') && c.left > 0 && c.todayN > 0, 'busy',
    c => [`Ya es tarde y te ${plural(c.left, 'queda', 'quedan')} ${c.left} de hoy. ¿Las terminas o las pasas a mañana?`]);
  rule('busy-day', 70, c => c.dueToday.length >= 4 && c.slot !== 'noche', 'busy',
    c => [`Día cargado: ${c.dueToday.length} cosas para hoy. Empieza por "${c.dueToday[0].title}".`]);
  rule('suggestions', 66, c => c.topSg && c.topSg.score >= 70, 'calm',
    c => [`Encontré ${c.sg.length} ${plural(c.sg.length, 'cosa', 'cosas')} que quizá quieras apuntar. La más importante: "${c.topSg.title}".`]);
  rule('all-done', 80, c => c.todayN > 0 && c.left === 0, 'celebrate',
    c => [`¡Día completado! ${c.done} de ${c.done}. Disfruta el resto de tu día.`, `Todo listo por hoy. Buen trabajo, ${c.name}.`]);
  rule('progress', 60, c => c.pct >= 50 && c.pct < 100, 'calm',
    c => [`Vas por el ${c.pct}% del día. ${plural(c.left, 'Solo falta', 'Solo faltan')} ${c.left}.`]);
  rule('sun-night', 65, c => c.dow === 0 && c.h >= 17, 'calm',
    c => [c.mondayN ? `Mañana empieza la semana y ya tienes ${c.mondayN} ${plural(c.mondayN, 'cosa', 'cosas')} para el lunes. Deja todo listo hoy :D` : 'Mañana empieza la semana. Deja tus materiales listos :D']);
  rule('weekend', 50, c => (c.dow === 6 || c.dow === 0) && c.weekAhead > 0, 'calm',
    c => [`Fin de semana, buen momento para adelantar. Tienes ${c.weekAhead} cosas en los próximos 7 días.`]);
  rule('friday', 48, c => c.dow === 5 && c.slot === 'tarde', 'calm',
    c => ['Ya casi es fin de semana. Revisa qué queda pendiente antes de desconectarte jsjs']);
  rule('monday', 52, c => c.dow === 1 && c.slot === 'manana', 'busy',
    c => [`Lunes, nueva semana. Esta semana llevas ${c.weekAhead} ${plural(c.weekAhead, 'cosa', 'cosas')} por delante.`]);
  rule('notes', 55, c => c.noteHit, 'calm',
    c => [`Tus notas mencionan "${c.noteHit}". Lo conviertes en una tarea?`]);
  rule('rain', 30, c => /lluvia|tormenta/.test(c.weather) && c.left > 0, 'calm',
    c => [`Está lloviendo, buen plan para quedarse adelantando pendientes (${c.left} hoy).`]);
  rule('free', 40, c => c.todayN === 0 && c.total === 0, 'calm',
    c => ['No tienes nada pendiente. Aprovecha para descansar o adelantar algo.']);
  rule('free-today', 35, c => c.todayN === 0 && c.total > 0, 'calm',
    c => [`Hoy no tienes nada, pero hay ${c.total} ${plural(c.total, 'pendiente', 'pendientes')} más adelante. Siguiente: "${c.next ? c.next.title : ''}".`]);
  rule('default', 1, () => true, 'calm',
    c => [`Tienes ${c.total} ${plural(c.total, 'pendiente', 'pendientes')} en total. Un paso a la vez.`]);

  function title(c) {
    const n = c.name;
    if (c.away === null) return `Bienvenido, ${n}`;
    if (c.away > 6) return `Bienvenido de vuelta, ${n}. ¡Es un gusto tenerte de nuevo!`;
    return pick({
      madrugada: [`Todavía despierto, ${n}?`, `Es de madrugada, ${n}. No te desveles de más, mira que tienes que despertar temprano...`],
      manana:    [`Buenos días, ${n}`, `A empezar el día, ${n}!`],
      mediodia:  [`Hola de nuevo, ${n}`, `Buen mediodía, ${n}`],
      tarde:     [`Buenas tardes, ${n}`, `Qué tal la tarde, ${n}`],
      noche:     [`Buenas noches, ${n}`, `Último empujón del día, ${n}`]
    }[c.slot]);
  }

  function compose() {
    const c = context();
    const used = JSON.parse(localStorage.getItem(USED) || '[]');
    const ok = R.filter(r => { try { return r.when(c); } catch (e) { return false; } }).sort((a, b) => b.w - a.w);
    const top = ok[0].w;
    let pool = ok.filter(r => r.w >= top - 12 && !used.includes(r.id));
    if (!pool.length) pool = ok.filter(r => r.w >= top - 12);
    const r = pick(pool);
    localStorage.setItem(USED, JSON.stringify([r.id, ...used].slice(0, 3)));
    localStorage.setItem(LAST, String(Date.now()));

    const chips = [];
    if (c.todayN) chips.push(['fi-rr-list-check', `${c.left} por hacer hoy`]);
    if (c.late.length) chips.push(['fi-rr-exclamation', `${c.late.length} atrasada${c.late.length > 1 ? 's' : ''}`]);
    if (c.exam) chips.push(['fi-rr-graduation-cap', c.examDays === 0 ? 'Examen hoy' : `Examen en ${c.examDays} d`]);
    if (c.sg.length) chips.push(['fi-rr-bulb', `${c.sg.length} sugerencia${c.sg.length > 1 ? 's' : ''}`]);
    if (c.temp && c.temp !== '--°') chips.push(['fi-rr-cloud-sun', c.temp]);
    return { title: title(c), text: pick(r.say(c)), mood: r.mood, chips,
             sig: [c.slot, c.total, c.late.length, c.done, c.sg.length, c.dow].join('|') };
  }

  I.greeter = { compose, context };
})();