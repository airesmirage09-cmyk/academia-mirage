/* ============================================================================
   RH-DASHBOARD.JS — Render del Dashboard Ejecutivo de Recursos Humanos
   Consume window.MirageRHData (rh-data.js). No modifica Login, Home,
   Dashboard del colaborador, rutas ni ninguna otra vista existente.
============================================================================ */
(function(){

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function el(id){ return document.getElementById(id); }
  function set(id, html){ var e = el(id); if(e) e.innerHTML = html; }

  var STATE = { data:null, area:'todas', tab:'resumen' };

  var TABS = [
    { id:'resumen', label:'Resumen Ejecutivo', icon:'🏠' },
    { id:'kpis', label:'Indicadores Clave', icon:'📊' },
    { id:'analytics', label:'People Analytics', icon:'👥' },
    { id:'heatmap', label:'Mapa de Calor', icon:'🔥' },
    { id:'curso', label:'Por Curso', icon:'📚' },
    { id:'colaborador', label:'Por Colaborador', icon:'🔍' },
    { id:'aprendizaje', label:'Aprendizaje', icon:'⏱️' },
    { id:'certificaciones', label:'Certificaciones', icon:'🎓' },
    { id:'ranking', label:'Ranking Corporativo', icon:'🏆' },
    { id:'gamificacion', label:'Gamificacion', icon:'🎮' },
    { id:'calendario', label:'Calendario', icon:'📅' },
    { id:'alertas', label:'Alertas', icon:'🔔' },
    { id:'reportes', label:'Reportes', icon:'📄' },
    { id:'instructores', label:'Instructores', icon:'🎓' },
    { id:'talento', label:'Centro de Inteligencia de Talento', icon:'⭐' },
    { id:'direccion', label:'Direccion General', icon:'🎯' },
    { id:'asistente', label:'Asistente IA', icon:'🤖' }
  ];

  /* ---------------- Helpers de UI reutilizables ---------------- */

  function trendHtml(delta){
    if(!delta) return '';
    var arrow = delta.dir==='up' ? '▲' : (delta.dir==='down' ? '▼' : '▬');
    return '<span class="rh-kpi-trend '+delta.dir+'">'+arrow+' '+esc(delta.label)+' vs mes anterior</span>';
  }

  function kpiCard(icon, num, label, delta, realTag){
    return '' +
      '<div class="rh-kpi">' +
        '<div class="rh-kpi-top"><span class="rh-kpi-icon">'+icon+'</span>'+(realTag!==false?'<span class="rh-tag-real">Real</span>':'')+'</div>' +
        '<div class="rh-kpi-num">'+num+'</div>' +
        '<div class="rh-kpi-label">'+esc(label)+'</div>' +
        trendHtml(delta) +
      '</div>';
  }

  function barIndicator(label, valueLabel, pct, cls){
    var c = cls || (pct>=75?'good':(pct>=45?'warn':''));
    return '' +
      '<div class="rh-indicator">' +
        '<div class="rh-indicator-top"><span>'+esc(label)+'</span><span>'+esc(valueLabel)+'</span></div>' +
        '<div class="rh-bar-wrap"><div class="rh-bar-fill '+c+'" style="width:'+Math.max(0,Math.min(100,pct))+'%"></div></div>' +
      '</div>';
  }

  function heatRow(h){
    return '' +
      '<div class="rh-heat-row">' +
        '<div class="rh-heat-label">'+esc(h.area)+'</div>' +
        '<div class="rh-heat-bar"><div class="rh-heat-fill '+h.nivel+'" style="width:'+h.value+'%">'+h.value+'%</div></div>' +
        '<div class="rh-heat-val">'+h.value+'%</div>' +
      '</div>';
  }

  function riskRow(r){
    return '' +
      '<div class="rh-risk-row">' +
        '<span class="rh-dot '+r.semaforo+'"></span>' +
        '<span class="rh-risk-name">'+esc(r.name)+'<small>'+esc(r.area)+'</small></span>' +
        '<span>'+(r.daysInactive!=null?r.daysInactive+' dias inactivo':'—')+'</span>' +
        '<span>'+r.obligPendientes+' oblig. pend.</span>' +
        '<span>'+r.pathsPendientes+' rutas pend.</span>' +
      '</div>';
  }

  function rankRow(pos, u, key, fmt){
    var av = (u.photo && u.photo.length < 150000) ? '<img src="'+u.photo+'">' : esc((u.name||'?').charAt(0));
    var val = fmt ? fmt(u[key]) : u[key];
    return '' +
      '<div class="rh-rank-row">' +
        '<span class="rh-rank-pos">'+pos+'</span>' +
        '<span class="rh-rank-avatar">'+av+'</span>' +
        '<span class="rh-rank-name">'+esc(u.name)+'<small>'+esc(u.area)+'</small></span>' +
        '<span class="rh-rank-val">'+val+'</span>' +
      '</div>';
  }

  function emptyState(icon, title, desc){
    return '' +
      '<div class="rh-empty">' +
        '<div class="rh-empty-icon">'+icon+'</div>' +
        '<b>'+esc(title)+'</b><div>'+esc(desc)+'</div>' +
      '</div>';
  }

  // Radar SVG minimalista (sin librerias externas), igual criterio que el Dashboard del colaborador
  function buildRadarSVG(compObj, comps){
    var cx=140, cy=140, r=105, n=comps.length;
    function pt(i, val){
      var ang = (Math.PI*2*i/n) - Math.PI/2;
      var rad = r*(val/100);
      return [cx+rad*Math.cos(ang), cy+rad*Math.sin(ang)];
    }
    var rings = [0.25,0.5,0.75,1].map(function(f){
      var pts = [];
      for(var i=0;i<n;i++){ var p = pt(i, f*100); pts.push(p[0]+','+p[1]); }
      return '<polygon points="'+pts.join(' ')+'" fill="none" stroke="#eee" stroke-width="1"/>';
    }).join('');
    var axisLines = '';
    var labels = '';
    for(var i=0;i<n;i++){
      var p = pt(i,100);
      axisLines += '<line x1="'+cx+'" y1="'+cy+'" x2="'+p[0]+'" y2="'+p[1]+'" stroke="#eee" stroke-width="1"/>';
      var lp = pt(i,118);
      labels += '<text x="'+lp[0]+'" y="'+lp[1]+'" font-size="9" fill="#666" text-anchor="middle">'+esc(comps[i])+'</text>';
    }
    var dataPts = [];
    for(var i=0;i<n;i++){ var v = compObj[comps[i]]||0; var p = pt(i, v); dataPts.push(p[0]+','+p[1]); }
    var shape = '<polygon points="'+dataPts.join(' ')+'" fill="rgba(234,0,4,.18)" stroke="#ea0004" stroke-width="2"/>';
    return '<svg viewBox="0 0 280 280" width="280" height="280">'+rings+axisLines+shape+labels+'</svg>';
  }

  /* ---------------- Render por panel ---------------- */

  function renderResumen(d){
    var g = d.global, mc = d.monthCompare;
    var html = '<div class="rh-grid rh-grid-4">' +
      kpiCard('👥', g.totalColaboradores, 'Total de colaboradores', mc.newUsers.delta) +
      kpiCard('✅', d.users.filter(function(u){return u.daysInactive!=null && u.daysInactive<=30;}).length, 'Usuarios activos') +
      kpiCard('⚠️', g.usuariosInactivos, 'Usuarios inactivos') +
      kpiCard('📚', g.cursosActivos, 'Cursos activos') +
      kpiCard('✔️', g.cursosCompletadosTotal, 'Cursos completados', mc.completions.delta) +
      kpiCard('⏱️', g.horasTotal+'h', 'Horas impartidas', mc.hours.delta) +
      kpiCard('📈', g.horasPromedio+'h', 'Horas promedio / colaborador') +
      kpiCard('🎓', g.certificadosEmitidos, 'Certificados emitidos', mc.certificates.delta) +
      kpiCard('📝', g.evaluacionesRealizadas, 'Evaluaciones realizadas (avance)') +
      kpiCard('🧭', g.rutasCompletadas, 'Rutas completadas') +
    '</div>';
    set('rh-p-resumen', html);
  }

  function renderKpis(d){
    var k = d.kpis;
    var html = '<div class="rh-grid rh-grid-2">' +
      '<div class="rh-card"><h3>Indicadores de cumplimiento</h3>' +
        barIndicator('Porcentaje de cumplimiento (obligatorios)', k.cumplimientoPct+'%', k.cumplimientoPct) +
        barIndicator('Participacion (colaboradores que iniciaron al menos un curso)', k.participacionPct+'%', k.participacionPct) +
        barIndicator('Promedio general de avance', k.promedioGeneralPct+'%', k.promedioGeneralPct) +
      '</div>' +
      '<div class="rh-card"><h3>Volumen y tiempos</h3>' +
        '<div class="rh-mini-stat" style="text-align:left;background:transparent;padding:0;margin-bottom:14px;"><b style="font-size:15px;">'+k.cursosPendientes+'</b><span>Cursos pendientes (suma de todos los colaboradores)</span></div>' +
        '<div class="rh-mini-stat" style="text-align:left;background:transparent;padding:0;margin-bottom:14px;"><b style="font-size:15px;">'+k.usuariosSinIngresar+'</b><span>Usuarios sin ingresar (mas de 30 dias)</span></div>' +
        '<div class="rh-mini-stat" style="text-align:left;background:transparent;padding:0;"><b style="font-size:15px;">'+k.tiempoPromedioMin+' min</b><span>Tiempo promedio de aprendizaje por curso</span></div>' +
      '</div>' +
    '</div>';
    set('rh-p-kpis', html);
  }

  function areaChips(d, targetRenderFn){
    var chips = '<div class="rh-chips">' +
      '<button class="rh-chip '+(STATE.area==='todas'?'on':'')+'" data-area="todas">Todas las areas</button>' +
      d.areas.map(function(a){ return '<button class="rh-chip '+(STATE.area===a?'on':'')+'" data-area="'+esc(a)+'">'+esc(a)+'</button>'; }).join('') +
    '</div>';
    return chips;
  }

  function filteredUsers(d){
    if(STATE.area==='todas') return d.users;
    return d.users.filter(function(u){ return u.area===STATE.area; });
  }

  function renderAnalytics(d){
    var users = filteredUsers(d);
    var byArea = STATE.area==='todas' ? d.byArea : d.byArea.filter(function(a){return a.area===STATE.area;});
    var topAvance = users.slice().sort(function(a,b){return b.avgPct-a.avgPct;}).slice(0,5);
    var enRiesgo = users.filter(function(u){return u.semaforo!=='verde';}).slice(0,6);
    var sinActividad = users.filter(function(u){return u.daysInactive!=null && u.daysInactive>30;}).slice(0,6);

    var html = areaChips(d) +
      '<div class="rh-grid rh-grid-2">' +
        '<div class="rh-card"><h3>Horas de capacitacion por area</h3>' +
          byArea.map(function(a){ return barIndicator(a.area, a.hoursTotal+'h', Math.min(100, a.hoursTotal*2)); }).join('') +
        '</div>' +
        '<div class="rh-card"><h3>Cumplimiento de obligatorios por area</h3>' +
          byArea.map(function(a){ return barIndicator(a.area, a.obligCompliancePct+'%', a.obligCompliancePct); }).join('') +
        '</div>' +
        '<div class="rh-card"><h3>Promedio de avance por area</h3>' +
          byArea.map(function(a){ return barIndicator(a.area, a.avgPct+'%', a.avgPct); }).join('') +
        '</div>' +
        '<div class="rh-card"><h3>Participacion por area</h3>' +
          byArea.map(function(a){ return barIndicator(a.area, a.participationPct+'%', a.participationPct); }).join('') +
        '</div>' +
        '<div class="rh-card"><h3>Colaboradores con mayor avance</h3>' +
          (topAvance.length ? topAvance.map(function(u,i){ return rankRow(i+1,u,'avgPct',function(v){return v+'%';}); }).join('') : emptyState('👤','Sin datos','No hay colaboradores en esta area.')) +
        '</div>' +
        '<div class="rh-card"><h3>Colaboradores en riesgo</h3>' +
          (enRiesgo.length ? enRiesgo.map(function(u){ return riskRow({name:u.name, area:u.area, daysInactive:u.daysInactive, obligPendientes:u.obligTotal-u.obligDone, pathsPendientes:u.pathsTotal-u.pathsDone, semaforo:u.semaforo}); }).join('') : emptyState('✅','Sin riesgos detectados','Todos los colaboradores de esta area estan al dia.')) +
        '</div>' +
      '</div>' +
      '<div class="rh-card" style="margin-top:18px;"><h3>Colaboradores sin actividad (mas de 30 dias)</h3>' +
        (sinActividad.length ? sinActividad.map(function(u){ return riskRow({name:u.name, area:u.area, daysInactive:u.daysInactive, obligPendientes:u.obligTotal-u.obligDone, pathsPendientes:u.pathsTotal-u.pathsDone, semaforo:u.semaforo}); }).join('') : emptyState('👏','Todo al dia','No hay colaboradores inactivos en esta area.')) +
      '</div>';
    set('rh-p-analytics', html);
  }

  function renderHeatmap(d){
    var html = '<div class="rh-card"><h3>Mapa de calor por area <small>Nivel de avance promedio</small></h3>' +
      '<div class="rh-heatmap">' + d.heatmap.map(heatRow).join('') + '</div>' +
      '<div style="margin-top:14px;font-size:11.5px;color:#999;">Verde = 80% o mas &middot; Amarillo = 50-79% &middot; Rojo = menos de 50%. Calculado con datos reales de progreso por area.</div>' +
    '</div>';
    set('rh-p-heatmap', html);
  }

  function renderCurso(d){
    var rows = d.byCourse.map(function(c){
      return '<tr>' +
        '<td>'+esc(c.name)+' '+(c.obligatorio?'<span class="rh-pill oblig">Obligatorio</span>':'<span class="rh-pill opt">Opcional</span>')+'</td>' +
        '<td>'+c.iniciados+'</td>' +
        '<td>'+c.completados+'</td>' +
        '<td>'+c.tasaCompletitudPct+'%</td>' +
        '<td>'+c.abandonoPct+'%</td>' +
        '<td>'+c.evalPromedio+'%</td>' +
        '<td>'+(c.obligatorio ? c.pendientes : '—')+'</td>' +
      '</tr>';
    }).join('');
    var masVistos = d.byCourseRanked.slice(0,3).map(function(c){return c.name;}).join(', ')||'—';
    var menosVistos = d.byCourseRanked.slice(-3).map(function(c){return c.name;}).join(', ')||'—';
    var html = '<div class="rh-grid rh-grid-3" style="margin-bottom:18px;">' +
        '<div class="rh-card"><h3>Cursos mas vistos</h3><div>'+esc(masVistos)+'</div></div>' +
        '<div class="rh-card"><h3>Cursos menos vistos</h3><div>'+esc(menosVistos)+'</div></div>' +
        '<div class="rh-card"><h3>Proximos a vencer</h3>' + emptyState('📅','Proximamente','Aun no existe un campo de vigencia por curso en la plataforma.') + '</div>' +
      '</div>' +
      '<div class="rh-card"><h3>Detalle por curso</h3>' +
        '<table class="rh-table"><thead><tr><th>Curso</th><th>Iniciados</th><th>Completados</th><th>% Completitud</th><th>% Abandono</th><th>Avance prom.</th><th>Oblig. pendientes</th></tr></thead><tbody>'+rows+'</tbody></table>' +
      '</div>';
    set('rh-p-curso', html);
  }

  function renderColaboradorSearch(d, query){
    var list = d.users;
    if(query){
      var q = query.toLowerCase();
      list = list.filter(function(u){ return (u.name||'').toLowerCase().indexOf(q)!==-1 || (u.area||'').toLowerCase().indexOf(q)!==-1; });
    }
    var results = list.slice(0,8).map(function(u){
      return '<div class="rh-employee-result" data-uid="'+esc(u.id)+'">' +
        '<div class="rh-rank-avatar">'+esc((u.name||'?').charAt(0))+'</div>' +
        '<div><b>'+esc(u.name)+'</b><div style="font-size:11.5px;color:#999;">'+esc(u.area)+' &middot; Nivel '+u.level+'</div></div>' +
      '</div>';
    }).join('');
    set('rh-colaborador-results', results || emptyState('🔍','Sin resultados','No se encontraron colaboradores.'));
  }

  function renderColaboradorDetail(d, uid){
    var u = d.users.filter(function(x){return x.id===uid;})[0];
    if(!u){ set('rh-colaborador-detail', ''); return; }
    var html = '<div class="rh-card rh-employee-detail">' +
      '<h3>'+esc(u.name)+' <small>'+esc(u.area)+'</small></h3>' +
      '<div class="rh-employee-detail-grid">' +
        '<div class="rh-mini-stat"><b>'+u.doneCount+'/'+u.totalCourses+'</b><span>Cursos</span></div>' +
        '<div class="rh-mini-stat"><b>'+u.hours.toFixed(1)+'h</b><span>Horas</span></div>' +
        '<div class="rh-mini-stat"><b>'+u.avgPct+'%</b><span>Promedio</span></div>' +
        '<div class="rh-mini-stat"><b>'+u.badgesCount+'</b><span>Insignias</span></div>' +
        '<div class="rh-mini-stat"><b>'+u.xp+'</b><span>XP</span></div>' +
        '<div class="rh-mini-stat"><b>'+u.level+'</b><span>Nivel</span></div>' +
        '<div class="rh-mini-stat"><b>'+u.doneCount+'</b><span>Certificados</span></div>' +
        '<div class="rh-mini-stat"><b>'+u.pathsDone+'/'+u.pathsTotal+'</b><span>Rutas</span></div>' +
      '</div>' +
      '<div style="margin-top:16px;font-size:12.5px;color:#666;">Ultima actividad registrada: '+(u.lastDate?esc(u.lastDate):'sin registro')+' ('+(u.daysInactive!=null?u.daysInactive+' dias':'—')+')</div>' +
    '</div>';
    set('rh-colaborador-detail', html);
  }

  function renderColaborador(d){
    var html = '<div class="rh-card">' +
      '<h3>Buscar colaborador</h3>' +
      '<input class="rh-search" style="width:100%;color:#111;background:#f4f4f4;border-color:#e4e4e4;" id="rh-colaborador-input" placeholder="Escribe un nombre o area...">' +
      '<div id="rh-colaborador-results" style="margin-top:10px;"></div>' +
    '</div>' +
    '<div id="rh-colaborador-detail" style="margin-top:18px;"></div>';
    set('rh-p-colaborador', html);
    renderColaboradorSearch(d, '');
    var input = el('rh-colaborador-input');
    if(input){
      input.addEventListener('input', function(){ renderColaboradorSearch(d, input.value); });
    }
    var resultsBox = el('rh-colaborador-results');
    if(resultsBox){
      resultsBox.addEventListener('click', function(e){
        var row = e.target.closest ? e.target.closest('.rh-employee-result') : null;
        if(row) renderColaboradorDetail(d, row.getAttribute('data-uid'));
      });
    }
  }

  function renderAprendizaje(d){
    // Nota: sin una bitacora de sesiones por dia, "horas esta semana/este mes" se
    // aproxima con las fechas reales de finalizacion de curso (mismo criterio que
    // el Dashboard del colaborador), en vez de inventar una cifra por sesion.
    var html = '<div class="rh-grid rh-grid-3" style="margin-bottom:18px;">' +
      kpiCard('📆','—','Horas esta semana (requiere bitacora diaria)', null, false) +
      kpiCard('📅', d.monthCompare.hours.cur+'h','Horas este mes', d.monthCompare.hours.delta) +
      kpiCard('📈', d.global.horasTotal+'h','Horas acumuladas (historico)') +
    '</div>' +
    '<div class="rh-grid rh-grid-2">' +
      '<div class="rh-card"><h3>Horas por area</h3>' + d.byArea.map(function(a){ return barIndicator(a.area, a.hoursTotal+'h', Math.min(100,a.hoursTotal*2)); }).join('') + '</div>' +
      '<div class="rh-card"><h3>Horas por curso</h3>' + d.courses.map(function(c){ var bc=d.byCourse.filter(function(x){return x.id===c.id;})[0]; var totalH = (bc?bc.completados:0) * ( (String(c.time||'').match(/\d+/g)||[0]).reduce(function(a,b){return a+parseInt(b,10);},0) / Math.max(1,(String(c.time||'').match(/\d+/g)||[1]).length) )/60; return barIndicator(c.full||c.name, Math.round(totalH*10)/10+'h', Math.min(100,totalH*5)); }).join('') + '</div>' +
    '</div>' +
    '<div class="rh-card" style="margin-top:18px;"><h3>Horas por instructor <span class="rh-tag-sim">Proximamente</span></h3>' +
      emptyState('🎓','Sin modelo de instructores todavia','El catalogo de cursos aun no registra un instructor responsable por curso.') +
    '</div>';
    set('rh-p-aprendizaje', html);
  }

  function renderCertificaciones(d){
    var c = d.certifications;
    var html = '<div class="rh-grid rh-grid-4">' +
      kpiCard('🎓', c.emitidos, 'Certificados emitidos') +
      kpiCard('⏳', c.pendientes, 'Pendientes (cursos sin completar)') +
      kpiCard('⛔', '—', 'Vencidos', null, false) +
      kpiCard('⏰', '—', 'Por vencer', null, false) +
    '</div>' +
    '<div style="margin:8px 0 18px;font-size:11.5px;color:#999;">"Vencidos" y "Por vencer" requieren una fecha de vigencia por certificacion, que aun no existe en el modelo de datos. <span class="rh-tag-sim">Proximamente</span></div>' +
    '<div class="rh-grid rh-grid-2">' +
      '<div class="rh-card"><h3>Certificados por area</h3>' + d.byArea.map(function(a){ var cnt=d.users.filter(function(u){return u.area===a.area;}).reduce(function(s,u){return s+u.doneCount;},0); return barIndicator(a.area, cnt+'', Math.min(100,cnt*10)); }).join('') + '</div>' +
      '<div class="rh-card"><h3>Certificados por curso</h3>' + d.byCourse.map(function(c){ return barIndicator(c.name, c.completados+'', Math.min(100,c.completados*15)); }).join('') + '</div>' +
    '</div>';
    set('rh-p-certificaciones', html);
  }

  function renderRankingTabs(d){
    var defs = [
      {k:'byXP', label:'XP', field:'xp', fmt:function(v){return v+' XP';}},
      {k:'byHours', label:'Horas', field:'hours', fmt:function(v){return v.toFixed(1)+'h';}},
      {k:'byCourses', label:'Cursos', field:'doneCount', fmt:function(v){return v+'';}},
      {k:'byCertificates', label:'Certificados', field:'doneCount', fmt:function(v){return v+'';}},
      {k:'byBadges', label:'Insignias', field:'badgesCount', fmt:function(v){return v+'';}},
      {k:'byPaths', label:'Rutas', field:'pathsDone', fmt:function(v){return v+'';}}
    ];
    var chips = '<div class="rh-chips" id="rh-rank-chips">' + defs.map(function(x,i){ return '<button class="rh-chip '+(i===0?'on':'')+'" data-rank="'+x.k+'">Top 10 por '+x.label+'</button>'; }).join('') + '</div>';
    var panels = defs.map(function(x,i){
      var rows = d.ranking[x.k].map(function(u,idx){ return rankRow(idx+1,u,x.field,x.fmt); }).join('');
      return '<div class="rh-card rh-rank-panel" data-rank-panel="'+x.k+'" style="'+(i===0?'':'display:none;')+'"><h3>Top 10 por '+x.label+'</h3>'+(rows||emptyState('🏆','Sin datos','Aun no hay suficiente informacion.'))+'</div>';
    }).join('');
    set('rh-p-ranking', chips + panels);
    var chipBox = el('rh-rank-chips');
    if(chipBox){
      chipBox.addEventListener('click', function(e){
        var b = e.target.closest ? e.target.closest('.rh-chip') : null; if(!b) return;
        chipBox.querySelectorAll('.rh-chip').forEach(function(c){c.classList.remove('on');});
        b.classList.add('on');
        var key = b.getAttribute('data-rank');
        document.querySelectorAll('.rh-rank-panel').forEach(function(p){ p.style.display = (p.getAttribute('data-rank-panel')===key) ? '' : 'none'; });
      });
    }
  }

  function renderGamificacion(d){
    var g = d.gamification;
    var levels = Object.keys(g.levelDistribution).sort(function(a,b){return a-b;});
    var html = '<div class="rh-grid rh-grid-3" style="margin-bottom:18px;">' +
      kpiCard('✨', g.totalXP, 'XP acumulado (organizacion)') +
      kpiCard('🎖️', g.totalBadges, 'Insignias entregadas') +
      kpiCard('📈', levels.length, 'Niveles alcanzados distintos') +
    '</div>' +
    '<div class="rh-grid rh-grid-2">' +
      '<div class="rh-card"><h3>Distribucion de niveles</h3>' + levels.map(function(l){ return barIndicator('Nivel '+l, g.levelDistribution[l]+' colaborador(es)', Math.min(100, g.levelDistribution[l]*20)); }).join('') + '</div>' +
      '<div class="rh-card"><h3>Usuarios con mayor progreso (XP)</h3>' + g.topProgress.map(function(u,i){ return rankRow(i+1,u,'xp',function(v){return v+' XP';}); }).join('') + '</div>' +
    '</div>' +
    '<div class="rh-card" style="margin-top:18px;"><h3>Usuarios con mayor racha <span class="rh-tag-sim">No disponible</span></h3>' + emptyState('🔥', 'Dato no centralizado', g.streakNote) + '</div>';
    set('rh-p-gamificacion', html);
  }

  function renderCalendario(d){
    var html = '<div class="rh-card"><h3>Calendario ejecutivo</h3>' +
      emptyState('📅','Proximamente','Learning Friday, capacitaciones, evaluaciones y certificaciones apareceran aqui en cuanto se habilite el motor de eventos.') +
    '</div>';
    set('rh-p-calendario', html);
  }

  function renderAlertas(d){
    var html = '<div class="rh-card"><h3>Centro de alertas</h3>' +
      d.alerts.map(function(a){ return '<div class="rh-alert '+a.severity+'"><b>'+(a.severity==='alta'?'Alta':(a.severity==='media'?'Media':'Info'))+'</b><div>'+esc(a.text)+'</div></div>'; }).join('') +
    '</div>';
    set('rh-p-alertas', html);
  }

  function toCSV(d){
    var rows = [['Colaborador','Area','Cursos completados','Horas','Promedio %','XP','Nivel','Certificados','Rutas completadas','Dias inactivo','Semaforo']];
    d.users.forEach(function(u){
      rows.push([u.name,u.area,u.doneCount,u.hours.toFixed(1),u.avgPct,u.xp,u.level,u.doneCount,u.pathsDone,(u.daysInactive!=null?u.daysInactive:''),u.semaforo]);
    });
    return rows.map(function(r){ return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
  }

  function renderReportes(d){
    var html = '<div class="rh-card"><h3>Reportes y exportacion</h3>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">' +
        '<button class="rh-btn rh-btn-primary" id="rh-rep-csv">⬇️ Exportar CSV</button>' +
        '<button class="rh-btn rh-btn-ghost" id="rh-rep-print">🖨️ Imprimir / PDF</button>' +
        '<button class="rh-btn rh-btn-ghost" id="rh-rep-share">🔗 Compartir enlace</button>' +
      '</div>' +
      '<div style="margin-top:14px;font-size:11.5px;color:#999;">Excel: abre el CSV exportado directamente con Microsoft Excel o Google Sheets.</div>' +
    '</div>';
    set('rh-p-reportes', html);
    var csvBtn = el('rh-rep-csv');
    if(csvBtn) csvBtn.onclick = function(){ downloadCSV(d); };
    var printBtn = el('rh-rep-print');
    if(printBtn) printBtn.onclick = function(){ window.print(); };
    var shareBtn = el('rh-rep-share');
    if(shareBtn) shareBtn.onclick = function(){
      var url = window.location.href;
      if(navigator.share){ navigator.share({ title:'Academia Mirage - RH Ejecutivo', url:url }); }
      else if(navigator.clipboard){ navigator.clipboard.writeText(url); alert('Enlace copiado al portapapeles.'); }
    };
  }

  function downloadCSV(d){
    var csv = toCSV(d);
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'academia-mirage-rh-'+(new Date().toISOString().slice(0,10))+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }

  function renderInstructores(d){
    var html = '<div class="rh-card"><h3>Dashboard de instructores <span class="rh-tag-sim">Proximamente</span></h3>' +
      emptyState('👩‍🏫','Modulo preparado','En cuanto el catalogo de cursos incluya un campo de instructor responsable, aqui se mostraran cursos impartidos, horas, evaluaciones, calificacion y participantes por instructor.') +
    '</div>';
    set('rh-p-instructores', html);
  }

  function renderTalento(d){
    var comps = window.MirageRHData.ALL_COMPS;
    var radarSvg = buildRadarSVG(d.competencyGlobal, comps);
    var legend = comps.map(function(c){ return '<div><span>'+d.competencyGlobal[c]+'%</span> '+esc(c)+'</div>'; }).join('');
    var html = '<div class="rh-grid rh-grid-3" style="margin-bottom:18px;">' +
      kpiCard('🔴', d.riskCounts.rojo, 'Colaboradores en riesgo alto') +
      kpiCard('🟡', d.riskCounts.amarillo, 'Colaboradores en riesgo medio') +
      kpiCard('🟢', d.riskCounts.verde, 'Colaboradores al dia') +
    '</div>' +
    '<div class="rh-card" style="margin-bottom:18px;"><h3>1. Riesgo de capacitacion</h3>' +
      d.risk.map(riskRow).join('') +
    '</div>' +
    '<div class="rh-card" style="margin-bottom:18px;"><h3>2. Matriz de competencias (promedio organizacional)</h3>' +
      '<div class="rh-radar-wrap">'+radarSvg+'<div class="rh-radar-legend">'+legend+'</div></div>' +
      '<div style="margin-top:10px;font-size:11px;color:#999;">Calculado con base en los cursos reales completados y su relacion con cada competencia. Liderazgo, Comunicacion, Innovacion y Trabajo en equipo aun no tienen cursos asociados en el catalogo, por lo que muestran 0% de forma honesta.</div>' +
    '</div>' +
    '<div class="rh-card"><h3>4. Predicciones (preparado para IA) <span class="rh-tag-sim">Simulado</span></h3>' +
      '<div style="font-size:11.5px;color:#999;margin-bottom:10px;">'+esc(d.predictions.note)+'</div>' +
      d.predictions.items.map(function(p){ return barIndicator(p.label, String(p.value), 60); }).join('') +
    '</div>';
    set('rh-p-talento', html);
  }

  function renderDireccion(d){
    var g = d.global, k = d.kpis;
    var bestArea = d.byArea.slice().sort(function(a,b){return b.avgPct-a.avgPct;})[0];
    var worstArea = d.byArea.slice().sort(function(a,b){return a.avgPct-b.avgPct;})[0];
    var html = '<div class="rh-exec-grid">' +
        '<div class="rh-exec-card"><span>Cumplimiento global</span><b>'+k.cumplimientoPct+'%</b><span>de capacitacion</span></div>' +
        '<div class="rh-exec-card"><span>Horas de formacion</span><b>'+g.horasTotal+'h</b><span>acumuladas</span></div>' +
        '<div class="rh-exec-card"><span>Certificaciones</span><b>'+g.certificadosEmitidos+'</b><span>emitidas</span></div>' +
      '</div>' +
      '<div class="rh-grid rh-grid-2" style="margin-top:18px;">' +
        '<div class="rh-card"><h3>Area con mayor avance</h3><div style="font-size:20px;font-weight:800;">'+(bestArea?esc(bestArea.area):'—')+'</div><div style="color:#999;font-size:12.5px;">'+(bestArea?bestArea.avgPct:'—')+'% de avance promedio</div></div>' +
        '<div class="rh-card"><h3>Area en riesgo</h3><div style="font-size:20px;font-weight:800;">'+(worstArea?esc(worstArea.area):'—')+'</div><div style="color:#999;font-size:12.5px;">'+(worstArea?worstArea.avgPct:'—')+'% de avance promedio</div></div>' +
      '</div>' +
      '<div class="rh-card" style="margin-top:18px;"><h3>Participacion por sede <span class="rh-tag-sim">Proximamente</span></h3>' + emptyState('🏢','Sin modelo de sedes','Los usuarios aun no registran una sede en su perfil.') + '</div>' +
      '<div class="rh-card" style="margin-top:18px;"><h3>Evolucion mensual</h3>' + barIndicator('Cursos completados este mes vs mes anterior', d.monthCompare.completions.label||'', 60) + '</div>';
    set('rh-p-direccion', html);
  }

  function renderAsistente(d){
    var suggestions = [
      '¿Que area tiene menor avance?',
      '¿Que curso tiene mayor abandono?',
      '¿Cuantos colaboradores no han terminado Cultura de la Legalidad?',
      '¿Que cursos requieren actualizacion?',
      '¿Cual es el cumplimiento global?',
      '¿Cuantos colaboradores estan en riesgo?'
    ];
    var html = '<div class="rh-ai-box">' +
      '<h3 style="color:#fff;">Asistente ejecutivo</h3>' +
      '<div style="font-size:12.5px;color:#c9c9cc;">Preguntas respondidas con los datos reales de la plataforma (sin conexion a un modelo externo por ahora).</div>' +
      '<div class="rh-ai-suggestions">' + suggestions.map(function(s){ return '<button class="rh-ai-chip" data-q="'+esc(s)+'">'+esc(s)+'</button>'; }).join('') + '</div>' +
      '<div class="rh-ai-input-row"><input class="rh-ai-input" id="rh-ai-input" placeholder="Escribe tu pregunta..."><button class="rh-btn rh-btn-primary" id="rh-ai-ask">Preguntar</button></div>' +
      '<div id="rh-ai-answer"></div>' +
    '</div>';
    set('rh-p-asistente', html);
    function ask(q){
      var ans = window.MirageRHData.answer(q, d);
      set('rh-ai-answer', '<div class="rh-ai-answer"><b>'+esc(q)+'</b><br>'+esc(ans)+'</div>');
    }
    var box = el('rh-p-asistente');
    if(box){
      box.addEventListener('click', function(e){
        var chip = e.target.closest ? e.target.closest('.rh-ai-chip') : null;
        if(chip){ ask(chip.getAttribute('data-q')); return; }
        if(e.target && e.target.id==='rh-ai-ask'){ var inp = el('rh-ai-input'); if(inp && inp.value.trim()) ask(inp.value.trim()); }
      });
    }
  }

  /* ---------------- Orquestador ---------------- */

  function renderTabs(){
    var html = TABS.map(function(t){ return '<button class="rh-tab '+(STATE.tab===t.id?'on':'')+'" data-tab="'+t.id+'">'+t.icon+' '+esc(t.label)+'</button>'; }).join('');
    set('rh-tabs', html);
  }

  function showTab(id){
    STATE.tab = id;
    document.querySelectorAll('.rh-tab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-tab')===id); });
    document.querySelectorAll('.rh-panel').forEach(function(p){ p.classList.toggle('on', p.getAttribute('data-panel')===id); });
  }

  function renderAll(d){
    renderResumen(d); renderKpis(d); renderAnalytics(d); renderHeatmap(d); renderCurso(d);
    renderColaborador(d); renderAprendizaje(d); renderCertificaciones(d); renderRankingTabs(d);
    renderGamificacion(d); renderCalendario(d); renderAlertas(d); renderReportes(d);
    renderInstructores(d); renderTalento(d); renderDireccion(d); renderAsistente(d);
  }

  function wireGlobalControls(d){
    var tabsBox = el('rh-tabs');
    if(tabsBox && !tabsBox.__wired){
      tabsBox.__wired = true;
      tabsBox.addEventListener('click', function(e){
        var b = e.target.closest ? e.target.closest('.rh-tab') : null; if(!b) return;
        showTab(b.getAttribute('data-tab'));
      });
    }
    var panels = el('rh-panels');
    if(panels && !panels.__wired){
      panels.__wired = true;
      panels.addEventListener('click', function(e){
        var chip = e.target.closest ? e.target.closest('.rh-chip[data-area]') : null;
        if(chip){
          STATE.area = chip.getAttribute('data-area');
          renderAnalytics(STATE.data);
        }
      });
    }
    var search = el('rh-global-search');
    if(search && !search.__wired){
      search.__wired = true;
      search.addEventListener('input', function(){
        var q = search.value.trim();
        if(!q){ set('rh-global-search-results',''); return; }
        var ql = q.toLowerCase();
        var d2 = STATE.data; if(!d2) return;
        var matches = [];
        d2.users.forEach(function(u){ if((u.name||'').toLowerCase().indexOf(ql)!==-1) matches.push({type:'Colaborador', label:u.name+' ('+u.area+')'}); });
        d2.courses.forEach(function(c){ if((c.full||c.name||'').toLowerCase().indexOf(ql)!==-1) matches.push({type:'Curso', label:c.full||c.name}); });
        d2.areas.forEach(function(a){ if(a.toLowerCase().indexOf(ql)!==-1) matches.push({type:'Area', label:a}); });
        var html = matches.length ?
          '<div class="rh-card" style="margin-bottom:18px;">' + matches.slice(0,10).map(function(m){ return '<div style="padding:8px 0;border-bottom:1px solid #f2f2f2;font-size:12.5px;"><b>'+esc(m.type)+':</b> '+esc(m.label)+'</div>'; }).join('') + '</div>'
          : '';
        set('rh-global-search-results', html);
      });
    }
    var refreshBtn = el('rh-refresh');
    if(refreshBtn && !refreshBtn.__wired){
      refreshBtn.__wired = true;
      refreshBtn.onclick = function(){ onRender(true); };
    }
    var csvBtn = el('rh-export-csv');
    if(csvBtn && !csvBtn.__wired){ csvBtn.__wired = true; csvBtn.onclick = function(){ if(STATE.data) downloadCSV(STATE.data); }; }
    var printBtn = el('rh-export-print');
    if(printBtn && !printBtn.__wired){ printBtn.__wired = true; printBtn.onclick = function(){ window.print(); }; }
  }

  async function onRender(force){
    if(typeof CU === 'undefined' || !CU || CU.role !== 'admin') return;
    if(!el('v-rhdash')) return;
    if(!window.MirageRHData || typeof window.MirageRHData.compute !== 'function') return;
    renderTabs();
    wireGlobalControls();
    set('rh-p-resumen', emptyState('⏳','Cargando...', 'Calculando indicadores con datos reales.'));
    try{
      var data = await window.MirageRHData.compute(force);
      if(!data) return;
      STATE.data = data;
      renderAll(data);
      showTab(STATE.tab);
      wireGlobalControls(data);
    }catch(e){ /* nunca romper el resto de la plataforma por un error aqui */ }
  }

  window.MirageRHDash = { onRender: onRender };
})();
