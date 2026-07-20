/* ============================================================================
   KNOWLEDGE.JS — Render e interaccion del Centro de Conocimiento
   Consume window.MirageKnowledge (knowledge-data.js). No modifica Login,
   Home, Dashboard del colaborador ni Dashboard de RH.
============================================================================ */
(function(){

  function esc(s){ return window.MirageKnowledge ? window.MirageKnowledge.esc(s) : String(s==null?'':s); }
  function el(id){ return document.getElementById(id); }
  function set(id, html){ var e = el(id); if(e) e.innerHTML = html; }
  function isAdmin(){ return typeof CU !== 'undefined' && CU && CU.role === 'admin'; }

  var STATE = { data:null, sub:'biblioteca', filters:{ category:null, area:null, obligatorio:false, favoritos:false, sort:null }, query:'' };

  /* ---------------- Helpers de UI ---------------- */

  function fmtDate(iso){
    if(!iso) return '';
    var d = new Date(iso); if(isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
  }
  function fmtTimeAgo(iso){
    if(!iso) return '';
    var days = Math.floor((Date.now()-new Date(iso).getTime())/(1000*60*60*24));
    if(days<=0) return 'hoy';
    if(days===1) return 'hace 1 dia';
    return 'hace '+days+' dias';
  }
  function catInfo(catId){
    var c = (window.MirageKnowledge.CATS||[]).filter(function(x){return x.id===catId;})[0];
    return c || { id:catId, name:catId||'General', icon:'📄' };
  }

  function docCard(doc, userState){
    var ci = catInfo(doc.category);
    var isFav = userState && userState.favorites && userState.favorites.indexOf(doc.id)!==-1;
    return '' +
      '<div class="kc-doc-card" data-doc="'+esc(doc.id)+'">' +
        '<div class="kc-doc-thumb">'+(doc.obligatorio?'<span class="kc-doc-badge">Obligatorio</span>':'')+ci.icon+'</div>' +
        '<div class="kc-doc-body">' +
          '<div class="kc-doc-cat">'+esc(ci.name)+'</div>' +
          '<div class="kc-doc-title">'+esc(doc.title)+'</div>' +
          '<div class="kc-doc-meta"><span>'+esc(doc.author||'Academia Mirage')+'</span><span>&middot;</span><span>'+fmtDate(doc.createdAt)+'</span><span>&middot;</span><span>'+(doc.views||0)+' vistas</span></div>' +
          (doc.estMinutes ? '<div class="kc-doc-meta"><span>⏱️ '+doc.estMinutes+' min de lectura</span></div>' : '') +
          '<div class="kc-doc-actions">' +
            '<button class="act-view">Ver</button>' +
            '<button class="act-dl">Descargar</button>' +
            '<button class="act-fav '+(isFav?'on':'')+'">'+(isFav?'★ Favorito':'☆ Favorito')+'</button>' +
            '<button class="act-share">Compartir</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function docGrid(docs, userState, emptyMsg){
    if(!docs.length) return emptyState('📭', 'Sin documentos', emptyMsg||'Aun no hay documentos publicados en esta seccion.');
    return '<div class="kc-doc-grid">' + docs.map(function(d){ return docCard(d, userState); }).join('') + '</div>';
  }
  function docHScroll(docs, userState, emptyMsg){
    if(!docs.length) return emptyState('📭', 'Sin contenido', emptyMsg||'Aun no hay elementos aqui.');
    return '<div class="kc-hscroll">' + docs.map(function(d){ return docCard(d, userState); }).join('') + '</div>';
  }

  function emptyState(icon, title, desc){
    return '<div class="kc-empty"><div class="kc-empty-icon">'+icon+'</div><b>'+esc(title)+'</b><div>'+esc(desc)+'</div></div>';
  }

  function speakerAvatar(sp, size){
    if(sp && sp.photo && sp.photo.length < 150000){ return '<img src="'+sp.photo+'">'; }
    return esc((sp&&sp.name?sp.name:'?').charAt(0));
  }

  function sessionCard(sess, speakers, evalsAvg){
    var sp = speakers.filter(function(s){return s.id===sess.speakerId;})[0] || {name:'Ponente por confirmar'};
    var isPast = new Date(sess.dateISO).getTime() < Date.now();
    return '' +
      '<div class="kc-session-card" data-session="'+esc(sess.id)+'">' +
        '<div class="kc-session-top">' +
          '<div class="kc-speaker-avatar">'+speakerAvatar(sp)+'</div>' +
          '<div><div class="kc-session-title">'+esc(sess.title)+'</div><div class="kc-session-meta">'+esc(sp.name)+' &middot; '+fmtDate(sess.dateISO)+'</div></div>' +
        '</div>' +
        '<div class="kc-session-meta">'+(sess.durationMin?sess.durationMin+' min &middot; ':'')+esc(sess.modality||'Virtual')+(evalsAvg?' &middot; ★ '+evalsAvg:'')+'</div>' +
        '<div class="kc-session-actions">' +
          (isPast ?
            ('<button class="act-record">Ver grabacion</button><button class="act-material">Descargar material</button><button class="act-eval">Evaluar sesion</button>') :
            ('<button class="act-register primary">Inscribirme</button>')
          ) +
        '</div>' +
      '</div>';
  }

  function speakerCard(sp, sessionCount){
    return '' +
      '<div class="kc-speaker-card">' +
        '<div class="kc-speaker-photo">'+speakerAvatar(sp)+'</div>' +
        '<h4>'+esc(sp.name)+'</h4>' +
        '<span>'+esc(sp.role||'')+(sp.company?' &middot; '+esc(sp.company):'')+'</span>' +
        '<span>'+esc(sp.specialty||'')+'</span>' +
        (sp.bio ? '<div class="kc-speaker-bio">'+esc(sp.bio)+'</div>' : '') +
        '<div class="kc-doc-meta" style="justify-content:center;margin-top:8px;">'+sessionCount+' sesion(es) impartida(s)</div>' +
      '</div>';
  }

  /* ---------------- Biblioteca Digital ---------------- */

  function renderCategories(d){
    var html = '<div class="kc-cat-grid">' + d.categories.map(function(c){
      var on = STATE.filters.category===c.id;
      return '<div class="kc-cat-tile '+(on?'on':'')+'" data-cat="'+c.id+'">' +
        '<span class="kc-cat-icon">'+c.icon+'</span>' +
        '<div class="kc-cat-name">'+esc(c.name)+'</div>' +
        '<div class="kc-cat-count">'+(d.categoryCounts[c.id]||0)+' recurso(s)</div>' +
      '</div>';
    }).join('') + '</div>';
    set('kc-categories', html);
  }

  function renderFilters(d){
    var chips = [
      { key:'obligatorio', label:'Obligatorios' },
      { key:'favoritos', label:'Favoritos' },
      { key:'sort:populares', label:'Mas populares' },
      { key:'sort:recientes', label:'Mas recientes' }
    ];
    var areaChips = d.areas.map(function(a){ return { key:'area:'+a, label:a }; });
    var all = chips.concat(areaChips);
    var html = '<div class="kc-filters">' + all.map(function(f){
      var on = false;
      if(f.key==='obligatorio') on = STATE.filters.obligatorio;
      else if(f.key==='favoritos') on = STATE.filters.favoritos;
      else if(f.key.indexOf('sort:')===0) on = STATE.filters.sort===f.key.split(':')[1];
      else if(f.key.indexOf('area:')===0) on = STATE.filters.area===f.key.split(':')[1];
      return '<button class="kc-chip '+(on?'on':'')+'" data-filter="'+f.key+'">'+esc(f.label)+'</button>';
    }).join('') + '</div>';
    set('kc-filters', html);
  }

  function currentResults(d){
    var docs = d.docs;
    docs = window.MirageKnowledge.searchDocs(docs, STATE.query);
    docs = window.MirageKnowledge.filterDocs(docs, STATE.filters, d.userState);
    return docs;
  }

  function renderResults(d){
    set('kc-results-count', currentResults(d).length + ' resultado(s)');
    set('kc-doc-grid', docGrid(currentResults(d), d.userState, 'Ajusta la busqueda o los filtros, o pide a RH que publique contenido en esta categoria.'));
  }

  function renderFeatured(d){
    var html = docHScroll(d.featured, d.userState, 'RH aun no ha destacado ningun recurso. Los documentos marcados como destacados apareceran aqui.');
    set('kc-featured', html);
  }
  function renderNew(d){
    var html = docHScroll(d.newResources, d.userState, 'No hay recursos publicados en los ultimos 14 dias.');
    set('kc-new', html);
  }
  function renderFavorites(d){
    var favDocs = d.docs.filter(function(x){ return d.userState.favorites.indexOf(x.id)!==-1; });
    set('kc-favorites', docHScroll(favDocs, d.userState, 'Aun no has marcado ningun documento como favorito. Usa el boton "Favorito" en cualquier tarjeta.'));
  }
  function renderHistory(d){
    var hist = d.userState.history.map(function(h){
      var doc = d.docs.filter(function(x){return x.id===h.docId;})[0];
      return doc ? Object.assign({}, doc, {_viewedAt:h.date}) : null;
    }).filter(Boolean);
    set('kc-history', docHScroll(hist, d.userState, 'Aun no has visto ningun documento. Tu historial aparecera aqui automaticamente.'));
  }
  function renderRecommended(d){
    set('kc-recommended', docHScroll(d.recommendedDocs, d.userState, 'Explora la biblioteca para recibir recomendaciones personalizadas.'));
  }

  function renderAdminBarBiblioteca(){
    var box = el('kc-admin-bar-bib');
    if(!box) return;
    if(isAdmin()){
      box.innerHTML = '<button class="kc-btn kc-btn-primary" id="kc-btn-new-doc">+ Publicar documento</button>' +
        '<button class="kc-btn kc-btn-ghost" id="kc-btn-feature-doc">⭐ Marcar destacado</button>';
    } else { box.innerHTML=''; }
  }

  async function renderBiblioteca(){
    var d = STATE.data;
    renderAdminBarBiblioteca();
    renderFeatured(d); renderNew(d); renderCategories(d); renderFilters(d); renderResults(d);
    renderFavorites(d); renderHistory(d); renderRecommended(d);
  }

  /* ---------------- Learning Friday ---------------- */

  function renderLFNext(d){
    var next = d.upcoming[0];
    if(!next){ set('kc-lf-next', '<div class="kc-lf-next">'+emptyState('📅','Sin conferencia programada','RH aun no ha programado el proximo Learning Friday.')+'</div>'); return; }
    var sp = d.speakers.filter(function(s){return s.id===next.speakerId;})[0] || {name:'Por confirmar'};
    var html = '<div class="kc-lf-next">' +
      '<span class="kc-lf-next-tag">Proxima conferencia</span>' +
      '<h3>'+esc(next.title)+'</h3>' +
      '<div class="kc-lf-next-row">🎤 '+esc(sp.name)+'</div>' +
      '<div class="kc-lf-next-row">📅 '+fmtDate(next.dateISO)+'</div>' +
      '<div class="kc-lf-next-row">💻 '+esc(next.modality||'Virtual')+'</div>' +
      '<button class="kc-btn kc-btn-primary act-register" data-session="'+esc(next.id)+'" style="width:100%;margin-top:10px;">Inscribirme</button>' +
    '</div>';
    set('kc-lf-next', html);
  }

  function renderLFPast(d){
    var html = d.past.length ?
      '<div class="kc-session-grid">' + d.past.map(function(s){ return sessionCard(s, d.speakers, null); }).join('') + '</div>' :
      emptyState('🎬','Sin sesiones anteriores','Cuando termine el primer Learning Friday, aparecera aqui con grabacion y material.');
    set('kc-lf-past', html);
  }

  function renderLFSpeakers(d){
    var html = d.speakers.length ?
      '<div class="kc-speaker-grid">' + d.speakers.map(function(sp){ return speakerCard(sp, window.MirageKnowledge.sessionsPerSpeaker(d.sessions, sp.id)); }).join('') + '</div>' :
      emptyState('🎤','Sin ponentes registrados','Los ponentes de Learning Friday apareceran aqui.');
    set('kc-lf-speakers', html);
  }

  function renderLFCalendar(d){
    var rows = d.upcoming.map(function(s){
      var dt = new Date(s.dateISO);
      return '<div class="kc-cal-row">' +
        '<div class="kc-cal-date">'+dt.toLocaleDateString('es-MX',{day:'2-digit',month:'short'})+'</div>' +
        '<div><div class="kc-cal-title">'+esc(s.title)+'</div><div class="kc-cal-sub">Learning Friday &middot; '+esc(s.modality||'Virtual')+'</div></div>' +
      '</div>';
    }).join('');
    set('kc-lf-calendar', rows || emptyState('🗓️','Sin eventos proximos','Cursos y certificaciones con fecha propia aun no estan integrados a este calendario.'));
  }

  function renderLFRecommended(d){
    var recs = window.MirageKnowledge.computeRecommendedSessions(d.sessions, CU?CU.id:null, {});
    set('kc-lf-recommended', recs.length ? '<div class="kc-session-grid">'+recs.map(function(s){return sessionCard(s,d.speakers,null);}).join('')+'</div>' : emptyState('🤖','Sin recomendaciones','Aun no hay suficientes sesiones para recomendarte algo.'));
  }

  function renderAdminBarLF(){
    var box = el('kc-admin-bar-lf');
    if(!box) return;
    if(isAdmin()){
      box.innerHTML = '<button class="kc-btn kc-btn-primary" id="kc-btn-new-session">+ Nueva sesion</button>' +
        '<button class="kc-btn kc-btn-ghost" id="kc-btn-new-speaker">+ Nuevo ponente</button>';
    } else { box.innerHTML=''; }
  }

  async function renderLearning(){
    var d = STATE.data;
    renderAdminBarLF();
    renderLFNext(d); renderLFPast(d); renderLFSpeakers(d); renderLFCalendar(d); renderLFRecommended(d);
  }

  /* ---------------- Modales de administracion ---------------- */

  function openModal(html){
    closeModal();
    var wrap = document.createElement('div');
    wrap.className = 'kc-modal-overlay';
    wrap.id = 'kc-modal-overlay';
    wrap.innerHTML = '<div class="kc-modal">'+html+'</div>';
    wrap.addEventListener('click', function(e){ if(e.target===wrap) closeModal(); });
    document.body.appendChild(wrap);
  }
  function closeModal(){ var m = el('kc-modal-overlay'); if(m) m.remove(); }

  function openNewDocModal(){
    var cats = window.MirageKnowledge.CATS;
    var html = '' +
      '<h3>Publicar documento</h3>' +
      '<div class="kc-field"><label>Titulo</label><input id="kc-f-title" placeholder="Ej. Manual de bienvenida"></div>' +
      '<div class="kc-field-row">' +
        '<div class="kc-field"><label>Categoria</label><select id="kc-f-cat">'+cats.map(function(c){return '<option value="'+c.id+'">'+c.icon+' '+esc(c.name)+'</option>';}).join('')+'</select></div>' +
        '<div class="kc-field"><label>Area</label><input id="kc-f-area" placeholder="Ej. Recursos Humanos"></div>' +
      '</div>' +
      '<div class="kc-field-row">' +
        '<div class="kc-field"><label>Autor</label><input id="kc-f-author" placeholder="Ej. Academia Mirage"></div>' +
        '<div class="kc-field"><label>Tiempo estimado (min)</label><input id="kc-f-mins" type="number" min="0"></div>' +
      '</div>' +
      '<div class="kc-field"><label>Enlace del recurso (Drive, SharePoint, YouTube, etc.)</label><input id="kc-f-url" placeholder="https://..."></div>' +
      '<div class="kc-field"><label>Palabras clave (separadas por coma)</label><input id="kc-f-tags" placeholder="onboarding, seguridad, induccion"></div>' +
      '<label class="kc-check"><input type="checkbox" id="kc-f-oblig"> Marcar como obligatorio</label>' +
      '<label class="kc-check"><input type="checkbox" id="kc-f-feat"> Marcar como contenido destacado</label>' +
      '<div class="kc-modal-actions">' +
        '<button class="kc-btn kc-btn-ghost" id="kc-modal-cancel">Cancelar</button>' +
        '<button class="kc-btn kc-btn-primary" id="kc-modal-save">Publicar</button>' +
      '</div>';
    openModal(html);
    el('kc-modal-cancel').onclick = closeModal;
    el('kc-modal-save').onclick = async function(){
      var title = el('kc-f-title').value.trim();
      if(!title){ el('kc-f-title').focus(); return; }
      var doc = {
        title: title, category: el('kc-f-cat').value, area: el('kc-f-area').value.trim(),
        author: el('kc-f-author').value.trim(), estMinutes: parseInt(el('kc-f-mins').value,10)||0,
        url: el('kc-f-url').value.trim(), tags: el('kc-f-tags').value.split(',').map(function(t){return t.trim();}).filter(Boolean),
        obligatorio: el('kc-f-oblig').checked, featured: el('kc-f-feat').checked
      };
      await window.MirageKnowledge.saveLibraryDoc(doc);
      closeModal();
      await refreshAndRender();
    };
  }

  function openNewSpeakerModal(onDone){
    var html = '' +
      '<h3>Nuevo ponente</h3>' +
      '<div class="kc-field"><label>Nombre</label><input id="kc-f-spname" placeholder="Ej. Ana Torres"></div>' +
      '<div class="kc-field-row">' +
        '<div class="kc-field"><label>Cargo</label><input id="kc-f-sprole" placeholder="Ej. Directora de RH"></div>' +
        '<div class="kc-field"><label>Empresa</label><input id="kc-f-spcompany" placeholder="Ej. Mirage"></div>' +
      '</div>' +
      '<div class="kc-field"><label>Especialidad</label><input id="kc-f-spspec" placeholder="Ej. Liderazgo y cultura organizacional"></div>' +
      '<div class="kc-field"><label>Biografia</label><textarea id="kc-f-spbio"></textarea></div>' +
      '<div class="kc-field"><label>Foto (URL, opcional)</label><input id="kc-f-spphoto" placeholder="https://..."></div>' +
      '<div class="kc-modal-actions">' +
        '<button class="kc-btn kc-btn-ghost" id="kc-modal-cancel">Cancelar</button>' +
        '<button class="kc-btn kc-btn-primary" id="kc-modal-save">Guardar</button>' +
      '</div>';
    openModal(html);
    el('kc-modal-cancel').onclick = closeModal;
    el('kc-modal-save').onclick = async function(){
      var name = el('kc-f-spname').value.trim();
      if(!name){ el('kc-f-spname').focus(); return; }
      var sp = { name:name, role: el('kc-f-sprole').value.trim(), company: el('kc-f-spcompany').value.trim(),
        specialty: el('kc-f-spspec').value.trim(), bio: el('kc-f-spbio').value.trim(), photo: el('kc-f-spphoto').value.trim() };
      var saved = await window.MirageKnowledge.saveLFSpeaker(sp);
      closeModal();
      if(onDone) onDone(saved); else await refreshAndRender();
    };
  }

  function openNewSessionModal(){
    var d = STATE.data;
    function speakerOptions(){
      return '<option value="">Selecciona un ponente...</option>' + d.speakers.map(function(sp){ return '<option value="'+esc(sp.id)+'">'+esc(sp.name)+'</option>'; }).join('');
    }
    var html = '' +
      '<h3>Nueva sesion de Learning Friday</h3>' +
      '<div class="kc-field"><label>Titulo</label><input id="kc-f-lftitle" placeholder="Ej. Comunicacion efectiva en equipos remotos"></div>' +
      '<div class="kc-field-row">' +
        '<div class="kc-field"><label>Ponente</label><select id="kc-f-lfspeaker">'+speakerOptions()+'</select></div>' +
        '<div class="kc-field" style="flex:0 0 auto;align-self:flex-end;"><button class="kc-btn kc-btn-ghost" id="kc-btn-inline-speaker" type="button">+ Nuevo</button></div>' +
      '</div>' +
      '<div class="kc-field-row">' +
        '<div class="kc-field"><label>Fecha y hora</label><input id="kc-f-lfdate" type="datetime-local"></div>' +
        '<div class="kc-field"><label>Duracion (min)</label><input id="kc-f-lfdur" type="number" min="0" value="60"></div>' +
      '</div>' +
      '<div class="kc-field"><label>Modalidad</label><select id="kc-f-lfmod"><option>Virtual</option><option>Presencial</option><option>Hibrida</option></select></div>' +
      '<div class="kc-field"><label>Descripcion</label><textarea id="kc-f-lfdesc"></textarea></div>' +
      '<div class="kc-field-row">' +
        '<div class="kc-field"><label>Liga de grabacion (para sesiones pasadas)</label><input id="kc-f-lfrec" placeholder="https://..."></div>' +
        '<div class="kc-field"><label>Material descargable (URL)</label><input id="kc-f-lfmat" placeholder="https://..."></div>' +
      '</div>' +
      '<div class="kc-modal-actions">' +
        '<button class="kc-btn kc-btn-ghost" id="kc-modal-cancel">Cancelar</button>' +
        '<button class="kc-btn kc-btn-primary" id="kc-modal-save">Programar</button>' +
      '</div>';
    openModal(html);
    el('kc-modal-cancel').onclick = closeModal;
    el('kc-btn-inline-speaker').onclick = function(){
      openNewSpeakerModal(function(){ openNewSessionModal(); });
    };
    el('kc-modal-save').onclick = async function(){
      var title = el('kc-f-lftitle').value.trim();
      var dateVal = el('kc-f-lfdate').value;
      if(!title || !dateVal){ return; }
      var sess = {
        title: title, speakerId: el('kc-f-lfspeaker').value, dateISO: new Date(dateVal).toISOString(),
        durationMin: parseInt(el('kc-f-lfdur').value,10)||60, modality: el('kc-f-lfmod').value,
        description: el('kc-f-lfdesc').value.trim(), recordingUrl: el('kc-f-lfrec').value.trim(),
        materials: el('kc-f-lfmat').value.trim() ? [{ name:'Material de la sesion', url: el('kc-f-lfmat').value.trim() }] : []
      };
      await window.MirageKnowledge.saveLFSession(sess);
      closeModal();
      await refreshAndRender();
    };
  }

  function openEvalModal(sessionId){
    var rating = 0;
    var html = '' +
      '<h3>Evaluar sesion</h3>' +
      '<div class="kc-field"><label>Calificacion</label><div class="kc-stars" id="kc-stars">' +
        [1,2,3,4,5].map(function(n){ return '<span data-n="'+n+'">★</span>'; }).join('') +
      '</div></div>' +
      '<div class="kc-field"><label>Comentarios (opcional)</label><textarea id="kc-f-comment"></textarea></div>' +
      '<div class="kc-modal-actions">' +
        '<button class="kc-btn kc-btn-ghost" id="kc-modal-cancel">Cancelar</button>' +
        '<button class="kc-btn kc-btn-primary" id="kc-modal-save">Enviar evaluacion</button>' +
      '</div>';
    openModal(html);
    var starsBox = el('kc-stars');
    starsBox.querySelectorAll('span').forEach(function(s){
      s.onclick = function(){
        rating = parseInt(s.getAttribute('data-n'),10);
        starsBox.querySelectorAll('span').forEach(function(x){ x.classList.toggle('on', parseInt(x.getAttribute('data-n'),10)<=rating); });
      };
    });
    el('kc-modal-cancel').onclick = closeModal;
    el('kc-modal-save').onclick = async function(){
      if(!rating) return;
      await window.MirageKnowledge.submitEvaluation(CU.id, sessionId, rating, el('kc-f-comment').value.trim());
      closeModal();
    };
  }

  /* ---------------- Wiring de eventos ---------------- */

  function findDocId(target){ var card = target.closest ? target.closest('.kc-doc-card') : null; return card ? card.getAttribute('data-doc') : null; }
  function findSessionId(target){ var card = target.closest ? target.closest('.kc-session-card, [data-session]') : null; return card ? card.getAttribute('data-session') : null; }

  async function handleDocAction(e){
    var t = e.target;
    var docId = findDocId(t);
    if(!docId) return;
    var d = STATE.data;
    var doc = d.docs.filter(function(x){return x.id===docId;})[0];
    if(!doc) return;
    if(t.classList.contains('act-view')){
      await window.MirageKnowledge.registerView(docId);
      if(CU) await window.MirageKnowledge.addHistory(CU.id, docId);
      if(doc.url) window.open(doc.url, '_blank');
      await refreshAndRender();
    } else if(t.classList.contains('act-dl')){
      if(doc.url) window.open(doc.url, '_blank');
    } else if(t.classList.contains('act-fav')){
      if(!CU) return;
      await window.MirageKnowledge.toggleFavorite(CU.id, docId);
      await refreshAndRender();
    } else if(t.classList.contains('act-share')){
      var link = doc.url || window.location.href;
      if(navigator.clipboard){ navigator.clipboard.writeText(link); }
      t.textContent = 'Copiado';
      setTimeout(function(){ t.textContent='Compartir'; }, 1500);
    }
  }

  async function handleSessionAction(e){
    var t = e.target;
    var sessionId = findSessionId(t);
    if(!sessionId) return;
    var d = STATE.data;
    var sess = d.sessions.filter(function(x){return x.id===sessionId;})[0];
    if(!sess) return;
    if(t.classList.contains('act-register')){
      if(!CU) return;
      await window.MirageKnowledge.registerForSession(CU.id, sessionId);
      t.textContent = 'Inscrito ✓';
      t.disabled = true;
    } else if(t.classList.contains('act-record')){
      if(sess.recordingUrl) window.open(sess.recordingUrl, '_blank');
      else alert('Esta sesion aun no tiene grabacion publicada.');
    } else if(t.classList.contains('act-material')){
      var mat = (sess.materials||[])[0];
      if(mat && mat.url) window.open(mat.url, '_blank');
      else alert('Esta sesion aun no tiene material publicado.');
    } else if(t.classList.contains('act-eval')){
      openEvalModal(sessionId);
    }
  }

  function wireStatic(){
    var search = el('kc-search');
    if(search && !search.__wired){
      search.__wired = true;
      search.addEventListener('input', function(){ STATE.query = search.value.trim(); renderResults(STATE.data); });
    }
    var catBox = el('kc-categories');
    if(catBox && !catBox.__wired){
      catBox.__wired = true;
      catBox.addEventListener('click', function(e){
        var tile = e.target.closest ? e.target.closest('.kc-cat-tile') : null; if(!tile) return;
        var cat = tile.getAttribute('data-cat');
        STATE.filters.category = (STATE.filters.category===cat) ? null : cat;
        renderCategories(STATE.data); renderResults(STATE.data);
      });
    }
    var filterBox = el('kc-filters');
    if(filterBox && !filterBox.__wired){
      filterBox.__wired = true;
      filterBox.addEventListener('click', function(e){
        var chip = e.target.closest ? e.target.closest('.kc-chip') : null; if(!chip) return;
        var key = chip.getAttribute('data-filter');
        if(key==='obligatorio') STATE.filters.obligatorio = !STATE.filters.obligatorio;
        else if(key==='favoritos') STATE.filters.favoritos = !STATE.filters.favoritos;
        else if(key.indexOf('sort:')===0){ var v = key.split(':')[1]; STATE.filters.sort = (STATE.filters.sort===v)?null:v; }
        else if(key.indexOf('area:')===0){ var a = key.split(':')[1]; STATE.filters.area = (STATE.filters.area===a)?null:a; }
        renderFilters(STATE.data); renderResults(STATE.data);
      });
    }
    var panels = el('v-knowledge');
    if(panels && !panels.__wiredDocActions){
      panels.__wiredDocActions = true;
      panels.addEventListener('click', function(e){ handleDocAction(e); handleSessionAction(e); });
    }
    var subtabs = el('kc-subtabs');
    if(subtabs && !subtabs.__wired){
      subtabs.__wired = true;
      subtabs.addEventListener('click', function(e){
        var b = e.target.closest ? e.target.closest('.kc-subtab') : null; if(!b) return;
        showSub(b.getAttribute('data-sub'));
      });
    }
  }

  function wireAdminButtons(){
    var b1 = el('kc-btn-new-doc'); if(b1 && !b1.__wired){ b1.__wired=true; b1.onclick = openNewDocModal; }
    var b2 = el('kc-btn-new-session'); if(b2 && !b2.__wired){ b2.__wired=true; b2.onclick = openNewSessionModal; }
    var b3 = el('kc-btn-new-speaker'); if(b3 && !b3.__wired){ b3.__wired=true; b3.onclick = function(){ openNewSpeakerModal(); }; }
  }

  function showSub(sub){
    STATE.sub = sub;
    document.querySelectorAll('.kc-subtab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-sub')===sub); });
    document.querySelectorAll('.kc-section').forEach(function(s){ s.classList.toggle('on', s.getAttribute('data-sub')===sub); });
  }

  async function refreshAndRender(){
    STATE.data = await window.MirageKnowledge.computeAll(CU ? CU.id : null);
    await renderBiblioteca();
    await renderLearning();
    wireAdminButtons();
  }

  async function onRender(){
    if(typeof CU === 'undefined' || !CU) return;
    if(!el('v-knowledge')) return;
    if(!window.MirageKnowledge) return;
    wireStatic();
    showSub(STATE.sub);
    try{ await refreshAndRender(); }catch(e){ /* nunca romper el resto de la plataforma por un error aqui */ }
  }

  window.MirageKC = { onRender: onRender };
})();
