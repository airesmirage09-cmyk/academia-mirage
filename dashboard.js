(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]; }); }

  function pad2(n){ return n<10 ? '0'+n : ''+n; }
  function monthKey(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1); }

  // Duracion promedio (en minutos) declarada en el catalogo para un curso individual.
  function courseMinutes(course){
    var nums = String((course && course.time) || '').match(/\d+/g);
    if(!nums || !nums.length) return 0;
    var sum = 0; for(var j=0;j<nums.length;j++) sum += parseInt(nums[j],10);
    return sum/nums.length;
  }

  function greeting(){
    var h = new Date().getHours();
    if(h < 12) return 'Buenos dias';
    if(h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function bar(pct, cls){
    var p = Math.max(0, Math.min(100, Math.round(pct||0)));
    return '<div class="' + (cls||'sd-obj-bar') + '"><i style="width:' + p + '%"></i></div>';
  }

  // Mapa de competencias: cuanto aporta cada curso real de hoy a cada competencia.
  // Las competencias sin ningun curso asociado (Liderazgo, Comunicacion, Innovacion, Trabajo en Equipo)
  // se muestran honestamente en 0% -- reflejan que Mirage aun no tiene cursos de esa competencia, no un error.
  var COMP_MAP = {
    'induccion_sst': { 'Seguridad': 1 },
    '5s_seguridad': { 'Calidad': 1, 'Seguridad': 0.5 },
    'safestart': { 'Seguridad': 1.5 },
    'ciberseguridad': { 'Transformacion Digital': 1, 'Seguridad': 0.5 },
    'cultura_legalidad': { 'Etica': 1 }
  };
  var ALL_COMPS = ['Liderazgo','Comunicacion','Seguridad','Innovacion','Trabajo en Equipo','Calidad','Etica','Transformacion Digital'];

  var QUICKLINKS = [
    { label:'Continuar Curso', icon:'\u25b6\ufe0f', real:true, kind:'continue' },
    { label:'Ver Certificados', icon:'\ud83c\udf93', real:true, kind:'profile' },
    { label:'Mi Perfil', icon:'\ud83d\udc64', real:true, kind:'profile' },
    { label:'Biblioteca', icon:'\ud83d\udcda', real:true, kind:'catalog' },
    { label:'Learning Friday', icon:'\ud83d\udcc5', real:false },
    { label:'Mirage Conecta', icon:'\ud83d\udcac', real:false },
    { label:'Noticias', icon:'\ud83d\udcf0', real:false }
  ];
  function countInProgress(prog){
    var n = 0;
    for(var cid in prog){ var p = prog[cid]; if(p && p.status && p.status !== 'completed') n++; }
    return n;
  }

  // Compara finalizaciones reales de este mes calendario vs. el mes calendario anterior,
  // usando las fechas reales guardadas en el progreso -- nada de cifras inventadas.
  function monthDelta(prog){
    var now = new Date();
    var thisKey = monthKey(now);
    var lastD = new Date(now.getFullYear(), now.getMonth()-1, 1);
    var lastKey = monthKey(lastD);
    var thisCount=0, lastCount=0, thisHours=0, lastHours=0;
    for(var cid in prog){
      var p = prog[cid];
      if(!p || p.status !== 'completed' || !p.date) continue;
      var key = String(p.date).slice(0,7);
      var course = (typeof COURSES !== 'undefined') ? COURSES.find(function(c){ return c.id===cid; }) : null;
      var hrs = course ? (courseMinutes(course)/60) : 0;
      if(key === thisKey){ thisCount++; thisHours += hrs; }
      else if(key === lastKey){ lastCount++; lastHours += hrs; }
    }
    return { thisCount:thisCount, lastCount:lastCount, thisHours:Math.round(thisHours*10)/10, lastHours:Math.round(lastHours*10)/10 };
  }

  function deltaInfo(curr, prev){
    if(prev === 0 && curr === 0) return { kind:'flat', text:'Sin cambios este mes' };
    if(prev === 0) return { kind:'up', text:'+' + curr + ' este mes' };
    var pct = Math.round(((curr - prev) / prev) * 100);
    if(pct > 0) return { kind:'up', text:'+' + pct + '% vs mes anterior' };
    if(pct < 0) return { kind:'down', text: pct + '% vs mes anterior' };
    return { kind:'flat', text:'Igual que el mes anterior' };
  }

  // Horas reales agrupadas por ventana de tiempo, a partir de las fechas de finalizacion.
  function computeTimeBuckets(prog){
    var now = new Date();
    var week=0, month=0, year=0;
    var dayBuckets = [0,0,0,0,0,0,0];
    for(var cid in prog){
      var p = prog[cid];
      if(!p || p.status !== 'completed' || !p.date) continue;
      var d = new Date(p.date + 'T00:00:00');
      if(isNaN(d.getTime())) continue;
      var diffDays = Math.floor((now - d) / 86400000);
      var course = (typeof COURSES !== 'undefined') ? COURSES.find(function(c){ return c.id===cid; }) : null;
      var hrs = course ? (courseMinutes(course)/60) : 0;
      if(diffDays >= 0 && diffDays < 7) dayBuckets[6-diffDays] += hrs;
      if(diffDays < 7) week += hrs;
      if(diffDays < 30) month += hrs;
      if(diffDays < 365) year += hrs;
    }
    return { week: Math.round(week*10)/10, month: Math.round(month*10)/10, year: Math.round(year*10)/10, dayBuckets: dayBuckets };
  }

  function computePerformance(ctx){
    var total = (typeof COURSES !== 'undefined') ? COURSES.length : 0;
    var obligatorios = (typeof COURSES !== 'undefined') ? COURSES.filter(function(c){ return !!c.req; }).length : 0;
    var opcionales = total - obligatorios;
    var pendientes = total - (ctx.doneCount||0);
    var tiempoProm = (ctx.doneCount>0) ? Math.round((ctx.hours/ctx.doneCount)*10)/10 : 0;
    return { asignados: total, obligatorios: obligatorios, opcionales: opcionales, pendientes: pendientes, tiempoProm: tiempoProm };
  }
  // Recomienda el curso real mas valioso: el que te acerca a terminar la ruta que ya tienes mas avanzada.
  function computeRecommendation(ctx, paths){
    var incomplete = (typeof COURSES !== 'undefined') ? COURSES.filter(function(c){ var p = ctx.prog[c.id]; return !p || p.status !== 'completed'; }) : [];
    if(!incomplete.length) return { allDone:true };
    var candidates = [];
    (paths||[]).forEach(function(p){
      if(p.pct >= 100) return;
      for(var i=0;i<p.steps.length;i++){
        var s = p.steps[i];
        var isPending = String(s.id).indexOf('_pending_') === 0;
        var alreadyDone = p.done.indexOf(s.id) !== -1;
        if(!isPending && !alreadyDone){
          var course = (typeof COURSES !== 'undefined') ? COURSES.find(function(c){ return c.id===s.id; }) : null;
          if(course){ candidates.push({ course:course, pathName:p.name, pathPct:p.pct, pathIcon:p.icon }); }
          break;
        }
      }
    });
    candidates.sort(function(a,b){ return b.pathPct - a.pathPct; });
    if(candidates.length) return candidates[0];
    return { course: incomplete[0], pathName:null, pathPct:null, pathIcon:null };
  }

  function computeCompetencies(ctx){
    var raw = {}; var max = {};
    ALL_COMPS.forEach(function(c){ raw[c]=0; max[c]=0; });
    if(typeof COURSES !== 'undefined'){
      COURSES.forEach(function(course){
        var weights = COMP_MAP[course.id]; if(!weights) return;
        var isDone = ctx.prog[course.id] && ctx.prog[course.id].status === 'completed';
        Object.keys(weights).forEach(function(comp){
          max[comp] += weights[comp];
          if(isDone) raw[comp] += weights[comp];
        });
      });
    }
    return ALL_COMPS.map(function(c){
      var pct = max[c] > 0 ? Math.round((raw[c]/max[c])*100) : 0;
      return { name:c, pct:pct, hasCourses: max[c] > 0 };
    });
  }

  function computeEvolution(ctx, paths){
    var completions = [];
    for(var cid in ctx.prog){ var p = ctx.prog[cid]; if(p && p.status==='completed' && p.date){ completions.push({cid:cid, date:p.date}); } }
    completions.sort(function(a,b){ return a.date.localeCompare(b.date); });
    var milestones = [];
    if(completions.length){
      milestones.push({ icon:'\ud83c\udf93', label:'Primer curso completado', date:completions[0].date });
      milestones.push({ icon:'\ud83d\udcdc', label:'Primera certificacion', date:completions[0].date });
    }
    (paths||[]).forEach(function(pth){
      if(!pth.complete) return;
      var maxDate = null;
      pth.steps.forEach(function(s){ var pr = ctx.prog[s.id]; if(pr && pr.date && (!maxDate || pr.date > maxDate)) maxDate = pr.date; });
      milestones.push({ icon: pth.icon, label:'Ruta completada: ' + pth.name, date: maxDate });
    });
    milestones.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    milestones.push({ icon: ctx.level.icon, label:'Nivel actual: ' + ctx.level.name, date:null });
    return milestones;
  }

  function computeObjectives(ctx, delta){
    var xpEstimado = delta.thisCount * 600;
    return [
      { label:'Completar 3 cursos este mes', current: delta.thisCount, target: 3 },
      { label:'Obtener 1 certificado este mes', current: Math.min(delta.thisCount,1), target: 1 },
      { label:'Sumar 500 XP este mes (estimado)', current: xpEstimado, target: 500 },
      { label:'Avanzar en una ruta profesional este mes', current: Math.min(delta.thisCount,1), target: 1 }
    ];
  }

  function buildEvents(ctx, badges){
    var items = [];
    for(var cid in ctx.prog){
      var p = ctx.prog[cid];
      if(p && p.status === 'completed'){
        var c = (typeof COURSES !== 'undefined') ? COURSES.find(function(x){ return x.id===cid; }) : null;
        items.push({ date: p.date||'', icon:'\ud83c\udf93', text:'Completaste ' + (c?c.full:cid) + ' (+' + (p.xp||0) + ' XP)' });
      }
    }
    (badges||[]).filter(function(b){ return b.unlocked; }).forEach(function(b){
      items.push({ date:'', icon:'\ud83c\udfc5', text:'Insignia obtenida: ' + b.name });
    });
    items.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    return items;
  }
  function buildRadarSVG(comps){
    var n = comps.length, size=220, cx=size/2, cy=size/2, R=80;
    var pts = [], gridPts100=[], gridPts50=[];
    for(var i=0;i<n;i++){
      var ang = (Math.PI*2*i/n) - Math.PI/2;
      var r = R * (comps[i].pct/100);
      pts.push((cx + r*Math.cos(ang)).toFixed(1) + ',' + (cy + r*Math.sin(ang)).toFixed(1));
      gridPts100.push((cx + R*Math.cos(ang)).toFixed(1) + ',' + (cy + R*Math.sin(ang)).toFixed(1));
      gridPts50.push((cx + R*0.5*Math.cos(ang)).toFixed(1) + ',' + (cy + R*0.5*Math.sin(ang)).toFixed(1));
    }
    var axisLines = '';
    for(var j=0;j<n;j++){
      var ang2 = (Math.PI*2*j/n) - Math.PI/2;
      var x2 = cx + R*Math.cos(ang2), y2 = cy + R*Math.sin(ang2);
      axisLines += '<line x1="'+cx+'" y1="'+cy+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#eef0f2" stroke-width="1"/>';
    }
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">' +
      axisLines +
      '<polygon points="'+gridPts100.join(' ')+'" fill="none" stroke="#eef0f2" stroke-width="1"/>' +
      '<polygon points="'+gridPts50.join(' ')+'" fill="none" stroke="#eef0f2" stroke-width="1"/>' +
      '<polygon points="'+pts.join(' ')+'" fill="rgba(234,0,41,0.18)" stroke="#EA0029" stroke-width="2"/>' +
    '</svg>';
  }

  function renderHeader(ctx, streak){
    var el = document.getElementById('sd-header'); if(!el) return;
    var name = (ctx.user && ctx.user.name) ? ctx.user.name.split(' ')[0] : 'Colaborador';
    var photo = ctx.user && ctx.user.photo;
    var av = photo ? '<img src="'+photo+'">' : '<div class="sd-av-fallback">'+esc(name.charAt(0))+'</div>';
    el.innerHTML =
      '<div class="sd-header-l"><h1>' + greeting() + ', <span>' + esc(name) + '</span> \ud83d\udc4b</h1>' +
      '<p>Bienvenido nuevamente. Hoy tienes una gran oportunidad para seguir desarrollando tu talento.</p></div>' +
      '<div class="sd-header-r">' + av +
      '<div class="sd-header-stat"><b>' + esc(ctx.level.name) + '</b><span>Nivel</span></div>' +
      '<div class="sd-header-stat"><b>' + (ctx.xp||0).toLocaleString('es-MX') + '</b><span>XP</span></div>' +
      '<div class="sd-header-stat"><b>\ud83d\udd25 ' + (streak||0) + '</b><span>Racha</span></div>' +
      '</div>';
  }

  function kpiCard(icon, num, label, delta){
    var deltaHtml = delta ? ('<span class="sd-kpi-delta ' + delta.kind + '">' + (delta.kind==='up'?'\u2191':(delta.kind==='down'?'\u2193':'\u2192')) + ' ' + esc(delta.text) + '</span>') : '';
    return '<div class="sd-card sd-kpi">' +
      '<div class="sd-kpi-ico">' + icon + '</div>' +
      '<div class="sd-kpi-num">' + num + '</div>' +
      '<div class="sd-kpi-label">' + label + '</div>' +
      deltaHtml +
    '</div>';
  }

  function renderKPIs(ctx, prog){
    var el = document.getElementById('sd-kpis'); if(!el) return;
    var delta = monthDelta(prog);
    var inProgress = countInProgress(prog);
    var completedDelta = deltaInfo(delta.thisCount, delta.lastCount);
    var hoursDelta = deltaInfo(delta.thisHours, delta.lastHours);
    el.innerHTML =
      kpiCard('\ud83d\udcd6', inProgress, 'Cursos en progreso', null) +
      kpiCard('\u2705', ctx.doneCount, 'Cursos completados', completedDelta) +
      kpiCard('\u23f1\ufe0f', ctx.hours, 'Horas de capacitacion', hoursDelta) +
      kpiCard('\ud83c\udf93', ctx.doneCount, 'Certificados obtenidos', completedDelta);
  }

  function renderProgress(ctx, achievementsUnlocked){
    var el = document.getElementById('sd-progress'); if(!el) return;
    var pct = ctx.total>0 ? Math.round((ctx.doneCount/ctx.total)*100) : 0;
    var R = 60, C = 2*Math.PI*R;
    var offset = C - (C*pct/100);
    var donut = '<svg width="150" height="150" viewBox="0 0 150 150">' +
      '<circle cx="75" cy="75" r="'+R+'" fill="none" stroke="#eef0f2" stroke-width="14"/>' +
      '<circle cx="75" cy="75" r="'+R+'" fill="none" stroke="#EA0029" stroke-width="14" stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+offset.toFixed(1)+'"/>' +
    '</svg>';
    el.innerHTML =
      '<div class="sd-donut">' + donut + '<div class="sd-donut-label"><b>' + pct + '%</b><span>Progreso</span></div></div>' +
      '<div class="sd-progress-stats">' +
        '<div class="sd-pstat"><b>' + ctx.doneCount + ' de ' + ctx.total + '</b><span>Cursos completados</span></div>' +
        '<div class="sd-pstat"><b>' + ctx.hours + '</b><span>Horas acumuladas</span></div>' +
        '<div class="sd-pstat"><b>' + (achievementsUnlocked||0) + '</b><span>Objetivos alcanzados</span></div>' +
        '<div class="sd-pstat"><b>' + ctx.doneCount + '</b><span>Certificaciones</span></div>' +
      '</div>';
  }
  function renderContinue(ctx){
    var el = document.getElementById('sd-continue'); if(!el) return;
    var inProg = [];
    if(typeof COURSES !== 'undefined'){
      COURSES.forEach(function(c){
        var p = ctx.prog[c.id];
        if(p && p.status && p.status !== 'completed'){ inProg.push({ course:c, pct:p.pct||0 }); }
      });
    }
    if(!inProg.length){
      el.innerHTML = '<p class="sd-empty">\u2728 Vas al dia: no tienes cursos pendientes por continuar en este momento.</p>';
      return;
    }
    el.innerHTML = inProg.map(function(item){
      var c = item.course;
      var restante = Math.max(0, Math.round(courseMinutes(c) * (1 - item.pct/100)));
      return '<div class="sd-cont-card">' +
        '<div class="sd-cont-img" style="background-image:url(\'' + (c.bg||'') + '\')"></div>' +
        '<div class="sd-cont-body">' +
          '<h4>' + esc(c.full||c.name) + '</h4>' +
          '<div class="sd-cont-meta"><span>' + item.pct + '%</span><span>~' + restante + ' min restantes</span></div>' +
          bar(item.pct,'sd-cont-bar') +
          '<button class="sd-cont-btn" onclick="openCourse(\'' + c.id + '\')">Continuar</button>' +
        '</div></div>';
    }).join('');
  }

  function renderPaths(paths){
    var el = document.getElementById('sd-paths'); if(!el) return;
    el.innerHTML = (paths||[]).map(function(p){
      return '<div class="sd-path-row">' +
        '<div class="sd-path-ico">' + p.icon + '</div>' +
        '<div><div class="sd-path-name"><span>' + esc(p.name) + '</span></div>' + bar(p.pct,'sd-path-bar') + '</div>' +
        '<div class="sd-path-pct">' + p.pct + '%</div>' +
      '</div>';
    }).join('');
  }

  function renderBadgesRow(badges){
    var el = document.getElementById('sd-badges'); if(!el) return;
    var unlocked = badges.filter(function(b){ return b.unlocked; }).slice(-3);
    var next = badges.filter(function(b){ return !b.unlocked; }).slice(0,3);
    var list = unlocked.concat(next);
    el.innerHTML = list.map(function(b){
      return '<div class="sd-badge-chip' + (b.unlocked?'':' locked') + '">' +
        '<div class="sd-badge-ico">' + b.icon + '</div><span>' + esc(b.name) + '</span></div>';
    }).join('') || '<p class="sd-empty">Aun no hay insignias.</p>';
  }

  function renderCalendar(){
    var el = document.getElementById('sd-calendar'); if(!el) return;
    el.innerHTML = '<div class="sd-cal-empty"><span class="ico">\ud83d\uddd3\ufe0f</span>' +
      '<span>No tienes eventos programados por el momento. Cuando se agenden Learning Fridays o evaluaciones, apareceran aqui.</span></div>';
  }

  function renderTimeline(events){
    var el = document.getElementById('sd-timeline'); if(!el) return;
    var top = events.slice(0,6);
    el.innerHTML = top.map(function(ev){
      return '<div class="sd-tl-item"><div class="sd-tl-dot"></div>' +
        '<div class="sd-tl-text">' + ev.icon + ' ' + esc(ev.text) + '</div>' +
        (ev.date ? '<div class="sd-tl-date">' + esc(ev.date) + '</div>' : '') +
      '</div>';
    }).join('') || '<p class="sd-empty">Aun no hay actividad reciente.</p>';
  }
  function renderCertificates(ctx){
    var el = document.getElementById('sd-certificates'); if(!el) return;
    var done = [];
    if(typeof COURSES !== 'undefined'){
      COURSES.forEach(function(c){ var p = ctx.prog[c.id]; if(p && p.status==='completed'){ done.push({course:c, date:p.date}); } });
    }
    done.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    var top = done.slice(0,4);
    if(!top.length){
      el.innerHTML = '<p class="sd-empty">Aun no tienes certificados. Completa un curso para obtener el primero.</p>';
      return;
    }
    el.innerHTML = top.map(function(item){
      return '<div class="sd-cert-row">' +
        '<div><div class="sd-cert-name">' + esc(item.course.full||item.course.name) + '</div>' +
        '<div class="sd-cert-date">' + esc(item.date||'') + '</div></div>' +
        '<div class="sd-cert-actions"><button onclick="showConstancia(\'' + item.course.id + '\')">Ver / Descargar</button></div>' +
      '</div>';
    }).join('') + '<div class="sd-cert-foot"><a onclick="goView(\'profile\')">Ver todos mis certificados \u2192</a></div>';
  }

  function renderRecommendation(reco){
    var el = document.getElementById('sd-reco'); if(!el) return;
    if(reco.allDone){
      el.innerHTML = '<div class="sd-reco-ico">\ud83c\udf89</div>' +
        '<div><b>Completaste todo el catalogo disponible</b>' +
        '<span>En cuanto se agreguen nuevos cursos a tu ruta, apareceran aqui como recomendacion.</span></div>';
      return;
    }
    var c = reco.course;
    var msg = reco.pathName
      ? ('Completa ' + (c.full||c.name) + ' para avanzar tu Ruta de ' + reco.pathName + ' (' + reco.pathPct + '% actual).')
      : ('Completa ' + (c.full||c.name) + ' para seguir avanzando en tu desarrollo.');
    el.innerHTML = '<div class="sd-reco-ico">\ud83e\udd16</div>' +
      '<div><b>Te recomendamos: ' + esc(c.full||c.name) + '</b><span>' + esc(msg) + '</span></div>' +
      '<button onclick="openCourse(\'' + c.id + '\')">Ir al curso</button>';
  }

  function renderObjectives(objs){
    var el = document.getElementById('sd-objectives'); if(!el) return;
    el.innerHTML = objs.map(function(o){
      var done = o.current >= o.target;
      var pct = o.target>0 ? Math.min(100, Math.round((o.current/o.target)*100)) : 0;
      return '<div class="sd-obj-row">' +
        '<div class="sd-obj-check' + (done?' done':'') + '">' + (done?'\u2713':'') + '</div>' +
        '<div class="sd-obj-body"><div class="sd-obj-label"><span>' + esc(o.label) + '</span><span>' + o.current + '/' + o.target + '</span></div>' +
        bar(pct) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderPerformance(perf){
    var el = document.getElementById('sd-performance'); if(!el) return;
    el.innerHTML =
      '<div class="sd-perf-item"><b>' + perf.asignados + '</b><span>Cursos asignados</span></div>' +
      '<div class="sd-perf-item"><b>' + perf.obligatorios + '</b><span>Obligatorios</span></div>' +
      '<div class="sd-perf-item"><b>' + perf.opcionales + '</b><span>Opcionales</span></div>' +
      '<div class="sd-perf-item"><b>' + perf.pendientes + '</b><span>Pendientes</span></div>' +
      '<div class="sd-perf-item"><b>' + perf.tiempoProm + 'h</b><span>Tiempo prom. por curso</span></div>';
  }
  function renderRanking(state){
    var el = document.getElementById('sd-ranking'); if(!el) return;
    if(!state.myRank){ el.innerHTML = '<p class="sd-empty">Aun no hay suficientes datos para calcular tu posicion.</p>'; return; }
    var me = state.ranking[state.myRank-1];
    el.innerHTML =
      '<div><div class="sd-rank-pos">#' + state.myRank + '</div><div class="sd-rank-of">de ' + state.totalRanked + ' colaboradores</div></div>' +
      '<div class="sd-rank-mini">' +
        '<div><b>' + me.xp.toLocaleString('es-MX') + '</b><span>XP</span></div>' +
        '<div><b>' + me.hours + '</b><span>Horas</span></div>' +
        '<div><b>' + me.courses + '</b><span>Cursos</span></div>' +
      '</div>';
  }

  function renderTime(buckets){
    var el = document.getElementById('sd-time'); if(!el) return;
    var maxDay = Math.max.apply(null, buckets.dayBuckets.concat([0.1]));
    var barsHtml = buckets.dayBuckets.map(function(h){
      var hpx = Math.round((h/maxDay)*60) || 2;
      return '<i style="height:' + hpx + 'px" title="' + (Math.round(h*10)/10) + 'h"></i>';
    }).join('');
    el.innerHTML =
      '<div class="sd-time-item"><b>' + buckets.week + 'h</b><span>Esta semana</span></div>' +
      '<div class="sd-time-item"><b>' + buckets.month + 'h</b><span>Este mes</span></div>' +
      '<div class="sd-time-item"><b>' + buckets.year + 'h</b><span>Este ano</span></div>' +
      '<div style="grid-column:1/-1;"><div class="sd-time-bars">' + barsHtml + '</div></div>';
  }

  function renderNotifications(events){
    var el = document.getElementById('sd-notifications'); if(!el) return;
    var top = events.slice(0,6);
    el.innerHTML = top.map(function(ev){
      return '<div class="sd-notif-row"><span class="sd-notif-ico">' + ev.icon + '</span><span>' + esc(ev.text) + '</span></div>';
    }).join('') || '<p class="sd-empty">Sin notificaciones todavia.</p>';
  }

  function renderQuickLinks(nextCourseId){
    var el = document.getElementById('sd-quicklinks'); if(!el) return;
    el.innerHTML = QUICKLINKS.map(function(q){
      if(!q.real){
        return '<div class="sd-quick-btn disabled"><span class="ico">' + q.icon + '</span>' + esc(q.label) + '<span class="sd-quick-tag">Proximamente</span></div>';
      }
      var onclick = '';
      if(q.kind==='continue'){ onclick = nextCourseId ? ("openCourse('" + nextCourseId + "')") : "goView('catalog')"; }
      else if(q.kind==='profile'){ onclick = "goView('profile')"; }
      else if(q.kind==='catalog'){ onclick = "goView('catalog')"; }
      return '<div class="sd-quick-btn" onclick="' + onclick + '"><span class="ico">' + q.icon + '</span>' + esc(q.label) + '</div>';
    }).join('');
  }
  function renderDevObjective(paths){
    var el = document.getElementById('sd-dev-objective'); if(!el) return;
    var sorted = (paths||[]).slice().sort(function(a,b){ return b.pct - a.pct; });
    var firstIncompleteIdx = -1;
    for(var k=0;k<sorted.length;k++){ if(sorted[k].pct < 100){ firstIncompleteIdx = k; break; } }
    el.innerHTML = sorted.map(function(p, i){
      return '<div class="sd-dev-obj-chip' + (i===firstIncompleteIdx ? ' current':'') + '">' +
        '<span style="font-size:1.3rem;">' + p.icon + '</span>' +
        '<div><b>' + esc(p.name) + '</b><span>' + p.pct + '% completado</span></div>' +
      '</div>';
    }).join('');
  }

  function renderRadar(comps){
    var wrap = document.getElementById('sd-dev-radar'); if(wrap) wrap.innerHTML = buildRadarSVG(comps);
    var legend = document.getElementById('sd-dev-radar-legend'); if(!legend) return;
    legend.innerHTML = comps.map(function(c){
      return '<div><b>' + c.pct + '%</b> ' + esc(c.name) + (c.hasCourses ? '' : ' <span style="opacity:.6">(sin cursos aun)</span>') + '</div>';
    }).join('');
  }

  function renderNextStep(reco){
    var el = document.getElementById('sd-dev-nextstep'); if(!el) return;
    if(reco.allDone){
      el.innerHTML = '<div class="ico">\ud83c\udfc6</div><div><b>Catalogo actual completado</b><span>Estate atento a nuevos cursos para seguir creciendo.</span></div>';
      return;
    }
    var c = reco.course;
    var msg = reco.pathName
      ? ('Completa ' + (c.full||c.name) + ' para avanzar al ' + (reco.pathPct) + '%+ de tu Ruta de ' + reco.pathName + '.')
      : ('Completa ' + (c.full||c.name) + ' para seguir avanzando.');
    el.innerHTML = '<div class="ico">' + (reco.pathIcon||'\ud83d\ude80') + '</div><div><b>' + esc(c.full||c.name) + '</b><span>' + esc(msg) + '</span></div>';
  }

  function renderEvolution(milestones){
    var el = document.getElementById('sd-dev-evolution'); if(!el) return;
    el.innerHTML = milestones.map(function(m){
      return '<div class="sd-evo-item"><div class="sd-evo-dot">' + m.icon + '</div>' +
        '<b>' + esc(m.label) + '</b><span>' + esc(m.date||'Actual') + '</span></div>';
    }).join('') || '<p class="sd-empty">Aun no hay hitos registrados.</p>';
  }

  async function onRender(){
    if(typeof CU === 'undefined' || !CU || typeof COURSES === 'undefined') return;
    if(!window.MirageGamification || typeof window.MirageGamification.getState !== 'function') return;
    try{
      var state = await window.MirageGamification.getState();
      if(!state) return;
      var ctx = state.ctx;
      var prog = ctx.prog;
      var achievementsUnlocked = state.achievements.filter(function(a){ return a.unlocked; }).length;
      var streak = null;
      try{ var seenKey = 'am4_gam_streak_' + CU.id; var s = JSON.parse(localStorage.getItem(seenKey)); streak = s ? (s.count||s.streak||null) : null; }catch(e){}

      renderHeader(ctx, streak);
      renderKPIs(ctx, prog);
      renderProgress(ctx, achievementsUnlocked);
      renderContinue(ctx);
      renderPaths(state.paths);
      renderBadgesRow(state.badges);
      renderCalendar();
      var events = buildEvents(ctx, state.badges);
      renderTimeline(events);
      renderCertificates(ctx);
      var reco = computeRecommendation(ctx, state.paths);
      renderRecommendation(reco);
      var delta = monthDelta(prog);
      renderObjectives(computeObjectives(ctx, delta));
      renderPerformance(computePerformance(ctx));
      renderRanking(state);
      renderTime(computeTimeBuckets(prog));
      renderNotifications(events);
      renderQuickLinks(reco.allDone ? null : (reco.course && reco.course.id));

      renderDevObjective(state.paths);
      renderRadar(computeCompetencies(ctx));
      renderNextStep(reco);
      renderEvolution(computeEvolution(ctx, state.paths));
    }catch(e){ /* nunca romper el resto de la plataforma por un error aqui */ }
  }

  window.MirageSmartDash = { onRender: onRender };
})();
