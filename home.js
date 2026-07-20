(function(){
  var carouselTimer = null;
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
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
  function renderKPIs(data){
    var el = document.getElementById('wbStats'); if(!el) return;
    var horas = estimateHours(data.prog||{});
    el.innerHTML = '<div class="dh-kpi"><div class="kn">'+data.inP+'</div><div class="kl" style="color:rgba(255,255,255,.8);">Cursos en progreso</div></div>' + '<div class="dh-kpi"><div class="kn">'+horas+'</div><div class="kl" style="color:rgba(255,255,255,.8);">Horas aprendidas</div></div>' + '<div class="dh-kpi"><div class="kn">'+data.done+'</div><div class="kl" style="color:rgba(255,255,255,.8);">Certificados</div></div>' + '<div class="dh-kpi"><div class="kn">'+data.pct+'%</div><div class="kl" style="color:rgba(255,255,255,.8);">Promedio</div></div>';
  }
  function renderFeatured(){
    var el = document.getElementById('mh-featured'); if(!el || typeof COURSES === 'undefined') return;
    var list = COURSES; if(!list.length) return;
    var slidesHtml=''; var dotsHtml='';
    for(var i=0;i<list.length;i++){
      var c=list[i];
      var img=(typeof THUMBS!=='undefined' && THUMBS[c.id])?THUMBS[c.id]:'';
      var bgStyle= img? 'background-image:url('+img+');' : 'background-color:'+(c.bg||'#111')+';';
      slidesHtml += '<div class="mh-feat-slide'+(i===0?' active':'')+'" data-idx="'+i+'" style="'+bgStyle+'">' + '<div class="mh-feat-body">' + '<span class="mh-feat-tag">Curso destacado</span>' + '<h2>'+esc(c.full||c.name)+'</h2>' + '<p>'+esc(c.desc||'')+'</p>' + '<button class="mh-feat-btn" data-course="'+esc(c.id)+'">Iniciar Curso</button>' + '</div></div>';
      dotsHtml += '<button class="mh-feat-dot'+(i===0?' active':'')+'" data-idx="'+i+'" aria-label="Curso '+(i+1)+'"></button>';
    }
    var extra=[
      {title:'Política de Calidad', img:'Banner politica de calidad.png'},
      {title:'Misión de Mirage', img:'Banner mision mirage.png'},
      {title:'Visión de Mirage', img:'Banner vision mirage.png'}
    ];
    for(var e=0;e<extra.length;e++){
      var idxE=list.length+e; var it=extra[e];
      slidesHtml += '<div class="mh-feat-slide mh-feat-slide-plain" data-idx="'+idxE+'" style="background-image:url(\''+it.img+'\');" title="'+esc(it.title)+'"></div>';
      dotsHtml += '<button class="mh-feat-dot" data-idx="'+idxE+'" aria-label="'+esc(it.title)+'"></button>';
    }
    el.innerHTML = slidesHtml + '<div class="mh-feat-dots">'+dotsHtml+'</div>';
    var idx=0;
    function goTo(n){
      var slides=el.querySelectorAll('.mh-feat-slide'); var dots=el.querySelectorAll('.mh-feat-dot');
      idx = n % slides.length;
      for(var k=0;k<slides.length;k++) slides[k].classList.toggle('active', k===idx);
      for(var k2=0;k2<dots.length;k2++) dots[k2].classList.toggle('active', k2===idx);
    }
    el.querySelectorAll('.mh-feat-dot').forEach(function(d){ d.addEventListener('click', function(){ goTo(parseInt(this.getAttribute('data-idx'),10)); resetTimer(); }); });
    el.querySelectorAll('.mh-feat-btn').forEach(function(b){ b.addEventListener('click', function(){ var cid=this.getAttribute('data-course'); if(typeof openCourse==='function'){ openCourse(cid); } }); });
    function resetTimer(){ if(carouselTimer) clearInterval(carouselTimer); carouselTimer=setInterval(function(){ goTo(idx+1); }, 6000); }
    resetTimer();
  }
  function renderCategories(){
    var el=document.getElementById('mh-categories'); if(!el || typeof COURSES==='undefined') return;
    var icons={'Seguridad':'🦺','Calidad':'🏆','Etica':'⚖️','Ética':'⚖️','Ciberseguridad':'🔐','Liderazgo':'🧭','Desarrollo':'🌱','Tecnologia':'💻','Tecnología':'💻','Operaciones':'⚙️'};
    var counts={}; var order=[];
    for(var i=0;i<COURSES.length;i++){ var tag=COURSES[i].tag||'General'; if(!counts[tag]){counts[tag]=0; order.push(tag);} counts[tag]++; }
    var html='';
    for(var j=0;j<order.length;j++){ var t=order[j]; html += '<div class="mh-cat-card" data-tag="'+esc(t)+'">' + '<span class="mh-cat-ico">'+(icons[t]||'📁')+'</span>' + '<h4>'+esc(t)+'</h4>' + '<p>'+counts[t]+' curso'+(counts[t]===1?'':'s')+'</p>' + '</div>'; }
    el.innerHTML = html;
    el.querySelectorAll('.mh-cat-card').forEach(function(card){ card.addEventListener('click', function(){ var grid=document.getElementById('d-all-grid'); if(grid && grid.scrollIntoView) grid.scrollIntoView({behavior:'smooth', block:'start'}); }); });
  }
  function renderAchievements(data){
    var el=document.getElementById('mh-achievements'); if(!el) return;
    var horas=estimateHours(data.prog||{});
    el.innerHTML = '<div class="mh-ach-card"><div class="mh-ach-num">'+data.done+'</div><div class="mh-ach-lbl">Cursos completados</div></div>' + '<div class="mh-ach-card"><div class="mh-ach-num">'+horas+'</div><div class="mh-ach-lbl">Horas de aprendizaje</div></div>' + '<div class="mh-ach-card"><div class="mh-ach-num">'+data.done+'</div><div class="mh-ach-lbl">Certificados obtenidos</div></div>' + '<div class="mh-ach-card"><div class="mh-ach-num">'+(data.xp||0)+'</div><div class="mh-ach-lbl">XP acumulado</div></div>';
  }
  function renderNews(){
    var el=document.getElementById('mh-news'); if(!el) return;
    var items=[{icon:'🆕', text:'Nuevo curso disponible — Ya está activo el curso de Cultura de la Legalidad.'}];
    var html='<h3>📰 Noticias Mirage</h3>';
    for(var i=0;i<items.length;i++){ html += '<div class="mh-news-item"><span class="mh-news-ico">'+items[i].icon+'</span><p>'+esc(items[i].text)+'</p></div>'; }
    el.innerHTML = '<div class="mh-panel">'+html+'</div>';
  }
  function renderCalendar(){
    var el=document.getElementById('mh-calendar'); if(!el) return;
    var items=[{day:'31', mon:'JUL', text:'Learning Friday'}];
    var html='<h3>📅 Próximas fechas</h3>';
    for(var i=0;i<items.length;i++){ html += '<div class="mh-cal-item"><div class="mh-cal-date">'+items[i].day+'<small>'+items[i].mon+'</small></div><p>'+esc(items[i].text)+'</p></div>'; }
    el.innerHTML = '<div class="mh-panel">'+html+'</div>';
  }
  function renderFooter(){
    var el=document.getElementById('mh-footer'); if(!el) return;
    el.innerHTML = '<div>Academia Mirage &middot; Versión 1.0</div>' + '<div class="mh-footer-links">' + '<a href="mailto:capacitacion@mirage.com">Contacto RH</a>' + '<a href="#">Políticas</a>' + '<a href="#">Privacidad</a>' + '</div>';
  }
  function setupAnimations(){
    var els=document.querySelectorAll('.mh-animate');
    if(!('IntersectionObserver' in window)){ els.forEach(function(e){e.classList.add('in-view');}); return; }
    var obs=new IntersectionObserver(function(entries){ entries.forEach(function(entry){ if(entry.isIntersecting){ entry.target.classList.add('in-view'); obs.unobserve(entry.target); } }); }, {threshold:0.12});
    els.forEach(function(e){ obs.observe(e); });
  }
  function init(data){
    data = data || {};
    renderKPIs(data); renderFeatured(); renderCategories(); renderAchievements(data); renderNews(); renderCalendar(); renderFooter();
    setTimeout(setupAnimations, 30);
  }
  window.MirageHomeExtras = { init: init, estimateHours: estimateHours };
})();
