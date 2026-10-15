/* ============================================================================
   TAF — TESTS DU NOYAU (tests/tests.js)
   Fonctions pures du noyau partagé : validateurs, DOM sûr, stockage simulé,
   migration de l'apparence, témoin, sauvegarde, toasts, modales, images,
   impression. Correctifs couverts : F1 (focus visible), F2 (migration sûre),
   F3 (témoin multi-écrivains), F4 (aucune RegExp exposée), F5 (URL en liste
   blanche), F6 (lecture ≠ écriture), F7 (sauvegarde partagée), F8 (logo),
   F10 (pas de liste de modules dupliquée), F11 (en-têtes de semaine), F12
   (impression). Stockage TOUJOURS simulé (TAF.creerMemoire).
============================================================================ */
(function(){
  "use strict";
  var TAF=window.TAF, T=window.TafTests;
  if(!TAF || !T) return;
  var test=T.test, egal=T.egal, vrai=T.vrai, leve=T.leve, attendre=T.attendre, espaces=T.espaces;

  var PNG='data:image/png;base64,iVBORw0KGgo=';
  var ANCIEN_CRA={ fields:{ societe:'ACME' }, accent:'#2563EB', mark:'bolt', logo:null, motif:false, provisoire:false, tjm:'500', charges:'', sig:{ left:null, right:null }, month:9, year:2026, days:{ '1':{ am:true, pm:true, act:'Dev' } }, presets:[], archive:{} };
  var QUOTA_CHROME=5242880;                      // ≈ quota localStorage de Chromium (caractères, clés comprises)
  function bac(){ var b=document.getElementById('bac-a-sable'); b.hidden=false; return b; }
  function rangerBac(){ var b=document.getElementById('bac-a-sable'); b.textContent=''; b.hidden=true; }
  function touche(cible, key, opts){ var e=new KeyboardEvent('keydown', Object.assign({ key:key, bubbles:true, cancelable:true }, opts||{})); (cible||document).dispatchEvent(e); return e; }

  /* ---------- Socle ---------- */
  test('TAF est exposé, gelé en profondeur et non réassignable', function(){
    vrai(TAF && Object.isFrozen(TAF), 'TAF gelé');
    try{ window.TAF={}; }catch(e){}
    vrai(window.TAF===TAF, 'window.TAF inchangé');
    egal(TAF.TITRE, 'TAF');
    egal(TAF.CLES, { prefs:'taf_prefs_v1', cra:'cra_app_v3', profils:'cra_profiles_v1', heures:'taf_heures_v1' });
    egal(TAF.MARQUES, ['hex','drop','doc','spark','bolt','leaf']);
    egal(TAF.SWATCHES.length, 8);
    ['valide','stockage','format','dates','csv','heures','fichier','image','temoin','nav'].forEach(function(k){ vrai(Object.isFrozen(TAF[k]), k+' gelé'); });
    vrai(Object.isFrozen(TAF.heures.LIMITES) && Object.isFrozen(TAF.image.LOGO), 'constantes gelées');
  });
  test('F10 — aucune seconde liste de modules : la navigation statique du HTML fait foi', function(){
    egal(TAF.MODULES, undefined);
    egal(typeof TAF.nav.init, 'function');
  });
  test('F4 — aucune RegExp n’est atteignable depuis TAF (validation par fonctions)', function(){
    var vus=[], trouvees=[];
    (function parcourir(o, chemin){
      if(!o || (typeof o!=='object' && typeof o!=='function') || vus.indexOf(o)!==-1) return;
      vus.push(o);
      if(o instanceof RegExp){ trouvees.push(chemin); return; }
      Object.keys(o).forEach(function(k){ parcourir(o[k], chemin+'.'+k); });
    })(TAF, 'TAF');
    egal(trouvees, []);
    egal(TAF.RE, undefined, 'TAF.RE retiré');
  });
  test('Page de tests : aucune initialisation de page (pas de data-module)', function(){
    egal(TAF.moduleActif(), '');
    egal(TAF.prefs(), { accent:'#E2A400', mark:'hex', logo:null, motif:true });
  });

  /* ---------- Validateurs ---------- */
  test('valide.jour / mois / heure / hex (fonctions, non mutables)', function(){
    var v=TAF.valide;
    egal([ '1','9','10','31', 7 ].map(v.jour), [ true, true, true, true, true ]);
    egal([ '0','32','01','1a',' 1','__proto__', null, {} ].map(v.jour), [ false, false, false, false, false, false, false, false ]);
    egal([ v.mois('2026-10'), v.mois('2026-13'), v.mois('26-10'), v.mois(202610) ], [ true, false, false, false ]);
    egal([ v.heure('23:59'), v.heure('24:00'), v.heure('7:30'), v.heure('00:00') ], [ true, false, false, true ]);
    egal([ v.hex('#abc'), v.hex('#2563EB'), v.hex('red'), v.hex('#12345') ], [ true, true, false, false ]);
    vrai(Object.isFrozen(v), 'espace gelé');
  });
  test('objetSimple', function(){
    egal([ {}, [], null, 'x', 3, undefined ].map(TAF.objetSimple), [ true, false, false, false, false, false ]);
  });
  test('cleSure refuse les clés de pollution de prototype', function(){
    egal([ 'societe', '__proto__', 'constructor', 'prototype', '', 5 ].map(TAF.cleSure), [ true, false, false, false, false, false ]);
  });
  test('texteBorne', function(){
    egal(TAF.texteBorne('abcdef', 3), 'abc');
    egal(TAF.texteBorne('abc'), 'abc');
    egal(TAF.texteBorne(42, 10), '');
    egal(TAF.texteBorne(null, 10), '');
  });
  test('accentValide : seuls #rgb / #rrggbb passent', function(){
    egal(TAF.accentValide('#2563EB'), '#2563EB');
    egal(TAF.accentValide('#abc'), '#abc');
    [ 'red', '#12345', '#2563EB;background:url(x)', 'url(javascript:x)', null, 12, {} ].forEach(function(v){ egal(TAF.accentValide(v), '#E2A400', String(v)); });
  });
  test('markValide : uniquement les icônes connues (pas les clés héritées)', function(){
    egal(TAF.markValide('bolt'), 'bolt');
    [ 'toString', '__proto__', 'constructor', '<svg onload=x>', 5, null ].forEach(function(v){ egal(TAF.markValide(v), 'hex', String(v)); });
  });
  test('estImageDataUrl : images uniquement, longueur bornée', function(){
    vrai(TAF.estImageDataUrl(PNG), 'png');
    vrai(TAF.estImageDataUrl('data:image/svg+xml;base64,PHN2Zy8+'), 'svg');
    vrai(TAF.estImageDataUrl('data:image/jpeg;base64,AAAA'), 'jpeg');
    vrai(!TAF.estImageDataUrl('data:text/html;base64,PHNjcmlwdD4='), 'html refusé');
    vrai(!TAF.estImageDataUrl('javascript:alert(1)'), 'javascript refusé');
    vrai(!TAF.estImageDataUrl('data:image/png,sans-base64'), 'sans ; refusé');
    vrai(!TAF.estImageDataUrl({}), 'objet refusé');
    vrai(!TAF.estImageDataUrl(PNG, 10), 'trop long refusé');
  });
  test('sigValide', function(){
    egal(TAF.sigValide({ left:PNG, right:'<img src=x onerror=alert(1)>' }), { left:PNG, right:null });
    egal(TAF.sigValide(null), { left:null, right:null });
    egal(TAF.sigValide([PNG]), { left:null, right:null });
    var geante='data:image/png;base64,'+new Array(1e6).join('A');   // > 1 M car. : altérée ou hostile
    egal(TAF.sigValide({ left:geante, right:PNG }), { left:null, right:PNG }, 'plafond explicite par signature');
  });
  test('validerPrefs : défauts et neutralisation des valeurs hostiles', function(){
    egal(TAF.validerPrefs(null), { accent:'#E2A400', mark:'hex', logo:null, motif:true });
    egal(TAF.validerPrefs({ accent:'#2563EB', mark:'bolt', logo:PNG, motif:false }), { accent:'#2563EB', mark:'bolt', logo:PNG, motif:false });
    egal(TAF.validerPrefs({ accent:'url(x)', mark:'<svg>', logo:'data:text/html,<b>', motif:'non' }), { accent:'#E2A400', mark:'hex', logo:null, motif:true });
  });

  /* ---------- Stockage (F6 : lecture et écriture séparées) ---------- */
  test('creerStockage : lecture / écriture / suppression sûres', function(){
    var mem=TAF.creerMemoire(), st=TAF.creerStockage(mem);
    vrai(st.disponible() && st.lisible());
    egal(st.lire('x', 'défaut'), 'défaut');
    vrai(st.ecrire('x', { a:1 }));
    egal(st.lire('x', null), { a:1 });
    egal(st.lireTexte('x'), '{"a":1}');
    vrai(st.ecrireTexte('t', 'brut')); egal(st.lireTexte('t'), 'brut');
    egal(st.ecrireTexte('t', 42), false, 'texte uniquement');
    mem.setItem('y', 'non-json');
    egal(st.lire('y', 7), 7);
    vrai(st.supprimer('x')); egal(st.lire('x', null), null); egal(st.lireTexte('x'), null);
    var aucun=TAF.creerStockage(null);
    egal([ aucun.lisible(), aucun.disponible(), aucun.lire('x', 1), aucun.lireTexte('x'), aucun.ecrire('x', 1), aucun.supprimer('x') ], [ false, false, 1, null, false, false ]);
    var lanceur=TAF.creerStockage(function(){ throw new Error('accès refusé'); });
    egal([ lanceur.lisible(), lanceur.disponible(), lanceur.lire('x', 2) ], [ false, false, 2 ]);
  });
  test('F6 — quota plein : la sonde d’écriture échoue mais les données restent LISIBLES', function(){
    var donnees={ cra_app_v3:JSON.stringify(ANCIEN_CRA) };
    var plein={
      getItem:function(k){ return Object.prototype.hasOwnProperty.call(donnees, k)?donnees[k]:null; },
      setItem:function(){ var e=new Error('quota'); e.name='QuotaExceededError'; throw e; },
      removeItem:function(k){ delete donnees[k]; }
    };
    var st=TAF.creerStockage(plein);
    egal([ st.lisible(), st.disponible() ], [ true, false ]);
    egal(st.lire('cra_app_v3', null).fields, { societe:'ACME' }, 'lecture intacte');
    egal(st.ecrire('cra_app_v3', {}), false, 'écriture refusée proprement');
    egal(st.lire('cra_app_v3', null).days['1'].act, 'Dev', 'rien n’est perdu');
  });
  test('creerMemoire : quota TOTAL simulé (clés + valeurs), comme localStorage', function(){
    var mem=TAF.creerMemoire(); mem.limiter(20);
    mem.setItem('a', '123456789');                // 10
    leve(function(){ mem.setItem('b', '1234567890'); }, 'dépasse le total');
    mem.setItem('a', '12345');                    // remplacement : 6
    mem.setItem('b', '12345678');                 // 6 + 9 = 15
    egal(mem.cles().sort(), [ 'a', 'b' ]);
  });

  /* ---------- Sauvegarde partagée (F7) ---------- */
  test('F7 — creerSauvegarde : différé, immédiat, vidage, annulation', function(){
    var mem=TAF.creerMemoire(), st=TAF.creerStockage(mem), etat={ n:1 }, retours=[];
    var s=TAF.creerSauvegarde('cle_test', function(){ return etat; }, { stockage:st, delai:20, ecrivain:'test-f7', apres:function(ok, raison){ retours.push([ok, raison]); } });
    egal(s.vider(), null, 'rien en attente');
    s.bientot(); vrai(s.enAttente()); egal(mem.getItem('cle_test'), null, 'pas encore écrit');
    return attendre(60).then(function(){
      egal(mem.getItem('cle_test'), '{"n":1}', 'écrit après le délai');
      etat.n=2; s.bientot(); egal(s.vider(), true, 'vidage immédiat'); egal(mem.getItem('cle_test'), '{"n":2}');
      etat.n=3; s.bientot(); s.annuler(); vrai(!s.enAttente());
      return attendre(40);
    }).then(function(){
      egal(mem.getItem('cle_test'), '{"n":2}', 'annulé : rien écrit');
      etat.n=4; egal(s.maintenant(), true); egal(mem.getItem('cle_test'), '{"n":4}');
      egal(retours, [ [true,''], [true,''], [true,''] ]);
      TAF.temoin.etat('', 'test-f7');
    });
  });
  test('F7 — creerSauvegarde : quota, limite de taille, stockage indisponible', function(){
    var mem=TAF.creerMemoire(); mem.limiter(30);
    var raisons=[], st=TAF.creerStockage(mem);
    var gros=TAF.creerSauvegarde('k', function(){ return 'x'.repeat(50); }, { stockage:st, ecrivain:'test-f7b', apres:function(ok, r){ raisons.push(r); } });
    egal(gros.maintenant(), false);
    egal(TAF.temoin.etats()['test-f7b'], 'echec', 'témoin en échec pour cet écrivain');
    var limite=TAF.creerSauvegarde('k', function(){ return 'x'.repeat(50); }, { stockage:TAF.creerStockage(TAF.creerMemoire()), ecrivain:'test-f7c', maxCaracteres:20, apres:function(ok, r){ raisons.push(r); } });
    egal(limite.maintenant(), false);
    var absent=TAF.creerSauvegarde('k', function(){ return 1; }, { stockage:TAF.creerStockage(null), ecrivain:'test-f7d', apres:function(ok, r){ raisons.push(r); } });
    egal(absent.maintenant(), false);
    egal(TAF.temoin.etats()['test-f7d'], 'indisponible');
    egal(raisons, [ 'quota', 'limite', 'indisponible' ]);
    [ 'test-f7b','test-f7c','test-f7d' ].forEach(function(e){ TAF.temoin.etat('', e); });
  });

  /* ---------- Témoin (F3 : échec collant par écrivain) ---------- */
  test('F3 — temoin.synthese : priorité indisponible > échec > en cours > ok', function(){
    var s=TAF.temoin.synthese;
    egal([ s({}), s({ a:'ok' }), s({ a:'ok', b:'cours' }), s({ a:'ok', b:'echec' }), s({ a:'echec', b:'indisponible' }), s(null) ], [ '', 'ok', 'cours', 'echec', 'indisponible', '' ]);
  });
  test('F3 — l’ok d’une clé n’efface pas l’échec non résolu d’une autre', function(){
    var t=TAF.temoin;
    t.etat('echec', 'f3-prefs');
    t.etat('ok', 'f3-cra');
    egal(t.synthese(t.etats()), 'echec', 'échec des prefs conservé');
    t.etat('cours', 'f3-prefs');
    egal(t.etats()['f3-prefs'], 'echec', '« en cours » ne masque pas un échec');
    t.etat('ok', 'f3-prefs');
    egal(t.synthese(t.etats()), 'ok', 'résolu par un succès du même écrivain');
    t.etat('indispo', 'f3-x'); egal(t.etats()['f3-x'], 'indisponible', 'alias indispo');
    [ 'f3-prefs','f3-cra','f3-x' ].forEach(function(e){ t.etat('', e); });
    egal(t.etats()['f3-cra'], undefined, 'effacé');
  });

  /* ---------- Migration de l'apparence (F2) ---------- */
  test('extrairePrefsCra : ancien format cra_app_v3', function(){
    egal(TAF.extrairePrefsCra(null), null);
    egal(TAF.extrairePrefsCra({ days:{} }), null, 'aucun champ d’apparence');
    egal(TAF.extrairePrefsCra(ANCIEN_CRA), { accent:'#2563EB', mark:'bolt', logo:null, motif:false });
  });
  test('migrerPrefs : prefs existantes prioritaires (aucune réécriture)', function(){
    var r=TAF.migrerPrefs({ accent:'#15A66B', mark:'leaf', logo:null, motif:true }, ANCIEN_CRA);
    egal(r, { prefs:{ accent:'#15A66B', mark:'leaf', logo:null, motif:true }, source:'prefs', ecrire:false });
  });
  test('migrerPrefs : migration depuis l’ancien CRA / défauts', function(){
    egal(TAF.migrerPrefs(null, ANCIEN_CRA), { prefs:{ accent:'#2563EB', mark:'bolt', logo:null, motif:false }, source:'cra', ecrire:true });
    egal(TAF.migrerPrefs('corrompu', ANCIEN_CRA).source, 'cra', 'prefs non-objet ignorées');
    egal(TAF.migrerPrefs([], ANCIEN_CRA).source, 'cra', 'prefs tableau ignorées');
    egal(TAF.migrerPrefs(null, null), { prefs:{ accent:'#E2A400', mark:'hex', logo:null, motif:true }, source:'defaut', ecrire:true });
  });
  test('migrerDepuisStockage : migration unique et idempotente (stockage mémoire)', function(){
    var mem=TAF.creerMemoire(), st=TAF.creerStockage(mem);
    var craTexte=JSON.stringify(ANCIEN_CRA);
    mem.setItem('cra_app_v3', craTexte);
    var ecrituresAvant=mem.ecritures;
    var r1=TAF.migrerDepuisStockage(st);
    egal([ r1.source, r1.ecrit, r1.enAttente ], [ 'cra', true, false ]);
    egal(JSON.parse(mem.getItem('taf_prefs_v1')), { accent:'#2563EB', mark:'bolt', logo:null, motif:false });
    egal(mem.ecritures, ecrituresAvant+1, 'une seule écriture');
    egal(mem.getItem('cra_app_v3'), craTexte, 'l’ancienne clé du CRA n’est jamais modifiée');
    var r2=TAF.migrerDepuisStockage(st);
    egal([ r2.source, r2.ecrit, r2.enAttente ], [ 'prefs', false, false ]);
    egal(mem.ecritures, ecrituresAvant+1, 'aucune réécriture au second passage');
  });
  test('migrerDepuisStockage : JSON corrompu, quota plein, stockage absent', function(){
    var mem=TAF.creerMemoire(), st=TAF.creerStockage(mem);
    mem.setItem('taf_prefs_v1', '{pas du json');
    mem.setItem('cra_app_v3', JSON.stringify(ANCIEN_CRA));
    egal(TAF.migrerDepuisStockage(st).source, 'cra', 'prefs illisibles → migration');
    var plein=TAF.creerMemoire(); plein.limiter(5);
    var r=TAF.migrerDepuisStockage(TAF.creerStockage(plein));
    egal([ r.source, r.ecrit, r.enAttente ], [ 'defaut', false, false ], 'rien à perdre : pas d’attente');
    var absent=TAF.migrerDepuisStockage(TAF.creerStockage(null));
    egal([ absent.source, absent.ecrit ], [ 'defaut', false ]);
  });
  test('avecApparenceHeritee : copie (jamais de mutation), format d’origine, clés sûres', function(){
    var etat=JSON.parse('{"days":{},"fields":{},"__proto__":{"pollue":1}}');
    egal(TAF.avecApparenceHeritee(etat, null)===etat, true, 'pas d’attente → même objet');
    var o=TAF.avecApparenceHeritee(etat, { accent:'#7C5CFC', mark:'bolt', logo:PNG, motif:false });
    egal([ o.accent, o.mark, o.logo, o.motif ], [ '#7C5CFC', 'bolt', PNG, false ]);
    egal(etat.accent, undefined, 'original intact');
    egal(Object.prototype.hasOwnProperty.call(o, '__proto__'), false, 'clé hostile non recopiée');
    egal(({}).pollue, undefined);
  });
  test('F2 — quota simulé (logo de 1,8 M car. + profil qui le contient) : l’apparence survit au rechargement', function(){
    var logo='data:image/png;base64,'+'A'.repeat(1800000);
    var cra=JSON.parse(JSON.stringify(ANCIEN_CRA)); cra.accent='#7C5CFC'; cra.logo=logo;
    var attendu={ accent:'#7C5CFC', mark:'bolt', logo:logo, motif:false };
    function nouvelAppareil(){
      var mem=TAF.creerMemoire(); mem.limiter(QUOTA_CHROME);
      mem.setItem('cra_app_v3', JSON.stringify(cra));
      mem.setItem('cra_profiles_v1', JSON.stringify([{ name:'Profil', data:{ accent:'#7C5CFC', mark:'bolt', logo:logo, motif:false } }]));
      return mem;
    }
    // 1) Chargement : l'écriture de taf_prefs_v1 échoue (quota) → migration EN ATTENTE, apparence en mémoire.
    var mem=nouvelAppareil(), st=TAF.creerStockage(mem);
    var r=TAF.migrerDepuisStockage(st);
    egal([ r.source, r.ecrit, r.enAttente ], [ 'cra', false, true ]);
    vrai(JSON.stringify(r.prefs)===JSON.stringify(attendu), 'apparence lue intacte');
    // 2) Sauvegarde du CRA pendant l'attente : l'apparence est réécrite au format d'origine.
    var etatCra={ fields:{ societe:'ACME' }, days:{ '2':{ am:true, pm:false, act:'' } }, provisoire:false };
    vrai(st.ecrire('cra_app_v3', TAF.avecApparenceHeritee(etatCra, r.prefs)), 'écriture du CRA réussie');
    // 3) Rechargement : toujours en attente, apparence intacte.
    var r2=TAF.migrerDepuisStockage(st);
    egal([ r2.source, r2.enAttente ], [ 'cra', true ]);
    vrai(JSON.stringify(r2.prefs)===JSON.stringify(attendu), 'apparence intacte après rechargement');
    // Contre-épreuve (comportement corrigé) : sans l'ancien format, l'apparence serait perdue.
    var memKo=nouvelAppareil(), stKo=TAF.creerStockage(memKo);
    TAF.migrerDepuisStockage(stKo); stKo.ecrire('cra_app_v3', etatCra);
    egal(TAF.migrerDepuisStockage(stKo).source, 'defaut', 'sans le correctif : apparence perdue');
    // 4) Place libérée (profil supprimé) : la migration aboutit et n'est plus en attente.
    mem.removeItem('cra_profiles_v1');
    var r3=TAF.migrerDepuisStockage(st);
    egal([ r3.source, r3.ecrit, r3.enAttente ], [ 'cra', true, false ]);
    egal(TAF.migrerDepuisStockage(st).source, 'prefs');
  });
  test('F2 — migrationEnAttente() : rien en attente sur la page de tests', function(){ egal(TAF.migrationEnAttente(), null); });

  /* ---------- Encre lisible ---------- */
  function lum(hex){
    var c=hex.slice(1); if(c.length===3) c=c.replace(/./g, '$&$&');
    return [0,2,4].map(function(i){ var x=parseInt(c.substr(i,2),16)/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); })
      .reduce(function(s, v, i){ return s+v*[0.2126,0.7152,0.0722][i]; }, 0);
  }
  function ratio(a, b){ var l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
  test('encreSur : encre foncée / claire selon le meilleur contraste (couleur, rgb(), jeton)', function(){
    egal(TAF.encreSur('#E2A400'), '#241a00', 'ambre');
    egal(TAF.encreSur('#2563EB'), '#ffffff', 'bleu');
    egal(TAF.encreSur('#ffffff'), '#241a00', 'blanc');
    egal(TAF.encreSur('#000000'), '#ffffff', 'noir');
    egal(TAF.encreSur('#334155'), '#ffffff', 'ardoise');
    egal(TAF.encreSur('rgb(0, 0, 0)'), '#ffffff', 'rgb()');
    egal(TAF.encreSur('pas une couleur'), '#241a00', 'invalide → défaut');
    egal(TAF.encreSur('--accent'), '#241a00', 'jeton résolu sur :root');
    egal(TAF.encreSurAccent, undefined, 'une seule fonction par besoin');
  });
  test('encreSur : contraste ≥ 3:1 sur les 8 accents proposés (détail ci-dessous)', function(){
    var details=TAF.SWATCHES.map(function(c){ var r=ratio(TAF.encreSur(c), c); vrai(r>=3, c+' : '+r.toFixed(2)); return c+' '+r.toFixed(2); });
    return details.join(' · ');
  });

  /* ---------- Formats & noms de fichiers ---------- */
  test('format.nombre / format.eur / format.dateFr', function(){
    var f=TAF.format;
    egal([ f.nombre(2.5), f.nombre(3), f.nombre(0), f.nombre(7.5, 2), f.nombre(2.25, 2), f.nombre(NaN), f.nombre(-0.001, 1) ], [ '2,5', '3', '0', '7,5', '2,25', '0', '0' ]);
    egal(espaces(f.eur(1234.5)), '1 234,5 €'); egal(espaces(f.eur('x')), '0 €');
    egal(f.dateFr('2026-10-14'), '14/10/2026');
    egal([ f.dateFr('2026-13-01'), f.dateFr('<b>'), f.dateFr(null), f.dateFr('1999-12-31') ], [ '', '', '', '31/12/1999' ]);
    egal(TAF.fmtNombre, undefined, 'anciens alias retirés');
  });
  test('format.dateCourte / dateLongue (fr-FR)', function(){
    egal(TAF.format.dateCourte('2026-10-13'), 'mar. 13 oct.');
    egal(TAF.format.dateLongue('2026-10-14'), 'mercredi 14 octobre');
    egal(TAF.format.dateLongue('2026-10-14', { annee:true }), 'mercredi 14 octobre 2026');
    egal(TAF.format.dateCourte(new Date(2026, 6, 4)), 'sam. 4 juil.');
    egal(TAF.format.dateCourte('2026-02-30'), '', 'date inexistante');
  });
  test('nomFichier : partagé (PDF du CRA, exports), \\p{L}\\p{N}_- uniquement', function(){
    egal(TAF.nomFichier('CRA_ACME & Co_Octobre_2026'), 'CRA_ACME_Co_Octobre_2026');
    egal(TAF.nomFichier('../../etc/passwd'), 'etc_passwd');
    egal(TAF.nomFichier('Société Générale'), 'Société_Générale');
    egal(TAF.nomFichier('TAF', 'Heures', '2026-10'), 'TAF_Heures_2026-10');
    egal(TAF.nomFichier('CRA', '', null, 'Octobre', 2026), 'CRA_Octobre_2026');
    egal(TAF.nomFichier(null), '');
    egal(TAF.nomFichier('a'.repeat(300)).length, 120, 'longueur bornée');
    egal(TAF.nomFichierSur, undefined, 'une seule fonction par besoin');
  });
  test('F11 — en-têtes de semaine dérivés des constantes partagées (lundi d’abord)', function(){
    egal(TAF.dates.enTetesSemaine('court'), [ 'Lun','Mar','Mer','Jeu','Ven','Sam','Dim' ]);
    egal(TAF.dates.enTetesSemaine('initiale'), [ 'L','M','M','J','V','S','D' ]);
    egal(TAF.dates.enTetesSemaine('long')[6], 'dimanche');
  });
  test('normaliserTexte : minuscules sans accents', function(){
    egal([ TAF.normaliserTexte('Éléonore  Ça'), TAF.normaliserTexte(null), TAF.normaliserTexte(' Client A ') ], [ 'eleonore ca', '', 'client a' ]);
  });

  /* ---------- DOM sûr ---------- */
  test('el : texte jamais interprété comme HTML', function(){
    var n=TAF.el('span', { class:'a b', 'data-x':'1', title:null }, [ '<b>x</b>', TAF.el('i', { text:'y' }) ]);
    egal(n.textContent, '<b>x</b>y');
    egal([ n.childNodes.length, n.children.length, n.firstChild.nodeType ], [ 2, 1, 3 ]);
    egal([ n.className, n.getAttribute('data-x'), n.hasAttribute('title') ], [ 'a b', '1', false ]);
    egal(TAF.el('p', { text:'<img src=x onerror=alert(1)>' }).children.length, 0);
  });
  test('el : refuse gestionnaires on*, style, srcdoc, srcset', function(){
    leve(function(){ TAF.el('div', { onclick:'alert(1)' }); }, 'onclick');
    leve(function(){ TAF.el('div', { OnMouseOver:'x' }); }, 'OnMouseOver');
    leve(function(){ TAF.el('div', { style:'color:red' }); }, 'style');
    leve(function(){ TAF.el('iframe', { srcdoc:'<p>' }); }, 'srcdoc');
    leve(function(){ TAF.el('img', { srcset:'x 1x' }); }, 'srcset');
  });
  test('F5 — URL en liste blanche, après suppression des caractères de contrôle et espaces', function(){
    var refusees=[ 'javascript:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', '\u0001javascript:alert(1)', 'jav\nascript:x',
      '\u0000javascript:x', 'JaVaScRiPt:x', 'vbscript:x', 'data:text/html,<b>', 'data:application/xhtml+xml,x', '//evil.example/x', '\\\\evil.example', 'https://exemple.org', 'mailto:x@y.z', 'file:///c:/x' ];
    refusees.forEach(function(u){ leve(function(){ TAF.el('a', { href:u }); }, JSON.stringify(u)); });
    leve(function(){ TAF.el('img', { src:'data:text/html,<b>' }); }, 'img data:text');
    var acceptees=[ 'index.html', 'index.html#heures-2026-10', '#jour', '?x=1', '', 'blob:http://127.0.0.1/abc', PNG, 'data:image/svg+xml;base64,PHN2Zy8+', 'heures.html' ];
    acceptees.forEach(function(u){ TAF.el('a', { href:u }); });
    TAF.el('img', { src:PNG });
  });
  test('creerSvg / creerIconeMarque : SVG construit sans innerHTML', function(){
    var s=TAF.creerIconeMarque('hex');
    egal([ s.namespaceURI, s.getAttribute('viewBox'), s.querySelectorAll('path').length, s.getAttribute('aria-hidden') ], [ 'http://www.w3.org/2000/svg', '0 0 28 30', 2, 'true' ]);
    egal(TAF.creerIconeMarque('inconnue').getAttribute('viewBox'), '0 0 28 30', 'repli sur hex');
  });
  test('id : préfixe + 10 caractères [a-z0-9] (crypto)', function(){ vrai(/^s_[a-z0-9]{10}$/.test(TAF.id('s'))); });

  /* ---------- Surfaces modales (F1) & annonces ---------- */
  test('gererModale : Escape ferme UNIQUEMENT la surface la plus haute', function(){
    var b=bac();
    var a=TAF.el('div', {}, [ TAF.el('button', { text:'A' }) ]), c=TAF.el('div', {}, [ TAF.el('button', { text:'B' }) ]);
    b.appendChild(a); b.appendChild(c);
    var fermes=[], relA, relB;
    relA=TAF.gererModale(a, null, null, function(){ fermes.push('A'); relA(false); });
    relB=TAF.gererModale(c, null, null, function(){ fermes.push('B'); relB(false); });
    touche(document, 'Escape'); egal(fermes, [ 'B' ]);
    touche(document, 'Escape'); egal(fermes, [ 'B', 'A' ]);
    touche(document, 'Escape'); egal(fermes, [ 'B', 'A' ], 'pile vide : rien à fermer');
    rangerBac();
  });
  test('F1 — piège de focus : les éléments en visibility:hidden ne comptent pas (Tab / Maj+Tab bouclent)', function(){
    var b=bac();
    var titre=TAF.el('span', { tabindex:'-1', text:'Titre' }), premier=TAF.el('button', { text:'Terminé' }), dernier=TAF.el('button', { text:'Dernier visible' });
    var cache=TAF.el('div', { contenteditable:'true', text:'activité masquée' });
    cache.style.visibility='hidden';                                     // CSSOM (CSP)
    var panneau=TAF.el('div', {}, [ titre, premier, TAF.el('button', { text:'milieu' }), dernier, cache ]);
    b.appendChild(panneau);
    var rel=TAF.gererModale(panneau, null, titre, function(){});
    dernier.focus();
    var e1=touche(dernier, 'Tab');
    egal([ e1.defaultPrevented, document.activeElement===premier ], [ true, true ], 'Tab depuis le dernier visible → premier');
    var e2=touche(premier, 'Tab', { shiftKey:true });
    egal([ e2.defaultPrevented, document.activeElement===dernier ], [ true, true ], 'Maj+Tab depuis le premier → dernier VISIBLE');
    titre.focus();
    touche(titre, 'Tab', { shiftKey:true });
    egal(document.activeElement===dernier, true, 'Maj+Tab depuis le titre (tabindex=-1) ne sort pas');
    var milieu=panneau.children[2]; milieu.focus();
    egal(touche(milieu, 'Tab').defaultPrevented, false, 'au milieu : ordre natif du navigateur');
    rel(false); rangerBac();
  });
  test('annoncer : région de la surface ouverte, sinon #liveRegion, ou région explicite', function(){
    var b=bac();
    var region=TAF.el('div', { 'data-taf-live':true }), panneau=TAF.el('div', {}, [ region, TAF.el('button', { text:'ok' }) ]);
    var explicite=TAF.el('div');
    b.appendChild(panneau); b.appendChild(explicite);
    var rel=TAF.gererModale(panneau, null, null, null);
    TAF.annoncer('dans la modale');
    return attendre(80).then(function(){
      egal(region.textContent, 'dans la modale');
      rel(false);
      TAF.annoncer('ciblée', explicite);
      return attendre(80);
    }).then(function(){
      egal(explicite.textContent, 'ciblée');
      rangerBac();
      TAF.annoncer('dans la page');
      return attendre(80);
    }).then(function(){ egal(document.getElementById('liveRegion').textContent, 'dans la page'); });
  });

  /* ---------- Toasts (action, Alt+U, pause) ---------- */
  test('toast : chaîne ou objet, un seul visible, action au clavier (Alt+U), pause au survol', function(){
    var appels=0;
    var p1=TAF.toast('Premier', 'info');
    var p2=TAF.toast({ message:'Plage ajoutée · 3 h 30', action:{ libelle:'Annuler', fn:function(){ appels++; } } });
    var visibles=document.querySelectorAll('.taf-toast:not(.is-out)');
    egal(visibles.length, 1, 'un seul toast');
    var t=visibles[0], bouton=t.querySelector('.taf-toast-action');
    egal([ bouton.textContent, bouton.getAttribute('aria-label'), bouton.getAttribute('aria-keyshortcuts') ], [ 'Annuler', 'Annuler : Plage ajoutée · 3 h 30', 'Alt+U' ]);
    egal(t.querySelector('.taf-toast-msg').getAttribute('aria-hidden'), 'true', 'message annoncé via annoncer() (pas de double lecture)');
    t.dispatchEvent(new MouseEvent('mouseenter')); vrai(t.classList.contains('is-pause'), 'pause au survol');
    t.dispatchEvent(new MouseEvent('mouseleave')); vrai(!t.classList.contains('is-pause'), 'reprise');
    touche(document, 'u', { altKey:true, code:'KeyU' });
    egal(appels, 1, 'Alt+U déclenche l’action');
    touche(document, 'u', { altKey:true, code:'KeyU' });
    egal(appels, 1, 'une seule fois (toast fermé)');
    p1.fermer(); p2.fermer();
    return attendre(260).then(function(){ egal(document.querySelectorAll('.taf-toast').length, 0, 'retirés du DOM'); });
  });
  test('mouvementReduit / vibrer : booléens, jamais d’exception', function(){
    egal(typeof TAF.mouvementReduit(), 'boolean'); egal(typeof TAF.vibrer(), 'boolean');
  });

  test('nav : plus de pastille « en cours » (chrono retiré)', function(){
    egal(Object.keys(TAF.nav), [ 'init' ]);
    egal([ typeof TAF.heures.validerChrono, typeof TAF.heures.decouperSegment ], [ 'undefined', 'undefined' ]);
  });

  /* ---------- Impression (F12) ---------- */
  test('F12 — preparerImpression : nom de PDF idempotent, retour à « TAF » (afterprint ou interaction)', function(){
    TAF.definirNomImpression(function(){ return 'CRA_ACME Conseil_Octobre_2026'; });
    TAF.preparerImpression(); TAF.preparerImpression();
    egal(document.title, 'CRA_ACME_Conseil_Octobre_2026', 'idempotent');
    window.dispatchEvent(new Event('afterprint'));
    egal(document.title, 'TAF', 'afterprint');
    window.dispatchEvent(new Event('beforeprint'));
    egal(document.title, 'CRA_ACME_Conseil_Octobre_2026', 'beforeprint (filet de sécurité)');
    document.dispatchEvent(new Event('pointerdown'));
    egal(document.title, 'TAF', 'sans afterprint : retour à la prochaine interaction');
    TAF.definirNomImpression(null);
    TAF.preparerImpression(); egal(document.title, 'TAF', 'sans fournisseur'); window.dispatchEvent(new Event('afterprint'));
  });

  /* ---------- Images (F8) ---------- */
  test('F8 — image.dimensions / image.octets (purs) et plafonds cohérents avec plusieurs copies', function(){
    var I=TAF.image;
    egal([ I.dimensions(2000, 1000, 512), I.dimensions(100, 50, 512), I.dimensions(0, 10, 512) ], [ { w:512, h:256 }, { w:100, h:50 }, null ]);
    egal([ I.octets('data:image/png;base64,AAAA'), I.octets('data:image/png;base64,AA=='), I.octets('x') ], [ 3, 1, 0 ]);
    vrai(I.LOGO.cote===512 && I.LOGO.cibleOctets===300000, 'cible 512 px / 300 Ko');
    vrai(I.LOGO.cibleOctets*4/3 < I.LOGO.maxCaracteres, 'la cible tient sous le plafond');
    vrai(I.LOGO.maxCaracteres*8 < QUOTA_CHROME, 'prefs + 7 profils tiennent dans le quota');
    var ancien='data:image/png;base64,'+'A'.repeat(1800000);
    egal(TAF.validerPrefs({ logo:ancien }).logo===ancien, true, 'un logo existant lourd est conservé à la lecture (réduit ensuite)');
  });
  function imageTest(type, w, h){
    var c=document.createElement('canvas'); c.width=w; c.height=h;
    var x=c.getContext('2d'), g=x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#E2A400'); g.addColorStop(1, '#2563EB'); x.fillStyle=g; x.fillRect(0, 0, w, h);
    for(var i=0;i<400;i++){ x.fillStyle='rgba('+(i*37%255)+','+(i*91%255)+','+(i*13%255)+',.6)'; x.fillRect((i*53)%w, (i*97)%h, 24, 18); }
    return c.toDataURL(type);
  }
  function dimsDe(url){ return new Promise(function(r, j){ var im=new Image(); im.onload=function(){ r([ im.naturalWidth, im.naturalHeight ]); }; im.onerror=j; im.src=url; }); }
  test('F8 — image.reduire : plus grand côté 512 px, PNG ou WebP, < 300 Ko', function(){
    var source=imageTest('image/png', 1600, 900);
    return TAF.image.reduire(source).then(function(u){
      vrai(/^data:image\/(png|webp);base64,/.test(u), 'format bitmap');
      vrai(TAF.image.octets(u)<=300000, 'sous la cible : '+TAF.image.octets(u));
      vrai(u.length<source.length, 'plus léger');
      return dimsDe(u).then(function(d){ egal(d, [ 512, 288 ]); return 'source '+Math.round(source.length/1000)+' k car. → '+Math.round(u.length/1000)+' k car.'; });
    });
  });
  test('F8 — image.reduire : un SVG est rasterisé (neutralisé), une image illisible est refusée', function(){
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#2563EB"/><circle cx="400" cy="200" r="150" fill="#E2A400"/></svg>';
    var url='data:image/svg+xml;base64,'+btoa(svg);
    return TAF.image.reduire(url).then(function(u){
      vrai(/^data:image\/(png|webp);/.test(u), 'plus de SVG : '+u.slice(0, 22));
      return dimsDe(u);
    }).then(function(d){
      egal(d, [ 512, 256 ]);
      return TAF.image.reduire('data:image/png;base64,AAAA').then(function(){ throw new Error('aurait dû échouer'); }, function(e){ egal(e.code, 'illisible'); });
    });
  });

  /* ---------- Anti-cadre (clickjacking) ---------- */
  test('estEncadre : self ≠ top → encadré ; accès à top refusé → encadré', function(){
    var a={}, b={};
    egal(TAF.estEncadre({ self:a, top:a }), false, 'onglet normal');
    egal(TAF.estEncadre({ self:a, top:b }), true, 'dans un cadre');
    var hostile={ self:a }; Object.defineProperty(hostile, 'top', { get:function(){ throw new Error('SecurityError'); } });
    egal(TAF.estEncadre(hostile), true, 'getter top qui lève');
    egal(TAF.encadre, false, 'la page de tests n’est pas encadrée');
  });

  /* ---------- Heures : une sauvegarde stockable reste réimportable ---------- */
  test('Heures — export au pire cas (json car. tous sur 3 octets UTF-8) ≤ limite d’import', function(){
    var LIM=TAF.heures.LIMITES;
    var donnees={ v:1, jours:{ '2026-10-01':[ { d:'08:00', f:'09:00', p:'', n:new Array(LIM.json-200).join('€'), o:'s' } ] } };
    vrai(JSON.stringify(donnees).length<=LIM.json, 'stockable');
    var env={ format:'taf-heures', version:1, exporte:new Date().toISOString(), donnees:donnees };
    var octets=new Blob([ JSON.stringify(env) ]).size;   // même enveloppe compacte que exporterJson
    vrai(octets<=LIM.fichierOctets, octets+' octets > '+LIM.fichierOctets);
    return octets+' / '+LIM.fichierOctets+' octets';
  });
})();
