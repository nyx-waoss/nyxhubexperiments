(() => {
  const I = window.Intel;
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const ymd = d => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
  // Classroom manda la hora en UTC: 23:59 en Costa Rica = 05:59 UTC del día siguiente
  const utc = { hours: 5, minutes: 59 };

  I.mockCache = () => ({
    at: Date.now(), errors: {},
    classroom: {
      courses: [{ id: '1', name: 'Math 10' }, { id: '2', name: 'Academic English' }, { id: '3', name: 'Robótica Avanzada' }],
      work: [
        { id: 'a', courseId: '1', title: 'Quiz de funciones cuadráticas', description: 'Cubre capítulos 3 y 4', workType: 'ASSIGNMENT', maxPoints: 40, dueDate: ymd(day(2)), dueTime: utc, created: day(-5).toISOString(), updated: day(-5).toISOString() },
        { id: 'b', courseId: '2', title: 'Essay draft', description: '', workType: 'ASSIGNMENT', maxPoints: 20, dueDate: ymd(day(5)), dueTime: utc, created: day(-3).toISOString(), updated: day(-3).toISOString() },
        { id: 'c', courseId: '1', title: 'Práctica 12', description: '', workType: 'ASSIGNMENT', maxPoints: 5, dueDate: ymd(day(-40)), dueTime: utc, created: day(-50).toISOString(), updated: day(-50).toISOString() },
        { id: 'd', courseId: '3', title: 'Proyecto de sensores', description: 'Informe + demo', workType: 'ASSIGNMENT', maxPoints: 100, dueDate: ymd(day(9)), dueTime: utc, created: day(-2).toISOString(), updated: day(-2).toISOString() }
      ],
      subs: [{ courseId: '2', courseWorkId: 'b', state: 'NEW' }, { courseId: '1', courseWorkId: 'a', state: 'NEW' }, { courseId: '3', courseWorkId: 'd', state: 'CREATED' }],
      announcements: [
        { id: 'x', courseId: '1', text: 'Recuerden que mañana hay prueba corta de álgebra. Traigan calculadora.', created: new Date().toISOString(), updated: new Date().toISOString() },
        { id: 'y', courseId: '2', text: 'El viernes se suspende la clase por actividad del colegio.', created: day(-1).toISOString(), updated: day(-1).toISOString() }
      ],
      materials: []
    },
    calendar: { calendars: [], events: [
      { id: 'e1', cal: 'Colegio', title: 'Reunión de padres', desc: '', allDay: false, start: day(3).toISOString(), recurring: false, attendees: 0 },
      { id: 'e2', cal: 'Cumpleaños', title: 'Cumpleaños de Ana', desc: '', allDay: true, start: day(2).toISOString().slice(0, 10), recurring: true },
      { id: 'e3', cal: 'Personal', title: 'Clase de guitarra', desc: '', allDay: false, start: day(1).toISOString(), recurring: true }
    ] }
  });
})();