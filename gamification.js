(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var LEVELS = [
    { min:0,    name:'Nuevo Colaborador', icon:'\ud83c\udf31', color:'#76777A' },
    { min:500,  name:'Aprendiz Mirage',   icon:'\ud83d\udcd8', color:'#4A4B4D' },
    { min:1500, name:'Especialista',      icon:'\u2699\ufe0f', color:'#2C2D2F' },
    { min:3000, name:'Experto',           icon:'\ud83c\udfaf', color:'#EA0029' },
    { min:5000, name:'Embajador Mirage',  icon:'\ud83d\ude80', color:'#C8001F' },
    { min:8000, name:'Master Mirage',     icon:'\ud83d\udc51', color:'#000000' }
  ];

  var REWARDS = [
    { xp:1000,  name:'Insignia Plata',     icon:'\ud83e\udd48' },
    { xp:3000,  name:'Insignia Oro',       icon:'\ud83e\udd47' },
    { xp:5000,  name:'Insignia Diamante',  icon:'\ud83d\udc8e' },
    { xp:10000, name:'Embajador Mirage',   icon:'\ud83d\ude80' }
  ];

  var BADGES = [
    { id:'primer_curso',        name:'Primer Curso',            icon:'\ud83c\udfc5', desc:'Completa tu primer curso en Academia Mirage.', type:'special', check:function(ctx){ return ctx.doneCount>=1; } },
    { id:'primer_certificado',  name:'Primer Certificado',      icon:'\ud83c\udf96\ufe0f', desc:'Obten tu primera constancia de finalizacion.', type:'special', check:function(ctx){ return ctx.doneCount>=1; } },
    { id:'especialista_sst',    name:'Especialista SST',        icon:'\ud83e\uddba', desc:'Completa el curso de Induccion de Seguridad y Salud en el Trabajo.', type:'course', course:'induccion_sst' },
    { id:'cultura_legalidad',   name:'Cultura de la Legalidad', icon:'\u2696\ufe0f', desc:'Completa el curso Cultura de la Legalidad.', type:'course', course:'cultura_legalidad' },
    { id:'ciberseguridad',      name:'Ciberseguridad',          icon:'\ud83d\udd10', desc:'Completa el curso de Ciberseguridad en el Trabajo.', type:'course', course:'ciberseguridad' },
    { id:'calidad',             name:'Calidad',                 icon:'\ud83c\udfc6', desc:'Completa el curso de 5S y Seguridad.', type:'course', course:'5s_seguridad' },
    { id:'excelencia_operativa',name:'Excelencia Operativa',    icon:'\u2b50', desc:'Completa el curso SAFESTART - Excelencia Segura.', type:'course', course:'safestart' },
    { id:'formacion_continua',  name:'Formacion Continua',      icon:'\ud83d\udcda', desc:'Completa el 100% del catalogo actual de cursos.', type:'special', check:function(ctx){ return ctx.total>0 && ctx.doneCount===ctx.total; } },
    { id:'learning_friday',     name:'Learning Friday',         icon:'\ud83d\udcc6', desc:'Asiste a una sesion de Learning Friday.', type:'locked' },
    { id:'liderazgo',           name:'Liderazgo',               icon:'\ud83e\udded', desc:'Completa la ruta de Liderazgo (proximamente).', type:'locked' },
    { id:'innovacion',          name:'Innovacion',              icon:'\ud83d\udca1', desc:'Completa un curso de innovacion (proximamente).', type:'locked' },
    { id:'mentor',              name:'Mentor',                  icon:'\ud83e\udd1d', desc:'Apoya la formacion de otro colaborador (proximamente).', type:'locked' }
  ];

  var ACHIEVEMENTS = [
    { id:'primer_curso',    name:'Completaste tu primer curso',  icon:'\ud83c\udf1f', compute:function(ctx){ return { total:1, value:Math.min(1,ctx.doneCount) }; } },
    { id:'horas_100',       name:'100 horas de capacitacion',    icon:'\u23f1', compute:function(ctx){ return { total:100, value:ctx.hours }; } },
    { id:'certificados_10', name:'10 certificados',              icon:'\ud83c\udf96\ufe0f', compute:function(ctx){ return { total:10, value:ctx.doneCount }; } },
    { id:'rutas_5',         name:'5 rutas completadas',          icon:'\ud83d\uddfa\ufe0f', compute:function(ctx){ return { total:5, value:ctx.pathsDone }; } },
    { id:'dias_30',         name:'30 dias aprendiendo en Mirage', icon:'\ud83d\udcc5', compute:function(ctx){ return { total:30, value:Math.min(30, ctx.daysSince) }; } },
    { id:'primer_obligatorio', name:'Primer curso obligatorio',  icon:'\u2705', compute:function(ctx){ return { total:1, value: ctx.doneReq>0 ? 1:0 }; } },
    { id:'primer_voluntario',  name:'Primer curso voluntario',   icon:'\ud83d\ude4c', compute:function(ctx){ return { total:1, value: ctx.doneVol>0 ? 1:0 }; } },
    { id:'legalidad_done',  name:'Finalizaste Cultura de la Legalidad', icon:'\u2696\ufe0f', compute:function(ctx){ return { total:1, value: ctx.done.indexOf('cultura_legalidad')!==-1 ? 1:0 }; } },
    { id:'seguridad_completa', name:'Completaste todas las capacitaciones de Seguridad', icon:'\ud83e\uddba', compute:function(ctx){ return { total:ctx.seguridadTotal, value:ctx.seguridadDone }; } }
  ];

  var PATHS = [
    { id:'especialista_seguridad', name:'Especialista en Seguridad', icon:'\ud83d\udee1\ufe0f', badge:'Especialista en Seguridad Mirage',
      steps:[ {id:'induccion_sst', label:'Induccion SST'}, {id:'safestart', label:'SAFESTART'}, {id:'cultura_legalidad', label:'Cultura de la Legalidad'}, {id:'ciberseguridad', label:'Ciberseguridad'} ] },
    { id:'excelencia_operativa', name:'Excelencia Operativa', icon:'\u2699\ufe0f', badge:'Excelencia Operativa Mirage',
      steps:[ {id:'5s_seguridad', label:'5S y Seguridad'}, {id:'_pending_calidad', label:'Calidad Avanzada'}, {id:'_pending_mejora', label:'Mejora Continua'}, {id:'_pending_lean', label:'Lean'} ] },
    { id:'lider_mirage', name:'Lider Mirage', icon:'\ud83e\udded', badge:'Lider Mirage',
      steps:[ {id:'_pending_liderazgo', label:'Liderazgo'}, {id:'_pending_feedback', label:'Feedback'}, {id:'_pending_coaching', label:'Coaching'}, {id:'_pending_desempeno', label:'Gestion del Desempeno'} ] },
    { id:'transformacion_digital', name:'Transformacion Digital', icon:'\ud83d\udcbb', badge:'Transformacion Digital Mirage',
      steps:[ {id:'ciberseguridad', label:'Ciberseguridad'}, {id:'_pending_ia', label:'Inteligencia Artificial'}, {id:'_pending_herramientas', label:'Herramientas Digitales'} ] }
  ];

  var AREAS = ['Producci\u00f3n','Almac\u00e9n y Log\u00edstica','Ventas','Recursos Humanos','Administraci\u00f3n','Calidad'];

  function getLevel(xp){
    var lvl = LEVELS[0], idx = 0;
    for(var i=0;i<LEVELS.length;i++){ if(xp >= LEVELS[i].min){ lvl = LEVELS[i]; idx = i; } }
    var next = LEVELS[idx+1] || null;
    return { index:idx+1, name:lvl.name, icon:lvl.icon, color:lvl.color, min:lvl.min, next:next, xpToNext: next ? (next.min - xp) : 0, pct: next ? Math.round(((xp-lvl.min)/(next.min-lvl.min))*100) : 100 };
  }

  function estimateHours(prog){
    if(typeof COURSES === 'undefined') return 0;
    var totalMin = 0;
    for(var i=0;i<COURSES.length;i++){
      var c = COURSES[i]; var p = prog[c.id];
      if(!p || p.status !== 'completed') continue;
      var nums = String(c.time||'').match(/\d+/g);
      if(nums && nums.length){ var sum=0; for(var j=0;j<nums.length;j++) sum+=parseInt(nums[j],10); totalMin += sum/nums.length; }
    }
    return Math.round((totalMin/60)*10)/10;
  }

  function daysSince(dateStr){
    if(!dateStr) return 0;
    var d = new Date(dateStr); if(isNaN(d.getTime())) return 0;
    var diff = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diff/(1000*60*60*24)));
  }

  function pathProgress(path, done){
    var realSteps = path.steps.filter(function(s){ return s.id.indexOf('_pending_')!==0; });
    var doneSteps = realSteps.filter(function(s){ return done.indexOf(s.id)!==-1; });
    return { doneCount:doneSteps.length, totalCount:path.steps.length, realCount:realSteps.length, pct: path.steps.length? Math.round((doneSteps.length/path.steps.length)*100) : 0, complete: realSteps.length>0 && doneSteps.length===realSteps.length && realSteps.length===path.steps.length };
  }

  function buildContext(user, prog){
    var done = [];
    var doneReq = 0, doneVol = 0, seguridadDone = 0, seguridadTotal = 0;
    for(var i=0;i<COURSES.length;i++){
      var c = COURSES[i];
      if(c.tag === 'Seguridad') seguridadTotal++;
      var p = prog[c.id];
      if(p && p.status === 'completed'){
        done.push(c.id);
        if(c.req) doneReq++; else doneVol++;
        if(c.tag === 'Seguridad') seguridadDone++;
      }
    }
    var pathsDone = 0;
    for(var k=0;k<PATHS.length;k++){ if(pathProgress(PATHS[k], done).complete) pathsDone++; }
    var xp = (user && user.xp) || 0;
    return {
      user:user, prog:prog, done:done, doneCount:done.length, total:COURSES.length,
      doneReq:doneReq, doneVol:doneVol, seguridadDone:seguridadDone, seguridadTotal:seguridadTotal,
      hours: estimateHours(prog), xp:xp, level:getLevel(xp),
      daysSince: user ? daysSince(user.since) : 0, pathsDone:pathsDone
    };
  }

  function computeBadges(ctx){
    return BADGES.map(function(b){
      var unlocked = false;
      if(b.type === 'course'){ unlocked = ctx.done.indexOf(b.course) !== -1; }
      else if(b.type === 'special'){ unlocked = !!b.check(ctx); }
      return { id:b.id, name:b.name, icon:b.icon, desc:b.desc, locked:(b.type==='locked'), unlocked:unlocked };
    });
  }

  function computeAchievements(ctx){
    return ACHIEVEMENTS.map(function(a){
      var r = a.compute(ctx);
      return { id:a.id, name:a.name, icon:a.icon, value:r.value, total:r.total, unlocked: r.value >= r.total, pct: r.total? Math.min(100, Math.round((r.value/r.total)*100)) : 0 };
    });
  }

  function computePaths(ctx){
    return PATHS.map(function(p){
      var pr = pathProgress(p, ctx.done);
      return { id:p.id, name:p.name, icon:p.icon, badge:p.badge, steps:p.steps, done:ctx.done, doneCount:pr.doneCount, totalCount:pr.totalCount, pct:pr.pct, complete:pr.complete };
    });
  }

  function touchStreak(uid){
    var key = 'am4_gam_streak_' + uid;
    var todayStr = new Date().toISOString().slice(0,10);
    var raw = null;
    try{ raw = JSON.parse(localStorage.getItem(key)); }catch(e){}
    if(!raw){ raw = { count:1, last:todayStr }; localStorage.setItem(key, JSON.stringify(raw)); return raw; }
    if(raw.last === todayStr) return raw;
    var last = new Date(raw.last); var today = new Date(todayStr);
    var diffDays = Math.round((today.getTime()-last.getTime())/(1000*60*60*24));
    if(diffDays === 1){ raw.count += 1; } else { raw.count = 1; }
    raw.last = todayStr;
    localStorage.setItem(key, JSON.stringify(raw));
    return raw;
  }

  async function awardDailyLoginXP(user){
    var key = 'am4_gam_lastxp_' + user.id;
    var todayStr = new Date().toISOString().slice(0,10);
    if(localStorage.getItem(key) === todayStr) return false;
    localStorage.setItem(key, todayStr);
    user.xp = (user.xp||0) + 10;
    if(typeof saveUser === 'function'){ try{ await saveUser(user); }catch(e){} }
    return true;
  }

  async function buildRanking(){
    var users = [];
    try{ users = await getUsers(); }catch(e){ users = []; }
    var rows = [];
    for(var i=0;i<users.length;i++){
      var u = users[i];
      var prog = {};
      try{ prog = await getProgress(u.id); }catch(e){ prog = {}; }
      var ctx = buildContext(u, prog);
      var badgeCount = computeBadges(ctx).filter(function(b){ return b.unlocked; }).length;
      rows.push({ id:u.id, name:u.name||'Colaborador', area:u.area||'Sin area', photo:u.photo||'', xp:ctx.xp, courses:ctx.doneCount, hours:ctx.hours, badges:badgeCount, level:ctx.level });
    }
    rows.sort(function(a,b){ return b.xp - a.xp; });
    return rows;
  }

  function bar(pct, cls){
    return '<div class="gam-bar' + (cls? ' '+cls:'') + '"><div class="gam-bar-f" style="width:' + Math.max(0,Math.min(100,pct)) + '%"></div></div>';
  }

  function renderTeaser(ctx){
    var el = document.getElementById('gam-teaser'); if(!el) return;
    el.innerHTML =
      '<div class="gam-teaser-top">' +
        '<div class="gam-teaser-lvl"><span class="gam-teaser-ico">'+ctx.level.icon+'</span><div><strong>Nivel '+ctx.level.index+'</strong><span>'+esc(ctx.level.name)+'</span></div></div>' +
        '<div class="gam-teaser-xp">'+ctx.xp.toLocaleString('es-MX')+' XP</div>' +
      '</div>' +
      bar(ctx.level.pct) +
      '<div class="gam-teaser-sub">'+(ctx.level.next ? (ctx.level.xpToNext.toLocaleString('es-MX')+' XP para '+esc(ctx.level.next.name)) : 'Nivel maximo alcanzado')+'</div>' +
      '<button class="gam-teaser-btn" onclick="goView(\'gamification\')">\ud83c\udfae Ver mi progreso completo</button>';
  }

  function renderUserCard(ctx){
    var el = document.getElementById('gam-usercard'); if(!el) return;
    var u = ctx.user || {};
    var photo = u.photo || '';
    el.innerHTML =
      '<div class="gam-uc-av">' + (photo ? '<img src="'+photo+'" alt="">' : '<span>'+esc((u.name||'?').charAt(0))+'</span>') + '</div>' +
      '<div class="gam-uc-info">' +
        '<h3>'+esc(u.name||'Colaborador')+'</h3>' +
        '<p>'+esc(u.area||'')+'</p>' +
        '<span class="gam-uc-level" style="background:'+ctx.level.color+'">'+ctx.level.icon+' Nivel '+ctx.level.index+' \u00b7 '+esc(ctx.level.name)+'</span>' +
      '</div>' +
      '<div class="gam-uc-stats">' +
        '<div><strong>'+ctx.xp.toLocaleString('es-MX')+'</strong><span>XP</span></div>' +
        '<div><strong>'+ctx.hours+'</strong><span>Horas</span></div>' +
        '<div><strong>'+ctx.doneCount+'</strong><span>Cursos</span></div>' +
        '<div><strong>'+ctx.doneCount+'</strong><span>Certificados</span></div>' +
      '</div>';
  }

  function renderXPBar(ctx){
    var el = document.getElementById('gam-xpbar'); if(!el) return;
    el.innerHTML =
      '<div class="gam-xp-head"><span>'+ctx.level.icon+' Nivel '+ctx.level.index+' \u00b7 '+esc(ctx.level.name)+'</span><span>'+ctx.xp.toLocaleString('es-MX')+' XP</span></div>' +
      bar(ctx.level.pct) +
      '<div class="gam-xp-sub">'+(ctx.level.next ? (ctx.xp.toLocaleString('es-MX')+' / '+ctx.level.next.min.toLocaleString('es-MX')+' XP hacia '+esc(ctx.level.next.name)) : 'Has alcanzado el nivel maximo')+'</div>';
  }

  function renderBadges(list){
    var el = document.getElementById('gam-badges'); if(!el) return;
    var html = '';
    for(var i=0;i<list.length;i++){
      var b = list[i];
      var cls = b.unlocked ? 'gam-badge unlocked' : (b.locked ? 'gam-badge pending' : 'gam-badge locked');
      html += '<div class="'+cls+'" title="'+esc(b.desc)+'">' +
        '<div class="gam-badge-ico">'+b.icon+'</div>' +
        '<div class="gam-badge-name">'+esc(b.name)+'</div>' +
        '<div class="gam-badge-desc">'+esc(b.desc)+'</div>' +
        (b.locked ? '<span class="gam-badge-tag">Proximamente</span>' : (b.unlocked ? '<span class="gam-badge-tag ok">Obtenida</span>' : '<span class="gam-badge-tag">Pendiente</span>')) +
      '</div>';
    }
    el.innerHTML = html;
  }

  function renderAchievements(list){
    var el = document.getElementById('gam-achievements'); if(!el) return;
    var html = '';
    for(var i=0;i<list.length;i++){
      var a = list[i];
      html += '<div class="gam-ach' + (a.unlocked?' unlocked':'') + '">' +
        '<div class="gam-ach-ico">'+a.icon+'</div>' +
        '<div class="gam-ach-body">' +
          '<div class="gam-ach-name">'+esc(a.name)+'</div>' +
          bar(a.pct, 'sm') +
          '<div class="gam-ach-val">'+a.value+' / '+a.total+'</div>' +
        '</div>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  function renderStreak(streak){
    var el = document.getElementById('gam-streak'); if(!el) return;
    var days = [];
    var today = new Date();
    for(var i=6;i>=0;i--){
      var d = new Date(today.getTime() - i*86400000);
      var isActive = i < streak.count;
      days.push('<div class="gam-streak-day' + (isActive?' on':'') + '">' + ['D','L','M','M','J','V','S'][d.getDay()] + '</div>');
    }
    el.innerHTML =
      '<div class="gam-streak-num">\ud83d\udd25 '+streak.count+'</div>' +
      '<div class="gam-streak-lbl">dia'+(streak.count===1?'':'s')+' consecutivo'+(streak.count===1?'':'s')+' aprendiendo</div>' +
      '<div class="gam-streak-cal">'+days.join('')+'</div>';
  }

  function rankRow(r, i, myId){
    var av = (r.photo && r.photo.length < 150000) ? '<img src="'+r.photo+'">' : '<span>'+esc((r.name||'?').charAt(0))+'</span>';
    return '<div class="gam-rank-row'+(r.id===myId?' me':'')+'">' +
      '<div class="gam-rank-pos">'+(i+1)+'</div>' +
      '<div class="gam-rank-av">'+av+'</div>' +
      '<div class="gam-rank-info"><strong>'+esc(r.name)+'</strong><span>'+esc(r.area)+'</span></div>' +
      '<div class="gam-rank-mini"><span>'+r.courses+' cursos</span><span>'+r.hours+' hrs</span><span>'+r.badges+' insignias</span></div>' +
      '<div class="gam-rank-xp">'+r.xp.toLocaleString('es-MX')+' XP</div>' +
    '</div>';
  }

  function renderRankingGeneral(rows, myId){
    var el = document.getElementById('gam-ranking-general'); if(!el) return;
    var top = rows.slice(0,10);
    el.innerHTML = top.map(function(r,i){ return rankRow(r,i,myId); }).join('') || '<p class="gam-empty">Aun no hay datos de colaboradores.</p>';
  }

  // Ranking por area: las areas se derivan de los usuarios reales (dinamico),
  // y se complementan con las areas oficiales del formulario de registro
  // aunque aun no tengan colaboradores, para que el mapa quede completo.
  function renderRankingArea(rows, myId){
    var wrap = document.getElementById('gam-ranking-area'); if(!wrap) return;
    var areas = [];
    for(var a=0;a<rows.length;a++){ if(rows[a].area && areas.indexOf(rows[a].area)===-1) areas.push(rows[a].area); }
    AREAS.forEach(function(ar){ if(areas.indexOf(ar)===-1) areas.push(ar); });
    var tabsHtml = '<div class="gam-area-tabs">';
    for(var i=0;i<areas.length;i++){ tabsHtml += '<button class="gam-area-tab'+(i===0?' on':'')+'" data-area="'+esc(areas[i])+'">'+esc(areas[i])+'</button>'; }
    tabsHtml += '</div><div class="gam-area-list" id="gam-area-list"></div>';
    wrap.innerHTML = tabsHtml;
    function showArea(area){
      var filtered = rows.filter(function(r){ return r.area === area; });
      var list = document.getElementById('gam-area-list');
      list.innerHTML = filtered.map(function(r,i){ return rankRow(r,i,myId); }).join('') || '<p class="gam-empty">Sin colaboradores registrados en esta area todavia.</p>';
    }
    wrap.querySelectorAll('.gam-area-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        wrap.querySelectorAll('.gam-area-tab').forEach(function(b2){ b2.classList.remove('on'); });
        this.classList.add('on');
        showArea(this.getAttribute('data-area'));
      });
    });
    if(areas.length) showArea(areas[0]);
  }

  function renderRewards(ctx){
    var el = document.getElementById('gam-rewards'); if(!el) return;
    var html = '';
    for(var i=0;i<REWARDS.length;i++){
      var r = REWARDS[i];
      var reached = ctx.xp >= r.xp;
      var pct = Math.min(100, Math.round((ctx.xp/r.xp)*100));
      html += '<div class="gam-reward'+(reached?' unlocked':'')+'">' +
        '<div class="gam-reward-ico">'+r.icon+'</div>' +
        '<div class="gam-reward-body"><strong>'+esc(r.name)+'</strong><span>'+r.xp.toLocaleString('es-MX')+' XP</span>' + bar(pct,'sm') + '</div>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  function renderPaths(list){
    var el = document.getElementById('gam-paths'); if(!el) return;
    var html = '';
    for(var i=0;i<list.length;i++){
      var p = list[i];
      var stepsHtml = '';
      for(var j=0;j<p.steps.length;j++){
        var s = p.steps[j];
        var pending = s.id.indexOf('_pending_')===0;
        var stepDone = !pending && p.done.indexOf(s.id)!==-1;
        stepsHtml += '<div class="gam-path-step'+(stepDone?' done':'')+(pending?' pending':'')+'">' +
          '<span class="gam-path-dot">'+(stepDone?'\u2713':(pending?'\u2026':'\u25cb'))+'</span>' +
          '<span>'+esc(s.label)+(pending?' (Proximamente)':'')+'</span>' +
        '</div>';
      }
      html += '<div class="gam-path'+(p.complete?' complete':'')+'">' +
        '<div class="gam-path-head"><span class="gam-path-ico">'+p.icon+'</span><div><h4>'+esc(p.name)+'</h4><span>'+p.doneCount+'/'+p.totalCount+' completados \u00b7 '+p.pct+'%</span></div></div>' +
        bar(p.pct) +
        '<div class="gam-path-steps">'+stepsHtml+'</div>' +
        '<div class="gam-path-foot">'+(p.complete ? ('\ud83c\udfc6 Insignia obtenida: '+esc(p.badge)) : ('\ud83c\udfc6 Insignia al completar: '+esc(p.badge)))+'</div>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  function renderNotifications(ctx, badges){
    var el = document.getElementById('gam-notifications'); if(!el) return;
    var items = [];
    for(var cid in ctx.prog){
      var p = ctx.prog[cid];
      if(p && p.status==='completed'){
        var c = COURSES.find(function(x){ return x.id===cid; });
        items.push({ date:p.date||'', text:'Completaste el curso ' + (c?c.full:cid), icon:'\ud83c\udf93' });
      }
    }
    var unlockedBadges = badges.filter(function(b){ return b.unlocked; });
    for(var i=0;i<unlockedBadges.length;i++){ items.push({ date:'', text:'Insignia obtenida: '+unlockedBadges[i].name, icon:'\ud83c\udfc5' }); }
    items.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    items = items.slice(0,8);
    el.innerHTML = items.map(function(it){ return '<div class="gam-notif"><span>'+it.icon+'</span><p>'+esc(it.text)+'</p></div>'; }).join('') || '<p class="gam-empty">Sin notificaciones todavia.</p>';
  }

  function celebrate(title, sub, xpGained){
    var wrap = document.createElement('div');
    wrap.className = 'gam-celebrate-wrap';
    wrap.innerHTML =
      '<div class="gam-celebrate-card">' +
        '<div class="gam-celebrate-emoji">\ud83c\udf89</div>' +
        '<h3>\u00a1Felicidades!</h3>' +
        (xpGained ? '<div class="gam-celebrate-xp">+'+xpGained+' XP</div>' : '') +
        '<div class="gam-celebrate-title">'+esc(title)+'</div>' +
        (sub ? '<div class="gam-celebrate-sub">'+esc(sub)+'</div>' : '') +
      '</div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(function(){ wrap.classList.add('show'); });
    setTimeout(function(){
      wrap.classList.remove('show');
      setTimeout(function(){ wrap.remove(); }, 400);
    }, 3400);
  }

  function checkNewUnlocks(uid, badges, level){
    var key = 'am4_gam_seen_' + uid;
    var seen = null;
    try{ seen = JSON.parse(localStorage.getItem(key)); }catch(e){}
    var isFirstRun = (!localStorage.getItem(key));
    if(!seen){ seen = { badges:[], level:1 }; }
    var unlockedIds = badges.filter(function(b){ return b.unlocked; }).map(function(b){ return b.id; });
    var newBadges = unlockedIds.filter(function(id){ return seen.badges.indexOf(id) === -1; });
    if(!isFirstRun){
      if(level.index > (seen.level||1)){
        celebrate('Subiste a Nivel ' + level.index + ': ' + level.name, 'Sigue aprendiendo para llegar mas lejos.', null);
      } else if(newBadges.length){
        var b = badges.filter(function(x){ return x.id===newBadges[0]; })[0];
        celebrate('Nueva insignia desbloqueada', b ? b.name : '', null);
      }
    }
    seen.badges = unlockedIds; seen.level = level.index;
    localStorage.setItem(key, JSON.stringify(seen));
  }

  async function onRender(){
    if(typeof CU === 'undefined' || !CU || typeof COURSES === 'undefined') return;
    try{
      await awardDailyLoginXP(CU);
      var streak = touchStreak(CU.id);
      var prog = await getProgress(CU.id);
      var ctx = buildContext(CU, prog);
      var badges = computeBadges(ctx);
      var achievements = computeAchievements(ctx);
      var paths = computePaths(ctx);

      renderTeaser(ctx);
      renderUserCard(ctx);
      renderXPBar(ctx);
      renderBadges(badges);
      renderAchievements(achievements);
      renderStreak(streak);
      renderRewards(ctx);
      renderPaths(paths);
      renderNotifications(ctx, badges);

      buildRanking().then(function(rows){
        renderRankingGeneral(rows, CU.id);
        renderRankingArea(rows, CU.id);
      });

      checkNewUnlocks(CU.id, badges, ctx.level);
    }catch(e){ /* nunca romper el resto de la plataforma por un error aqui */ }
  }

    async function getState(){
    if(typeof CU === 'undefined' || !CU || typeof COURSES === 'undefined') return null;
    try{
      var prog = await getProgress(CU.id);
      var ctx = buildContext(CU, prog);
      var badges = computeBadges(ctx);
      var achievements = computeAchievements(ctx);
      var paths = computePaths(ctx);
      var rows = await buildRanking();
      var myIdx = -1;
      for(var i=0;i<rows.length;i++){ if(rows[i].id === CU.id){ myIdx = i; break; } }
      return {
        ctx: ctx,
        badges: badges,
        achievements: achievements,
        paths: paths,
        ranking: rows,
        myRank: (myIdx>=0 ? myIdx+1 : null),
        totalRanked: rows.length
      };
    }catch(e){ return null; }
  }

window.MirageGamification = { onRender: onRender, getState: getState };
})();
