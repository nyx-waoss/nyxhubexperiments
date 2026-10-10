(() => {
  const I = window.Intel = window.Intel || {};
  I.config = {
    CLIENT_ID: '900038530821-8hr79gkg9jj7fvmbs6386obf3bljcsc8.apps.googleusercontent.com',
    SCOPES: [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
      'https://www.googleapis.com/auth/classroom.announcements.readonly',
      'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
      'https://www.googleapis.com/auth/classroom.profile.emails',
      'https://www.googleapis.com/auth/calendar.readonly'
    ].join(' '),

    SCAN_EVERY_MIN: 15,
    CALENDAR_DAYS_AHEAD: 45,
    ANNOUNCE_DAYS: 21,
    MIN_SCORE: 35,
    MAX_SUGGESTIONS: 8,

    SUBJECT_KEYWORDS: [
      ['Academic English',       /academic|writing|reading/],
      ['Conversational English', /conversational|speaking|conversation/],
      ['Graphic Design',         /diseno gr|graphic/],
      ['DME',                    /\bdme\b/],
      ['P.E.',                   /educacion fisica|physical|\bp\.?e\.?\b/],
      ['Guia',                   /\bguia\b|orientacion/],
      ['Math',                   /mate|math|algebra|geometr|matematica/],
      ['Music',                  /music/],
      ['Religion',               /religi/],
      ['Science',                /scien|ciencia|biolog|fisica|quimica/],
      ['Social Studies',         /social|historia|geograf|sociales/],
      ['Civic',                  /civica|urbanidad/],
      ['Español',                /espanol|lengua|literatura/]
    ],
    PALETTE: ['#ff9ecb', '#9ee37d', '#7fd1ff', '#ffd27f', '#c4a2ff', '#ff9f80', '#7fffd4']
  };
})();