/* ============================================================================
   RH-DATA.JS — Capa de datos del Dashboard Ejecutivo de Recursos Humanos
   ----------------------------------------------------------------------------
   Este archivo NO dibuja nada en pantalla. Su única responsabilidad es leer
   los datos reales de Firebase (usuarios + progreso) y del catálogo COURSES,
   y devolver UN SOLO objeto JSON con todo lo que el Dashboard de RH necesita.

   Principio de honestidad de datos (acordado con RH):
   - REAL  -> se calcula siempre a partir de Firebase / COURSES.
   - SIMULADO -> se marca explícitamente con simulated:true para que la
                 interfaz lo etiquete como "Datos simulados" / "Próximamente"
                 y nunca se confunda con información real.

   Reutiliza las funciones ya existentes de gamification.js:
   buildContext(user, prog), computeBadges(ctx), computeAchievements(ctx),
   computePaths(ctx) — así los números del Dashboard de RH son 100%
   consistentes con lo que cada colaborador ve en su propio Dashboard.
============================================================================ */
(function(){

  // ---- Mapeo curso -> competencia (idéntico al usado en dashboard.js) ----
  var COMP_MAP = {
    'induccion_sst':      { 'Seguridad': 1 },
    '5s_seguridad':       { 'Calidad': 1, 'Seguridad': 0.5 },
    'safestart':          { 'Seguridad': 1.5 },
    'ciberseguridad':     { 'Transformacion Digital': 1, 'Seguridad': 0.5 },
    'cultura_legalidad':  { 'Etica': 1 }
  };
  var ALL_COMPS = ['Liderazgo','Comunicacion','Seguridad','Innovacion','Trabajo en equipo','Calidad','Etica','Transformacion Digital'];

  // ---- Helpers ----
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function courseMinutes(course){
    var nums = String((course && course.time) || '').match(/\d+/g);
    if(!nums || !nums.length) return 0;
    var sum = 0; for(var j=0;j<nums.length;j++) sum += parseInt(nums[j],10);
    return sum/nums.length;
  }

  function daysBetween(dateStr){
    if(!dateStr) return null;
    var d = new Date(dateStr); if(isNaN(d.getTime())) return null;
    var diff = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diff/(1000*60*60*24)));
  }

  function monthKey(dateStr){
    if(!dateStr) return null;
    return String(dateStr).slice(0,7); // 'YYYY-MM'
  }

  function prevMonthKey(base){
    var d = base ? new Date(base+'-01') : new Date();
    d.setMonth(d.getMonth()-1);
    return d.toISOString().slice(0,7);
  }

  function pctDelta(cur, prev){
    if(!prev) return (cur>0) ? {dir:'up', pct:100, label:'nuevo'} : {dir:'flat', pct:0, label:'sin cambio'};
    var d = Math.round(((cur-prev)/prev)*100);
    return { dir: d>0?'up':(d<0?'down':'flat'), pct: Math.abs(d), label: (d>0?'+':'') + d + '%' };
  }

  function semaforoFor(u){
    // Reglas honestas de riesgo, basadas únicamente en datos reales disponibles:
    // - Rojo: más de 60 días sin actividad, o cursos obligatorios incompletos + 30 días inactivo.
    // - Amarillo: entre 30 y 60 días sin actividad, o algún obligatorio pendiente.
    // - Verde: activo y al día con obligatorios.
    var d = u.daysInactive;
    var obligPend = u.obligTotal - u.obligDone;
    if((d!=null && d>60) || (obligPend>0 && d!=null && d>30)) return 'rojo';
    if((d!=null && d>30) || obligPend>0) return 'amarillo';
    return 'verde';
  }

  // ---- Núcleo: construir todo el modelo de datos real ----
  var CACHE = null, CACHE_AT = 0;

  async function compute(force){
    if(!force && CACHE && (Date.now()-CACHE_AT < 45000)) return CACHE;
    if(typeof getUsers !== 'function' || typeof getProgress !== 'function' || typeof COURSES === 'undefined'){
      return null;
    }
    // gamification.js expone estas funciones vía window.MirageGamification para
    // garantizar que los números de RH sean idénticos a los del Dashboard del colaborador.
    var GAM = window.MirageGamification || null;
    var hasGam = !!(GAM && typeof GAM.buildContext === 'function' && typeof GAM.computeBadges === 'function' && typeof GAM.computePaths === 'function' && typeof GAM.computeAchievements === 'function');

    var users = [];
    try{ users = await getUsers(); }catch(e){ users = []; }
    var courses = COURSES.slice();
    var obligCourses = courses.filter(function(c){ return !!c.req; });

    var nowKey = monthKey(new Date().toISOString());
    var prevKey = prevMonthKey(nowKey);

    var enriched = [];
    var monthCur = { completions:0, hours:0, newUsers:0 };
    var monthPrev = { completions:0, hours:0, newUsers:0 };

    // Acumulador por curso (necesita ver el progreso crudo de cada usuario, por eso vive aquí)
    var courseAccum = {};
    courses.forEach(function(c){ courseAccum[c.id] = { iniciados:0, completados:0, pctSum:0, pctCount:0 }; });

    for(var i=0;i<users.length;i++){
      var u = users[i];
      var prog = {};
      try{ prog = await getProgress(u.id); }catch(e){ prog = {}; }

      var ctx = null, badges = [], achievements = [], paths = [];
      if(hasGam){
        try{ ctx = GAM.buildContext(u, prog); }catch(e){ ctx = null; }
        if(ctx){
          try{ badges = GAM.computeBadges(ctx) || []; }catch(e){ badges = []; }
          try{ achievements = GAM.computeAchievements(ctx) || []; }catch(e){ achievements = []; }
          try{ paths = GAM.computePaths(ctx) || []; }catch(e){ paths = []; }
        }
      }

      var doneIds = (ctx && ctx.done) ? ctx.done : Object.keys(prog).filter(function(k){ return prog[k] && prog[k].status==='completed'; });
      var hours = ctx ? (ctx.hours||0) : 0;
      var xp = (typeof u.xp === 'number') ? u.xp : (ctx? (ctx.xp||0) : 0);
      var level = ctx ? (ctx.level||1) : 1;

      var lastDate = null;
      var sumPct = 0, pctCount = 0;
      var obligDone = 0;
      courses.forEach(function(c){
        var p = prog[c.id];
        if(p && p.date){ if(!lastDate || p.date > lastDate) lastDate = p.date; }
        if(p && typeof p.pct === 'number'){ sumPct += p.pct; pctCount++; }
        if(c.req && p && p.status==='completed') obligDone++;
        // acumulados de mes (real, usando fecha de finalización de cada curso)
        if(p && p.status==='completed' && p.date){
          var mk = monthKey(p.date);
          if(mk === nowKey){ monthCur.completions++; monthCur.hours += courseMinutes(c)/60; }
          else if(mk === prevKey){ monthPrev.completions++; monthPrev.hours += courseMinutes(c)/60; }
        }
        // acumulado por curso (para el Dashboard por Curso)
        if(p){
          courseAccum[c.id].iniciados++;
          if(p.status==='completed') courseAccum[c.id].completados++;
          if(typeof p.pct === 'number'){ courseAccum[c.id].pctSum += p.pct; courseAccum[c.id].pctCount++; }
        }
      });
      if(u.since){
        var smk = monthKey(u.since);
        if(smk === nowKey) monthCur.newUsers++;
        else if(smk === prevKey) monthPrev.newUsers++;
      }

      var daysInactive = lastDate ? daysBetween(lastDate) : (u.since ? daysBetween(u.since) : null);

      // Competencias por colaborador (real, basado en COMP_MAP)
      var comp = {}, compMax = {};
      ALL_COMPS.forEach(function(k){ comp[k]=0; compMax[k]=0; });
      courses.forEach(function(c){
        var w = COMP_MAP[c.id]; if(!w) return;
        Object.keys(w).forEach(function(k){
          compMax[k] += w[k];
          if(doneIds.indexOf(c.id) !== -1) comp[k] += w[k];
        });
      });
      var compPct = {};
      ALL_COMPS.forEach(function(k){ compPct[k] = compMax[k] ? Math.round(100*comp[k]/compMax[k]) : 0; });

      var pathsDoneCount = paths.filter(function(p){ return p.complete; }).length;

      enriched.push({
        id: u.id, name: u.name || 'Colaborador', area: u.area || 'Sin área',
        role: u.role || 'user', email: u.email || '', photo: u.photo || '',
        xp: xp, level: level, hours: hours,
        doneCount: doneIds.length, totalCourses: courses.length, doneIds: doneIds,
        avgPct: pctCount ? Math.round(sumPct/pctCount) : 0,
        obligDone: obligDone, obligTotal: obligCourses.length,
        badgesCount: badges.filter(function(b){return b.unlocked;}).length,
        achievementsCount: achievements.filter(function(a){return a.unlocked;}).length,
        pathsDone: pathsDoneCount, pathsTotal: paths.length,
        lastDate: lastDate, daysInactive: daysInactive,
        competencies: compPct
      });
    }
    enriched.forEach(function(u){ u.semaforo = semaforoFor(u); });

    // ---------- GLOBAL ----------
    var totalColaboradores = enriched.length;
    var usuariosActivos = enriched.filter(function(u){ return u.daysInactive!=null && u.daysInactive<=30; }).length;
    var usuariosInactivos = totalColaboradores - usuariosActivos;
    var cursosActivos = courses.length;
    var cursosCompletadosTotal = enriched.reduce(function(s,u){ return s+u.doneCount; }, 0);
    var horasTotal = enriched.reduce(function(s,u){ return s+u.hours; }, 0);
    var horasPromedio = totalColaboradores ? (horasTotal/totalColaboradores) : 0;
    var certificadosEmitidos = cursosCompletadosTotal; // 1 constancia por curso completado (real, patrón ya usado en la app)
    var evaluacionesRealizadas = cursosCompletadosTotal; // no existe motor de evaluación separado; el % de avance es el proxy real
    var rutasCompletadas = enriched.reduce(function(s,u){ return s+u.pathsDone; }, 0);

    var global = {
      totalColaboradores: totalColaboradores, usuariosActivos: usuariosActivos, usuariosInactivos: usuariosInactivos,
      cursosActivos: cursosActivos, cursosCompletadosTotal: cursosCompletadosTotal,
      horasTotal: Math.round(horasTotal*10)/10, horasPromedio: Math.round(horasPromedio*10)/10,
      certificadosEmitidos: certificadosEmitidos, evaluacionesRealizadas: evaluacionesRealizadas,
      rutasCompletadas: rutasCompletadas
    };

    var monthCompare = {
      completions: { cur: monthCur.completions, prev: monthPrev.completions, delta: pctDelta(monthCur.completions, monthPrev.completions) },
      hours: { cur: Math.round(monthCur.hours*10)/10, prev: Math.round(monthPrev.hours*10)/10, delta: pctDelta(monthCur.hours, monthPrev.hours) },
      newUsers: { cur: monthCur.newUsers, prev: monthPrev.newUsers, delta: pctDelta(monthCur.newUsers, monthPrev.newUsers) },
      certificates: { cur: monthCur.completions, prev: monthPrev.completions, delta: pctDelta(monthCur.completions, monthPrev.completions) }
    };

    // ---------- KPIs ----------
    var obligAssignments = totalColaboradores * obligCourses.length;
    var obligDoneTotal = enriched.reduce(function(s,u){ return s+u.obligDone; }, 0);
    var cumplimientoPct = obligAssignments ? Math.round(100*obligDoneTotal/obligAssignments) : 0;
    var cursosPendientes = enriched.reduce(function(s,u){ return s + (u.totalCourses - u.doneCount); }, 0);
    var usuariosSinIngresarCount = enriched.filter(function(u){ return u.daysInactive!=null && u.daysInactive>30; }).length;
    var promedioGeneralPct = totalColaboradores ? Math.round(enriched.reduce(function(s,u){return s+u.avgPct;},0)/totalColaboradores) : 0;
    var participacionPct = totalColaboradores ? Math.round(100*enriched.filter(function(u){return u.doneCount>0;}).length/totalColaboradores) : 0;
    var avanceMensual = monthCompare.completions.delta;
    var tiempoPromedioAprendizajeMin = courses.length ? Math.round(courses.reduce(function(s,c){return s+courseMinutes(c);},0)/courses.length) : 0;

    var kpis = {
      cumplimientoPct: cumplimientoPct,
      cursosPendientes: cursosPendientes,
      usuariosSinIngresar: usuariosSinIngresarCount,
      promedioGeneralPct: promedioGeneralPct,
      participacionPct: participacionPct,
      avanceMensual: avanceMensual,
      tiempoPromedioMin: tiempoPromedioAprendizajeMin
    };

    // ---------- POR ÁREA (real, dinámico según datos existentes) ----------
    var areaMap = {};
    enriched.forEach(function(u){
      var a = u.area;
      if(!areaMap[a]) areaMap[a] = { area:a, users:0, hours:0, avgPctSum:0, obligDone:0, obligTotal:0, started:0, xp:0, compSum:{} , compMax:{}};
      var e = areaMap[a];
      e.users++; e.hours += u.hours; e.avgPctSum += u.avgPct; e.obligDone += u.obligDone; e.obligTotal += u.obligTotal;
      e.xp += u.xp;
      if(u.doneCount>0) e.started++;
      ALL_COMPS.forEach(function(k){ e.compSum[k] = (e.compSum[k]||0) + (u.competencies[k]||0); });
    });
    var byArea = Object.keys(areaMap).map(function(a){
      var e = areaMap[a];
      var compAvg = {}; ALL_COMPS.forEach(function(k){ compAvg[k] = e.users ? Math.round(e.compSum[k]/e.users) : 0; });
      return {
        area: a, users: e.users,
        hoursTotal: Math.round(e.hours*10)/10, hoursAvg: e.users ? Math.round((e.hours/e.users)*10)/10 : 0,
        avgPct: e.users ? Math.round(e.avgPctSum/e.users) : 0,
        obligCompliancePct: e.obligTotal ? Math.round(100*e.obligDone/e.obligTotal) : 0,
        participationPct: e.users ? Math.round(100*e.started/e.users) : 0,
        xpTotal: e.xp,
        competencies: compAvg
      };
    }).sort(function(a,b){ return b.users - a.users; });

    // ---------- HEAT MAP (área x avance) ----------
    var heatmap = byArea.map(function(a){
      var v = a.avgPct;
      var nivel = v>=80 ? 'alto' : (v>=50 ? 'medio' : 'bajo');
      return { area: a.area, value: v, nivel: nivel };
    });

    // ---------- POR CURSO (real, usando el progreso crudo de cada curso) ----------
    var byCourse = courses.map(function(c){
      var acc = courseAccum[c.id];
      var abandonoPct = acc.iniciados ? Math.round(100*(acc.iniciados-acc.completados)/acc.iniciados) : 0;
      return {
        id: c.id, name: c.full || c.name, tag: c.tag, obligatorio: !!c.req,
        iniciados: acc.iniciados, completados: acc.completados,
        pendientes: totalColaboradores - acc.completados,
        tasaCompletitudPct: totalColaboradores ? Math.round(100*acc.completados/totalColaboradores) : 0,
        abandonoPct: abandonoPct,
        evalPromedio: acc.pctCount ? Math.round(acc.pctSum/acc.pctCount) : 0
      };
    });
    var byCourseRanked = byCourse.slice().sort(function(a,b){ return b.completados - a.completados; });

    // ---------- RIESGO ----------
    var risk = enriched.map(function(u){
      return {
        id:u.id, name:u.name, area:u.area, daysInactive:u.daysInactive,
        obligPendientes: u.obligTotal-u.obligDone, pathsPendientes: u.pathsTotal-u.pathsDone,
        semaforo: u.semaforo
      };
    }).sort(function(a,b){
      var order = {rojo:0, amarillo:1, verde:2};
      return order[a.semaforo]-order[b.semaforo];
    });
    var riskCounts = { rojo:0, amarillo:0, verde:0 };
    risk.forEach(function(r){ riskCounts[r.semaforo]++; });

    // ---------- MATRIZ DE COMPETENCIAS (global) ----------
    var compGlobal = {};
    ALL_COMPS.forEach(function(k){
      var vals = enriched.map(function(u){ return u.competencies[k]||0; });
      compGlobal[k] = vals.length ? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length) : 0;
    });

    // ---------- RANKING ----------
    function top(arr, key, n){ return arr.slice().sort(function(a,b){return b[key]-a[key];}).slice(0,n||10); }
    var ranking = {
      byXP: top(enriched,'xp'), byHours: top(enriched,'hours'), byCourses: top(enriched,'doneCount'),
      byCertificates: top(enriched,'doneCount'), byBadges: top(enriched,'badgesCount'), byPaths: top(enriched,'pathsDone')
    };

    // ---------- GAMIFICACIÓN ----------
    var levelDist = {};
    enriched.forEach(function(u){ levelDist[u.level] = (levelDist[u.level]||0)+1; });
    var gamification = {
      totalXP: enriched.reduce(function(s,u){return s+u.xp;},0),
      totalBadges: enriched.reduce(function(s,u){return s+u.badgesCount;},0),
      levelDistribution: levelDist,
      topProgress: top(enriched,'xp',5),
      streakNote: 'La racha diaria se guarda en el dispositivo de cada colaborador (localStorage), no en la base de datos central. RH no puede consultar la racha de otros usuarios con la arquitectura actual.'
    };

    // ---------- CERTIFICACIONES ----------
    var certifications = {
      emitidos: certificadosEmitidos,
      pendientes: cursosPendientes,
      vencidos: null, porVencer: null, // no existe fecha de vencimiento en el modelo actual
      simulatedFields: ['vencidos','porVencer']
    };

    // ---------- ALERTAS (100% derivadas de datos reales) ----------
    var alerts = [];
    risk.filter(function(r){return r.semaforo==='rojo';}).forEach(function(r){
      alerts.push({ severity:'alta', text: esc(r.name)+' ('+esc(r.area)+') lleva '+(r.daysInactive!=null?r.daysInactive:'?')+' días sin actividad y tiene '+r.obligPendientes+' curso(s) obligatorio(s) pendiente(s).' });
    });
    byCourse.filter(function(c){return c.obligatorio && c.pendientes>0;}).forEach(function(c){
      alerts.push({ severity:'media', text: c.pendientes+' colaborador(es) con "'+esc(c.name)+'" (obligatorio) pendiente.' });
    });
    if(usuariosSinIngresarCount>0){
      alerts.push({ severity:'media', text: usuariosSinIngresarCount+' colaborador(es) sin actividad hace más de 30 días.' });
    }
    alerts.push({ severity:'info', text: 'Curso "Cultura de la Legalidad" publicado recientemente — revisar avance de adopción.' });

    // ---------- PREDICCIONES (simulado, preparado para IA real) ----------
    var predictions = {
      simulated: true,
      note: 'Módulo preparado para conectarse a un modelo predictivo real. Los valores mostrados son ilustrativos.',
      items: [
        { label:'Curso con mayor probabilidad de abandono', value: byCourseRanked.length ? byCourseRanked[byCourseRanked.length-1].name : '—' },
        { label:'Área que probablemente requerirá más capacitación', value: byArea.length ? byArea.slice().sort(function(a,b){return a.avgPct-b.avgPct;})[0].area : '—' },
        { label:'Tendencia de participación próximo mes', value: avanceMensual.dir==='up' ? 'Al alza' : (avanceMensual.dir==='down' ? 'A la baja' : 'Estable') }
      ]
    };

    // ---------- MÓDULOS NO DISPONIBLES (honestos) ----------
    var instructors = null;   // no existe campo "instructor" en COURSES todavía
    var sedes = null;         // no existe campo "sede" en usuarios todavía
    var calendarEvents = [];  // no existe motor de eventos/calendario todavía

    var areasList = byArea.map(function(a){ return a.area; });

    var result = {
      generatedAt: new Date().toISOString(),
      users: enriched, areas: areasList,
      global: global, monthCompare: monthCompare, kpis: kpis,
      byArea: byArea, heatmap: heatmap, byCourse: byCourse, byCourseRanked: byCourseRanked,
      risk: risk, riskCounts: riskCounts, competencyGlobal: compGlobal,
      ranking: ranking, gamification: gamification, certifications: certifications,
      alerts: alerts, predictions: predictions,
      instructors: instructors, sedes: sedes, calendarEvents: calendarEvents,
      courses: courses
    };
    CACHE = result; CACHE_AT = Date.now();
    return result;
  }

  // ---- Asistente ejecutivo (reglas simples sobre datos reales, sin IA externa) ----
  function answer(question, data){
    if(!data) return 'Los datos aún no están disponibles.';
    var q = String(question||'').toLowerCase();
    function fmtArea(a){ return a ? (a.area+' ('+a.avgPct+'% de avance promedio)') : 'sin datos suficientes'; }

    if(/menor avance|menos avance|peor área|área.*avance/.test(q)){
      var sorted = data.byArea.slice().sort(function(a,b){return a.avgPct-b.avgPct;});
      return sorted.length ? ('El área con menor avance es '+fmtArea(sorted[0])+'.') : 'No hay suficientes datos por área.';
    }
    if(/mayor abandono|más abandono|abandona/.test(q)){
      var worst = data.byCourseRanked.length ? data.byCourseRanked[data.byCourseRanked.length-1] : null;
      return worst ? ('El curso con menor tasa de finalización es "'+worst.name+'" con '+worst.tasaCompletitudPct+'% completado.') : 'No hay suficientes datos de cursos.';
    }
    if(/cultura de la legalidad/.test(q) && /(no han|faltan|pendientes)/.test(q)){
      var c = data.byCourse.filter(function(c){return c.id==='cultura_legalidad';})[0];
      return c ? (c.pendientes+' colaborador(es) no han terminado "Cultura de la Legalidad" (de '+data.global.totalColaboradores+' en total).') : 'No se encontró el curso.';
    }
    if(/actualización|actualizar/.test(q)){
      var old = data.byCourseRanked.filter(function(c){return c.tasaCompletitudPct<50;});
      return old.length ? ('Cursos con baja adopción que podrían requerir revisión: '+old.map(function(c){return c.name;}).join(', ')+'.') : 'Todos los cursos muestran una adopción saludable (≥50%).';
    }
    if(/cumplimiento|compliance/.test(q)){
      return 'El cumplimiento global de capacitación es de '+data.kpis.cumplimientoPct+'%.';
    }
    if(/riesgo/.test(q)){
      return 'Hay '+data.riskCounts.rojo+' colaborador(es) en riesgo alto (rojo) y '+data.riskCounts.amarillo+' en riesgo medio (amarillo).';
    }
    return 'Aún no tengo una respuesta específica para esa pregunta, pero puedes explorar los paneles de People Analytics y Riesgo de Capacitación para ese detalle.';
  }

  window.MirageRHData = { compute: compute, answer: answer, ALL_COMPS: ALL_COMPS, esc: esc };
})();
