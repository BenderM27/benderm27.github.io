/* ============================================================================
   TAF — TESTS DES RÈGLES HEURES (tests/heures.test.js)
   Les 42 cas de docs/heures-spec.md §15 (numérotés « §15.n »), plus quelques
   compléments (réglages, lecture validée sur stockage simulé). Fonctions
   PURES de TAF.heures / dates / format / csv / id : aucun DOM, aucun accès
   au localStorage réel.
============================================================================ */
(function(){
  "use strict";
  var TAF=window.TAF, T=window.TafTests;
  if(!TAF || !T) return;
  var test=T.test, egal=T.egal, vrai=T.vrai;
  var H=TAF.heures, D=TAF.dates, F=TAF.format;
  function dfs(plages){ return plages.map(function(p){ return p.d+'–'+p.f+(p.p?' '+p.p:''); }); }
  var CLIENT_A={ id:'p_clienta001', nom:'Client A', t:0, a:false }, CONSEIL={ id:'p_conseil001', nom:'Conseil', t:1, a:false };
  function ctx(sup){ var c={ cleJour:'2026-10-14', maintenantMin:907, plagesJour:[], projets:[ CLIENT_A ], debutHabituel:'09:00', pas:1, mode:'proche' }; Object.keys(sup||{}).forEach(function(k){ c[k]=sup[k]; }); return c; }
  function codes(r){ return r.erreurs.map(function(e){ return e.code; }); }
  function duree(r){ var p=r.plages[0]; return H.minutes(p.f)-H.minutes(p.d); }

  /* ---------- Temps et formats ---------- */
  test('§15.1 minutes / versHHMM', function(){
    egal([ H.minutes('09:30'), H.minutes('24:00'), isNaN(H.minutes('7:00')), isNaN(H.minutes('24:01')), isNaN(H.minutes(null)) ], [ 570, 1440, true, true, true ]);
    egal([ H.versHHMM(1440), H.versHHMM(5), H.versHHMM(0), H.versHHMM(NaN) ], [ '24:00', '00:05', '00:00', '' ]);
  });
  test('§15.2 format.duree', function(){
    egal([ F.duree(0), F.duree(45), F.duree(60), F.duree(450), F.duree(605) ], [ '0 min', '45 min', '1 h', '7 h 30', '10 h 05' ]);
  });
  test('§15.3 format.decimal / format.dureeLongue', function(){
    egal([ F.decimal(450), F.decimal(10), F.decimal(0) ], [ '7,5', '0,17', '0' ]);
    egal([ F.dureeLongue(209), F.dureeLongue(60), F.dureeLongue(1), F.dureeLongue(120) ], [ '3 heures 29 minutes', '1 heure', '1 minute', '2 heures' ]);
    egal(F.jours(18.5), '18,5 j');
  });
  test('§15.4 arrondir', function(){
    egal([ H.arrondir(577,15,'proche'), H.arrondir(578,15,'proche'), H.arrondir(571,15,'bas'), H.arrondir(571,15,'haut'), H.arrondir(571,1,'proche') ], [ 570, 585, 570, 585, 571 ]);
    egal(H.arrondir(751.0000000001, 15, 'haut'), 765, 'bruit flottant neutralisé');
  });

  /* ---------- Dates ---------- */
  test('§15.5 semaine ISO 8601 et lundi', function(){
    egal([ D.semaineIso('2026-01-01'), D.semaineIso('2027-01-01'), D.semaineIso('2020-12-31') ], [ { annee:2026, semaine:1 }, { annee:2026, semaine:53 }, { annee:2020, semaine:53 } ]);
    egal([ D.lundiDe('2026-10-14'), D.lundiDe('2026-10-12'), D.lundiDe('2026-10-18') ], [ '2026-10-12', '2026-10-12', '2026-10-12' ]);
    egal(D.semaineIso('2026-10-14'), { annee:2026, semaine:42 });
  });
  test('§15.6 dates.cleValide', function(){
    egal([ D.cleValide('2026-02-30'), D.cleValide('2024-02-29'), D.cleValide('2026-13-01'), D.cleValide('1999-12-31'), D.cleValide('2026-1-01'), D.cleValide('__proto__') ], [ false, true, false, false, false, false ]);
    egal([ D.ajouterJours('2026-10-31', 1), D.ajouterJours('2026-03-28', 2), D.cle(new Date(2026, 9, 25, 23, 30)) ], [ '2026-11-01', '2026-03-30', '2026-10-25' ]);
    egal(D.depuisCle('2026-10-14').getHours(), 12, 'midi local');
    egal(D.depuisCle('2026-02-30'), null);
  });

  /* ---------- Chrono : découpe des segments ---------- */
  test('§15.7 decouperSegment — pas 1, proche', function(){
    egal(H.decouperSegment(new Date(2026,9,14,9,2,0), new Date(2026,9,14,12,31,40), 1, 'proche').plagesParJour, { '2026-10-14':[ { d:'09:02', f:'12:32' } ] });
  });
  test('§15.8 decouperSegment — pas 15, favorable', function(){
    egal(H.decouperSegment(new Date(2026,9,14,9,2,0), new Date(2026,9,14,12,31,40), 15, 'favorable').plagesParJour, { '2026-10-14':[ { d:'09:00', f:'12:45' } ] });
  });
  test('§15.9 decouperSegment — découpe au minuit local', function(){
    egal(H.decouperSegment(new Date(2026,9,14,22,30), new Date(2026,9,15,1,15), 1, 'proche').plagesParJour,
      { '2026-10-14':[ { d:'22:30', f:'24:00' } ], '2026-10-15':[ { d:'00:00', f:'01:15' } ] });
  });
  test('§15.10 decouperSegment — 40 s ignoré, horloge reculée', function(){
    var r=H.decouperSegment(new Date(2026,9,14,9,0,0), new Date(2026,9,14,9,0,40), 1, 'proche');
    egal([ r.plagesParJour, r.horlogeReculee ], [ {}, false ]);
    egal(H.decouperSegment(new Date(2026,9,14,9,0,30), new Date(2026,9,14,9,1,10), 15, 'favorable').plagesParJour, {}, 'même en arrondi favorable');
    var k=H.decouperSegment(new Date(2026,9,14,10,0), new Date(2026,9,14,9,0), 1, 'proche');
    egal([ k.plagesParJour, k.horlogeReculee ], [ {}, true ]);
    egal(H.decouperSegment(new Date(2026,9,1), new Date(2026,9,12), 1, 'proche').erreur.code, 'trop-long', 'plus de 8 jours refusé');
  });
  test('§15.11 decouperSegment — changements d’heure (Europe/Paris)', function(){
    var fuseau=''; try{ fuseau=Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){}
    if(fuseau!=='Europe/Paris') return 'ignoré (fuseau '+fuseau+')';
    egal(H.decouperSegment(new Date(2026,9,25,1,30), new Date(2026,9,25,3,30), 1, 'proche').plagesParJour, { '2026-10-25':[ { d:'01:30', f:'04:30' } ] });
    egal(H.decouperSegment(new Date(2026,2,29,1,30), new Date(2026,2,29,3,30), 1, 'proche').plagesParJour, { '2026-03-29':[ { d:'01:30', f:'02:30' } ] });
    return 'Europe/Paris : durée réelle conservée (180 / 60 min)';
  });

  /* ---------- Insertion et normalisation ---------- */
  test('§15.12 insererPlage — débordement : la plus récente gagne', function(){
    var r=H.insererPlage([ { d:'09:00', f:'12:00', p:'A' } ], { d:'11:00', f:'13:00' });
    egal(dfs(r.plages), [ '09:00–11:00 A', '11:00–13:00' ]);
    egal([ r.rognees.length, r.rognees[0].type ], [ 1, 'rognee' ]);
  });
  test('§15.13 insererPlage — englobée : scission (nouvel id pour la seconde partie)', function(){
    var r=H.insererPlage([ { id:'h_aaaaaaaaaa', d:'09:00', f:'12:00', p:'A' } ], { d:'10:00', f:'11:00' });
    egal(dfs(r.plages), [ '09:00–10:00 A', '10:00–11:00', '11:00–12:00 A' ]);
    egal(r.plages[0].id, 'h_aaaaaaaaaa', 'même id pour la première partie');
    vrai(/^h_[a-z0-9]{10}$/.test(r.plages[2].id) && r.plages[2].id!=='h_aaaaaaaaaa', 'nouvel id');
    egal(r.rognees[0].type, 'scindee');
  });
  test('§15.14 insererPlage — entièrement couverte : supprimée', function(){
    var r=H.insererPlage([ { d:'09:00', f:'12:00' } ], { d:'08:00', f:'13:00' });
    egal(dfs(r.plages), [ '08:00–13:00' ]); egal(r.rognees[0].type, 'supprimee');
    var e=H.insererPlage([ { id:'h_bbbbbbbbbb', d:'09:00', f:'12:00' } ], { id:'h_bbbbbbbbbb', d:'09:30', f:'10:00' });
    egal(dfs(e.plages), [ '09:30–10:00' ], 'édition : l’ancienne version est retirée');
  });
  test('§15.15 normaliserJour — tri, chevauchement résiduel, plages vides', function(){
    egal(dfs(H.normaliserJour([ { d:'14:00', f:'15:00' }, { d:'09:00', f:'11:00' }, { d:'10:00', f:'12:00' }, { d:'16:00', f:'16:00' } ])), [ '09:00–11:00', '11:00–12:00', '14:00–15:00' ]);
    var src=[ { d:'10:00', f:'12:00' }, { d:'09:00', f:'11:00' } ];
    H.normaliserJour(src); egal(src[0].d, '10:00', 'entrée jamais modifiée');
  });
  test('§15.16 normaliserJour — fusion des contiguës (même session, projet, note)', function(){
    egal(dfs(H.normaliserJour([ { d:'09:00', f:'10:00', s:'s1', p:'pA' }, { d:'10:00', f:'11:00', s:'s1', p:'pA' } ])), [ '09:00–11:00 pA' ]);
    egal(dfs(H.normaliserJour([ { d:'09:00', f:'10:00', s:'s1', p:'pA' }, { d:'10:00', f:'11:00', s:'s1', p:'pB' } ])), [ '09:00–10:00 pA', '10:00–11:00 pB' ]);
    egal(dfs(H.normaliserJour([ { d:'09:00', f:'10:00', p:'pA' }, { d:'10:00', f:'11:00', p:'pA' } ])), [ '09:00–10:00 pA', '10:00–11:00 pA' ], 'sans s : inchangé');
  });
  test('§15.17 unionMinutes', function(){
    egal([ H.unionMinutes([ { d:'09:00', f:'11:00' }, { d:'10:00', f:'12:00' } ]), H.unionMinutes([]), H.unionMinutes([ { d:'22:00', f:'24:00' }, { d:'x', f:'y' } ]) ], [ 180, 0, 120 ]);
  });

  /* ---------- Conversion en demi-journées ---------- */
  var DEF=H.reglagesDefaut();
  function dj(plages, r){ return H.demiJournees(plages, r||DEF); }
  test('§15.18 demiJournees — journée complète', function(){
    egal(dj([ { d:'09:00', f:'12:30' }, { d:'13:30', f:'17:00' } ]), { am:true, pm:true, minAm:210, minPm:210 });
    egal(H.seuilDemi(DEF), 105, 'seuil auto = durée du jour / 4 arrondi à 5');
  });
  test('§15.19 demiJournees — après-midi seule / matin dominant', function(){
    var a=dj([ { d:'14:00', f:'16:00' } ]), b=dj([ { d:'11:00', f:'14:00' } ]);
    egal([ a.am, a.pm ], [ false, true ]);
    egal(b, { am:true, pm:false, minAm:120, minPm:60 });
  });
  test('§15.20 demiJournees — rattrapage (égalité : matin) ou non', function(){
    var a=dj([ { d:'12:00', f:'14:00' } ]), b=dj([ { d:'12:00', f:'14:00' } ], { rattrapage:false });
    egal([ a.am, a.pm, b.am, b.pm ], [ true, false, false, false ]);
  });
  test('§15.21 demiJournees — seuils', function(){
    function ap(p){ var r=dj(p); return [ r.am, r.pm ]; }
    egal([ ap([ { d:'12:30', f:'13:30' } ]), ap([ { d:'13:00', f:'14:45' } ]), ap([ { d:'13:00', f:'14:44' } ]) ], [ [false,false], [false,true], [false,false] ]);
    egal(dj([]), { am:false, pm:false, minAm:0, minPm:0 });
  });
  test('§15.22 demiJournees — chevauchement, minuit, coupure personnalisée', function(){
    var a=dj([ { d:'09:00', f:'11:00' }, { d:'10:00', f:'12:00' } ]);
    egal([ a.minAm, a.am ], [ 180, true ]);
    egal(dj([ { d:'22:00', f:'24:00' } ]).pm, true);
    var c=dj([ { d:'11:00', f:'13:00' } ], { coupure:'12:00' });
    egal([ c.am, c.pm, c.minAm, c.minPm ], [ true, false, 60, 60 ]);
  });

  /* ---------- Saisie rapide (jour courant 2026-10-14, maintenant 15:07) ---------- */
  test('§15.23 analyserSaisie « 9-12:30 »', function(){
    var r=H.analyserSaisie('9-12:30', ctx());
    egal(r.plagesParJour, { '2026-10-14':[ { d:'09:00', f:'12:30' } ] });
    egal([ r.erreurs, r.plages.length, r.traverseMinuit ], [ [], 1, false ]);
  });
  test('§15.24 analyserSaisie — deux plages, @projet (préfixe unique), note', function(){
    var r=H.analyserSaisie('9-12:30 13:30-17 @cli réunion', ctx());
    egal(dfs(r.plagesParJour['2026-10-14']), [ '09:00–12:30', '13:30–17:00' ]);
    egal([ r.projet, r.note, r.erreurs ], [ 'p_clienta001', 'réunion', [] ]);
    egal(H.analyserSaisie('9-10 @CLIENT', ctx({ projets:[ CLIENT_A, { id:'p_client0001', nom:'Client', t:2, a:false } ] })).projet, 'p_client0001', 'exact prioritaire sur le préfixe, casse ignorée');
    egal(H.analyserSaisie('9-10 @eleo', ctx({ projets:[ { id:'p_eleonore01', nom:'Éléonore', t:3, a:false } ] })).projet, 'p_eleonore01', 'accents ignorés');
  });
  test('§15.25 analyserSaisie — formats d’heure et heuristique +12 h', function(){
    function une(t){ var r=H.analyserSaisie(t, ctx()); return r.erreurs.length?codes(r):dfs(r.plagesParJour['2026-10-14']); }
    egal([ une('9h30–12h'), une('930-1200'), une('9-1'), une('9 h 30 à 12 h'), une('0930 → 1200') ], [ ['09:30–12:00'], ['09:30–12:00'], ['09:00–13:00'], ['09:30–12:00'], ['09:30–12:00'] ]);
  });
  test('§15.26 analyserSaisie « 22-2 » traverse minuit', function(){
    var r=H.analyserSaisie('22-2', ctx());
    egal(r.plagesParJour, { '2026-10-14':[ { d:'22:00', f:'24:00' } ], '2026-10-15':[ { d:'00:00', f:'02:00' } ] });
    egal(r.traverseMinuit, true);
  });
  test('§15.27 analyserSaisie — durée seule (aujourd’hui, jour passé, formats)', function(){
    egal(dfs(H.analyserSaisie('2h', ctx()).plagesParJour['2026-10-14']), [ '13:07–15:07' ]);
    egal(dfs(H.analyserSaisie('2h', ctx({ maintenantMin:null, plagesJour:[ { d:'09:00', f:'12:00' } ] })).plagesParJour['2026-10-14']), [ '12:00–14:00' ]);
    egal(dfs(H.analyserSaisie('2h', ctx({ maintenantMin:null })).plagesParJour['2026-10-14']), [ '09:00–11:00' ]);
    egal([ '1h30', '90min', '1,5h', '1.5h', '90 min', '1 h 30' ].map(function(t){ return duree(H.analyserSaisie(t, ctx())); }), [ 90, 90, 90, 90, 90, 90 ]);
    egal(duree(H.analyserSaisie('45m', ctx())), 45);
  });
  test('§15.28 analyserSaisie — erreurs', function(){
    egal(codes(H.analyserSaisie('9', ctx())), [ 'incomplet' ]);
    egal(H.analyserSaisie('9', ctx()).erreurs[0].message, 'Précisez : 9-12 ou 2h');
    egal(codes(H.analyserSaisie('25-26', ctx())), [ 'heure-invalide' ]);
    egal(codes(H.analyserSaisie('9-9', ctx())), [ 'duree-nulle' ]);
    egal(codes(H.analyserSaisie('9-12 10-11', ctx())), [ 'chevauchement' ]);
    var inc=H.analyserSaisie('@inconnu 9-10', ctx());
    egal([ codes(inc), inc.erreurs[0].jeton ], [ [ 'projet-inconnu' ], 'inconnu' ]);
    var amb=H.analyserSaisie('@c 9-10', ctx({ projets:[ CLIENT_A, CONSEIL ] }));
    egal([ codes(amb), amb.erreurs[0].candidats ], [ [ 'projet-ambigu' ], [ 'Client A', 'Conseil' ] ]);
    egal(codes(H.analyserSaisie('0-1 1-2 2-3 3-4 4-5 5-6 6-7 7-8 8-9 9-10 10-11 11-12 12-13', ctx())), [ 'trop-de-plages' ]);
    egal(codes(H.analyserSaisie('20h', ctx({ maintenantMin:600 }))), [ 'debut-negatif' ]);
    egal(codes(H.analyserSaisie('9-10 @x', ctx({ projets:[ { id:'p_xarchive01', nom:'Xénon', t:0, a:true } ] }))), [ 'projet-inconnu' ], 'projet archivé ignoré');
  });
  test('§15.29 analyserSaisie — vide, note brute conservée (texte, jamais HTML)', function(){
    var v=H.analyserSaisie('', ctx());
    egal([ v.plages, v.erreurs ], [ [], [] ]);
    egal(H.analyserSaisie('9-10 <img src=x>', ctx()).note, '<img src=x>');
    egal(H.analyserSaisie('9-10 sprint 3', ctx()).erreurs, [], 'un nombre dans la note n’est pas une erreur si une plage existe');
  });

  /* ---------- CSV ---------- */
  test('§15.30 csv.cellule — échappement et neutralisation des formules', function(){
    var c=TAF.csv.cellule;
    egal([ c('=SUM(A1)'), c('+33'), c('-x'), c('@x'), c('\tx'), c('  =x'), c('\rx'), c('a"b'), c('Réunion'), c(null) ],
      [ '"\'=SUM(A1)"', '"\'+33"', '"\'-x"', '"\'@x"', '"\'\tx"', '"\'  =x"', '"\'\rx"', '"a""b"', '"Réunion"', '""' ]);
    egal([ TAF.csv.nombre(7.5), TAF.csv.nombre(3.4833), TAF.csv.nombre(-2), TAF.csv.nombre(0) ], [ '7,5', '3,48', '0', '0' ]);
  });
  test('§15.31 csv.construire — BOM, « ; », CRLF ; cellules non sûres échappées', function(){
    var s=TAF.csv.construire([ ['A','B'], ['c','d'] ]);
    egal(s, '﻿A;B\r\nc;d\r\n');
    egal(s.charCodeAt(0), 0xFEFF);
    egal(TAF.csv.construire([ [ 'Date', '14/10/2026', 3.48, TAF.csv.cellule('Client A'), '=1+1', 'a;b' ] ]), '﻿Date;14/10/2026;3,48;"Client A";"\'=1+1";"a;b"\r\n');
  });

  /* ---------- Validation des données ---------- */
  var MAINTENANT=new Date(2026, 9, 14, 12, 0).getTime();
  function v(o){ return H.valider(o, { maintenant:MAINTENANT }); }
  test('§15.32 valider — pollution de prototype impossible', function(){
    var r=v(JSON.parse('{"__proto__":{"pollue":1},"v":1,"jours":{"__proto__":[{"d":"09:00","f":"10:00"}]}}'));
    egal(({}).pollue, undefined);
    egal(Object.getPrototypeOf(r.donnees.jours), null, 'dictionnaire sans prototype');
    egal(r.donnees.jours.pollue, undefined);
    egal(Object.keys(r.donnees.jours), []);
  });
  test('§15.33 valider — clés de jour rejetées, ignores = 3', function(){
    var r=v(JSON.parse('{"v":1,"jours":{"2026-02-30":[{"d":"09:00","f":"10:00"}],"__proto__":[{"d":"09:00","f":"10:00"}],"constructor":[{"d":"09:00","f":"10:00"}],"2026-10-14":[{"d":"09:00","f":"10:00"}]}}'));
    egal([ Object.keys(r.donnees.jours), r.rapport.ignores, r.rapport.statut ], [ [ '2026-10-14' ], 3, 'partiel' ]);
  });
  test('§15.34 valider — heures, références, longueurs, teinte', function(){
    var r=v({ v:1, projets:[ { id:'p_aaaaaaaaaa', nom:'N'.repeat(60), t:9, a:'oui' } ],
      jours:{ '2026-10-14':[ { d:'24:00', f:'24:00' }, { id:'h_aaaaaaaaaa', d:'22:00', f:'24:00', p:'p_inconnu00', n:'x'.repeat(300), o:'c', s:'s_aaaaaaaaaa' }, { d:'08:00', f:'09:00', p:'p_aaaaaaaaaa', o:'z' } ] } });
    var j=r.donnees.jours['2026-10-14'];
    egal(dfs(j), [ '08:00–09:00 p_aaaaaaaaaa', '22:00–24:00' ], 'd « 24:00 » rejeté, f « 24:00 » accepté');
    egal([ j[1].p, j[1].n.length, j[1].s, j[0].o ], [ '', 200, 's_aaaaaaaaaa', 's' ]);
    egal(r.donnees.projets, [ { id:'p_aaaaaaaaaa', nom:'N'.repeat(40), t:0, a:false } ]);
    egal(r.rapport.ignores, 1);
  });
  test('§15.35 valider — chrono, version future, illisible, 48 plages', function(){
    var s='s_aaaaaaaaaa';
    egal(v({ v:1, chrono:{ e:'marche', t0:'abc', s:s } }).donnees.chrono, null);
    egal(v({ v:1, chrono:{ e:'marche', t0:MAINTENANT+2*86400000, s:s } }).donnees.chrono, null);
    egal(v({ v:1, chrono:{ e:'marche', t0:MAINTENANT-3600000, tp:null, p:'', n:'', s:s } }).donnees.chrono, { e:'marche', t0:MAINTENANT-3600000, tp:null, p:'', n:'', s:s });
    egal(v({ v:1, chrono:{ e:'pause', t0:MAINTENANT, tp:MAINTENANT, s:s } }).donnees.chrono, null, 'pause : t0 doit être nul');
    egal(v({ v:2 }).rapport.statut, 'futur');
    egal(H.valider('{pas du json').rapport.statut, 'illisible');
    egal([ v([]).rapport.statut, v({}).rapport.statut, v({ v:'1' }).rapport.statut, v(null).rapport.statut ], [ 'illisible', 'illisible', 'illisible', 'vide' ]);
    var plages=[]; for(var i=0;i<49;i++) plages.push({ d:H.versHHMM(i*20), f:H.versHHMM(i*20+10) });
    var r=v({ v:1, jours:{ '2026-10-14':plages } });
    egal(r.donnees.jours['2026-10-14'].length, 48); vrai(r.rapport.ignores>=1, 'ignores ≥ 1');
  });
  test('valider — reconstruction complète (réglages, méta, ids dupliqués régénérés)', function(){
    var r=v({ v:1, rev:7, reglages:{ objHebdoMin:2110, dureeJourMin:480, coupure:'20:00', seuilDemiMin:500, arrondiMin:15, joursOuvres:[5,1,1,9], journeeType:[ { d:'09:00', f:'12:00' }, { d:'11:00', f:'13:00' } ] },
      meta:{ creeLe:'2026-01-01', accueilVu:true, derniereSauvegarde:'x' },
      jours:{ '2026-10-13':[ { id:'h_doublon001', d:'09:00', f:'10:00' } ], '2026-10-14':[ { id:'h_doublon001', d:'09:00', f:'10:00' } ] } });
    var g=r.donnees.reglages;
    egal([ g.objHebdoMin, g.dureeJourMin, g.coupure, g.seuilDemiMin, g.arrondiMin, g.joursOuvres, dfs(g.journeeType) ], [ 2100, 480, '13:00', null, 15, [1,5], [ '09:00–12:00' ] ]);
    egal(r.donnees.meta, { creeLe:'2026-01-01', derniereSauvegarde:null, accueilVu:true });
    egal(r.donnees.rev, 7);
    egal(r.donnees.jours['2026-10-13'][0].id, 'h_doublon001', 'premier conservé');
    vrai(/^h_[a-z0-9]{10}$/.test(r.donnees.jours['2026-10-14'][0].id) && r.donnees.jours['2026-10-14'][0].id!=='h_doublon001', 'id dupliqué régénéré');
    egal(Object.keys(H.reglagesDefaut()).length, 19);
  });
  test('saisieRapide — défaut false, rétrocompatible (absent → false), booléen validé', function(){
    egal(H.reglagesDefaut().saisieRapide, false);
    egal(H.validerReglages({}).saisieRapide, false, 'anciennes données sans le champ');
    egal(H.validerReglages({ saisieRapide:true }).saisieRapide, true);
    var r=v({ v:1, reglages:{ saisieRapide:'oui' } });
    egal([ r.donnees.reglages.saisieRapide, r.rapport.statut ], [ false, 'partiel' ], 'valeur non booléenne ignorée');
  });

  /* ---------- Balance d'heures (§6.12) — 2026-10-14 est un mercredi ---------- */
  var SOIR=new Date(2026, 9, 14, 18, 0).getTime();
  function bal(jours, reglages, vivants, now){ return H.balance({ jours:jours, reglages:reglages||{} }, now||SOIR, vivants); }
  var J_7H=[ { d:'09:00', f:'12:30' }, { d:'13:30', f:'17:00' } ];
  test('balance — jours saisis comptés, jours sans saisie ignorés (congé ≠ négatif)', function(){
    egal(bal({ '2026-10-12':J_7H, '2026-10-13':[ { d:'09:00', f:'17:00' } ] }), { min:60, jours:2 }, 'lundi 7 h (0) + mardi 8 h (+1 h)');
    egal(bal({ '2026-10-08':[ { d:'09:00', f:'12:00' } ] }), { min:-240, jours:1 }, 'jeudi passé 3 h : −4 h');
    egal(bal({}), { min:0, jours:0 }, 'aucune saisie : à jour');
    egal(bal({ '2026-10-09':[] }), { min:0, jours:0 }, 'jour vide ignoré');
    egal(H.balance(null, SOIR), { min:0, jours:0 });
  });
  test('balance — week-end travaillé = heures sup ; durée et jours ouvrés paramétrables', function(){
    egal(bal({ '2026-10-10':[ { d:'10:00', f:'12:00' } ] }), { min:120, jours:1 }, 'samedi');
    egal(bal({ '2026-10-09':J_7H }, { objHebdoMin:0, dureeJourMin:480 }), { min:-60, jours:1 }, 'sans objectif hebdo : repli sur la journée de 8 h');
    egal(bal({ '2026-10-09':J_7H }, { dureeJourMin:480 }), { min:0, jours:1 }, 'objectif 35 h / 5 j prioritaire sur la durée d’une journée');
    egal(bal({ '2026-10-09':J_7H }, { joursOuvres:[1,2,3,4] }), { min:420, jours:1 }, 'vendredi non ouvré');
  });
  test('balance — jour courant : négatif ignoré tant qu’il n’est pas fini, positif compté', function(){
    egal(bal({ '2026-10-14':[ { d:'09:00', f:'12:00' } ] }), { min:0, jours:1 }, '3 h aujourd’hui : 0, pas −4 h');
    egal(bal({ '2026-10-14':[ { d:'09:00', f:'18:00' } ] }), { min:120, jours:1 }, '9 h aujourd’hui : +2 h');
    egal(bal({ '2026-10-14':[ { d:'09:00', f:'12:00' } ] }, null, null, new Date(2026, 9, 15, 8, 0).getTime()), { min:-240, jours:1 }, 'le lendemain : −4 h');
  });
  test('balance — segment du chrono en cours compté (union, sans double compte)', function(){
    egal(bal({ '2026-10-14':[ { d:'09:00', f:'12:00' } ] }, null, { '2026-10-14':[ { d:'13:00', f:'18:00' } ] }), { min:60, jours:1 });
    egal(bal({ '2026-10-14':[ { d:'09:00', f:'12:00' } ] }, null, { '2026-10-14':[ { d:'11:00', f:'18:00' } ] }), { min:120, jours:1 }, 'chevauchement compté une fois');
    egal(bal({}, null, { '2026-10-14':[ { d:'08:00', f:'18:00' } ] }), { min:180, jours:1 }, 'jour sans plage stockée');
  });
  test('duJour — contrat réel / jours ouvrés (minutes exactes), repli, 0 hors jours ouvrés', function(){
    egal([ H.duJour({}, '2026-10-14'), H.duJour({}, '2026-10-10'), H.duJour({}, 6), H.duJour({}, '2026-02-30') ], [ 420, 0, 0, 0 ]);
    egal(H.duJour({ objHebdoMin:2340 }, '2026-10-12'), 468, '39 h sur 5 jours : 7 h 48');
    egal(H.duJour({ objHebdoMin:0, dureeJourMin:480 }, 3), 480, 'objectif 0 : durée d’une journée');
    egal(H.duJour({ objHebdoMin:2115, joursOuvres:[1,2,3,4] }, 1), 528.75, 'aucun pas de 15 min imposé');
  });
  var J_748=[ { d:'09:00', f:'12:30' }, { d:'13:30', f:'17:48' } ];
  test('balance — contrat de 39 h sur 5 jours : semaine faite = à jour (plus de dérive)', function(){
    var sem={ '2026-10-05':J_748, '2026-10-06':J_748, '2026-10-07':J_748, '2026-10-08':J_748, '2026-10-09':J_748 };
    egal(bal(sem, { objHebdoMin:2340 }), { min:0, jours:5 });
    egal(bal(sem), { min:240, jours:5 }, 'contrat 35 h : + 48 min par jour');
    egal(bal({ '2026-10-09':[ { d:'09:00', f:'17:00' } ] }, { objHebdoMin:2340 }), { min:12, jours:1 });
  });
  test('balance — date de départ (balanceDepuis) : jours antérieurs ignorés, jour inclus', function(){
    var j={ '2026-10-08':[ { d:'09:00', f:'12:00' } ], '2026-10-13':[ { d:'09:00', f:'17:00' } ] };
    egal(bal(j), { min:-180, jours:2 });
    egal(bal(j, { balanceDepuis:'2026-10-13' }), { min:60, jours:1 });
    egal(bal(j, { balanceDepuis:'2026-10-14' }), { min:0, jours:0 }, 'remise à zéro aujourd’hui');
    egal(bal(j, { balanceDepuis:'2026-02-30' }), { min:-180, jours:2 }, 'date invalide : ignorée (depuis le début)');
  });
  test('balanceDepuis — défaut null, AAAA-MM-JJ validée (regex + date réelle), rétrocompatible', function(){
    egal(H.reglagesDefaut().balanceDepuis, null);
    egal([ H.validerReglages({}).balanceDepuis, H.validerReglages({ balanceDepuis:'2026-10-13' }).balanceDepuis ], [ null, '2026-10-13' ]);
    egal([ '2026-02-30', '2026-13-01', '26-10-13', '__proto__', 20261013, '2026-10-13T00:00' ].map(function(x){ return H.validerReglages({ balanceDepuis:x }).balanceDepuis; }), [ null, null, null, null, null, null ]);
    egal(v({ v:1, reglages:{ balanceDepuis:'2026-02-30' } }).rapport.statut, 'partiel');
    egal(H.validerReglages({ secondes:false }).secondes, undefined, 'ancien réglage « secondes » : ignoré sans bruit');
    egal(v({ v:1, reglages:{ secondes:true } }).rapport.statut, 'ok');
  });
  function balR(jours, recup, reglages, now){ return H.balance({ jours:jours, recup:recup, reglages:reglages||{} }, now||SOIR); }
  test('balance — jour de récupération sans plage : − dû (solde les heures sup)', function(){
    var j={ '2026-10-12':[ { d:'09:00', f:'20:00' } ] };
    egal(balR(j, []), { min:240, jours:1 });
    egal(balR(j, [ '2026-10-13' ]), { min:-180, jours:2 }, 'lundi + 4 h, mardi récupéré − 7 h');
    egal(balR(j, [ '2026-10-12' ]), { min:240, jours:1 }, 'récupération avec plages : comptée normalement');
    egal(balR({}, [ '2026-10-14' ]), { min:-420, jours:1 }, 'aujourd’hui en récupération : compté tout de suite');
    egal(balR({ '2026-10-14':[ { d:'08:00', f:'08:30' } ] }, [ '2026-10-14' ]), { min:-390, jours:1 }, 'aujourd’hui en récupération AVEC une courte plage : compté normalement, tout de suite (pas de max(0, …))');
    egal(H.balance({ jours:{}, recup:[ '2026-10-14' ], reglages:{} }, SOIR, { '2026-10-14':[ { d:'08:00', f:'09:00' } ] }), { min:-360, jours:1 }, 'idem avec le segment du chrono en cours');
    egal(balR({}, [ '2026-10-16', '2026-10-10' ]), { min:0, jours:0 }, 'futur et week-end : sans effet');
    egal(balR({}, [ '2026-10-13' ], { objHebdoMin:2340 }), { min:-468, jours:1 }, 'contrat 39 h');
    egal(balR({}, [ '2026-10-08', '2026-10-13' ], { balanceDepuis:'2026-10-13' }), { min:-420, jours:1 }, 'avant la date de départ : ignoré');
    egal(H.balance({ jours:{}, reglages:{} }, SOIR), { min:0, jours:0 }, 'recup absent (anciennes données)');
  });
  test('validerRecup — clés AAAA-MM-JJ réelles, sans doublon, triées, bornées à 1000', function(){
    egal(H.validerRecup([ '2026-10-13', '2026-10-13', '2026-02-30', '__proto__', 5, '2026-10-01' ]), { liste:[ '2026-10-01', '2026-10-13' ], ignores:3 });
    egal([ H.validerRecup(undefined), H.validerRecup(null), H.validerRecup('2026-10-13'), H.validerRecup({ 0:'2026-10-13' }) ],
      [ { liste:[], ignores:0 }, { liste:[], ignores:0 }, { liste:[], ignores:1 }, { liste:[], ignores:1 } ]);
    var l=[], k='2020-01-01';
    for(var i=0;i<1005;i++){ l.push(k); k=D.ajouterJours(k, 1); }
    var r=H.validerRecup(l.slice().reverse());
    egal([ r.liste.length, r.ignores, r.liste[0], r.liste[999] ], [ 1000, 5, l[5], l[1004] ], 'les 1000 plus récentes');
    egal(H.LIMITES.recup, 1000);
  });
  test('valider — recup : rétrocompatible (absent → []), filtré, rapport partiel', function(){
    egal([ v({ v:1 }).donnees.recup, v({ v:1 }).rapport.statut ], [ [], 'ok' ]);
    var r=v({ v:1, recup:[ '2026-10-13', 'x', '2026-10-12' ] });
    egal([ r.donnees.recup, r.rapport.statut ], [ [ '2026-10-12', '2026-10-13' ], 'partiel' ]);
    egal(v({ v:1, recup:'oui' }).donnees.recup, []);
  });
  test('balance — jours futurs ignorés, clés invalides ignorées', function(){
    egal(bal({ '2026-10-15':[ { d:'09:00', f:'17:00' } ], '2026-10-20':J_7H }), { min:0, jours:0 });
    egal(bal(JSON.parse('{"2026-02-30":[{"d":"09:00","f":"17:00"}],"__proto__":[{"d":"09:00","f":"17:00"}]}')), { min:0, jours:0 });
  });

  /* ---------- Journée avec pause (§6.13) ---------- */
  function pz(r){ return r.erreur?r.erreur.code:dfs(r.plages); }
  test('decouperPause — 09:00 → 17:00 avec 1 h : centrée sur la coupure (13:00)', function(){
    var r=H.decouperPause('09:00', '17:00', 60, null, '13:00');
    egal(pz(r), [ '09:00–12:30', '13:30–17:00' ]);
    egal([ r.debutPause, r.erreur ], [ 750, null ]);
    egal(pz(H.decouperPause(540, 1020, 45, null, '13:00')), [ '09:00–12:40', '13:25–17:00' ], '45 min : multiple de 5 au plus près');
    egal(pz(H.decouperPause(540, 1020, 60, null, '12:00')), [ '09:00–11:30', '12:30–17:00' ], 'coupure paramétrée');
  });
  test('decouperPause — coupure hors plage (ou sans la place) : milieu de la plage', function(){
    egal(pz(H.decouperPause('14:00', '18:00', 30, null, '13:00')), [ '14:00–15:45', '16:15–18:00' ]);
    egal(pz(H.decouperPause('12:00', '13:30', 60, null, '13:00')), [ '12:00–12:15', '13:15–13:30' ], 'pause de 1 h sur 13:00 déborderait');
    egal(pz(H.decouperPause('20:00', '24:00', 30, null, '13:00')), [ '20:00–21:45', '22:15–24:00' ], 'jusqu’à minuit');
  });
  test('decouperPause — début fourni, sans pause', function(){
    egal(pz(H.decouperPause('09:00', '17:00', 60, '12:00', '13:00')), [ '09:00–12:00', '13:00–17:00' ]);
    egal(pz(H.decouperPause('09:00', '17:00', 60, 600, '13:00')), [ '09:00–10:00', '11:00–17:00' ], 'en minutes');
    var r=H.decouperPause('09:00', '17:00', 0, null, '13:00');
    egal([ pz(r), r.debutPause ], [ [ '09:00–17:00' ], null ]);
  });
  test('decouperPause — erreurs (durée, hors plage, invalide)', function(){
    egal([ pz(H.decouperPause('09:00', '17:00', 479, null)), pz(H.decouperPause('09:00', '17:00', 480, null)) ], [ 'pause-trop-longue', 'pause-trop-longue' ]);
    egal(pz(H.decouperPause('09:00', '17:00', 478, null, '13:00')), [ '09:00–09:01', '16:59–17:00' ],'limite : 1 min de chaque côté');
    egal([ pz(H.decouperPause('09:00', '17:00', 60, '16:30')), pz(H.decouperPause('09:00', '17:00', 60, '09:00')), pz(H.decouperPause('09:00', '17:00', 60, '08:00')) ], [ 'pause-hors-plage', 'pause-hors-plage', 'pause-hors-plage' ]);
    egal([ pz(H.decouperPause('09:00', '17:00', -5, null)), pz(H.decouperPause('09:00', '17:00', 1.5, null)), pz(H.decouperPause('09:00', '17:00', '60', null)) ], [ 'pause-invalide', 'pause-invalide', 'pause-invalide' ]);
    egal([ pz(H.decouperPause('17:00', '09:00', 60, null)), pz(H.decouperPause('x', '17:00', 60, null)), pz(H.decouperPause('09:00', '17:00', 60, '25:00')) ], [ 'plage-invalide', 'plage-invalide', 'pause-debut-invalide' ]);
  });
  /* insererAvecPause : « la plus récente gagne » sur l'enveloppe, puis les deux morceaux. */
  function morceaux(d, f, p){ return H.decouperPause(d, f, p, null, '13:00').plages; }
  function dansPause(plages, a, b){ return plages.some(function(x){ return H.minutes(x.d)<H.minutes(b) && H.minutes(x.f)>H.minutes(a); }); }
  test('insererAvecPause — plage existante 09:00–17:00 puis 09:00–17:00 avec 1 h de pause : 7 h', function(){
    var r=H.insererAvecPause([ { id:'h_exist00001', d:'09:00', f:'17:00' } ], { id:'h_nouveau001', d:'09:00', f:'17:00' }, morceaux('09:00', '17:00', 60));
    egal(dfs(r.plages), [ '09:00–12:30', '13:30–17:00' ]);
    egal(H.unionMinutes(r.plages), 420);
    egal(r.rognees.map(function(g){ return g.type; }), [ 'supprimee' ], 'une seule description (enveloppe)');
    egal(r.plages[0].id, 'h_nouveau001');
    vrai(/^h_[a-z0-9]{10}$/.test(r.plages[1].id) && r.plages[1].id!=='h_nouveau001', 'id neuf pour le 2e morceau');
  });
  test('insererAvecPause — existant 10:00–16:00 : 7 h, rien dans la pause ; 08:00–18:00 : scindée', function(){
    var r=H.insererAvecPause([ { id:'h_exist00001', d:'10:00', f:'16:00' } ], { d:'09:00', f:'17:00' }, morceaux('09:00', '17:00', 60));
    egal([ H.unionMinutes(r.plages), dansPause(r.plages, '12:30', '13:30') ], [ 420, false ]);
    var s=H.insererAvecPause([ { id:'h_exist00001', d:'08:00', f:'18:00' } ], { d:'09:00', f:'17:00' }, morceaux('09:00', '17:00', 60));
    egal(dfs(s.plages), [ '08:00–09:00', '09:00–12:30', '13:30–17:00', '17:00–18:00' ]);
    egal([ H.unionMinutes(s.plages), s.rognees.length, s.rognees[0].type ], [ 540, 1, 'scindee' ]);
  });
  test('insererAvecPause — un morceau hors enveloppe : repli sur insererPlage (contrat documenté)', function(){
    var ex=[ { id:'h_exist00001', d:'09:00', f:'17:00' } ], n={ id:'h_nouveau001', d:'09:00', f:'17:00' };
    var r=H.insererAvecPause(ex, n, [ { d:'09:00', f:'12:30' }, { d:'13:30', f:'18:00' } ]);
    egal(dfs(r.plages), dfs(H.insererPlage(ex, n).plages), 'identique à une insertion simple');
    egal(H.unionMinutes(r.plages), 480, 'aucune partie de l’enveloppe perdue');
  });
  test('insererAvecPause — édition d’une plage existante (id et session gardés par le 1er morceau)', function(){
    var jour=[ { id:'h_a000000001', d:'09:00', f:'17:00', s:'s_sessiona01' }, { id:'h_b000000001', d:'17:00', f:'18:00' } ];
    var r=H.insererAvecPause(jour, { id:'h_a000000001', d:'09:00', f:'17:00', s:'s_sessiona01' }, morceaux('09:00', '17:00', 60));
    egal(dfs(r.plages), [ '09:00–12:30', '13:30–17:00', '17:00–18:00' ]);
    egal([ H.unionMinutes(r.plages), r.rognees.length, r.plages[0].id, r.plages[0].s, r.plages[1].s, r.plages[2].id ], [ 480, 0, 'h_a000000001', 's_sessiona01', undefined, 'h_b000000001' ]);
    vrai(r.plages[1].id!=='h_a000000001', '2e morceau : id neuf');
  });
  test('insererAvecPause — sans morceaux (ou hors enveloppe) : identique à insererPlage', function(){
    var base=[ { id:'h_exist00001', d:'09:00', f:'12:00' } ], n={ id:'h_nouveau001', d:'11:00', f:'13:00' };
    egal(dfs(H.insererAvecPause(base, n, []).plages), dfs(H.insererPlage(base, n).plages));
    egal(dfs(H.insererAvecPause(base, n, [ { d:'08:00', f:'09:00' } ]).plages), [ '09:00–11:00', '11:00–13:00' ]);
  });
  test('lire — lecture seule validée (stockage simulé), jamais d’écriture', function(){
    var mem=TAF.creerMemoire(), st=TAF.creerStockage(mem);
    egal(H.lire(st), { donnees:null, rapport:{ statut:'vide', ignores:0, details:[] } });
    mem.setItem('taf_heures_v1', JSON.stringify({ v:1, jours:{ '2026-10-14':[ { d:'09:00', f:'10:00' } ] } }));
    var avant=mem.ecritures, r=H.lire(st);
    egal([ r.rapport.statut, Object.keys(r.donnees.jours) ], [ 'ok', [ '2026-10-14' ] ]);
    egal(mem.ecritures, avant, 'aucune écriture');
    mem.setItem('taf_heures_v1', 'corrompu');
    egal(H.lire(st).rapport.statut, 'illisible');
  });

  /* ---------- Pont CRA ---------- */
  test('§15.36 planifierImport — compléter (coche ajoutée, activité vide remplie)', function(){
    var p=H.planifierImport({ 3:{ am:true, pm:false, act:'' } }, { 3:{ am:true, pm:true, activite:'Client A' } }, 'completer', true);
    egal(p.changements, [ { jour:3, avant:{ am:true, pm:false, act:'' }, apres:{ am:true, pm:true, act:'Client A' } } ]);
    egal(p.synthese, { joursDetectes:1, joursProposes:1, inchanges:0, ajoutes:1, decoches:0 });
  });
  test('§15.37 planifierImport — compléter ne décoche jamais, garde l’activité', function(){
    var p=H.planifierImport({ 3:{ am:true, pm:true, act:'X' } }, { 3:{ am:true, pm:false, activite:'Client A' } }, 'completer', true);
    egal([ p.changements, p.synthese.inchanges ], [ [], 1 ]);
  });
  test('§15.38 planifierImport — remplacer décoche (synthese.decoches = 2)', function(){
    var p=H.planifierImport({ 3:{ am:true, pm:true, act:'X' } }, {}, 'remplacer', true);
    egal(p.changements, [ { jour:3, avant:{ am:true, pm:true, act:'X' }, apres:{ am:false, pm:false, act:'X' } } ]);
    egal(p.synthese.decoches, 2);
  });
  test('§15.39 activiteJour — dédoublonnée, ordre d’apparition, tronquée', function(){
    var projets=[ { id:'p_a', nom:'A' }, { id:'p_b', nom:'B' } ];
    egal(H.activiteJour([ { d:'09:00', f:'10:00', p:'p_a', n:'r' }, { d:'10:00', f:'11:00', p:'p_b', n:'' }, { d:'11:00', f:'12:00', p:'p_a', n:'r' } ], projets), 'A · B · r');
    var long=H.activiteJour([ { d:'09:00', f:'10:00', n:'x'.repeat(300) } ], [], 200);
    egal([ long.length, long.slice(-1) ], [ 200, '…' ]);
  });
  test('§15.40 hash du pont (#heures-AAAA-MM) — fonction, pas de RegExp exposée', function(){
    egal(H.lireHashCra('#heures-2026-10'), { annee:2026, mois0:9 });
    egal([ H.lireHashCra('#heures-2026-13'), H.lireHashCra('#heures-2026-10&x'), H.lireHashCra('#heures-26-10'), H.lireHashCra(null) ], [ null, null, null, null ]);
    egal([ H.hashCra(2026, 9), H.hashCra(2026, 12) ], [ '#heures-2026-10', '' ]);
    egal(H.RE_HASH_CRA, undefined);
  });
  test('§15.41 resumeMois — seuls les jours du mois ayant des plages', function(){
    var donnees=v({ v:1, projets:[ CLIENT_A ], jours:{ '2026-10-14':[ { d:'09:00', f:'12:30', p:'p_clienta001' }, { d:'13:30', f:'17:00', n:'revue' } ], '2026-10-15':[ { d:'14:00', f:'16:00' } ], '2026-11-01':[ { d:'09:00', f:'17:00' } ] } }).donnees;
    var r=H.resumeMois(donnees, 2026, 9);
    egal(Object.keys(r), [ '14', '15' ]);
    egal(r[14], { min:420, minAm:210, minPm:210, am:true, pm:true, activite:'Client A · revue' });
    egal([ r[15].am, r[15].pm ], [ false, true ]);
    egal(H.resumeMois(null, 2026, 9), {});
  });

  /* ---------- Identifiants ---------- */
  test('analyserSaisie — durée de plus de 24 h sur un jour passé : erreur, jamais rabotée', function(){
    var r=H.analyserSaisie('9999m', ctx({ maintenantMin:undefined, cleJour:'2026-10-01' }));
    egal(r.erreurs.map(function(e){ return e.code; }), [ 'duree-24h' ]);
    egal(r.plages.length, 0, 'aucune plage');
  });
  test('seuilAuto — formule unique, reprise par seuilDemi', function(){
    egal([ H.seuilAuto(420), H.seuilAuto(480) ], [ 105, 120 ]);
    egal(H.seuilDemi({ dureeJourMin:420 }), H.seuilAuto(420));
  });
  test('§15.42 id — format et unicité sur 1000 tirages', function(){
    var vus={};
    for(var i=0;i<1000;i++){ var id=TAF.id('h'); vrai(/^h_[a-z0-9]{10}$/.test(id), id); vrai(!vus[id], 'doublon '+id); vus[id]=1; }
  });
})();
