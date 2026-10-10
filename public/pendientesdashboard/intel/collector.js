(() => {
  const I = window.Intel, G = I.google;
  const CL = 'https://classroom.googleapis.com/v1';
  const CAL = 'https://www.googleapis.com/calendar/v3';

  async function pool(items, n, fn) {
    const out = []; let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
    }));
    return out;
  }

  const slimWork = w => ({ id: w.id, courseId: w.courseId, title: w.title || '', description: (w.description || '').slice(0, 600),
    workType: w.workType, maxPoints: w.maxPoints || 0, dueDate: w.dueDate || null, dueTime: w.dueTime || null,
    created: w.creationTime, updated: w.updateTime, link: w.alternateLink, nMaterials: (w.materials || []).length });
  const slimSub = s => ({ courseId: s.courseId, courseWorkId: s.courseWorkId, state: s.state, late: !!s.late,
    grade: s.assignedGrade == null ? null : s.assignedGrade, updated: s.updateTime });
  const slimAnn = a => ({ id: a.id, courseId: a.courseId, text: (a.text || '').slice(0, 1200),
    created: a.creationTime, updated: a.updateTime, link: a.alternateLink });
  const slimMat = m => ({ id: m.id, courseId: m.courseId, title: m.title || '', description: (m.description || '').slice(0, 400),
    created: m.creationTime, link: m.alternateLink });

  async function collectClassroom() {
    const courses = await G.paged(`${CL}/courses?studentId=me&courseStates=ACTIVE&pageSize=50`, 'courses', 2);
    const out = { courses: courses.map(c => ({ id: c.id, name: c.name, section: c.section || '', room: c.room || '', link: c.alternateLink })),
      work: [], subs: [], announcements: [], materials: [] };

    await pool(courses, 3, async c => {
      const [work, subs, ann, mats] = await Promise.all([
        G.paged(`${CL}/courses/${c.id}/courseWork?courseWorkStates=PUBLISHED&orderBy=dueDate%20desc&pageSize=50`, 'courseWork', 3),
        G.paged(`${CL}/courses/${c.id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`, 'studentSubmissions', 3),
        G.paged(`${CL}/courses/${c.id}/announcements?announcementStates=PUBLISHED&orderBy=updateTime%20desc&pageSize=20`, 'announcements', 1),
        G.paged(`${CL}/courses/${c.id}/courseWorkMaterials?courseWorkMaterialStates=PUBLISHED&pageSize=20`, 'courseWorkMaterial', 1).catch(() => [])
      ]);
      out.work.push(...work.map(slimWork));
      out.subs.push(...subs.map(slimSub));
      out.announcements.push(...ann.map(slimAnn));
      out.materials.push(...mats.map(slimMat));
    });
    return out;
  }

  async function collectCalendar() {
    const cals = await G.paged(`${CAL}/users/me/calendarList?minAccessRole=reader`, 'items', 2);
    const sel = cals.filter(c => c.selected !== false);
    const min = new Date(Date.now() - 864e5).toISOString();
    const max = new Date(Date.now() + I.config.CALENDAR_DAYS_AHEAD * 864e5).toISOString();
    const events = [];
    await pool(sel, 3, async c => {
      const url = `${CAL}/calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}`;
      let items = [];
      try { items = await G.paged(url, 'items', 2); } catch (e) { return; }   // un calendario roto no tumba todo
      for (const e of items) {
        if (e.status === 'cancelled') continue;
        const me = (e.attendees || []).find(a => a.self);
        if (me && me.responseStatus === 'declined') continue;
        if (!e.start) continue;
        events.push({ id: e.id, cal: c.summaryOverride || c.summary || '', calId: c.id,
          title: e.summary || '(sin título)', desc: (e.description || '').slice(0, 500), loc: e.location || '',
          allDay: !!e.start.date, start: e.start.dateTime || e.start.date, end: (e.end && (e.end.dateTime || e.end.date)) || '',
          recurring: !!e.recurringEventId, attendees: (e.attendees || []).length, link: e.htmlLink,
          isHoliday: /holiday|festivo|feriado/i.test(c.id) });
      }
    });
    return { calendars: sel.map(c => ({ id: c.id, name: c.summary })), events };
  }

  const explain = e => e.status === 403 ? 'Permiso denegado (¿API no habilitada o scope sin aceptar?)'
    : e.status === 401 ? 'Sesión expirada' : (e.message || String(e));

  I.collector = {
    async scan() {
      const prev = I.store.cache() || {};
      const res = { at: Date.now(), classroom: prev.classroom || null, calendar: prev.calendar || null, errors: {} };
      try { res.classroom = await collectClassroom(); } catch (e) { res.errors.classroom = explain(e); console.warn('Classroom', e); }
      try { res.calendar = await collectCalendar(); } catch (e) { res.errors.calendar = explain(e); console.warn('Calendar', e); }
      I.store.saveCache(res);
      return res;
    }
  };
})();