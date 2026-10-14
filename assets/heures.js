/* ============================================================================
   TAF — MODULE HEURES (assets/heures.js)

   Script classique (defer), chargé APRÈS assets/taf.js. IIFE : rien n'est
   exposé. SEUL écrivain de la clé taf_heures_v1 (CLAUDE.md §2), via muter() :
   relecture + validation avant chaque écriture, instantané ciblé pour Annuler,
   écriture SYNCHRONE, retour arrière si le quota (ou la limite) échoue.

   Le temps n'est JAMAIS compté en mémoire : tout dérive des horodatages du
   chrono et des plages stockées (survie au rechargement, au bfcache, à la
   veille et aux autres onglets). Pointeuse, frises, jauges, ruche, totaux et
   exports sont DÉRIVÉS de l'unique état D (aucune seconde copie). Une seule
   Pointeuse (dock / pilule / carte : CSS), une seule logique mobile / bureau.

   Sécurité (docs/heures-spec.md §12) : DOM construit par TAF.el /
   createElement(NS) + textContent ; positions et niveaux via
   style.setProperty('--x', nombre borné) ; teintes de projet par index
   (data-t) ; aucune donnée dans une URL ; CSV neutralisé (TAF.csv).

   Sections :
      1. Constantes & utilitaires       9. Vue Mois (ruche, synthèse)
      2. État, lecture, muter()        10. Feuille Plage
      3. Annuler / Rétablir            11. Feuille Chrono
      4. Chrono                        12. Projets, journée type, saisie
      5. Rendu : orchestration         13. Réglages (tiroir)
      6. Pointeuse & bannières         14. Export / import
      7. Composants (jauge, frise)     15. Clavier & navigation
      8. Vues Jour & Semaine           16. Cycle de vie & initialisation
============================================================================ */
(function(global){
  "use strict";
  var T=global.TAF, doc=global.document;
  if(!T || !doc || !doc.body || doc.body.getAttribute('data-module')!=='heures') return;
  if(T.encadre) return;   // page encadrée par un tiers (anti-cadre, taf.js) : ni lecture ni écriture

  /* ============================================================
     1. CONSTANTES & UTILITAIRES
  ============================================================ */
  var H=T.heures, el=T.el, fmt=T.format, LIM=H.LIMITES, CLE=H.CLE;
  var minutes=H.minutes, versHHMM=H.versHHMM;
  var NS='http://www.w3.org/2000/svg';
  var EASE='cubic-bezier(.22,.61,.27,1)';
  var VUES=['jour','semaine','mois'];
  var NOMS_VUES={ jour:'Jour', semaine:'Semaine', mois:'Mois' };
  var NOMS_ORIGINE={ c:'chrono', s:'saisie', m:'journée type' };
  var ICONE_ORIGINE={ c:'chrono', s:'saisie', m:'modele' };
  var CLE_UI='taf_heures_ui';
  var J24=864e5;

  function $(id){ return doc.getElementById(id); }
  function pad2(n){ return (n<10?'0':'')+n; }
  function maintenant(){ return Date.now(); }
  function aujourdHui(){ return T.dates.cle(maintenant()); }
  function minutesMurales(ms){ var d=new Date(ms); return d.getHours()*60+d.getMinutes(); }
  function heureDe(ms){ return versHHMM(minutesMurales(ms)); }
  function heureParlee(ms){ var d=new Date(ms); return d.getHours()+' h '+pad2(d.getMinutes()); }
  function majuscule(s){ s=String(s==null?'':s); return s.charAt(0).toUpperCase()+s.slice(1); }
  function borner(x, a, b){ return Math.min(b, Math.max(a, x)); }
  function clone(o){ return (o===undefined)?undefined:JSON.parse(JSON.stringify(o)); }
  function reduit(){ return T.mouvementReduit(); }
  function aPropre(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }
  function nettoyer(s, max){ return (typeof s==='string')?s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max):''; }
  function pluriel(n, mot, motPluriel){ return n+' '+(n>1?(motPluriel||mot+'s'):mot); }
  function joursEntre(du, au){ var l=[], k=du, garde=0; while(k && k<=au && garde++<400){ l.push(k); k=T.dates.ajouterJours(k, 1); } return l; }
  function isoJour(cle){ var d=T.dates.depuisCle(cle); return d?((d.getDay()+6)%7)+1:0; }
  function nomJour(cle){ var d=T.dates.depuisCle(cle); return d?T.JOURS_LONGS[d.getDay()]:''; }
  function dateLongue(cle){ return majuscule(fmt.dateLongue(cle)); }

  /* Icônes : définitions DÉCLARATIVES (constantes du code) → TAF.creerSvg. */
  var TRAIT={ fill:'none', stroke:'currentColor', 'stroke-width':'2', 'stroke-linecap':'round', 'stroke-linejoin':'round' };
  var PLEIN={ fill:'currentColor' };
  var IC={
    gauche:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M15 18l-6-6 6-6' }] },
    droite:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M9 6l6 6-6 6' }] },
    plus:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M12 5v14M5 12h14' }] },
    menu:{ vb:'0 0 24 24', a:PLEIN, p:[{ t:'circle', cx:'5', cy:'12', r:'1.9' },{ t:'circle', cx:'12', cy:'12', r:'1.9' },{ t:'circle', cx:'19', cy:'12', r:'1.9' }] },
    chrono:{ vb:'0 0 24 24', a:TRAIT, p:[{ t:'circle', cx:'12', cy:'13.5', r:'7.5' },{ d:'M12 10v3.5l2.5 1.6M9.5 2.5h5' }] },
    saisie:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z' }] },
    modele:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z' }] },
    lecture:{ vb:'0 0 24 24', a:PLEIN, p:[{ d:'M8 5.6v12.8a1 1 0 0 0 1.52.85l10.3-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z' }] },
    stop:{ vb:'0 0 24 24', a:PLEIN, p:[{ t:'rect', x:'6', y:'6', width:'12', height:'12', rx:'2.2' }] },
    pause:{ vb:'0 0 24 24', a:PLEIN, p:[{ t:'rect', x:'6.5', y:'5', width:'4', height:'14', rx:'1.3' },{ t:'rect', x:'13.5', y:'5', width:'4', height:'14', rx:'1.3' }] },
    cra:{ vb:'0 0 24 24', a:TRAIT, p:[{ t:'rect', x:'3', y:'4', width:'18', height:'18', rx:'2' },{ d:'M16 2v4M8 2v4M3 10h18M8.5 15.5l2.5 2.5 4.5-5' }] },
    exporter:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M12 3v12M8 11l4 4 4-4' },{ d:'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' }] },
    tableau:{ vb:'0 0 24 24', a:TRAIT, p:[{ t:'rect', x:'3', y:'4', width:'18', height:'16', rx:'2' },{ d:'M3 10h18M3 15h18M9 4v16' }] },
    ruche:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M8 3.5 12 5.8v4.6L8 12.7 4 10.4V5.8zM16 3.5l4 2.3v4.6l-4 2.3-4-2.3V5.8zM12 11.3l4 2.3v4.6l-4 2.3-4-2.3v-4.6z' }] },
    alerte:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M12 3.5 2.5 20h19z' },{ d:'M12 10v4.5M12 17.2h.01' }] },
    info:{ vb:'0 0 24 24', a:TRAIT, p:[{ t:'circle', cx:'12', cy:'12', r:'9' },{ d:'M12 11v5M12 8h.01' }] },
    coche:{ vb:'0 0 24 24', a:{ fill:'none', stroke:'currentColor', 'stroke-width':'2.6', 'stroke-linecap':'round', 'stroke-linejoin':'round' }, p:[{ d:'M5 12.5l4.5 4.5L19 7.5' }] },
    corbeille:{ vb:'0 0 24 24', a:TRAIT, p:[{ d:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' }] }
  };
  function icone(nom, taille){
    var s=T.creerSvg(IC[nom]), t=String(taille||16);
    s.setAttribute('width', t); s.setAttribute('height', t);
    return s;
  }

  /* ============================================================
     2. ÉTAT, LECTURE, ÉCRITURE — muter() est le SEUL chemin
        d'écriture de taf_heures_v1.
  ============================================================ */
  var D=null;                  // données courantes VALIDÉES (seule vérité de la page)
  var statut='vide';           // ok | partiel | vide | illisible | futur
  var details=[], ignores=0;
  var brutOrigine=null;        // texte d'origine (illisible / futur / partiel) : export brut, jamais réécrit
  var partiel=null;            // {ignores, details} si des éléments ont été ignorés à la lecture
  var dernierTexte=null;       // dernier texte lu ou écrit par CET onglet (détecte les écritures d'ailleurs)
  var memoire=false;           // stockage illisible : mode temporaire, tout vit en mémoire
  var lectureSeule=false;      // illisible / futur : aucune écriture

  function donneesNeuves(){
    return { v:1, rev:0, jours:Object.create(null), chrono:null, projets:[], reglages:H.reglagesDefaut(),
      meta:{ creeLe:aujourdHui(), derniereSauvegarde:null, accueilVu:false } };
  }
  // Copie de travail : dictionnaire des jours SANS prototype, clés revalidées.
  function copieDonnees(d){
    var c=clone(d), j=Object.create(null);
    Object.keys(c.jours||{}).forEach(function(k){ if(T.dates.cleValide(k) && Array.isArray(c.jours[k])) j[k]=c.jours[k]; });
    c.jours=j;
    return c;
  }
  function appliquerTexte(t){
    dernierTexte=t;
    if(t==null){ D=donneesNeuves(); statut='vide'; details=[]; ignores=0; lectureSeule=false; return; }
    var r=H.valider(t);
    statut=r.rapport.statut; details=r.rapport.details; ignores=r.rapport.ignores;
    if(statut==='illisible'){ D=donneesNeuves(); D.meta.accueilVu=true; brutOrigine=t; lectureSeule=true; return; }
    D=r.donnees;
    if(statut==='futur'){ brutOrigine=t; lectureSeule=true; return; }
    lectureSeule=false;
    if(statut==='partiel' && !partiel){ partiel={ ignores:ignores, details:details.slice() }; if(brutOrigine==null) brutOrigine=t; }
  }
  function charger(){
    memoire=!T.stockage.lisible();
    if(memoire){ D=donneesNeuves(); statut='vide'; lectureSeule=false; dernierTexte=null; return; }
    appliquerTexte(T.stockage.lireTexte(CLE));
  }
  function R(){ return D.reglages; }
  function plagesDe(cle){ var l=D.jours[cle]; return Array.isArray(l)?l:[]; }

  /* Jours modifiés par une mutation : normalisés (§6.5), vides supprimés. */
  function normaliserTouches(base, e){
    var cles=Object.create(null), touches=[];
    Object.keys(base.jours).forEach(function(k){ cles[k]=true; });
    Object.keys(e.jours).forEach(function(k){ cles[k]=true; });
    Object.keys(cles).forEach(function(k){
      var avant=JSON.stringify(base.jours[k]||null), n=e.jours[k];
      if(n===undefined){ if(avant!=='null') touches.push(k); return; }
      if(JSON.stringify(n)===avant) return;
      if(!T.dates.cleValide(k) || !Array.isArray(n)){ delete e.jours[k]; if(avant!=='null') touches.push(k); return; }
      var nd=H.normaliserDetail(n);
      // Une ACTION ne tronque jamais une journée (la troncature reste réservée aux données externes, valider()).
      if(nd.plafonnees>0) throw new Error(LIM.plagesJour+' plages par jour au plus — rien n’a été modifié.');
      n=nd.plages;
      if(n.length) e.jours[k]=n; else delete e.jours[k];
      if(JSON.stringify(e.jours[k]||null)!==avant) touches.push(k);
    });
    return touches;
  }
  // Références de projet toujours valides (après une suppression / restauration de projets).
  function assainirReferences(e){
    var ids=Object.create(null);
    e.projets.forEach(function(p){ ids[p.id]=true; });
    Object.keys(e.jours).forEach(function(k){ e.jours[k].forEach(function(x){ if(x.p && !ids[x.p]) x.p=''; }); });
    if(e.chrono && e.chrono.p && !ids[e.chrono.p]) e.chrono.p='';
    if(e.reglages && Array.isArray(e.reglages.journeeType)) e.reglages.journeeType.forEach(function(x){ if(x.p && !ids[x.p]) x.p=''; });
  }

  var pileAnnuler=[], pileRetablir=[], MAX_PILE=20;
  function viderPiles(){ pileAnnuler=[]; pileRetablir=[]; }

  /* §5.3 — muter(libelle, fn, options)
       1. relit la clé (une écriture d'un autre onglet est prise en compte, piles vidées) ;
       2. applique fn sur une COPIE (fn peut renvoyer false pour renoncer) ;
       3. normalise les jours touchés, prend l'instantané ciblé (Annuler) ;
       4. rev + 1, borne 2 000 000 caractères, setItem SYNCHRONE ;
       5. échec : l'état en mémoire n'a jamais changé (retour arrière), témoin en échec.
     options : pile ('annuler' défaut | 'retablir' | false), garderRetablir, rendu (false),
               differerRendu (ms), anim (défaut true), note (écriture différée de la note). */
  function muter(libelle, fn, opts){
    opts=opts||{};
    if(!opts.note) viderNote();
    if(lectureSeule){ signalerLectureSeule(); return null; }
    if(!memoire){
      var frais=T.stockage.lireTexte(CLE);
      if(frais!==dernierTexte){
        appliquerTexte(frais); viderPiles();
        if(lectureSeule){ signalerLectureSeule(); rendre({ anim:false }); return null; }
        // Annuler / Rétablir : l'instantané date d'AVANT l'écriture de l'autre onglet → jamais réappliqué dessus.
        if(opts.exigeFrais){ rendre({ anim:false }); T.toast({ message:'Modifié dans un autre onglet — '+(opts.pile==='retablir'?'annulation':'rétablissement')+' impossible.', type:'info' }); return null; }
      }
    }
    var base=D, e=copieDonnees(base), res;
    try{ res=fn(e); }
    catch(err){ T.toast({ message:(err && err.message)?err.message:'Action impossible.', type:'erreur' }); return null; }
    if(res===false) return null;
    if(Object.keys(e.jours).length>LIM.jours){ T.toast({ message:'Limite de '+LIM.jours+' jours atteinte — exportez puis allégez vos heures.', type:'erreur' }); return null; }
    var touches;
    try{ touches=normaliserTouches(base, e); }
    catch(err){ T.toast({ message:(err && err.message)?err.message:'Action impossible.', type:'erreur' }); return null; }
    var avant={ jours:{} }, change=touches.length>0;
    touches.forEach(function(k){ avant.jours[k]=base.jours[k]?clone(base.jours[k]):null; });
    ['chrono','projets','reglages','meta'].forEach(function(k){
      if(JSON.stringify(base[k])!==JSON.stringify(e[k])){ avant[k]=clone(base[k]); change=true; }
    });
    if(!change) return { inchange:true, res:res, touches:[] };
    if(avant.projets) assainirReferences(e);
    e.rev=(Number.isInteger(base.rev)?base.rev:0)+1;
    var texte=null;
    try{ texte=JSON.stringify(e); }catch(err){ texte=null; }
    if(typeof texte!=='string'){ T.temoin.etat('echec', CLE); T.toast({ message:'Enregistrement impossible.', type:'erreur' }); return null; }
    if(texte.length>LIM.json){
      T.temoin.etat('echec', CLE);
      T.toast({ message:'Limite de stockage atteinte — exportez puis allégez vos heures.', type:'erreur', duree:8000 });
      return null;
    }
    if(!memoire){
      if(!T.stockage.ecrireTexte(CLE, texte)){
        var lisible=T.stockage.lisible();
        T.temoin.etat(lisible?'echec':'indisponible', CLE);
        T.toast({ message:lisible?'Échec — stockage plein : exportez vos heures.':'Stockage indisponible — exportez vos heures.', type:'erreur', duree:8000 });
        return null;                       // retour arrière : D n'a pas changé
      }
      T.temoin.etat('ok', CLE);
      dernierTexte=texte;
    }
    D=e;
    var entree={ libelle:libelle, avant:avant };
    if(opts.pile==='retablir') pileRetablir.push(entree);
    else if(opts.pile!==false){
      pileAnnuler.push(entree);
      if(pileAnnuler.length>MAX_PILE) pileAnnuler.shift();
      if(!opts.garderRetablir) pileRetablir=[];
    }
    if(opts.rendu!==false){
      if(opts.differerRendu) setTimeout(function(){ rendre({ anim:opts.anim!==false }); }, opts.differerRendu);
      else rendre({ anim:opts.anim!==false });
    }
    return { res:res, entree:entree, touches:touches };
  }
  function signalerLectureSeule(){
    T.toast({ message:statut==='futur'?'Lecture seule : données créées par une version plus récente de TAF.':'Données Heures illisibles : aucune modification possible (exportez le brut ou réinitialisez).', type:'erreur', duree:6000 });
  }

  /* ============================================================
     3. ANNULER / RÉTABLIR — pile de 20 en mémoire ; l'instantané
        ciblé est réappliqué via muter() (rev + 1).
  ============================================================ */
  function restaurer(instantane){
    return function(e){
      Object.keys(instantane.jours).forEach(function(k){
        if(!T.dates.cleValide(k)) return;
        var v=instantane.jours[k];
        if(v) e.jours[k]=clone(v); else delete e.jours[k];
      });
      ['chrono','projets','reglages','meta'].forEach(function(k){ if(aPropre(instantane, k)) e[k]=clone(instantane[k]); });
    };
  }
  function annuler(){
    var entree=pileAnnuler.pop();
    if(!entree){ T.toast({ message:'Rien à annuler', type:'info' }); return false; }
    var r=muter(entree.libelle, restaurer(entree.avant), { pile:'retablir', exigeFrais:true });
    if(!r) return false;
    var redo=r.entree;
    T.toast({ message:'Annulé · '+entree.libelle, type:'info', action:{ libelle:'Rétablir', fn:function(){ if(pileRetablir[pileRetablir.length-1]===redo) retablir(); } }, duree:6000 });
    apresRestauration();
    return true;
  }
  function retablir(){
    var entree=pileRetablir.pop();
    if(!entree){ T.toast({ message:'Rien à rétablir', type:'info' }); return false; }
    var r=muter(entree.libelle, restaurer(entree.avant), { garderRetablir:true, exigeFrais:true });
    if(!r) return false;
    T.toast({ message:'Rétabli · '+entree.libelle, type:'info' });
    apresRestauration();
    return true;
  }
  // Toast « Annuler » d'une opération : n'annule QUE cette opération (si elle est encore la dernière).
  function toastAnnulable(message, entree, type){
    T.toast({ message:message, type:type||'succes', duree:8000, action:{ libelle:'Annuler', fn:function(){
      if(pileAnnuler[pileAnnuler.length-1]===entree) annuler();
      else T.toast({ message:'Déjà modifié depuis — utilisez Ctrl+Z.', type:'info' });
    } } });
  }

  /* ============================================================
     4. CHRONO — horodatages stockés (t0 / tp), jamais un compteur.
        Pause / Arrêter : le segment [t0, maintenant] est découpé aux
        minuits locaux, arrondi selon les réglages (TAF.heures) et
        inséré (« la plus récente gagne »), dans la MÊME mutation.
  ============================================================ */
  function projetDe(id){
    if(!id) return null;
    for(var i=0;i<D.projets.length;i++){ if(D.projets[i].id===id) return D.projets[i]; }
    return null;
  }
  function projetActif(id){ var p=projetDe(id); return !!(p && !p.a); }
  function nomProjet(id){ var p=projetDe(id); return p?p.nom:'Sans projet'; }
  function clesTriees(){ return Object.keys(D.jours).sort(); }
  // Projet de la plage d'origine chrono la plus récente (§4.1) — dérivé, jamais stocké.
  function dernierProjetChrono(){
    var cles=clesTriees();
    for(var i=cles.length-1;i>=0;i--){
      var l=D.jours[cles[i]];
      for(var j=l.length-1;j>=0;j--){ if(l[j].o==='c') return projetActif(l[j].p)?l[j].p:''; }
    }
    return '';
  }
  // Projets récents (dérivés des plages), actifs, du plus récent au plus ancien.
  function projetsRecents(n){
    var vus=[], cles=clesTriees();
    for(var i=cles.length-1;i>=0 && vus.length<n;i--){
      var l=D.jours[cles[i]];
      for(var j=l.length-1;j>=0 && vus.length<n;j--){ var p=l[j].p; if(p && vus.indexOf(p)===-1 && projetActif(p)) vus.push(p); }
    }
    return vus;
  }
  function plagesSession(s){
    var out=[];
    if(!s) return out;
    clesTriees().forEach(function(k){ D.jours[k].forEach(function(x){ if(x.s===s) out.push({ cle:k, d:x.d, f:x.f, id:x.id }); }); });
    return out;
  }
  function minutesSession(s){ return plagesSession(s).reduce(function(t, x){ return t+minutes(x.f)-minutes(x.d); }, 0); }

  /* Contexte d'un rendu : maintenant, aujourd'hui, segment vivant découpé par jour. */
  function contexte(now){
    var c=D.chrono, viv={};
    if(c && c.e==='marche'){
      var r=H.decouperSegment(c.t0, now, 1, 'proche');
      if(!r.erreur && !r.horlogeReculee) viv=r.plagesParJour;
    }
    return { now:now, today:T.dates.cle(now), vivants:viv };
  }
  function vivantDe(cle, ctx){
    var c=D.chrono;
    if(!c || !aPropre(ctx.vivants, cle)) return [];
    return ctx.vivants[cle].map(function(x){ return { d:x.d, f:x.f, p:c.p, n:c.n, vivant:true }; });
  }
  function plagesAvecVivant(cle, ctx){ return plagesDe(cle).concat(vivantDe(cle, ctx)); }
  function totalJour(cle, ctx){ return H.unionMinutes(plagesAvecVivant(cle, ctx)); }

  // Segment [t0, fin] → plages o:'c' de la session (dans la copie e).
  function enregistrerSegment(e, finMs){
    var c=e.chrono, reg=e.reglages;
    var dec=H.decouperSegment(c.t0, finMs, reg.arrondiMin, reg.modeArrondi);
    var out={ minutes:0, rognees:[], vide:true, recule:!!dec.horlogeReculee, erreur:dec.erreur||null };
    if(dec.erreur) return out;
    Object.keys(dec.plagesParJour).forEach(function(cle){
      if(!T.dates.cleValide(cle)) return;
      dec.plagesParJour[cle].forEach(function(x){
        var plage={ id:T.id('h'), d:x.d, f:x.f, p:c.p||'', n:c.n||'', o:'c', s:c.s };
        var r=H.insererPlage(e.jours[cle]||[], plage);
        e.jours[cle]=r.plages;
        r.rognees.forEach(function(g){ if(g.avant.s!==c.s) out.rognees.push(g); });
        out.minutes+=minutes(x.f)-minutes(x.d); out.vide=false;
      });
    });
    return out;
  }
  // « · 13:00–14:00 rognée » (toast) — décrit la plage existante modifiée.
  function suffixeRognees(rognees){
    if(!rognees || !rognees.length) return '';
    if(rognees.length>1) return ' · '+rognees.length+' plages rognées';
    var g=rognees[0], a=g.avant;
    return ' · '+a.d+'–'+a.f+(g.type==='supprimee'?' remplacée':(g.type==='scindee'?' scindée':' rognée'));
  }
  function arrondiSeconde(ms){ return Math.floor(ms/1000)*1000; }
  var persistDemandee=false;
  function demanderPersistance(){
    if(persistDemandee) return; persistDemandee=true;
    try{ var s=global.navigator.storage; if(s && typeof s.persist==='function') s.persist().then(majPersistance, function(){}); }catch(e){}
  }
  function vibrer(){ if(R().vibration) T.vibrer(10); }

  function demarrerChrono(t0, opts){
    opts=opts||{};
    var now=maintenant();
    var debut=(typeof t0==='number' && isFinite(t0))?arrondiSeconde(t0):arrondiSeconde(now);
    if(debut>now){ T.toast({ message:'Cette heure n’est pas encore passée.', type:'erreur' }); return null; }
    if(debut<now-J24){ T.toast({ message:'Début limité aux dernières 24 heures.', type:'erreur' }); return null; }
    var p=(typeof opts.p==='string')?opts.p:(R().projetDemarrage==='dernier'?dernierProjetChrono():'');
    var n=nettoyer(opts.n||'', LIM.note);
    var r=muter(opts.libelle||'Démarrer le chrono', function(e){
      if(e.chrono) return false;                                 // déjà démarré (autre onglet)
      var ok=e.projets.some(function(x){ return x.id===p; });
      e.chrono={ e:'marche', t0:debut, tp:null, p:ok?p:'', n:n, s:T.id('s') };
    });
    if(!r){ rendre({ anim:false }); return null; }
    demanderPersistance(); vibrer(); animerHex();
    T.annoncer('Chrono démarré à '+heureParlee(debut)+(D.chrono.p?', projet '+nomProjet(D.chrono.p):''));
    return r;
  }
  function pauseChrono(opts){
    opts=opts||{};
    var c=D.chrono; if(!c || c.e!=='marche') return null;
    var now=maintenant();
    if(now-c.t0>J24 && !opts.confirme){ demanderConfirmation24('pause'); return null; }
    var seg=null, s=c.s;
    var r=muter('Pause du chrono', function(e){
      if(!e.chrono || e.chrono.e!=='marche' || e.chrono.s!==s) return false;
      seg=enregistrerSegment(e, now);
      if(seg.erreur) return false;
      e.chrono={ e:'pause', t0:null, tp:now, p:e.chrono.p, n:e.chrono.n, s:s };
    });
    if(!r){ if(seg && seg.erreur) segmentTropLong(); else rendre({ anim:false }); return null; }
    vibrer(); animerHex();
    if(seg.recule) T.toast({ message:'L’horloge de l’appareil a reculé : rien n’a été enregistré.', type:'erreur' });
    else if(seg.vide) toastAnnulable('Moins d’une minute — ignoré', r.entree, 'info');
    else if(seg.rognees.length) toastAnnulable('Pause · '+fmt.duree(seg.minutes)+' enregistrées'+suffixeRognees(seg.rognees), r.entree);
    else T.annoncer('Pause, segment de '+fmt.dureeLongue(seg.minutes)+' enregistré');
    return r;
  }
  function reprendreChrono(){
    var c=D.chrono; if(!c || c.e!=='pause') return null;
    var now=arrondiSeconde(maintenant()), s=c.s;
    var r=muter('Reprendre le chrono', function(e){
      if(!e.chrono || e.chrono.e!=='pause' || e.chrono.s!==s) return false;
      e.chrono={ e:'marche', t0:now, tp:null, p:e.chrono.p, n:e.chrono.n, s:s };
    });
    if(!r){ rendre({ anim:false }); return null; }
    vibrer(); animerHex();
    T.annoncer('Chrono repris à '+heureParlee(now));
    return r;
  }
  function arreterChrono(finMs, opts){
    opts=opts||{};
    var c=D.chrono; if(!c) return null;
    var now=maintenant(), fin=(typeof finMs==='number' && isFinite(finMs))?finMs:now;
    if(c.e==='marche'){
      if(fin>now) fin=now;
      if(fin<c.t0){ T.toast({ message:'L’heure d’arrêt précède le début ('+heureDe(c.t0)+').', type:'erreur' }); return null; }
      if(fin-c.t0>J24 && !opts.confirme){ demanderConfirmation24('arreter', fin); return null; }
    }
    var seg=null, s=c.s;
    var r=muter(opts.libelle||'Arrêter le chrono', function(e){
      if(!e.chrono || e.chrono.s!==s) return false;
      if(e.chrono.e==='marche'){ seg=enregistrerSegment(e, fin); if(seg.erreur) return false; }
      e.chrono=null;
    });
    if(!r){ if(seg && seg.erreur) segmentTropLong(); else rendre({ anim:false }); return null; }
    vibrer(); oubliTraite(s);
    var total=minutesSession(s);
    if(seg && seg.recule) T.toast({ message:'L’horloge de l’appareil a reculé : dernier segment ignoré.', type:'erreur' });
    toastAnnulable(total?'Session enregistrée · '+fmt.duree(total)+suffixeRognees(seg && seg.rognees):'Moins d’une minute — ignoré', r.entree, total?'succes':'info');
    return r;
  }
  function segmentTropLong(){
    T.toast({ message:'Session de plus de 8 jours : choisissez l’heure d’arrêt.', type:'erreur', duree:7000 });
    ouvrirFeuilleChrono('arreterA');
  }
  function basculerChrono(){
    var c=D.chrono;
    if(!c) return demarrerChrono();
    if(c.e==='marche') return pauseChrono();
    return reprendreChrono();
  }
  function corrigerDebut(t0){
    var c=D.chrono; if(!c || c.e!=='marche') return null;
    var now=maintenant(), s=c.s;
    var nouveau=arrondiSeconde(borner(t0, now-J24, now));
    if(nouveau!==t0 && Math.abs(nouveau-t0)>1000) T.toast({ message:'Début limité aux dernières 24 heures.', type:'info' });
    var r=muter('Corriger le début', function(e){
      if(!e.chrono || e.chrono.e!=='marche' || e.chrono.s!==s) return false;
      e.chrono.t0=nouveau;
    });
    if(r && !r.inchange) T.annoncer('Début corrigé à '+heureParlee(nouveau));
    return r;
  }
  // mode : 'maintenant' (marche : le segment en cours est enregistré avec l'ancien projet) | 'session'
  function changerProjetChrono(p, mode){
    var c=D.chrono; if(!c) return null;
    var s=c.s, now=maintenant(), seg=null;
    var r=muter('Changer de projet', function(e){
      if(!e.chrono || e.chrono.s!==s) return false;
      if(p && !e.projets.some(function(x){ return x.id===p; })) p='';
      if(mode==='session'){
        Object.keys(e.jours).forEach(function(k){ e.jours[k].forEach(function(x){ if(x.s===s) x.p=p; }); });
        e.chrono.p=p;
      } else if(e.chrono.e==='marche'){
        seg=enregistrerSegment(e, now);
        if(seg.erreur) return false;
        e.chrono={ e:'marche', t0:arrondiSeconde(now), tp:null, p:p, n:e.chrono.n, s:s };
      } else e.chrono.p=p;
    });
    if(!r || r.inchange) return r;
    toastAnnulable('Projet : '+nomProjet(p)+(mode==='session'?' (toute la session)':(c.e==='marche'?' à partir de maintenant':'')), r.entree);
    return r;
  }

  /* Note du chrono : seule écriture DIFFÉRÉE (300 ms), vidée sur pagehide /
     visibilitychange:hidden, à la fermeture de la feuille et avant toute mutation. */
  var noteEnAttente=null, timerNote=null;
  function noterChrono(texte){
    noteEnAttente=nettoyer(texte, LIM.note);
    if(timerNote) clearTimeout(timerNote);
    timerNote=setTimeout(viderNote, 300);
  }
  function viderNote(){
    if(timerNote){ clearTimeout(timerNote); timerNote=null; }
    if(noteEnAttente===null) return;
    var n=noteEnAttente; noteEnAttente=null;
    if(!D || !D.chrono || D.chrono.n===n) return;
    muter('Note du chrono', function(e){ if(!e.chrono) return false; e.chrono.n=n; }, { note:true, pile:false, anim:false });
  }

  /* Chrono oublié (§4.1) : en marche depuis plus que le seuil, ou minuit franchi. */
  function chronoOublie(now){
    var c=D && D.chrono;
    if(!c || c.e!=='marche') return null;
    now=now||maintenant();
    var duree=now-c.t0;
    if(duree>R().alerteOubliMin*60000 || T.dates.cle(c.t0)!==T.dates.cle(now)) return { c:c, duree:Math.max(0, duree) };
    return null;
  }
  function oubliTraite(s){
    if(session.oublis.indexOf(s)===-1){ session.oublis.push(s); ecrireSession(); }
  }
  // Fin proposée : fin de la journée type du jour de t0, sinon t0 + durée de la journée ; bornée à maintenant.
  function finProposee(c, now){
    var cle=T.dates.cle(c.t0), d=T.dates.depuisCle(cle), jt=R().journeeType, finMin=null;
    if(jt && jt.length) finMin=minutes(jt[jt.length-1].f);
    var fin=(finMin!=null && d)?new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(finMin/60), finMin%60).getTime():c.t0+R().dureeJourMin*60000;
    if(fin<=c.t0) fin=c.t0+R().dureeJourMin*60000;
    return Math.min(fin, now);
  }
  // « 09:02–24:00 mar. · 00:00–09:40 mer. »
  function apercuDecoupe(t0, fin){
    var dec=H.decouperSegment(t0, fin, R().arrondiMin, R().modeArrondi);
    if(dec.erreur) return dec.erreur.message;
    return Object.keys(dec.plagesParJour).sort().map(function(k){
      return dec.plagesParJour[k].map(function(x){ return x.d+'–'+x.f+' '+fmt.dateCourte(k).split(' ')[0]; }).join(' · ');
    }).join(' · ');
  }
  function heureRelative(ms, cleRef){
    var k=T.dates.cle(ms), h=heureDe(ms);
    if(k===cleRef) return h;
    if(k===T.dates.ajouterJours(cleRef, -1)) return 'hier '+h;
    return fmt.dateCourte(k)+' '+h;
  }
  function demanderConfirmation24(action, fin){
    fc.confirm={ action:action, fin:(typeof fin==='number')?fin:null };
    ouvrirFeuilleChrono('confirm');
  }

  /* ============================================================
     5. RENDU — orchestration. Une vue = une fonction pure de D (+ le
        contexte « maintenant »). Re-rendu après chaque mutation, sur
        l'événement storage, et à la minute quand l'affichage en dépend.
        Le focus est restitué par clé (data-focus) ; les valeurs animées
        (niveaux, jauges, indicateurs) partent de leur valeur précédente.
  ============================================================ */
  var ui={ vue:'jour', ref:aujourdHui(), tableau:false, deplies:Object.create(null), menu:null, accueil:null, focusApres:null };
  var session={ ref:null, oublis:[], oublisAnnonces:[], objectifs:[], rappelPlusTard:false, partielMasque:false };
  var dernierRendu='', derniereMinute=-1, dernierJour='';
  var memVal=Object.create(null);          // dernières valeurs animées, par clé
  var blocsVus=Object.create(null);        // ids des blocs de frise déjà affichés, par jour
  var sousObjectif=Object.create(null);    // semaines vues sous l'objectif (pop à l'atteinte)
  var transitionsEnAttente=[];

  function listeIds(v, rx){ return Array.isArray(v)?v.filter(function(x){ return typeof x==='string' && rx.test(x); }).slice(-40):[]; }
  function lireSession(){
    var o=null;
    try{ o=JSON.parse(global.sessionStorage.getItem(CLE_UI)||'null'); }catch(e){ o=null; }
    o=T.objetSimple(o)?o:{};
    return { ref:T.dates.cleValide(o.ref)?o.ref:null, oublis:listeIds(o.oublis, /^s_[a-z0-9]{10}$/), oublisAnnonces:listeIds(o.oublisAnnonces, /^s_[a-z0-9]{10}$/),
      objectifs:listeIds(o.objectifs, /^\d{4}-\d{2}-\d{2}$/), rappelPlusTard:o.rappelPlusTard===true, partielMasque:o.partielMasque===true };
  }
  function ecrireSession(){
    try{ global.sessionStorage.setItem(CLE_UI, JSON.stringify({ ref:ui.ref, oublis:session.oublis.slice(-40), oublisAnnonces:session.oublisAnnonces.slice(-40),
      objectifs:session.objectifs.slice(-40), rappelPlusTard:session.rappelPlusTard, partielMasque:session.partielMasque })); }catch(e){}
  }

  // Valeur animée : part de sa valeur précédente (même clé) puis rejoint la nouvelle (transition CSS).
  function versValeur(node, prop, cleMem, valeur, anim, departDefaut){
    var prec=memVal[cleMem];
    memVal[cleMem]=valeur;
    var depart=(anim && !reduit())?(prec!==undefined?prec:(departDefaut!==undefined?departDefaut:valeur)):valeur;
    node.style.setProperty(prop, String(depart));
    if(depart!==valeur) transitionsEnAttente.push([node, prop, valeur]);
  }
  function lancerTransitions(){
    if(!transitionsEnAttente.length) return;
    var l=transitionsEnAttente; transitionsEnAttente=[];
    void doc.body.offsetWidth;                                   // style de départ calculé
    l.forEach(function(t){ t[0].style.setProperty(t[1], String(t[2])); });
  }
  function focusSur(n){ if(!n) return; try{ n.focus({ preventScroll:true }); }catch(e){ try{ n.focus(); }catch(_){ } } }
  function cleFocus(zone){ var a=doc.activeElement; return (a && a!==doc.body && zone.contains(a))?a.getAttribute('data-focus'):null; }
  function trouverFocus(zone, cle){
    if(!cle) return null;
    var l=zone.querySelectorAll('[data-focus]');
    for(var i=0;i<l.length;i++){ if(l[i].getAttribute('data-focus')===cle) return l[i]; }
    return null;
  }
  function capturerRects(zone){
    var m=Object.create(null);
    Array.prototype.forEach.call(zone.querySelectorAll('[data-flip]'), function(n){ m[n.getAttribute('data-flip')]=n.getBoundingClientRect().top; });
    return m;
  }
  // FLIP : les voisines glissent (translateY) ; les nouvelles lignes entrent (scale .96 + fondu).
  function animerFlip(zone, avant){
    if(reduit()) return;
    Array.prototype.forEach.call(zone.querySelectorAll('[data-flip]'), function(n){
      if(typeof n.animate!=='function') return;
      var k=n.getAttribute('data-flip'), top=n.getBoundingClientRect().top;
      if(k in avant){ var dy=avant[k]-top; if(Math.abs(dy)>1) n.animate([{ transform:'translateY('+dy.toFixed(1)+'px)' },{ transform:'none' }], { duration:220, easing:EASE }); }
      else n.animate([{ opacity:0, transform:'scale(.96)' },{ opacity:1, transform:'none' }], { duration:200, easing:EASE });
    });
  }

  function cleRendu(){
    if(ui.vue==='semaine') return 'semaine|'+T.dates.lundiDe(ui.ref);
    if(ui.vue==='mois') return 'mois|'+ui.ref.slice(0, 7);
    return 'jour|'+ui.ref;
  }
  function rendre(o){
    o=o||{};
    if(!D) return;
    var ctx=contexte(maintenant());
    rendreBannieres(ctx);
    rendreNavVues();
    rendreVue(ctx, o);
    rendrePointeuse(ctx);
    rendreExtras(ctx);
    if(fc.ouvert) rendreFeuilleChrono(ctx);
    majRaccourcis();
    derniereMinute=Math.floor(ctx.now/60000); dernierJour=ctx.today;
    planifierTick();
  }
  function rendreVue(ctx, o){
    var zone=$('vue'), cle=cleRendu(), meme=(cle===dernierRendu);
    var focus=ui.focusApres||cleFocus(zone); ui.focusApres=null;
    var avaitFocus=!!cleFocus(zone);
    var rects=(meme && o.anim && !reduit())?capturerRects(zone):null;
    var opts={ anim:!!o.anim, meme:meme, entree:!!o.entree };
    var frag=(ui.vue==='semaine')?construireSemaine(ctx, opts):(ui.vue==='mois'?construireMois(ctx, opts):construireJour(ctx, opts));
    zone.textContent='';
    zone.appendChild(frag);
    zone.setAttribute('data-vue', ui.vue);
    if(focus){
      var n=trouverFocus(zone, focus);
      if(n) focusSur(n);
      else if(avaitFocus) focusSur($('vueTitre'));
    }
    lancerTransitions();
    if(rects) animerFlip(zone, rects);
    dernierRendu=cle;
  }

  /* Tick d'affichage : aligné sur la prochaine seconde (minute si secondes masquées
     ou chrono arrêté) ; ne modifie que des textContent. Suspendu onglet caché. */
  var timerTick=null;
  function planifierTick(){
    if(timerTick){ clearTimeout(timerTick); timerTick=null; }
    if(doc.hidden || !D) return;
    var c=D.chrono, now=maintenant();
    var pas=(c && c.e==='marche' && R().secondes)?1000:60000;
    timerTick=setTimeout(tick, pas-(now%pas)+15);
  }
  function periodeContientAujourdhui(today){
    if(ui.vue==='jour') return ui.ref===today;
    if(ui.vue==='semaine') return T.dates.lundiDe(ui.ref)===T.dates.lundiDe(today);
    return ui.ref.slice(0, 7)===today.slice(0, 7);
  }
  function tick(){
    timerTick=null;
    var now=maintenant(), m=Math.floor(now/60000), today=T.dates.cle(now);
    if(m!==derniereMinute){
      derniereMinute=m;
      if(D.chrono || today!==dernierJour || (ui.vue!=='mois' && periodeContientAujourdhui(today))){ rendre({ anim:false }); return; }
    }
    majChiffres(now);
    planifierTick();
  }

  /* Transitions de période / de vue : View Transitions si disponibles (glissement
     orienté ±16 px + fondu, 180 ms), sinon simple fondu. Coupées en mouvement réduit. */
  function transition(sens, maj){
    var vt=doc.startViewTransition;
    if(typeof vt==='function' && !reduit() && !doc.hidden){
      var racine=doc.documentElement;
      racine.setAttribute('data-h-sens', sens);
      var fin=function(){ racine.removeAttribute('data-h-sens'); };
      try{
        var t=vt.call(doc, maj);
        if(t){
          if(t.ready) t.ready.catch(function(){});
          if(t.updateCallbackDone) t.updateCallbackDone.catch(function(){});
          if(t.finished) t.finished.then(fin, fin); else fin();
          return;
        }
      }catch(e){ fin(); }
    }
    maj();
    var z=$('vue');
    if(!reduit() && z && typeof z.animate==='function'){
      var dx=sens==='precedent'?-12:(sens==='suivant'?12:0);
      z.animate([{ opacity:0, transform:'translateX('+dx+'px)' },{ opacity:1, transform:'none' }], { duration:180, easing:EASE });
    }
  }

  /* ============================================================
     6. POINTEUSE (un seul composant) & BANNIÈRES
  ============================================================ */
  var pt={ racine:$('pt'), hex:$('ptHex'), lib:$('ptHexLib'), stop:$('ptStop'), etat:$('ptEtat'), h:$('ptH'), m:$('ptM'), s:$('ptS'),
    projet:$('ptProjet'), depuis:$('ptDepuis'), sec:$('ptSecondaires'), desc:$('etatChrono'), forme:null };
  pt.forme=pt.hex?pt.hex.querySelector('.pt-hex-forme'):null;
  var cumulSession=0, signatureEtat='';
  function etatChrono(){ var c=D && D.chrono; return c?c.e:'repos'; }
  function descriptionEtat(){
    var c=D.chrono;
    if(c && c.e==='marche') return 'Chrono en marche depuis '+heureParlee(c.t0)+(c.p?', projet '+nomProjet(c.p):'');
    if(c && c.e==='pause') return 'Chrono en pause depuis '+heureParlee(c.tp)+(c.p?', projet '+nomProjet(c.p):'');
    return 'Chrono à l’arrêt';
  }
  function rendrePointeuse(ctx){
    var c=D.chrono, etat=etatChrono();
    pt.racine.setAttribute('data-etat', etat);
    pt.etat.textContent=(etat==='marche')?'En marche':(etat==='pause'?'En pause':'Prêt');
    pt.hex.setAttribute('aria-label', (etat==='marche')?'Mettre en pause':(etat==='pause'?'Reprendre le chrono':'Démarrer le chrono'));
    pt.lib.textContent=(etat==='marche')?'Pause':(etat==='pause'?'Reprendre':'Démarrer');
    pt.stop.hidden=!c;
    cumulSession=c?minutesSession(c.s):0;
    var proj='', depuis='';
    if(etat==='marche'){ proj=c.p?nomProjet(c.p)+' · ':''; depuis='depuis '+heureRelative(c.t0, ctx.today); }
    else if(etat==='pause'){ proj=c.p?nomProjet(c.p)+' · ':''; depuis='pause depuis '+heureRelative(c.tp, ctx.today)+' · '+fmt.duree(Math.max(0, Math.floor((ctx.now-c.tp)/60000))); }
    else { var t=totalJour(ctx.today, ctx); depuis=t?'Aujourd’hui · '+fmt.duree(t):'Touchez l’hexagone pour démarrer'; }
    pt.projet.textContent=proj; pt.depuis.textContent=depuis;
    var sig=etat+'|'+(c?c.s+'|'+c.t0+'|'+c.tp+'|'+c.p:'');
    if(sig!==signatureEtat){ pt.desc.textContent=descriptionEtat(); signatureEtat=sig; }
    rendreSecondaires(etat, c);
    majChiffres(ctx.now);
  }
  function chiffresDe(now){
    var c=D && D.chrono, ms=0, recule=false;
    if(c && c.e==='marche'){ var dt=now-c.t0; if(dt<0){ recule=true; dt=0; } ms=cumulSession*60000+dt; }
    else if(c) ms=cumulSession*60000;
    var tot=Math.floor(ms/1000);
    return { h:pad2(Math.floor(tot/3600)), m:pad2(Math.floor(tot/60)%60), s:pad2(tot%60), recule:recule };
  }
  function animerMinute(n){
    if(reduit() || !n || typeof n.animate!=='function') return;
    n.animate([{ transform:'translateY(-30%)', opacity:0 },{ transform:'none', opacity:1 }], { duration:160, easing:EASE });
  }
  function poserChiffres(cibles, v, animer){
    if(cibles.h.textContent!==v.h) cibles.h.textContent=v.h;
    if(cibles.m.textContent!==v.m){ var avant=cibles.m.textContent; cibles.m.textContent=v.m; if(animer && avant) animerMinute(cibles.m); }
    cibles.s.textContent=':'+v.s;
    cibles.s.hidden=!R().secondes;
  }
  function majChiffres(now){
    if(!D) return;
    var v=chiffresDe(now), marche=etatChrono()==='marche';
    poserChiffres(pt, v, marche);
    if(fc.ouvert && fc.chiffres) poserChiffres(fc.chiffres, v, marche);
  }
  function animerHex(){
    if(reduit() || !pt.forme || typeof pt.forme.animate!=='function') return;
    pt.forme.animate([{ transform:'scale(.94)' },{ transform:'scale(1)' }], { duration:180, easing:EASE });
  }
  function rendreSecondaires(etat, c){
    var proj=c?c.p:(R().projetDemarrage==='dernier'?dernierProjetChrono():'');
    var sig=etat+'|'+proj+'|'+(proj?nomProjet(proj):'');
    if(pt.sec.getAttribute('data-sig')===sig) return;
    pt.sec.setAttribute('data-sig', sig);
    T.vider(pt.sec);
    function ajouter(texte, section, attrs){
      var b=el('button', Object.assign({ type:'button', class:'btn small ghost pt-sec', 'aria-haspopup':'dialog', 'aria-controls':'feuilleChrono' }, attrs||{}), texte);
      b.addEventListener('click', function(){ ouvrirFeuilleChrono(section, b); });
      pt.sec.appendChild(b);
    }
    if(etat==='repos') ajouter('Démarrer à…', 'demarrerA');
    if(etat==='marche'){ ajouter('Arrêter à…', 'arreterA'); ajouter('Corriger le début', 'debut'); }
    var p=projetDe(proj);
    ajouter([p?monogramme(p):el('span', { class:'h-mono vide', 'aria-hidden':'true' }), el('span', { class:'pt-sec-nom', text:p?p.nom:'Sans projet' })], 'projet',
      { 'aria-label':'Projet du chrono : '+(p?p.nom:'sans projet')+'. Changer', class:'btn small ghost pt-sec pt-sec-projet' });
  }

  /* Bannières (une à la fois, par priorité) : illisible / futur, éléments ignorés,
     chrono oublié, stockage indisponible, rappel de sauvegarde. Mises à jour EN
     PLACE si la même bannière reste affichée (pas de ré-annonce role=alert). */
  function joursDepuis(cle, today){
    var a=T.dates.depuisCle(cle), b=T.dates.depuisCle(today);
    return (a && b)?Math.round((b-a)/J24):0;
  }
  function aDesPlages(){ return Object.keys(D.jours).length>0; }
  function rappelDu(ctx){
    var n=R().rappelSauvegardeJours;
    if(!n || session.rappelPlusTard || memoire || lectureSeule || !aDesPlages()) return null;
    var ref=D.meta.derniereSauvegarde||D.meta.creeLe, j=joursDepuis(ref, ctx.today);
    return (j>=n)?{ jours:j, jamais:!D.meta.derniereSauvegarde }:null;
  }
  function banniere(type, cle, classe, ic, titre, detail, actions, alerte){
    var n=el('div', { class:'h-banniere '+classe, 'data-type':type, 'data-cle':cle, role:alerte?'alert':null }, [
      el('span', { class:'h-ban-ic', 'aria-hidden':'true' }, [ icone(ic, 18) ]),
      el('div', { class:'h-ban-texte' }, [ el('p', { class:'h-ban-titre', text:titre }), detail?el('p', { class:'h-ban-detail', text:detail }):null ]),
      el('div', { class:'h-ban-actions' }, actions)
    ]);
    return n;
  }
  function rendreBannieres(ctx){
    var zone=$('bannieres'), actuel=zone.firstElementChild, spec=null;
    if(statut==='illisible' || statut==='futur'){
      var illisible=statut==='illisible';
      spec={ type:statut, cle:statut, construire:function(){
        var acts=[ bouton('Exporter le brut', 'btn small', exporterBrut) ];
        if(illisible){ var r=bouton(el('span', { text:'Réinitialiser' }), 'btn small danger', null); deuxTemps(r, 'Confirmer la réinitialisation', reinitialiser); acts.push(r); }
        return banniere(statut, statut, 'is-danger', 'alerte', illisible?'Données Heures illisibles':'Lecture seule',
          illisible?'Elles ne sont ni modifiées ni écrasées. Exportez le brut pour les conserver, puis réinitialisez.':'Ces heures ont été créées par une version plus récente de TAF : consultation seulement.', acts, true);
      } };
    } else {
      // Priorité (spec §3.3) : illisible / futur > chrono oublié > stockage indisponible > « partiel » (discret) > rappel.
      var o=chronoOublie(ctx.now);
      if(o && session.oublis.indexOf(o.c.s)===-1){
        var titreOubli=function(){ return 'Chrono en marche depuis '+heureRelative(o.c.t0, ctx.today)+' ('+fmt.duree(Math.floor(o.duree/60000))+')'; };
        var detailOubli=function(){ return 'Si vous arrêtez maintenant : '+apercuDecoupe(o.c.t0, ctx.now); };
        spec={ type:'oubli', cle:o.c.s, maj:function(n){
          n.querySelector('.h-ban-titre').textContent=titreOubli();
          var d=n.querySelector('.h-ban-detail'); if(d) d.textContent=detailOubli();
          var b=n.querySelector('[data-fin]'); if(b){ var f=finProposee(o.c, ctx.now); b.setAttribute('data-fin', String(f)); b.textContent='Arrêté à '+heureRelative(f, ctx.today); }
        }, construire:function(){
          var fin=finProposee(o.c, ctx.now), s=o.c.s, premiere=session.oublisAnnonces.indexOf(s)===-1;
          if(premiere){ session.oublisAnnonces.push(s); ecrireSession(); }
          var bFin=bouton('Arrêté à '+heureRelative(fin, ctx.today), 'btn small primary', function(){ arreterChrono(+bFin.getAttribute('data-fin'), { libelle:'Arrêter le chrono oublié' }); }, { 'data-fin':String(fin) });
          var bChoisir=bouton('Choisir l’heure…', 'btn small', function(){ ouvrirFeuilleChrono('arreterA', bChoisir); }, { 'aria-haspopup':'dialog' });
          return banniere('oubli', s, 'is-alerte', 'chrono', titreOubli(), detailOubli(), [ bFin, bChoisir,
            bouton('C’est correct', 'btn small ghost', function(){ oubliTraite(s); rendreBannieres(contexte(maintenant())); focusSur(pt.hex); T.annoncer('Le chrono continue'); }) ], premiere);
        } };
      } else if(memoire){
        spec={ type:'memoire', cle:'m', construire:function(){
          return banniere('memoire', 'm', 'is-alerte', 'alerte', 'Mode temporaire : rien n’est enregistré sur cet appareil',
            'Le stockage local est indisponible (navigation privée ou blocage). Exportez vos heures avant de fermer.', [ bouton('Exporter', 'btn small', function(e){ ouvrirExport(e.currentTarget, 'json'); }) ], false);
        } };
      } else if(partiel && !session.partielMasque){
        spec={ type:'partiel', cle:String(partiel.ignores), construire:function(){
          return banniere('partiel', String(partiel.ignores), 'is-discret', 'info', pluriel(partiel.ignores, 'élément illisible ignoré', 'éléments illisibles ignorés'),
            partiel.details.length?'Détail : '+partiel.details.join(', ')+'.':'', [
              bouton('Exporter le brut d’origine', 'btn small ghost', exporterBrut),
              bouton('Masquer', 'btn small ghost', function(){ session.partielMasque=true; ecrireSession(); rendreBannieres(contexte(maintenant())); focusSur($('vueTitre')); })
            ], false);
        } };
      } else {
        var rp=rappelDu(ctx);
        if(rp) spec={ type:'rappel', cle:String(rp.jours), construire:function(){
          return banniere('rappel', String(rp.jours), 'is-info', 'exporter', rp.jamais?'Aucune sauvegarde depuis '+pluriel(rp.jours, 'jour'):'Dernière sauvegarde il y a '+pluriel(rp.jours, 'jour'),
            'Vos heures n’existent que sur cet appareil.', [
              bouton('Exporter', 'btn small primary', function(){ exporterJson(); }),
              bouton('Plus tard', 'btn small ghost', function(){ session.rappelPlusTard=true; ecrireSession(); rendreBannieres(contexte(maintenant())); focusSur($('vueTitre')); })
            ], false);
        } };
      }
    }
    if(!spec){ if(actuel) zone.textContent=''; return; }
    if(actuel && actuel.getAttribute('data-type')===spec.type && actuel.getAttribute('data-cle')===spec.cle){ if(spec.maj) spec.maj(actuel); return; }
    zone.textContent='';
    zone.appendChild(spec.construire());
  }

  // Confirmation intégrée en deux temps (5 s) : le libellé change, un second appui confirme.
  function deuxTemps(b, libelleConfirm, action){
    var lib=b.querySelector('span')||b, origine=lib.textContent, timer=null;
    function desarmer(){ if(timer){ clearTimeout(timer); timer=null; } b.classList.remove('h-arme'); lib.textContent=origine; b.removeAttribute('data-arme'); }
    b.addEventListener('click', function(){
      if(!b.hasAttribute('data-arme')){
        b.setAttribute('data-arme', '1'); b.classList.add('h-arme'); lib.textContent=libelleConfirm;
        T.annoncer(libelleConfirm+' : appuyez de nouveau pour confirmer.');
        timer=setTimeout(desarmer, 5000);
        return;
      }
      desarmer(); action();
    });
    return b;
  }
  function bouton(contenu, cls, fn, attrs){
    var b=el('button', Object.assign({ type:'button', class:cls }, attrs||{}), contenu);
    if(fn) b.addEventListener('click', fn);
    return b;
  }

  function rendreNavVues(){
    var idx=VUES.indexOf(ui.vue);
    Array.prototype.forEach.call(doc.querySelectorAll('.h-vues a[data-vue]'), function(a){
      if(a.getAttribute('data-vue')===ui.vue) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var ind=doc.querySelector('.h-vues-indic');
    if(ind) ind.style.setProperty('--i', String(idx));
  }

  /* ============================================================
     7. COMPOSANTS VISUELS (purs, sans état interne hors mémoire
        d'animation) : monogramme, mini-hexagone, jauge, frise.
  ============================================================ */
  function initiales(nom){
    var mots=T.normaliserTexte(nom).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    if(!mots.length) return '?';
    return mots.length===1?mots[0].slice(0, 2):(mots[0].charAt(0)+mots[1].charAt(0));
  }
  function monogramme(p){ return el('span', { class:'h-mono', 'data-t':String(p.t), 'aria-hidden':'true', text:initiales(p.nom) }); }
  function etiquetteProjet(id, classe){
    var p=projetDe(id);
    return el('span', { class:'h-projet'+(classe?' '+classe:'') }, p?[ monogramme(p), el('span', { class:'h-projet-nom', text:p.nom }) ]:[ el('span', { class:'h-mono vide', 'aria-hidden':'true' }), el('span', { class:'h-projet-nom sans', text:'Sans projet' }) ]);
  }
  function miniHex(cleMem, niveau, o){
    var liq=el('span', { class:'h-mhex-liq' });
    versValeur(liq, '--niv', cleMem, borner(niveau, 0, 1), o.anim, 0);
    return el('span', { class:'h-mhex', 'aria-hidden':'true' }, [ el('span', { class:'h-mhex-forme' }, [ liq ]) ]);
  }
  // Pastille CRA tri-état : règle et composant UNIQUES (TAF.pastilleJour, .pastille-jour de taf.css)
  function pastilleCra(dj, classe){ return T.pastilleJour(dj, classe); }
  function libelleCra(dj){
    if(dj.am && dj.pm) return '1 j CRA';
    if(dj.am) return '½ j CRA (matin)';
    if(dj.pm) return '½ j CRA (après-midi)';
    return '0 j CRA';
  }
  function libelleCraLong(dj){
    if(dj.am && dj.pm) return 'journée complète';
    if(dj.am) return 'demi-journée (matin)';
    if(dj.pm) return 'demi-journée (après-midi)';
    return 'aucune demi-journée';
  }

  function svgEl(tag, attrs){ var n=doc.createElementNS(NS, tag); Object.keys(attrs).forEach(function(k){ n.setAttribute(k, String(attrs[k])); }); return n; }
  function pointsHex(r){
    var p=[];
    for(var i=0;i<6;i++){ var a=(-90+60*i)*Math.PI/180; p.push((50+r*Math.cos(a)).toFixed(2)+','+(50+r*Math.sin(a)).toFixed(2)); }
    return p.join(' ');
  }
  // 6 côtés d'un hexagone pointe en haut ; chaque côté vaut 1/6 de l'objectif.
  var FACES=(function(){
    var R0=41, pts=[];
    for(var i=0;i<6;i++){ var a=(-90+60*i)*Math.PI/180; pts.push([50+R0*Math.cos(a), 50+R0*Math.sin(a)]); }
    return pts.map(function(p, i){ var q=pts[(i+1)%6]; return { x:p[0], y:p[1], ang:Math.atan2(q[1]-p[1], q[0]-p[0])*180/Math.PI, l:Math.sqrt(Math.pow(q[0]-p[0], 2)+Math.pow(q[1]-p[1], 2)) }; });
  })();
  /* rendreJauge : SVG de constantes (createElementNS) ; côtés remplis par
     scaleX(var(--f)) en cascade de 40 ms à la première apparition, puis le côté
     partiel glisse vers sa nouvelle longueur. role="img" + aria-labelledby. */
  function rendreJauge(valeur, objectif, cleMem, o, idTexte){
    var box=el('div', { class:'h-jauge' });
    var svg=svgEl('svg', { viewBox:'0 0 100 100', class:'h-jauge-svg', role:'img', 'aria-labelledby':idTexte, focusable:'false' });
    svg.appendChild(svgEl('polygon', { points:pointsHex(48.6), class:'h-jauge-ext' }));
    var fr=objectif>0?valeur/objectif:0, prec=memVal[cleMem], fractions=[];
    var anim=o.anim && !reduit();
    FACES.forEach(function(f, i){
      var g=svgEl('g', { transform:'translate('+f.x.toFixed(2)+' '+f.y.toFixed(2)+') rotate('+f.ang.toFixed(2)+')' });
      g.appendChild(svgEl('rect', { x:'0', y:'-3.3', width:f.l.toFixed(2), height:'6.6', rx:'3.3', class:'h-jauge-piste' }));
      var plein=svgEl('rect', { x:'0', y:'-3.3', width:f.l.toFixed(2), height:'6.6', rx:'3.3', class:'h-jauge-plein' });
      var cible=borner(fr*6-i, 0, 1);
      fractions.push(cible);
      var depart=anim?(Array.isArray(prec)?prec[i]:0):cible;
      plein.style.setProperty('--f', String(depart));
      plein.style.setProperty('--i', String(i));
      if(depart!==cible) transitionsEnAttente.push([plein, '--f', cible]);
      g.appendChild(plein);
      svg.appendChild(g);
    });
    memVal[cleMem]=fractions;
    if(anim && !Array.isArray(prec)) box.classList.add('cascade');
    if(objectif>0 && valeur>objectif) box.classList.add('depasse');
    box.appendChild(svg);
    return box;
  }

  /* Frise (rangées de plages sur un axe horaire automatique §6.9). Décorative
     (aria-hidden) : la liste des plages / les boutons de rangée sont la source
     accessible. Positions : --deb / --lar / --x en % bornés (CSSOM). */
  function axeFrise(rangees){
    var dMin=Infinity, fMax=-Infinity, c=minutes(R().coupure);
    rangees.forEach(function(r){ r.plages.concat(r.vivant||[]).forEach(function(p){ dMin=Math.min(dMin, minutes(p.d)); fMax=Math.max(fMax, minutes(p.f)); }); });
    if(!isFinite(dMin)) return { d:420, f:1140 };
    dMin=Math.min(dMin, c); fMax=Math.max(fMax, c);
    var d=Math.max(0, Math.floor((dMin-30)/60)*60), f=Math.min(1440, Math.ceil((fMax+30)/60)*60);
    while(f-d<480){ if(d>0) d-=60; if(f-d<480 && f<1440) f+=60; }
    return { d:d, f:f };
  }
  function rendreFrise(rangees, opts){
    var axe=axeFrise(rangees), span=axe.f-axe.d, c=minutes(R().coupure);
    function pct(m){ return borner((m-axe.d)/span*100, 0, 100); }
    var racine=el('div', { class:'h-frise '+(opts.classe||'') });
    var gradLigne=el('div', { class:'h-frise-ligne h-frise-axe', 'aria-hidden':'true' });
    if(opts.lignes) gradLigne.appendChild(el('span', { class:'h-fr-lib' }));
    var grad=el('div', { class:'h-frise-grad' });
    for(var m=axe.d;m<=axe.f;m+=60){
      var g=el('span', { class:'h-grad'+(((m/60)%2)?' impair':'')+(m===axe.d?' bord-g':(m===axe.f?' bord-d':'')), text:(m/60)+'h' });
      g.style.setProperty('--x', pct(m).toFixed(3)+'%');
      grad.appendChild(g);
    }
    var cl=el('span', { class:'h-coupure-lib', text:'M | A' });
    cl.style.setProperty('--x', pct(c).toFixed(3)+'%');
    grad.appendChild(cl);
    gradLigne.appendChild(grad);
    if(opts.lignes) gradLigne.appendChild(el('span', { class:'h-fr-tot' }));
    racine.appendChild(gradLigne);
    var nowMin=minutesMurales(maintenant());
    rangees.forEach(function(r){
      var piste=el('div', { class:'h-piste', 'aria-hidden':'true' });
      var cp=el('span', { class:'h-coupure' }); cp.style.setProperty('--x', pct(c).toFixed(3)+'%'); piste.appendChild(cp);
      var vus=blocsVus[r.cle], ids=Object.create(null), rang=0;
      r.plages.forEach(function(p){
        var pr=projetDe(p.p), deb=pct(minutes(p.d)), fin=pct(minutes(p.f));
        var b=el('span', { class:'h-bloc o-'+p.o, 'data-id':p.id, 'data-t':pr?String(pr.t):null });
        b.style.setProperty('--deb', deb.toFixed(3)+'%');
        b.style.setProperty('--lar', Math.max(0.5, fin-deb).toFixed(3)+'%');
        if(opts.anim && !reduit() && (opts.entree || (opts.meme && vus && !vus[p.id]))){ b.classList.add('nouveau'); b.style.setProperty('--i', String(rang++)); }
        ids[p.id]=true;
        piste.appendChild(b);
      });
      blocsVus[r.cle]=ids;
      (r.vivant||[]).forEach(function(p){
        var deb=pct(minutes(p.d)), fin=pct(minutes(p.f)), b=el('span', { class:'h-bloc vivant' });
        b.style.setProperty('--deb', deb.toFixed(3)+'%'); b.style.setProperty('--lar', Math.max(0.5, fin-deb).toFixed(3)+'%');
        piste.appendChild(b);
      });
      if(r.auj && nowMin>=axe.d && nowMin<=axe.f){ var ln=el('span', { class:'h-maintenant' }); ln.style.setProperty('--x', pct(nowMin).toFixed(3)+'%'); piste.appendChild(ln); }
      if(opts.surClic) (function(cle){
        piste.addEventListener('click', function(e){
          var bloc=e.target.closest && e.target.closest('.h-bloc[data-id]');
          if(bloc){ opts.surClic(cle, null, bloc.getAttribute('data-id')); return; }
          var rc=piste.getBoundingClientRect(); if(!rc.width) return;
          opts.surClic(cle, axe.d+borner((e.clientX-rc.left)/rc.width, 0, 1)*span, null);
        });
      })(r.cle);
      if(opts.lignes) racine.appendChild(opts.lignes(r, piste));
      else racine.appendChild(el('div', { class:'h-frise-ligne' }, [ piste ]));
    });
    return racine;
  }

  /* ============================================================
     8. VUES JOUR & SEMAINE
  ============================================================ */
  function ouvre(cle){ return R().joursOuvres.indexOf(isoJour(cle))!==-1; }
  function journeeType(){ var jt=R().journeeType; return (Array.isArray(jt) && jt.length)?jt:null; }
  function dureeJt(){ var jt=journeeType(); return jt?jt.reduce(function(t, x){ return t+minutes(x.f)-minutes(x.d); }, 0):0; }

  // En-tête de période : sur-titre, h1, ‹ › (44 px) et retour au présent (réservé : aucun décalage).
  function enTete(o){
    var prec=bouton(icone('gauche', 20), 'btn iconly h-nav-btn', function(){ deplacer(-1); }, { 'aria-label':o.prec, title:o.prec, 'data-focus':'prec', 'aria-keyshortcuts':'ArrowLeft' });
    var suiv=bouton(icone('droite', 20), 'btn iconly h-nav-btn', function(){ deplacer(1); }, { 'aria-label':o.suiv, title:o.suiv, 'data-focus':'suiv', 'aria-keyshortcuts':'ArrowRight' });
    var retour=bouton(o.retour, 'btn small h-retour'+(o.retourVisible?'':' h-invisible'), allerAujourdhui, { 'data-focus':'retour', 'aria-keyshortcuts':'T', 'aria-hidden':o.retourVisible?null:'true', tabindex:o.retourVisible?null:'-1' });
    var tete=el('div', { class:'h-entete'+(o.glisser?' glissable':'') }, [
      el('div', { class:'h-entete-titres' }, [ el('p', { class:'eyebrow h-sur', text:o.sur }), el('h1', { class:'h-titre', id:'vueTitre', tabindex:'-1', text:o.titre }) ]),
      el('div', { class:'h-periode-nav' }, [ retour, prec, suiv ])
    ]);
    if(o.glisser) activerGlissement(tete);
    return tete;
  }
  // Glissement horizontal (tactile) : seuil 60 px et |dx| > 1,5·|dy|. Alternative : ‹ › et ← / →.
  function activerGlissement(zone){
    var x0=0, y0=0, id=null;
    zone.addEventListener('pointerdown', function(e){ if(e.pointerType==='mouse') return; id=e.pointerId; x0=e.clientX; y0=e.clientY; });
    zone.addEventListener('pointerup', function(e){
      if(id===null || e.pointerId!==id) return; id=null;
      var dx=e.clientX-x0, dy=e.clientY-y0;
      if(Math.abs(dx)>60 && Math.abs(dx)>1.5*Math.abs(dy)) deplacer(dx<0?1:-1);
    });
    zone.addEventListener('pointercancel', function(){ id=null; });
  }
  function surTitreJour(cle, today){
    var diff=joursDepuis(today, cle);
    if(diff===0) return 'Aujourd’hui';
    if(diff===-1) return 'Hier';
    if(diff===1) return 'Demain';
    if(diff<0 && diff>=-6) return 'Il y a '+(-diff)+' jours';
    var s=T.dates.semaineIso(cle);
    return 'Semaine '+s.semaine+(cle.slice(0, 4)!==today.slice(0, 4)?' · '+cle.slice(0, 4):'');
  }

  function construireJour(ctx, o){
    var cle=ui.ref, f=doc.createDocumentFragment();
    f.appendChild(enTete({ sur:surTitreJour(cle, ctx.today), titre:dateLongue(cle), prec:'Jour précédent', suiv:'Jour suivant', retour:'Aujourd’hui', retourVisible:cle!==ctx.today, glisser:true }));
    f.appendChild(bandeSemaine(cle, ctx, o));
    if(!D.meta.accueilVu && !lectureSeule) f.appendChild(carteAccueil());
    var grille=el('div', { class:'h-jour-grille' }, [ carteJour(cle, ctx, o), cartePlages(cle, ctx, o) ]);
    f.appendChild(grille);
    return f;
  }

  // Bande semaine : 7 boutons, mini-hexagone à niveau (total / durée de la journée) + total.
  function bandeSemaine(cle, ctx, o){
    var lundi=T.dates.lundiDe(cle), noms=T.dates.enTetesSemaine('initiale'), idx=0;
    var wrap=el('div', { class:'h-bande', role:'group', 'aria-label':'Semaine du '+fmt.dateLongue(lundi) });
    var indic=el('span', { class:'h-bande-indic', 'aria-hidden':'true' });
    wrap.appendChild(indic);
    for(var i=0;i<7;i++){
      var k=T.dates.ajouterJours(lundi, i), tot=totalJour(k, ctx);
      if(k===cle) idx=i;
      var b=el('button', { type:'button', class:'h-bj'+(ouvre(k)?'':' non-ouvre')+(k===ctx.today?' auj':''), 'aria-pressed':String(k===cle),
        'aria-current':k===ctx.today?'date':null, 'aria-label':dateLongue(k)+', '+(tot?fmt.duree(tot):'rien'), 'data-focus':'bj-'+i }, [
        el('span', { class:'h-bj-l', 'aria-hidden':'true' }, [ noms[i], el('span', { class:'h-bj-n', text:String(+k.slice(8)) }) ]),
        miniHex('bj-'+k, tot/R().dureeJourMin, o),
        el('span', { class:'h-bj-t', 'aria-hidden':'true', text:tot?fmt.decimal(tot):'–' })
      ]);
      (function(k){ b.addEventListener('click', function(){ allerA('jour', k); }); })(k);
      wrap.appendChild(b);
    }
    versValeur(indic, '--i', 'bande-'+lundi, idx, o.anim && o.meme===false && ui.vue==='jour');
    return wrap;
  }

  // Carte du jour : jauge (durée de la journée), total, reste / dépassement, ligne CRA, frise.
  function carteJour(cle, ctx, o){
    var plages=plagesAvecVivant(cle, ctx), tot=H.unionMinutes(plages), obj=R().dureeJourMin;
    var dj=H.demiJournees(plages, R());
    var reste=(tot<obj)?'reste '+fmt.duree(obj-tot):((tot>obj)?'+ '+fmt.duree(tot-obj)+' au-delà':'journée complète');
    var texte=el('div', { class:'h-tot' }, [
      el('p', { class:'h-tot-val', id:'jaugeJourTxt' }, [ el('b', { text:fmt.duree(tot) }), el('span', { text:' sur '+fmt.duree(obj) }) ]),
      el('p', { class:'h-tot-reste'+(tot>obj?' depasse':''), text:reste }),
      el('p', { class:'h-ligne-cra' }, [ pastilleCra(dj), el('b', { class:'h-cra-res', text:libelleCra(dj) }), el('span', { class:'h-cra-detail', text:'Matin '+fmt.duree(dj.minAm)+' · Après-midi '+fmt.duree(dj.minPm) }) ])
    ]);
    var haut=el('div', { class:'h-carte-jour-haut' }, [ rendreJauge(tot, obj, 'jauge-jour', o, 'jaugeJourTxt'), texte ]);
    var frise=rendreFrise([{ cle:cle, plages:plagesDe(cle), vivant:vivantDe(cle, ctx), auj:cle===ctx.today }], {
      classe:'jour', anim:o.anim, meme:o.meme, entree:o.entree,
      surClic:function(k, minute, id){
        if(id) ouvrirFeuillePlage(k, id);
        else { var d=borner(H.arrondir(minute, 15, 'proche'), 0, 1425); ouvrirFeuillePlage(k, null, { d:d, f:Math.min(1440, d+60) }); }
      }
    });
    return el('section', { class:'h-carte h-carte-jour', 'aria-labelledby':'carteJourTitre' }, [
      el('h2', { class:'h-carte-titre sr-only', id:'carteJourTitre', text:'Total du jour' }), haut, frise ]);
  }

  function cartePlages(cle, ctx, o){
    var plages=plagesDe(cle), viv=vivantDe(cle, ctx), menu=menuJour(cle);
    var tete=el('div', { class:'h-carte-tete' }, [ el('h2', { class:'h-carte-titre', id:'plagesTitre' }, [ 'Plages', plages.length?el('span', { class:'h-compte', text:String(plages.length) }):null ]), menu ]);
    var ul=el('ul', { class:'h-plages', 'aria-labelledby':'plagesTitre' });
    if(viv.length && D.chrono) ul.appendChild(ligneEnCours(cle, viv));
    plages.forEach(function(p, i){ ul.appendChild(lignePlage(cle, p, plages[i+1]||null)); });
    var contenu=[ tete ];
    if(ul.childNodes.length) contenu.push(ul);
    else contenu.push(el('p', { class:'h-vide-txt', text:(cle>ctx.today)?'Rien de prévu ce jour.':(cle===ctx.today?'Aucune plage aujourd’hui. Démarrez le chrono, tapez une saisie rapide ou appliquez votre journée type.':'Aucune plage ce jour.') }));
    contenu.push(actionsJour(cle, ctx));
    return el('section', { class:'h-carte h-carte-plages', 'aria-labelledby':'plagesTitre' }, contenu);
  }
  function lignePlage(cle, p, suivante){
    var pr=projetDe(p.p), dur=minutes(p.f)-minutes(p.d);
    var b=el('button', { type:'button', class:'h-ligne o-'+p.o, 'data-focus':'pl-'+p.id, 'data-t':pr?String(pr.t):null, 'aria-haspopup':'dialog',
      'aria-label':p.d+' à '+p.f+', '+fmt.dureeLongue(dur)+', '+(pr?pr.nom:'sans projet')+(p.n?', '+p.n:'')+', '+NOMS_ORIGINE[p.o]+'. Modifier' }, [
      el('span', { class:'h-l-heures' }, [ el('span', { text:p.d }), el('span', { class:'h-l-fl', 'aria-hidden':'true', text:'→' }), el('span', { text:p.f }) ]),
      el('span', { class:'h-l-duree', text:fmt.duree(dur) }),
      etiquetteProjet(p.p, 'h-l-projet'),
      p.n?el('span', { class:'h-l-note', text:p.n }):null,
      el('span', { class:'h-l-orig', title:'Origine : '+NOMS_ORIGINE[p.o] }, [ icone(ICONE_ORIGINE[p.o]||'saisie', 15) ])
    ]);
    b.addEventListener('click', function(){ ouvrirFeuillePlage(cle, p.id, null, b); });
    b.addEventListener('keydown', function(e){
      if((e.key==='Delete' || e.key==='Backspace') && !e.altKey && !e.ctrlKey && !e.metaKey){
        e.preventDefault();
        supprimerPlage(cle, p.id, suivante?'pl-'+suivante.id:'ajout');
      }
    });
    return el('li', { 'data-flip':'pl-'+p.id }, [ b ]);
  }
  function ligneEnCours(cle, viv){
    var c=D.chrono, dur=H.unionMinutes(viv), depuis=heureRelative(c.t0, cle);
    var b=el('button', { type:'button', class:'h-ligne en-cours', 'data-focus':'encours', 'aria-haspopup':'dialog', 'aria-controls':'feuilleChrono',
      'aria-label':'En cours depuis '+depuis+', '+fmt.dureeLongue(dur)+(c.p?', '+nomProjet(c.p):'')+'. Détails du chrono' }, [
      el('span', { class:'h-l-heures' }, [ el('span', { class:'h-l-pulse', 'aria-hidden':'true' }), el('span', { text:'En cours depuis '+depuis }) ]),
      el('span', { class:'h-l-duree', text:fmt.duree(dur) }),
      etiquetteProjet(c.p, 'h-l-projet'),
      el('span', { class:'h-l-orig', title:'Origine : chrono' }, [ icone('chrono', 15) ])
    ]);
    b.addEventListener('click', function(){ ouvrirFeuilleChrono(null, b); });
    return el('li', { 'data-flip':'encours' }, [ b ]);
  }
  function actionsJour(cle, ctx){
    var wrap=el('div', { class:'h-actions-jour' }), jt=journeeType(), vide=!plagesDe(cle).length, ici=vivantDe(cle, ctx).length>0;
    var c=D.chrono, chronoIci=!!(c && (ici || (c.e==='marche' && T.dates.cle(c.t0)===cle) || (c.e==='pause' && cle===ctx.today)));
    var primaire=(cle<ctx.today) || !!(c && !chronoIci);
    if(!jt) wrap.appendChild(bouton([ icone('modele', 16), 'Définir ma journée type' ], 'btn', function(){ ouvrirReglages('secJt'); }, { 'data-focus':'jt', 'aria-haspopup':'dialog' }));
    else if(vide && !ici) wrap.appendChild(bouton([ icone('modele', 16), 'Journée type · '+fmt.duree(dureeJt()) ], 'btn'+(primaire?' primary':''), function(){ appliquerJourneeType(cle, 'vide'); }, { 'data-focus':'jt', 'aria-keyshortcuts':'J' }));
    else wrap.appendChild(bouton([ icone('modele', 16), 'Compléter avec la journée type' ], 'btn', function(){ appliquerJourneeType(cle, 'completer'); }, { 'data-focus':'jt', 'aria-keyshortcuts':'J' }));
    wrap.appendChild(bouton([ icone('plus', 16), 'Plage' ], 'btn'+((vide && !ici && !jt && cle<=ctx.today)?' primary':''), function(e){ ouvrirFeuillePlage(cle, null, null, e.currentTarget); },
      { 'data-focus':'ajout', 'aria-keyshortcuts':'N', 'aria-label':'Ajouter une plage', 'aria-haspopup':'dialog' }));
    return wrap;
  }
  // Menu ⋯ du jour (divulgation simple) : enregistrer comme journée type, vider le jour.
  function menuJour(cle){
    if(!plagesDe(cle).length) return null;
    var ouvert=ui.menu===cle;
    var tog=el('button', { type:'button', class:'btn small ghost iconly h-menu-btn', 'aria-label':'Autres actions du jour', title:'Autres actions', 'aria-expanded':String(ouvert), 'aria-controls':'menuJour', 'data-focus':'menu' }, [ icone('menu', 18) ]);
    var liste=el('div', { class:'h-menu', id:'menuJour', hidden:!ouvert });
    var bJt=el('button', { type:'button', class:'h-menu-item', 'data-focus':'menu-jt' }, [ icone('modele', 16), el('span', { text:'Enregistrer comme journée type' }) ]);
    if(journeeType()) deuxTemps(bJt, 'Remplacer la journée type actuelle ?', function(){ fermerMenu(); enregistrerCommeJourneeType(cle); });
    else bJt.addEventListener('click', function(){ fermerMenu(); enregistrerCommeJourneeType(cle); });
    var bVider=el('button', { type:'button', class:'h-menu-item danger', 'data-focus':'menu-vider' }, [ icone('corbeille', 16), el('span', { text:'Vider le jour' }) ]);
    bVider.addEventListener('click', function(){ fermerMenu(); viderJour(cle); });
    liste.appendChild(bJt); liste.appendChild(bVider);
    function fermerMenu(rendreFocus){ ui.menu=null; liste.hidden=true; tog.setAttribute('aria-expanded', 'false'); if(rendreFocus) focusSur(tog); }
    tog.addEventListener('click', function(){
      if(ui.menu===cle){ fermerMenu(); return; }
      ui.menu=cle; liste.hidden=false; tog.setAttribute('aria-expanded', 'true'); focusSur(bJt);
    });
    liste.addEventListener('keydown', function(e){ if(e.key==='Escape'){ e.preventDefault(); fermerMenu(true); } });
    return el('div', { class:'h-menu-wrap' }, [ tog, liste ]);
  }

  // Premier lancement : la journée type proposée (§6.10), ajustable par ±15 min.
  function carteAccueil(){
    var r=R(), deb=minutes(r.debutHabituel), demi=Math.round(r.dureeJourMin/2);
    if(!ui.accueil){
      var d2=Math.min(1380, deb+demi+r.pauseDejMin);
      ui.accueil=[ { d:deb, f:Math.min(1440, deb+demi) }, { d:d2, f:Math.min(1440, d2+demi) } ];
    }
    var lignes=ui.accueil.map(function(x, i){
      var lib=i===0?'Matin':'Après-midi';
      function tuile(champ, nom){
        var id='acc'+i+champ;
        var input=el('input', { class:'taf-input h-heure', type:'time', step:'60', id:id, value:versHHMM(Math.min(1439, x[champ])) });
        input.addEventListener('change', function(){ var m=minutes(input.value); if(isFinite(m)){ x[champ]=m; majDuree(); } });
        var moins=bouton('−15', 'h-pas', function(){ x[champ]=borner(x[champ]-15, 0, 1439); input.value=versHHMM(x[champ]); majDuree(); }, { 'aria-label':lib+' : '+nom+' moins 15 minutes' });
        var plus=bouton('+15', 'h-pas', function(){ x[champ]=borner(x[champ]+15, 0, 1439); input.value=versHHMM(x[champ]); majDuree(); }, { 'aria-label':lib+' : '+nom+' plus 15 minutes' });
        return el('div', { class:'h-tuile' }, [ el('label', { class:'h-label', for:id, text:lib+' — '+nom }), el('div', { class:'h-tuile-ligne' }, [ moins, input, plus ]) ]);
      }
      return el('div', { class:'h-acc-ligne' }, [ tuile('d', 'début'), tuile('f', 'fin') ]);
    });
    var duree=el('p', { class:'h-acc-duree', 'aria-live':'off' });
    var erreur=el('p', { class:'h-erreur', role:'alert', hidden:true });
    function majDuree(){
      var t=ui.accueil.reduce(function(s, x){ return s+Math.max(0, x.f-x.d); }, 0);
      duree.textContent='Total : '+fmt.duree(t);
    }
    majDuree();
    var ok=bouton('C’est ma journée', 'btn primary', function(){
      var jt=ui.accueil.map(function(x){ return { d:versHHMM(x.d), f:versHHMM(x.f), p:'' }; });
      var valide=jt.every(function(x){ return minutes(x.f)>minutes(x.d); }) && minutes(jt[1].d)>=minutes(jt[0].f);
      if(!valide){ erreur.textContent='Chaque fin doit suivre son début, sans chevauchement.'; erreur.hidden=false; return; }
      var res=muter('Journée type', function(e){
        var o=clone(e.reglages); o.journeeType=jt;
        e.reglages=H.validerReglages(o, e.projets); e.meta.accueilVu=true;
      });
      if(res){ ui.accueil=null; ui.focusApres='jt'; T.annoncer('Journée type enregistrée : '+fmt.dureeLongue(dureeJt())); focusSur(pt.hex); }
    }, { 'data-focus':'acc-ok' });
    var passer=bouton('Passer', 'btn ghost', function(){
      var res=muter('Accueil', function(e){ e.meta.accueilVu=true; }, { pile:false });
      if(res){ ui.accueil=null; focusSur(pt.hex); }
    }, { 'data-focus':'acc-passer' });
    return el('section', { class:'h-carte h-accueil', 'aria-labelledby':'accueilTitre' }, [
      el('span', { class:'eyebrow', text:'Bienvenue' }),
      el('h2', { class:'h-accueil-titre', id:'accueilTitre', text:'Votre journée type' }),
      el('p', { class:'h-accueil-txt', text:'Appliquée en un toucher sur les jours où vous n’avez pas pointé. Ajustez-la, elle reste modifiable dans les réglages.' }),
      el('div', { class:'h-acc-lignes' }, lignes), duree, erreur,
      el('div', { class:'h-acc-actions' }, [ ok, passer ]),
      el('p', { class:'h-accueil-indice' }, [ el('span', { class:'h-indice-hex', 'aria-hidden':'true' }), 'Touchez l’hexagone pour démarrer le chrono.' ])
    ]);
  }

  /* --- Vue Semaine --- */
  function libelleSemaine(lundi){
    var dim=T.dates.ajouterJours(lundi, 6), a=T.dates.depuisCle(lundi), b=T.dates.depuisCle(dim);
    var mois=function(d){ return d.toLocaleDateString('fr-FR', { month:'short' }); };
    if(a.getMonth()===b.getMonth()) return a.getDate()+'–'+b.getDate()+' '+mois(b);
    return a.getDate()+' '+mois(a)+' – '+b.getDate()+' '+mois(b);
  }
  function joursVidesSemaine(lundi, ctx){
    var l=[];
    for(var i=0;i<7;i++){ var k=T.dates.ajouterJours(lundi, i); if(ouvre(k) && k<=ctx.today && !plagesDe(k).length && !vivantDe(k, ctx).length) l.push(k); }
    return l;
  }
  function construireSemaine(ctx, o){
    var lundi=T.dates.lundiDe(ui.ref), dim=T.dates.ajouterJours(lundi, 6), iso=T.dates.semaineIso(lundi);
    var f=doc.createDocumentFragment(), contient=(ctx.today>=lundi && ctx.today<=dim);
    f.appendChild(enTete({ sur:(contient?'Cette semaine':(lundi.slice(0, 4)!==ctx.today.slice(0, 4)?String(iso.annee):'Semaine')), titre:'Semaine '+iso.semaine+' · '+libelleSemaine(lundi),
      prec:'Semaine précédente', suiv:'Semaine suivante', retour:'Cette semaine', retourVisible:!contient }));
    var jours=[], tot=0, cra=0, pointes=0;
    for(var i=0;i<7;i++){
      var k=T.dates.ajouterJours(lundi, i), pl=plagesAvecVivant(k, ctx), t=H.unionMinutes(pl), dj=H.demiJournees(pl, R());
      jours.push({ cle:k, plages:plagesDe(k), vivant:vivantDe(k, ctx), total:t, dj:dj });
      tot+=t; cra+=(dj.am?0.5:0)+(dj.pm?0.5:0); if(t) pointes++;
    }
    var obj=R().objHebdoMin, revolue=dim<ctx.today;
    // Héros : jauge d'objectif + tuiles
    var reste;
    if(!obj) reste={ l:'Objectif', v:'aucun' };
    else if(tot<obj) reste=revolue?{ l:'Écart', v:fmt.duree(obj-tot)+' sous l’objectif' }:{ l:'Reste', v:fmt.duree(obj-tot) };
    else if(tot===obj) reste={ l:'Objectif', v:'Atteint ✓' };
    else reste={ l:'Au-delà', v:'+ '+fmt.duree(tot-obj)+' au-delà de l’objectif' };
    var tuiles=el('dl', { class:'h-tuiles-sem' }, [
      tuileStat('Semaine', fmt.duree(tot)+(obj?' / '+fmt.duree(obj):''), 'principale'),
      tuileStat(reste.l, reste.v, (obj && tot>=obj)?'atteint':''),
      contient?tuileStat('Aujourd’hui', fmt.duree(totalJour(ctx.today, ctx))):tuileStat('Jours pointés', String(pointes)),
      tuileStat('Équivalent CRA', fmt.jours(cra))
    ]);
    var texteJauge=el('p', { class:'h-jauge-centre', id:'jaugeSemTxt' }, [ el('b', { text:fmt.duree(tot) }), el('span', { text:obj?'sur '+fmt.duree(obj):'cette semaine' }) ]);
    var jaugeBox=obj?rendreJauge(tot, obj, 'jauge-sem', o, 'jaugeSemTxt'):el('div', { class:'h-jauge sans-objectif' });
    if(obj){
      var cleSem=lundi;
      if(tot<obj) sousObjectif[cleSem]=true;
      else if(sousObjectif[cleSem] && session.objectifs.indexOf(cleSem)===-1){
        session.objectifs.push(cleSem); ecrireSession(); delete sousObjectif[cleSem];
        if(o.anim && !reduit()) jaugeBox.classList.add('pop');
        T.annoncer('Objectif de la semaine atteint : '+fmt.dureeLongue(tot));
      }
      if(tot>obj) jaugeBox.appendChild(el('span', { class:'h-jauge-plus', 'aria-hidden':'true', text:'+ '+fmt.duree(tot-obj) }));
    }
    jaugeBox.appendChild(texteJauge);
    f.appendChild(el('section', { class:'h-carte h-heros', 'aria-labelledby':'herosTitre' }, [ el('h2', { class:'sr-only', id:'herosTitre', text:'Objectif de la semaine' }), jaugeBox, tuiles ]));

    // Frise des 7 jours (une rangée par jour, chaque rangée est un bouton)
    var vide=!tot;
    var rangees=jours.slice(), sam=jours[5], dimJ=jours[6];
    var replie=!ui.deplies[lundi] && !ouvre(sam.cle) && !ouvre(dimJ.cle) && !sam.total && !dimJ.total;
    if(replie) rangees=jours.slice(0, 5);
    var frise=rendreFrise(rangees.map(function(j){ return { cle:j.cle, plages:j.plages, vivant:j.vivant, auj:j.cle===ctx.today, j:j }; }), {
      classe:'semaine'+(vide?' fantome':''), anim:o.anim, meme:o.meme, entree:o.entree,
      lignes:function(r, piste){
        var j=r.j, nom=T.dates.enTetesSemaine('court')[isoJour(j.cle)-1]+' '+(+j.cle.slice(8));
        var videOuvre=!j.total && ouvre(j.cle) && j.cle<ctx.today;
        var b=el('button', { type:'button', class:'h-frise-ligne h-sf-rangee'+(r.auj?' auj':'')+(ouvre(j.cle)?'':' non-ouvre'), 'data-focus':'sf-'+j.cle,
          'aria-current':r.auj?'date':null, 'aria-label':dateLongue(j.cle)+', '+(j.total?fmt.duree(j.total)+', '+libelleCraLong(j.dj):(videOuvre?'vide':'rien'))+'. Voir le jour' }, [
          el('span', { class:'h-fr-lib', 'aria-hidden':'true', text:nom }), piste,
          el('span', { class:'h-fr-tot'+(videOuvre?' vide':''), 'aria-hidden':'true', text:j.total?fmt.duree(j.total):(videOuvre?'vide':'') })
        ]);
        b.addEventListener('click', function(){ allerA('jour', j.cle); });
        return b;
      }
    });
    if(replie){
      var weTxt=T.dates.enTetesSemaine('court')[5]+' '+(+sam.cle.slice(8))+' · '+T.dates.enTetesSemaine('court')[6]+' '+(+dimJ.cle.slice(8))+' — rien';
      var bWe=bouton(el('span', { text:weTxt }), 'h-sf-we', function(){ ui.deplies[lundi]=true; ui.focusApres='sf-'+sam.cle; rendre({ anim:true }); }, { 'aria-expanded':'false', 'data-focus':'sf-we' });
      frise.appendChild(bWe);
    }
    var carteFrise=el('section', { class:'h-carte h-carte-frise-sem', 'aria-labelledby':'friseSemTitre' }, [
      el('div', { class:'h-carte-tete' }, [ el('h2', { class:'h-carte-titre', id:'friseSemTitre', text:'Jour par jour' }) ]) ]);
    if(vide) carteFrise.appendChild(el('p', { class:'h-vide-txt', text:'Aucune heure cette semaine. Démarrez le chrono ou appliquez votre journée type.' }));
    carteFrise.appendChild(frise);
    f.appendChild(carteFrise);

    // Action principale : remplir les jours ouvrés vides (≤ aujourd'hui)
    var vides=joursVidesSemaine(lundi, ctx);
    if(vides.length){
      var lib=journeeType()?'Remplir '+pluriel(vides.length, 'jour ouvré vide', 'jours ouvrés vides'):'Définir ma journée type';
      var bRemplir=bouton([ icone('modele', 17), lib ], 'btn primary h-remplir', function(){ if(journeeType()) remplirJoursOuvresVides(lundi); else ouvrirReglages('secJt'); }, { 'data-focus':'remplir' });
      f.appendChild(el('div', { class:'h-action-collante' }, [ bRemplir ]));
    }
    return f;
  }
  function tuileStat(libelle, valeur, classe){
    return el('div', { class:'h-tuile-stat'+(classe?' '+classe:'') }, [ el('dt', { text:libelle }), el('dd', { text:valeur }) ]);
  }

  /* ============================================================
     9. VUE MOIS — ruche à niveaux, synthèse, répartition par projet,
        tableau. Nombres CRA : TAF.heures.resumeMois / demiJournees
        (règle unique, mêmes nombres que le CRA et le CSV).
  ============================================================ */
  // Résumé du mois, segment vivant compris (lecture : rien n'est écrit).
  function resumeAvecVivant(a, m0, ctx){
    var jours=Object.create(null);
    Object.keys(D.jours).forEach(function(k){ jours[k]=D.jours[k]; });
    Object.keys(ctx.vivants).forEach(function(k){ if(T.dates.cleValide(k)) jours[k]=plagesAvecVivant(k, ctx); });
    return H.resumeMois({ jours:jours, reglages:D.reglages, projets:D.projets }, a, m0);
  }
  // Pourcentages entiers dont la somme vaut 100 (méthode du plus fort reste).
  function pourcentages(valeurs){
    var tot=valeurs.reduce(function(s, v){ return s+v; }, 0);
    if(!tot) return valeurs.map(function(){ return 0; });
    var bruts=valeurs.map(function(v){ return v*100/tot; }), ent=bruts.map(Math.floor);
    var reste=100-ent.reduce(function(s, v){ return s+v; }, 0);
    bruts.map(function(v, i){ return { i:i, r:v-Math.floor(v) }; }).sort(function(x, y){ return y.r-x.r || x.i-y.i; }).slice(0, reste).forEach(function(x){ ent[x.i]++; });
    return ent;
  }
  function construireMois(ctx, o){
    var d=T.dates.depuisCle(ui.ref), a=d.getFullYear(), m0=d.getMonth(), prefixe=ui.ref.slice(0, 7);
    var f=doc.createDocumentFragment(), courant=(prefixe===ctx.today.slice(0, 7));
    f.appendChild(enTete({ sur:courant?'Ce mois':String(a), titre:T.MOIS[m0]+' '+a, prec:'Mois précédent', suiv:'Mois suivant', retour:'Ce mois', retourVisible:!courant }));
    var resume=resumeAvecVivant(a, m0, ctx), nums=Object.keys(resume).map(Number).sort(function(x, y){ return x-y; });
    var total=0, cra=0;
    nums.forEach(function(n){ total+=resume[n].min; cra+=(resume[n].am?0.5:0)+(resume[n].pm?0.5:0); });

    var gauche=el('div', { class:'h-mois-g' }), droite=el('div', { class:'h-mois-d' });
    var basculer=bouton([ icone(ui.tableau?'ruche':'tableau', 16), ui.tableau?'Voir la ruche':'Voir en tableau' ], 'btn small ghost', function(){ ui.tableau=!ui.tableau; ui.focusApres='bascule-tableau'; rendre({ anim:true }); }, { 'data-focus':'bascule-tableau', 'aria-pressed':String(ui.tableau) });
    var carteG=el('section', { class:'h-carte h-carte-ruche', 'aria-labelledby':'rucheTitre' }, [
      el('div', { class:'h-carte-tete' }, [ el('h2', { class:'h-carte-titre', id:'rucheTitre', text:ui.tableau?'Jour par jour':'Ruche du mois' }), basculer ]),
      ui.tableau?tableauMois(a, m0, resume, nums):rendreRuche(a, m0, resume, ctx, o)
    ]);
    if(!ui.tableau) carteG.appendChild(el('p', { class:'h-legende', 'aria-hidden':'true' }, [
      el('span', { class:'h-leg h-leg-niv' }, [ el('i'), 'remplissage = heures / journée' ]),
      el('span', { class:'h-leg h-leg-non' }, [ el('i'), 'non ouvré' ]),
      el('span', { class:'h-leg' }, [ pastilleCra({ am:true, pm:false }), 'équivalent CRA' ])
    ]));
    gauche.appendChild(carteG);

    // Synthèse
    var moyenne=nums.length?Math.round(total/nums.length):0;
    droite.appendChild(el('section', { class:'h-carte h-synthese', 'aria-labelledby':'syntheseTitre' }, [
      el('div', { class:'h-carte-tete' }, [ el('h2', { class:'h-carte-titre', id:'syntheseTitre', text:'Synthèse' }) ]),
      el('dl', { class:'h-stats' }, [
        tuileStat('Total du mois', fmt.duree(total), 'principale'),
        tuileStat('Jours pointés', String(nums.length)),
        tuileStat('Moyenne / jour pointé', nums.length?fmt.duree(moyenne):'—'),
        tuileStat('Équivalent CRA', fmt.jours(cra), 'cra')
      ])
    ]));
    droite.appendChild(repartitionProjets(prefixe, ctx, o));
    // Actions : primaire « Ouvrir dans le CRA », secondaires Exporter / tableau
    var lienCra=el('a', { class:'btn primary h-ouvrir-cra', href:'index.html'+H.hashCra(a, m0), 'data-focus':'ouvrir-cra' }, [ icone('cra', 17), 'Ouvrir dans le CRA' ]);
    var exp=bouton([ icone('exporter', 16), 'Exporter…' ], 'btn', function(e){ ouvrirExport(e.currentTarget, null, 'mois'); }, { 'data-focus':'exporter', 'aria-haspopup':'dialog', 'aria-controls':'dialogueExport' });
    droite.appendChild(el('div', { class:'h-actions-mois' }, [ lienCra, exp, el('p', { class:'h-aide', text:'Le CRA propose l’import (Compléter / Remplacer) avec un aperçu : rien n’est appliqué d’office.' }) ]));
    f.appendChild(el('div', { class:'h-mois-grille' }, [ gauche, droite ]));
    return f;
  }

  /* Ruche : 7 colonnes depuis le lundi, cellules carrées (≥ 44 px), hexagone à
     liquide (niveau = total / durée de la journée), mini-pastille CRA tri-état.
     Clavier type sélecteur de date (tabindex mobile). */
  function rendreRuche(a, m0, resume, ctx, o){
    var nb=new Date(a, m0+1, 0).getDate(), decal=(new Date(a, m0, 1, 12).getDay()+6)%7;
    var prefixe=a+'-'+pad2(m0+1)+'-';
    var cleFocusable=(ui.ref.slice(0, 7)===prefixe.slice(0, 7))?ui.ref:prefixe+'01';
    var entete=el('div', { class:'h-ruche-jours', 'aria-hidden':'true' }, T.dates.enTetesSemaine('initiale').map(function(x){ return el('span', { text:x }); }));
    var grille=el('div', { class:'h-ruche'+(o.anim && !o.meme && !reduit()?' entree':''), role:'group', 'aria-label':T.MOIS[m0]+' '+a+' : flèches pour changer de jour, Entrée pour l’ouvrir' });
    var cases=decal+nb, lignes=Math.ceil(cases/7);
    for(var i=0;i<lignes*7;i++){
      var n=i-decal+1;
      if(n<1 || n>nb){ grille.appendChild(el('span', { class:'h-alv hors', 'aria-hidden':'true' })); continue; }
      var cle=prefixe+pad2(n), r=resume[n]||null, tot=r?r.min:0, niv=borner(tot/R().dureeJourMin, 0, 1);
      var cls='h-alv'+(ouvre(cle)?'':' non-ouvre')+(cle>ctx.today?' futur':'')+(cle===ctx.today?' auj':'')+(tot>R().dureeJourMin?' depasse':'')+(tot?' plein':'');
      var dj=r?{ am:r.am, pm:r.pm }:{ am:false, pm:false };
      var b=el('button', { type:'button', class:cls, 'data-cle':cle, 'data-focus':'alv-'+cle, tabindex:cle===cleFocusable?'0':'-1', 'aria-current':cle===ctx.today?'date':null,
        'aria-label':dateLongue(cle)+' : '+(tot?fmt.duree(tot)+', équivalent CRA '+libelleCraLong(dj):'rien') });
      b.style.setProperty('--diag', String(Math.floor(i/7)+(i%7)));
      var liq=el('span', { class:'h-alv-liq' });
      versValeur(liq, '--niv', 'alv-'+cle, niv, o.anim, 0);
      var contour=svgEl('svg', { viewBox:'0 0 100 100', preserveAspectRatio:'none', class:'h-alv-contour', 'aria-hidden':'true', focusable:'false' });
      contour.appendChild(svgEl('polygon', { points:'50,2 98,26 98,74 50,98 2,74 2,26', 'vector-effect':'non-scaling-stroke' }));
      b.appendChild(el('span', { class:'h-alv-forme', 'aria-hidden':'true' }, [ el('span', { class:'h-alv-fond' }, [ liq ]), contour ]));
      b.appendChild(el('span', { class:'h-alv-num', 'aria-hidden':'true', text:String(n) }));
      if(tot) b.appendChild(el('span', { class:'h-alv-tot', 'aria-hidden':'true', text:fmt.decimal(tot) }));
      if(r) b.appendChild(pastilleCra(dj, 'h-alv-cra'));
      (function(cle){ b.addEventListener('click', function(){ allerA('jour', cle); }); })(cle);
      grille.appendChild(b);
    }
    grille.addEventListener('keydown', function(e){
      var t=e.target.closest && e.target.closest('.h-alv[data-cle]'); if(!t) return;
      var cle=t.getAttribute('data-cle'), cible=null, dd=T.dates.depuisCle(cle);
      switch(e.key){
        case 'ArrowLeft': cible=T.dates.ajouterJours(cle, -1); break;
        case 'ArrowRight': cible=T.dates.ajouterJours(cle, 1); break;
        case 'ArrowUp': cible=T.dates.ajouterJours(cle, -7); break;
        case 'ArrowDown': cible=T.dates.ajouterJours(cle, 7); break;
        case 'Home': cible=T.dates.lundiDe(cle); break;
        case 'End': cible=T.dates.ajouterJours(T.dates.lundiDe(cle), 6); break;
        case 'PageUp': case 'PageDown':
          var dm=(e.key==='PageUp')?-1:1, cm=new Date(dd.getFullYear(), dd.getMonth()+dm, 1, 12), nbm=new Date(cm.getFullYear(), cm.getMonth()+1, 0).getDate();
          cible=T.dates.cle(new Date(cm.getFullYear(), cm.getMonth(), Math.min(dd.getDate(), nbm), 12)); break;
        default: return;
      }
      e.preventDefault();
      if(!cible || !T.dates.cleValide(cible)) return;
      if(cible.slice(0, 7)===cle.slice(0, 7)){
        Array.prototype.forEach.call(grille.querySelectorAll('.h-alv[data-cle]'), function(x){ x.setAttribute('tabindex', x.getAttribute('data-cle')===cible?'0':'-1'); });
        ui.ref=cible; session.ref=cible; ecrireSession();
        focusSur(trouverFocus(grille, 'alv-'+cible));
      } else { ui.focusApres='alv-'+cible; allerA('mois', cible); }
    });
    return el('div', { class:'h-ruche-zone' }, [ entete, grille ]);
  }
  function tableauMois(a, m0, resume, nums){
    var corps=el('tbody'), tot=0, am=0, pm=0, cra=0;
    nums.forEach(function(n){
      var r=resume[n], cle=a+'-'+pad2(m0+1)+'-'+pad2(n), j=(r.am?0.5:0)+(r.pm?0.5:0);
      tot+=r.min; am+=r.minAm; pm+=r.minPm; cra+=j;
      var noms=[]; plagesDe(cle).forEach(function(p){ var pr=projetDe(p.p); var nm=pr?pr.nom:'Sans projet'; if(noms.indexOf(nm)===-1) noms.push(nm); });
      corps.appendChild(el('tr', null, [ el('th', { scope:'row', text:fmt.dateCourte(cle) }), el('td', { text:fmt.duree(r.min) }), el('td', { text:fmt.duree(r.minAm) }),
        el('td', { text:fmt.duree(r.minPm) }), el('td', { text:fmt.nombre(j)+' j' }), el('td', { class:'h-td-projets', text:noms.join(' · ') }) ]));
    });
    if(!nums.length) corps.appendChild(el('tr', null, [ el('td', { colspan:'6', class:'h-td-vide', text:'Aucune heure ce mois-ci.' }) ]));
    var table=el('table', { class:'h-table' }, [
      el('caption', { text:T.MOIS[m0]+' '+a+' — heures par jour pointé' }),
      el('thead', null, [ el('tr', null, ['Date','Total','Matin','Après-midi','CRA','Projets'].map(function(x){ return el('th', { scope:'col', text:x }); })) ]),
      corps,
      el('tfoot', null, [ el('tr', null, [ el('th', { scope:'row', text:'Total' }), el('td', { text:fmt.duree(tot) }), el('td', { text:fmt.duree(am) }), el('td', { text:fmt.duree(pm) }), el('td', { text:fmt.jours(cra) }), el('td') ]) ])
    ]);
    return el('div', { class:'h-table-zone', tabindex:'0', role:'region', 'aria-label':'Tableau du mois (défilement horizontal possible)' }, [ table ]);
  }
  function repartitionProjets(prefixe, ctx, o){
    // Jours du mois (stockés + segment vivant), chacun compté une fois ; « Sans projet » inclus.
    var cles=Object.create(null), parId=Object.create(null), ordre=[];
    Object.keys(D.jours).concat(Object.keys(ctx.vivants)).forEach(function(k){ if(k.indexOf(prefixe)===0) cles[k]=true; });
    Object.keys(cles).sort().forEach(function(k){
      plagesAvecVivant(k, ctx).forEach(function(p){
        var id=p.p||'';
        if(!(id in parId)){ parId[id]=0; ordre.push(id); }
        parId[id]+=minutes(p.f)-minutes(p.d);
      });
    });
    ordre.sort(function(x, y){ return parId[y]-parId[x]; });
    var valeurs=ordre.map(function(id){ return parId[id]; }), pcts=pourcentages(valeurs), max=Math.max.apply(null, valeurs.concat([1]));
    var ul=el('ul', { class:'h-repartition' });
    ordre.forEach(function(id, i){
      var barre=el('span', { class:'h-rep-barre', 'aria-hidden':'true' }, [ el('span', { class:'h-rep-plein', 'data-t':projetDe(id)?String(projetDe(id).t):null }) ]);
      versValeur(barre.firstChild, '--f', 'rep-'+prefixe+'-'+id, parId[id]/max, o.anim, 0);
      ul.appendChild(el('li', { class:'h-rep-ligne' }, [ etiquetteProjet(id), el('span', { class:'h-rep-val' }, [ el('b', { text:fmt.duree(parId[id]) }), el('span', { text:' · '+pcts[i]+' %' }) ]), barre ]));
    });
    return el('section', { class:'h-carte h-carte-rep', 'aria-labelledby':'repTitre' }, [
      el('div', { class:'h-carte-tete' }, [ el('h2', { class:'h-carte-titre', id:'repTitre', text:'Par projet' }) ]),
      ordre.length?ul:el('p', { class:'h-vide-txt', text:'Aucune heure ce mois-ci.' })
    ]);
  }

  /* ============================================================
     10. FEUILLE PLAGE — ajout / édition. Feuille basse < 700 px,
         dialogue centré au-delà (même DOM, taf.css .taf-feuille).
  ============================================================ */
  var surfacesOuvertes=0;
  // Arrière-plan inerte pendant une feuille Heures (aria-modal + inert ; focus piégé par TAF).
  function inerte(on){
    surfacesOuvertes=Math.max(0, surfacesOuvertes+(on?1:-1));
    var v=surfacesOuvertes>0;
    [ doc.querySelector('.topbar'), $('cadre') ].forEach(function(n){ if(n){ if(v) n.setAttribute('inert', ''); else n.removeAttribute('inert'); } });
    doc.body.classList.toggle('h-modale', v);
  }
  function ouvrirSurface(feuille, voile){ feuille.classList.add('open'); voile.classList.add('open'); feuille.setAttribute('aria-hidden', 'false'); inerte(true); }
  function fermerSurface(feuille, voile){ feuille.classList.remove('open'); voile.classList.remove('open'); feuille.setAttribute('aria-hidden', 'true'); inerte(false); }
  // Focus rendu au déclencheur ; s'il a été reconstruit entre-temps, à son équivalent (data-focus).
  function rendreFocusApres(cle, repli){
    var a=doc.activeElement;
    if(a && a!==doc.body && doc.contains(a) && !a.closest('[aria-hidden="true"]')) return;
    focusSur((cle && (trouverFocus($('vue'), cle)||trouverFocus($('pointeuse'), cle)))||repli||$('vueTitre'));
  }

  var fp={ ouvert:false, cle:'', id:null, o:'s', s:null, p:'', relacher:null, cleRetour:null, nouveau:false };
  var FP={ feuille:$('feuillePlage'), voile:$('plageVoile'), titre:$('plageTitre'), rapide:$('plageRapide'), rapideBloc:$('plageRapideBloc'), apercu:$('plageRapideApercu'),
    detail:$('plageDetail'), debut:$('plageDebut'), fin:$('plageFin'), minuit:$('plageMinuit'), lendemain:$('plageLendemain'), lendemainBloc:$('plageLendemainBloc'),
    maintenant:$('plageMaintenant'), demi:$('plageDemi'), duree:$('plageDuree'), chevauche:$('plageChevauche'), erreur:$('plageErreur'), puces:$('plageProjetsPuces'),
    note:$('plageNote'), compte:$('plageNoteCompte'), supprimer:$('plageSupprimer'), reprendre:$('plageReprendre'), enregistrer:$('plageEnregistrer') };

  // §6.10 — début = fin de la dernière plage, sinon journée type, sinon début habituel ;
  // fin = maintenant arrondi au quart d'heure (jour courant), sinon début + 1 h.
  function prerempli(cle){
    var pl=plagesDe(cle), jt=journeeType(), d;
    if(pl.length) d=minutes(pl[pl.length-1].f); else if(jt) d=minutes(jt[0].d); else d=minutes(R().debutHabituel);
    d=Math.min(d, 1425);
    var now=maintenant(), f=d+60;
    if(cle===T.dates.cle(now) && minutesMurales(now)>d){ var q=H.arrondir(minutesMurales(now), 15, 'proche'); if(q>d) f=q; }
    return { d:d, f:Math.min(1440, f) };
  }
  function ouvrirFeuillePlage(cle, id, pre, declencheur){
    if(lectureSeule){ signalerLectureSeule(); return; }
    if(!T.dates.cleValide(cle)) cle=aujourdHui();
    var plage=null;
    if(id){ plage=plagesDe(cle).filter(function(x){ return x.id===id; })[0]||null; if(!plage){ T.toast({ message:'Plage introuvable (modifiée ailleurs ?).', type:'erreur' }); return; } }
    if(fc.ouvert) fermerFeuilleChrono(false);
    if(ex.ouvert) fermerExport(false);
    fp.cle=cle; fp.id=plage?plage.id:null; fp.o=plage?plage.o:'s'; fp.s=(plage && plage.s)||null; fp.nouveau=!plage;
    fp.origine=plage?JSON.stringify(plage):null;
    var pl=plagesDe(cle);
    fp.p=plage?plage.p:(pl.length && projetActif(pl[pl.length-1].p)?pl[pl.length-1].p:'');
    var v=plage?{ d:minutes(plage.d), f:minutes(plage.f) }:(pre||prerempli(cle));
    FP.titre.textContent=plage?'Modifier la plage · '+fmt.dateCourte(cle):'Nouvelle plage · '+fmt.dateCourte(cle);
    FP.debut.value=versHHMM(Math.min(v.d, 1439));
    FP.minuit.checked=v.f>=1440;
    FP.fin.value=v.f>=1440?'00:00':versHHMM(v.f);
    FP.fin.disabled=FP.minuit.checked;
    FP.lendemain.checked=false;
    FP.note.value=plage?plage.n:'';
    FP.rapide.value='';
    FP.rapideBloc.hidden=!!plage;
    FP.supprimer.hidden=!plage; FP.reprendre.hidden=!plage;
    FP.maintenant.hidden=(cle!==aujourdHui());
    FP.erreur.hidden=true;
    construireChoixProjet(FP.puces, fp.p, choisirProjetPlage);
    majFeuillePlage();
    if(!fp.ouvert){
      fp.cleRetour=(declencheur && declencheur.getAttribute)?declencheur.getAttribute('data-focus'):null;
      fp.ouvert=true;
      ouvrirSurface(FP.feuille, FP.voile);
      fp.relacher=T.gererModale(FP.feuille, declencheur||null, plage?FP.fin:FP.rapide, fermerFeuillePlage);
    }
  }
  function fermerFeuillePlage(rendreFocus){
    if(!fp.ouvert) return;
    fp.ouvert=false;
    fermerSurface(FP.feuille, FP.voile);
    if(fp.relacher){ fp.relacher(rendreFocus!==false); fp.relacher=null; }
    if(rendreFocus!==false) rendreFocusApres(fp.cleRetour, null);
  }
  function choisirProjetPlage(id){
    fp.p=id;
    construireChoixProjet(FP.puces, fp.p, choisirProjetPlage);
    var b=FP.puces.querySelector('[aria-pressed="true"]'); if(b) focusSur(b);
    majFeuillePlage();
  }
  // Candidat lu dans les tuiles : {parJour:{cle:[{d,f}]}, duree} ou {erreur}
  function candidatTuiles(){
    var d=minutes(FP.debut.value), minuit=FP.minuit.checked, f=minuit?1440:minutes(FP.fin.value);
    FP.fin.disabled=minuit;
    if(!isFinite(d)) return { erreur:'Heure de début invalide.', champ:FP.debut };
    if(!isFinite(f)) return { erreur:'Heure de fin invalide.', champ:FP.fin };
    var traverse=!minuit && f<=d;
    FP.lendemainBloc.hidden=!traverse;
    if(!traverse) FP.lendemain.checked=false;
    var parJour={}, duree;
    if(traverse){
      if(!FP.lendemain.checked) return { erreur:(f===d)?'Durée nulle : la fin doit suivre le début.':'La fin précède le début : cochez « Se termine le lendemain » ou corrigez.', champ:FP.fin };
      parJour[fp.cle]=[{ d:d, f:1440 }];
      var lendemain=T.dates.ajouterJours(fp.cle, 1);
      if(f>0 && T.dates.cleValide(lendemain)) parJour[lendemain]=[{ d:0, f:f }];
      duree=1440-d+f;
    } else { parJour[fp.cle]=[{ d:d, f:f }]; duree=f-d; }
    if(duree<1) return { erreur:'Durée nulle.', champ:FP.fin };
    return { parJour:parJour, duree:duree, traverse:traverse };
  }
  function descriptionsChevauchement(parJour){
    var msgs=[];
    Object.keys(parJour).forEach(function(k){
      parJour[k].forEach(function(x){
        var r=H.insererPlage(plagesDe(k), { id:(fp.id && k===fp.cle)?fp.id:'h_0000000000', d:versHHMM(x.d), f:versHHMM(x.f) });
        r.rognees.forEach(function(g){
          var a=g.avant.d+'–'+g.avant.f+' ('+nomProjet(g.avant.p)+')';
          if(g.type==='supprimee') msgs.push('Chevauche '+a+' → sera remplacée');
          else if(g.type==='scindee') msgs.push('Chevauche '+a+' → sera scindée en '+g.apres[0].d+'–'+g.apres[0].f+' et '+g.apres[1].d+'–'+g.apres[1].f);
          else msgs.push('Chevauche '+a+' → sera rognée à '+g.apres[0].d+'–'+g.apres[0].f);
        });
      });
    });
    return msgs;
  }
  function majFeuillePlage(){
    if(!D) return;
    FP.compte.textContent=FP.note.value.length+' / '+LIM.note;
    var texte=FP.rapide.value.trim(), parRapide=!fp.id && !!texte;
    FP.detail.classList.toggle('inactif', parRapide);
    var res=parRapide?H.analyserSaisie(texte, contexteSaisie(fp.cle)):null;
    rendreApercuSaisie(FP.apercu, FP.rapide, res, fp.cle);
    var parJour=null;
    if(parRapide){
      FP.duree.textContent='';
      if(res && !res.erreurs.length && res.plages.length){
        parJour={};
        Object.keys(res.plagesParJour).forEach(function(k){ parJour[k]=res.plagesParJour[k].map(function(x){ return { d:minutes(x.d), f:minutes(x.f) }; }); });
      }
    } else {
      var c=candidatTuiles();
      // Aucun aria-invalid / aria-describedby périmé sur l'autre tuile ; l'erreur n'est ANNONCÉE
      // qu'à la tentative d'enregistrement (#plageErreur sans role=alert : pas d'annonce par frappe).
      [ FP.debut, FP.fin ].forEach(function(t){ t.removeAttribute('aria-invalid'); t.removeAttribute('aria-describedby'); });
      if(c.erreur){ FP.duree.textContent=''; FP.erreur.textContent=c.erreur; FP.erreur.hidden=false; c.champ.setAttribute('aria-invalid', 'true'); c.champ.setAttribute('aria-describedby', 'plageErreur'); }
      else {
        FP.erreur.hidden=true;
        FP.duree.textContent='Durée : '+fmt.duree(c.duree)+(c.traverse?' · traverse minuit':'');
        parJour=c.parJour;
      }
    }
    var msgs=parJour?descriptionsChevauchement(parJour):[];
    FP.chevauche.hidden=!msgs.length;
    FP.chevauche.textContent=msgs.join(' · ');
  }
  function enregistrerPlage(){
    var texte=FP.rapide.value.trim();
    if(!fp.id && texte){
      var res=H.analyserSaisie(texte, contexteSaisie(fp.cle));
      if(res.erreurs.length || !res.plages.length){ focusSur(FP.rapide); T.annoncer(res.erreurs.length?res.erreurs[0].message:'Saisie incomplète.'); return; }
      if(enregistrerSaisie(res, fp.cle, fp.p, nettoyer(FP.note.value, LIM.note))){ fp.cleRetour='ajout'; fermerFeuillePlage(); }
      return;
    }
    var c=candidatTuiles();
    if(c.erreur){ majFeuillePlage(); focusSur(c.champ); T.annoncer(c.erreur); return; }
    var note=nettoyer(FP.note.value, LIM.note), rognees=[], id=fp.id, cle=fp.cle, p=fp.p, o=fp.o, s=fp.s;
    var r=muter(id?'Modifier la plage':'Ajouter une plage', function(e){
      if(id && !(e.jours[cle]||[]).some(function(x){ return x.id===id; })) throw new Error('Plage modifiée dans un autre onglet — rouvrez-la.');
      if(p && !e.projets.some(function(x){ return x.id===p; })) p='';
      Object.keys(c.parJour).forEach(function(k){
        c.parJour[k].forEach(function(x){
          var edition=!!(id && k===cle);
          if(!edition && (e.jours[k]||[]).length>=LIM.plagesJour) throw new Error(LIM.plagesJour+' plages par jour au plus.');
          var pl={ id:edition?id:T.id('h'), d:versHHMM(x.d), f:versHHMM(x.f), p:p, n:note, o:id?o:'s' };
          if(edition && s) pl.s=s;
          var ins=H.insererPlage(e.jours[k]||[], pl);
          e.jours[k]=ins.plages; rognees=rognees.concat(ins.rognees);
        });
      });
    });
    if(!r) return;
    fermerFeuillePlage();
    toastAnnulable((id?'Plage modifiée':'Plage ajoutée')+' · '+fmt.duree(c.duree)+suffixeRognees(rognees), r.entree);
  }
  function supprimerPlage(cle, id, focusApres){
    var plage=plagesDe(cle).filter(function(x){ return x.id===id; })[0];
    if(!plage) return;
    var bouton_=trouverFocus($('vue'), 'pl-'+id), li=bouton_?bouton_.parentNode:null;
    var anim=!!(li && !reduit() && typeof li.animate==='function');
    var r=muter('Supprimer la plage', function(e){
      var l=e.jours[cle]||[], n=l.filter(function(x){ return x.id!==id; });
      if(n.length===l.length) return false;
      e.jours[cle]=n;
    }, { differerRendu:anim?180:0 });
    if(!r) return;
    if(anim) li.animate([{ opacity:1, transform:'none' },{ opacity:0, transform:'translateX(-12px)' }], { duration:180, easing:EASE, fill:'forwards' });
    ui.focusApres=(focusApres && trouverFocus($('vue'), focusApres))?focusApres:'ajout';
    toastAnnulable('Plage supprimée · '+plage.d+'–'+plage.f, r.entree, 'info');
  }
  // « Reprendre ▶ » : relance le chrono avec le projet et la note de la plage (un chrono actif est
  // d'abord arrêté : une seule mutation, un seul toast « Chrono basculé · Annuler »).
  function reprendrePlage(cle, id){
    var plage=plagesDe(cle).filter(function(x){ return x.id===id; })[0];
    if(!plage) return;
    var now=maintenant(), avait=!!D.chrono;
    // Chrono en marche depuis plus de 24 h : même garde que pause / arrêt (jamais de segment jeté en silence).
    if(D.chrono && D.chrono.e==='marche' && now-D.chrono.t0>J24){ demanderConfirmation24('arreter'); return null; }
    var r=muter(avait?'Chrono basculé':'Reprendre la plage', function(e){
      if(e.chrono){
        if(e.chrono.e==='marche' && now-e.chrono.t0<=J24){ var seg=enregistrerSegment(e, now); if(seg.erreur) return false; }
        e.chrono=null;
      }
      var p=projetActif(plage.p)?plage.p:'';
      e.chrono={ e:'marche', t0:arrondiSeconde(now), tp:null, p:p, n:plage.n||'', s:T.id('s') };
    });
    if(!r) return null;
    demanderPersistance(); vibrer(); animerHex();
    fermerFeuillePlage(false);
    focusSur(pt.hex);
    if(avait) toastAnnulable('Chrono basculé · '+nomProjet(D.chrono.p), r.entree);
    else T.annoncer('Chrono démarré à '+heureParlee(now)+(D.chrono.p?', projet '+nomProjet(D.chrono.p):''));
    return r;
  }
  // Tuiles horaires : ±5 min (Maj ou appui long : ±15) ; ↑ / ↓ dans le champ.
  function pasHoraire(champ, delta){
    if(champ.disabled) return;
    var m=minutes(champ.value); if(!isFinite(m)) m=minutes(R().debutHabituel);
    champ.value=versHHMM((m+delta+1440)%1440);
    champ.dispatchEvent(new Event('input', { bubbles:true }));
  }
  function brancherTuiles(conteneur){
    Array.prototype.forEach.call(conteneur.querySelectorAll('.h-pas[data-cible]'), function(b){
      var champ=$(b.getAttribute('data-cible')), base=+b.getAttribute('data-pas'), timer=null, long=false;
      b.addEventListener('pointerdown', function(e){ if(e.button>0) return; long=false; timer=setTimeout(function(){ long=true; timer=null; pasHoraire(champ, base*3); }, 450); });
      ['pointerup','pointerleave','pointercancel'].forEach(function(t){ b.addEventListener(t, function(){ if(timer){ clearTimeout(timer); timer=null; } }); });
      b.addEventListener('click', function(e){ if(long){ long=false; return; } pasHoraire(champ, e.shiftKey?base*3:base); });
    });
    Array.prototype.forEach.call(conteneur.querySelectorAll('input[type="time"]'), function(champ){
      champ.addEventListener('keydown', function(e){
        if((e.key==='ArrowUp' || e.key==='ArrowDown') && !e.altKey && !e.ctrlKey && !e.metaKey){
          e.preventDefault(); pasHoraire(champ, (e.key==='ArrowUp'?1:-1)*(e.shiftKey?15:5));
        }
      });
    });
  }
  function brancherFeuillePlage(){
    brancherTuiles(FP.feuille);
    [FP.debut, FP.fin, FP.minuit, FP.lendemain, FP.rapide, FP.note].forEach(function(n){ n.addEventListener('input', majFeuillePlage); n.addEventListener('change', majFeuillePlage); });
    FP.rapide.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); enregistrerPlage(); } });
    FP.feuille.addEventListener('keydown', function(e){
      if(e.key==='Enter' && !e.isComposing && e.target && e.target.tagName==='INPUT' && e.target.type!=='checkbox' && e.target!==FP.rapide){ e.preventDefault(); enregistrerPlage(); }
    });
    Array.prototype.forEach.call(FP.feuille.querySelectorAll('[data-duree]'), function(b){
      b.addEventListener('click', function(){
        var t=b.getAttribute('data-duree'), d=minutes(FP.debut.value);
        if(!isFinite(d)) return;
        var f;
        if(t==='maintenant'){ var now=maintenant(); f=H.arrondir(minutesMurales(now), R().arrondiMin, R().modeArrondi==='favorable'?'haut':'proche'); }
        else if(t==='demi') f=d+Math.round(R().dureeJourMin/2);
        else f=d+(+t);
        FP.minuit.checked=f>=1440;
        FP.fin.value=f>=1440?'00:00':versHHMM(f);
        majFeuillePlage();
      });
    });
    FP.enregistrer.addEventListener('click', enregistrerPlage);
    FP.supprimer.addEventListener('click', function(){
      var cle=fp.cle, id=fp.id, pl=plagesDe(cle), i=-1;
      pl.forEach(function(x, k){ if(x.id===id) i=k; });
      var suivante=pl[i+1]||pl[i-1]||null;
      fermerFeuillePlage(false);
      supprimerPlage(cle, id, suivante?'pl-'+suivante.id:'ajout');
    });
    FP.reprendre.addEventListener('click', function(){ reprendrePlage(fp.cle, fp.id); });
    $('plageFermer').addEventListener('click', function(){ fermerFeuillePlage(); });
    FP.voile.addEventListener('click', function(){ fermerFeuillePlage(); });
    T.glisserPourFermer($('plagePoignee'), FP.feuille, function(){ fermerFeuillePlage(); });
  }

  /* Choix du projet (feuilles Plage et Chrono) : puces des projets récents, « Sans projet »,
     liste complète, « + Nouveau ». État : aria-pressed + coche (forme), nom toujours visible. */
  function construireChoixProjet(conteneur, valeur, surChoix){
    T.vider(conteneur);
    var actifs=D.projets.filter(function(p){ return !p.a; }), montres=projetsRecents(5);
    actifs.forEach(function(p){ if(montres.length<5 && montres.indexOf(p.id)===-1) montres.push(p.id); });
    if(valeur && montres.indexOf(valeur)===-1 && projetDe(valeur)) montres.unshift(valeur);
    function puce(id, contenu, label){
      var b=el('button', { type:'button', class:'h-puce h-puce-projet', 'aria-pressed':String(id===valeur), 'data-p':id, 'aria-label':label||null }, contenu);
      b.addEventListener('click', function(){ surChoix(id); });
      return b;
    }
    conteneur.appendChild(puce('', [ el('span', { class:'h-mono vide', 'aria-hidden':'true' }), el('span', { class:'h-puce-nom', text:'Sans projet' }) ]));
    montres.forEach(function(id){ var p=projetDe(id); conteneur.appendChild(puce(id, [ monogramme(p), el('span', { class:'h-puce-nom', text:p.nom }) ], p.nom+(p.a?' (archivé)':''))); });
    if(actifs.length>montres.filter(function(id){ return projetActif(id); }).length){
      var sel=el('select', { class:'field h-puce-select', 'aria-label':'Tous les projets' }, [ el('option', { value:'', text:'Tous les projets…' }) ]);
      actifs.forEach(function(p){ sel.appendChild(el('option', { value:p.id, text:p.nom })); });
      sel.addEventListener('change', function(){ if(sel.value) surChoix(sel.value); });
      conteneur.appendChild(sel);
    }
    var nouveau=el('button', { type:'button', class:'h-puce h-puce-nouveau', 'aria-expanded':'false' }, [ icone('plus', 14), 'Nouveau' ]);
    var form=el('div', { class:'h-nouveau-projet', hidden:true });
    var champ=el('input', { class:'taf-input', type:'text', maxlength:'40', autocomplete:'off', placeholder:'Nom du projet', 'aria-label':'Nom du nouveau projet' });
    var creer=bouton('Créer', 'btn small primary', function(){ var id=creerProjet(champ.value); if(id) surChoix(id); else focusSur(champ); });
    champ.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); e.stopPropagation(); creer.click(); } else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); form.hidden=true; nouveau.setAttribute('aria-expanded', 'false'); focusSur(nouveau); } });
    form.appendChild(champ); form.appendChild(creer);
    nouveau.addEventListener('click', function(){ var ouvrir=form.hidden; form.hidden=!ouvrir; nouveau.setAttribute('aria-expanded', String(ouvrir)); if(ouvrir) focusSur(champ); });
    conteneur.appendChild(nouveau);
    conteneur.appendChild(form);
  }

  /* ============================================================
     11. FEUILLE CHRONO — une seule surface : affichage, segments de
         la session (pauses visibles), début, projet, note, Démarrer
         à… / Arrêter à…, confirmation intégrée (> 24 h).
  ============================================================ */
  var fc={ ouvert:false, relacher:null, section:null, pRepos:null, nRepos:'', changement:null, confirm:null, chiffres:null, cleRetour:null, sig:'', autreDebut:false, autreFin:false };
  var FC={ feuille:$('feuilleChrono'), voile:$('chronoVoile'), titre:$('chronoTitre'), corps:$('chronoCorps'), pied:$('chronoPied') };
  var CIBLES_SECTION={ demarrerA:['fc-dem-0'], arreterA:['fc-arr-0','fc-arr-autre'], debut:['fc-debut'], projet:['fc-projet'], confirm:['fc-confirm'] };
  function cibleSection(section){
    var l=CIBLES_SECTION[section]||[];
    for(var i=0;i<l.length;i++){ var n=trouverFocus(FC.feuille, l[i]); if(n) return n; }
    return FC.titre;
  }

  function ouvrirFeuilleChrono(section, declencheur){
    if(fp.ouvert) fermerFeuillePlage(false);
    if(ex.ouvert) fermerExport(false);
    fc.section=section||null; fc.changement=null; fc.autreDebut=false; fc.autreFin=false;
    if(section!=='confirm') fc.confirm=null;
    if(fc.pRepos===null) fc.pRepos=(R().projetDemarrage==='dernier')?dernierProjetChrono():'';
    fc.sig='';
    rendreFeuilleChrono(contexte(maintenant()));
    var cible=cibleSection(section);
    if(!fc.ouvert){
      fc.cleRetour=(declencheur && declencheur.getAttribute)?declencheur.getAttribute('data-focus'):null;
      fc.ouvert=true;
      ouvrirSurface(FC.feuille, FC.voile);
      fc.relacher=T.gererModale(FC.feuille, declencheur||null, cible, fermerFeuilleChrono);
      majChiffres(maintenant());
    } else focusSur(cible);
    if(section && cible && cible.scrollIntoView) setTimeout(function(){ try{ cible.scrollIntoView({ block:'nearest' }); }catch(e){} }, 80);
  }
  function fermerFeuilleChrono(rendreFocus){
    if(!fc.ouvert) return;
    viderNote();
    fc.ouvert=false; fc.confirm=null; fc.changement=null; fc.chiffres=null;
    fermerSurface(FC.feuille, FC.voile);
    if(fc.relacher){ fc.relacher(rendreFocus!==false); fc.relacher=null; }
    if(rendreFocus!==false) rendreFocusApres(fc.cleRetour, pt.hex);
  }
  function sectionChrono(titre, contenu, attrs){
    return el('section', Object.assign({ class:'fc-section' }, attrs||{}), [ el('h3', { class:'h-label', text:titre }) ].concat(contenu));
  }
  function rendreFeuilleChrono(ctx){
    var c=D.chrono, etat=etatChrono();
    var sig=[etat, c?c.s:'', c?c.t0:'', c?c.tp:'', c?c.p:fc.pRepos, JSON.stringify(D.projets), JSON.stringify(fc.confirm), fc.changement||'', fc.autreDebut, fc.autreFin, R().secondes].join('|');
    if(sig===fc.sig){ majSegmentsChrono(ctx); return; }
    fc.sig=sig;
    var focus=cleFocus(FC.feuille);
    T.vider(FC.corps); T.vider(FC.pied);
    FC.titre.textContent=(etat==='marche')?'Chrono en marche':(etat==='pause'?'Chrono en pause':'Chrono');

    // Affichage
    var ch={ h:el('span', { class:'pt-h' }), m:el('span', { class:'pt-m' }), s:el('span', { class:'pt-s' }) };
    fc.chiffres=ch;
    var sous=(etat==='marche')?(c.p?nomProjet(c.p)+' · ':'')+'depuis '+heureRelative(c.t0, ctx.today)
      :(etat==='pause'?'En pause depuis '+heureRelative(c.tp, ctx.today):'Prêt à démarrer');
    var aff=el('div', { class:'fc-affichage', 'data-etat':etat }, [
      el('span', { class:'fc-chiffres', role:'timer', 'aria-live':'off', 'aria-label':'Durée de la session' }, [ el('span', { class:'pt-hm' }, [ ch.h, el('span', { class:'pt-sep', text:':' }), ch.m ]), ch.s ]),
      el('p', { class:'fc-sous', text:sous })
    ]);
    FC.corps.appendChild(aff);
    poserChiffres(ch, chiffresDe(ctx.now), false);
    if(c && c.e==='marche' && ctx.now<c.t0) FC.corps.appendChild(el('p', { class:'h-avertissement', role:'alert' }, [ icone('alerte', 16), el('span', { text:'L’horloge de l’appareil a reculé : la durée affichée vaut 0.' }) ]));

    // Confirmation intégrée : session de plus de 24 h
    if(fc.confirm && c && c.e==='marche'){
      var finC=(fc.confirm.fin!=null)?fc.confirm.fin:ctx.now, dureeC=Math.floor((finC-c.t0)/60000), act=fc.confirm.action;
      FC.corps.appendChild(el('div', { class:'fc-confirm', role:'alertdialog', 'aria-labelledby':'fcConfirmTxt' }, [
        el('p', { id:'fcConfirmTxt', text:'Cette session dure '+fmt.duree(dureeC)+'. L’enregistrer telle quelle ?' }),
        el('p', { class:'h-aide', text:'Découpe : '+apercuDecoupe(c.t0, finC) }),
        el('div', { class:'fc-confirm-actions' }, [
          bouton('Enregistrer '+fmt.duree(dureeC), 'btn primary', function(){ fc.confirm=null; var r=(act==='pause')?pauseChrono({ confirme:true }):arreterChrono(finC, { confirme:true }); if(r) fermerFeuilleChrono(); }, { 'data-focus':'fc-confirm' }),
          bouton('Choisir l’heure d’arrêt', 'btn', function(){ fc.confirm=null; fc.autreFin=true; fc.sig=''; ui.focusApres=null; rendreFeuilleChrono(contexte(maintenant())); focusSur(trouverFocus(FC.feuille, 'fc-arr-date')); }),
          bouton('Annuler', 'btn ghost', function(){ fc.confirm=null; fc.sig=''; rendreFeuilleChrono(contexte(maintenant())); focusSur(FC.titre); })
        ])
      ]));
    }

    // Segments de la session (pauses visibles)
    if(c){ var seg=el('div', { class:'fc-segments-zone' }); FC.corps.appendChild(sectionChrono('Segments de la session', [ seg ])); fc.segments=seg; majSegmentsChrono(ctx); }
    else fc.segments=null;

    // Début (en marche) : ±5 min ou heure précise, dans [maintenant − 24 h, maintenant]
    if(etat==='marche'){
      var champDebut=el('input', { class:'taf-input h-heure', type:'time', step:'60', id:'fcDebut', value:heureDe(c.t0), 'data-focus':'fc-debut' });
      champDebut.addEventListener('change', function(){
        var m=minutes(champDebut.value); if(!isFinite(m)) return;
        var base=new Date(D.chrono.t0), cand=new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(m/60), m%60).getTime();
        if(cand>maintenant()) cand-=J24;
        corrigerDebut(cand);
      });
      champDebut.addEventListener('keydown', function(e){
        if((e.key==='ArrowUp' || e.key==='ArrowDown') && !e.altKey && !e.ctrlKey && !e.metaKey){ e.preventDefault(); corrigerDebut(D.chrono.t0+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?15:5)*60000); }
      });
      FC.corps.appendChild(sectionChrono('Début', [ el('div', { class:'h-tuile-ligne fc-debut' }, [
        bouton('−5', 'h-pas', function(e){ corrigerDebut(D.chrono.t0-(e.shiftKey?15:5)*60000); }, { 'aria-label':'Début : moins 5 minutes (Maj : 15)', 'data-focus':'fc-debut-m' }),
        el('label', { class:'sr-only', for:'fcDebut', text:'Heure de début' }), champDebut,
        bouton('+5', 'h-pas', function(e){ corrigerDebut(D.chrono.t0+(e.shiftKey?15:5)*60000); }, { 'aria-label':'Début : plus 5 minutes (Maj : 15)', 'data-focus':'fc-debut-p' })
      ]), el('p', { class:'h-aide', text:'Un chevauchement éventuel est résolu à l’enregistrement du segment (la plus récente gagne).' }) ]));
    }

    // Projet
    var valeurP=c?c.p:fc.pRepos, zoneP=el('div', { class:'h-puces' });
    construireChoixProjet(zoneP, valeurP, function(id){
      if(!D.chrono){ fc.pRepos=id; fc.sig=''; rendreFeuilleChrono(contexte(maintenant())); focusPuce(id); return; }
      if(id===D.chrono.p) return;
      if(D.chrono.e==='marche'){ fc.changement=id; fc.sig=''; rendreFeuilleChrono(contexte(maintenant())); focusSur(trouverFocus(FC.feuille, 'fc-chg-maintenant')); return; }
      changerProjetChrono(id, 'pause'); focusPuce(id);
    });
    var blocP=[ zoneP ];
    if(fc.changement!=null && c && c.e==='marche'){
      var cible=fc.changement;
      blocP.push(el('div', { class:'fc-changement', role:'group', 'aria-label':'Changer de projet' }, [
        el('p', { text:'Passer à « '+nomProjet(cible)+' » :' }),
        bouton('À partir de maintenant', 'btn small primary', function(){ fc.changement=null; changerProjetChrono(cible, 'maintenant'); focusPuce(cible); }, { 'data-focus':'fc-chg-maintenant' }),
        bouton('Pour toute la session', 'btn small', function(){ fc.changement=null; changerProjetChrono(cible, 'session'); focusPuce(cible); }),
        bouton('Annuler', 'btn small ghost', function(){ fc.changement=null; fc.sig=''; rendreFeuilleChrono(contexte(maintenant())); focusPuce(D.chrono.p); })
      ]));
    }
    var secP=sectionChrono('Projet', blocP, { 'data-focus':null });
    FC.corps.appendChild(secP);
    var pp=zoneP.querySelector('[aria-pressed="true"]'); if(pp) pp.setAttribute('data-focus', 'fc-projet');

    // Note
    var note=el('textarea', { class:'taf-input h-note-champ', id:'fcNote', rows:'2', maxlength:String(LIM.note), placeholder:'Facultatif — ex. revue de code', 'data-focus':'fc-note' });
    note.value=c?(noteEnAttente!==null?noteEnAttente:c.n):fc.nRepos;
    note.addEventListener('input', function(){ if(D.chrono) noterChrono(note.value); else fc.nRepos=nettoyer(note.value, LIM.note); });
    FC.corps.appendChild(sectionChrono('Note', [ el('label', { class:'sr-only', for:'fcNote', text:'Note du chrono' }), note ]));

    // Démarrer à… (repos)
    if(etat==='repos'){
      var puces=[], now=ctx.now;
      [5, 10, 15, 30].forEach(function(n, i){ puces.push(bouton('il y a '+n+' min', 'h-puce', function(){ demarrerDepuisFeuille(now0()-n*60000); }, { 'data-focus':'fc-dem-'+i })); });
      var jt=journeeType();
      if(jt){ var dj=minutes(jt[0].d), dd=new Date(now), tj=new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), Math.floor(dj/60), dj%60).getTime();
        if(tj<=now && tj>=now-J24) puces.push(bouton('À '+jt[0].d+' (journée type)', 'h-puce', function(){ demarrerDepuisFeuille(tj); }, { 'data-focus':'fc-dem-jt' })); }
      var autreD=bouton('Autre heure…', 'h-puce', function(){ fc.autreDebut=!fc.autreDebut; fc.sig=''; rendreFeuilleChrono(contexte(maintenant())); focusSur(trouverFocus(FC.feuille, fc.autreDebut?'fc-dem-heure':'fc-dem-autre')); }, { 'aria-expanded':String(fc.autreDebut), 'data-focus':'fc-dem-autre' });
      puces.push(autreD);
      var contenuD=[ el('div', { class:'h-puces' }, puces) ];
      if(fc.autreDebut){
        var hD=el('input', { class:'taf-input h-heure', type:'time', step:'60', id:'fcDemHeure', value:heureDe(now), 'data-focus':'fc-dem-heure' });
        contenuD.push(el('div', { class:'fc-autre' }, [ el('label', { class:'h-label', for:'fcDemHeure', text:'Heure de début (aujourd’hui)' }), hD,
          bouton('Démarrer à cette heure', 'btn small primary', function(){
            var m=minutes(hD.value); if(!isFinite(m)){ focusSur(hD); return; }
            var d0=new Date(maintenant()); demarrerDepuisFeuille(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), Math.floor(m/60), m%60).getTime());
          }) ]));
      }
      FC.corps.appendChild(sectionChrono('Démarrer à…', contenuD));
    }
    // Arrêter à… (marche) : fin dans [t0, maintenant]
    if(etat==='marche'){
      var pucesA=[], jtA=journeeType();
      if(jtA){
        var fm=minutes(jtA[jtA.length-1].f), dn=new Date(ctx.now), tf=new Date(dn.getFullYear(), dn.getMonth(), dn.getDate(), Math.floor(fm/60), fm%60).getTime();
        if(fm>=1440) tf=new Date(dn.getFullYear(), dn.getMonth(), dn.getDate()+1).getTime();
        if(tf>ctx.now) tf-=J24;
        if(tf>=c.t0 && tf<=ctx.now) pucesA.push(bouton('À '+heureRelative(tf, ctx.today)+' (fin de journée type)', 'h-puce', function(){ if(arreterChrono(tf, { libelle:'Arrêter le chrono' })) fermerFeuilleChrono(); }, { 'data-focus':'fc-arr-0' }));
      }
      pucesA.push(bouton('Autre heure…', 'h-puce', function(){ fc.autreFin=!fc.autreFin; fc.sig=''; rendreFeuilleChrono(contexte(maintenant())); focusSur(trouverFocus(FC.feuille, fc.autreFin?'fc-arr-date':'fc-arr-autre')); },
        { 'aria-expanded':String(fc.autreFin), 'data-focus':'fc-arr-autre' }));
      var contenuA=[ el('div', { class:'h-puces' }, pucesA) ];
      if(fc.autreFin){
        var dA=el('input', { class:'taf-input', type:'date', id:'fcArrDate', value:ctx.today, min:T.dates.cle(c.t0), max:ctx.today, 'data-focus':'fc-arr-date' });
        var hA=el('input', { class:'taf-input h-heure', type:'time', step:'60', id:'fcArrHeure', value:heureDe(ctx.now) });
        contenuA.push(el('div', { class:'fc-autre' }, [
          el('div', { class:'h-champ' }, [ el('label', { class:'h-label', for:'fcArrDate', text:'Date' }), dA ]),
          el('div', { class:'h-champ' }, [ el('label', { class:'h-label', for:'fcArrHeure', text:'Heure d’arrêt' }), hA ]),
          bouton('Arrêter à cette heure', 'btn small primary', function(){
            var dd=T.dates.depuisCle(dA.value), m=minutes(hA.value);
            if(!dd || !isFinite(m)){ T.toast({ message:'Date ou heure invalide.', type:'erreur' }); return; }
            var fin=new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), Math.floor(m/60), m%60).getTime();
            if(fin>maintenant()){ T.toast({ message:'Cette heure n’est pas encore passée.', type:'erreur' }); return; }
            if(arreterChrono(fin, { libelle:'Arrêter le chrono' })) fermerFeuilleChrono();
          })
        ]));
      }
      FC.corps.appendChild(sectionChrono('Arrêter à…', contenuA));
    }

    // Pied : action principale selon l'état
    if(etat==='repos') FC.pied.appendChild(bouton([ icone('lecture', 16), 'Démarrer maintenant' ], 'btn primary fc-principal', function(){ demarrerDepuisFeuille(null); }, { 'data-focus':'fc-demarrer' }));
    else {
      FC.pied.appendChild(bouton([ icone('stop', 15), 'Arrêter' ], 'btn', function(){ if(arreterChrono()) fermerFeuilleChrono(); }, { 'data-focus':'fc-arreter' }));
      if(etat==='marche') FC.pied.appendChild(bouton([ icone('pause', 15), 'Pause' ], 'btn primary fc-principal', function(){ if(pauseChrono()) fermerFeuilleChrono(); }, { 'data-focus':'fc-pause' }));
      else FC.pied.appendChild(bouton([ icone('lecture', 15), 'Reprendre' ], 'btn primary fc-principal', function(){ if(reprendreChrono()) fermerFeuilleChrono(); }, { 'data-focus':'fc-reprendre' }));
    }
    if(focus){ var n=trouverFocus(FC.feuille, focus); if(n) focusSur(n); else if(fc.ouvert) focusSur(FC.titre); }
  }
  function now0(){ return maintenant(); }
  function focusPuce(id){ var b=FC.feuille.querySelector('.h-puce-projet[data-p="'+(id||'')+'"]'); if(b) focusSur(b); }
  function demarrerDepuisFeuille(t0){
    var r=demarrerChrono(t0, { p:fc.pRepos||'', n:fc.nRepos });
    if(r){ fc.nRepos=''; fermerFeuilleChrono(); }
  }
  function majSegmentsChrono(ctx){
    var zone=fc.segments, c=D.chrono;
    if(!zone || !c) return;
    var segs=plagesSession(c.s), ul=el('ul', { class:'fc-segments' }), prec=null;
    segs.forEach(function(x){
      if(prec && prec.cle===x.cle && minutes(x.d)>minutes(prec.f)) ul.appendChild(el('li', { class:'fc-pause' }, [ 'pause '+fmt.duree(minutes(x.d)-minutes(prec.f)) ]));
      ul.appendChild(el('li', { class:'fc-seg' }, [ el('span', { class:'fc-seg-j', text:fmt.dateCourte(x.cle) }), el('span', { text:x.d+' → '+x.f }), el('b', { text:fmt.duree(minutes(x.f)-minutes(x.d)) }) ]));
      prec=x;
    });
    if(c.e==='marche'){
      var dur=Math.max(0, Math.floor((ctx.now-c.t0)/60000));
      if(prec && T.dates.cle(c.t0)===prec.cle){ var gap=minutesMurales(c.t0)-minutes(prec.f); if(gap>0) ul.appendChild(el('li', { class:'fc-pause' }, [ 'pause '+fmt.duree(gap) ])); }
      ul.appendChild(el('li', { class:'fc-seg vivant' }, [ el('span', { class:'fc-seg-j', text:fmt.dateCourte(T.dates.cle(c.t0)) }), el('span', { text:heureDe(c.t0)+' → maintenant' }), el('b', { text:fmt.duree(dur) }) ]));
    } else if(c.e==='pause'){
      ul.appendChild(el('li', { class:'fc-pause en-cours' }, [ 'en pause depuis '+heureRelative(c.tp, ctx.today)+' · '+fmt.duree(Math.max(0, Math.floor((ctx.now-c.tp)/60000))) ]));
    }
    if(!ul.childNodes.length) ul.appendChild(el('li', { class:'fc-vide', text:'Aucun segment enregistré pour l’instant.' }));
    T.vider(zone); zone.appendChild(ul);
  }

  /* ============================================================
     12. PROJETS, JOURNÉE TYPE, SAISIE RAPIDE
  ============================================================ */
  function nomProjetValide(nom, idExclu){
    var n=nettoyer(nom, 200);
    if(!n) return { erreur:'Donnez un nom au projet.' };
    n=n.slice(0, LIM.nom);
    var q=T.normaliserTexte(n);
    if(D.projets.some(function(p){ return p.id!==idExclu && T.normaliserTexte(p.nom)===q; })) return { erreur:'Un projet porte déjà ce nom.' };
    return { nom:n };
  }
  function creerProjet(nom){
    var v=nomProjetValide(nom);
    if(v.erreur){ T.toast({ message:v.erreur, type:'erreur' }); return null; }
    if(D.projets.length>=LIM.projets){ T.toast({ message:LIM.projets+' projets au plus : archivez ou supprimez-en.', type:'erreur' }); return null; }
    var id=T.id('p');
    var r=muter('Créer le projet', function(e){
      var pris=e.projets.map(function(p){ return p.t; }), t=0;
      for(var i=0;i<8;i++){ if(pris.indexOf(i)===-1){ t=i; break; } }
      e.projets.push({ id:id, nom:v.nom, t:t, a:false });
    });
    if(!r) return null;
    T.annoncer('Projet « '+v.nom+' » créé');
    return id;
  }
  function referencesProjet(id){
    var n=0;
    Object.keys(D.jours).forEach(function(k){ D.jours[k].forEach(function(x){ if(x.p===id) n++; }); });
    if(D.chrono && D.chrono.p===id) n++;
    (journeeType()||[]).forEach(function(x){ if(x.p===id) n++; });
    return n;
  }
  function majProjet(id, champs){
    if(champs.nom!==undefined){
      var v=nomProjetValide(champs.nom, id);
      if(v.erreur){ T.toast({ message:v.erreur, type:'erreur' }); return null; }
      champs.nom=v.nom;
    }
    return muter(champs.a!==undefined?(champs.a?'Archiver le projet':'Désarchiver le projet'):'Modifier le projet', function(e){
      var p=e.projets.filter(function(x){ return x.id===id; })[0];
      if(!p) return false;
      if(champs.nom!==undefined) p.nom=champs.nom;
      if(champs.t!==undefined && Number.isInteger(champs.t) && champs.t>=0 && champs.t<=7) p.t=champs.t;
      if(champs.a!==undefined) p.a=champs.a===true;
    });
  }
  function supprimerProjet(id){
    if(referencesProjet(id)) return;
    var p=projetDe(id); if(!p) return;
    var r=muter('Supprimer le projet', function(e){ e.projets=e.projets.filter(function(x){ return x.id!==id; }); });
    if(r) toastAnnulable('Projet « '+p.nom+' » supprimé', r.entree, 'info');
  }

  // Journée type : jour vide = tout ; jour entamé = seulement les plages qui ne chevauchent RIEN.
  function appliquerJourneeType(cle, mode){
    var jt=journeeType();
    if(!jt){ ouvrirReglages('secJt'); return null; }
    var ctx=contexte(maintenant()), existants=plagesAvecVivant(cle, ctx);
    var aAjouter=jt.filter(function(x){ return !existants.some(function(e){ return minutes(e.d)<minutes(x.f) && minutes(x.d)<minutes(e.f); }); });
    if(!aAjouter.length){ T.toast({ message:'Rien à compléter', type:'info' }); return null; }
    var tot=aAjouter.reduce(function(t, x){ return t+minutes(x.f)-minutes(x.d); }, 0);
    var r=muter(existants.length?'Compléter avec la journée type':'Appliquer la journée type', function(e){
      var l=(e.jours[cle]||[]).slice();
      if(l.length+aAjouter.length>LIM.plagesJour) throw new Error(LIM.plagesJour+' plages par jour au plus.');
      aAjouter.forEach(function(x){ l.push({ id:T.id('h'), d:x.d, f:x.f, p:(x.p && e.projets.some(function(p){ return p.id===x.p; }))?x.p:'', n:'', o:'m' }); });
      e.jours[cle]=l;
    });
    if(r) toastAnnulable((existants.length?'Journée complétée':'Journée type appliquée')+' · '+fmt.duree(tot), r.entree);
    return r;
  }
  function remplirJoursOuvresVides(lundi){
    var jt=journeeType(); if(!jt){ ouvrirReglages('secJt'); return; }
    var cibles=joursVidesSemaine(lundi, contexte(maintenant()));
    if(!cibles.length){ T.toast({ message:'Aucun jour ouvré vide à remplir', type:'info' }); return; }
    var r=muter('Remplir la semaine', function(e){
      cibles.forEach(function(k){
        if((e.jours[k]||[]).length) return;
        e.jours[k]=jt.map(function(x){ return { id:T.id('h'), d:x.d, f:x.f, p:(x.p && e.projets.some(function(p){ return p.id===x.p; }))?x.p:'', n:'', o:'m' }; });
      });
    });
    if(r){ ui.focusApres='sf-'+cibles[0]; toastAnnulable(pluriel(cibles.length, 'jour rempli', 'jours remplis')+' · '+fmt.duree(dureeJt()*cibles.length), r.entree); }
  }
  function enregistrerCommeJourneeType(cle){
    var pl=plagesDe(cle); if(!pl.length) return;
    var jt=pl.slice(0, LIM.journeeType).map(function(x){ return { d:x.d, f:x.f, p:x.p||'' }; });
    var r=muter('Enregistrer la journée type', function(e){ var o=clone(e.reglages); o.journeeType=jt; e.reglages=H.validerReglages(o, e.projets); });
    if(r) toastAnnulable('Journée type enregistrée · '+fmt.duree(dureeJt())+(pl.length>LIM.journeeType?' ('+LIM.journeeType+' premières plages)':''), r.entree);
  }
  function viderJour(cle){
    var n=plagesDe(cle).length; if(!n) return;
    var r=muter('Vider le jour', function(e){ delete e.jours[cle]; });
    if(r){ ui.focusApres='ajout'; toastAnnulable('Jour vidé · '+pluriel(n, 'plage supprimée', 'plages supprimées'), r.entree, 'info'); }
  }

  /* Saisie rapide (§6.8) : analyse PURE dans taf.js ; aperçu obligatoire relié par
     aria-describedby (pas d'annonce à la frappe) ; une seule mutation, un seul Annuler. */
  function contexteSaisie(cle){
    var now=maintenant();
    return { cleJour:cle, maintenantMin:(cle===T.dates.cle(now))?minutesMurales(now):null, plagesJour:plagesDe(cle), projets:D.projets,
      debutHabituel:R().debutHabituel, pas:R().arrondiMin, mode:R().modeArrondi };
  }
  function rendreApercuSaisie(zone, champ, res, cle){
    T.vider(zone);
    champ.removeAttribute('aria-invalid');
    if(!res || !champ.value.trim()) return;
    if(res.erreurs.length){
      champ.setAttribute('aria-invalid', 'true');
      res.erreurs.forEach(function(er){
        var p=el('p', { class:'h-saisie-err' }, [ icone('alerte', 14), el('span', { text:er.message }) ]);
        if(er.code==='projet-inconnu' && er.jeton){
          var nomP=nettoyer(er.jeton, LIM.nom);
          if(nomP) p.appendChild(bouton('Créer « '+nomP+' »', 'btn small', function(){ if(creerProjet(nomP)){ champ.dispatchEvent(new Event('input')); focusSur(champ); } }));
        }
        zone.appendChild(p);
      });
      return;
    }
    if(!res.plages.length) return;
    var ul=el('ul', { class:'h-saisie-puces' });
    res.plages.forEach(function(x){
      ul.appendChild(el('li', { class:'h-saisie-puce' }, [ (x.jour!==cle?fmt.dateCourte(x.jour)+' · ':'')+x.d+' → '+x.f+' · '+fmt.duree(minutes(x.f)-minutes(x.d)) ]));
    });
    if(res.projet) ul.appendChild(el('li', { class:'h-saisie-puce projet' }, [ etiquetteProjet(res.projet) ]));
    if(res.note) ul.appendChild(el('li', { class:'h-saisie-puce note', text:'« '+res.note+' »' }));
    if(res.traverseMinuit) ul.appendChild(el('li', { class:'h-saisie-puce info', text:'traverse minuit' }));
    zone.appendChild(ul);
  }
  function enregistrerSaisie(res, cle, pDefaut, nDefaut){
    var rognees=[], total=0, nb=0;
    var r=muter('Saisie rapide', function(e){
      var p=res.projet||pDefaut||'';
      if(p && !e.projets.some(function(x){ return x.id===p; })) p='';
      var n=res.note||nDefaut||'';
      rognees=[]; total=0; nb=0;
      Object.keys(res.plagesParJour).forEach(function(k){
        if(!T.dates.cleValide(k)) return;
        res.plagesParJour[k].forEach(function(x){
          if((e.jours[k]||[]).length>=LIM.plagesJour) throw new Error(LIM.plagesJour+' plages par jour au plus.');
          var ins=H.insererPlage(e.jours[k]||[], { id:T.id('h'), d:x.d, f:x.f, p:p, n:n, o:'s' });
          e.jours[k]=ins.plages; rognees=rognees.concat(ins.rognees);
          total+=minutes(x.f)-minutes(x.d); nb++;
        });
      });
    });
    if(!r) return null;
    toastAnnulable((nb>1?nb+' plages ajoutées':'Plage ajoutée')+' · '+fmt.duree(total)+suffixeRognees(rognees), r.entree);
    return r;
  }
  // Jour visé par la saisie rapide de la colonne gauche, « J » et « N » : jour affiché (vue Jour), sinon aujourd'hui.
  function cibleJour(){ return ui.vue==='jour'?ui.ref:aujourdHui(); }
  var rapideG=$('rapideG'), rapideGApercu=$('rapideGApercu');
  function majRapideG(){
    var t=rapideG.value.trim(), cle=cibleJour();
    rendreApercuSaisie(rapideGApercu, rapideG, t?H.analyserSaisie(t, contexteSaisie(cle)):null, cle);
  }
  function brancherSaisieGauche(){
    rapideG.addEventListener('input', majRapideG);
    rapideG.addEventListener('keydown', function(e){
      if(e.key==='Escape' && rapideG.value){ e.preventDefault(); rapideG.value=''; majRapideG(); return; }
      if(e.key!=='Enter' || e.isComposing) return;
      e.preventDefault();
      var t=rapideG.value.trim(); if(!t) return;
      if(lectureSeule){ signalerLectureSeule(); return; }
      var cle=cibleJour(), res=H.analyserSaisie(t, contexteSaisie(cle));
      if(res.erreurs.length || !res.plages.length){ majRapideG(); T.annoncer(res.erreurs.length?res.erreurs[0].message:'Saisie incomplète.'); return; }
      if(enregistrerSaisie(res, cle, '', '')){ rapideG.value=''; majRapideG(); }
    });
    $('jtGauche').addEventListener('click', function(){ appliquerJtRaccourci(); });
  }
  function appliquerJtRaccourci(){
    var cle=cibleJour();
    if(!journeeType()){ ouvrirReglages('secJt'); return; }
    appliquerJourneeType(cle, plagesDe(cle).length?'completer':'vide');
  }
  function rendreExtras(ctx){
    var cle=cibleJour(), jt=journeeType(), b=$('jtGauche');
    $('rapideGLib').textContent='Saisie rapide · '+(cle===ctx.today?'aujourd’hui':fmt.dateCourte(cle));
    var lib=!jt?'Définir ma journée type':(plagesAvecVivant(cle, ctx).length?'Compléter avec la journée type':'Journée type · '+fmt.duree(dureeJt()));
    var sig=lib+'|'+cle;
    if(b.getAttribute('data-sig')!==sig){
      b.setAttribute('data-sig', sig); T.vider(b);
      b.appendChild(icone('modele', 17));
      b.appendChild(el('span', { class:'h-jt-lib' }, [ el('b', { text:lib }), jt?el('small', { text:cle===ctx.today?'aujourd’hui':fmt.dateCourte(cle) }):null ]));
      b.setAttribute('aria-label', lib+(jt?' — '+(cle===ctx.today?'aujourd’hui':fmt.dateLongue(cle)):''));
    }
    if(rapideG.value.trim()) majRapideG();
  }

  /* ============================================================
     13. RÉGLAGES (tiroir) — chaque champ est borné et validé par
         TAF.heures.validerReglages (une seule définition des bornes).
  ============================================================ */
  var RG={ obj:$('rObjHebdo'), duree:$('rDureeJour'), jours:$('rJours'), debut:$('rDebut'), pause:$('rPause'), coupure:$('rCoupure'),
    seuilAuto:$('rSeuilAuto'), seuilAutoTxt:$('rSeuilAutoTxt'), seuil:$('rSeuil'), seuilBloc:$('rSeuilBloc'), rattrapage:$('rRattrapage'), exemple:$('rExemple'),
    arrondi:$('rArrondi'), alerte:$('rAlerte'), projetDem:$('rProjetDemarrage'), secondes:$('rSecondes'), vibration:$('rVibration'), auto:$('rAuto'),
    raccourcis:$('rRaccourcis'), rappel:$('rRappel'), jtListe:$('rJtListe'), jtErreur:$('rJtErreur'), projets:$('rProjets'), projetsVide:$('rProjetsVide'),
    projetNom:$('rProjetNom'), projetErreur:$('rProjetErreur'), persistEtat:$('rPersistEtat'), persist:$('rPersist'), import:$('rImport'), fichier:$('rFichier') };
  var jtEdition=null, sigProjets='';
  function tiroirOuvert(){ var d=$('drawer'); return !!(d && d.classList.contains('open')); }

  function erreurChamp(champ, message){
    var id=champ.id+'Err', p=$(id), desc=(champ.getAttribute('aria-describedby')||'').split(' ').filter(function(x){ return x && x!==id; });
    if(!message){ champ.removeAttribute('aria-invalid'); if(p) p.parentNode.removeChild(p); if(desc.length) champ.setAttribute('aria-describedby', desc.join(' ')); else champ.removeAttribute('aria-describedby'); return; }
    champ.setAttribute('aria-invalid', 'true');
    if(!p){ p=el('p', { class:'h-erreur', id:id }); champ.parentNode.insertBefore(p, champ.nextSibling); }
    p.textContent=message;
    desc.push(id); champ.setAttribute('aria-describedby', desc.join(' '));
  }
  function appliquerReglage(cle, valeur, champ, bornes){
    // NaN (champ vidé, texte) : refusé explicitement — JSON.stringify(NaN) vaudrait « null » (= Automatique).
    if(typeof valeur==='number' && !isFinite(valeur)){ if(champ){ erreurChamp(champ, bornes||'Valeur hors bornes.'); } return false; }
    var o=clone(R()); o[cle]=valeur;
    var v=H.validerReglages(o, D.projets), avant=H.validerReglages(clone(R()), D.projets);
    if(JSON.stringify(v[cle])!==JSON.stringify(valeur)){ if(champ){ erreurChamp(champ, bornes||'Valeur hors bornes.'); } return false; }
    // Effet de bord : un réglage ne doit jamais en effacer un autre en silence (ex. journée raccourcie
    // → seuil de demi-journée personnalisé qui dépasserait la moitié : il repasserait en automatique).
    var collaterales=Object.keys(v).filter(function(k){ return k!==cle && JSON.stringify(v[k])!==JSON.stringify(avant[k]); });
    if(collaterales.length){
      var msg=collaterales.indexOf('seuilDemiMin')!==-1
        ?'Votre seuil de demi-journée ('+fmt.duree(avant.seuilDemiMin)+') dépasserait la moitié de cette journée : réduisez-le ou repassez-le en automatique d’abord.'
        :'Cette valeur modifierait aussi un autre réglage : ajustez-le d’abord.';
      if(champ) erreurChamp(champ, msg); else { T.toast({ message:msg, type:'erreur', duree:7000 }); majReglagesUI(); }
      return false;
    }
    if(champ) erreurChamp(champ, null);
    var r=muter('Modifier un réglage', function(e){ var x=clone(e.reglages); x[cle]=valeur; e.reglages=H.validerReglages(x, e.projets); });
    if(r && !r.inchange){ T.annoncer('Réglage enregistré'); majReglagesUI(); }
    return !!r;
  }
  function nombre(champ){ var n=parseFloat(String(champ.value).replace(',', '.')); return isFinite(n)?n:NaN; }
  function heuresVersMinutes(champ, pas){ var h=nombre(champ); if(!isFinite(h)) return NaN; var m=Math.round(h*60); return (pas && m%pas)?NaN:m; }
  function construireReglages(){
    var noms=T.dates.enTetesSemaine('long'), initiales_=T.dates.enTetesSemaine('initiale');
    noms.forEach(function(n, i){
      var id='rJour'+(i+1);
      var c=el('input', { type:'checkbox', id:id, value:String(i+1) });
      c.addEventListener('change', function(){
        var l=Array.prototype.filter.call(RG.jours.querySelectorAll('input'), function(x){ return x.checked; }).map(function(x){ return +x.value; });
        appliquerReglage('joursOuvres', l);
      });
      RG.jours.appendChild(el('label', { class:'h-jour-case', for:id, title:majuscule(n) }, [ c, el('span', { 'aria-hidden':'true', text:initiales_[i] }), el('span', { class:'sr-only', text:majuscule(n) }) ]));
    });
    RG.obj.addEventListener('change', function(){ appliquerReglage('objHebdoMin', heuresVersMinutes(RG.obj, 15), RG.obj, 'Entre 0 et 80 heures, par quarts d’heure (0,25).'); });
    RG.duree.addEventListener('change', function(){ appliquerReglage('dureeJourMin', heuresVersMinutes(RG.duree, 15), RG.duree, 'Entre 1 et 14 heures, par quarts d’heure (0,25).'); });
    RG.debut.addEventListener('change', function(){ appliquerReglage('debutHabituel', RG.debut.value, RG.debut, 'Heure invalide.'); });
    RG.pause.addEventListener('change', function(){ appliquerReglage('pauseDejMin', Math.round(nombre(RG.pause)), RG.pause, 'Entre 0 et 180 minutes.'); });
    RG.coupure.addEventListener('change', function(){ appliquerReglage('coupure', RG.coupure.value, RG.coupure, 'Entre 06:00 et 18:00.'); });
    RG.seuilAuto.addEventListener('change', function(){ appliquerReglage('seuilDemiMin', RG.seuilAuto.checked?null:H.seuilDemi(R())); });
    RG.seuil.addEventListener('change', function(){ appliquerReglage('seuilDemiMin', Math.round(nombre(RG.seuil)), RG.seuil, 'Entre 15 minutes et la moitié de la journée ('+(R().dureeJourMin/2)+' min).'); });
    RG.rattrapage.addEventListener('change', function(){ appliquerReglage('rattrapage', RG.rattrapage.checked); });
    RG.arrondi.addEventListener('change', function(){ appliquerReglage('arrondiMin', +RG.arrondi.value); });
    Array.prototype.forEach.call(doc.querySelectorAll('input[name="rMode"]'), function(r){ r.addEventListener('change', function(){ if(r.checked) appliquerReglage('modeArrondi', r.value); }); });
    RG.alerte.addEventListener('change', function(){ appliquerReglage('alerteOubliMin', heuresVersMinutes(RG.alerte, 0), RG.alerte, 'Entre 2 et 24 heures.'); });
    RG.projetDem.addEventListener('change', function(){ appliquerReglage('projetDemarrage', RG.projetDem.value); });
    RG.secondes.addEventListener('change', function(){ appliquerReglage('secondes', RG.secondes.checked); });
    RG.vibration.addEventListener('change', function(){ appliquerReglage('vibration', RG.vibration.checked); });
    RG.auto.addEventListener('change', function(){ appliquerReglage('autoPointer', RG.auto.checked); });
    RG.raccourcis.addEventListener('change', function(){ appliquerReglage('raccourcis', RG.raccourcis.checked); });
    RG.rappel.addEventListener('change', function(){ appliquerReglage('rappelSauvegardeJours', +RG.rappel.value); });

    // Journée type
    $('rJtAjouter').addEventListener('click', function(){
      if(!jtEdition) jtEdition=[];
      if(jtEdition.length>=LIM.journeeType){ RG.jtErreur.textContent=LIM.journeeType+' plages au plus.'; RG.jtErreur.hidden=false; return; }
      var der=jtEdition[jtEdition.length-1], d=der?Math.min(1380, minutes(der.f)+60):minutes(R().debutHabituel);
      jtEdition.push({ d:versHHMM(d), f:versHHMM(Math.min(1440, d+60)), p:'' });
      majJtEditeur(true);
    });
    $('rJtEnregistrer').addEventListener('click', enregistrerJtEditee);
    deuxTemps($('rJtSupprimer'), 'Confirmer la suppression', function(){
      if(!journeeType()) return;
      var r=muter('Supprimer la journée type', function(e){ var o=clone(e.reglages); o.journeeType=null; e.reglages=H.validerReglages(o, e.projets); });
      if(r){ jtEdition=[]; majJtEditeur(); toastAnnulable('Journée type supprimée', r.entree, 'info'); }
    });

    // Projets
    function creerDepuisTiroir(){
      RG.projetErreur.hidden=true;
      var v=nomProjetValide(RG.projetNom.value);
      if(v.erreur){ RG.projetErreur.textContent=v.erreur; RG.projetErreur.hidden=false; RG.projetNom.setAttribute('aria-invalid', 'true'); focusSur(RG.projetNom); return; }
      RG.projetNom.removeAttribute('aria-invalid');
      if(creerProjet(v.nom)){ RG.projetNom.value=''; majReglagesUI(); focusSur(RG.projetNom); }
    }
    $('rProjetCreer').addEventListener('click', creerDepuisTiroir);
    RG.projetNom.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); creerDepuisTiroir(); } });

    // Mes données
    RG.persist.addEventListener('click', function(){
      try{
        var s=global.navigator.storage;
        if(s && typeof s.persist==='function') s.persist().then(function(ok){ majPersistance(); T.toast({ message:ok?'Données protégées':'Protection refusée par le navigateur', type:ok?'succes':'info' }); }, function(){});
      }catch(e){}
    });
    $('rExporter').addEventListener('click', function(e){ ouvrirExport(e.currentTarget); });
    $('rImporter').addEventListener('click', function(){ if(lectureSeule){ signalerLectureSeule(); return; } RG.fichier.click(); });
    RG.fichier.addEventListener('change', function(){ var f=RG.fichier.files && RG.fichier.files[0]; RG.fichier.value=''; importerJson(f); });
    deuxTemps($('rEffacer'), 'Confirmer : tout effacer', effacerDonnees);
    $('openSettings').addEventListener('click', function(){ jtEdition=null; majReglagesUI(true); });
  }
  function valeurSiLibre(champ, v){ if(doc.activeElement!==champ) champ.value=v; }
  function majReglagesUI(force){
    if(!D || (!force && !tiroirOuvert())) return;
    var r=R();
    valeurSiLibre(RG.obj, fmtHeures(r.objHebdoMin)); valeurSiLibre(RG.duree, fmtHeures(r.dureeJourMin));
    Array.prototype.forEach.call(RG.jours.querySelectorAll('input'), function(c){ c.checked=r.joursOuvres.indexOf(+c.value)!==-1; });
    valeurSiLibre(RG.debut, r.debutHabituel); valeurSiLibre(RG.pause, String(r.pauseDejMin)); valeurSiLibre(RG.coupure, r.coupure);
    var auto=r.seuilDemiMin==null, seuilAuto=H.seuilAuto(r.dureeJourMin);   // formule unique (taf.js)
    RG.seuilAuto.checked=auto; RG.seuilBloc.hidden=auto; valeurSiLibre(RG.seuil, String(auto?seuilAuto:r.seuilDemiMin));
    RG.seuil.setAttribute('max', String(r.dureeJourMin/2));
    RG.seuilAutoTxt.textContent='Automatique (¼ de la journée : '+fmt.duree(seuilAuto)+')';
    RG.rattrapage.checked=r.rattrapage; RG.arrondi.value=String(r.arrondiMin);
    Array.prototype.forEach.call(doc.querySelectorAll('input[name="rMode"]'), function(x){ x.checked=x.value===r.modeArrondi; });
    valeurSiLibre(RG.alerte, fmtHeures(r.alerteOubliMin)); RG.projetDem.value=r.projetDemarrage;
    RG.secondes.checked=r.secondes; RG.vibration.checked=r.vibration; RG.auto.checked=r.autoPointer; RG.raccourcis.checked=r.raccourcis;
    RG.rappel.value=String(r.rappelSauvegardeJours);
    majExemple();
    if(jtEdition===null) majJtEditeur();
    majProjetsUI();
    majPersistance();
  }
  function fmtHeures(min){ return String(Math.round(min/60*100)/100); }
  function libExemple(dj){ return (dj.am && dj.pm)?'1 j':(dj.am?'½ j matin':(dj.pm?'½ j après-midi':'0 j')); }
  function majExemple(){
    T.vider(RG.exemple);
    var cas=[], jt=journeeType();
    if(jt) cas.push({ lib:'Votre journée type', pl:jt });
    cas.push({ lib:'09:00–12:30 + 13:30–17:00', pl:[{ d:'09:00', f:'12:30' },{ d:'13:30', f:'17:00' }] });
    cas.push({ lib:'14:00–16:00', pl:[{ d:'14:00', f:'16:00' }] });
    cas.push({ lib:'12:00–14:00', pl:[{ d:'12:00', f:'14:00' }] });
    cas.forEach(function(c){
      var dj=H.demiJournees(c.pl, R());
      RG.exemple.appendChild(el('li', { class:'h-ex-ligne' }, [ pastilleCra(dj), el('span', { class:'h-ex-lib', text:c.lib }), el('b', { text:'→ '+libExemple(dj) }) ]));
    });
  }
  function majJtEditeur(focusDernier){
    if(jtEdition===null) jtEdition=(journeeType()||[]).map(function(x){ return { d:x.d, f:x.f, p:x.p||'' }; });
    T.vider(RG.jtListe); RG.jtErreur.hidden=true;
    if(!jtEdition.length) RG.jtListe.appendChild(el('li', { class:'h-jt-vide', text:'Aucune journée type. Ajoutez une plage, ou enregistrez un jour depuis son menu ⋯.' }));
    jtEdition.forEach(function(x, i){
      var idD='rJtD'+i, idF='rJtF'+i, idP='rJtP'+i;
      var cd=el('input', { class:'taf-input h-heure', type:'time', step:'60', id:idD, value:x.d });
      var cf=el('input', { class:'taf-input h-heure', type:'time', step:'60', id:idF, value:x.f==='24:00'?'00:00':x.f });
      cd.addEventListener('change', function(){ x.d=cd.value; });
      cf.addEventListener('change', function(){ x.f=(cf.value==='00:00')?'24:00':cf.value; });
      var sel=el('select', { class:'field h-jt-projet', id:idP }, [ el('option', { value:'', text:'Sans projet' }) ]);
      D.projets.forEach(function(p){ if(!p.a || p.id===x.p) sel.appendChild(el('option', { value:p.id, text:p.nom })); });
      sel.value=x.p||''; sel.addEventListener('change', function(){ x.p=sel.value; });
      var suppr=bouton(icone('corbeille', 16), 'btn small ghost iconly', function(){ jtEdition.splice(i, 1); majJtEditeur(); focusSur($('rJtAjouter')); }, { 'aria-label':'Retirer la plage '+(i+1), title:'Retirer' });
      RG.jtListe.appendChild(el('li', { class:'h-jt-ligne' }, [
        el('div', { class:'h-champ' }, [ el('label', { class:'h-label', for:idD, text:'Début '+(i+1) }), cd ]),
        el('div', { class:'h-champ' }, [ el('label', { class:'h-label', for:idF, text:'Fin '+(i+1) }), cf ]),
        el('div', { class:'h-champ h-champ-projet' }, [ el('label', { class:'h-label', for:idP, text:'Projet' }), sel ]),
        suppr
      ]));
    });
    $('rJtSupprimer').hidden=!journeeType();
    if(focusDernier){ var c=$('rJtD'+(jtEdition.length-1)); if(c) focusSur(c); }
  }
  function enregistrerJtEditee(){
    var l=(jtEdition||[]).map(function(x){ return { d:x.d, f:x.f, p:x.p||'' }; });
    var err=null;
    l.forEach(function(x){ if(!T.valide.heure(x.d) || !(x.f==='24:00' || T.valide.heure(x.f)) || minutes(x.f)<=minutes(x.d)) err='Chaque fin doit suivre son début.'; });
    var tri=l.slice().sort(function(a, b){ return minutes(a.d)-minutes(b.d); });
    for(var i=1;i<tri.length && !err;i++){ if(minutes(tri[i].d)<minutes(tri[i-1].f)) err='Les plages se chevauchent.'; }
    if(l.length>LIM.journeeType) err=LIM.journeeType+' plages au plus.';
    if(err){ RG.jtErreur.textContent=err; RG.jtErreur.hidden=false; return; }
    var r=muter('Modifier la journée type', function(e){ var o=clone(e.reglages); o.journeeType=l.length?tri:null; e.reglages=H.validerReglages(o, e.projets); });
    if(r){ jtEdition=null; majJtEditeur(); T.annoncer(l.length?'Journée type enregistrée : '+fmt.dureeLongue(dureeJt()):'Journée type supprimée'); }
  }
  function majProjetsUI(){
    var sig=JSON.stringify(D.projets)+'|'+Object.keys(D.jours).length+'|'+JSON.stringify(R().journeeType);
    if(sig===sigProjets) return;
    sigProjets=sig;
    var focus=cleFocus(RG.projets);
    T.vider(RG.projets);
    RG.projetsVide.hidden=D.projets.length>0;
    D.projets.forEach(function(p){
      var refs=referencesProjet(p.id), idNom='rpNom-'+p.id;
      var nom=el('input', { class:'taf-input h-projet-champ', type:'text', id:idNom, maxlength:String(LIM.nom), value:p.nom, autocomplete:'off', 'data-focus':'rp-nom-'+p.id });
      nom.addEventListener('change', function(){ if(!majProjet(p.id, { nom:nom.value })) nom.value=p.nom; });
      nom.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); nom.blur(); } });
      var teintes=el('div', { class:'h-teintes', role:'group', 'aria-label':'Teinte de '+p.nom });
      for(var t=0;t<8;t++) (function(t){
        teintes.appendChild(bouton(null, 'h-teinte', function(){ majProjet(p.id, { t:t }); }, { 'data-t':String(t), 'aria-pressed':String(p.t===t), 'aria-label':'Teinte '+(t+1), title:'Teinte '+(t+1), 'data-focus':'rp-t-'+p.id+'-'+t }));
      })(t);
      var archiver=bouton(p.a?'Désarchiver':'Archiver', 'btn small ghost', function(){ majProjet(p.id, { a:!p.a }); }, { 'data-focus':'rp-a-'+p.id, 'aria-label':(p.a?'Désarchiver ':'Archiver ')+p.nom });
      var actions=[ archiver ];
      if(!refs) actions.push(bouton('Supprimer', 'btn small ghost danger', function(){ supprimerProjet(p.id); }, { 'data-focus':'rp-s-'+p.id, 'aria-label':'Supprimer '+p.nom }));
      RG.projets.appendChild(el('li', { class:'h-projet-ligne'+(p.a?' archive':'') }, [
        el('div', { class:'h-projet-haut' }, [ monogramme(p), el('label', { class:'sr-only', for:idNom, text:'Nom du projet' }), nom ]),
        teintes,
        el('div', { class:'h-projet-bas' }, [ el('span', { class:'h-aide', text:refs?(pluriel(refs, 'référence')+(p.a?' · archivé':' · archivez-le pour le masquer')):(p.a?'Archivé':'Inutilisé') }) ].concat(actions))
      ]));
    });
    if(focus){ var n=trouverFocus(RG.projets, focus); if(n) focusSur(n); }
  }
  function majPersistance(){
    var s=null;
    try{ s=global.navigator.storage; }catch(e){ s=null; }
    if(!s || typeof s.persisted!=='function'){ RG.persistEtat.textContent='Non prise en charge par ce navigateur.'; RG.persist.hidden=true; return; }
    s.persisted().then(function(p){
      RG.persistEtat.textContent=p?'Activée : le navigateur ne videra pas ces données de lui-même.':'Non activée : le navigateur peut effacer ces données s’il manque de place.';
      RG.persist.hidden=!!p || typeof s.persist!=='function';
    }, function(){ RG.persistEtat.textContent='État inconnu.'; });
  }
  function ouvrirReglages(section, declencheur){
    if(fp.ouvert) fermerFeuillePlage(false);
    if(fc.ouvert) fermerFeuilleChrono(false);
    if(ex.ouvert) fermerExport(false);
    jtEdition=null;
    majReglagesUI(true);
    T.ouvrirTiroir(declencheur||$('openSettings'));
    var d=section?$(section):null;
    if(d){
      d.open=true;
      setTimeout(function(){ var s=d.querySelector('summary'); if(s){ focusSur(s); try{ s.scrollIntoView({ block:'start' }); }catch(e){} } }, 90);
    }
  }
  function reinitialisationCommune(){
    if(!memoire) T.stockage.supprimer(CLE);
    dernierTexte=null; D=donneesNeuves(); statut='vide'; lectureSeule=false; brutOrigine=null; partiel=null; details=[]; ignores=0;
    viderPiles(); ui.accueil=null; jtEdition=null; sigProjets='';
    T.temoin.etat('', CLE);
    T.nav.rafraichir();
    rendre({ anim:true, entree:true });
    majReglagesUI();
  }
  function reinitialiser(){ reinitialisationCommune(); T.toast({ message:'Données Heures réinitialisées', type:'info' }); focusSur($('vueTitre')); }
  function effacerDonnees(){
    if(fc.ouvert) fermerFeuilleChrono(false);
    reinitialisationCommune();
    T.toast({ message:'Données Heures effacées (CRA et apparence intacts)', type:'info' });
  }

  /* ============================================================
     14. EXPORT / IMPORT — fichiers 100 % locaux (Blob, aucune requête).
  ============================================================ */
  var ex={ ouvert:false, relacher:null, cleRetour:null };
  var EX={ feuille:$('dialogueExport'), voile:$('exportVoile'), du:$('exportDu'), au:$('exportAu'), libre:$('exportLibre'), notePeriode:$('exportNotePeriode'),
    resume:$('exportResume'), lignes:$('exportLignes'), erreur:$('exportErreur'), periodes:$('exportPeriodes'), telecharger:$('exportTelecharger') };
  function radio(nom){ var r=doc.querySelector('input[name="'+nom+'"]:checked'); return r?r.value:''; }
  function cocher(nom, valeur){ Array.prototype.forEach.call(doc.querySelectorAll('input[name="'+nom+'"]'), function(r){ r.checked=r.value===valeur; }); }
  function ouvrirExport(declencheur, format, periode){
    if(fp.ouvert) fermerFeuillePlage(false);
    if(fc.ouvert) fermerFeuilleChrono(false);
    var d=T.dates.depuisCle(ui.ref), iso=T.dates.semaineIso(ui.ref);
    cocher('exportFormat', format||radio('exportFormat')||'detail');
    cocher('exportPeriode', periode||ui.vue);
    $('exportLibJour').textContent=fmt.dateCourte(ui.ref);
    $('exportLibSemaine').textContent='Sem. '+iso.semaine;
    $('exportLibMois').textContent=T.MOIS[d.getMonth()];
    EX.du.value=ui.ref.slice(0, 8)+'01';
    EX.au.value=T.dates.cle(new Date(d.getFullYear(), d.getMonth()+1, 0, 12));
    majExport();
    if(!ex.ouvert){
      ex.cleRetour=(declencheur && declencheur.getAttribute)?declencheur.getAttribute('data-focus'):null;
      ex.ouvert=true;
      ouvrirSurface(EX.feuille, EX.voile);
      ex.relacher=T.gererModale(EX.feuille, declencheur||null, doc.querySelector('input[name="exportFormat"]:checked'), fermerExport);
    }
  }
  function fermerExport(rendreFocus){
    if(!ex.ouvert) return;
    ex.ouvert=false;
    fermerSurface(EX.feuille, EX.voile);
    if(ex.relacher){ ex.relacher(rendreFocus!==false); ex.relacher=null; }
    if(rendreFocus!==false && !tiroirOuvert()) rendreFocusApres(ex.cleRetour, null);
  }
  function periodeExport(){
    var v=radio('exportPeriode'), ref=ui.ref;
    if(v==='jour') return { du:ref, au:ref, nom:ref };
    if(v==='semaine'){ var l=T.dates.lundiDe(ref), iso=T.dates.semaineIso(ref); return { du:l, au:T.dates.ajouterJours(l, 6), nom:iso.annee+'-S'+pad2(iso.semaine) }; }
    if(v==='libre'){
      var du=EX.du.value, au=EX.au.value;
      if(!T.dates.cleValide(du) || !T.dates.cleValide(au)) return { erreur:'Choisissez deux dates valides (2000–2100).' };
      if(au<du) return { erreur:'La date de fin précède la date de début.' };
      if(joursDepuis(du, au)>365) return { erreur:'Période limitée à 366 jours.' };
      return { du:du, au:au, nom:du+'_'+au };
    }
    var d=T.dates.depuisCle(ref);
    return { du:ref.slice(0, 8)+'01', au:T.dates.cle(new Date(d.getFullYear(), d.getMonth()+1, 0, 12)), nom:ref.slice(0, 7) };
  }
  function nomsProjetsJour(pl){
    var noms=[];
    pl.slice().sort(function(a, b){ return minutes(a.d)-minutes(b.d); }).forEach(function(x){ var p=projetDe(x.p); if(p && noms.indexOf(p.nom)===-1) noms.push(p.nom); });
    return noms;
  }
  // CSV (§9.2) : en-têtes exacts, « ; », CRLF, BOM, décimales à virgule, cellules texte neutralisées.
  function construireCsv(format, p){
    var lignes=[], n=0, total=0;
    if(format==='synthese'){
      lignes.push(['Date','Jour','Total (h)','Total (min)','Matin (h)','Après-midi (h)','Équivalent CRA (j)','Projets']);
      var tAm=0, tPm=0, tJ=0;
      joursEntre(p.du, p.au).forEach(function(k){
        var pl=plagesDe(k); if(!pl.length) return;
        var t=H.unionMinutes(pl), dj=H.demiJournees(pl, R()), j=(dj.am?0.5:0)+(dj.pm?0.5:0);
        total+=t; tAm+=dj.minAm; tPm+=dj.minPm; tJ+=j; n++;
        lignes.push([ fmt.dateFr(k), nomJour(k), fmt.decimal(t), String(t), fmt.decimal(dj.minAm), fmt.decimal(dj.minPm), T.csv.nombre(j), T.csv.cellule(nomsProjetsJour(pl).join(' · ')) ]);
      });
      lignes.push([ 'Total', '', fmt.decimal(total), String(total), fmt.decimal(tAm), fmt.decimal(tPm), T.csv.nombre(tJ), '' ]);
    } else {
      lignes.push(['Date','Jour','Début','Fin','Durée (h)','Durée (min)','Projet','Note','Origine']);
      joursEntre(p.du, p.au).forEach(function(k){
        plagesDe(k).forEach(function(x){
          var dur=minutes(x.f)-minutes(x.d), pr=projetDe(x.p);
          total+=dur; n++;
          lignes.push([ fmt.dateFr(k), nomJour(k), x.d, x.f, fmt.decimal(dur), String(dur), T.csv.cellule(pr?pr.nom:''), T.csv.cellule(x.n||''), NOMS_ORIGINE[x.o]||'saisie' ]);
        });
      });
    }
    return { texte:T.csv.construire(lignes), n:n, total:total };
  }
  function compterPlages(d){ var n=0; Object.keys(d.jours).forEach(function(k){ n+=d.jours[k].length; }); return n; }
  function majExport(){
    var format=radio('exportFormat'), json=format==='json';
    EX.periodes.disabled=json; EX.notePeriode.hidden=!json;
    EX.libre.hidden=radio('exportPeriode')!=='libre' || json;
    T.vider(EX.lignes); EX.erreur.hidden=true; EX.telecharger.disabled=false;
    if(json){
      EX.resume.textContent='Sauvegarde complète : '+pluriel(compterPlages(D), 'plage')+' sur '+pluriel(Object.keys(D.jours).length, 'jour')+', '+pluriel(D.projets.length, 'projet')+', réglages compris.';
      return;
    }
    var p=periodeExport();
    if(p.erreur){ EX.resume.textContent=''; EX.erreur.textContent=p.erreur; EX.erreur.hidden=false; EX.telecharger.disabled=true; return; }
    var c=construireCsv(format, p);
    EX.resume.textContent=pluriel(c.n, 'ligne')+' · '+fmt.decimal(c.total)+' h';
    c.texte.replace(/^﻿/, '').split('\r\n').slice(1, 4).forEach(function(l){ if(l) EX.lignes.appendChild(el('li', { text:l })); });
    if(!c.n) EX.lignes.appendChild(el('li', { class:'h-vide-txt', text:'Aucune plage sur cette période.' }));
  }
  function telechargerExport(){
    var format=radio('exportFormat');
    if(format==='json'){ if(exporterJson()) fermerExport(); return; }
    var p=periodeExport(); if(p.erreur){ majExport(); return; }
    var c=construireCsv(format, p);
    var ok=T.fichier.telecharger(c.texte, T.nomFichier('TAF', 'Heures', p.nom)+'.csv', 'text/csv;charset=utf-8');
    T.toast({ message:ok?'Export téléchargé · '+pluriel(c.n, 'ligne'):'Téléchargement impossible.', type:ok?'succes':'erreur' });
    if(ok) fermerExport();
  }
  function brancherExport(){
    Array.prototype.forEach.call(EX.feuille.querySelectorAll('input'), function(i){ i.addEventListener('change', majExport); });
    EX.telecharger.addEventListener('click', telechargerExport);
    $('exportAnnuler').addEventListener('click', function(){ fermerExport(); });
    $('exportFermer').addEventListener('click', function(){ fermerExport(); });
    EX.voile.addEventListener('click', function(){ fermerExport(); });
    T.glisserPourFermer($('exportPoignee'), EX.feuille, function(){ fermerExport(); });
  }
  function exporterJson(){
    var env={ format:'taf-heures', version:1, exporte:new Date().toISOString(), donnees:D };
    // Compact (sans indentation) : toute sauvegarde stockable reste sous LIM.fichierOctets à l'import.
    var ok=T.fichier.telecharger(JSON.stringify(env),'TAF_Heures_sauvegarde_'+aujourdHui()+'.json', 'application/json');
    if(!ok){ T.toast({ message:'Téléchargement impossible.', type:'erreur' }); return false; }
    if(!lectureSeule) muter('Sauvegarde', function(e){ e.meta.derniereSauvegarde=aujourdHui(); }, { pile:false, anim:false });
    T.toast({ message:'Sauvegarde téléchargée', type:'succes' });
    return true;
  }
  function exporterBrut(){
    if(brutOrigine==null) return;
    var ok=T.fichier.telecharger(brutOrigine, 'TAF_Heures_brut_'+aujourdHui()+'.txt', 'text/plain;charset=utf-8');
    T.toast({ message:ok?'Données brutes téléchargées':'Téléchargement impossible.', type:ok?'succes':'erreur' });
  }
  function erreurImport(message){
    T.vider(RG.import); RG.import.hidden=false;
    RG.import.appendChild(el('p', { class:'h-erreur', role:'alert', text:message+' Rien n’a été modifié.' }));
  }
  function importerJson(f){
    T.vider(RG.import); RG.import.hidden=true;
    if(!f) return;
    var typeOk=!f.type || f.type==='application/json' || f.type==='text/json', nomOk=/\.json$/i.test(String(f.name||''));
    if(!typeOk && !nomOk){ erreurImport('Choisissez une sauvegarde .json.'); return; }   // type contrôlé (accept= est contournable)
    if(typeof f.size==='number' && f.size>LIM.fichierOctets){ erreurImport('Fichier trop lourd (maximum '+Math.round(LIM.fichierOctets/1e6)+' Mo).'); return; }
    T.fichier.lireTexte(f, LIM.fichierOctets).then(function(texte){
      var obj;
      try{ obj=JSON.parse(texte); }catch(e){ erreurImport('Fichier illisible : ce n’est pas du JSON valide.'); return; }
      if(!T.objetSimple(obj) || obj.format!=='taf-heures' || obj.version!==1){ erreurImport('Ce fichier n’est pas une sauvegarde TAF Heures (format ou version inconnus).'); return; }
      var v=H.valider(obj.donnees);
      if(!v.donnees || v.rapport.statut==='illisible'){ erreurImport('Sauvegarde illisible : aucune donnée exploitable.'); return; }
      if(v.rapport.statut==='futur'){ erreurImport('Sauvegarde créée par une version plus récente de TAF.'); return; }
      proposerImport(v);
    }, function(err){ erreurImport((err && err.message)||'Lecture du fichier impossible.'); });
  }
  function proposerImport(v){
    var d=v.donnees, nbP=compterPlages(d), nbJ=Object.keys(d.jours).length, actuelles=compterPlages(D);
    var rapport=pluriel(nbP, 'plage')+' sur '+pluriel(nbJ, 'jour')+', '+pluriel(d.projets.length, 'projet')
      +(v.rapport.ignores?' ; '+pluriel(v.rapport.ignores, 'élément ignoré', 'éléments ignorés')+' ('+v.rapport.details.join(', ')+')':'');
    T.vider(RG.import); RG.import.hidden=false;
    var ok=bouton('Remplacer mes heures', 'btn small primary h-danger', function(){
      var r=muter('Importer une sauvegarde', function(e){
        var j=Object.create(null);
        Object.keys(d.jours).forEach(function(k){ j[k]=clone(d.jours[k]); });
        e.jours=j; e.chrono=clone(d.chrono); e.projets=clone(d.projets); e.reglages=clone(d.reglages); e.meta=clone(d.meta); e.meta.accueilVu=true;
      });
      T.vider(RG.import); RG.import.hidden=true;
      if(r){ sigProjets=''; jtEdition=null; majReglagesUI(); toastAnnulable('Sauvegarde importée · '+pluriel(nbP, 'plage'), r.entree); focusSur($('rImporter')); }
    }, { 'data-focus':'import-ok' });
    var non=bouton('Annuler', 'btn small ghost', function(){ T.vider(RG.import); RG.import.hidden=true; focusSur($('rImporter')); });
    RG.import.appendChild(el('div', { class:'h-import-rapport', role:'group', 'aria-labelledby':'importTitre' }, [
      el('p', { class:'h-label', id:'importTitre', text:'Sauvegarde lue' }),
      el('p', { class:'h-import-txt', text:rapport+'.' }),
      el('p', { class:'h-import-q', text:'Remplacer toutes vos heures actuelles ('+pluriel(actuelles, 'plage')+') ? Annulable ensuite.' }),
      el('div', { class:'h-import-actions' }, [ ok, non ])
    ]));
    focusSur(ok);
  }

  /* ============================================================
     15. CLAVIER & NAVIGATION — hash en liste blanche ; raccourcis à
         une touche désactivables, inactifs dans un champ ou une
         surface ouverte ; Ctrl/Cmd+Z, Ctrl/Cmd+Maj+Z, Ctrl+Y.
  ============================================================ */
  function lireHash(){
    var h=global.location.hash;
    if(h==='#semaine') return 'semaine';
    if(h==='#mois') return 'mois';
    if(h==='#pointer') return 'pointer';
    if(h==='#jour' || h==='') return 'jour';
    return null;
  }
  function majHash(vue){ if(global.location.hash!=='#'+vue){ try{ global.location.hash='#'+vue; }catch(e){} } }
  function allerA(vue, cle, opts){
    opts=opts||{};
    if(VUES.indexOf(vue)===-1) vue='jour';
    cle=T.dates.cleValide(cle)?cle:ui.ref;
    var ancienneVue=ui.vue, ancienRef=ui.ref;
    if(vue===ancienneVue && cle===ancienRef && !opts.force) return;
    var sens=(vue!==ancienneVue)?(VUES.indexOf(vue)>VUES.indexOf(ancienneVue)?'suivant':'precedent'):(cle>ancienRef?'suivant':(cle<ancienRef?'precedent':'fondu'));
    ui.ref=cle; session.ref=cle; ecrireSession(); ui.menu=null;
    if(vue!==ancienneVue){ ui.vue=vue; majHash(vue); }
    transition(sens, function(){ rendre({ anim:true, entree:vue!==ancienneVue }); });
    annoncerPeriode();
  }
  function deplacer(delta){
    var cle=ui.ref;
    if(ui.vue==='jour') cle=T.dates.ajouterJours(cle, delta);
    else if(ui.vue==='semaine') cle=T.dates.ajouterJours(cle, 7*delta);
    else {
      var d=T.dates.depuisCle(cle), c=new Date(d.getFullYear(), d.getMonth()+delta, 1, 12), nb=new Date(c.getFullYear(), c.getMonth()+1, 0).getDate();
      cle=T.dates.cle(new Date(c.getFullYear(), c.getMonth(), Math.min(d.getDate(), nb), 12));
    }
    if(!T.dates.cleValide(cle)){ T.annoncer('Limite du calendrier atteinte'); return; }
    allerA(ui.vue, cle);
  }
  function allerAujourdhui(){ allerA(ui.vue, aujourdHui()); }
  function annoncerPeriode(){
    var ctx=contexte(maintenant());
    if(ui.vue==='jour') T.annoncer(dateLongue(ui.ref)+', '+fmt.duree(totalJour(ui.ref, ctx)));
    else if(ui.vue==='semaine'){
      var l=T.dates.lundiDe(ui.ref), t=0;
      for(var i=0;i<7;i++) t+=totalJour(T.dates.ajouterJours(l, i), ctx);
      T.annoncer('Semaine '+T.dates.semaineIso(l).semaine+', '+fmt.duree(t));
    } else {
      var d=T.dates.depuisCle(ui.ref), r=resumeAvecVivant(d.getFullYear(), d.getMonth(), ctx), tm=0;
      Object.keys(r).forEach(function(k){ tm+=r[k].min; });
      T.annoncer(T.MOIS[d.getMonth()]+' '+d.getFullYear()+', '+fmt.duree(tm));
    }
  }
  function estChamp(n){
    if(!n || n.nodeType!==1) return false;
    if(n.isContentEditable) return true;
    if(n.tagName==='TEXTAREA' || n.tagName==='SELECT') return true;
    return n.tagName==='INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file)$/i.test(n.type||'');
  }
  function surfaceOuverte(){ return !!doc.querySelector('[role="dialog"][aria-hidden="false"]'); }
  function ouvrirSaisieRapide(){
    var g=$('gaucheExtras');
    if(g && g.offsetParent!==null && global.getComputedStyle(g).display!=='none'){ focusSur(rapideG); try{ rapideG.select(); }catch(e){} return; }
    ouvrirFeuillePlage(cibleJour(), null, null, null);
  }
  function brancherClavier(){
    doc.addEventListener('keydown', function(e){
      if(e.defaultPrevented || e.isComposing) return;
      var champ=estChamp(e.target), surface=surfaceOuverte();
      if((e.ctrlKey || e.metaKey) && !e.altKey){
        var k=(e.key||'').toLowerCase();
        if((k==='z' || k==='y') && !champ && !surface){ e.preventDefault(); if(k==='y' || e.shiftKey) retablir(); else annuler(); }
        return;
      }
      if(e.altKey || e.ctrlKey || e.metaKey || champ || surface || !D || !R().raccourcis) return;
      switch(e.key){
        case 'p': case 'P': e.preventDefault(); basculerChrono(); break;
        case 'n': case 'N': e.preventDefault(); ouvrirFeuillePlage(cibleJour(), null, null, null); break;
        case 'j': case 'J': e.preventDefault(); appliquerJtRaccourci(); break;
        case 't': case 'T': e.preventDefault(); allerAujourdhui(); break;
        case 'ArrowLeft': e.preventDefault(); deplacer(-1); break;
        case 'ArrowRight': e.preventDefault(); deplacer(1); break;
        case '/': e.preventDefault(); ouvrirSaisieRapide(); break;
        case '1': e.preventDefault(); allerA('jour', ui.ref); break;
        case '2': e.preventDefault(); allerA('semaine', ui.ref); break;
        case '3': e.preventDefault(); allerA('mois', ui.ref); break;
        default: return;
      }
    });
    // Menu ⋯ : fermé par un toucher à l'extérieur
    doc.addEventListener('pointerdown', function(e){
      if(ui.menu===null) return;
      var w=doc.querySelector('.h-menu-wrap');
      if(w && w.contains(e.target)) return;
      ui.menu=null;
      var l=$('menuJour'); if(l) l.hidden=true;
      var t=w?w.querySelector('.h-menu-btn'):null; if(t) t.setAttribute('aria-expanded', 'false');
    });
  }
  // aria-keyshortcuts reflète l'état des raccourcis à une touche (désactivables).
  function majRaccourcis(){
    var actif=!!R().raccourcis;
    Array.prototype.forEach.call(doc.querySelectorAll(actif?'[data-ks]':'[aria-keyshortcuts]'), function(n){
      if(actif){ n.setAttribute('aria-keyshortcuts', n.getAttribute('data-ks')); n.removeAttribute('data-ks'); return; }
      var v=n.getAttribute('aria-keyshortcuts');
      if(v && v.indexOf('+')===-1){ n.setAttribute('data-ks', v); n.removeAttribute('aria-keyshortcuts'); }
    });
  }
  // #pointer (favori d'écran d'accueil) : vue Jour aujourd'hui, focus sur l'hexagone (halo bref) ;
  // démarrage automatique seulement si autoPointer, chrono au repos et navigation de type « navigate ».
  function typeNavigation(){ try{ var n=global.performance.getEntriesByType('navigation')[0]; return n?n.type:''; }catch(e){ return ''; } }
  function traiterPointer(chargement){
    ui.vue='jour'; ui.ref=aujourdHui(); session.ref=ui.ref; ecrireSession();
    try{ global.history.replaceState(null, '', '#jour'); }catch(e){}
    rendre({ anim:true, entree:true });
    focusSur(pt.hex);
    pt.hex.classList.remove('halo-bref'); void pt.hex.offsetWidth; pt.hex.classList.add('halo-bref');
    setTimeout(function(){ pt.hex.classList.remove('halo-bref'); }, 1300);
    if(chargement && R().autoPointer && !D.chrono && typeNavigation()==='navigate'){
      var r=demarrerChrono();
      if(r) toastAnnulable('Chrono démarré', r.entree);
    }
  }

  /* ============================================================
     16. CYCLE DE VIE & INITIALISATION
  ============================================================ */
  // Écriture d'un autre onglet (storage), retour du bfcache, réveil : relire, valider, re-rendre.
  function rechargerExterne(){
    if(memoire || !D) return false;
    var t=T.stockage.lireTexte(CLE);
    if(t===dernierTexte) return false;
    var chronoAvant=JSON.stringify(D.chrono);
    noteEnAttente=null; if(timerNote){ clearTimeout(timerNote); timerNote=null; }
    appliquerTexte(t); viderPiles();
    if(fp.ouvert && fp.id){
      var p=plagesDe(fp.cle).filter(function(x){ return x.id===fp.id; })[0];
      if(!p || JSON.stringify(p)!==fp.origine){ fermerFeuillePlage(); T.toast({ message:'Plage modifiée dans un autre onglet', type:'info' }); }
    }
    rendre({ anim:false });
    if(JSON.stringify(D.chrono)!==chronoAvant) T.annoncer(descriptionEtat()+' (autre onglet)');
    sigProjets=''; majReglagesUI();
    return true;
  }
  function apresRestauration(){
    if(fp.ouvert && fp.id && !plagesDe(fp.cle).some(function(x){ return x.id===fp.id; })) fermerFeuillePlage();
    sigProjets=''; jtEdition=null; majReglagesUI();
  }
  function brancherCycle(){
    global.addEventListener('storage', function(e){
      if(e.key!==null && e.key!==CLE) return;
      try{ if(e.storageArea && e.storageArea!==global.localStorage) return; }catch(_){ return; }
      rechargerExterne();
    });
    doc.addEventListener('visibilitychange', function(){
      if(doc.hidden){ viderNote(); if(timerTick){ clearTimeout(timerTick); timerTick=null; } doc.body.classList.add('h-cache'); return; }
      doc.body.classList.remove('h-cache');
      if(!rechargerExterne()) rendre({ anim:false });
    });
    global.addEventListener('pageshow', function(e){ if(e.persisted && !rechargerExterne()) rendre({ anim:false }); });
    global.addEventListener('pagehide', viderNote);
    global.addEventListener('hashchange', function(){
      var v=lireHash();
      if(v==='pointer'){ traiterPointer(false); return; }
      if(v===null){ try{ global.history.replaceState(null, '', '#jour'); }catch(e){} v='jour'; }
      if(v!==ui.vue) allerA(v, ui.ref);
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-saut]'), function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        if(a.getAttribute('data-saut')==='contenu') focusSur($('vueTitre')||$('contenu'));
        else focusSur(pt.hex);
      });
    });
  }
  // Appui long (450 ms) : alternative non gestuelle = bouton ⋯ (feuille Chrono).
  function appuiLong(b, quand, action){
    var timer=null, declenche=false;
    b.addEventListener('click', function(e){ if(declenche){ declenche=false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    b.addEventListener('pointerdown', function(e){
      if(e.button>0 || !quand()) return;
      declenche=false;
      timer=setTimeout(function(){ timer=null; declenche=true; if(R().vibration) T.vibrer(10); action(); }, 450);
    });
    ['pointerup','pointerleave','pointercancel'].forEach(function(t){ b.addEventListener(t, function(){ if(timer){ clearTimeout(timer); timer=null; } }); });
    b.addEventListener('contextmenu', function(e){ if(quand()) e.preventDefault(); });
  }
  function brancherPointeuse(){
    appuiLong(pt.hex, function(){ return !D.chrono; }, function(){ ouvrirFeuilleChrono('demarrerA', pt.hex); });
    appuiLong(pt.stop, function(){ return !!(D.chrono && D.chrono.e==='marche'); }, function(){ ouvrirFeuilleChrono('arreterA', pt.stop); });
    pt.hex.addEventListener('click', function(){ basculerChrono(); });
    pt.stop.addEventListener('click', function(){ if(arreterChrono()) focusSur(pt.hex); });
    $('ptInfo').addEventListener('click', function(){ ouvrirFeuilleChrono(null, $('ptInfo')); });
    $('ptPlus').addEventListener('click', function(){ ouvrirFeuilleChrono(null, $('ptPlus')); });
    $('chronoFermer').addEventListener('click', function(){ fermerFeuilleChrono(); });
    FC.voile.addEventListener('click', function(){ fermerFeuilleChrono(); });
    T.glisserPourFermer($('chronoPoignee'), FC.feuille, function(){ fermerFeuilleChrono(); });
  }
  function observerTopbar(){
    var tb=doc.querySelector('.topbar'); if(!tb) return;
    function maj(){ doc.documentElement.style.setProperty('--topbar-h', tb.offsetHeight+'px'); }
    maj();
    if(typeof global.ResizeObserver==='function') new global.ResizeObserver(maj).observe(tb);
    else global.addEventListener('resize', maj);
  }
  function init(){
    session=lireSession();
    charger();
    ui.ref=session.ref||aujourdHui();
    // Encre lisible des monogrammes, par teinte (contraste AA calculé par TAF.encreSur).
    for(var t=0;t<8;t++) doc.documentElement.style.setProperty('--p'+t+'-encre', T.encreSur('--p'+t, { degrade:false }));
    observerTopbar();
    brancherFeuillePlage(); brancherExport(); construireReglages(); brancherPointeuse(); brancherSaisieGauche(); brancherClavier(); brancherCycle();
    var h=lireHash();
    if(h===null){ try{ global.history.replaceState(null, '', '#jour'); }catch(e){} h='jour'; }
    if(h==='pointer') traiterPointer(true);
    else { ui.vue=h; rendre({ anim:true, entree:true }); }
    if(memoire) T.temoin.etat('indisponible', CLE);
  }
  init();
})(window);
