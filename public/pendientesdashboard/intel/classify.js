(() => {
  const I = window.Intel, T = I.text;

  const TYPE_RULES = [
    ['Examen',            /\b(examen|prueba|quiz|parcial|evaluacion|test|exam|prueba corta|control de lectura)\b/],
    ['Documento Firmado', /\b(firmad[oa]|firma|autorizacion|desprendible|circular|boleta|permiso)\b/],
    ['Proyecto',          /\b(proyecto|exposicion|maqueta|portafolio|feria|presentacion|investigacion|informe|extraclase)\b/],
    ['Tarea',             /\b(tarea|ejercicios?|practica|guia|taller|assignment|homework|trabajo cotidiano|lectura|resumen|cuestionario|worksheet)\b/],
    ['Recordatorio',      /\b(recordatorio|recuerden|traer|llevar|reunion|aviso|importante)\b/]
  ];
  const INTENTS = [
    ['cancel',   /\b(se suspende|suspendid[oa]|cancelad[oa]|no habra (clase|leccion)|sin clases)\b/],
    ['change',   /\b(cambio de fecha|se traslada|se reprograma|nueva fecha|se pospone|se adelanta)\b/],
    ['exam',     /\b(examen|prueba|quiz|parcial|evaluacion|exam)\b/],
    ['sign',     /\b(firmad[oa]|firma|autorizacion|desprendible|circular)\b/],
    ['bring',    /\b(traer|traigan|lleven|llevar|no olviden|materiales?|ocupan|necesitan)\b/],
    ['deadline', /\b(entrega|entregar|fecha limite|subir|plazo|enviar)\b/],
    ['meeting',  /\b(reunion|asamblea|charla|festival|actividad|acto civico|gira)\b/]
  ];
  const URGENT = /\b(urgente|importante|no falten|obligatori[oa]|ultimo aviso|ultima oportunidad|recuerden)\b/;
  const ACADEMIC = /\b(examen|prueba|quiz|tarea|proyecto|clase|leccion|colegio|escuela|reunion|exposicion|entrega|profe|materia|curso|classroom|gira|festival)\b/;

  const first = (rules, text, dflt) => { const t = T.norm(text); for (const [k, re] of rules) if (re.test(t)) return k; return dflt; };

  I.classify = {
    type: (text, dflt = 'Tarea') => first(TYPE_RULES, text, dflt),
    intent: text => first(INTENTS, text, 'info'),
    isUrgent: text => URGENT.test(T.norm(text)),
    looksAcademic: text => ACADEMIC.test(T.norm(text)),

    // devuelve el nombre de materia de TU app, o null si no se reconoce (→ "materia nueva")
    subject(course, intel) {
      if (!course) return null;
      const S = DashApp.SUBJECTS, ren = DashApp.getState().renames || {};
      const mapped = intel && intel.courseMap && intel.courseMap[course.id];
      if (mapped && S[mapped]) return mapped;                      // vínculo manual (tiene prioridad)
      const name = T.norm(course.name + ' ' + (course.section || ''));
      for (const [subj, re] of I.config.SUBJECT_KEYWORDS) {
        if (!re.test(name)) continue;
        const cur = ren[subj] || subj;                             // si la renombraste, usa el nombre actual
        return S[cur] ? cur : null;                                // si la eliminaste, vuelve a "sin reconocer"
      }
      return null;
    }
  };
})();