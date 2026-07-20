/* ============================================================================
   KNOWLEDGE-DATA.JS — Capa de datos del Centro de Conocimiento
   (Biblioteca Digital + Learning Friday)
   ----------------------------------------------------------------------------
   Sistema funcional real sobre Firebase (mismos helpers fbGet/fbSet/fbPatch
   que ya usa el resto de la plataforma). Arranca vacio: no hay documentos,
   sesiones ni ponentes de ejemplo. RH/admin publica contenido real desde el
   propio modulo y a partir de ahi todo lo que se muestra es real.

   Nodos Firebase nuevos (no tocan /users ni /progress):
     /library/{docId}          -> documento de la Biblioteca Digital
     /userLibrary/{userId}     -> {favorites:[docId...], history:[{docId,date}...]}
     /lfSessions/{sessionId}   -> sesion de Learning Friday
     /lfSpeakers/{speakerId}   -> ponente
     /lfRegistrations/{sessionId}/{userId} -> {date}
     /lfEvaluations/{sessionId}/{userId}   -> {rating, comment, date}
============================================================================ */
(function(){

  var CATS = [
    { id:'manuales', name:'Manuales', icon:'📚' },
    { id:'procedimientos', name:'Procedimientos', icon:'📑' },
    { id:'politicas', name:'Politicas', icon:'📄' },
    { id:'videos', name:'Videos', icon:'🎥' },
    { id:'podcasts', name:'Podcasts', icon:'🎙' },
    { id:'articulos', name:'Articulos', icon:'📰' },
    { id:'infografias', name:'Infografias', icon:'📊' },
    { id:'formatos', name:'Formatos', icon:'📁' },
    { id:'guias', name:'Guias', icon:'📘' },
    { id:'reglamentos', name:'Reglamentos', icon:'📕' }
  ];

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function nowISO(){ return new Date().toISOString(); }
  function newId(prefix){ return prefix+'_'+Date.now()+'_'+Math.floor(Math.random()*1000); }
  function hasFB(){ return typeof IS_FB === 'function' && IS_FB() && typeof fbGet === 'function' && typeof fbSet === 'function'; }

  // ---- Fallback local (solo si Firebase no esta disponible) ----
  function lsGet(key, def){ try{ var v = localStorage.getItem('am4_know_'+key); return v ? JSON.parse(v) : def; }catch(e){ return def; } }
  function lsSet(key, val){ try{ localStorage.setItem('am4_know_'+key, JSON.stringify(val)); }catch(e){} }

  async function readNode(path, fallbackKey){
    if(hasFB()){ try{ return await fbGet(path); }catch(e){ return null; } }
    return lsGet(fallbackKey, null);
  }
  async function writeNode(path, data, fallbackKey){
    if(hasFB()){ try{ await fbSet(path, data); return; }catch(e){ return; } }
    lsSet(fallbackKey, data);
  }

  /* ---------------- Biblioteca Digital ---------------- */

  async function getLibraryDocs(){
    var d = await readNode('/library', 'library');
    return d ? Object.values(d) : [];
  }

  async function saveLibraryDoc(doc){
    if(!doc.id) doc.id = newId('doc');
    if(!doc.createdAt) doc.createdAt = nowISO();
    if(typeof doc.views !== 'number') doc.views = 0;
    if(hasFB()){ await fbSet('/library/'+doc.id, doc); }
    else{ var all = lsGet('library', {}); all[doc.id] = doc; lsSet('library', all); }
    return doc;
  }

  async function deleteLibraryDoc(id){
    if(hasFB()){ await fbSet('/library/'+id, null); }
    else{ var all = lsGet('library', {}); delete all[id]; lsSet('library', all); }
  }

  async function registerView(docId){
    // Incrementa vistas de forma honesta (lectura+escritura, suficiente para la escala actual)
    if(hasFB()){
      try{
        var doc = await fbGet('/library/'+docId);
        if(doc){ doc.views = (doc.views||0) + 1; await fbSet('/library/'+docId, doc); }
      }catch(e){}
    } else {
      var all = lsGet('library', {});
      if(all[docId]){ all[docId].views = (all[docId].views||0)+1; lsSet('library', all); }
    }
  }

  /* ---------------- Favoritos e Historial (por colaborador) ---------------- */

  async function getUserLibraryState(userId){
    var d = await readNode('/userLibrary/'+userId, 'userLibrary_'+userId);
    return d || { favorites: [], history: [] };
  }
  async function saveUserLibraryState(userId, state){
    await writeNode('/userLibrary/'+userId, state, 'userLibrary_'+userId);
  }
  async function toggleFavorite(userId, docId){
    var st = await getUserLibraryState(userId);
    var idx = st.favorites.indexOf(docId);
    if(idx===-1) st.favorites.push(docId); else st.favorites.splice(idx,1);
    await saveUserLibraryState(userId, st);
    return idx===-1; // true = se agrego, false = se quito
  }
  async function addHistory(userId, docId){
    var st = await getUserLibraryState(userId);
    st.history = st.history.filter(function(h){ return h.docId !== docId; });
    st.history.unshift({ docId: docId, date: nowISO() });
    st.history = st.history.slice(0, 30);
    await saveUserLibraryState(userId, st);
  }

  /* ---------------- Busqueda y filtros ---------------- */

  function searchDocs(docs, query){
    if(!query) return docs;
    var q = query.toLowerCase();
    return docs.filter(function(d){
      return (d.title||'').toLowerCase().indexOf(q)!==-1 ||
             (d.category||'').toLowerCase().indexOf(q)!==-1 ||
             (d.author||'').toLowerCase().indexOf(q)!==-1 ||
             (d.area||'').toLowerCase().indexOf(q)!==-1 ||
             (d.tags||[]).join(' ').toLowerCase().indexOf(q)!==-1;
    });
  }

  function filterDocs(docs, filters, userState){
    var out = docs.slice();
    if(filters.category) out = out.filter(function(d){ return d.category===filters.category; });
    if(filters.area) out = out.filter(function(d){ return d.area===filters.area; });
    if(filters.obligatorio) out = out.filter(function(d){ return !!d.obligatorio; });
    if(filters.favoritos && userState) out = out.filter(function(d){ return userState.favorites.indexOf(d.id)!==-1; });
    if(filters.sort==='populares') out.sort(function(a,b){ return (b.views||0)-(a.views||0); });
    else if(filters.sort==='recientes') out.sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
    return out;
  }

  function computeCategoryCounts(docs){
    var counts = {};
    CATS.forEach(function(c){ counts[c.id]=0; });
    docs.forEach(function(d){ if(counts.hasOwnProperty(d.category)) counts[d.category]++; });
    return counts;
  }

  function computeAreas(docs){
    var set = {};
    docs.forEach(function(d){ if(d.area) set[d.area]=true; });
    return Object.keys(set);
  }

  function computeNewResources(docs, days){
    var cutoff = Date.now() - (days||14)*24*60*60*1000;
    return docs.filter(function(d){ var t = new Date(d.createdAt).getTime(); return !isNaN(t) && t>=cutoff; })
      .sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
  }

  function computeFeatured(docs){
    return docs.filter(function(d){ return !!d.featured; });
  }

  function computeRecommendedDocs(docs, userState){
    if(!userState || !userState.history || !userState.history.length){
      return computeFeatured(docs).slice(0,4);
    }
    var seenIds = userState.history.map(function(h){return h.docId;});
    var seenCats = {};
    docs.forEach(function(d){ if(seenIds.indexOf(d.id)!==-1) seenCats[d.category]=(seenCats[d.category]||0)+1; });
    var candidates = docs.filter(function(d){ return seenIds.indexOf(d.id)===-1 && seenCats[d.category]; });
    candidates.sort(function(a,b){ return (seenCats[b.category]||0)-(seenCats[a.category]||0); });
    if(!candidates.length) return computeFeatured(docs).slice(0,4);
    return candidates.slice(0,4);
  }

  /* ---------------- Learning Friday: sesiones ---------------- */

  async function getLFSessions(){
    var d = await readNode('/lfSessions', 'lfSessions');
    return d ? Object.values(d) : [];
  }
  async function saveLFSession(sess){
    if(!sess.id) sess.id = newId('lf');
    if(!sess.createdAt) sess.createdAt = nowISO();
    if(hasFB()){ await fbSet('/lfSessions/'+sess.id, sess); }
    else{ var all = lsGet('lfSessions', {}); all[sess.id]=sess; lsSet('lfSessions', all); }
    return sess;
  }
  async function deleteLFSession(id){
    if(hasFB()){ await fbSet('/lfSessions/'+id, null); }
    else{ var all = lsGet('lfSessions', {}); delete all[id]; lsSet('lfSessions', all); }
  }

  function splitSessions(sessions){
    var now = Date.now();
    var upcoming = sessions.filter(function(s){ return new Date(s.dateISO).getTime() >= now; })
      .sort(function(a,b){ return new Date(a.dateISO)-new Date(b.dateISO); });
    var past = sessions.filter(function(s){ return new Date(s.dateISO).getTime() < now; })
      .sort(function(a,b){ return new Date(b.dateISO)-new Date(a.dateISO); });
    return { upcoming: upcoming, past: past };
  }

  /* ---------------- Learning Friday: ponentes ---------------- */

  async function getLFSpeakers(){
    var d = await readNode('/lfSpeakers', 'lfSpeakers');
    return d ? Object.values(d) : [];
  }
  async function saveLFSpeaker(sp){
    if(!sp.id) sp.id = newId('sp');
    if(hasFB()){ await fbSet('/lfSpeakers/'+sp.id, sp); }
    else{ var all = lsGet('lfSpeakers', {}); all[sp.id]=sp; lsSet('lfSpeakers', all); }
    return sp;
  }

  function sessionsPerSpeaker(sessions, speakerId){
    return sessions.filter(function(s){ return s.speakerId===speakerId; }).length;
  }

  /* ---------------- Inscripciones y evaluaciones ---------------- */

  async function registerForSession(userId, sessionId){
    var path = '/lfRegistrations/'+sessionId+'/'+userId;
    await writeNode(path, { date: nowISO() }, 'lfReg_'+sessionId+'_'+userId);
  }
  async function getRegistrations(sessionId){
    var d = await readNode('/lfRegistrations/'+sessionId, 'lfReg_'+sessionId);
    return d || {};
  }
  async function isRegistered(userId, sessionId){
    var regs = await getRegistrations(sessionId);
    return !!regs[userId];
  }
  async function submitEvaluation(userId, sessionId, rating, comment){
    var path = '/lfEvaluations/'+sessionId+'/'+userId;
    await writeNode(path, { rating: rating, comment: comment||'', date: nowISO() }, 'lfEval_'+sessionId+'_'+userId);
  }
  async function getEvaluations(sessionId){
    var d = await readNode('/lfEvaluations/'+sessionId, 'lfEval_'+sessionId);
    return d ? Object.values(d) : [];
  }
  function avgRating(evals){
    if(!evals.length) return null;
    return Math.round((evals.reduce(function(s,e){return s+(e.rating||0);},0)/evals.length)*10)/10;
  }

  function computeRecommendedSessions(sessions, userId, evaluationsMap){
    var upcoming = splitSessions(sessions).upcoming;
    return upcoming.slice(0,3);
  }

  /* ---------------- Carga agregada para el render principal ---------------- */

  async function computeAll(userId){
    var docs = await getLibraryDocs();
    var sessions = await getLFSessions();
    var speakers = await getLFSpeakers();
    var userState = userId ? await getUserLibraryState(userId) : { favorites:[], history:[] };
    var split = splitSessions(sessions);
    return {
      docs: docs, sessions: sessions, speakers: speakers, userState: userState,
      upcoming: split.upcoming, past: split.past,
      categories: CATS, categoryCounts: computeCategoryCounts(docs), areas: computeAreas(docs),
      newResources: computeNewResources(docs), featured: computeFeatured(docs),
      recommendedDocs: computeRecommendedDocs(docs, userState)
    };
  }

  window.MirageKnowledge = {
    CATS: CATS, esc: esc,
    getLibraryDocs: getLibraryDocs, saveLibraryDoc: saveLibraryDoc, deleteLibraryDoc: deleteLibraryDoc, registerView: registerView,
    getUserLibraryState: getUserLibraryState, toggleFavorite: toggleFavorite, addHistory: addHistory,
    searchDocs: searchDocs, filterDocs: filterDocs, computeCategoryCounts: computeCategoryCounts, computeAreas: computeAreas,
    computeNewResources: computeNewResources, computeFeatured: computeFeatured, computeRecommendedDocs: computeRecommendedDocs,
    getLFSessions: getLFSessions, saveLFSession: saveLFSession, deleteLFSession: deleteLFSession, splitSessions: splitSessions,
    getLFSpeakers: getLFSpeakers, saveLFSpeaker: saveLFSpeaker, sessionsPerSpeaker: sessionsPerSpeaker,
    registerForSession: registerForSession, getRegistrations: getRegistrations, isRegistered: isRegistered,
    submitEvaluation: submitEvaluation, getEvaluations: getEvaluations, avgRating: avgRating,
    computeRecommendedSessions: computeRecommendedSessions, computeAll: computeAll
  };
})();
