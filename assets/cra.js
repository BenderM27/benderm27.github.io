/* ============================================================================
   TAF — MODULE CRA (assets/cra.js)
   Compte rendu d'activité mensuel. Dépend du socle window.TAF (assets/taf.js)
   et des fonctions pures window.CraDonnees (assets/cra-donnees.js), chargés
   avant (defer). Écrit UNIQUEMENT ses propres clés :
     - cra_app_v3      : l'état du CRA (sans l'apparence, désormais dans TAF) ;
     - cra_profiles_v1 : les profils d'identité.
   LIT seulement (jamais d'écriture) taf_heures_v1, pour « Importer mes
   heures » (TAF.heures.lire / resumeMois / planifierImport).
   L'apparence (accent, icône/logo, motif) appartient à TAF (taf_prefs_v1) et
   se pilote par TAF.definirPrefs() — y compris depuis un profil ou un import.
   Tant que la migration de l'apparence est en attente (quota plein,
   TAF.migrationEnAttente()), l'état écrit garde l'apparence au format
   d'origine (TAF.avecApparenceHeritee) : elle n'est jamais perdue.
   Écritures via TAF.creerSauvegarde (différé, témoin par clé, vidage avant
   de quitter la page). Multi-onglets : si un autre onglet réécrit le CRA,
   cette page cesse d'écrire (rien n'est écrasé) et propose de recharger ;
   les profils sont relus avant toute écriture.

   Source de vérité : state.days = { [numJour]: {am, pm, act} }. La grille,
   le tableau PDF, le total, l'estimation, la fiche du jour et l'aperçu de
   l'import Heures en DÉRIVENT (etatJour, recalculer, construireTableauPdf)
   — une seule logique pour le mobile et le bureau.
   Toute donnée lue (localStorage, fichier importé, profil, heures) est
   validée (CraDonnees, TAF.heures.valider) avant d'entrer dans state ; rendu
   DOM par createElement + textContent uniquement.
============================================================================ */
(function(){
  "use strict";

  var TAF=window.TAF, D=window.CraDonnees;
  if(!TAF || !D) return;                             // socle absent : page statique, sans erreur
  if(TAF.encadre) return;   // page encadrée par un tiers (anti-cadre, taf.js) : ni lecture ni écriture

  var el=TAF.el, fmt=TAF.format.nombre, fmtEur=TAF.format.eur, annoncer=TAF.annoncer, toast=TAF.toast;
  var aPropre=Object.prototype.hasOwnProperty;
  var MOIS=TAF.MOIS, JOURS_LONGS=TAF.JOURS_LONGS, JOURS_COURTS=TAF.JOURS_COURTS;
  var ENTETES_SEMAINE=TAF.dates.enTetesSemaine('court');   // dérivés de TAF.JOURS_COURTS, lundi d'abord
  var STORE_KEY=TAF.CLES.cra, PROFILES_KEY=TAF.CLES.profils;
  var MAX=D.MAX;                                     // bornes de saisie / d'import (cra-donnees.js)

  /* ============================================================
     RÉFÉRENCES DOM
  ============================================================ */
  function $(id){ return document.getElementById(id); }
  var monthSel=$('monthSel'), yearSel=$('yearSel');
  var weekdaysEl=$('weekdays'), grid=$('grid'), pdfBody=$('pdfBody');
  var totalNum=$('totalNum'), defAct=$('defAct'), synthDays=$('synthDays'), synthSub=$('synthSub');
  var printTotalNum=$('printTotalNum');
  var tjmInput=$('tjm'), chargesInput=$('charges');
  var estDays=$('estDays'), estCa=$('estCa'), estNet=$('estNet');
  var docTitleEl=$('docTitle'), commentEl=$('comment'), sheetEl=$('sheet'), printRules=$('printRules');
  var calPanel=$('calPanel');
  if(!grid || !monthSel || !yearSel || !sheetEl || !calPanel) return;

  /* ============================================================
     ÉTAT — seule source de vérité du module
        presets = modèles d'activité ; archive = { 'AAAA-MM': {days} }
  ============================================================ */
  var state={ fields:{}, provisoire:false, tjm:'', charges:'', sig:{ left:null, right:null }, month:null, year:null, days:{}, presets:[], archive:{} };

  // Champs texte persistés dans state.fields : dérivés du balisage ([data-k]) + titre + commentaire.
  // TJM / charges (type=number) ont leur propre clé d'état (state.tjm / state.charges) : exclus.
  var INPUTS_K=Array.prototype.filter.call(document.querySelectorAll('input[data-k]'), function(i){ return ['file','color','checkbox','number'].indexOf(i.type)===-1; });
  var CHAMPS=INPUTS_K.map(function(i){ return i.getAttribute('data-k'); }).concat(['docTitle','comment']).filter(TAF.cleSure);
  function validerEtat(s){ return D.validerEtat(s, { champs:CHAMPS }); }

  /* ============================================================
     PERSISTANCE — mécanisme partagé TAF.creerSauvegarde (écriture
     différée, témoin par clé, vidage sur pagehide / onglet masqué)
  ============================================================ */
  // Tant que la migration de l'apparence attend (quota), l'apparence reste écrite ici au
  // format d'origine : un rechargement la retrouve intacte.
  function etatAPersister(){ return TAF.avecApparenceHeritee(state, TAF.migrationEnAttente()); }
  var sauvegarde=TAF.creerSauvegarde(STORE_KEY, etatAPersister, { delai:300 });
  var effacement=false;                               // « Effacer mes données » en cours : plus aucune écriture
  var perime=false, dernierAvisPerime=0;              // CRA réécrit par un autre onglet : plus aucune écriture
  /* cra_app_v3 ILLISIBLE (JSON invalide / forme non plausible) : lecture seule. Le texte
     brut reste en mémoire pour « Exporter le brut » ; aucune écriture (ni différée, ni au
     pagehide) tant que l'utilisateur n'a pas explicitement effacé ses données ou réussi
     un import JSON. */
  var craIllisible=false, brutCra=null;
  function signalerPerime(){
    var t=Date.now(); if(t-dernierAvisPerime<8000) return; dernierAvisPerime=t;
    toast({ message:'CRA modifié dans un autre onglet — rechargez : cette page n’enregistre plus rien pour ne pas l’écraser.', type:'erreur', duree:60000,
      action:{ libelle:'Recharger', fn:function(){ location.reload(); } } });
  }
  function signalerCraIllisible(force){
    var t=Date.now(); if(force!==true && t-dernierAvisPerime<8000) return; dernierAvisPerime=t;
    toast({ message:'Données du CRA illisibles : rien n’est enregistré ni écrasé. Exportez le brut, puis effacez vos données ou importez une sauvegarde.', type:'erreur', duree:60000,
      action:{ libelle:'Exporter le brut', fn:exporterBrutCra } });
  }
  function exporterBrutCra(){
    if(brutCra==null) return;
    var ok=TAF.fichier.telecharger(brutCra, 'CRA_brut.txt', 'text/plain;charset=utf-8');
    toast(ok?'Données brutes du CRA téléchargées':'Téléchargement impossible.', ok?'succes':'erreur');
  }
  function ecritureBloquee(){ return effacement || perime || craIllisible; }
  // save() → booléen : true si l'écriture a réussi (false : quota, stockage indisponible, page périmée, CRA illisible).
  function save(){ if(craIllisible){ signalerCraIllisible(); return false; } if(perime){ signalerPerime(); return false; } return effacement?false:sauvegarde.maintenant(); }
  function saveSoon(){ if(craIllisible){ signalerCraIllisible(); return; } if(perime){ signalerPerime(); return; } if(!effacement) sauvegarde.bientot(); }
  function saveSilencieux(){ if(!ecritureBloquee()) sauvegarde.bientot(); }   // ré-écriture technique : aucun avis
  function vidanger(){ if(!ecritureBloquee()) sauvegarde.vider(); }
  function marquerPerime(){
    if(perime || effacement) return;
    perime=true; sauvegarde.annuler();                // l'écriture en attente n'écrasera pas l'autre onglet
    TAF.temoin.etat('echec', STORE_KEY);              // témoin persistant : plus rien n'est enregistré ici
    signalerPerime();
  }
  // Migration terminée (place libérée) → réécrire sans l'ancien format ; migration en attente →
  // la copie d'origine suit l'apparence courante.
  TAF.surPrefs(function(p, origine){ if(origine==='migration' || TAF.migrationEnAttente()) saveSilencieux(); });

  /* ============================================================
     SÉLECTEURS MOIS / ANNÉE
  ============================================================ */
  var now=new Date();
  MOIS.forEach(function(m, i){ monthSel.appendChild(el('option', { value:String(i), text:m })); });
  var curY=now.getFullYear();
  for(var y=curY-2; y<=curY+3; y++) yearSel.appendChild(el('option', { value:String(y), text:String(y) }));
  monthSel.value=String(now.getMonth()); yearSel.value=String(curY);
  // Garantit qu'une année (état restauré, archive, import) est sélectionnable, à sa place.
  function assurerAnnee(an){
    if(!Number.isInteger(an) || an<D.ANNEES.min || an>D.ANNEES.max) return;
    var v=String(an), opts=yearSel.options;
    for(var i=0;i<opts.length;i++){ if(opts[i].value===v) return; }
    var o=el('option', { value:v, text:v }), avant=null;
    for(var j=0;j<opts.length;j++){ if(Number(opts[j].value)>an){ avant=opts[j]; break; } }
    yearSel.insertBefore(o, avant);
  }
  function moisAffiche(){ return parseInt(monthSel.value, 10); }
  function anneeAffichee(){ return parseInt(yearSel.value, 10); }
  function nbJoursAffiches(){ return D.joursDansMois(anneeAffichee(), moisAffiche()); }

  /* ============================================================
     ÉTAT D'UN JOUR — accès et nettoyage
  ============================================================ */
  function jour(d){ return state.days[d] || { am:false, pm:false, act:'' }; }
  function assurerJour(d){ if(!state.days[d]) state.days[d]={ am:false, pm:false, act:'' }; return state.days[d]; }
  function nettoyerJour(d){ var j=state.days[d]; if(j && !j.am && !j.pm && !(j.act||'').trim()) delete state.days[d]; }
  // État dérivé pour la pastille hexagone : vide / demie (am=gauche, pm=droite) / pleine
  var etatJour=D.etatJour;
  function libFull(st, side){ return st==='full'?'Journée complète cochée':(st==='half'?('Demi-journée cochée — '+(side==='am'?'matin':'après-midi')):'Cocher la journée complète'); }
  // Texte saisi dans un contenteditable : texte brut uniquement quand le navigateur le permet.
  function editableTexte(n){ try{ n.contentEditable='plaintext-only'; }catch(e){ n.contentEditable='true'; } if(n.contentEditable!=='plaintext-only') n.contentEditable='true'; }

  /* ============================================================
     CONSTRUCTION DE LA GRILLE (vue écran) — DOM, jamais innerHTML
        Semaine commençant le lundi : cases vides avant le 1er,
        les jours, puis on complète la dernière semaine.
  ============================================================ */
  function creerCellule(d, m, an){
    var wd=new Date(an, m, d).getDay(), we=(wd===0||wd===6);
    var estAuj=(d===now.getDate() && m===now.getMonth() && an===now.getFullYear());
    var j=jour(d), sel=j.am||j.pm, e=etatJour(j), demi=(j.am?0.5:0)+(j.pm?0.5:0), sd=String(d);
    var cell=el('div', { class:'cell'+(we?' we':'')+(sel?' sel':'')+(estAuj?' today':''), 'data-d':sd, 'aria-current':estAuj?'date':null }, [
      el('button', { class:'cell-tap', type:'button', 'aria-label':'Renseigner le '+d }),
      el('div', { class:'cell-top' }, [
        el('span', { class:'num', text:sd }),
        el('span', { class:'day-tot', text:demi?fmt(demi)+' j':'' }),
        el('button', { class:'cell-full', type:'button', 'data-d':sd, 'data-state':e.st, 'data-side':e.side, 'aria-pressed':String(j.am&&j.pm), 'aria-label':libFull(e.st, e.side)+' du '+d }, [ el('span', { class:'cf-hex' }) ])
      ]),
      el('div', { class:'cell-slots' }, [
        el('button', { class:'slot am'+(j.am?' on':''), type:'button', 'data-l':'M', 'aria-pressed':String(j.am), 'aria-label':'Matin du '+d }),
        el('button', { class:'slot pm'+(j.pm?' on':''), type:'button', 'data-l':'A', 'aria-pressed':String(j.pm), 'aria-label':'Après-midi du '+d })
      ])
    ]);
    var act=el('div', { class:'cell-act', 'data-d':sd, 'data-placeholder':'Activité…', role:'textbox', 'aria-label':'Activité du '+d, text:j.act||'' });
    editableTexte(act);
    cell.appendChild(act);
    return cell;
  }
  function construireSemaine(){
    TAF.vider(weekdaysEl);
    ENTETES_SEMAINE.forEach(function(t, i){ weekdaysEl.appendChild(el('span', { class:i>=5?'we':null, text:t })); });
  }
  function construireGrille(){
    var m=moisAffiche(), an=anneeAffichee();
    var nb=nbJoursAffiches();
    var decalage=(new Date(an, m, 1).getDay()+6)%7;      // lundi=0 … dimanche=6
    var frag=document.createDocumentFragment();
    for(var i=0;i<decalage;i++) frag.appendChild(el('div', { class:'cell empty', 'aria-hidden':'true' }));
    for(var d=1; d<=nb; d++) frag.appendChild(creerCellule(d, m, an));
    var reste=(7-((decalage+nb)%7))%7;
    for(var k=0;k<reste;k++) frag.appendChild(el('div', { class:'cell empty', 'aria-hidden':'true' }));
    TAF.vider(grid); grid.appendChild(frag);
    recalculer();
  }

  /* Mise à jour visuelle d'UNE cellule (sans reconstruire : le curseur d'une activité
     en cours d'édition n'est pas perdu — l'activité affichée n'est réécrite que hors focus). */
  function majCellule(d){
    var cell=grid.querySelector('.cell[data-d="'+d+'"]'); if(!cell) return;
    var j=jour(d), sel=j.am||j.pm;
    cell.classList.toggle('sel', sel);
    var am=cell.querySelector('.slot.am'), pm=cell.querySelector('.slot.pm');
    am.classList.toggle('on', j.am); am.setAttribute('aria-pressed', String(j.am));
    pm.classList.toggle('on', j.pm); pm.setAttribute('aria-pressed', String(j.pm));
    var demi=(j.am?0.5:0)+(j.pm?0.5:0);
    cell.querySelector('.day-tot').textContent=demi?fmt(demi)+' j':'';
    var fb=cell.querySelector('.cell-full');
    if(fb){ var e=etatJour(j); fb.setAttribute('data-state', e.st); fb.setAttribute('data-side', e.side); fb.setAttribute('aria-pressed', String(j.am&&j.pm)); fb.setAttribute('aria-label', libFull(e.st, e.side)+' du '+d); }
    var act=cell.querySelector('.cell-act');
    if(act && document.activeElement!==act && act.textContent!==(j.act||'')) act.textContent=j.act||'';
  }

  /* ============================================================
     TABLEAU PDF (liste) — généré depuis l'état, à la demande
        Deux teintes cumulables : « we » (week-end) et « nc »
        (non coché) — cf. cra-print.css.
  ============================================================ */
  function construireTableauPdf(){
    var m=moisAffiche(), an=anneeAffichee(), nb=nbJoursAffiches();
    var frag=document.createDocumentFragment();
    for(var d=1; d<=nb; d++){
      var wd=new Date(an, m, d).getDay(), we=(wd===0||wd===6), j=jour(d), coche=j.am||j.pm;
      var cls=(we?' we':'')+(coche?'':' nc');
      frag.appendChild(el('tr', { class:cls?cls.slice(1):null }, [
        el('td', { class:'center pt-box' }, [ el('span', { class:'pbox'+(j.am?' on':'') }) ]),
        el('td', { class:'center pt-box' }, [ el('span', { class:'pbox'+(j.pm?' on':'') }) ]),
        el('td', { class:'pt-date' }, [ el('span', { class:'dn', text:JOURS_COURTS[wd] }), el('span', { class:'dd', text:(d<10?'0':'')+d }) ]),
        el('td', { class:'pt-act', text:coche?(j.act||''):'' })
      ]));
    }
    TAF.vider(pdfBody); pdfBody.appendChild(frag);
  }

  /* ============================================================
     TOTAL + ESTIMATION + COMPTEUR — dérivés de state
  ============================================================ */
  var demarre=false;   // pas d'annonce ni de pulsation au premier rendu
  function totalJours(){ var demi=0; for(var d in state.days){ if(!aPropre.call(state.days, d)) continue; var j=state.days[d]; if(j.am) demi++; if(j.pm) demi++; } return demi*0.5; }
  function recalculer(){
    var total=totalJours(), txt=fmt(total);
    if(totalNum.textContent!==txt){
      totalNum.textContent=txt;
      if(demarre){
        totalNum.classList.remove('pulse'); void totalNum.offsetWidth; totalNum.classList.add('pulse');
        annoncer(txt+' '+(total>1?'jours cochés':'jour coché'));
      }
    }
    if(synthDays) synthDays.textContent=txt+' j';
    if(printTotalNum) printTotalNum.textContent=txt;
    if(synthSub) synthSub.setAttribute('data-empty', (total===0)?'1':'');
    majAstuce(total);
    majEstimation(total);
  }
  /* Astuce d'état vide de la pop-up : n'est retirée du flux qu'à la PROCHAINE ouverture.
     Pendant l'édition, elle s'estompe seulement (opacity) : aucun décalage de la grille
     (CLS), et un clic-glissé commencé sur un mois vide ne « perd » pas ses créneaux. */
  function majAstuce(total){
    if(!calPanel) return;
    if(!calPanel.classList.contains('open')){ calPanel.setAttribute('data-vide', total===0?'1':''); calPanel.classList.remove('astuce-lue'); }
    else calPanel.classList.toggle('astuce-lue', total>0);
  }
  // Calcul sur l'ÉTAT (state.tjm / state.charges), qui est toujours la valeur affichée par les champs.
  function majEstimation(jours){
    var tjm=Number(state.tjm)||0, ch=Number(state.charges)||0;
    var ca=jours*tjm, net=ca*(1-ch/100);
    estDays.textContent=fmt(jours); estCa.textContent=fmtEur(ca); estNet.textContent=fmtEur(net);
  }

  /* ============================================================
     BASCULE D'UN CRÉNEAU / D'UNE JOURNÉE
  ============================================================ */
  function infoSlot(slot){ return { d:slot.closest('.cell').getAttribute('data-d'), type:slot.classList.contains('am')?'am':'pm' }; }
  function estActif(d, type){ var j=state.days[d]; return !!(j && j[type]); }
  function definirCreneau(d, type, val){ assurerJour(d)[type]=val; nettoyerJour(d); majCellule(d); recalculer(); saveSoon(); }
  function definirJournee(d, val){ var k=assurerJour(d); k.am=val; k.pm=val; nettoyerJour(d); majCellule(d); recalculer(); saveSoon(); }
  function buzz(){ TAF.vibrer(10); }                   // silencieux, coupé si mouvement réduit

  /* ============================================================
     ACTIONS GROUPÉES
  ============================================================ */
  function joursOuvres(){
    var m=moisAffiche(), an=anneeAffichee(), nb=nbJoursAffiches();
    for(var d=1; d<=nb; d++){
      var wd=new Date(an, m, d).getDay(), we=(wd===0||wd===6);
      if(we){ var j=state.days[d]; if(j){ j.am=false; j.pm=false; nettoyerJour(d); } }
      else { var k=assurerJour(d); k.am=true; k.pm=true; }
    }
    construireGrille(); saveSoon(); annoncer('Jours ouvrés cochés — '+fmt(totalJours())+' jours');
  }
  function toutDecocher(){
    Object.keys(state.days).forEach(function(d){ state.days[d].am=false; state.days[d].pm=false; nettoyerJour(d); });
    construireGrille(); saveSoon(); annoncer('Calendrier vidé');
  }
  function appliquerActivite(){
    var v=TAF.texteBorne(defAct.value.trim(), MAX.activite);
    if(!v){ defAct.focus(); toast('Saisissez d’abord une activité à appliquer', 'info'); return; }
    var n=0;
    Object.keys(state.days).forEach(function(d){ var j=state.days[d]; if(j.am||j.pm){ j.act=v; n++; } });
    construireGrille(); saveSoon();
    toast(n?('Activité appliquée à '+n+' '+(n>1?'jours':'jour')):'Aucun jour coché où appliquer l’activité', n?'succes':'info');
  }

  /* ============================================================
     MODÈLES D'ACTIVITÉ (presets) — dérivent de state.presets
  ============================================================ */
  var presetListEl=$('presetList'), presetEmptyEl=$('presetEmpty');
  var ICONE_CROIX={ vb:'0 0 24 24', a:{ fill:'none', stroke:'currentColor', 'stroke-width':'2.6', 'stroke-linecap':'round' }, p:[ { d:'M18 6 6 18M6 6l12 12' } ] };
  function rendrePresets(){
    if(!presetListEl) return;
    TAF.vider(presetListEl);
    if(presetEmptyEl) presetEmptyEl.hidden=state.presets.length>0;
    state.presets.forEach(function(txt, i){
      var fill=el('button', { type:'button', class:'preset-fill', title:'Utiliser : '+txt, 'aria-label':'Utiliser le modèle : '+txt, text:txt });
      fill.addEventListener('click', function(){ defAct.value=txt; defAct.focus(); annoncer('Modèle inséré : '+txt); });
      var del=el('button', { type:'button', class:'preset-del', 'aria-label':'Supprimer le modèle : '+txt }, [ TAF.creerSvg(ICONE_CROIX) ]);
      del.addEventListener('click', function(){
        state.presets.splice(i, 1); rendrePresets(); saveSoon(); annoncer('Modèle supprimé');
        var suivant=presetListEl.querySelectorAll('.preset-fill')[Math.min(i, state.presets.length-1)];
        (suivant||$('presetAdd')).focus();
      });
      presetListEl.appendChild(el('span', { class:'preset-chip' }, [ fill, del ]));
    });
  }
  function ajouterPreset(){
    var v=TAF.texteBorne(defAct.value.trim(), MAX.preset);
    if(!v){ defAct.focus(); toast('Saisissez une activité avant de créer un modèle', 'info'); return; }
    if(state.presets.indexOf(v)!==-1){ toast('Ce modèle existe déjà', 'info'); return; }
    if(state.presets.length>=MAX.presets){ toast('Nombre maximal de modèles atteint', 'erreur'); return; }
    state.presets.push(v); rendrePresets(); saveSoon(); annoncer('Modèle enregistré');
  }
  $('presetAdd').addEventListener('click', ajouterPreset);

  /* ============================================================
     INTERACTIONS GRILLE (délégation d'événements)
        Souris : clic = bascule ; clic-glissé = « peinture ».
        Tactile : la surface .cell-tap ouvre la fiche du jour.
  ============================================================ */
  var enPeinture=false, valPeinture=null, peintureBougee=false, origineSlot=null, ignorerClic=false;
  function finPeinture(){
    if(!enPeinture) return;
    enPeinture=false; document.body.classList.remove('painting');
    if(peintureBougee) ignorerClic=true;
  }
  grid.addEventListener('pointerdown', function(e){
    ignorerClic=false;
    if(e.pointerType==='touch' || e.button!==0) return;           // glisser réservé souris / stylet
    var slot=e.target.closest('.slot'); if(!slot) return;
    enPeinture=true; peintureBougee=false; origineSlot=slot;
    var info=infoSlot(slot); valPeinture=!estActif(info.d, info.type);
  });
  document.addEventListener('pointermove', function(e){
    if(!enPeinture) return;
    if(e.buttons===0){ enPeinture=false; document.body.classList.remove('painting'); return; }
    var cible=document.elementFromPoint(e.clientX, e.clientY);
    var slot=cible && cible.closest?cible.closest('.slot'):null;
    if(!slot || !grid.contains(slot)) return;
    if(!peintureBougee){ peintureBougee=true; document.body.classList.add('painting'); var o=infoSlot(origineSlot); definirCreneau(o.d, o.type, valPeinture); }
    var info=infoSlot(slot);
    if(estActif(info.d, info.type)!==valPeinture) definirCreneau(info.d, info.type, valPeinture);
  });
  document.addEventListener('pointerup', finPeinture);
  document.addEventListener('pointercancel', finPeinture);

  grid.addEventListener('click', function(e){
    if(ignorerClic){ ignorerClic=false; return; }                 // absorbe le clic résiduel d'un glisser
    var full=e.target.closest('.cell-full');
    if(full){ var df=full.closest('.cell').getAttribute('data-d'), jf=jour(df); definirJournee(df, !(jf.am&&jf.pm)); buzz(); return; }
    var slot=e.target.closest('.slot');
    if(slot){ var info=infoSlot(slot); definirCreneau(info.d, info.type, !estActif(info.d, info.type)); buzz(); return; }
    var tap=e.target.closest('.cell-tap');
    if(tap) ouvrirFiche(tap.closest('.cell').getAttribute('data-d'), tap);
  });
  grid.addEventListener('input', function(e){
    var act=e.target.closest('.cell-act'); if(!act) return;
    var d=act.getAttribute('data-d'); if(!TAF.valide.jour(d)) return;
    assurerJour(d).act=TAF.texteBorne(act.innerText, MAX.activite); nettoyerJour(d); saveSoon();
  });
  grid.addEventListener('keydown', function(e){
    var act=e.target.closest('.cell-act'); if(act && e.key==='Enter'){ e.preventDefault(); act.blur(); }
  });

  /* ============================================================
     FICHE DU JOUR (feuille basse, tactile)
  ============================================================ */
  var daySheet=$('daySheet'), dayOverlay=$('dayOverlay');
  var daySheetTitle=$('daySheetTitle'), daySheetAct=$('daySheetAct'), daySheetFull=$('daySheetFull');
  var jourCourant=null, relacherFiche=null;
  function libelleJour(d){
    var m=moisAffiche(), an=anneeAffichee(), wd=new Date(an, m, d).getDay();
    var nom=JOURS_LONGS[wd]; nom=nom.charAt(0).toUpperCase()+nom.slice(1);
    return nom+' '+d+' '+MOIS[m].toLowerCase();
  }
  function majFiche(){
    var j=jour(jourCourant), pleine=j.am&&j.pm;
    var segAm=daySheet.querySelector('[data-slot="am"]'), segPm=daySheet.querySelector('[data-slot="pm"]');
    segAm.classList.toggle('on', j.am); segAm.setAttribute('aria-pressed', String(j.am));
    segPm.classList.toggle('on', j.pm); segPm.setAttribute('aria-pressed', String(j.pm));
    daySheetFull.classList.toggle('on', pleine); daySheetFull.setAttribute('aria-pressed', String(pleine));
    if(document.activeElement!==daySheetAct) daySheetAct.value=j.act||'';
  }
  function ouvrirFiche(d, declencheur){
    if(!TAF.valide.jour(String(d))) return;
    jourCourant=d; daySheetTitle.textContent=libelleJour(d); majFiche();
    daySheet.classList.add('open'); dayOverlay.classList.add('open'); daySheet.setAttribute('aria-hidden','false');
    relacherFiche=TAF.gererModale(daySheet, declencheur||null, daySheetTitle, fermerFiche);
  }
  function fermerFiche(){
    if(!daySheet.classList.contains('open')) return;
    daySheet.classList.remove('open'); dayOverlay.classList.remove('open'); daySheet.setAttribute('aria-hidden','true'); jourCourant=null;
    if(relacherFiche){ relacherFiche(); relacherFiche=null; }
  }
  Array.prototype.forEach.call(daySheet.querySelectorAll('.seg-btn'), function(b){
    b.addEventListener('click', function(){ if(jourCourant==null) return; var t=b.getAttribute('data-slot'); definirCreneau(jourCourant, t, !estActif(jourCourant, t)); majFiche(); buzz(); });
  });
  daySheetFull.addEventListener('click', function(){ if(jourCourant==null) return; var j=jour(jourCourant); definirJournee(jourCourant, !(j.am&&j.pm)); majFiche(); buzz(); });
  daySheetAct.addEventListener('input', function(){ if(jourCourant==null) return; assurerJour(jourCourant).act=TAF.texteBorne(daySheetAct.value, MAX.activite); nettoyerJour(jourCourant); majCellule(jourCourant); saveSoon(); });
  $('daySheetClear').addEventListener('click', function(){
    if(jourCourant==null) return;
    var j=assurerJour(jourCourant); j.am=false; j.pm=false; j.act=''; nettoyerJour(jourCourant);
    majCellule(jourCourant); recalculer(); majFiche(); daySheetAct.value=''; saveSoon(); annoncer('Jour vidé');
  });
  $('daySheetClose').addEventListener('click', fermerFiche);
  $('daySheetDone').addEventListener('click', fermerFiche);
  dayOverlay.addEventListener('click', fermerFiche);

  // Glisser la poignée vers le bas pour refermer (au-delà de 80px) : comportement commun (taf.js).
  TAF.glisserPourFermer($('daySheetGrab'), daySheet, fermerFiche);

  /* ============================================================
     MENTION « PROVISOIRE » — dérive body.provisoire (badge écran +
     filigrane PDF + signatures masquées)
  ============================================================ */
  var provToggle=$('provToggle');
  function appliquerProvisoire(on){ state.provisoire=!!on; document.body.classList.toggle('provisoire', !!on); if(provToggle) provToggle.checked=!!on; }
  if(provToggle) provToggle.addEventListener('change', function(){ appliquerProvisoire(provToggle.checked); saveSoon(); annoncer(provToggle.checked?'CRA marqué provisoire':'Mention provisoire retirée'); });

  /* ============================================================
     POP-UP CALENDRIER (modale sur tous les viewports)
        Plein écran glissant sous 700px, boîte centrée au-delà.
        Focus via TAF.gererModale (déplacé, piégé, restitué ; Escape
        ferme la surface la plus haute).
  ============================================================ */
  var calOverlay=$('calOverlay'), openCalBtn=$('openCal');
  var calTitre=$('calMobileTitle');
  var relacherCal=null;

  // Divulgation progressive des aides : repliées par défaut sur écran bas (le calendrier
  // d'abord), dépliées sur grand écran ; le choix explicite de l'utilisateur prime ensuite.
  var aidsToggle=$('aidsToggle'), aidsPlus=$('aidsPlus'), choixAides=null;
  function deplierAides(ouvert){ aidsPlus.hidden=!ouvert; aidsToggle.setAttribute('aria-expanded', ouvert?'true':'false'); }
  aidsToggle.addEventListener('click', function(){
    choixAides=aidsPlus.hidden; deplierAides(choixAides);
    if(choixAides) defAct.focus({ preventScroll:true });
  });

  function ouvrirCal(){
    if(calPanel.classList.contains('open')) return;
    var grandEcran=false; try{ grandEcran=window.matchMedia('(min-width: 700px) and (min-height: 940px)').matches; }catch(e){}
    deplierAides(choixAides!=null?choixAides:grandEcran);
    majBoutonHeures();                                 // heures saisies entre-temps (autre page / onglet)
    majAstuce(totalJours());                           // pop-up encore fermée : astuce selon l'état actuel
    calPanel.classList.add('open'); calOverlay.classList.add('open'); document.body.classList.add('cal-open');
    calPanel.setAttribute('role','dialog'); calPanel.setAttribute('aria-modal','true'); calPanel.setAttribute('aria-labelledby','calMobileTitle'); calPanel.setAttribute('aria-hidden','false');
    openCalBtn.setAttribute('aria-expanded','true');
    relacherCal=TAF.gererModale(calPanel, openCalBtn, calTitre, fermerCal);
  }
  function fermerCal(){
    if(!calPanel.classList.contains('open')) return;
    if(importOuvert()) fermerImport(false);
    if(daySheet.classList.contains('open')) fermerFiche();
    calPanel.classList.remove('open'); calOverlay.classList.remove('open'); document.body.classList.remove('cal-open');
    calPanel.removeAttribute('role'); calPanel.removeAttribute('aria-modal'); calPanel.removeAttribute('aria-labelledby'); calPanel.setAttribute('aria-hidden','true');
    openCalBtn.setAttribute('aria-expanded','false');
    if(relacherCal){ relacherCal(); relacherCal=null; }
  }
  openCalBtn.addEventListener('click', ouvrirCal);
  $('closeCal').addEventListener('click', fermerCal);
  calOverlay.addEventListener('click', fermerCal);

  /* ============================================================
     EFFACER MES DONNÉES — CRA (mois, archive, modèles, signatures)
     + apparence (réinitialisée via l'API TAF). Profils conservés.
  ============================================================ */
  $('clearData').addEventListener('click', function(){
    if(!window.confirm('Effacer les données du CRA enregistrées sur cet appareil (mois, archive, modèles, signatures) et réinitialiser l’apparence ?\nLes profils d’identité sont conservés.')) return;
    effacement=true; sauvegarde.annuler();          // plus aucune écriture du CRA (ni différée, ni au pagehide)
    TAF.stockage.supprimer(STORE_KEY);
    TAF.reinitialiserPrefs();
    location.reload();
  });

  /* ============================================================
     EXPORT / IMPORT JSON (100 % hors-ligne)
        Export : state + prefs (apparence TAF) via Blob + <a download>.
        Import : fichier NON FIABLE → JSON.parse en try/catch, puis
        CraDonnees.lireImport (forme plausible, choix du format : ANCIEN
        = apparence au premier niveau, NOUVEAU = objet prefs), validerEtat,
        confirmation avant écrasement.
  ============================================================ */
  function nomBase(){ var soc=($('fSociete').value||'').trim()||'CRA'; return 'CRA_'+soc+'_'+MOIS[moisAffiche()]+'_'+anneeAffichee(); }
  TAF.definirNomImpression(nomBase);   // nom de fichier PDF proposé (titre posé pendant l'impression seulement)
  function exporterJson(){
    var ok=false;
    try{
      var donnees=JSON.parse(JSON.stringify(state));
      donnees.prefs=TAF.prefs();
      ok=TAF.fichier.telecharger(JSON.stringify(donnees, null, 2), (TAF.nomFichier(nomBase())||'CRA')+'.json', 'application/json');
    }catch(e){ ok=false; }
    toast(ok?'CRA exporté en fichier JSON':'Export impossible sur ce navigateur.', ok?'succes':'erreur');
  }
  function importerJson(fichier){
    TAF.fichier.lireTexte(fichier, MAX.importOctets).then(function(texte){
      var obj=null;
      try{ obj=JSON.parse(texte); }
      catch(err){ toast('Fichier illisible : ce n’est pas un JSON valide.', 'erreur'); return; }
      var lu=D.lireImport(obj, { champs:CHAMPS });
      if(!lu){ toast('Ce fichier ne correspond pas à un CRA exporté.', 'erreur'); return; }
      // Budget : un état trop lourd (signatures / archive géantes) ne pourrait plus être enregistré
      // et bloquerait toute sauvegarde suivante → refusé AVANT toute modification.
      if(D.etatTropLourd(obj) || D.etatTropLourd(lu.etat)){
        toast({ message:'Import refusé : ce CRA est trop volumineux pour être enregistré sur cet appareil (signatures ou archive trop lourdes). Rien n’a été modifié.', type:'erreur', duree:9000 }); return;
      }
      if(craIllisible){
        if(!window.confirm('Les données du CRA enregistrées sur cet appareil sont illisibles. Importer les remplacera définitivement (exportez d’abord le brut pour les conserver). Continuer ?')) return;
      } else if(moisNonVide() || Object.keys(state.archive).length){
        if(!window.confirm('Importer remplacera votre CRA en cours (mois affiché, archive et modèles). Continuer ?')) return;
      }
      try{
        invaliderAnnulationImport();
        if(craIllisible){ craIllisible=false; brutCra=null; TAF.temoin.etat('', STORE_KEY); majAvis(); }   // levée explicite du blocage
        appliquerEtat(lu.etat);
        rafraichirTout();
        var okPrefs=lu.prefs?TAF.definirPrefs(lu.prefs):true;   // apparence absente → inchangée ; false : non écrite (quota)
        var ok=save();
        if(!ok) toast('CRA importé (non enregistré localement) — exportez-le pour ne rien perdre', 'erreur');
        else if(!okPrefs) toast('CRA importé, mais l’apparence n’a pas pu être enregistrée (stockage plein)', 'erreur');
        else toast('CRA importé et enregistré', 'succes');
      }catch(e){ toast('Import interrompu : données incompatibles.', 'erreur'); }
    }, function(err){
      toast(err && err.code==='trop-lourd'?'Fichier trop volumineux pour un CRA.':'Lecture du fichier impossible.', 'erreur');
    });
  }
  var importFile=$('importFile');
  $('exportData').addEventListener('click', exporterJson);
  $('importBtn').addEventListener('click', function(){ importFile.click(); });
  importFile.addEventListener('change', function(){ var f=importFile.files && importFile.files[0]; importFile.value=''; if(f) importerJson(f); });

  /* ============================================================
     PROFILS D'IDENTITÉ (clé cra_profiles_v1)
        Un profil = instantané des champs paramétrables (fields,
        apparence, TJM, charges) — jamais days / sig / month / year.
        Validés AU CHARGEMENT (CraDonnees.validerProfils) ; relus et
        revalidés avant TOUTE écriture et sur l'événement storage (un
        autre onglet n'est jamais écrasé). Au-delà de 50 : aucun profil
        supprimé, seuls les ajouts sont refusés (avec avertissement).
  ============================================================ */
  var profils=[];
  var profListEl=$('profList'), profEmptyEl=$('profEmpty'), profNameEl=$('profName');
  var sauvegardeProfils=TAF.creerSauvegarde(PROFILES_KEY, function(){ return profils; });
  /* cra_profiles_v1 ILLISIBLE (JSON invalide ou pas un tableau) : aucune écriture des profils
     (rien n'est écrasé) ; brut gardé pour l'export. Levé si la clé redevient lisible (autre
     onglet) ou par « Réinitialiser les profils » (action explicite, confirmée). */
  var profilsIllisibles=false, brutProfils=null;
  function signalerProfilsIllisibles(){
    toast({ message:'Profils illisibles : rien ne sera écrasé. Exportez le brut, puis réinitialisez les profils.', type:'erreur', duree:30000,
      action:{ libelle:'Exporter le brut', fn:exporterBrutProfils } });
  }
  function exporterBrutProfils(){
    if(brutProfils==null) return;
    var ok=TAF.fichier.telecharger(brutProfils, 'CRA_profils_brut.txt', 'text/plain;charset=utf-8');
    toast(ok?'Profils bruts téléchargés':'Téléchargement impossible.', ok?'succes':'erreur');
  }
  function reinitialiserProfils(){
    if(!window.confirm('Supprimer définitivement les profils illisibles de cet appareil ? Exportez d’abord le brut pour les conserver.')) return;
    sauvegardeProfils.annuler();
    if(!TAF.stockage.supprimer(PROFILES_KEY)){ toast('Réinitialisation impossible (stockage local).', 'erreur'); return; }
    chargerProfils(false); rendreProfils();
    toast('Profils réinitialisés', 'info');
  }
  function chargerProfils(avertir){
    var texte=TAF.stockage.lireTexte(PROFILES_KEY), c=D.classerBrut(texte, Array.isArray);
    var etaitIllisible=profilsIllisibles;
    profilsIllisibles=(c.statut==='illisible'); brutProfils=profilsIllisibles?texte:null;
    if(profilsIllisibles!==etaitIllisible) majAvis();
    if(profilsIllisibles){ profils=[]; if(avertir) signalerProfilsIllisibles(); return; }
    var r=D.validerProfils(c.valeur==null?[]:c.valeur, CHAMPS);
    profils=r.profils;
    if(!avertir) return;
    if(r.ignores) toast({ message:r.ignores+(r.ignores>1?' profils illisibles ignorés':' profil illisible ignoré')+' : retiré'+(r.ignores>1?'s':'')+' à la prochaine modification des profils.', type:'erreur', duree:9000 });
    else if(profils.length>MAX.profils) toast({ message:profils.length+' profils enregistrés (maximum '+MAX.profils+') : tous sont conservés ; supprimez-en pour pouvoir en ajouter.', type:'info', duree:9000 });
  }
  function indexProfil(nom){
    var n=String(nom).toLowerCase();
    for(var i=0;i<profils.length;i++){ if(profils[i].name.toLowerCase()===n) return i; }
    return -1;
  }
  function enregistrerProfils(){ if(profilsIllisibles) return false; return sauvegardeProfils.maintenant(); }   // témoin propre à cette clé
  function instantaneProfil(){
    var p=TAF.prefs();
    return { fields:JSON.parse(JSON.stringify(state.fields)), accent:p.accent, mark:p.mark, logo:p.logo, motif:p.motif, tjm:state.tjm, charges:state.charges };
  }
  function appliquerProfil(p){
    if(!p) return;
    var d=D.validerDonneesProfil(p.data, CHAMPS), champs=d.fields;
    // Champs texte (hors calendrier / signatures) : fusion, sans toucher days / sig.
    Object.keys(champs).forEach(function(k){ state.fields[k]=champs[k]; });
    INPUTS_K.forEach(function(inp){ var k=inp.getAttribute('data-k'); if(aPropre.call(champs, k)) inp.value=champs[k]; });
    if(aPropre.call(champs, 'docTitle')) docTitleEl.value=champs.docTitle;
    if(aPropre.call(champs, 'comment')) commentEl.innerText=champs.comment;
    state.tjm=d.tjm; state.charges=d.charges; afficherNombres();
    var okPrefs=TAF.definirPrefs({ accent:d.accent, mark:d.mark, logo:d.logo, motif:d.motif });
    majNoTitle(); majNoComment(); recalculer(); rafraichirPrint(); saveSoon();
    if(okPrefs) toast('Profil « '+p.name+' » appliqué', 'succes');
    else toast('Profil « '+p.name+' » appliqué, mais l’apparence n’a pas pu être enregistrée (stockage plein)', 'erreur');
  }
  function rendreProfils(){
    TAF.vider(profListEl);
    if(profEmptyEl) profEmptyEl.hidden=profils.length>0;
    profils.forEach(function(p){
      var apply=el('button', { type:'button', class:'btn small', text:'Appliquer', 'aria-label':'Appliquer le profil '+p.name });
      apply.addEventListener('click', function(){ appliquerProfil(p); });
      var del=el('button', { type:'button', class:'btn small ghost danger', text:'Supprimer', 'aria-label':'Supprimer le profil '+p.name });
      del.addEventListener('click', function(){
        if(!window.confirm('Supprimer le profil « '+p.name+' » ?')) return;
        chargerProfils(false);                                         // version fraîche (autre onglet)
        if(profilsIllisibles){ rendreProfils(); signalerProfilsIllisibles(); return; }
        var i=indexProfil(p.name);
        if(i===-1){ rendreProfils(); profNameEl.focus(); toast('Ce profil avait déjà été supprimé (autre onglet)', 'info'); return; }
        profils.splice(i, 1); var ok=enregistrerProfils(); rendreProfils(); profNameEl.focus();
        toast(ok?'Profil supprimé':'Profil retiré, mais la suppression n’a pas pu être enregistrée', ok?'info':'erreur');
      });
      profListEl.appendChild(el('div', { class:'prof-item' }, [
        el('span', { class:'pi-name', title:p.name, text:p.name }),
        el('div', { class:'pi-actions' }, [ apply, del ])
      ]));
    });
  }
  function enregistrerProfilCourant(){
    var nom=TAF.texteBorne((profNameEl.value||'').trim(), MAX.nomProfil);
    if(!nom){ profNameEl.focus(); toast('Nommez le profil avant de l’enregistrer', 'info'); return; }
    chargerProfils(false);
    if(profilsIllisibles){ rendreProfils(); signalerProfilsIllisibles(); return; }
    if(indexProfil(nom)!==-1 && !window.confirm('Un profil « '+nom+' » existe déjà. Le remplacer ?')) return;
    chargerProfils(false);                                             // relu APRÈS la confirmation (bloquante)
    if(profilsIllisibles){ rendreProfils(); signalerProfilsIllisibles(); return; }
    var existant=indexProfil(nom);
    if(existant===-1 && profils.length>=MAX.profils){ rendreProfils(); toast('Nombre maximal de profils atteint ('+MAX.profils+') : supprimez-en un pour en ajouter', 'erreur'); return; }
    var entree={ name:nom, data:instantaneProfil() };
    if(existant!==-1) profils[existant]=entree; else profils.push(entree);
    var ok=enregistrerProfils(); rendreProfils(); profNameEl.value='';
    toast(ok?('Profil « '+nom+' » enregistré'):'Enregistrement du profil impossible (stockage local)', ok?'succes':'erreur');
  }
  /* ============================================================
     AVIS PERSISTANTS — données illisibles (CRA / profils), dérivés
        des drapeaux craIllisible / profilsIllisibles. Même logique
        d'UX que le statut « illisible » de Heures : rien n'est
        écrasé, export du brut, levée par action explicite. Hors PDF
        (no-print) ; styles existants réutilisés (aucun nouveau CSS).
  ============================================================ */
  var zoneAvis=null;
  function boutonAvis(libelle, classe, fn){ var b=el('button', { type:'button', class:classe, text:libelle }); b.addEventListener('click', fn); return b; }
  function majAvis(){
    var avis=[];
    if(craIllisible) avis.push({ titre:'Données du CRA illisibles — lecture seule',
      detail:'Elles ne sont ni modifiées ni écrasées : plus rien n’est enregistré sur cet appareil. Exportez le brut pour le conserver, puis effacez vos données ou importez une sauvegarde (.json).',
      actions:[ boutonAvis('Exporter le brut', 'btn small', exporterBrutCra),
        boutonAvis('Importer (.json)', 'btn small ghost', function(){ importFile.click(); }),
        boutonAvis('Effacer mes données…', 'btn small danger', function(){ $('clearData').click(); }) ] });
    if(profilsIllisibles) avis.push({ titre:'Profils d’identité illisibles',
      detail:'Rien ne sera écrasé : l’enregistrement des profils est suspendu. Exportez le brut pour le conserver, puis réinitialisez les profils.',
      actions:[ boutonAvis('Exporter le brut', 'btn small', exporterBrutProfils),
        boutonAvis('Réinitialiser les profils…', 'btn small danger', reinitialiserProfils) ] });
    if(!avis.length){ if(zoneAvis){ zoneAvis.remove(); zoneAvis=null; } return; }
    if(!zoneAvis){ zoneAvis=el('div', { class:'no-print' }); sheetEl.insertBefore(zoneAvis, sheetEl.firstChild); }
    TAF.vider(zoneAvis);
    avis.forEach(function(a){
      zoneAvis.appendChild(el('div', { class:'taf-noscript', role:'alert' }, [
        el('p', { class:'ih-confirm', text:a.titre }), el('p', { text:a.detail }), el('div', { class:'data-actions' }, a.actions)
      ]));
    });
  }

  $('profSave').addEventListener('click', enregistrerProfilCourant);
  profNameEl.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); enregistrerProfilCourant(); } });

  /* ============================================================
     SIGNATURES (dessin + import + glisser-déposer)
        Sources d'image validées (dataURL image uniquement) ; la
        signature persistée est l'export PNG du canvas (600×220).
  ============================================================ */
  function initSignPad(zone){
    var key=zone.getAttribute('data-key'), canvas=zone.querySelector('canvas'), ctx=canvas.getContext('2d');
    canvas.width=600; canvas.height=220; ctx.lineWidth=3.2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#1f2937';
    var dessine=false, last=null, generation=0;          // generation : une image chargée tard n'écrase pas plus récent
    function pos(e){ var r=canvas.getBoundingClientRect(); return { x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height) }; }
    function debut(e){ generation++; dessine=true; last=pos(e); e.preventDefault(); }
    function bouge(e){ if(!dessine) return; var p=pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last=p; zone.classList.add('has-ink'); e.preventDefault(); }
    function fin(){ if(!dessine) return; dessine=false; persister(); }
    canvas.addEventListener('pointerdown', debut); canvas.addEventListener('pointermove', bouge); window.addEventListener('pointerup', fin);
    function persister(silencieux){ try{ state.sig[key]=canvas.toDataURL('image/png'); if(silencieux===true) saveSilencieux(); else saveSoon(); }catch(e){} }
    function effacer(silencieux){ generation++; ctx.clearRect(0, 0, canvas.width, canvas.height); zone.classList.remove('has-ink'); state.sig[key]=null; if(silencieux!==true){ saveSoon(); annoncer('Signature effacée'); } }
    /* mode : 'import' (fichier choisi : persisté + annoncé) ; 'restaurer' (état lu : ré-rastérisé
       et persisté en silence si rasteriser ; indécodable → null en silence). */
    function dessinerImage(src, mode, rasteriser){
      if(!TAF.estImageDataUrl(src, Math.ceil(MAX.signatureOctets*1.4)+256)) return;
      var img=new Image(), g=++generation, restaure=(mode==='restaurer');
      function aJour(){ return g===generation && (!restaure || state.sig[key]===src); }
      img.onload=function(){
        if(!aJour()) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var s=Math.min(canvas.width/img.width, canvas.height/img.height), w=img.width*s, h=img.height*s;
        ctx.drawImage(img, (canvas.width-w)/2, (canvas.height-h)/2, w, h);
        zone.classList.add('has-ink');
        if(!restaure){ persister(); annoncer('Signature importée'); }
        else if(rasteriser) persister(true);                 // PNG 600×220 : quelques dizaines de Ko
      };
      img.onerror=function(){
        if(!restaure){ toast('Image de signature illisible.', 'erreur'); return; }
        if(!aJour()) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height); zone.classList.remove('has-ink');
        state.sig[key]=null; saveSilencieux();
      };
      img.src=src;
    }
    var RX_PNG=/^data:image\/png;base64,/;
    function restaurer(src){
      if(!src) return;
      dessinerImage(src, 'restaurer', !(RX_PNG.test(src) && src.length<=MAX.signaturePng));
    }
    function chargerFichier(f){
      TAF.fichier.lireImage(f, MAX.signatureOctets).then(function(url){ dessinerImage(url, 'import'); }, function(err){ toast((err && err.message)||'Lecture du fichier impossible.', 'erreur'); });
    }
    var card=zone.closest('.sign-card'), fichier=card.querySelector('.sig-file');
    card.querySelector('.sig-import').addEventListener('click', function(){ fichier.click(); });
    fichier.addEventListener('change', function(){ var f=fichier.files && fichier.files[0]; fichier.value=''; if(f) chargerFichier(f); });
    card.querySelector('.sig-clear').addEventListener('click', effacer);
    ['dragenter','dragover'].forEach(function(ev){ zone.addEventListener(ev, function(e){ e.preventDefault(); zone.classList.add('dragover'); }); });
    ['dragleave','drop'].forEach(function(ev){ zone.addEventListener(ev, function(e){ e.preventDefault(); zone.classList.remove('dragover'); }); });
    zone.addEventListener('drop', function(e){ var f=e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if(f) chargerFichier(f); });
    return { restore:restaurer, effacer:effacer };
  }
  var pads={};
  Array.prototype.forEach.call(document.querySelectorAll('.sign-zone'), function(z){ pads[z.getAttribute('data-key')]=initSignPad(z); });

  /* ============================================================
     CHAMPS PERSISTÉS (infos, rôles, noms, dates…)
  ============================================================ */
  INPUTS_K.forEach(function(inp){
    inp.addEventListener('input', function(){ state.fields[inp.getAttribute('data-k')]=TAF.texteBorne(inp.value, MAX.champ); saveSoon(); });
  });

  /* TJM / charges — l'état est TOUJOURS la valeur affichée (CraDonnees.nombreTexte) :
     signe « - » refusé à la frappe et au collage, dépassement ramené au plafond
     (charges ≤ 100 %), saisie illisible effacée en quittant le champ. */
  function afficherNombres(){
    tjmInput.value=state.tjm; chargesInput.value=state.charges;
    // Le navigateur a pu refuser la valeur : l'état suit ce qui est réellement affiché.
    if(tjmInput.value!==state.tjm) state.tjm=D.nombreTexte(tjmInput.value, MAX.tjm);
    if(chargesInput.value!==state.charges) state.charges=D.nombreTexte(chargesInput.value, MAX.charges);
    tjmInput.removeAttribute('aria-invalid'); chargesInput.removeAttribute('aria-invalid');
  }
  function brancherNombre(inp, cle, max, plafond){
    inp.addEventListener('beforeinput', function(e){ if(typeof e.data==='string' && /[-−+]/.test(e.data)) e.preventDefault(); });
    inp.addEventListener('input', function(){
      var brut=inp.value, v=D.nombreTexte(brut, max);
      if(brut!=='' && v!=='' && v!==brut && Number(brut)>max){ inp.value=v; annoncer(plafond); }
      var illisible=(inp.validity && inp.validity.badInput) || (brut!=='' && v==='');
      inp.setAttribute('aria-invalid', illisible?'true':'false');
      state[cle]=illisible?'':v; recalculer(); saveSoon();
    });
    inp.addEventListener('blur', function(){
      if((inp.validity && inp.validity.badInput) || inp.value!==state[cle]) inp.value=state[cle];
      inp.removeAttribute('aria-invalid');
    });
  }
  brancherNombre(tjmInput, 'tjm', MAX.tjm, 'TJM plafonné à '+fmtEur(MAX.tjm));
  brancherNombre(chargesInput, 'charges', MAX.charges, 'Charges plafonnées à 100 %');
  function syncTitreCal(){ var t=MOIS[moisAffiche()]+' '+anneeAffichee(); Array.prototype.forEach.call(document.querySelectorAll('.cal-title'), function(n){ n.textContent=t; }); }

  /* ============================================================
     AFFICHAGE PDF : dates jj/mm/aaaa + masquage des vides
  ============================================================ */
  editableTexte(commentEl);
  function majDates(){ Array.prototype.forEach.call(document.querySelectorAll('.m-date'), function(inp){ var span=inp.parentNode.querySelector('.date-print'); if(span) span.textContent=TAF.format.dateFr(inp.value); }); }
  function majNoTitle(){ document.body.classList.toggle('no-title', !docTitleEl.value.trim()); }
  function majNoComment(){ document.body.classList.toggle('no-comment', !(commentEl.innerText||'').trim()); }
  function rafraichirPrint(){ majNoTitle(); majNoComment(); majDates(); construireTableauPdf(); }
  docTitleEl.addEventListener('input', function(){ state.fields.docTitle=TAF.texteBorne(docTitleEl.value, MAX.champ); majNoTitle(); saveSoon(); });
  commentEl.addEventListener('input', function(){ state.fields.comment=TAF.texteBorne(commentEl.innerText, MAX.commentaire); majNoComment(); saveSoon(); });
  Array.prototype.forEach.call(document.querySelectorAll('.m-date'), function(inp){ inp.addEventListener('input', majDates); inp.addEventListener('change', majDates); });

  /* ============================================================
     EXPORT PDF : AUTO-FIT SUR UNE PAGE (mesure réelle)
        On bascule la feuille d'impression externe (#printRules,
        media="print") en media="all" et on mesure #sheet à la largeur
        utile A4 RÉELLE (posée en !important : cra-print.css impose
        « width:auto !important », qui l'emporterait sur un style en
        ligne ordinaire). Largeur et feuille sont TOUJOURS rétablies
        (removeProperty, en succès comme en échec), puis le zoom est
        posé en variable CSS (--print-zoom, CSSOM) lue par
        cra-print.css. Aucun <style> n'est créé (CSP style-src 'self').
  ============================================================ */
  function appliquerFit(){
    var s=sheetEl.style, ancien=printRules?printRules.media:'print';
    try{
      rafraichirPrint();
      s.removeProperty('--print-zoom');
      var mmToPx=96/25.4, marge=8, pageH=(297-2*marge)*mmToPx, pageW=(210-2*marge)*mmToPx, cible=pageH*0.96;
      if(printRules) printRules.media='all';
      s.setProperty('width', pageW+'px', 'important');
      s.setProperty('max-width', 'none', 'important');
      var h=sheetEl.getBoundingClientRect().height;
      var z=(h>cible)?Math.max(0.5, cible/h):1;
      if(z<1) s.setProperty('--print-zoom', z.toFixed(3));
    }catch(e){
      s.removeProperty('--print-zoom');
    }finally{
      s.removeProperty('width'); s.removeProperty('max-width');
      if(printRules) printRules.media=ancien||'print';
    }
  }
  function nettoyerFit(){ sheetEl.style.removeProperty('--print-zoom'); }
  window.addEventListener('beforeprint', appliquerFit);     // filet de sécurité (Ctrl+P, menu du navigateur)
  window.addEventListener('afterprint', nettoyerFit);
  // Certains WebView n'émettent pas beforeprint : nom du PDF et auto-fit posés AVANT window.print().
  function imprimer(){ vidanger(); TAF.preparerImpression(); appliquerFit(); window.print(); }

  /* ============================================================
     MOIS / ANNÉE + ARCHIVE MULTI-MOIS
        Changer de période archive le mois affiché (s'il a du
        contenu) puis charge le mois demandé depuis l'archive (bornée
        au nombre de jours du mois chargé).
  ============================================================ */
  function moisNonVide(){ return Object.keys(state.days).some(function(d){ var j=state.days[d]; return j.am||j.pm; }); }
  function archiverMoisCourant(){
    if(state.month==null || state.year==null) return;
    var k=D.cleArchive(state.year, state.month);
    if(moisNonVide()) state.archive[k]={ days:JSON.parse(JSON.stringify(state.days)) };
    else if(aPropre.call(state.archive, k)) delete state.archive[k];
  }
  function changerPeriode(){
    if(daySheet.classList.contains('open')) fermerFiche();
    invaliderAnnulationImport();
    archiverMoisCourant();
    var m=moisAffiche(), an=anneeAffichee(), k=D.cleArchive(an, m);
    var ar=aPropre.call(state.archive, k)?state.archive[k]:null;
    state.days=(ar && ar.days)?D.validerJours(ar.days, D.joursDansMois(an, m)):{};
    state.month=m; state.year=an;
    construireGrille(); construireTableauPdf(); syncTitreCal(); majBoutonHeures(); saveSoon();
    annoncer(MOIS[m]+' '+an+(ar && ar.days?' — mois restauré ('+fmt(totalJours())+' j)':' — nouveau mois'));
  }
  monthSel.addEventListener('change', changerPeriode);
  yearSel.addEventListener('change', changerPeriode);
  $('applyAct').addEventListener('click', appliquerActivite);
  $('checkAll').addEventListener('click', joursOuvres);
  $('clearAll').addEventListener('click', toutDecocher);
  $('printBtn').addEventListener('click', imprimer);
  defAct.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); appliquerActivite(); } });

  /* ============================================================
     PONT HEURES → CRA (docs/heures-spec.md §7.4 / §13.3)
        LECTURE SEULE de taf_heures_v1 : TAF.heures.lire (validée),
        resumeMois, planifierImport (+ CraDonnees.ajusterPlanImport).
        Le CRA n'écrit JAMAIS cette clé. Rien n'est appliqué sans un
        clic sur « Importer » — ni par le lien #heures-AAAA-MM.
        Application en une passe ; Annuler (10 s) restaure l'instantané
        de state.days gardé en mémoire le temps du toast (pas un
        second état : il disparaît avec lui).
  ============================================================ */
  var btnHeures=$('fromHours'), badgeHeures=$('fromHoursBadge');
  var ih={ dialog:$('ihDialog'), overlay:$('ihOverlay'), titre:$('ihTitre'), periode:$('ihPeriode'),
    mois:$('ihMois'), moisCra:$('ihMoisCra'), passer:$('ihPasser'), rester:$('ihRester'),
    vide:$('ihVide'), videTitre:$('ihVideTitre'), videTexte:$('ihVideTexte'),
    contenu:$('ihContenu'), synthese:$('ihSynthese'), regle:$('ihRegle'), activites:$('ihActivites'),
    liste:$('ihListe'), aJour:$('ihAJour'), nbChangements:$('ihNbChangements'),
    confirm:$('ihConfirm'), annuler:$('ihAnnuler'), importer:$('ihImporter') };
  var modesImport=ih.dialog?ih.dialog.querySelectorAll('input[name="ihMode"]'):[];
  var importCible=null, relacherImport=null, planCourant=null, confirmerRemplacement=false, vueImport='';
  var annulationImport=null;                          // poignée du toast « Annuler » de l'import

  function lireHeures(){
    var r=TAF.heures.lire(), st=(r && r.rapport)?r.rapport.statut:'vide';
    var ok=!!(r && r.donnees && (st==='ok' || st==='partiel'));
    return { ok:ok, donnees:ok?r.donnees:null, statut:st };
  }
  function resumeDe(h, annee, mois0){ return h.ok?TAF.heures.resumeMois(h.donnees, annee, mois0):{}; }
  function libMois(annee, mois0){ return MOIS[mois0].toLowerCase()+' '+annee; }
  function pluriel(n, un, plusieurs){ return n+' '+(n>1?plusieurs:un); }

  // Bouton « Depuis mes heures » + badge : visible seulement si le mois affiché a des heures.
  function majBoutonHeures(){
    if(!btnHeures) return;
    var n=Object.keys(resumeDe(lireHeures(), anneeAffichee(), moisAffiche())).length;
    btnHeures.hidden=!n;
    if(n){ badgeHeures.textContent=String(n); btnHeures.setAttribute('aria-label', 'Depuis mes heures, '+pluriel(n, 'jour détecté', 'jours détectés')); }
  }

  function importOuvert(){ return !!(ih.dialog && ih.dialog.classList.contains('open')); }
  function modeImport(){ for(var i=0;i<modesImport.length;i++){ if(modesImport[i].checked) return modesImport[i].value==='remplacer'?'remplacer':'completer'; } return 'completer'; }
  function moisCible(){ return importCible || { annee:anneeAffichee(), mois0:moisAffiche() }; }
  var pastilleJour=TAF.pastilleJour;                  // pastille tri-état : règle et rendu uniques (taf.js)
  function libEtatJour(j){ return (j.am&&j.pm)?'journée complète':(j.am?'matin':(j.pm?'après-midi':'vide')); }
  function chiffre(valeur, libelle){ return el('span', { class:'ih-chiffre' }, [ el('b', { text:valeur }), el('span', { text:libelle }) ]); }

  // Écart (en jours) qu'apporte un plan : somme des demi-journées ajoutées moins retirées.
  function ecartPlan(plan){
    var delta=0;
    plan.changements.forEach(function(ch){ delta+=((ch.apres.am?1:0)+(ch.apres.pm?1:0)-(ch.avant.am?1:0)-(ch.avant.pm?1:0))*0.5; });
    return delta;
  }
  function afficherVue(vue){
    vueImport=vue;
    ih.mois.hidden=(vue!=='mois'); ih.vide.hidden=(vue!=='vide'); ih.contenu.hidden=(vue!=='contenu');
    ih.importer.hidden=(vue!=='contenu');
  }
  function majPied(){
    var n=planCourant?planCourant.changements.length:0, conf=confirmerRemplacement && vueImport==='contenu';
    ih.confirm.hidden=!conf;
    if(conf) ih.confirm.textContent=pluriel(planCourant.synthese.decoches, 'demi-journée sera décochée', 'demi-journées seront décochées')+' : le mois suivra exactement vos heures.';
    ih.importer.classList.toggle('ih-danger', conf);
    ih.importer.disabled=(vueImport==='contenu' && !n);
    ih.importer.textContent=conf?'Confirmer le remplacement':(n?'Importer '+pluriel(n, 'jour', 'jours'):'Rien à importer');
    ih.annuler.textContent=conf?'Retour':(vueImport==='contenu'?'Annuler':'Fermer');
  }
  function rendreVide(titre, texte){
    afficherVue('vide'); planCourant=null;
    ih.videTitre.textContent=titre; ih.videTexte.textContent=texte;
  }
  function rendreImport(){
    if(!ih.dialog) return;
    var c=moisCible(), a=anneeAffichee(), m=moisAffiche();
    ih.periode.textContent=MOIS[c.mois0]+' '+c.annee+' · lecture seule du module Heures';
    var h=lireHeures();
    if(c.annee!==a || c.mois0!==m){
      // Le lien vise un autre mois que celui du CRA : on PROPOSE d'y passer (rien d'automatique).
      afficherVue('mois'); planCourant=null;
      ih.moisCra.textContent=libMois(a, m);
      ih.passer.textContent='Passer à '+libMois(c.annee, c.mois0);
      var nAffiche=Object.keys(resumeDe(h, a, m)).length;
      ih.rester.hidden=!nAffiche;
      if(nAffiche) ih.rester.textContent='Importer plutôt '+libMois(a, m);
      majPied(); return;
    }
    if(!h.ok){
      if(h.statut==='illisible') rendreVide('Données Heures illisibles', 'Ouvrez le module Heures pour les exporter ou les réinitialiser. Rien n’est modifié ici.');
      else if(h.statut==='futur') rendreVide('Heures enregistrées par une version plus récente', 'Ce CRA ne sait pas encore les lire. Rien n’est modifié ici.');
      else rendreVide('Aucune heure pour '+libMois(c.annee, c.mois0), 'Pointez ou saisissez vos heures dans le module Heures, puis revenez importer le mois.');
      majPied(); return;
    }
    var resume=resumeDe(h, c.annee, c.mois0);
    if(!Object.keys(resume).length){ rendreVide('Aucune heure pour '+libMois(c.annee, c.mois0), 'Pointez ou saisissez vos heures dans le module Heures, puis revenez importer le mois.'); majPied(); return; }

    afficherVue('contenu');
    var mode=modeImport(), plan=D.ajusterPlanImport(TAF.heures.planifierImport(state.days, resume, mode, ih.activites.checked));
    planCourant=plan;
    var s=plan.synthese, delta=ecartPlan(plan);
    var totalAvant=totalJours(), totalApres=totalAvant+delta;

    // Synthèse : « 17 jours détectés → 16,5 j » + total du mois avant / après.
    TAF.vider(ih.synthese);
    ih.synthese.appendChild(chiffre(String(s.joursDetectes), s.joursDetectes>1?'jours détectés':'jour détecté'));
    ih.synthese.appendChild(el('span', { class:'ih-fleche', 'aria-hidden':'true', text:'→' }));
    ih.synthese.appendChild(chiffre(fmt(s.joursProposes)+' j', 'd’après vos heures'));
    // Jours avec heures mais sans changement : déjà à jour, ou sous le seuil d'une demi-journée.
    var modifies={}, aJour=0, sousSeuil=0;
    plan.changements.forEach(function(ch){ modifies[ch.jour]=true; });
    Object.keys(resume).forEach(function(k){ if(modifies[k]) return; if(resume[k].am || resume[k].pm) aJour++; else sousSeuil++; });
    var notes=['Total du mois : '+fmt(totalAvant)+' j → '+fmt(totalApres)+' j'];
    if(aJour) notes.push(pluriel(aJour, 'jour déjà coché inchangé', 'jours déjà cochés inchangés'));
    if(sousSeuil) notes.push(pluriel(sousSeuil, 'jour sous le seuil', 'jours sous le seuil'));
    if(mode==='remplacer' && s.decoches) notes.push(pluriel(s.decoches, 'demi-journée décochée', 'demi-journées décochées'));
    ih.synthese.appendChild(el('span', { class:'ih-synthese-note', text:notes.join(' · ') }));

    // Rappel de la règle (réglages Heures validés) : « Demi-journée dès 1 h 45 avant / après 13:00 ».
    var r=TAF.heures.validerReglages(h.donnees.reglages, h.donnees.projets);
    TAF.vider(ih.regle);
    ih.regle.appendChild(document.createTextNode('Demi-journée dès '));
    ih.regle.appendChild(el('b', { text:TAF.format.duree(TAF.heures.seuilDemi(r)) }));
    ih.regle.appendChild(document.createTextNode(' avant / après '));
    ih.regle.appendChild(el('b', { text:r.coupure }));

    // Aperçu avant → après (pastilles tri-état du CRA, durée source, activité en textContent).
    var frag=document.createDocumentFragment(), an=c.annee, mo=c.mois0;
    plan.changements.forEach(function(ch){
      var rj=aPropre.call(resume, ch.jour)?resume[ch.jour]:null, wd=new Date(an, mo, ch.jour).getDay();
      var act=(ch.apres.act!==ch.avant.act)?ch.apres.act:'';
      var sr=libelleJour(ch.jour)+' : '+libEtatJour(ch.avant)+' → '+libEtatJour(ch.apres)+', '+(rj?TAF.format.dureeLongue(rj.min)+' travaillées':'aucune heure')+(act?', activité : '+act:'');
      frag.appendChild(el('li', { class:'ih-ligne' }, [
        el('span', { class:'ih-date', 'aria-hidden':'true' }, [ el('span', { class:'dn', text:JOURS_COURTS[wd] }), el('span', { class:'dd', text:String(ch.jour) }) ]),
        el('span', { class:'ih-etats', 'aria-hidden':'true' }, [ pastilleJour(ch.avant), el('span', { class:'ih-fl', text:'→' }), pastilleJour(ch.apres) ]),
        el('span', { class:'ih-duree'+(rj?'':' aucune'), 'aria-hidden':'true', text:rj?TAF.format.duree(rj.min):'aucune heure' }),
        act?el('span', { class:'ih-act', 'aria-hidden':'true' }, [ el('b', { text:'Activité' }), ' ', act ]):null,
        el('span', { class:'sr-only', text:sr })
      ]));
    });
    TAF.vider(ih.liste); ih.liste.appendChild(frag);
    ih.liste.hidden=!plan.changements.length; ih.aJour.hidden=!!plan.changements.length;
    ih.nbChangements.textContent=plan.changements.length?pluriel(plan.changements.length, 'changement', 'changements'):'';
    if(!(mode==='remplacer' && s.decoches)) confirmerRemplacement=false;
    majPied();
  }

  function ouvrirImportHeures(annee, mois0){
    if(!ih.dialog) return;
    if(!calPanel.classList.contains('open')) ouvrirCal();
    if(daySheet.classList.contains('open')) fermerFiche();
    importCible=(Number.isInteger(annee) && Number.isInteger(mois0))?{ annee:annee, mois0:mois0 }:null;
    confirmerRemplacement=false;
    if(!importOuvert()){ modesImport.forEach(function(r){ r.checked=(r.value==='completer'); }); ih.activites.checked=true; }
    rendreImport();
    if(importOuvert()){ ih.titre.focus(); return; }
    ih.dialog.classList.add('open'); ih.overlay.classList.add('open'); ih.dialog.setAttribute('aria-hidden','false');
    calPanel.setAttribute('inert', '');                // arrière-plan inerte sous le dialogue
    relacherImport=TAF.gererModale(ih.dialog, btnHeures.hidden?calTitre:btnHeures, ih.titre, fermerImport);
  }
  function fermerImport(rendreFocus){
    if(!importOuvert()) return;
    ih.dialog.classList.remove('open'); ih.overlay.classList.remove('open'); ih.dialog.setAttribute('aria-hidden','true');
    calPanel.removeAttribute('inert');
    importCible=null; planCourant=null; confirmerRemplacement=false;
    var rel=relacherImport; relacherImport=null;
    if(!rel) return;
    if(rendreFocus===false){ rel(false); return; }
    if(btnHeures.hidden){ rel(false); try{ calTitre.focus(); }catch(e){} }   // bouton masqué entre-temps
    else rel();
  }
  function invaliderAnnulationImport(){ if(annulationImport){ annulationImport.fermer(true); annulationImport=null; } }
  function appliquerImportHeures(plan){
    if(!plan || !plan.changements.length) return;
    var instantane=JSON.stringify(state.days), periode={ m:state.month, a:state.year }, nb=nbJoursAffiches();
    var totalAvant=totalJours();
    plan.changements.forEach(function(ch){
      var k=String(ch.jour);
      if(!TAF.valide.jour(k) || ch.jour>nb) return;
      var j=assurerJour(k);
      j.am=ch.apres.am===true; j.pm=ch.apres.pm===true; j.act=TAF.texteBorne(ch.apres.act, MAX.activite);
      nettoyerJour(k); majCellule(k);
    });
    recalculer(); construireTableauPdf(); saveSoon();          // une seule passe
    var empreinte=JSON.stringify(state.days);                  // calendrier juste après l'import (garde d'Annuler)
    var total=totalJours(), ecart=total-totalAvant;            // écart RÉEL appliqué (jours hors mois écartés)
    var libEcart=(ecart>0?'+':(ecart<0?'−':'±'))+fmt(Math.abs(ecart))+' j · total '+fmt(total)+' j';
    fermerImport();                                             // la pop-up redevient la surface du dessus → #calLiveRegion
    invaliderAnnulationImport();
    var poignee=toast({ message:'Calendrier mis à jour depuis Heures — '+libEcart, type:'succes', duree:10000,
      action:{ libelle:'Annuler', fn:function(){ annulerImportHeures(instantane, periode, empreinte); } } });
    annulationImport=poignee;
  }
  function annulerImportHeures(instantane, periode, empreinte){
    annulationImport=null;
    if(state.month!==periode.m || state.year!==periode.a){ toast('Annulation impossible : le mois affiché a changé', 'erreur'); return; }
    if(JSON.stringify(state.days)!==empreinte){ toast('Annulation impossible : le calendrier a été modifié depuis', 'erreur'); return; }
    var brut=null; try{ brut=JSON.parse(instantane); }catch(e){ return; }
    state.days=D.validerJours(brut, nbJoursAffiches());
    construireGrille(); construireTableauPdf(); saveSoon();
    toast('Import annulé — calendrier restauré', 'info');
  }

  if(ih.dialog){
    btnHeures.addEventListener('click', function(){ ouvrirImportHeures(); });
    $('ihFermer').addEventListener('click', function(){ fermerImport(); });
    ih.overlay.addEventListener('click', function(){ fermerImport(); });
    modesImport.forEach(function(r){ r.addEventListener('change', function(){ confirmerRemplacement=false; rendreImport(); }); });
    ih.activites.addEventListener('change', function(){ confirmerRemplacement=false; rendreImport(); });
    ih.passer.addEventListener('click', function(){
      var c=importCible; if(!c) return;
      assurerAnnee(c.annee); monthSel.value=String(c.mois0); yearSel.value=String(c.annee);
      changerPeriode();                                         // archive le mois courant, comme d'habitude
      importCible=null; rendreImport(); ih.titre.focus();
    });
    ih.rester.addEventListener('click', function(){ importCible=null; rendreImport(); ih.titre.focus(); annoncer('Import de '+libMois(anneeAffichee(), moisAffiche())); });
    ih.annuler.addEventListener('click', function(){
      if(confirmerRemplacement){ confirmerRemplacement=false; majPied(); annoncer('Remplacement annulé'); return; }
      fermerImport();
    });
    ih.importer.addEventListener('click', function(){
      var plan=planCourant; if(!plan || !plan.changements.length) return;
      if(modeImport()==='remplacer' && plan.synthese.decoches>0 && !confirmerRemplacement){
        confirmerRemplacement=true; majPied(); annoncer(ih.confirm.textContent+' Confirmez le remplacement.'); return;   // confirmation intégrée (2 étapes)
      }
      appliquerImportHeures(plan);
    });
  }

  // Lien #heures-AAAA-MM (regex stricte partagée) : ouvre la pop-up puis le dialogue, sans
  // RIEN appliquer ; le fragment est retiré de l'URL. Toute autre valeur est ignorée.
  function lireHashHeures(){
    var p=TAF.heures.lireHashCra(location.hash);
    if(!p) return;
    try{ history.replaceState(null, '', location.pathname+location.search); }catch(e){}
    if(p.annee<D.ANNEES.min || p.annee>D.ANNEES.max) return;
    ouvrirImportHeures(p.annee, p.mois0);
  }
  window.addEventListener('hashchange', lireHashHeures);

  /* ============================================================
     MULTI-ONGLETS — événement storage (émis par les AUTRES onglets)
        cra_app_v3      : réécrit ailleurs → cette page n'écrit plus
                          (rien n'est écrasé) et propose de recharger ;
        cra_profiles_v1 : relu, validé, re-rendu ;
        taf_heures_v1   : bouton / dialogue « Depuis mes heures ».
  ============================================================ */
  function texteEtat(){ try{ return JSON.stringify(etatAPersister()); }catch(e){ return null; } }
  window.addEventListener('storage', function(e){
    try{ if(e.storageArea && e.storageArea!==window.localStorage) return; }catch(_){ return; }
    var k=e.key;
    if(k===null || k===PROFILES_KEY){ chargerProfils(false); rendreProfils(); }
    if((k===null || k===STORE_KEY) && (k===null || e.newValue!==texteEtat())) marquerPerime();
    if(k===null || k===TAF.heures.CLE){ majBoutonHeures(); if(importOuvert()) rendreImport(); }
  });
  // Retour depuis le cache de navigation (bfcache) : aucun événement storage n'a été reçu.
  window.addEventListener('pageshow', function(e){
    if(!e.persisted) return;
    var t=TAF.stockage.lireTexte(STORE_KEY);
    if(t!=null && t!==(craIllisible?brutCra:texteEtat())) marquerPerime();
    chargerProfils(false); rendreProfils();
    majBoutonHeures(); if(importOuvert()) rendreImport();
  });

  /* ============================================================
     RÉ-HYDRATATION — chemin unique (restauration locale / import)
        Reçoit un état DÉJÀ validé (validerEtat). Un champ absent
        reprend sa valeur par défaut du balisage (ex. rôles des
        signataires) au lieu d'être vidé.
  ============================================================ */
  function appliquerEtat(v){
    state.fields=v.fields; state.provisoire=v.provisoire; state.tjm=v.tjm; state.charges=v.charges;
    state.sig=v.sig; state.days=v.days; state.presets=v.presets; state.archive=v.archive;
    state.month=v.month; state.year=v.year;
    assurerAnnee(state.year);
    Object.keys(state.archive).forEach(function(k){ var p=D.lireCleArchive(k); if(p) assurerAnnee(p.annee); });
    monthSel.value=String(state.month); yearSel.value=String(state.year);
    INPUTS_K.forEach(function(inp){ var k=inp.getAttribute('data-k'); inp.value=aPropre.call(state.fields, k)?state.fields[k]:inp.defaultValue; });
    afficherNombres();
    docTitleEl.value=state.fields.docTitle||'';
    commentEl.innerText=state.fields.comment||'';
    appliquerProvisoire(state.provisoire);
    // Signatures : canvas propres puis restauration (sources capturées AVANT d'effacer).
    var sigL=state.sig.left, sigR=state.sig.right;
    pads.left.effacer(true); pads.right.effacer(true);
    if(sigL) pads.left.restore(sigL);
    if(sigR) pads.right.restore(sigR);
    state.sig.left=sigL; state.sig.right=sigR;
    rendrePresets();
  }
  function rafraichirTout(){ construireGrille(); recalculer(); rafraichirPrint(); syncTitreCal(); majBoutonHeures(); }

  /* ============================================================
     DÉMARRAGE
  ============================================================ */
  construireSemaine();
  // Texte BRUT d'abord (lisible même si le quota est plein) : absent → CRA neuf ; illisible →
  // lecture seule (rien n'est écrasé), brut gardé pour l'export, avis persistant + témoin.
  var texteCra=TAF.stockage.lireTexte(STORE_KEY), lectureCra=D.classerBrut(texteCra, D.etatStockePlausible);
  if(lectureCra.statut==='illisible'){ craIllisible=true; brutCra=texteCra; TAF.temoin.etat('echec', STORE_KEY); }
  appliquerEtat(validerEtat(lectureCra.valeur));
  rafraichirTout();
  chargerProfils(!craIllisible); rendreProfils();
  majAvis();
  if(craIllisible) signalerCraIllisible(true);
  texteCra=null;
  demarre=true;
  lireHashHeures();
})();
