/* ============================================================================
   TAF — TESTS DU MODULE CRA (tests/cra.test.js)
   Fonctions PURES de assets/cra-donnees.js (window.CraDonnees) : bornes des
   jours et des archives (G3), nombres TJM / charges, profils (validation au
   chargement, rien supprimé en silence), choix du format d'import (ancien /
   nouveau), ajustement du plan d'import Heures, et parcours « migration →
   sauvegarde avec quota limité → rechargement ». Stockage TOUJOURS simulé
   (TAF.creerMemoire) : jamais les vraies clés.
============================================================================ */
(function(){
  "use strict";
  var TAF=window.TAF, D=window.CraDonnees, T=window.TafTests;
  if(!TAF || !T) return;
  var test=T.test, egal=T.egal, vrai=T.vrai;

  var CHAMPS=['societe','client','consultant','dest','roleLeft','roleRight','nameLeft','nameRight','dateLeft','dateRight','docTitle','comment'];
  var MAINTENANT=new Date(2026, 9, 14, 12).getTime();          // mercredi 14 octobre 2026
  var PNG='data:image/png;base64,iVBORw0KGgo=';
  var QUOTA_CHROME=5242880;
  function opts(){ return { champs:CHAMPS, maintenant:MAINTENANT }; }

  test('CraDonnees : exposé, gelé, non réassignable, aucune RegExp atteignable', function(){
    vrai(D && Object.isFrozen(D) && Object.isFrozen(D.MAX) && Object.isFrozen(D.ANNEES), 'gelé');
    try{ window.CraDonnees={}; }catch(e){}
    vrai(window.CraDonnees===D, 'non réassignable');
    var vus=[], trouvees=[];
    (function parcourir(o, chemin){
      if(!o || (typeof o!=='object' && typeof o!=='function') || vus.indexOf(o)!==-1) return;
      vus.push(o);
      if(o instanceof RegExp){ trouvees.push(chemin); return; }
      Object.keys(o).forEach(function(k){ parcourir(o[k], chemin+'.'+k); });
    })(D, 'CraDonnees');
    egal(trouvees, []);
  });

  /* ---------- G3 : bornes des jours ---------- */
  test('G3 — joursDansMois : 28 / 29 / 30 / 31', function(){
    egal([ D.joursDansMois(2026, 1), D.joursDansMois(2024, 1), D.joursDansMois(2026, 3), D.joursDansMois(2026, 9) ], [ 28, 29, 30, 31 ]);
  });
  test('G3 — jour 31 (et 29, 30) en février 2026 : écartés ; 29 février 2024 conservé', function(){
    var jours={ '28':{ am:true, pm:true, act:'' }, '29':{ am:true, pm:false, act:'' }, '30':{ am:true, pm:true, act:'x' }, '31':{ am:true, pm:true, act:'' } };
    egal(Object.keys(D.validerJours(jours, D.joursDansMois(2026, 1))), [ '28' ]);
    egal(Object.keys(D.validerJours(jours, D.joursDansMois(2024, 1))), [ '28', '29' ]);
    var e=D.validerEtat({ month:1, year:2026, days:jours }, opts());
    egal(Object.keys(e.days), [ '28' ], 'état de février 2026');
    egal([ e.month, e.year ], [ 1, 2026 ]);
  });
  test('G3 — validerJours : clés hostiles et valeurs invalides refusées', function(){
    var brut=JSON.parse('{"__proto__":{"am":true},"constructor":{"am":true},"0":{"am":true},"01":{"am":true},"32":{"am":true},"5":{"am":"oui","pm":1,"act":42},"6":{"am":true,"pm":false,"act":"ok"}}');
    egal(D.validerJours(brut), { '6':{ am:true, pm:false, act:'ok' } });
    egal(({}).am, undefined, 'aucune pollution de prototype');
  });
  test('G3 — mois / année invalides : ceux de « maintenant », jours bornés à CE mois', function(){
    var e=D.validerEtat({ month:12, year:1969, days:{ '31':{ am:true, pm:true, act:'' } } }, opts());
    egal([ e.month, e.year ], [ 9, 2026 ]);
    egal(Object.keys(e.days), [ '31' ], 'octobre a 31 jours');
    var e2=D.validerEtat({ month:'3', year:'3000' }, { champs:CHAMPS, maintenant:new Date(2026, 3, 2).getTime() });
    egal([ e2.month, e2.year ], [ 3, 2026 ], '« 3 » accepté (chaîne numérique), 3000 refusé');
  });

  /* ---------- G3 : archive ---------- */
  test('G3 — archive : années 1970–2999, jours bornés au mois de la clé', function(){
    var a={
      '0999-01':{ days:{ '1':{ am:true, pm:true, act:'' } } },
      '1969-12':{ days:{ '1':{ am:true, pm:true, act:'' } } },
      '3000-01':{ days:{ '1':{ am:true, pm:true, act:'' } } },
      '1970-01':{ days:{ '1':{ am:true, pm:true, act:'' } } },
      '2999-12':{ days:{ '31':{ am:true, pm:true, act:'' } } },
      '2026-02':{ days:{ '28':{ am:true, pm:true, act:'' }, '30':{ am:true, pm:true, act:'' } } },
      '2026-04':{ days:{ '31':{ am:true, pm:true, act:'avril 31' }, '2':{ am:true, pm:true, act:'' } } },
      '2026-06':{ days:{ '31':{ am:true, pm:true, act:'' } } },
      '2026-13':{ days:{ '1':{ am:true, pm:true, act:'' } } }
    };
    var v=D.validerArchive(a);
    egal(Object.keys(v).sort(), [ '1970-01', '2026-02', '2026-04', '2999-12' ]);
    egal(Object.keys(v['2026-02'].days), [ '28' ]);
    egal(Object.keys(v['2026-04'].days), [ '2' ]);
    egal(D.lireCleArchive('0999-01'), null);
    egal(D.lireCleArchive('2026-10'), { annee:2026, mois0:9 });
    egal(D.cleArchive(2026, 0), '2026-01');
  });
  test('G3 — archive : clé hostile (__proto__) ignorée', function(){
    var v=D.validerArchive(JSON.parse('{"__proto__":{"days":{"1":{"am":true}}},"2026-10":{"days":{"1":{"am":true,"pm":true}}}}'));
    egal(Object.keys(v), [ '2026-10' ]);
    egal(({}).days, undefined);
  });

  /* ---------- G3 : TJM / charges ---------- */
  test('G3 — nombreTexte : l’état est ce qu’affiche un <input type=number>', function(){
    var n=D.nombreTexte;
    egal([ n('500'), n(' 600 '), n('5,5'), n('.5'), n('1e3'), n(450), n(0) ], [ '500', '600', '5.5', '.5', '1e3', '450', '0' ]);
    egal([ n('-5'), n('-0.5'), n('abc'), n('5.'), n('5,5,5'), n(''), n(null), n(NaN), n(Infinity), n('1e400'), n({}) ], [ '', '', '', '', '', '', '', '', '', '', '' ]);
    egal([ n('150', 100), n('100', 100), n(250, 100), n('99.5', 100) ], [ '100', '100', '100', '99.5' ], 'plafond');
    var champ=document.createElement('input'); champ.type='number';
    [ '500', '5.5', '.5', '1e3', '0' ].forEach(function(v){ champ.value=n(v); egal(champ.value, n(v), 'affichable tel quel : '+v); });
  });
  test('G3 — validerEtat : TJM / charges bornés (négatif refusé, charges ≤ 100)', function(){
    var e=D.validerEtat({ tjm:'-12', charges:'150' }, opts());
    egal([ e.tjm, e.charges ], [ '', '100' ]);
    var e2=D.validerEtat({ tjm:'5,5', charges:'45' }, opts());
    egal([ e2.tjm, e2.charges ], [ '5.5', '45' ]);
  });

  /* ---------- Import : choix du format ---------- */
  test('Import — ANCIEN format (apparence au premier niveau) et NOUVEAU (objet prefs)', function(){
    var ancien={ fields:{ societe:'ACME', inconnu:'x' }, accent:'#2563EB', mark:'bolt', logo:null, motif:false, tjm:'500', month:9, year:2026, days:{ '1':{ am:true, pm:true, act:'Dev' } } };
    var a=D.lireImport(ancien, opts());
    egal(a.format, 'ancien');
    egal(a.prefs, { accent:'#2563EB', mark:'bolt', logo:null, motif:false });
    egal(a.etat.fields, { societe:'ACME' }, 'champ inconnu ignoré');
    egal(a.etat.days, { '1':{ am:true, pm:true, act:'Dev' } });
    egal(a.etat.accent, undefined, 'l’apparence ne fait pas partie de l’état CRA');
    var nouveau={ fields:{ client:'Client' }, prefs:{ accent:'#15A66B', mark:'leaf', logo:PNG, motif:true }, accent:'#E5484D', days:{} };
    var b=D.lireImport(nouveau, opts());
    egal(b.format, 'nouveau');
    egal(b.prefs, { accent:'#15A66B', mark:'leaf', logo:PNG, motif:true }, 'prefs prioritaires sur les champs du premier niveau');
    var c=D.lireImport({ days:{ '2':{ am:true, pm:false, act:'' } } }, opts());
    egal([ c.format, c.prefs ], [ 'sans-apparence', null ]);
  });
  test('Import — formes implausibles ou hostiles refusées / neutralisées', function(){
    [ null, [], 'texte', 42, {}, { days:[] }, { fields:'x' }, { autre:1 } ].forEach(function(o){ egal(D.lireImport(o, opts()), null, JSON.stringify(o)); });
    var h=D.lireImport(JSON.parse('{"days":{"__proto__":{"am":true}},"prefs":{"accent":"url(x)","mark":"<svg>","logo":"data:text/html,<b>"}}'), opts());
    egal(h.prefs, { accent:'#E2A400', mark:'hex', logo:null, motif:true });
    egal(h.etat.days, {});
  });

  /* ---------- G3 : profils ---------- */
  test('G3 — profils : au-delà de 50, aucun n’est supprimé en silence (60 → 60)', function(){
    var a=[]; for(var i=0;i<60;i++) a.push({ name:'P'+i, data:{ fields:{ societe:'S'+i } } });
    var r=D.validerProfils(a, CHAMPS);
    egal([ r.profils.length, r.ignores ], [ 60, 0 ]);
    egal(r.profils[59].name, 'P59');
    var trop=[]; for(var k=0;k<D.MAX.profilsLus+5;k++) trop.push({ name:'Q'+k });
    egal(D.validerProfils(trop, CHAMPS).ignores, 5, 'au-delà du plafond de lecture : compté (averti), pas silencieux');
  });
  test('G3 — profils : data validée au chargement (champs, apparence, TJM)', function(){
    var brut=JSON.parse('[{"name":"  Client A  ","data":{"fields":{"societe":"ACME","__proto__":{"x":1},"evil":"y"},"accent":"#2563EB;background:url(x)","mark":"toString","logo":"javascript:alert(1)","motif":false,"tjm":"-12","charges":"150","days":{"1":{"am":true}}}},{"name":""},{"nom":"sans name"},null,"texte",{"name":"B","data":[1,2]}]');
    var r=D.validerProfils(brut, CHAMPS);
    egal(r.ignores, 4);
    egal(r.profils.map(function(p){ return p.name; }), [ 'Client A', 'B' ]);
    egal(r.profils[0].data, { fields:{ societe:'ACME' }, accent:'#E2A400', mark:'hex', logo:null, motif:false, tjm:'', charges:'100' });
    egal(r.profils[1].data.fields, {});
    egal(D.validerProfils('corrompu', CHAMPS), { profils:[], ignores:1 });
    egal(D.validerProfils(null, CHAMPS), { profils:[], ignores:0 });
  });

  /* ---------- Clés illisibles : jamais écrasées en silence ---------- */
  test('classerBrut : absent / ok / illisible (cra_app_v3)', function(){
    var c=function(t){ return D.classerBrut(t, D.etatStockePlausible).statut; };
    egal([ c(null), c(undefined) ], [ 'absent', 'absent' ], 'clé absente : CRA neuf, écriture permise');
    egal([ c('{"days":{"1":{"am":true}},}'), c(''), c('{"days":{'), c('null'), c('[]'), c('42'), c('"texte"'), c('{"month":9}'), c('{"days":[]}') ],
      [ 'illisible', 'illisible', 'illisible', 'illisible', 'illisible', 'illisible', 'illisible', 'illisible', 'illisible' ]);
    egal([ c('{}'), c('{"days":{}}'), c('{"fields":{"societe":"A"},"days":{"1":{"am":true}}}') ], [ 'ok', 'ok', 'ok' ]);
    var r=D.classerBrut('{"days":{"2":{"pm":true}}}', D.etatStockePlausible);
    egal(r.valeur, { days:{ '2':{ pm:true } } }, 'valeur lue rendue telle quelle (validée ensuite)');
    egal(D.classerBrut('{"a":1}').statut, 'ok', 'sans prédicat : tout JSON valide');
    egal(D.classerBrut(42).statut, 'illisible', 'non-chaîne');
  });
  test('classerBrut : profils (cra_profiles_v1) — JSON tronqué ou non-tableau → illisible', function(){
    var c=function(t){ return D.classerBrut(t, Array.isArray).statut; };
    egal([ c('[{"name":"Client A","data":{}},{"name":"Client B","data":{}}'), c('{"name":"A"}'), c('null'), c('[]'), c(null) ],
      [ 'illisible', 'illisible', 'illisible', 'ok', 'absent' ]);
  });
  test('classerBrut sur un stockage simulé : la clé illisible reste intacte (lecture seule)', function(){
    var mem=TAF.creerMemoire(), st=TAF.creerStockage(mem), brut='{"days":{"1":{"am":true}},}';
    mem.setItem('cra_app_v3', brut);
    var t=st.lireTexte('cra_app_v3');
    egal(D.classerBrut(t, D.etatStockePlausible).statut, 'illisible');
    egal(st.lire('cra_app_v3', null), null, 'lire() seul ne distinguerait pas « illisible » de « absent »');
    egal([ mem.getItem('cra_app_v3'), mem.ecritures ], [ brut, 1 ], 'aucune écriture');
  });
  test('Budget d’import : état lu trop lourd refusé (signatures géantes), apparence exclue', function(){
    var grosse='data:image/png;base64,'+'A'.repeat(2700000);
    var o={ days:{ '1':{ am:true } }, sig:{ left:grosse, right:grosse } };
    vrai(D.tailleEtatLu(o)>D.MAX.etatImport, 'taille '+D.tailleEtatLu(o));
    egal(D.etatTropLourd(o), true);
    egal(D.etatTropLourd({ days:{ '1':{ am:true } }, sig:{ left:grosse, right:null } }), false, 'une seule : sous le budget');
    egal(D.etatTropLourd({ days:{}, prefs:{ logo:grosse }, logo:grosse+grosse }), false, 'apparence hors budget CRA');
    egal(D.etatTropLourd({ fields:{ comment:'x'.repeat(D.MAX.etatImport) } }), true);
    var cyclique={ days:{} }; cyclique.fields=cyclique;
    egal(D.etatTropLourd(cyclique), true, 'non sérialisable : refusé');
    egal([ D.tailleEtatLu(null), D.MAX.signaturePng ], [ 0, 300000 ]);
  });

  /* ---------- Pont Heures : pastille et plan ---------- */
  test('etatJour : pastille tri-état dérivée (vide / demie matin / demie après-midi / pleine)', function(){
    egal([ D.etatJour({}), D.etatJour({ am:true }), D.etatJour({ pm:true }), D.etatJour({ am:true, pm:true }), D.etatJour(null) ],
      [ { st:'empty', side:'' }, { st:'half', side:'am' }, { st:'half', side:'pm' }, { st:'full', side:'' }, { st:'empty', side:'' } ]);
    vrai(D.etatJour===TAF.etatJour, 'alias de la règle unique du socle (aucune copie locale)');
  });
  test('ajusterPlanImport : activité proposée seulement pour un jour qui reste coché', function(){
    var cra={ '3':{ am:true, pm:false, act:'' } };
    var resume={ '3':{ am:true, pm:true, activite:'Client A', min:420 }, '4':{ am:false, pm:false, activite:'Réunion courte', min:30 } };
    var brut=TAF.heures.planifierImport(cra, resume, 'completer', true);
    egal(brut.changements.length, 2, 'la règle partagée propose aussi le 4 (décoché)');
    var p=D.ajusterPlanImport(brut);
    egal(p.changements, [ { jour:3, avant:{ am:true, pm:false, act:'' }, apres:{ am:true, pm:true, act:'Client A' } } ]);
    egal(p.synthese.inchanges, brut.synthese.inchanges+1, 'le 4 compte comme inchangé');
    egal([ p.synthese.joursDetectes, p.synthese.joursProposes ], [ 2, 1 ]);
    vrai(brut.changements.length===2, 'plan d’origine non muté');
  });
  test('ajusterPlanImport : Remplacer décoche, conserve l’activité, entrée hostile ignorée', function(){
    var p=D.ajusterPlanImport(TAF.heures.planifierImport({ '5':{ am:true, pm:true, act:'X' } }, {}, 'remplacer', true));
    egal(p.changements, [ { jour:5, avant:{ am:true, pm:true, act:'X' }, apres:{ am:false, pm:false, act:'X' } } ]);
    egal(p.synthese.decoches, 2);
    egal(D.ajusterPlanImport(null).changements, []);
    egal(D.ajusterPlanImport({ changements:[ null, { jour:1 }, 'x' ], synthese:{} }).changements, []);
  });

  /* ---------- Migration → sauvegarde (quota limité) → rechargement ---------- */
  test('Migration puis sauvegarde avec quota limité puis rechargement : jours ET apparence intacts', function(){
    var logo='data:image/png;base64,'+'A'.repeat(1800000);
    var ancien={ fields:{ societe:'ACME' }, accent:'#7C5CFC', mark:'bolt', logo:logo, motif:false, provisoire:false, tjm:'500', charges:'', sig:{ left:null, right:null },
      month:1, year:2026, days:{ '2':{ am:true, pm:true, act:'Dev' }, '31':{ am:true, pm:true, act:'fantôme' } }, presets:[], archive:{ '0999-01':{ days:{ '1':{ am:true } } } } };
    var mem=TAF.creerMemoire(); mem.limiter(QUOTA_CHROME);
    mem.setItem('cra_app_v3', JSON.stringify(ancien));
    mem.setItem('cra_profiles_v1', JSON.stringify([{ name:'Profil', data:{ accent:'#7C5CFC', mark:'bolt', logo:logo, motif:false } }]));
    var st=TAF.creerStockage(mem);
    // 1) Chargement : migration de l'apparence EN ATTENTE (quota), état validé et borné.
    var m=TAF.migrerDepuisStockage(st);
    egal([ m.source, m.ecrit, m.enAttente ], [ 'cra', false, true ]);
    var etat=D.validerEtat(st.lire('cra_app_v3', null), opts());
    egal(Object.keys(etat.days), [ '2' ], '31 février écarté au chargement');
    egal(etat.archive, {}, 'archive hors bornes écartée');
    // 2) Modification + sauvegarde (mécanisme partagé) pendant l'attente : format d'origine conservé.
    etat.days['3']={ am:true, pm:false, act:'' };
    var sauvegarde=TAF.creerSauvegarde('cra_app_v3', function(){ return TAF.avecApparenceHeritee(etat, m.prefs); }, { stockage:st, temoin:false });
    vrai(sauvegarde.maintenant(), 'écriture réussie malgré le quota');
    // 3) Rechargement : jours modifiés présents, apparence toujours intacte, migration toujours en attente.
    var m2=TAF.migrerDepuisStockage(st);
    egal([ m2.source, m2.enAttente ], [ 'cra', true ]);
    egal(m2.prefs, { accent:'#7C5CFC', mark:'bolt', logo:logo, motif:false });
    var etat2=D.validerEtat(st.lire('cra_app_v3', null), opts());
    egal(etat2.days, { '2':{ am:true, pm:true, act:'Dev' }, '3':{ am:true, pm:false, act:'' } });
    egal([ etat2.month, etat2.year, etat2.tjm ], [ 1, 2026, '500' ]);
    // 4) Place libérée : la migration aboutit ; l'état CRA reste lisible et identique.
    mem.removeItem('cra_profiles_v1');
    var m3=TAF.migrerDepuisStockage(st);
    egal([ m3.source, m3.ecrit, m3.enAttente ], [ 'cra', true, false ]);
    egal(D.validerEtat(st.lire('cra_app_v3', null), opts()).days, etat2.days);
  });
  test('Sauvegarde refusée (quota plein) : l’état stocké précédent reste lisible et intact', function(){
    var mem=TAF.creerMemoire(), st=TAF.creerStockage(mem);
    var avant={ month:9, year:2026, days:{ '1':{ am:true, pm:true, act:'' } } };
    mem.setItem('cra_app_v3', JSON.stringify(avant));
    mem.limiter(JSON.stringify(avant).length+'cra_app_v3'.length+10);
    var etat=D.validerEtat(st.lire('cra_app_v3', null), opts());
    etat.fields.comment='x'.repeat(5000);
    var raison='';
    var s=TAF.creerSauvegarde('cra_app_v3', function(){ return etat; }, { stockage:st, temoin:false, apres:function(ok, r){ raison=r; } });
    egal(s.maintenant(), false);
    egal(raison, 'quota');
    egal(D.validerEtat(st.lire('cra_app_v3', null), opts()).days, avant.days, 'rien de corrompu');
  });
})();
