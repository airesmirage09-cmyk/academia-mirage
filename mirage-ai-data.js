/* ============================================================
   Mirage AI - capa de datos e inteligencia (mirage-ai-data.js)
   ============================================================
   Motor de reglas modular sobre datos REALES de Academia Mirage
   (COURSES, CARD_EXTRA, usuarios/progreso Firebase, gamificacion,
   Centro de Conocimiento). Preparado para conectar un LLM real
   (OpenAI / Azure OpenAI / Anthropic) despues: toda la logica de
   negocio vive aqui, separada de la interfaz (mirage-ai.js).

   No modifica Login, Home, Dashboard del colaborador, RH Ejecutivo
   ni Centro de Conocimiento. Solo LEE datos y funciones ya
   expuestas globalmente por el resto de la plataforma:
     CU, CCV, COURSES, getProgress, fbGet, fbPatch, IS_FB,
     window.CARD_EXTRA, window.MirageGamification,
     window.MirageKnowledge
   ============================================================ */
(function(){
  'use strict';

  // ---------------------------------------------------------
  // Utilidades base
  // ---------------------------------------------------------
  function esc(s){
    return (s===undefined || s===null ? '' : String(s))
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function norm(s){
    try{
      return (s===undefined || s===null ? '' : String(s))
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g,'')
        .trim();
    }catch(e){ return (s||'').toString().toLowerCase(); }
  }
  function toArray(x){
    if(!x) return [];
    if(Array.isArray(x)) return x;
    return Object.keys(x).map(function(k){
      var v = x[k];
      if(v && typeof v === 'object' && v.id === undefined) v.id = k;
      return v;
    });
  }
  function safe(fn, fallback){
    try{ return fn(); }catch(e){ return fallback; }
  }

  // ---------------------------------------------------------
  // Base de ayuda / politicas (contenido estatico honesto)
  // ---------------------------------------------------------
  var HELP_DB = [
    { id:'certificado', answer:'Puedes descargar tu constancia desde <b>Mi Perfil → Mis constancias</b> una vez que completas un curso con la calificación aprobatoria. Si acabas de terminar un curso y aún no la ves, entra de nuevo al curso y revisa la pantalla final de evaluación.',
      resources:[{type:'view', view:'dashboard', label:'Ir a mi Dashboard'}] },
    { id:'politica_5c', answer:'Los valores 5C y las políticas de ética, anticorrupción, conflicto de interés y confidencialidad se cubren a detalle en el curso <b>Cultura de la Legalidad</b>: cómo identificar conflictos de interés, actuar con transparencia y proteger la información confidencial y los recursos de la empresa.',
      resources:[{type:'course', id:'cultura_legalidad', label:'Ver curso Cultura de la Legalidad'}] },
    { id:'reglamento', answer:'Todavía no tengo el Reglamento Interno ni el Manual del Colaborador cargados como documento digital en la plataforma. Por ahora puedes consultarlos directamente con Recursos Humanos; en cuanto RH los publique en la Biblioteca Digital, podré ayudarte a buscarlos aquí mismo.',
      resources:[{type:'view', view:'knowledge', label:'Revisar Biblioteca Digital'}] },
    { id:'ranking', answer:'Tu progreso de gamificación (insignias, rutas de aprendizaje, nivel y XP) está disponible en Mi Perfil → Gamificación.',
      resources:[{type:'view', view:'gamification', label:'Ver Gamificación'}] }
  ];

  var SUGGESTED_CHIPS = [
    '¿Qué cursos tengo pendientes?',
    '¿Dónde descargo mi certificado?',
    'Resúmeme el curso Cultura de la Legalidad',
    'Genera flashcards de SAFESTART',
    '¿Cuándo es el próximo Learning Friday?',
    'Busca manuales en la Biblioteca Digital',
    '¿Qué son los valores 5C de Mirage?',
    '¿Cómo voy con mi progreso?'
  ];

  // ---------------------------------------------------------
  // Contexto de ecosistema (curso actual, vista actual, gamificacion)
  // ---------------------------------------------------------
  function currentViewId(){
    return safe(function(){
      var v = document.querySelector('.view.on');
      return (v && v.id) ? v.id.replace(/^v-/,'') : null;
    }, null);
  }
  function currentCourse(){
    return safe(function(){
      if(typeof CCV === 'undefined' || !CCV) return null;
      if(typeof COURSES === 'undefined') return null;
      return COURSES.find(function(c){ return c.id === CCV; }) || null;
    }, null);
  }
  function courseExtra(courseId){
    return safe(function(){ return (window.CARD_EXTRA && window.CARD_EXTRA[courseId]) || {}; }, {});
  }
  function detectCourseMention(text){
    return safe(function(){
      if(typeof COURSES === 'undefined') return null;
      var n = norm(text);
      if(!n) return null;
      return COURSES.find(function(c){
        var byName = n.indexOf(norm(c.name)) > -1;
        var byFull = c.full ? n.indexOf(norm(c.full)) > -1 : false;
        var byId = n.indexOf(norm(c.id.replace(/_/g,' '))) > -1;
        var byTag = c.tag ? n.indexOf(norm(c.tag)) > -1 : false;
        return byName || byFull || byId || byTag;
      }) || null;
    }, null);
  }

  async function relatedResourcesForCourse(course){
    var out = { docs:[], sessions:[], courses:[] };
    if(!course) return out;
    var extra = courseExtra(course.id);
    var kw = [course.tag, course.name].concat(extra.skills || []).map(norm).filter(Boolean);

    try{
      if(window.MirageKnowledge && window.MirageKnowledge.getLibraryDocs){
        var docs = toArray(await window.MirageKnowledge.getLibraryDocs());
        out.docs = docs.filter(function(d){
          var hay = norm((d.title||'') + ' ' + (d.area||'') + ' ' + (Array.isArray(d.tags)? d.tags.join(' '):''));
          return kw.some(function(k){ return k && hay.indexOf(k) > -1; });
        }).slice(0,4);
      }
    }catch(e){}

    try{
      if(window.MirageKnowledge && window.MirageKnowledge.getLFSessions){
        var sess = toArray(await window.MirageKnowledge.getLFSessions());
        out.sessions = sess.filter(function(s){
          var hay = norm((s.title||'') + ' ' + (s.description||''));
          return kw.some(function(k){ return k && hay.indexOf(k) > -1; });
        }).slice(0,3);
      }
    }catch(e){}

    out.courses = safe(function(){
      return (typeof COURSES !== 'undefined') ? COURSES.filter(function(c){
        return c.id !== course.id && c.tag === course.tag;
      }).slice(0,3) : [];
    }, []);

    return out;
  }

  async function buildEcosystemContext(){
    var user = safe(function(){ return (typeof CU !== 'undefined') ? CU : null; }, null);
    var prog = {};
    if(user){ prog = await (async function(){ try{ return (await getProgress(user.id)) || {}; }catch(e){ return {}; } })(); }
    var gctx = null;
    if(user){
      gctx = safe(function(){
        return (window.MirageGamification && window.MirageGamification.buildContext) ? window.MirageGamification.buildContext(user, prog) : null;
      }, null);
    }
    var course = currentCourse();
    var view = currentViewId();
    var related = course ? await relatedResourcesForCourse(course) : null;
    return { user:user, prog:prog, gctx:gctx, course:course, view:view, related:related };
  }

  // ---------------------------------------------------------
  // Clasificacion de intencion (motor de reglas, sin LLM)
  // ---------------------------------------------------------
  var INTENTS = [
    { id:'saludo', test:function(n){ return /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal|ola)\b/.test(n); } },
    { id:'ayuda', test:function(n){ return /(ayuda|que puedes hacer|que sabes hacer|menu|opciones|en que me ayudas|como funcionas)/.test(n); } },
    { id:'certificado', test:function(n){ return /(certificado|constancia)/.test(n); } },
    { id:'flashcards', test:function(n){ return /(flashcard|tarjeta de estudio|tarjetas de repaso|tarjetas de memoria)/.test(n); } },
    { id:'cuestionario', test:function(n){ return /(cuestionario|quiz|preguntas de practica|examen de practica|practicar preguntas)/.test(n); } },
    { id:'resumen_curso', test:function(n){ return /(resum)/.test(n); } },
    { id:'explicar_curso', test:function(n){ return /(que es el curso|de que trata|explicame|objetivos del curso|en que consiste)/.test(n); } },
    { id:'progreso', test:function(n){ return /(mi progreso|como voy|mi avance|cuanto llevo|mi nivel|mis xp)/.test(n); } },
    { id:'notificaciones', test:function(n){ return /(pendiente|que me falta|recordatorio|notificacion|tengo pendiente)/.test(n); } },
    { id:'recomendar_curso', test:function(n){ return /(recomiend|que curso|cual curso|deberia tomar|siguiente curso)/.test(n); } },
    { id:'biblioteca', test:function(n){ return /(biblioteca|manual|documento|procedimiento|politica interna)/.test(n); } },
    { id:'learningfriday', test:function(n){ return /(learning friday|conferencia|ponente|proxima sesion)/.test(n); } },
    { id:'politica', test:function(n){ return /(5c|valores mirage|anticorrupcion|conflicto de interes|confidencialidad|etica)/.test(n); } },
    { id:'ranking', test:function(n){ return /(ranking|insignia|badge|gamificacion|ruta de aprendizaje)/.test(n); } },
    { id:'reglamento', test:function(n){ return /(reglamento|manual del colaborador)/.test(n); } }
  ];
  function classify(text){
    var n = norm(text);
    for(var i=0;i<INTENTS.length;i++){ if(INTENTS[i].test(n)) return INTENTS[i].id; }
    return 'fuera_de_alcance';
  }

  // ---------------------------------------------------------
  // Generadores de estudio (a partir de estructura real de COURSES)
  // ---------------------------------------------------------
  function generateFlashcards(course){
    if(!course) return [];
    var extra = courseExtra(course.id);
    var cards = [];
    (extra.objectives || []).forEach(function(o, i){
      cards.push({ q:'Objetivo '+(i+1)+' de "'+course.name+'": ¿qué debes lograr?', a:o });
    });
    (extra.skills || []).forEach(function(s){
      cards.push({ q:'¿Qué competencia desarrolla el curso "'+course.name+'"?', a:s });
    });
    cards.push({ q:'¿Cuánto dura aproximadamente el curso "'+course.name+'"?', a: course.time || 'No especificado' });
    cards.push({ q:'¿Es obligatorio el curso "'+course.name+'"?', a: course.req ? 'Sí, es un curso obligatorio.' : 'No, es un curso voluntario.' });
    return cards;
  }

  function generateQuiz(course){
    if(!course || typeof COURSES === 'undefined') return [];
    var extra = courseExtra(course.id);
    var objs = extra.objectives || [];
    if(!objs.length) return [];
    var poolOther = [];
    COURSES.forEach(function(c){
      if(c.id === course.id) return;
      var e = courseExtra(c.id);
      poolOther = poolOther.concat(e.objectives || []);
    });
    function pickDistractors(correct, n){
      var opts = poolOther.filter(function(o){ return o !== correct; });
      var picked = [];
      while(opts.length && picked.length < n){
        var idx = Math.floor(Math.random() * opts.length);
        picked.push(opts.splice(idx,1)[0]);
      }
      return picked;
    }
    return objs.map(function(o){
      var distractors = pickDistractors(o, Math.min(2, poolOther.length));
      var options = distractors.concat([o]);
      for(var j=options.length-1; j>0; j--){
        var k = Math.floor(Math.random()*(j+1));
        var tmp = options[j]; options[j] = options[k]; options[k] = tmp;
      }
      return { q:'¿Cuál de estas opciones es un objetivo real del curso "'+course.name+'"?', options: options, answer: o };
    });
  }

  function explainWrongAnswer(course, quizItem, chosen){
    if(!quizItem) return 'No tengo el detalle de esa pregunta para explicarla.';
    var base = 'La respuesta correcta es: "'+quizItem.answer+'".';
    if(chosen && chosen !== quizItem.answer){
      base += ' La opción "'+chosen+'" corresponde a otro curso u objetivo distinto.';
    }
    base += ' Este objetivo pertenece al curso "'+(course ? course.name : '')+'"; te recomiendo repasarlo dentro del curso para reforzarlo.';
    return base;
  }

  // ---------------------------------------------------------
  // Notificaciones inteligentes
  // ---------------------------------------------------------
  async function computeNotifications(){
    var out = [];
    var user = safe(function(){ return (typeof CU !== 'undefined') ? CU : null; }, null);
    if(!user || typeof COURSES === 'undefined') return out;
    var prog = {};
    try{ prog = (await getProgress(user.id)) || {}; }catch(e){}

    COURSES.forEach(function(c){
      if(!c.req) return;
      var p = prog[c.id];
      if(!p || p.status !== 'completed'){
        out.push({ id:'pend_'+c.id, type:'curso_pendiente', level:'alta',
          text:'Tienes el curso obligatorio "'+c.name+'" pendiente de completar.',
          action:{ type:'course', id:c.id } });
      }
    });

    try{
      if(window.MirageKnowledge && window.MirageKnowledge.getLFSessions){
        var sessions = toArray(await window.MirageKnowledge.getLFSessions());
        var now = Date.now(), soon = now + 1000*60*60*24*3;
        sessions.forEach(function(s){
          if(!s.dateISO) return;
          var t = new Date(s.dateISO).getTime();
          if(t >= now && t <= soon){
            out.push({ id:'lf_'+(s.id||s.title), type:'learning_friday', level:'media',
              text:'Learning Friday "'+(s.title||'')+'" es pronto.',
              action:{ type:'view', view:'knowledge' } });
          }
        });
      }
    }catch(e){}

    try{
      if(window.MirageGamification && window.MirageGamification.buildContext && window.MirageGamification.computePaths){
        var gctx = window.MirageGamification.buildContext(user, prog);
        var paths = window.MirageGamification.computePaths(gctx) || [];
        paths.forEach(function(p){
          if(!p.complete && p.pct >= 70){
            out.push({ id:'ruta_'+p.id, type:'ruta_cerca', level:'baja',
              text:'Estás a poco de completar la ruta "'+p.name+'" ('+p.pct+'%).',
              action:{ type:'view', view:'gamification' } });
          }
        });
      }
    }catch(e){}

    return out;
  }

  // ---------------------------------------------------------
  // Historial de conversacion (Firebase /aiChats/{userId}, con fallback local)
  // ---------------------------------------------------------
  async function getHistory(userId){
    if(!userId) return [];
    var data = null;
    try{ data = await fbGet('/aiChats/'+userId+'/messages'); }catch(e){}
    if(!data){
      data = safe(function(){ return JSON.parse(localStorage.getItem('am4_aiChat_'+userId) || 'null'); }, null);
    }
    var arr = toArray(data);
    arr.sort(function(a,b){ return (a.ts||0) - (b.ts||0); });
    return arr;
  }

  async function appendMessage(userId, msg){
    if(!userId) return msg;
    msg.ts = msg.ts || Date.now();
    var key = 'm' + msg.ts + '_' + Math.random().toString(36).slice(2,7);
    var ok = false;
    try{
      if(typeof IS_FB === 'function' && IS_FB()){
        var patch = {}; patch[key] = msg;
        await fbPatch('/aiChats/'+userId+'/messages', patch);
        ok = true;
      }
    }catch(e){}
    if(!ok){
      safe(function(){
        var hist = JSON.parse(localStorage.getItem('am4_aiChat_'+userId) || '[]');
        hist.push(msg);
        localStorage.setItem('am4_aiChat_'+userId, JSON.stringify(hist));
      }, null);
    }
    return msg;
  }

  // ---------------------------------------------------------
  // Generadores de respuesta por intencion
  // ---------------------------------------------------------
  function answerHelp(id){
    var h = HELP_DB.filter(function(x){ return x.id === id; })[0];
    if(!h) return answerFueraDeAlcance();
    return { text: h.answer, resources: h.resources || [] };
  }

  function answerFueraDeAlcance(){
    return {
      text:'Todavía no puedo resolver eso con la información que tengo disponible. Estoy en una versión inicial basada en reglas y datos reales de la plataforma; más adelante podré conectarme a un modelo de lenguaje para responder con más flexibilidad. Mientras tanto puedo ayudarte con tus cursos, la Biblioteca Digital, Learning Friday, tu progreso, certificados y estudio.',
      resources:[{ type:'view', view:'dashboard', label:'Ver mi Dashboard' }]
    };
  }

  function answerSaludo(ctx){
    var name = ctx.user ? String(ctx.user.name||'').split(' ')[0] : '';
    return {
      text:'¡Hola'+(name?' '+esc(name):'')+'! Soy Mirage AI 🤖, tu asistente de Academia Mirage. Puedo ayudarte con tus cursos, la Biblioteca Digital, Learning Friday, tu progreso y más. ¿En qué te ayudo?',
      resources:[]
    };
  }

  function answerAyuda(){
    return {
      text:'Puedo ayudarte a:<br>• Explicarte o resumir un curso<br>• Generar flashcards o un cuestionario de repaso<br>• Recomendarte tu próximo curso<br>• Buscar documentos en la Biblioteca Digital<br>• Avisarte de la próxima sesión de Learning Friday<br>• Recordarte lo que tienes pendiente<br>Pregúntame como le preguntarías a un compañero de RH.',
      resources:[]
    };
  }

  function answerProgreso(ctx){
    if(!ctx.user) return { text:'Inicia sesión para que pueda mostrarte tu progreso real.', resources:[] };
    var g = ctx.gctx;
    if(!g) return { text:'No pude calcular tu progreso en este momento. Intenta de nuevo en unos segundos.', resources:[] };
    var levelName = safe(function(){ return g.level.name; }, '-');
    var txt = 'Llevas <b>'+(g.doneCount||0)+'/'+(g.total||0)+'</b> cursos completados, '+(g.hours||0)+' horas de capacitación y estás en el nivel <b>'+esc(levelName)+'</b> ('+(g.xp||0)+' XP).';
    return { text: txt, resources:[{ type:'view', view:'dashboard', label:'Ver mi Dashboard' }, { type:'view', view:'gamification', label:'Ver Gamificación' }] };
  }

  async function answerNotificaciones(){
    var n = await computeNotifications();
    if(!n.length) return { text:'No tienes pendientes urgentes por ahora. ¡Vas al día! 🎉', resources:[] };
    var txt = 'Esto es lo que tienes pendiente:<br>' + n.map(function(x){ return '• '+esc(x.text); }).join('<br>');
    return { text: txt, resources:[], notifications:n };
  }

  async function answerRecomendarCurso(ctx){
    var user = ctx.user;
    if(!user || typeof COURSES === 'undefined') return { text:'Necesito que inicies sesión para poder recomendarte cursos personalizados.', resources:[] };
    var prog = ctx.prog || {};
    var pending = COURSES.filter(function(c){ var p = prog[c.id]; return !p || p.status !== 'completed'; });
    var mandatoryPending = pending.filter(function(c){ return c.req; });
    var list = mandatoryPending.length ? mandatoryPending : pending;
    if(!list.length){
      return { text:'¡Vas muy bien! Ya completaste todos los cursos disponibles en el catálogo actual. Te recomiendo revisar Learning Friday o la Biblioteca Digital para seguir aprendiendo.', resources:[{ type:'view', view:'knowledge', label:'Ver Centro de Conocimiento' }] };
    }
    var top = list.slice(0,3);
    var txt = (mandatoryPending.length ? '<b>Tienes cursos obligatorios pendientes:</b><br>' : '<b>Te recomiendo continuar con:</b><br>') +
      top.map(function(c){ return '• '+esc(c.name)+' ('+esc(c.time||'')+')'; }).join('<br>');
    return { text: txt, resources: top.map(function(c){ return { type:'course', id:c.id, label:'Abrir '+c.name }; }), suggestedCourses: top };
  }

  async function answerExplicarCurso(course){
    if(!course) return { text:'¿De qué curso quieres que te explique el contenido? Dime el nombre, por ejemplo "Cultura de la Legalidad" o "SAFESTART".', resources:[] };
    var extra = courseExtra(course.id);
    var obj = extra.objectives || [];
    var txt = '<b>'+esc(course.full||course.name)+'</b><br>'+esc(course.desc||'') +
      (obj.length ? '<br><br><b>Al terminarlo podrás:</b><ul>'+obj.map(function(o){ return '<li>'+esc(o)+'</li>'; }).join('')+'</ul>' : '') +
      '<br>Duración aprox.: '+esc(course.time||'-')+' · '+(course.mods||'-')+' módulos · Nivel '+esc(course.level||'-')+(course.req ? ' · Obligatorio' : ' · Voluntario');
    var rel = await relatedResourcesForCourse(course);
    return { text: txt, resources:[{ type:'course', id:course.id, label:'Abrir curso' }], related: rel, suggestedCourses: rel.courses };
  }

  async function answerResumenCurso(course){
    if(!course) return { text:'Dime el nombre del curso que quieres que te resuma.', resources:[] };
    var extra = courseExtra(course.id);
    var obj = extra.objectives || [], skills = extra.skills || [];
    var txt = '<b>Resumen de '+esc(course.full||course.name)+'</b> (lectura menor a 5 min)<br>'+esc(course.desc||'') +
      (obj.length ? '<br><br><b>Objetivos clave:</b> '+obj.map(esc).join(' · ') : '') +
      (skills.length ? '<br><b>Competencias que desarrolla:</b> '+skills.map(esc).join(' · ') : '') +
      '<br><br><i>Resumen generado automáticamente a partir de la descripción y objetivos oficiales del curso; no sustituye el contenido completo.</i>';
    return { text: txt, resources:[{ type:'course', id:course.id, label:'Abrir curso completo' }] };
  }

  function answerFlashcardsIntent(course){
    if(!course) return { text:'¿Para qué curso quieres flashcards de repaso? Dime el nombre.', resources:[] };
    var cards = generateFlashcards(course);
    if(!cards.length) return { text:'Aún no tengo suficiente contenido estructurado de "'+esc(course.name)+'" para generar flashcards.', resources:[] };
    return {
      text:'Generé '+cards.length+' flashcards de repaso para <b>'+esc(course.name)+'</b> (generadas automáticamente a partir del contenido oficial del curso, uso preliminar de estudio).',
      resources:[{ type:'flashcards', id:course.id, label:'Ver flashcards' }],
      flashcards: cards, courseId: course.id
    };
  }

  function answerCuestionarioIntent(course){
    if(!course) return { text:'¿De qué curso quieres un cuestionario de práctica?', resources:[] };
    var quiz = generateQuiz(course);
    if(!quiz.length){
      return { text:'Aún no tengo suficiente contenido estructurado de "'+esc(course.name)+'" para generar un cuestionario. Puedo darte flashcards de repaso en su lugar.', resources:[{ type:'flashcards', id:course.id, label:'Ver flashcards' }] };
    }
    return {
      text:'Generé un cuestionario preliminar de '+quiz.length+' preguntas para <b>'+esc(course.name)+'</b> (generado automáticamente, no es el examen oficial del curso).',
      resources:[{ type:'quiz', id:course.id, label:'Ver cuestionario' }],
      quiz: quiz, courseId: course.id
    };
  }

  async function answerBiblioteca(text){
    var q = text.replace(/.*(busca|buscar|encuentra|encontrar)\s*/i,'').trim();
    var results = [];
    try{
      if(window.MirageKnowledge && window.MirageKnowledge.searchDocs){
        results = toArray(await window.MirageKnowledge.searchDocs(q||''));
      } else if(window.MirageKnowledge && window.MirageKnowledge.getLibraryDocs){
        results = toArray(await window.MirageKnowledge.getLibraryDocs());
      }
    }catch(e){}
    results = results.slice(0,5);
    if(!results.length){
      return { text:'No encontré documentos en la Biblioteca Digital'+(q ? ' relacionados con "'+esc(q)+'"' : '')+' todavía. Puedes explorar todas las categorías directamente ahí.', resources:[{ type:'view', view:'knowledge', label:'Ir a Biblioteca Digital' }] };
    }
    var txt = 'Encontré esto en la Biblioteca Digital:<br>' + results.map(function(d){ return '• '+esc(d.title||'Documento'); }).join('<br>');
    return { text: txt, resources:[{ type:'view', view:'knowledge', label:'Ver en Biblioteca Digital' }], docs: results };
  }

  async function answerLearningFriday(){
    var sessions = [];
    try{
      if(window.MirageKnowledge && window.MirageKnowledge.getLFSessions){
        sessions = toArray(await window.MirageKnowledge.getLFSessions());
      }
    }catch(e){}
    var now = Date.now();
    var upcoming = sessions.filter(function(s){ return s.dateISO && new Date(s.dateISO).getTime() >= now; })
      .sort(function(a,b){ return new Date(a.dateISO) - new Date(b.dateISO); });
    if(!upcoming.length){
      return { text:'No hay una sesión de Learning Friday próxima registrada por ahora. En cuanto RH publique una nueva, aparecerá aquí y en el Centro de Conocimiento.', resources:[{ type:'view', view:'knowledge', label:'Ir a Learning Friday' }] };
    }
    var next = upcoming[0];
    var d = safe(function(){ return new Date(next.dateISO); }, null);
    var fecha = d ? d.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' }) : '';
    var txt = '<b>Próxima sesión de Learning Friday:</b><br>'+esc(next.title||'')+'<br>'+esc(fecha)+' · '+esc(next.modality||'');
    return { text: txt, resources:[{ type:'view', view:'knowledge', label:'Ver detalles e inscribirme' }], session: next };
  }

  // ---------------------------------------------------------
  // Orquestador principal
  // ---------------------------------------------------------
  async function ask(text){
    var ctx = await buildEcosystemContext();
    var intent = classify(text);
    var mentioned = detectCourseMention(text) || ctx.course;
    var res;
    switch(intent){
      case 'saludo': res = answerSaludo(ctx); break;
      case 'ayuda': res = answerAyuda(); break;
      case 'certificado': res = answerHelp('certificado'); break;
      case 'progreso': res = answerProgreso(ctx); break;
      case 'notificaciones': res = await answerNotificaciones(); break;
      case 'recomendar_curso': res = await answerRecomendarCurso(ctx); break;
      case 'explicar_curso': res = await answerExplicarCurso(mentioned); break;
      case 'resumen_curso': res = await answerResumenCurso(mentioned); break;
      case 'flashcards': res = answerFlashcardsIntent(mentioned); break;
      case 'cuestionario': res = answerCuestionarioIntent(mentioned); break;
      case 'biblioteca': res = await answerBiblioteca(text); break;
      case 'learningfriday': res = await answerLearningFriday(); break;
      case 'politica': res = answerHelp('politica_5c'); break;
      case 'reglamento': res = answerHelp('reglamento'); break;
      case 'ranking': res = answerHelp('ranking'); break;
      default: res = answerFueraDeAlcance();
    }
    res.intent = intent;
    return res;
  }

  // ---------------------------------------------------------
  // Export publico
  // ---------------------------------------------------------
  window.MirageAI = {
    ask: ask,
    buildEcosystemContext: buildEcosystemContext,
    relatedResourcesForCourse: relatedResourcesForCourse,
    computeNotifications: computeNotifications,
    generateFlashcards: generateFlashcards,
    generateQuiz: generateQuiz,
    explainWrongAnswer: explainWrongAnswer,
    getHistory: getHistory,
    appendMessage: appendMessage,
    detectCourseMention: detectCourseMention,
    classify: classify,
    HELP_DB: HELP_DB,
    SUGGESTED_CHIPS: SUGGESTED_CHIPS,
    esc: esc,
    toArray: toArray
  };

})();
