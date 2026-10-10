(() => {
  const I = window.Intel;

  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s\/:.\-]/g, ' ').replace(/\s+/g, ' ').trim();

  const STOP = new Set('de la el los las un una unos unas y o a en con por para del al que se su sus es son este esta estos estas lo como mas pero si no entregar entrega tarea'.split(' '));
  const tokens = s => norm(s).split(' ').filter(w => w.length > 1 && !STOP.has(w));

  const tri = s => {
    const t = ' ' + norm(s) + ' ', m = new Map();
    for (let i = 0; i < t.length - 2; i++) { const g = t.slice(i, i + 3); m.set(g, (m.get(g) || 0) + 1); }
    return m;
  };
  const dice = (a, b) => {
    const A = tri(a), B = tri(b); let inter = 0, ta = 0, tb = 0;
    for (const v of A.values()) ta += v;
    for (const v of B.values()) tb += v;
    for (const [g, v] of A) inter += Math.min(v, B.get(g) || 0);
    return ta + tb ? (2 * inter) / (ta + tb) : 0;
  };
  const jaccard = (a, b) => {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let i = 0; for (const x of A) if (B.has(x)) i++;
    return i / (A.size + B.size - i);
  };
  const similarity = (a, b) => Math.max(dice(a, b), jaccard(a, b));

  const MONTHS = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
  const DAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

  // Devuelve [{ date: Date, kind, match }] ordenadas y sin repetir
  function findDates(text, base = new Date()) {
    const t = norm(text), out = [];
    const b0 = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const shift = n => { const d = new Date(b0); d.setDate(d.getDate() + n); return d; };
    const add = (date, kind, match) => out.push({ date, kind, match });
    let m;

    // "15 de octubre", "15 octubre", "15 de octubre de 2026"
    const re1 = /\b(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b(?:\s*(?:de|del)?\s*(\d{4}))?/g;
    while ((m = re1.exec(t))) {
      const y = m[3] ? +m[3] : b0.getFullYear();
      let d = new Date(y, MONTHS[m[2]], +m[1]);
      if (!m[3] && d < shift(-30)) d = new Date(y + 1, MONTHS[m[2]], +m[1]);
      add(d, 'abs', m[0]);
    }
    // "15/10", "15-10-2026" (formato día/mes, como en CR)
    const re2 = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
    while ((m = re2.exec(t))) {
      const dd = +m[1], mm = +m[2] - 1;
      if (dd < 1 || dd > 31 || mm < 0 || mm > 11) continue;
      const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : b0.getFullYear();
      add(new Date(y, mm, dd), 'abs', m[0]);
    }
    // relativas
    if (/\bpasado manana\b/.test(t)) add(shift(2), 'rel', 'pasado mañana');
    else if (/(?<!\bla\s)\bmanana\b/.test(t)) add(shift(1), 'rel', 'mañana');   // "en la mañana" ≠ mañana
    if (/\bhoy\b/.test(t)) add(shift(0), 'rel', 'hoy');
    // "el lunes", "este viernes", "próximo martes"
    const re3 = /\b(?:(?:proximo|este|el)\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/g;
    while ((m = re3.exec(t))) {
      let diff = (DAYS[m[1]] - b0.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      add(shift(diff), 'dow', m[0]);
    }
    // únicas por día, ordenadas
    const seen = new Set();
    return out.filter(o => { const k = +o.date; if (seen.has(k)) return false; seen.add(k); return true; })
              .sort((a, b) => a.date - b.date);
  }

  // "a las 8:30", "10:00 am", "2 pm" → "HH:MM" | ''
  function findTime(text) {
    const t = norm(text);
    let m = t.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?/);
    if (!m) m = t.match(/\ba las (\d{1,2})()\s*(a\.?m\.?|p\.?m\.?)?/);
    if (!m) return '';
    let h = +m[1]; const mi = +(m[2] || 0);
    if (m[3] && /^p/.test(m[3]) && h < 12) h += 12;
    if (m[3] && /^a/.test(m[3]) && h === 12) h = 0;
    return h < 24 && mi < 60 ? String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') : '';
  }

  I.text = { norm, tokens, similarity, findDates, findTime };
})();