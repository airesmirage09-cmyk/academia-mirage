(function(){
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Datos adicionales para el panel hover (instructor, objetivos, competencias, insignia).
  // No existen aun en COURSES; se definen aqui de forma aislada para no tocar el arreglo original.
  // Los objetivos/competencias se redactaron a partir de la descripcion real de cada curso.
  var CARD_EXTRA = {
    induccion_sst: {
      instructor: 'Equipo de Capacitacion Mirage',
      objectives: ['Identificar riesgos y condiciones inseguras', 'Usar correctamente el equipo de proteccion personal (EPP)', 'Actuar de forma adecuada ante emergencias'],
      skills: ['Prevencion de riesgos', 'Uso de EPP', 'Respuesta a emergencias']
    },
    '5s_seguridad': {
      instructor: 'Equipo de Capacitacion Mirage',
      objectives: ['Aplicar Seleccionar, Ordenar, Limpiar, Estandarizar y Disciplina', 'Usar tarjetas de inspeccion para dar seguimiento', 'Enfocar la metodologia 5S hacia la seguridad'],
      skills: ['Orden y limpieza', 'Estandarizacion', 'Disciplina operativa']
    },
    safestart: {
      instructor: 'Equipo de Capacitacion Mirage',
      objectives: ['Reconocer los estados de riesgo: fatiga, distraccion, prisa y frustracion', 'Identificar errores criticos antes de que ocurran', 'Aplicar tecnicas de auto-monitoreo'],
      skills: ['Autocuidado', 'Percepcion de riesgo', 'Auto-monitoreo']
    },
    ciberseguridad: {
      instructor: 'Equipo de Capacitacion Mirage',
      objectives: ['Crear y usar contrasenas seguras', 'Detectar intentos de phishing', 'Proteger datos personales en el entorno laboral'],
      skills: ['Seguridad de la informacion', 'Deteccion de amenazas', 'Proteccion de datos']
    },
    cultura_legalidad: {
      instructor: 'Equipo de Capacitacion Mirage',
      objectives: ['Identificar y evitar conflictos de interes', 'Actuar con anticorrupcion y transparencia', 'Cuidar la confidencialidad y el uso adecuado de recursos'],
      skills: ['Etica e integridad', 'Cumplimiento normativo', 'Valores 5C Mirage'],
      badge: 'Nuevo'
    }
  };

  // Redefine mkCard con el diseno premium. Se carga despues del script principal,
  // por lo que esta version reemplaza a la original sin tocar el archivo base.
  // Firma y valor de retorno identicos: mkCard(c, prog) -> HTMLElement .cc
  window.mkCard = function(c, prog){
    var p = prog[c.id] || {};
    var st = p.status || 'not_started';
    var pct = p.pct || 0;
    var extra = CARD_EXTRA[c.id] || {};
    var instructor = extra.instructor || 'Equipo de Capacitacion Mirage';
    var objectives = extra.objectives || [];
    var skills = extra.skills || [];
    var badge = extra.badge || '';
    var modsDone = Math.round((pct/100) * (c.mods||0));

    var stLabel = st==='completed' ? 'Completado' : st==='in_progress' ? 'En progreso' : 'Sin iniciar';
    var btnIcon = st==='completed' ? '\u21bb' : '\u25b6';
    var btnLabel = st==='completed' ? 'Revisar curso' : st==='in_progress' ? 'Continuar curso' : 'Iniciar curso';

    var el = document.createElement('div');
    el.className = 'cc cc-v2';

    var thumb = (typeof THUMBS !== 'undefined' && THUMBS[c.id]) ? THUMBS[c.id] : '';

    var html = '';
    if(badge){ html += '<span class="ccv2-badge-top">'+esc(badge)+'</span>'; }
    html += '<div class="ccv2-media">';
    html += '<img class="ccv2-img" src="'+thumb+'" alt="'+esc(c.full)+'" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.style.background=\''+(c.bg||'#111')+'\';">';
    html += '<div class="ccv2-media-grad"></div>';
    html += '<span class="ccv2-status ccv2-status-'+st+'">'+stLabel+'</span>';
    html += '<div class="ccv2-chips"><span class="ccv2-chip">'+esc(c.tag)+'</span>';
    if(c.req){ html += '<span class="ccv2-chip ccv2-chip-req">Obligatorio</span>'; }
    html += '<span class="ccv2-chip">'+esc(c.level)+'</span></div>';
    html += '</div>';
    html += '<div class="ccv2-body">';
    html += '<h3 class="ccv2-title">'+esc(c.full)+'</h3>';
    html += '<p class="ccv2-desc">'+esc(c.desc)+'</p>';
    html += '<div class="ccv2-meta"><span>\u23f1 '+esc(c.time)+'</span><span>\ud83d\udce6 '+c.mods+' m\u00f3d.</span><span>\ud83c\udf93 '+esc(c.level)+'</span></div>';
    if(st !== 'not_started'){
      html += '<div class="ccv2-progress"><div class="ccv2-progress-top"><span>'+pct+'%</span><span>'+modsDone+' de '+c.mods+' m\u00f3dulos</span></div><div class="ccv2-progress-bar"><div class="ccv2-progress-fill" data-pct="'+pct+'"></div></div></div>';
    }
    html += '<button class="ccv2-btn-main" onclick="openCourse(\''+c.id+'\')">'+btnIcon+' '+btnLabel+'</button>';
    html += '<div class="ccv2-actions">';
    if(st==='completed'){ html += '<button class="ccv2-act" onclick="showConstancia(\''+c.id+'\')">\ud83c\udfc6 Certificado</button>'; }
    html += '<button class="ccv2-act" onclick="openCourse(\''+c.id+'\')">\ud83d\udcc4 Temario</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="ccv2-hover"><div class="ccv2-hover-inner">';
    if(objectives.length){
      html += '<h4>\ud83c\udfaf Lo que aprender\u00e1s</h4><ul>';
      for(var i=0;i<objectives.length;i++){ html += '<li>'+esc(objectives[i])+'</li>'; }
      html += '</ul>';
    }
    if(skills.length){
      html += '<h4>\ud83d\udcda Competencias</h4><div class="ccv2-skills">';
      for(var j=0;j<skills.length;j++){ html += '<span>'+esc(skills[j])+'</span>'; }
      html += '</div>';
    }
    html += '<div class="ccv2-hover-foot"><span>\ud83d\udc68\u200d\ud83c\udfeb '+esc(instructor)+'</span><span>\u23f1 '+esc(c.time)+'</span></div>';
    html += '<button class="ccv2-btn-main" onclick="openCourse(\''+c.id+'\')">'+btnIcon+' '+btnLabel+'</button>';
    html += '</div></div>';

    el.innerHTML = html;

    var fill = el.querySelector('.ccv2-progress-fill');
    if(fill){
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ fill.style.width = fill.getAttribute('data-pct') + '%'; });
      });
    }
    return el;
  };
})();
