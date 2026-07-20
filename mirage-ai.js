/* ============================================================
   MIRAGE-AI.JS — Widget flotante "Mirage AI"
   ============================================================
   Se auto-inicializa e inyecta su propio boton + panel en
   document.body. NO modifica el Login, Home, Dashboard, nav
   ni goView(): solo LEE/llama funciones ya existentes y
   publicas de la plataforma (goView, openCourse, getProgress,
   CU) y el motor de datos window.MirageAI (mirage-ai-data.js).
   ============================================================ */
(function(){
  'use strict';
  if(window.__mirageAIWidgetInit) return;
  window.__mirageAIWidgetInit = true;

  function ready(fn){
    if(document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var AI = null; // referencia a window.MirageAI, resuelta al inicializar
  var state = {
    open: false,
    tab: 'chat',
    historyLoaded: false,
    freshStart: false,
    notifCount: 0,
    study: null // {type:'flashcards'|'quiz', course, items, idx, score}
  };

  function esc(s){ return AI ? AI.esc(s) : String(s==null?'':s); }
  function getUser(){ try{ return (typeof CU !== 'undefined') ? CU : null; }catch(e){ return null; } }
  function getUserId(){ var u = getUser(); return u ? u.id : null; }
  function courseById(id){
    try{ return (typeof COURSES !== 'undefined') ? (COURSES.find(function(c){ return c.id === id; }) || null) : null; }catch(e){ return null; }
  }

  // ---------------------------------------------------------
  // Construccion del DOM (boton + panel)
  // ---------------------------------------------------------
  function buildRoot(){
    if(document.getElementById('mai-root')) return;
    var root = document.createElement('div');
    root.id = 'mai-root';
    root.innerHTML =
      '<button class="mai-fab" id="mai-fab" title="Mirage AI - Asistente inteligente">' +
        '<span class="mai-fab-pulse" id="mai-fab-pulse"></span>' +
        '<span class="mai-fab-icon">🤖</span>' +
        '<span class="mai-fab-badge" id="mai-fab-badge" style="display:none;">0</span>' +
      '</button>' +
      '<div class="mai-panel" id="mai-panel">' +
        '<div class="mai-header">' +
          '<div class="mai-header-icon">🤖</div>' +
          '<div class="mai-header-txt">' +
            '<div class="mai-header-title">Mirage AI</div>' +
            '<div class="mai-header-sub">Tu asistente de Academia Mirage</div>' +
          '</div>' +
          '<div class="mai-header-actions">' +
            '<button class="mai-header-btn" id="mai-btn-clear" title="Nueva conversacion">🗑️</button>' +
            '<button class="mai-header-btn" id="mai-btn-close" title="Cerrar">✕</button>' +
          '</div>' +
        '</div>' +
        '<div class="mai-tabs">' +
          '<div class="mai-tab mai-active" data-tab="chat">Chat</div>' +
          '<div class="mai-tab" data-tab="notif">Notificaciones<span class="mai-tab-badge" id="mai-notif-badge" style="display:none;">0</span></div>' +
          '<div class="mai-tab" data-tab="study">Estudio</div>' +
        '</div>' +
        '<div class="mai-body" id="mai-body">' +
          '<div id="mai-chat-body"></div>' +
          '<div id="mai-notif-body" style="display:none;"></div>' +
          '<div id="mai-study-body" style="display:none;"></div>' +
        '</div>' +
        '<div class="mai-chips" id="mai-chips"></div>' +
        '<div class="mai-inputbar" id="mai-inputbar">' +
          '<textarea class="mai-input" id="mai-input" rows="1" placeholder="Escribe tu pregunta..."></textarea>' +
          '<button class="mai-send" id="mai-send" title="Enviar">➤</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    wireEvents();
  }

  function wireEvents(){
    document.getElementById('mai-fab').addEventListener('click', togglePanel);
    document.getElementById('mai-btn-close').addEventListener('click', function(){ setOpen(false); });
    document.getElementById('mai-btn-clear').addEventListener('click', clearConversationView);
    document.getElementById('mai-send').addEventListener('click', handleSendClick);
    document.getElementById('mai-input').addEventListener('keydown', function(ev){
      if(ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); handleSendClick(); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('.mai-tab'), function(tabEl){
      tabEl.addEventListener('click', function(){ setTab(tabEl.getAttribute('data-tab')); });
    });
  }

  function togglePanel(){ setOpen(!state.open); }
  function setOpen(v){
    state.open = v;
    var panel = document.getElementById('mai-panel');
    var fab = document.getElementById('mai-fab');
    var pulse = document.getElementById('mai-fab-pulse');
    if(v){
      panel.classList.add('mai-visible');
      fab.classList.add('mai-open');
      fab.querySelector('.mai-fab-icon').textContent = '✕';
      if(pulse) pulse.style.display = 'none';
      if(state.tab === 'chat' && !state.historyLoaded) loadHistory();
      if(state.tab === 'notif') renderNotif();
      refreshBadges();
      setTimeout(function(){ var i = document.getElementById('mai-input'); if(i) i.focus(); }, 150);
    } else {
      panel.classList.remove('mai-visible');
      fab.classList.remove('mai-open');
      fab.querySelector('.mai-fab-icon').textContent = '🤖';
    }
  }

  function setTab(name){
    state.tab = name;
    Array.prototype.forEach.call(document.querySelectorAll('.mai-tab'), function(t){
      t.classList.toggle('mai-active', t.getAttribute('data-tab') === name);
    });
    var chips = document.getElementById('mai-chips');
    var inputbar = document.getElementById('mai-inputbar');
    var chatBody = document.getElementById('mai-chat-body');
    var notifBody = document.getElementById('mai-notif-body');
    var studyBody = document.getElementById('mai-study-body');
    chatBody.style.display = (name === 'chat') ? '' : 'none';
    notifBody.style.display = (name === 'notif') ? '' : 'none';
    studyBody.style.display = (name === 'study') ? '' : 'none';
    if(name === 'chat'){
      chips.style.display = ''; inputbar.style.display = '';
      if(!state.historyLoaded) loadHistory();
    } else {
      chips.style.display = 'none'; inputbar.style.display = 'none';
      if(name === 'notif') renderNotif();
      if(name === 'study') renderStudyMenu();
    }
  }

  // ---------------------------------------------------------
  // Chat: historial, mensajes, chips
  // ---------------------------------------------------------
  async function loadHistory(){
    state.historyLoaded = true;
    var body = document.getElementById('mai-chat-body');
    body.innerHTML = '<div class="mai-empty-state"><div class="mai-empty-icon">🤖</div><div class="mai-empty-title">Cargando...</div></div>';
    var userId = getUserId();
    var hist = [];
    try{ if(userId && AI) hist = await AI.getHistory(userId); }catch(e){}
    body.innerHTML = '';
    if(!hist.length){
      renderEmptyChat();
      renderChips();
      return;
    }
    hist.forEach(function(m){
      if(m.role === 'user') appendUserBubble(m.text, false);
      else appendAssistantBubble({ text: m.text, resources: m.resources || [] }, false);
    });
    document.getElementById('mai-chips').innerHTML = '';
    scrollBottom();
  }

  function renderEmptyChat(){
    var body = document.getElementById('mai-chat-body');
    body.innerHTML =
      '<div class="mai-empty-state">' +
        '<div class="mai-empty-icon">🤖</div>' +
        '<div class="mai-empty-title">¡Hola! Soy Mirage AI</div>' +
        '<div class="mai-empty-sub">Pregúntame sobre tus cursos, la Biblioteca Digital, Learning Friday o tu progreso.</div>' +
      '</div>';
  }

  function renderChips(){
    var chips = document.getElementById('mai-chips');
    if(!AI || !AI.SUGGESTED_CHIPS){ chips.innerHTML = ''; return; }
    chips.innerHTML = AI.SUGGESTED_CHIPS.map(function(c){
      return '<button class="mai-chip">'+esc(c)+'</button>';
    }).join('');
    Array.prototype.forEach.call(chips.querySelectorAll('.mai-chip'), function(btn){
      btn.addEventListener('click', function(){ sendMessage(btn.textContent); });
    });
  }

  function clearConversationView(){
    state.historyLoaded = true;
    document.getElementById('mai-chat-body').innerHTML = '';
    renderEmptyChat();
    renderChips();
  }

  function scrollBottom(){
    var body = document.getElementById('mai-chat-body');
    if(body) body.scrollTop = body.scrollHeight;
  }

  function appendUserBubble(text){
    var body = document.getElementById('mai-chat-body');
    var wrap = document.createElement('div');
    wrap.className = 'mai-msg mai-user';
    wrap.innerHTML = '<div class="mai-bubble">'+esc(text)+'</div>';
    body.appendChild(wrap);
  }

  function appendAssistantBubble(res){
    var body = document.getElementById('mai-chat-body');
    var wrap = document.createElement('div');
    wrap.className = 'mai-msg mai-assistant';
    var html = '<div class="mai-avatar">🤖</div><div style="max-width:100%;">';
    html += '<div class="mai-bubble">'+(res.text||'')+'</div>';
    wrap.innerHTML = html + '</div>';
    body.appendChild(wrap);

    var col = wrap.querySelector('div[style]');
    if(res.suggestedCourses && res.suggestedCourses.length){
      res.suggestedCourses.forEach(function(c){
        var card = document.createElement('div');
        card.className = 'mai-course-card';
        card.innerHTML = '<span class="mai-cc-icon">'+(c.icon||'📘')+'</span><div><div class="mai-cc-name">'+esc(c.name)+'</div><div class="mai-cc-meta">'+esc(c.time||'')+'</div></div>';
        card.addEventListener('click', function(){ if(typeof openCourse === 'function') openCourse(c.id); });
        col.appendChild(card);
      });
    }
    if(res.resources && res.resources.length){
      var pillRow = document.createElement('div');
      pillRow.className = 'mai-resources';
      res.resources.forEach(function(item){
        var pill = document.createElement('button');
        pill.className = 'mai-res-pill';
        pill.textContent = item.label || 'Ver mas';
        pill.addEventListener('click', function(){ handleResourceClick(item, res); });
        pillRow.appendChild(pill);
      });
      col.appendChild(pillRow);
    }
    return wrap;
  }

  function handleResourceClick(item, res){
    if(!item) return;
    if(item.type === 'view'){
      if(typeof goView === 'function') goView(item.view);
    } else if(item.type === 'course'){
      if(typeof openCourse === 'function') openCourse(item.id);
    } else if(item.type === 'flashcards'){
      setTab('study');
      var course = courseById(item.id);
      startFlashcards(res.flashcards || (AI ? AI.generateFlashcards(course) : []), course);
    } else if(item.type === 'quiz'){
      setTab('study');
      var course2 = courseById(item.id);
      startQuiz(res.quiz || (AI ? AI.generateQuiz(course2) : []), course2);
    }
  }

  function showTyping(){
    var body = document.getElementById('mai-chat-body');
    var wrap = document.createElement('div');
    wrap.className = 'mai-msg mai-assistant';
    wrap.id = 'mai-typing-msg';
    wrap.innerHTML = '<div class="mai-avatar">🤖</div><div class="mai-bubble"><span class="mai-typing"><span></span><span></span><span></span></span></div>';
    body.appendChild(wrap);
    scrollBottom();
  }
  function hideTyping(){
    var t = document.getElementById('mai-typing-msg');
    if(t) t.remove();
  }

  function handleSendClick(){
    var input = document.getElementById('mai-input');
    var text = input.value;
    input.value = '';
    sendMessage(text);
  }

  async function sendMessage(text){
    text = (text || '').trim();
    if(!text || !AI) return;
    document.getElementById('mai-chips').innerHTML = '';
    appendUserBubble(text);
    scrollBottom();
    var userId = getUserId();
    if(userId) AI.appendMessage(userId, { role:'user', text:text });
    showTyping();
    var res;
    try{ res = await AI.ask(text); }
    catch(e){ res = { text:'Ocurrió un error al procesar tu mensaje. Intenta de nuevo en un momento.', resources:[] }; }
    hideTyping();
    appendAssistantBubble(res);
    scrollBottom();
    if(userId) AI.appendMessage(userId, { role:'assistant', text: res.text, resources: res.resources || [] });
  }

  // ---------------------------------------------------------
  // Tab de Notificaciones
  // ---------------------------------------------------------
  async function renderNotif(){
    var body = document.getElementById('mai-notif-body');
    body.innerHTML = '<div class="mai-empty-state"><div class="mai-empty-icon">🔔</div><div class="mai-empty-title">Revisando...</div></div>';
    var list = [];
    try{ if(AI) list = await AI.computeNotifications(); }catch(e){}
    if(!list.length){
      body.innerHTML = '<div class="mai-notif-empty">🎉<br>No tienes pendientes urgentes por ahora.</div>';
    } else {
      body.innerHTML = list.map(function(n){
        var icon = n.type === 'curso_pendiente' ? '📌' : (n.type === 'learning_friday' ? '🎤' : '🏁');
        return '<div class="mai-notif mai-level-'+esc(n.level)+'" data-nid="'+esc(n.id)+'">' +
          '<div class="mai-notif-icon">'+icon+'</div>' +
          '<div class="mai-notif-txt">'+esc(n.text)+'</div>' +
        '</div>';
      }).join('');
      Array.prototype.forEach.call(body.querySelectorAll('.mai-notif'), function(elm, idx){
        elm.style.cursor = 'pointer';
        elm.addEventListener('click', function(){
          var n = list[idx];
          if(!n || !n.action) return;
          if(n.action.type === 'course' && typeof openCourse === 'function') openCourse(n.action.id);
          else if(n.action.type === 'view' && typeof goView === 'function') goView(n.action.view);
        });
      });
    }
    updateNotifBadgeCount(list.length);
  }

  function updateNotifBadgeCount(n){
    state.notifCount = n;
    var tabBadge = document.getElementById('mai-notif-badge');
    var fabBadge = document.getElementById('mai-fab-badge');
    if(tabBadge){ tabBadge.textContent = n; tabBadge.style.display = n ? '' : 'none'; }
    if(fabBadge){ fabBadge.textContent = n; fabBadge.style.display = n ? '' : 'none'; }
  }

  async function refreshBadges(){
    if(!AI) return;
    var user = getUser();
    if(!user){ updateNotifBadgeCount(0); return; }
    try{
      var list = await AI.computeNotifications();
      updateNotifBadgeCount(list.length);
    }catch(e){}
  }

  // ---------------------------------------------------------
  // Tab de Estudio (flashcards / cuestionario)
  // ---------------------------------------------------------
  function renderStudyMenu(){
    var body = document.getElementById('mai-study-body');
    var courses = [];
    try{ courses = (typeof COURSES !== 'undefined') ? COURSES : []; }catch(e){}
    var currentCourse = null;
    try{ currentCourse = AI ? (typeof CCV !== 'undefined' && CCV ? courseById(CCV) : null) : null; }catch(e){}
    var options = courses.map(function(c){
      var sel = (currentCourse && currentCourse.id === c.id) ? ' selected' : '';
      return '<option value="'+esc(c.id)+'"'+sel+'>'+esc(c.name)+'</option>';
    }).join('');
    body.innerHTML =
      '<div class="mai-badge-auto">Generado automáticamente · preliminar</div>' +
      '<select id="mai-study-course" style="width:100%; padding:9px 10px; border:1px solid #ddd; border-radius:10px; font-size:12.5px; margin-bottom:12px;">' + options + '</select>' +
      '<div class="mai-study-menu">' +
        '<div class="mai-study-btn" id="mai-btn-fc"><span class="mai-sb-icon">🗂️</span><span class="mai-sb-label">Flashcards</span></div>' +
        '<div class="mai-study-btn" id="mai-btn-qz"><span class="mai-sb-icon">📝</span><span class="mai-sb-label">Cuestionario</span></div>' +
      '</div>' +
      '<div id="mai-study-area"></div>';
    document.getElementById('mai-btn-fc').addEventListener('click', function(){
      var id = document.getElementById('mai-study-course').value;
      var course = courseById(id);
      startFlashcards(AI ? AI.generateFlashcards(course) : [], course);
    });
    document.getElementById('mai-btn-qz').addEventListener('click', function(){
      var id = document.getElementById('mai-study-course').value;
      var course = courseById(id);
      startQuiz(AI ? AI.generateQuiz(course) : [], course);
    });
  }

  function startFlashcards(cards, course){
    if(!cards || !cards.length){
      document.getElementById('mai-study-area').innerHTML = '<div class="mai-empty-state"><div class="mai-empty-sub">Aún no hay suficiente contenido estructurado para este curso.</div></div>';
      return;
    }
    state.study = { type:'flashcards', course:course, items:cards, idx:0, flipped:false };
    renderFlashcard();
  }

  function renderFlashcard(){
    var s = state.study;
    var area = document.getElementById('mai-study-area');
    if(!area) return;
    var card = s.items[s.idx];
    var showAnswer = s.flipped;
    area.innerHTML =
      '<div class="mai-fc-nav">' +
        '<button class="mai-fc-nav-btn" id="mai-fc-prev"'+(s.idx===0?' disabled':'')+'>‹ Anterior</button>' +
        '<span class="mai-fc-progress">'+(s.idx+1)+' / '+s.items.length+'</span>' +
        '<button class="mai-fc-nav-btn" id="mai-fc-next"'+(s.idx===s.items.length-1?' disabled':'')+'>Siguiente ›</button>' +
      '</div>' +
      '<div class="mai-flashcard" id="mai-fc-card">' +
        '<span class="mai-fc-label">'+(showAnswer?'Respuesta':'Pregunta')+'</span>' +
        '<div class="mai-fc-text">'+esc(showAnswer ? card.a : card.q)+'</div>' +
        '<span class="mai-fc-hint">Toca para '+(showAnswer?'ver la pregunta':'ver la respuesta')+'</span>' +
      '</div>';
    document.getElementById('mai-fc-card').addEventListener('click', function(){ s.flipped = !s.flipped; renderFlashcard(); });
    var prev = document.getElementById('mai-fc-prev');
    var next = document.getElementById('mai-fc-next');
    if(prev) prev.addEventListener('click', function(){ if(s.idx>0){ s.idx--; s.flipped=false; renderFlashcard(); } });
    if(next) next.addEventListener('click', function(){ if(s.idx<s.items.length-1){ s.idx++; s.flipped=false; renderFlashcard(); } });
  }

  function startQuiz(quiz, course){
    if(!quiz || !quiz.length){
      document.getElementById('mai-study-area').innerHTML = '<div class="mai-empty-state"><div class="mai-empty-sub">Aún no hay suficiente contenido estructurado para generar un cuestionario de este curso.</div></div>';
      return;
    }
    state.study = { type:'quiz', course:course, items:quiz, idx:0, score:0, answered:false };
    renderQuizQuestion();
  }

  function renderQuizQuestion(){
    var s = state.study;
    var area = document.getElementById('mai-study-area');
    if(!area) return;
    var q = s.items[s.idx];
    area.innerHTML =
      '<div class="mai-fc-progress" style="margin-bottom:8px;">Pregunta '+(s.idx+1)+' / '+s.items.length+' · Aciertos: '+s.score+'</div>' +
      '<div class="mai-quiz-q">'+esc(q.q)+'</div>' +
      '<div id="mai-quiz-options">' +
        q.options.map(function(o,i){ return '<button class="mai-quiz-option" data-i="'+i+'">'+esc(o)+'</button>'; }).join('') +
      '</div>' +
      '<div id="mai-quiz-explain"></div>' +
      '<div style="margin-top:10px; text-align:right;"><button class="mai-fc-nav-btn" id="mai-quiz-next" style="display:none;">'+(s.idx<s.items.length-1?'Siguiente pregunta ›':'Ver resultado')+'</button></div>';
    Array.prototype.forEach.call(area.querySelectorAll('.mai-quiz-option'), function(btn){
      btn.addEventListener('click', function(){
        if(s.answered) return;
        s.answered = true;
        var chosen = q.options[parseInt(btn.getAttribute('data-i'),10)];
        var correct = chosen === q.answer;
        if(correct) s.score++;
        Array.prototype.forEach.call(area.querySelectorAll('.mai-quiz-option'), function(b2){
          var txt = q.options[parseInt(b2.getAttribute('data-i'),10)];
          if(txt === q.answer) b2.classList.add('mai-correct');
          else if(b2 === btn) b2.classList.add('mai-wrong');
        });
        var explainTxt = AI ? AI.explainWrongAnswer(s.course, q, chosen) : '';
        document.getElementById('mai-quiz-explain').innerHTML = '<div class="mai-quiz-explain">'+esc(explainTxt)+'</div>';
        var nextBtn = document.getElementById('mai-quiz-next');
        nextBtn.style.display = '';
        nextBtn.addEventListener('click', function(){
          if(s.idx < s.items.length - 1){
            s.idx++; s.answered = false; renderQuizQuestion();
          } else {
            renderQuizResult();
          }
        });
      });
    });
  }

  function renderQuizResult(){
    var s = state.study;
    var area = document.getElementById('mai-study-area');
    var pct = Math.round((s.score / s.items.length) * 100);
    area.innerHTML =
      '<div class="mai-empty-state">' +
        '<div class="mai-empty-icon">'+(pct>=70?'🎉':'📚')+'</div>' +
        '<div class="mai-empty-title">Obtuviste '+s.score+' / '+s.items.length+' ('+pct+'%)</div>' +
        '<div class="mai-empty-sub">Cuestionario preliminar generado automáticamente; no sustituye la evaluación oficial del curso.</div>' +
      '</div>' +
      '<div style="text-align:center;"><button class="mai-fc-nav-btn" id="mai-quiz-restart">Intentar de nuevo</button></div>';
    document.getElementById('mai-quiz-restart').addEventListener('click', function(){ startQuiz(s.items, s.course); });
  }

  // ---------------------------------------------------------
  // Inicializacion
  // ---------------------------------------------------------
  function waitForAIData(cb, tries){
    tries = tries || 0;
    if(window.MirageAI){ AI = window.MirageAI; cb(); return; }
    if(tries > 40) return; // ~10s, se rinde silenciosamente
    setTimeout(function(){ waitForAIData(cb, tries+1); }, 250);
  }

  function init(){
    buildRoot();
    waitForAIData(function(){
      refreshBadges();
      setInterval(refreshBadges, 5*60*1000);
    });
  }

  ready(init);
})();
