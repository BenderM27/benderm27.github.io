/* ============================================================================
   TAF — NOYAU PARTAGÉ (assets/taf.js)

   Script CLASSIQUE (pas de module ES : ils échouent en file://), chargé en
   PREMIER, avec defer, par chaque page. Aucune dépendance, aucun appel
   réseau, aucun puits HTML (CSP Trusted Types 'none'). Expose un unique
   global gelé et non réassignable : window.TAF (tous ses espaces de noms
   sont gelés ; aucune RegExp n'est exposée : on expose des FONCTIONS).

   Initialisation automatique UNIQUEMENT sur une page de module
   (<body data-module="…">) : migration/lecture de l'apparence, section
   « Apparence » du tiroir, navigation (+ pastille « en cours »), tiroir.
   La page de tests (sans data-module) n'initialise rien et ne touche
   jamais au localStorage réel.

   Une seule fonction par besoin : les deux modules (CRA, Heures) utilisent
   les mêmes règles, formats, accès stockage, témoin, toasts et modales.

   ── API PUBLIQUE (window.TAF) ───────────────────────────────────────────
   Constantes
     TITRE                       'TAF' — titre fixe de toutes les pages
     CLES                        {prefs, cra, profils, heures} — clés localStorage
     ACCENT_DEFAUT               '#E2A400'
     SWATCHES                    [8 × '#rrggbb'] — accents proposés
     MARQUES                     ['hex','drop','doc','spark','bolt','leaf']
     MOIS, JOURS_LONGS, JOURS_COURTS   libellés fr-FR (dimanche = index 0)
     (La liste des modules n'existe QU'UNE fois : la navigation statique du
      HTML — aucun décalage de mise en page ; TAF.nav l'enrichit seulement.)

   Validation — fonctions PURES (toute donnée lue est non fiable)
     valide.jour(k) / valide.mois(k) / valide.heure(s) / valide.hex(s) → bool
                                 clé de jour CRA 1–31, clé d'archive AAAA-MM,
                                 'HH:MM' 00:00–23:59, couleur #rgb / #rrggbb
     objetSimple(v) → bool       objet non nul, non tableau
     cleSure(k) → bool           ≠ __proto__ / constructor / prototype
     texteBorne(v, max?) → string
     accentValide(v) → '#…'      sinon ACCENT_DEFAUT
     markValide(id) → id         sinon 'hex'
     estImageDataUrl(v, max?) → bool   data:image/<bitmap|svg>; (< max caractères)
     sigValide(s) → {left, right}
     validerPrefs(o) → {accent, mark, logo, motif}

   Stockage sûr (lecture et écriture séparées, jamais d'exception)
     stockage.lisible() → bool              le localStorage peut être LU
     stockage.disponible() → bool           une écriture réussit (sonde)
     stockage.lire(cle, defaut) → JSON parsé | defaut
     stockage.lireTexte(cle) → string | null
     stockage.ecrire(cle, valeur) → bool    (JSON.stringify)
     stockage.ecrireTexte(cle, texte) → bool
     stockage.supprimer(cle) → bool
     creerStockage(backend, {apresEcriture}?) → même interface sur
                                 {getItem,setItem,removeItem} (ou fonction qui le renvoie)
     creerMemoire() → backend mémoire (tests) : .ecritures, .cles(),
                                 .limiter(n) = quota TOTAL simulé (clés + valeurs)
     creerSauvegarde(cle, fournirEtat, options?) → {bientot(), maintenant() → bool,
                                 vider() → bool|null, annuler(), enAttente() → bool}
                                 écriture JSON différée (options.delai, 300 ms),
                                 témoin par écrivain, vidage auto sur pagehide /
                                 visibilitychange:hidden. options : {delai, ecrivain,
                                 stockage, maxCaracteres, temoin:false, apres(ok, raison)}
                                 raison : 'limite' | 'quota' | 'indisponible' | 'serialisation'

   Apparence partagée (clé taf_prefs_v1, écrivain unique : ce fichier)
     extrairePrefsCra(craBrut) → prefs | null          (pure) ancien format
     migrerPrefs(prefsBrutes, craBrut) → {prefs, source, ecrire}   (pure)
     migrerDepuisStockage(st) → {prefs, source, ecrit, enAttente}
     migrationEnAttente() → prefs | null  migration non écrite (quota) : tant
                                 qu'elle est en attente, le CRA réécrit l'apparence
                                 au format d'origine dans cra_app_v3 (rien n'est perdu)
     avecApparenceHeritee(etat, prefs|null) → etat | copie + {accent,mark,logo,motif}  (pure)
     prefs() → copie           definirPrefs(partiel, {differer}?) → bool (écrit ?)
     reinitialiserPrefs() → bool
     surPrefs(fn(prefs, origine)) → désabonnement   origine : 'local' | 'externe' | 'migration'
     appliquerApparence(prefs?)   creerIconeMarque(id) → SVGElement
     construireSectionApparence(conteneur)
     encreSur(couleur | '--jeton', {degrade}?) → '#241a00' | '#ffffff'  (contraste AA)

   Images
     image.LOGO                  {cote:512, cibleOctets:300000, maxCaracteres, fichierMaxOctets}
     image.dimensions(w, h, cote) → {w, h} | null   (pure, jamais d'agrandissement)
     image.octets(dataUrl) → taille binaire estimée  (pure)
     image.reduire(dataUrl, {cote, cibleOctets, maxCaracteres}?) → Promise<dataUrl>
                                 rasterise (neutralise les SVG), PNG ou WebP le plus léger

   Surfaces modales, annonces, retours
     gererModale(panneau, declencheur?, premier?, fermer?) → relacher(rendreFocus?)
     ouvrirTiroir(declencheur?), fermerTiroir()
     glisserPourFermer(poignee, surface, fermer, seuil=80)   feuille basse : glisser la
                                 poignée vers le bas pour refermer (CRA et Heures)
     annoncer(message, region?)
     toast(message, type?) | toast({message, type, action:{libelle, fn}, duree}) → {fermer()}
                                 un seul visible ; compte à rebours en pause au
                                 survol / focus ; action au clavier : bouton ou Alt+U
     temoin.etat(etat, ecrivain?)   'cours'|'ok'|'echec'|'indisponible'|'' (efface)
                                 échec « collant » par écrivain : l'ok d'une clé
                                 n'efface pas l'échec d'une autre
     temoin.synthese(etats) → état affiché (pure)    temoin.etats() → copie
     mouvementReduit() → bool    vibrer(ms=10) → bool (coupé si mouvement réduit)

   DOM sûr (jamais innerHTML)
     el(tag, props?, enfants?)   refuse on*, style, srcdoc, srcset ; URL en liste
                                 blanche : relative, #, ?, blob:, data:image/
     creerSvg(def) → SVGElement  vider(noeud)

   Fichiers (100 % local)
     fichier.telecharger(contenu, nom, type) → bool    Blob + <a download>, URL révoquée
     fichier.lireTexte(file, maxOctets) → Promise<string>
     fichier.lireImage(file, maxOctets) → Promise<dataUrl validé>
     nomFichier(...parties) → nom nettoyé ([^\p{L}\p{N}_-] → _)
     id(prefixe) → prefixe + '_' + 10 × [a-z0-9] (crypto.getRandomValues)
     normaliserTexte(s) → minuscules sans accents

   Formats fr-FR — PURS
     format.nombre(n, dec?) '2,5'   format.eur(n) '1 234,5 €'
     format.dateFr(cle) '14/10/2026' format.dateCourte(cle|Date) 'mar. 14 oct.'
     format.dateLongue(cle|Date, {annee}?) 'mardi 14 octobre'
     format.duree(min) '7 h 30' / '45 min'   format.decimal(min) '7,5'
     format.dureeLongue(min) '3 heures 29 minutes'   format.jours(n) '18,5 j'

   Dates (clés locales 'AAAA-MM-JJ') — PURES
     dates.cle(date|ms) → cle        dates.depuisCle(cle) → Date (midi) | null
     dates.cleValide(cle) → bool (date réelle, 2000–2100)
     dates.lundiDe(cle) → cle        dates.semaineIso(cle) → {annee, semaine}
     dates.ajouterJours(cle, n) → cle
     dates.enTetesSemaine('court'|'long'|'initiale') → 7 libellés, lundi d'abord

   CSV — PURS
     csv.cellule(v) → '"…"' échappée + neutralisée (= + - @ tab CR LF)
     csv.nombre(n) → '7,5'           csv.construire(lignes) → BOM + ';' + CRLF
                                 (toute cellule non sûre y est échappée)

   Heures (règles partagées, cf. docs/heures-spec.md §5–7) — PURES sauf lire()
     heures.CLE, heures.LIMITES, heures.reglagesDefaut(), heures.validerReglages(o, projets?)
     heures.valider(brut, {maintenant}?) → {donnees, rapport:{statut, ignores, details}}
     heures.lire(st?) → {donnees, rapport}     lecture seule, n'écrit jamais
     heures.minutes(hhmm) → 0..1440 | NaN      heures.versHHMM(min) → 'HH:MM'
     heures.arrondir(min, pas, 'proche'|'bas'|'haut')
     heures.unionMinutes(plages)   heures.normaliserJour(plages)
     heures.insererPlage(plagesJour, nouvelle) → {plages, rognees}
     heures.decouperSegment(debut, fin, pas, mode) → {plagesParJour, horlogeReculee, erreur?}
     heures.analyserSaisie(texte, ctx) → {plagesParJour, plages, projet, note, erreurs, traverseMinuit}
     heures.demiJournees(plages, reglages) → {am, pm, minAm, minPm}
     heures.seuilDemi(reglages)  heures.activiteJour(plages, projets, max?)
     heures.resumeMois(donnees, annee, mois0)
     heures.planifierImport(craDays, resume, mode, avecActivite) → {changements, synthese}
     heures.lireHashCra(hash) → {annee, mois0} | null   heures.hashCra(annee, mois0)
     heures.validerChrono(c, projets?, maintenant?) → chrono | null

   Navigation & impression
     moduleActif() → id du module de la page (body[data-module])
     nav.init()  nav.rafraichir()  nav.etatPastille(chrono, maintenant) (pure)
                                 pastille « en cours » de l'onglet Heures, lue en
                                 LECTURE SEULE dans taf_heures_v1 (minute + storage)
     definirNomImpression(fn)    preparerImpression()  (idempotent : titre = nom
                                 du PDF jusqu'à afterprint ou la prochaine interaction)
============================================================================ */
(function(global){
  "use strict";

  var doc=global.document;
  var aPropre=Object.prototype.hasOwnProperty;

  /* ============================================================
     CONSTANTES
  ============================================================ */
  var TITRE='TAF';
  var CLES=Object.freeze({ prefs:'taf_prefs_v1', cra:'cra_app_v3', profils:'cra_profiles_v1', heures:'taf_heures_v1' });
  var ACCENT_DEFAUT='#E2A400';
  var SWATCHES=Object.freeze(['#E2A400','#2563EB','#0EA5A5','#15A66B','#7C5CFC','#EC4899','#E5484D','#334155']);
  var NOMS_SWATCHES={ '#E2A400':'Ambre (défaut)', '#2563EB':'Bleu', '#0EA5A5':'Sarcelle', '#15A66B':'Vert', '#7C5CFC':'Violet', '#EC4899':'Rose', '#E5484D':'Rouge', '#334155':'Ardoise' };
  var MOIS=Object.freeze(['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']);
  var JOURS_LONGS=Object.freeze(['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']);
  var JOURS_COURTS=Object.freeze(['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.']);
  var ORDRE_LUNDI=[1,2,3,4,5,6,0];        // indices getDay() dans l'ordre ISO (lundi d'abord)
  var MODULE_CHRONO='heures';             // module dont l'onglet porte la pastille « en cours »

  /* Expressions régulières PRIVÉES : jamais exposées (une RegExp exposée reste
     mutable via RegExp.prototype.compile, même dans un objet gelé). */
  var RX={
    hex:/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    jourCra:/^([1-9]|[12][0-9]|3[01])$/,
    moisCle:/^\d{4}-(0[1-9]|1[0-2])$/,
    dateCle:/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    heure:/^([01]\d|2[0-3]):[0-5]\d$/,
    imageDataUrl:/^data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp|x-icon|vnd\.microsoft\.icon);/i,
    idPlage:/^h_[a-z0-9]{10}$/,
    idSession:/^s_[a-z0-9]{10}$/,
    idProjet:/^p_[a-z0-9]{10}$/,
    hashCra:/^#heures-(\d{4})-(0[1-9]|1[0-2])$/,
    controle:/[\u0000-\u001F\u007F]/g
  };

  var MAX_IMAGE=5e6;      // dataURL image TOLÉRÉ à la lecture (anciens logos / signatures) ; réduit ensuite
  /* Logo : cible de réduction et plafond COHÉRENTS avec ses copies (taf_prefs_v1 + profils
     d'identité) dans le quota ≈ 5 M caractères de localStorage : 600 000 car. × 8 copies
     ≈ 4,8 M. À l'import, un logo est rasterisé à 512 px max et visé sous 300 Ko. */
  var LOGO=Object.freeze({ cote:512, cibleOctets:300000, maxCaracteres:600000, fichierMaxOctets:10e6 });

  /* Icônes de marque : définitions DÉCLARATIVES (constantes du code), construites
     par createElementNS — aucune chaîne HTML n'est jamais interprétée. */
  var MARKS={
    hex:{ vb:'0 0 28 30', a:{ fill:'none', stroke:'currentColor', 'stroke-width':'1.7', 'stroke-linejoin':'round' },
      p:[ { d:'M14 1.5 26 8.5v13L14 28.5 2 21.5v-13z' }, { d:'M14 8.5 20 12v6.5L14 22l-6-3.5V12z', fill:'currentColor', stroke:'none' } ] },
    drop:{ vb:'0 0 24 24', a:{ fill:'currentColor' }, p:[ { d:'M12 2c4 5 7 8.6 7 12a7 7 0 1 1-14 0c0-3.4 3-7 7-12z' } ] },
    doc:{ vb:'0 0 24 24', a:{ fill:'none', stroke:'currentColor', 'stroke-width':'1.8', 'stroke-linejoin':'round', 'stroke-linecap':'round' },
      p:[ { d:'M6 2h8l4 4v16H6z' }, { d:'M14 2v4h4M9 12h6M9 16h6' } ] },
    spark:{ vb:'0 0 24 24', a:{ fill:'currentColor' }, p:[ { d:'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z' } ] },
    bolt:{ vb:'0 0 24 24', a:{ fill:'currentColor' }, p:[ { d:'M13 2 4 14h6l-1 8 9-12h-6z' } ] },
    leaf:{ vb:'0 0 24 24', a:{ fill:'currentColor' }, p:[ { d:'M5 19c0-9 7-15 15-15 0 9-6 15-15 15z' } ] }
  };
  var MARQUES=Object.freeze(Object.keys(MARKS));
  var NOMS_MARQUES={ hex:'hexagone', drop:'goutte', doc:'document', spark:'étincelle', bolt:'éclair', leaf:'feuille' };

  function pad2(n){ return (n<10?'0':'')+n; }

  /* ============================================================
     VALIDATION — fonctions PURES (toute donnée lue est non fiable)
  ============================================================ */
  var CLES_INTERDITES=['__proto__','constructor','prototype'];
  function enChaine(k){ return (typeof k==='number' && isFinite(k))?String(k):k; }
  var valide=Object.freeze({
    jour:function(k){ k=enChaine(k); return typeof k==='string' && RX.jourCra.test(k); },
    mois:function(k){ return typeof k==='string' && RX.moisCle.test(k); },
    heure:function(s){ return typeof s==='string' && RX.heure.test(s); },
    hex:function(s){ return typeof s==='string' && RX.hex.test(s); }
  });
  function objetSimple(v){ return v!==null && typeof v==='object' && !Array.isArray(v); }
  function cleSure(k){ return typeof k==='string' && k.length>0 && k.length<=64 && CLES_INTERDITES.indexOf(k)===-1; }
  function texteBorne(v, max){
    if(typeof v!=='string') return '';
    var m=(typeof max==='number' && max>0)?max:1000;
    return v.length>m?v.slice(0,m):v;
  }
  function accentValide(v){ return valide.hex(v)?v:ACCENT_DEFAUT; }
  function markValide(id){ return (typeof id==='string' && aPropre.call(MARKS, id))?id:'hex'; }
  // N'accepte QUE data:image/<type>;… (bitmap ou SVG) : un « logo » piégé n'est jamais inséré.
  function estImageDataUrl(v, max){ return typeof v==='string' && v.length<((typeof max==='number' && max>0)?max:MAX_IMAGE) && RX.imageDataUrl.test(v); }
  /* Signature : un canevas 600×220 exporté en PNG pèse quelques dizaines de Ko ; au-delà de
     1 M caractères, c'est une donnée altérée ou hostile (elle bloquerait la sauvegarde du CRA). */
  var MAX_SIGNATURE=1e6;
  function sigValide(s){
    if(!objetSimple(s)) return { left:null, right:null };
    return { left:estImageDataUrl(s.left, MAX_SIGNATURE)?s.left:null, right:estImageDataUrl(s.right, MAX_SIGNATURE)?s.right:null };
  }
  /* PASTILLE TRI-ÉTAT — UNE seule règle pour les deux modules (grille et fiche du CRA,
     aperçu d'import, équivalent CRA de Heures) : forme lisible en niveaux de gris. */
  function etatJour(j){
    var am=!!(j && j.am===true), pm=!!(j && j.pm===true);
    return { st:(am&&pm)?'full':((am||pm)?'half':'empty'), side:(am&&!pm)?'am':((pm&&!am)?'pm':'') };
  }
  function pastilleJour(j, classe){
    var e=etatJour(j);
    return el('span', { class:'pastille-jour'+(classe?' '+classe:''), 'data-state':e.st, 'data-side':e.side, 'aria-hidden':'true' }, [ el('span', { class:'cf-hex' }) ]);
  }
  function validerPrefs(o){
    o=objetSimple(o)?o:{};
    return { accent:accentValide(o.accent), mark:markValide(o.mark), logo:estImageDataUrl(o.logo)?o.logo:null, motif:o.motif!==false };
  }
  // Texte libre lu : caractères de contrôle retirés, rogné, tronqué.
  function texteNettoye(v, max){ return (typeof v==='string')?v.replace(RX.controle,'').trim().slice(0, max):''; }

  /* ============================================================
     DOM SÛR — création d'éléments, jamais d'interprétation HTML
  ============================================================ */
  var NS_SVG='http://www.w3.org/2000/svg';
  var ATTR_INTERDIT=/^(on|style$|srcdoc$|srcset$|formaction$)/i;
  var ATTR_URL=/^(href|src|xlink:href|action|poster|ping|background|cite|data|codebase|manifest)$/i;
  /* Liste BLANCHE de schémas, évaluée après suppression des caractères de contrôle et
     espaces (le parseur d'URL les ignore : « java\tscript: », « \x01javascript: »…). */
  function urlSure(v){
    var s=String(v).replace(/[\u0000- \u007F]+/g, '');
    if(s==='') return true;
    if(/^[\/\\]{2}/.test(s)) return false;                         // //hôte : sortie réseau
    var m=/^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(s);
    if(!m) return true;                                              // relative, #fragment, ?requête
    var schema=m[1].toLowerCase();
    if(schema==='blob') return true;
    if(schema==='data') return /^data:image\/(png|jpe?g|gif|webp|bmp|x-icon|vnd\.microsoft\.icon|svg\+xml)[;,]/i.test(s);
    return false;
  }
  function poserAttribut(e, k, v){
    if(ATTR_INTERDIT.test(k)) throw new Error('TAF : attribut refusé « '+k+' »');
    if(ATTR_URL.test(k) && !urlSure(v)) throw new Error('TAF : URL refusée');
    e.setAttribute(k, v===true?'':String(v));
  }
  function ajouterEnfants(e, enfants){
    if(enfants==null) return;
    if(!Array.isArray(enfants)) enfants=[enfants];
    enfants.forEach(function(c){
      if(c==null||c===false) return;
      e.appendChild((typeof c==='string'||typeof c==='number')?doc.createTextNode(String(c)):c);
    });
  }
  // el('button', {class:'btn', type:'button', text:'OK', 'aria-label':'…'}, [enfants])
  // Les valeurs null / undefined / false sont ignorées ; true pose un attribut booléen.
  function el(tag, props, enfants){
    var e=doc.createElement(tag);
    if(props){
      Object.keys(props).forEach(function(k){
        var v=props[k];
        if(v==null||v===false) return;
        if(k==='text'){ e.textContent=String(v); return; }
        poserAttribut(e, k, v);
      });
    }
    ajouterEnfants(e, enfants);
    return e;
  }
  // def = { vb:'0 0 24 24', a:{attributs du <svg>}, p:[{ t:'path'|'circle'|…, …attributs }] }
  function creerSvg(def){
    var s=doc.createElementNS(NS_SVG, 'svg');
    s.setAttribute('viewBox', def.vb);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    Object.keys(def.a||{}).forEach(function(k){ poserAttribut(s, k, def.a[k]); });
    (def.p||[]).forEach(function(c){
      var n=doc.createElementNS(NS_SVG, c.t||'path');
      Object.keys(c).forEach(function(k){ if(k!=='t') poserAttribut(n, k, c[k]); });
      s.appendChild(n);
    });
    return s;
  }
  function vider(n){ if(n) n.textContent=''; }
  function creerIconeMarque(id){ return creerSvg(MARKS[markValide(id)]); }

  /* ============================================================
     IDENTIFIANTS, TEXTE, NOMS DE FICHIERS
  ============================================================ */
  var ALPHABET_ID='abcdefghijklmnopqrstuvwxyz0123456789';
  function nouvelId(prefixe){
    var out='', c=global.crypto;
    while(out.length<10){
      var octets=new Uint8Array(16);
      if(c && typeof c.getRandomValues==='function') c.getRandomValues(octets);
      else for(var i=0;i<16;i++) octets[i]=Math.floor(Math.random()*256);   // repli : crypto absent
      for(var k=0;k<octets.length && out.length<10;k++){ if(octets[k]<252) out+=ALPHABET_ID[octets[k]%36]; }   // sans biais
    }
    return String(prefixe)+'_'+out;
  }
  function normaliserTexte(s){
    s=String(s==null?'':s);
    try{ s=s.normalize('NFD'); }catch(e){}
    return s.replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  var RX_NOM_FICHIER;
  try{ RX_NOM_FICHIER=new RegExp('[^\\p{L}\\p{N}_-]+', 'gu'); }catch(e){ RX_NOM_FICHIER=/[^\wÀ-ɏ-]+/g; }
  function nomFichier(){
    var parties=Array.prototype.slice.call(arguments).filter(function(p){ return p!=null && p!==''; }).map(String);
    var s=parties.join('_');
    try{ s=s.normalize('NFC'); }catch(e){}
    s=s.replace(RX_NOM_FICHIER, '_').replace(/_+/g, '_').replace(/^[_-]+|[_-]+$/g, '');
    return s.slice(0, 120).replace(/[_-]+$/, '');
  }

  /* ============================================================
     FORMATS fr-FR — purs
  ============================================================ */
  function fmtNombre(n, dec){
    n=Number(n); if(!isFinite(n)) n=0;
    if(Number.isInteger(n)) return String(n);
    var d=(typeof dec==='number' && dec>=0)?dec:1;
    var s=n.toFixed(d);
    if(s.indexOf('.')!==-1) s=s.replace(/\.?0+$/,'');
    if(s==='-0') s='0';
    return s.replace('.',',');
  }
  function fmtEur(n){ return (Number(n)||0).toLocaleString('fr-FR', { style:'currency', currency:'EUR', minimumFractionDigits:0, maximumFractionDigits:2 }); }
  function minutesEntieres(m){ m=Math.round(Number(m)); return (isFinite(m) && m>0)?m:0; }
  function fmtDuree(minutes){
    var m=minutesEntieres(minutes), h=Math.floor(m/60), r=m%60;
    if(!h) return r+' min';
    return h+' h'+(r?' '+pad2(r):'');
  }
  function fmtDecimal(minutes){ return fmtNombre(minutesEntieres(minutes)/60, 2); }
  function fmtDureeLongue(minutes){
    var m=minutesEntieres(minutes), h=Math.floor(m/60), r=m%60, p=[];
    if(h) p.push(h+' heure'+(h>1?'s':''));
    if(r || !h) p.push(r+' minute'+(r>1?'s':''));
    return p.join(' ');
  }
  function fmtJours(n){ return fmtNombre(n, 1)+' j'; }
  function fmtDateFr(cle){ var m=(typeof cle==='string')?RX.dateCle.exec(cle):null; return m?(m[3]+'/'+m[2]+'/'+m[1]):''; }
  function dateDe(x){
    if(x instanceof Date) return isNaN(x.getTime())?null:x;
    var p=partiesCle(x); return p?p.date:null;
  }
  function fmtIntl(d, opts){ try{ return d.toLocaleDateString('fr-FR', opts); }catch(e){ return ''; } }
  function fmtDateCourte(x){
    var d=dateDe(x); if(!d) return '';
    return fmtIntl(d, { weekday:'short', day:'numeric', month:'short' }) || (JOURS_COURTS[d.getDay()].toLowerCase()+' '+d.getDate()+' '+MOIS[d.getMonth()].slice(0,4).toLowerCase()+'.');
  }
  function fmtDateLongue(x, options){
    var d=dateDe(x); if(!d) return '';
    var avecAnnee=!!(options && options.annee);
    return fmtIntl(d, avecAnnee?{ weekday:'long', day:'numeric', month:'long', year:'numeric' }:{ weekday:'long', day:'numeric', month:'long' })
      || (JOURS_LONGS[d.getDay()]+' '+d.getDate()+' '+MOIS[d.getMonth()].toLowerCase()+(avecAnnee?' '+d.getFullYear():''));
  }
  var format=Object.freeze({
    nombre:fmtNombre, eur:fmtEur, dateFr:fmtDateFr, dateCourte:fmtDateCourte, dateLongue:fmtDateLongue,
    duree:fmtDuree, decimal:fmtDecimal, dureeLongue:fmtDureeLongue, jours:fmtJours
  });

  /* ============================================================
     DATES — clés locales 'AAAA-MM-JJ' (purs)
  ============================================================ */
  function cleDate(x){
    var d=(x instanceof Date)?x:new Date(x);
    if(isNaN(d.getTime())) return '';
    var a=String(d.getFullYear()); while(a.length<4) a='0'+a;
    return a+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  }
  function partiesCle(cle){
    var m=(typeof cle==='string')?RX.dateCle.exec(cle):null; if(!m) return null;
    var a=+m[1], mo=+m[2], j=+m[3], d=new Date(a, mo-1, j, 12);
    if(d.getFullYear()!==a || d.getMonth()!==mo-1 || d.getDate()!==j) return null;   // 30 février…
    return { a:a, m:mo, j:j, date:d };
  }
  function cleValide(cle){ var p=partiesCle(cle); return !!p && p.a>=2000 && p.a<=2100; }
  function depuisCle(cle){ var p=partiesCle(cle); return (p && p.a>=2000 && p.a<=2100)?p.date:null; }
  function ajouterJours(cle, n){
    var p=partiesCle(cle); if(!p || !Number.isInteger(n)) return '';
    return cleDate(new Date(p.a, p.m-1, p.j+n, 12));
  }
  function lundiDe(cle){ var p=partiesCle(cle); if(!p) return ''; return ajouterJours(cle, -((p.date.getDay()+6)%7)); }
  function semaineIso(cle){
    var p=partiesCle(cle); if(!p) return null;
    var t=new Date(Date.UTC(p.a, p.m-1, p.j));
    t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7)+3);          // jeudi de la semaine
    var annee=t.getUTCFullYear(), j4=new Date(Date.UTC(annee, 0, 4));
    return { annee:annee, semaine:1+Math.round(((t-j4)/864e5-3+((j4.getUTCDay()+6)%7))/7) };
  }
  function enTetesSemaine(style){
    return ORDRE_LUNDI.map(function(i){
      if(style==='long') return JOURS_LONGS[i];
      if(style==='initiale') return JOURS_LONGS[i].charAt(0).toUpperCase();
      return JOURS_COURTS[i].replace(/\.$/, '');
    });
  }
  var dates=Object.freeze({ cle:cleDate, depuisCle:depuisCle, cleValide:cleValide, lundiDe:lundiDe, semaineIso:semaineIso, ajouterJours:ajouterJours, enTetesSemaine:enTetesSemaine });

  /* ============================================================
     ENCRE LISIBLE (WCAG 1.4.3 / 1.4.11) — pure pour une couleur
        Noir chaud OU blanc selon le MEILLEUR contraste ; par défaut
        mesuré sur tout le dégradé (base + haut éclairci de 16 %,
        comme --accent-top). Accepte '#rgb', '#rrggbb', 'rgb(…)' ou
        un jeton CSS '--p3' (résolu sur :root).
  ============================================================ */
  function canaux(c){
    if(typeof c!=='string') return null;
    c=c.trim();
    if(RX.hex.test(c)){
      var h=c.slice(1); if(h.length===3) h=h.split('').map(function(x){ return x+x; }).join('');
      return [parseInt(h.substr(0,2),16)/255, parseInt(h.substr(2,2),16)/255, parseInt(h.substr(4,2),16)/255];
    }
    var m=/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(c);
    return m?[Math.min(255,+m[1])/255, Math.min(255,+m[2])/255, Math.min(255,+m[3])/255]:null;
  }
  function luminance(v){ function f(x){ return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); } return 0.2126*f(v[0])+0.7152*f(v[1])+0.0722*f(v[2]); }
  function contraste(l1, l2){ return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
  var ENCRE_FONCEE='#241a00';
  function encreSur(couleur, options){
    if(typeof couleur==='string' && couleur.indexOf('--')===0){
      try{ couleur=global.getComputedStyle(doc.documentElement).getPropertyValue(couleur); }catch(e){ couleur=''; }
    }
    var v=canaux(couleur)||canaux(ACCENT_DEFAUT);
    var surfaces=[v];
    if(!(options && options.degrade===false)) surfaces.push([v[0]+(1-v[0])*0.16, v[1]+(1-v[1])*0.16, v[2]+(1-v[2])*0.16]);
    var lFonce=luminance(canaux(ENCRE_FONCEE)), minFonce=Infinity, minClair=Infinity;
    surfaces.forEach(function(s){ var l=luminance(s); minFonce=Math.min(minFonce, contraste(lFonce, l)); minClair=Math.min(minClair, contraste(1, l)); });
    return minFonce>=minClair?ENCRE_FONCEE:'#ffffff';
  }

  /* ============================================================
     STOCKAGE SÛR — lecture et écriture SÉPARÉES (F6) : un quota
     plein (sonde d'écriture en échec) n'empêche jamais de LIRE.
  ============================================================ */
  function creerStockage(backend, options){
    var apres=(options && typeof options.apresEcriture==='function')?options.apresEcriture:null;
    var ecritureOk=null;                      // null : inconnu (re-sondé), true / false
    function b(){ try{ var s=(typeof backend==='function')?backend():backend; return s||null; }catch(e){ return null; } }
    function sonder(){ var s=b(); if(!s) return false; try{ var t='__taf_sonde__'; s.setItem(t,'1'); s.removeItem(t); return true; }catch(e){ return false; } }
    var api={
      lisible:function(){ var s=b(); if(!s) return false; try{ s.getItem('__taf_sonde__'); return true; }catch(e){ return false; } },
      disponible:function(){ if(ecritureOk===null) ecritureOk=sonder(); return ecritureOk; },
      lireTexte:function(cle){ var s=b(); if(!s) return null; try{ var t=s.getItem(String(cle)); return (typeof t==='string')?t:null; }catch(e){ return null; } },
      lire:function(cle, defaut){
        var t=api.lireTexte(cle); if(t==null) return defaut;
        try{ var v=JSON.parse(t); return (v===undefined)?defaut:v; }catch(e){ return defaut; }
      },
      ecrireTexte:function(cle, texte){
        if(typeof texte!=='string') return false;
        var s=b(); if(!s){ ecritureOk=false; return false; }
        try{ s.setItem(String(cle), texte); }catch(e){ ecritureOk=null; return false; }
        ecritureOk=true;
        if(apres){ try{ apres(String(cle)); }catch(e){} }
        return true;
      },
      ecrire:function(cle, valeur){ var t; try{ t=JSON.stringify(valeur); }catch(e){ return false; } return api.ecrireTexte(cle, t); },
      supprimer:function(cle){ var s=b(); if(!s) return false; try{ s.removeItem(String(cle)); return true; }catch(e){ return false; } }
    };
    return Object.freeze(api);
  }
  // Rien n'est lu ni écrit tant qu'aucun module ne le demande (page de tests : jamais).
  var stockage=creerStockage(function(){ return global.localStorage; }, { apresEcriture:function(cle){ apresEcritureReelle(cle); } });
  // Backend mémoire (tests) : même contrat que localStorage, quota TOTAL simulable.
  function creerMemoire(){
    var donnees=Object.create(null), limite=Infinity;
    function total(){ var t=0; for(var k in donnees) t+=k.length+donnees[k].length; return t; }
    var mem={
      ecritures:0,
      getItem:function(k){ k=String(k); return (k in donnees)?donnees[k]:null; },
      setItem:function(k, v){
        k=String(k); v=String(v);
        var futur=total()-((k in donnees)?k.length+donnees[k].length:0)+k.length+v.length;
        if(futur>limite){ var e=new Error('Quota dépassé (simulé)'); e.name='QuotaExceededError'; throw e; }
        donnees[k]=v; mem.ecritures++;
      },
      removeItem:function(k){ delete donnees[String(k)]; },
      cles:function(){ return Object.keys(donnees); },
      limiter:function(n){ limite=n; }
    };
    return mem;
  }

  /* ============================================================
     ANNONCES (aria-live) + TÉMOIN DE SAUVEGARDE + TOASTS
  ============================================================ */
  var pile=[];   // surfaces modales ouvertes, de la plus basse à la plus haute
  var timerAnnonce=null;
  function regionAnnonce(){
    // Avec une surface aria-modal ouverte, certains lecteurs d'écran restreignent l'arbre
    // à son sous-arbre : on annonce dans la région [data-taf-live] de la surface ouverte
    // la plus haute qui en possède une, sinon dans #liveRegion (page).
    for(var i=pile.length-1;i>=0;i--){ var r=pile[i].panneau.querySelector('[data-taf-live]'); if(r) return r; }
    return doc.getElementById('liveRegion');
  }
  function annoncer(msg, region){
    var cible=(region && region.nodeType===1)?region:regionAnnonce(); if(!cible) return;
    cible.textContent='';                       // vider puis réécrire : force la relecture d'un texte identique
    if(timerAnnonce) clearTimeout(timerAnnonce);
    timerAnnonce=setTimeout(function(){ cible.textContent=String(msg); }, 40);
  }

  /* Témoin : un état PAR ÉCRIVAIN (clé). L'affichage est la synthèse ; un échec
     n'est levé que par un succès du MÊME écrivain (F3). */
  var LIB_TEMOIN={ cours:'Enregistrement…', ok:'Enregistré', echec:'Échec — pensez à exporter', indisponible:'Sauvegarde locale indisponible — exportez' };
  var etatsTemoin=Object.create(null), timerTemoin=null, dernierTemoin='';
  function syntheseTemoin(etats){
    var vus={};
    if(etats) Object.keys(etats).forEach(function(k){ vus[etats[k]]=true; });
    if(vus.indisponible) return 'indisponible';
    if(vus.echec) return 'echec';
    if(vus.cours) return 'cours';
    if(vus.ok) return 'ok';
    return '';
  }
  function etatTemoin(etat, ecrivain){
    if(etat==='indispo') etat='indisponible';
    var cle=(typeof ecrivain==='string' && ecrivain)?ecrivain:'_';
    var actuel=etatsTemoin[cle];
    if(!LIB_TEMOIN[etat]) delete etatsTemoin[cle];
    else if(etat==='cours' && (actuel==='echec' || actuel==='indisponible')){ /* échec non résolu : conservé */ }
    else etatsTemoin[cle]=etat;
    rendreTemoin(etat);
  }
  function rendreTemoin(declencheur){
    var s=syntheseTemoin(etatsTemoin);
    var w=doc && doc.getElementById('saveWitness');
    if(timerTemoin){ clearTimeout(timerTemoin); timerTemoin=null; }
    if(!w){ dernierTemoin=s; return; }
    // Visuel discret (pas de région live : pas d'annonce à chaque frappe) ; seuls les
    // passages en échec / indisponible sont annoncés, une fois.
    if(!s || (s==='ok' && declencheur!=='ok')){ w.hidden=true; dernierTemoin=''; return; }
    var txt=LIB_TEMOIN[s], texte=w.querySelector('.sw-text');
    w.classList.remove('is-cours','is-ok','is-warn');
    w.classList.add(s==='cours'?'is-cours':(s==='ok'?'is-ok':'is-warn'));
    if(texte) texte.textContent=txt;
    w.title=txt; w.hidden=false;
    if((s==='echec'||s==='indisponible') && dernierTemoin!==s) annoncer(txt);
    dernierTemoin=s;
    if(s==='ok') timerTemoin=setTimeout(function(){ if(syntheseTemoin(etatsTemoin)==='ok') w.hidden=true; dernierTemoin=''; }, 2200);
  }
  var temoin=Object.freeze({
    etat:etatTemoin,
    synthese:syntheseTemoin,
    etats:function(){ var o={}; Object.keys(etatsTemoin).forEach(function(k){ o[k]=etatsTemoin[k]; }); return o; }
  });

  function mouvementReduit(){ try{ return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } }
  function vibrer(ms){
    if(mouvementReduit()) return false;
    try{
      var n=global.navigator;
      // Sans geste utilisateur préalable, Chrome bloque l'appel ET l'inscrit en erreur console : on s'abstient.
      if(n && n.userActivation && n.userActivation.hasBeenActive===false) return false;
      if(n && typeof n.vibrate==='function') return !!n.vibrate(Math.max(1, Math.min(200, Math.round((typeof ms==='number' && isFinite(ms))?ms:10))));
    }catch(e){}
    return false;
  }

  /* Toast : un seul visible ; le message passe par annoncer() (bonne région même
     sous une modale) ; l'action éventuelle est un vrai bouton (Alt+U), le compte à
     rebours se met en pause au survol et au focus (WCAG 2.2.1). */
  var zoneToasts=null, toastActif=null, actionToastActive=null;
  function toast(arg, type){
    var o=objetSimple(arg)?arg:{ message:arg, type:type };
    var message=String(o.message==null?'':o.message);
    var genre=(o.type==='succes'||o.type==='erreur'||o.type==='info')?o.type:'';
    var action=(objetSimple(o.action) && typeof o.action.fn==='function')
      ? { libelle:texteBorne((typeof o.action.libelle==='string' && o.action.libelle.trim())?o.action.libelle.trim():'Annuler', 40), fn:o.action.fn }
      : null;
    var duree=(typeof o.duree==='number' && isFinite(o.duree))?Math.min(60000, Math.max(1500, o.duree)):(action?8000:(genre==='erreur'?5200:3000));
    annoncer(action?(message+'. '+action.libelle+' : Alt+U.'):message);
    var poignee={ fermer:function(){} };
    if(!doc.body) return poignee;
    if(toastActif) toastActif.fermer(true);
    if(!zoneToasts || !zoneToasts.isConnected){ zoneToasts=el('div', { class:'taf-toasts' }); doc.body.appendChild(zoneToasts); }

    var noeud=el('div', { class:'taf-toast'+(genre?' is-'+genre:'')+(action?' a-action':'') }, [
      el('span', { class:'taf-toast-dot', 'aria-hidden':'true' }),
      el('span', { class:'taf-toast-msg', 'aria-hidden':'true', text:message })
    ]);
    var retour=null, ferme=false, survol=false, focus=false, enPause=false, reste=duree, debut=Date.now(), timer=null;
    function declencher(){ if(ferme || !action) return; var fn=action.fn; fermer(); try{ fn(); }catch(e){} }
    if(action){
      var bouton=el('button', { type:'button', class:'taf-toast-action', text:action.libelle, 'aria-label':action.libelle+' : '+message, 'aria-keyshortcuts':'Alt+U' });
      bouton.addEventListener('focus', function(e){ if(e.relatedTarget && !noeud.contains(e.relatedTarget)) retour=e.relatedTarget; });
      bouton.addEventListener('click', declencher);
      noeud.appendChild(bouton);
    }
    var barre=el('span', { class:'taf-toast-barre', 'aria-hidden':'true' });
    barre.style.setProperty('--taf-toast-duree', duree+'ms');          // CSSOM : autorisé par la CSP
    noeud.appendChild(barre);
    function majPause(){
      var p=survol||focus;
      if(p && !enPause){ enPause=true; if(timer){ clearTimeout(timer); timer=null; } reste-=Date.now()-debut; noeud.classList.add('is-pause'); }
      else if(!p && enPause){ enPause=false; debut=Date.now(); noeud.classList.remove('is-pause'); timer=setTimeout(fermer, Math.max(600, reste)); }
    }
    noeud.addEventListener('mouseenter', function(){ survol=true; majPause(); });
    noeud.addEventListener('mouseleave', function(){ survol=false; majPause(); });
    noeud.addEventListener('focusin', function(){ focus=true; majPause(); });
    noeud.addEventListener('focusout', function(e){ if(!noeud.contains(e.relatedTarget)){ focus=false; majPause(); } });
    function retirer(){ if(noeud.parentNode) noeud.parentNode.removeChild(noeud); }
    function fermer(immediat){
      if(ferme) return; ferme=true;
      if(timer){ clearTimeout(timer); timer=null; }
      if(toastActif===poignee){ toastActif=null; actionToastActive=null; }
      if(noeud.contains(doc.activeElement)){
        if(retour && retour.isConnected) focusSur(retour); else if(doc.activeElement.blur) doc.activeElement.blur();
      }
      if(immediat===true || mouvementReduit()){ retirer(); return; }
      noeud.classList.add('is-out'); setTimeout(retirer, 200);
    }
    zoneToasts.appendChild(noeud);
    timer=setTimeout(fermer, duree);
    poignee.fermer=function(immediat){ fermer(immediat===true); };
    toastActif=poignee; actionToastActive=action?declencher:null;
    return poignee;
  }
  if(doc) doc.addEventListener('keydown', function(e){
    if(!actionToastActive || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if(e.code!=='KeyU' && e.key!=='u' && e.key!=='U') return;
    e.preventDefault(); actionToastActive();
  });

  /* ============================================================
     SURFACES MODALES — focus déplacé, piégé, restitué ; pile
        d'empilement : Escape ferme la surface la plus haute, Tab
        boucle dans la surface la plus haute (F1 : les éléments en
        visibility:hidden ne comptent pas comme focalisables).
  ============================================================ */
  var SEL_FOCUS='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])';
  function estVisible(n){
    if(n.hidden || (n.closest && n.closest('[hidden],[inert]'))) return false;
    if(!(n.offsetWidth||n.offsetHeight||n.getClientRects().length)) return false;
    if(typeof n.checkVisibility==='function'){ try{ if(!n.checkVisibility({ visibilityProperty:true, checkVisibilityCSS:true })) return false; }catch(e){} }
    var cs=global.getComputedStyle?global.getComputedStyle(n):null;
    return !cs || (cs.visibility!=='hidden' && cs.visibility!=='collapse');
  }
  function focusablesVisibles(panneau){
    var liste=Array.prototype.filter.call(panneau.querySelectorAll(SEL_FOCUS), estVisible);
    // Groupe radio : un seul arrêt de tabulation (le bouton coché) quand il y en a un.
    return liste.filter(function(n){
      if(n.type!=='radio' || !n.name || n.checked) return true;
      return !liste.some(function(x){ return x!==n && x.type==='radio' && x.name===n.name && x.checked; });
    });
  }
  function focusSur(n, defiler){ try{ n.focus(defiler?undefined:{ preventScroll:true }); }catch(e){ try{ n.focus(); }catch(_){ } } }
  function precede(a, b){ return !!(b.compareDocumentPosition(a) & 2); }   // a avant b (hors ancêtres)
  function gererModale(panneau, declencheur, premier, fermer){
    if(!panneau) return function(){};
    var precedent=(declencheur && declencheur.focus)?declencheur:doc.activeElement;
    var entree={ panneau:panneau, fermer:(typeof fermer==='function')?fermer:null };
    pile.push(entree);
    var cible=premier||focusablesVisibles(panneau)[0]||panneau;
    // Laisse la surface devenir visible (visibility bascule à l'ouverture) avant de focaliser.
    var t=setTimeout(function(){ focusSur(cible); }, 60);
    var relache=false;
    return function relacher(rendreFocus){
      if(relache) return; relache=true;
      clearTimeout(t);
      var i=pile.indexOf(entree); if(i!==-1) pile.splice(i,1);
      if(rendreFocus!==false && precedent && precedent.focus && doc.contains(precedent)) focusSur(precedent);
    };
  }
  if(doc){
    doc.addEventListener('keydown', function(e){
      if(e.key!=='Escape' || e.defaultPrevented || !pile.length) return;
      var haut=pile[pile.length-1];
      if(haut.fermer){ e.preventDefault(); haut.fermer(); }
    });
    // Piège de tabulation de la surface la plus haute. Le navigateur garde la main à
    // l'intérieur (ordre naturel, groupes radio) ; on n'intervient qu'aux bords : aucun
    // focalisable VISIBLE avant (Maj+Tab) / après (Tab) l'élément actif → on boucle.
    doc.addEventListener('keydown', function(e){
      if(e.key!=='Tab' || e.defaultPrevented || !pile.length || e.altKey || e.ctrlKey || e.metaKey) return;
      var panneau=pile[pile.length-1].panneau, f=focusablesVisibles(panneau);
      if(!f.length){ e.preventDefault(); focusSur(panneau); return; }
      var actif=doc.activeElement, dedans=!!actif && actif!==panneau && panneau.contains(actif);
      if(e.shiftKey){
        if(!dedans || !f.some(function(x){ return x!==actif && precede(x, actif); })){ e.preventDefault(); focusSur(f[f.length-1], true); }
      } else if(!dedans || !f.some(function(x){ return x!==actif && precede(actif, x); })){ e.preventDefault(); focusSur(f[0], true); }
    });
  }

  /* Feuille basse : glisser la poignée vers le bas pour refermer (suit le doigt, ferme
     au-delà du seuil, 80 px par défaut). Alternative non gestuelle : bouton Fermer et
     Échap (WCAG 2.5.1). transform / transition posés en CSSOM (autorisé par la CSP) ;
     sans effet quand la poignée est masquée (dialogue centré ≥ 700 px). */
  function glisserPourFermer(poignee, surface, fermer, seuil){
    if(!poignee || !surface || typeof fermer!=='function') return;
    var limite=(typeof seuil==='number' && seuil>0)?seuil:80, depart=0, cur=0, actif=false;
    poignee.addEventListener('pointerdown', function(e){
      if(e.button!==0 && e.pointerType==='mouse') return;
      actif=true; depart=e.clientY; cur=0; surface.style.transition='none';
      try{ poignee.setPointerCapture(e.pointerId); }catch(_){}
    });
    poignee.addEventListener('pointermove', function(e){
      if(!actif) return;
      cur=Math.max(0, e.clientY-depart);
      surface.style.transform='translateY('+cur+'px)';
    });
    function fin(){
      if(!actif) return; actif=false;
      surface.style.transition=''; surface.style.transform='';
      if(cur>limite) fermer();
    }
    poignee.addEventListener('pointerup', fin);
    poignee.addEventListener('pointercancel', fin);
  }

  /* Tiroir de personnalisation (commun à toutes les pages) */
  var relacherTiroir=null;
  function ouvrirTiroir(declencheur){
    var d=doc.getElementById('drawer'); if(!d || d.classList.contains('open')) return;
    var v=doc.getElementById('overlay'), b=doc.getElementById('openSettings');
    d.classList.add('open'); if(v) v.classList.add('open'); d.setAttribute('aria-hidden','false');
    if(b) b.setAttribute('aria-expanded','true');
    relacherTiroir=gererModale(d, declencheur||b, doc.getElementById('drawerTitle'), fermerTiroir);
  }
  function fermerTiroir(){
    var d=doc.getElementById('drawer'); if(!d || !d.classList.contains('open')) return;
    var v=doc.getElementById('overlay'), b=doc.getElementById('openSettings');
    d.classList.remove('open'); if(v) v.classList.remove('open'); d.setAttribute('aria-hidden','true');
    if(b) b.setAttribute('aria-expanded','false');
    if(relacherTiroir){ relacherTiroir(); relacherTiroir=null; }
  }

  /* ============================================================
     FICHIERS — 100 % locaux (Blob / FileReader), aucune requête
  ============================================================ */
  function fmtMo(o){ return fmtNombre(Math.round(o/1e5)/10)+' Mo'; }
  function erreur(code, message){ var e=new Error(message); e.code=code; return e; }
  function nomAvecExtension(nom){
    var m=/^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(String(nom==null?'':nom));
    return (nomFichier(m[1])||'TAF')+(m[2]?m[2].toLowerCase():'');
  }
  function telecharger(contenu, nom, type){
    try{
      var t=(typeof type==='string' && /^[a-z]+\/[a-z0-9.+-]+(;\s*charset=[a-z0-9-]+)?$/i.test(type))?type:'application/octet-stream';
      var blob=(typeof Blob!=='undefined' && contenu instanceof Blob)?contenu:new Blob([String(contenu==null?'':contenu)], { type:t });
      var url=URL.createObjectURL(blob);
      var a=el('a', { href:url, download:nomAvecExtension(nom), hidden:true });
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      return true;
    }catch(e){ return false; }
  }
  function lireFichier(f, maxOctets, mode){
    return new Promise(function(resoudre, rejeter){
      if(!f || typeof f.size!=='number'){ rejeter(erreur('aucun', 'Aucun fichier.')); return; }
      if(f.size>maxOctets){ rejeter(erreur('trop-lourd', 'Fichier trop lourd ('+fmtMo(f.size)+') — maximum '+fmtMo(maxOctets)+'.')); return; }
      var r=new FileReader();
      r.onload=function(){ resoudre(r.result); };
      r.onerror=function(){ rejeter(erreur('lecture', 'Lecture du fichier impossible.')); };
      if(mode==='dataurl') r.readAsDataURL(f); else r.readAsText(f);
    });
  }
  function lireTexteFichier(f, maxOctets){ return lireFichier(f, maxOctets, 'texte').then(function(t){ return String(t); }); }
  function lireImageFichier(f, maxOctets){
    if(!f || !/^image\//.test(f.type||'')) return Promise.reject(erreur('type', 'Choisissez une image (PNG, JPEG, SVG…).'));
    return lireFichier(f, maxOctets, 'dataurl').then(function(url){
      if(!estImageDataUrl(url, Math.ceil(maxOctets*1.4)+256)) throw erreur('format', 'Format d’image non pris en charge.');
      return url;
    });
  }
  var fichier=Object.freeze({ telecharger:telecharger, lireTexte:lireTexteFichier, lireImage:lireImageFichier });

  /* ============================================================
     IMAGES — réduction par canvas (logo) : plus grand côté borné,
     PNG ou WebP selon le plus léger, rasterisation (un SVG devient
     une image bitmap inerte). Aucun agrandissement.
  ============================================================ */
  function dimensionsReduites(w, h, cote){
    w=Number(w); h=Number(h); cote=Number(cote);
    if(!(w>0 && h>0 && cote>0)) return null;
    var s=Math.min(1, cote/Math.max(w, h));
    return { w:Math.max(1, Math.round(w*s)), h:Math.max(1, Math.round(h*s)) };
  }
  function octetsDataUrl(u){
    if(typeof u!=='string') return 0;
    var i=u.indexOf(','); if(i<0) return 0;
    var donnees=u.slice(i+1);
    if(!/;base64$/i.test(u.slice(0, i))) return donnees.length;
    var pad=/==$/.test(donnees)?2:(/=$/.test(donnees)?1:0);
    return Math.max(0, Math.floor(donnees.length*3/4)-pad);
  }
  function chargerImage(src){
    return new Promise(function(resoudre, rejeter){
      var im=new Image();
      im.onload=function(){ resoudre(im); };
      im.onerror=function(){ rejeter(erreur('illisible', 'Image illisible.')); };
      im.src=src;
    });
  }
  function reduireImage(src, options){
    options=objetSimple(options)?options:{};
    var cote=(options.cote>0)?options.cote:LOGO.cote, cible=(options.cibleOctets>0)?options.cibleOctets:LOGO.cibleOctets;
    var plafond=(options.maxCaracteres>0)?options.maxCaracteres:LOGO.maxCaracteres;
    // Entrée : jusqu'à ~20 M caractères (fichier importé de 10 Mo, ancien logo) — la sortie est bornée.
    if(!estImageDataUrl(src, 2e7)) return Promise.reject(erreur('format', 'Format d’image non pris en charge.'));
    return chargerImage(src).then(function(im){
      var w=im.naturalWidth||im.width||cote, h=im.naturalHeight||im.height||cote, meilleur=null;
      var cotes=[cote, Math.round(cote*0.75), Math.round(cote*0.5), Math.round(cote*0.375), Math.round(cote*0.25)];
      for(var i=0;i<cotes.length;i++){
        var dim=dimensionsReduites(w, h, cotes[i]), c=doc.createElement('canvas');
        c.width=dim.w; c.height=dim.h;
        var ctx=c.getContext('2d'); ctx.imageSmoothingQuality='high';
        ctx.drawImage(im, 0, 0, dim.w, dim.h);
        var candidats=[c.toDataURL('image/png')];
        [0.92, 0.8, 0.65].forEach(function(q){ var u=c.toDataURL('image/webp', q); if(/^data:image\/webp;/.test(u)) candidats.push(u); });
        for(var k=0;k<candidats.length;k++){
          var u=candidats[k];
          if(!estImageDataUrl(u)) continue;
          if(!meilleur || u.length<meilleur.length) meilleur=u;
        }
        if(meilleur && octetsDataUrl(meilleur)<=cible) return meilleur;
        if(dim.w<=1 && dim.h<=1) break;
      }
      if(meilleur && meilleur.length<=plafond) return meilleur;
      throw erreur('trop-lourd', 'Image trop détaillée pour être allégée : choisissez un logo plus simple.');
    });
  }
  var image=Object.freeze({ LOGO:LOGO, dimensions:dimensionsReduites, octets:octetsDataUrl, reduire:reduireImage });

  /* ============================================================
     SAUVEGARDE PARTAGÉE (F7) — écriture JSON différée d'UNE clé,
     témoin par écrivain, vidage automatique avant de quitter.
  ============================================================ */
  var sauvegardes=[];
  function creerSauvegarde(cle, fournirEtat, options){
    options=objetSimple(options)?options:{};
    var st=options.stockage||stockage;
    var delai=(typeof options.delai==='number' && options.delai>=0)?options.delai:300;
    var ecrivain=(typeof options.ecrivain==='string' && options.ecrivain)?options.ecrivain:String(cle);
    var max=(typeof options.maxCaracteres==='number' && options.maxCaracteres>0)?options.maxCaracteres:Infinity;
    var avecTemoin=options.temoin!==false, apres=(typeof options.apres==='function')?options.apres:null;
    var timer=null;
    function signaler(e){ if(avecTemoin) etatTemoin(e, ecrivain); }
    function terminer(ok, raison){ if(apres){ try{ apres(ok, raison||''); }catch(e){} } return ok; }
    function maintenant(){
      if(timer){ clearTimeout(timer); timer=null; }
      var texte=null;
      try{ texte=JSON.stringify(fournirEtat()); }catch(e){ texte=null; }
      if(typeof texte!=='string'){ signaler('echec'); return terminer(false, 'serialisation'); }
      if(texte.length>max){ signaler('echec'); return terminer(false, 'limite'); }
      if(st.ecrireTexte(cle, texte)){ signaler('ok'); return terminer(true); }
      var lisible=st.lisible();
      signaler(lisible?'echec':'indisponible');
      return terminer(false, lisible?'quota':'indisponible');
    }
    function bientot(){ if(timer) clearTimeout(timer); signaler('cours'); timer=setTimeout(maintenant, delai); }
    function vider(){ return timer?maintenant():null; }
    function annuler(){
      if(timer){ clearTimeout(timer); timer=null; }
      if(avecTemoin && etatsTemoin[ecrivain]==='cours') etatTemoin('', ecrivain);
    }
    var s=Object.freeze({ bientot:bientot, maintenant:maintenant, vider:vider, annuler:annuler, enAttente:function(){ return !!timer; } });
    sauvegardes.push(s);
    return s;
  }
  // Changement de module / onglet masqué / fermeture : toute écriture en attente part tout de suite.
  function viderSauvegardes(){ sauvegardes.forEach(function(s){ s.vider(); }); }
  global.addEventListener('pagehide', viderSauvegardes);
  if(doc) doc.addEventListener('visibilitychange', function(){ if(doc.visibilityState==='hidden') viderSauvegardes(); });

  /* ============================================================
     MIGRATION DE L'APPARENCE — cra_app_v3 → taf_prefs_v1
        Pure : décide à partir des valeurs brutes (déjà lues). Une
        fois taf_prefs_v1 présent, il fait foi ; l'ancien CRA n'est
        plus relu. Si l'écriture échoue (quota), la migration reste
        EN ATTENTE (F2) : l'apparence d'origine reste dans cra_app_v3
        (le CRA continue de l'y écrire) et l'écriture est retentée.
  ============================================================ */
  var CHAMPS_PREFS=['accent','mark','logo','motif'];
  function extrairePrefsCra(craBrut){
    if(!objetSimple(craBrut)) return null;
    var present=CHAMPS_PREFS.some(function(k){ return aPropre.call(craBrut, k); });
    return present?validerPrefs(craBrut):null;
  }
  function migrerPrefs(prefsBrutes, craBrut){
    if(objetSimple(prefsBrutes)) return { prefs:validerPrefs(prefsBrutes), source:'prefs', ecrire:false };
    var depuisCra=extrairePrefsCra(craBrut);
    if(depuisCra) return { prefs:depuisCra, source:'cra', ecrire:true };
    return { prefs:validerPrefs(null), source:'defaut', ecrire:true };
  }
  function migrerDepuisStockage(st){
    var brutes=st.lire(CLES.prefs, null);
    // L'ancien état CRA (potentiellement lourd) n'est lu QUE si les prefs manquent.
    var r=migrerPrefs(brutes, objetSimple(brutes)?null:st.lire(CLES.cra, null));
    var ecrit=r.ecrire?st.ecrire(CLES.prefs, r.prefs):false;
    return { prefs:r.prefs, source:r.source, ecrit:ecrit, enAttente:(r.source==='cra' && !ecrit) };
  }
  // Copie de l'état CRA augmentée de l'apparence au format d'origine (tant que la migration attend).
  function avecApparenceHeritee(etat, p){
    if(!p || !objetSimple(etat)) return etat;
    var o={};
    Object.keys(etat).forEach(function(k){ if(cleSure(k)) o[k]=etat[k]; });
    var v=validerPrefs(p);
    o.accent=v.accent; o.mark=v.mark; o.logo=v.logo; o.motif=v.motif;
    return o;
  }

  /* ============================================================
     APPARENCE PARTAGÉE — état, application, persistance, synchro
  ============================================================ */
  var prefsCourantes=validerPrefs(null);
  var migrationAttente=false;
  var abonnes=[];
  var rendusMarque=(typeof WeakMap==='function')?new WeakMap():null;
  var ui=null;                 // contrôles de la section « Apparence » (une par page)
  var dernierLogoTente=null;   // un logo trop lourd n'est réduit qu'une fois par session

  var sauvegardePrefs=creerSauvegarde(CLES.prefs, function(){ return prefsCourantes; }, {
    delai:250,
    apres:function(ok){ if(ok && migrationAttente){ migrationAttente=false; notifier('migration'); } }
  });
  function migrationEnAttente(){ return migrationAttente?prefs():null; }
  // Après toute écriture réussie d'une AUTRE clé : la place a peut-être été libérée →
  // on retente la migration en attente ; l'onglet Heures suit le chrono de cet onglet.
  var retentePlanifiee=false;
  function apresEcritureReelle(cle){
    if(etatsTemoin.stockage){ delete etatsTemoin.stockage; }
    if(migrationAttente && cle!==CLES.prefs && !retentePlanifiee){
      retentePlanifiee=true;
      setTimeout(function(){ retentePlanifiee=false; if(migrationAttente) sauvegardePrefs.maintenant(); }, 0);
    }
    if(cle===CLES.heures) nav.rafraichir();
  }

  function prefs(){ return { accent:prefsCourantes.accent, mark:prefsCourantes.mark, logo:prefsCourantes.logo, motif:prefsCourantes.motif }; }
  function remplirMarque(slot, p){
    var cle=p.logo||('marque:'+p.mark);
    if(rendusMarque && rendusMarque.get(slot)===cle) return;   // rien à refaire (ex. seul l'accent change)
    if(rendusMarque) rendusMarque.set(slot, cle);
    slot.textContent='';
    if(p.logo){
      var im=el('img', { alt:'' });
      // Logo non décodable (donnée abîmée) : l'icône de marque reprend sa place, jamais d'image cassée.
      im.addEventListener('error', function(){ if(im.parentNode===slot){ slot.textContent=''; slot.appendChild(creerIconeMarque(p.mark)); } });
      im.src=p.logo; slot.appendChild(im);
    }
    else slot.appendChild(creerIconeMarque(p.mark));
  }
  function appliquerApparence(p){
    p=p?validerPrefs(p):prefsCourantes;
    var racine=doc.documentElement;
    racine.style.setProperty('--accent', p.accent);
    racine.style.setProperty('--on-accent', encreSur(p.accent));
    if(doc.body) doc.body.classList.toggle('no-motif', !p.motif);
    Array.prototype.forEach.call(doc.querySelectorAll('[data-taf-marque]'), function(s){ remplirMarque(s, p); });
    majSectionApparence(p);
  }
  function notifier(origine){
    var copie=prefs();
    abonnes.slice().forEach(function(fn){ try{ fn(copie, origine); }catch(e){} });
  }
  function surPrefs(fn){
    if(typeof fn!=='function') return function(){};
    abonnes.push(fn);
    return function(){ var i=abonnes.indexOf(fn); if(i!==-1) abonnes.splice(i,1); };
  }
  function definirPrefs(partiel, options){
    var fusion=prefs();
    if(objetSimple(partiel)) CHAMPS_PREFS.forEach(function(k){ if(aPropre.call(partiel, k)) fusion[k]=partiel[k]; });
    prefsCourantes=validerPrefs(fusion);
    appliquerApparence();
    notifier('local');
    alleger();
    if(options && options.differer){ sauvegardePrefs.bientot(); return true; }
    return sauvegardePrefs.maintenant();
  }
  function reinitialiserPrefs(){
    sauvegardePrefs.annuler();
    prefsCourantes=validerPrefs(null);
    appliquerApparence(); notifier('local');
    // On ÉCRIT les défauts (au lieu de supprimer la clé) : la migration depuis un ancien
    // cra_app_v3 ne peut ainsi jamais « ressusciter » une ancienne apparence.
    return sauvegardePrefs.maintenant();
  }
  /* F8 : un logo existant trop lourd est réduit UNE fois, si c'est sûr : l'original
     reste stocké tant que la version réduite n'est pas écrite, et rien n'est appliqué
     si le logo a changé entre-temps ou si l'image ne se décode pas. */
  function alleger(){
    var logo=prefsCourantes.logo;
    if(!logo || logo.length<=LOGO.maxCaracteres || logo===dernierLogoTente || !doc.body || !doc.body.hasAttribute('data-module')) return;
    dernierLogoTente=logo;
    reduireImage(logo).then(function(reduit){
      if(prefsCourantes.logo!==logo || reduit.length>=logo.length) return;
      var ok=definirPrefs({ logo:reduit });
      toast(ok?'Logo allégé pour tenir dans le stockage local':'Logo allégé, mais pas encore enregistré (stockage plein)', ok?'info':'erreur');
    }, function(){ /* image non décodable : l'original est conservé tel quel */ });
  }

  /* Section « Apparence » du tiroir — UNE source pour toutes les pages */
  function construireSectionApparence(conteneur){
    if(!conteneur || ui) return;
    var r={ swatches:[], marques:[] };

    var sw=el('div', { class:'swatches', role:'group', 'aria-labelledby':'tafTitreAccent' });
    SWATCHES.forEach(function(c){
      var nom=NOMS_SWATCHES[c]||c;
      var b=el('button', { type:'button', class:'swatch-btn', 'data-c':c, 'aria-pressed':'false', 'aria-label':'Accent '+nom, title:nom });
      b.style.setProperty('--sw', c);                      // CSSOM : autorisé par la CSP
      b.addEventListener('click', function(){ definirPrefs({ accent:c }); });
      sw.appendChild(b); r.swatches.push(b);
    });
    r.picker=el('input', { type:'color', id:'accentPicker', value:ACCENT_DEFAUT });
    r.picker.addEventListener('input', function(){ definirPrefs({ accent:r.picker.value }, { differer:true }); });
    var g1=el('div', { class:'dgroup' }, [
      el('h3', { id:'tafTitreAccent', text:'Couleur d’accent' }), sw,
      el('label', { class:'color-row' }, [ r.picker, el('span', { text:'Couleur personnalisée' }) ])
    ]);

    var mk=el('div', { class:'marks', role:'group', 'aria-labelledby':'tafTitreMarque' });
    MARQUES.forEach(function(id){
      var b=el('button', { type:'button', class:'mark-btn', 'data-m':id, 'aria-pressed':'false', 'aria-label':'Icône '+NOMS_MARQUES[id], title:NOMS_MARQUES[id] }, [ creerIconeMarque(id) ]);
      b.addEventListener('click', function(){ definirPrefs({ mark:id, logo:null }); });
      mk.appendChild(b); r.marques.push(b);
    });
    r.logoApercu=el('img', { class:'logo-preview', alt:'Logo actuel', hidden:true });
    r.logoFichier=el('input', { type:'file', id:'logoFile', accept:'image/*', hidden:true, tabindex:'-1', 'aria-hidden':'true' });
    r.logoImporter=el('button', { type:'button', class:'btn small ghost', id:'logoImport', text:'Importer' });
    r.logoRetirer=el('button', { type:'button', class:'btn small ghost', id:'logoRemove', text:'Retirer', hidden:true });
    r.logoImporter.addEventListener('click', function(){ r.logoFichier.click(); });
    r.logoFichier.addEventListener('change', function(){
      var f=r.logoFichier.files && r.logoFichier.files[0];
      r.logoFichier.value='';
      if(!f) return;
      r.logoImporter.disabled=true; r.logoImporter.setAttribute('aria-busy','true');
      // Lu, rasterisé (un SVG devient une image inerte), réduit à 512 px / < 300 Ko, puis enregistré.
      lireImageFichier(f, LOGO.fichierMaxOctets).then(reduireImage).then(function(url){
        var ok=definirPrefs({ logo:url });
        toast(ok?'Logo importé':'Logo appliqué, mais non enregistré (stockage plein ?)', ok?'succes':'erreur');
      }, function(err){ toast((err && err.message)||'Import du logo impossible.', 'erreur'); })
      .then(function(){ r.logoImporter.disabled=false; r.logoImporter.removeAttribute('aria-busy'); });
    });
    r.logoRetirer.addEventListener('click', function(){ definirPrefs({ logo:null }); focusSur(r.logoImporter); annoncer('Logo retiré'); });
    var g2=el('div', { class:'dgroup' }, [
      el('h3', { id:'tafTitreMarque', text:'Icône / logo' }), mk,
      el('div', { class:'drow' }, [
        el('span', { class:'lbl', text:'Logo personnalisé' }),
        el('div', { class:'drow-actions' }, [ r.logoApercu, r.logoImporter, r.logoRetirer, r.logoFichier ])
      ]),
      el('p', { class:'dnote', text:'Le logo remplace l’icône dans l’en-tête et sur les documents exportés (PDF). Il est allégé à l’import (512 px).' })
    ]);

    r.motif=el('input', { type:'checkbox', id:'motifToggle', role:'switch', 'aria-labelledby':'tafMotifLbl' });
    r.motif.addEventListener('change', function(){ definirPrefs({ motif:r.motif.checked }); });
    var g3=el('div', { class:'dgroup' }, [
      el('h3', { text:'Affichage' }),
      el('div', { class:'drow' }, [
        el('span', { class:'lbl', id:'tafMotifLbl', text:'Motif hexagone en fond' }),
        el('label', { class:'switch' }, [ r.motif, el('span', { class:'track' }), el('span', { class:'thumb' }) ])
      ])
    ]);

    conteneur.textContent='';
    conteneur.appendChild(g1); conteneur.appendChild(g2); conteneur.appendChild(g3);
    ui=r;
    majSectionApparence(prefsCourantes);
  }
  function majSectionApparence(p){
    if(!ui) return;
    var a=p.accent.toLowerCase();
    ui.swatches.forEach(function(b){ var on=b.getAttribute('data-c').toLowerCase()===a; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false'); });
    if(p.accent.length===7 && ui.picker.value.toLowerCase()!==a) ui.picker.value=p.accent;
    var logo=!!p.logo;
    ui.marques.forEach(function(b){ var on=!logo && b.getAttribute('data-m')===p.mark; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false'); });
    if(logo){ if(ui.logoApercu.getAttribute('src')!==p.logo) ui.logoApercu.src=p.logo; ui.logoApercu.hidden=false; }
    else { ui.logoApercu.removeAttribute('src'); ui.logoApercu.hidden=true; }
    ui.logoRetirer.hidden=!logo;
    ui.motif.checked=p.motif;
  }

  /* ============================================================
     CSV — séparateur ';', CRLF, BOM UTF-8 ; anti-injection de formules
  ============================================================ */
  function csvCellule(v){
    var s=(v==null)?'':String(v);
    if(/^(?:[=+\-@\t\r\n]|\s+[=+\-@])/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g, '""')+'"';
  }
  function csvNombre(n){ n=Number(n); return fmtNombre((isFinite(n) && n>0)?n:0, 2); }
  var RX_CSV_NU=/^(?![\s]*[=+\-@\t\r\n])[^;"\r\n\t]*$/;
  function csvSure(c){
    if(typeof c==='number') return csvNombre(c);
    if(c==null) return '';
    c=String(c);
    if(RX_CSV_NU.test(c)) return c;                                                    // valeur nue sûre
    if(/^"(?:[^"]|"")*"$/.test(c) && csvCellule(c.slice(1,-1).replace(/""/g, '"'))===c) return c;   // déjà échappée par csv.cellule
    return csvCellule(c);
  }
  function csvConstruire(lignes){
    return '﻿'+(Array.isArray(lignes)?lignes:[]).map(function(l){ return (Array.isArray(l)?l:[l]).map(csvSure).join(';'); }).join('\r\n')+'\r\n';
  }
  var csv=Object.freeze({ cellule:csvCellule, nombre:csvNombre, construire:csvConstruire });

  /* ============================================================
     HEURES — règles partagées (docs/heures-spec.md §5–7)
        Minutes entières, heures murales locales 'HH:MM' ('24:00'
        en fin seulement). Tout est PUR (sauf lire()) et testable.
  ============================================================ */
  /* fichierOctets : pire cas RÉEL d'une sauvegarde exportée (json car. UTF-16 → jusqu'à 3 octets
     UTF-8 chacun + enveloppe) — toute sauvegarde que l'application accepte de stocker reste
     réimportable. La borne de sécurité reste H.valider + le refus de muter au-delà de json. */
  var H_LIMITES=Object.freeze({ jours:4000, plagesJour:48, projets:50, nom:40, note:200, journeeType:8, json:2000000, fichierOctets:3*2000000+4096, saisiePlages:12 });
  function minutes(hhmm){
    if(hhmm==='24:00') return 1440;
    if(typeof hhmm!=='string' || !RX.heure.test(hhmm)) return NaN;
    return (+hhmm.slice(0,2))*60+(+hhmm.slice(3,5));
  }
  function versHHMM(min){
    if(typeof min!=='number' || !isFinite(min)) return '';
    var m=Math.min(1440, Math.max(0, Math.round(min)));
    return m===1440?'24:00':pad2(Math.floor(m/60))+':'+pad2(m%60);
  }
  function arrondir(x, pas, sens){
    pas=(typeof pas==='number' && pas>0)?pas:1;
    var q=Math.round((Number(x)/pas)*1e6)/1e6;              // neutralise le bruit flottant (751,0000001)
    var f=(sens==='bas')?Math.floor:((sens==='haut')?Math.ceil:Math.round);
    return f(q)*pas;
  }
  function unionDans(plages, a, b){
    var iv=[];
    (Array.isArray(plages)?plages:[]).forEach(function(p){
      if(!p) return;
      var d=Math.max(minutes(p.d), a), f=Math.min(minutes(p.f), b);
      if(f>d) iv.push([d, f]);
    });
    iv.sort(function(x, y){ return x[0]-y[0] || x[1]-y[1]; });
    var total=0, cd=0, cf=-1;
    iv.forEach(function(x){
      if(x[0]>cf){ if(cf>cd) total+=cf-cd; cd=x[0]; cf=x[1]; }
      else if(x[1]>cf) cf=x[1];
    });
    if(cf>cd) total+=cf-cd;
    return total;
  }
  function unionMinutes(plages){ return unionDans(plages, 0, 1440); }
  var CHAMPS_PLAGE=['id','d','f','p','n','o','s'];
  function copierPlage(x){ var c={}; CHAMPS_PLAGE.forEach(function(k){ if(x[k]!==undefined) c[k]=x[k]; }); return c; }
  function memeContenu(a, b){ return !!a.s && a.s===b.s && (a.p||'')===(b.p||'') && (a.n||'')===(b.n||''); }
  // §6.5 — détail : {plages, retirees, plafonnees}
  function normaliserDetail(plages, sansPlafond){
    var liste=(Array.isArray(plages)?plages:[]).filter(function(x){ return x && minutes(x.f)>minutes(x.d); }).map(copierPlage);
    var invalides=(Array.isArray(plages)?plages.length:0)-liste.length;
    liste.sort(function(a, b){ return minutes(a.d)-minutes(b.d) || minutes(a.f)-minutes(b.f); });
    var out=[], retirees=0;
    liste.forEach(function(x){
      var prec=out[out.length-1];
      if(prec){
        var fp=minutes(prec.f);
        if(minutes(x.d)<fp){ if(minutes(x.f)<=fp){ retirees++; return; } x.d=prec.f; }   // chevauchement résiduel
        if(x.d===prec.f && memeContenu(prec, x)){ prec.f=x.f; return; }                // contiguës, même session
      }
      out.push(x);
    });
    var plafonnees=Math.max(0, out.length-H_LIMITES.plagesJour);
    return { plages:sansPlafond?out:out.slice(0, H_LIMITES.plagesJour), retirees:retirees+invalides, plafonnees:plafonnees };
  }
  function normaliserJour(plages){ return normaliserDetail(plages).plages; }
  // §6.4 — « la saisie la plus récente gagne »
  function insererPlage(plagesJour, nouvelle){
    var n=copierPlage(objetSimple(nouvelle)?nouvelle:{}), nd=minutes(n.d), nf=minutes(n.f);
    var base=normaliserJour(plagesJour);
    if(!(nf>nd)) return { plages:base, rognees:[] };
    var res=[], rognees=[];
    base.forEach(function(e){
      if(n.id && e.id===n.id) return;                       // édition : l'ancienne version est retirée
      var ed=minutes(e.d), ef=minutes(e.f);
      if(ef<=nd || ed>=nf){ res.push(e); return; }
      if(ed>=nd && ef<=nf){ rognees.push({ type:'supprimee', avant:e, apres:[] }); return; }
      if(ed<nd && ef>nf){
        var a=copierPlage(e), b=copierPlage(e);
        a.f=n.d; b.d=n.f; b.id=nouvelId('h');
        res.push(a, b); rognees.push({ type:'scindee', avant:e, apres:[a, b] }); return;
      }
      var c=copierPlage(e);
      if(ed<nd) c.f=n.d; else c.d=n.f;
      res.push(c); rognees.push({ type:'rognee', avant:e, apres:[c] });
    });
    res.push(n);
    // Sans troncature : au-delà de 48, c'est l'appelant (muter → normaliserTouches) qui REFUSE l'action.
    var fin=normaliserDetail(res, true);
    return { plages:fin.plages, rognees:rognees, plafonnees:fin.plafonnees };
  }
  /* §6.3 — chrono → plages : découpe aux minuits LOCAUX, fin = début + durée RÉELLE
     (les jours de changement d'heure, la fin affichée suit la durée réellement
     travaillée). Morceau ignoré si sa durée réelle ou arrondie est < 1 min. */
  function decouperSegment(debut, fin, pas, mode){
    var t0=Number(debut instanceof Date?debut.getTime():debut), t1=Number(fin instanceof Date?fin.getTime():fin);
    var res={ plagesParJour:{}, horlogeReculee:false };
    if(!isFinite(t0) || !isFinite(t1)){ res.erreur={ code:'invalide', message:'Horodatage invalide.' }; return res; }
    if(t1<t0){ res.horlogeReculee=true; return res; }
    var favorable=(mode==='favorable'), morceaux=[], cur=t0;
    while(cur<t1){
      var dc=new Date(cur), minuit=new Date(dc.getFullYear(), dc.getMonth(), dc.getDate()+1).getTime();
      var bout=Math.min(t1, minuit);
      morceaux.push([cur, bout]); cur=bout;
      if(morceaux.length>8){ return { plagesParJour:{}, horlogeReculee:false, erreur:{ code:'trop-long', message:'Segment de plus de 8 jours : refusé.' } }; }
    }
    morceaux.forEach(function(m){
      var dd=new Date(m[0]), reel=(m[1]-m[0])/60000;
      if(reel<1) return;
      var dBrut=dd.getHours()*60+dd.getMinutes()+dd.getSeconds()/60+dd.getMilliseconds()/60000;
      var d=arrondir(dBrut, pas, favorable?'bas':'proche'), f=Math.min(1440, arrondir(dBrut+reel, pas, favorable?'haut':'proche'));
      if(f-d<1) return;
      var cle=cleDate(dd);
      (res.plagesParJour[cle]=res.plagesParJour[cle]||[]).push({ d:versHHMM(d), f:versHHMM(f) });
    });
    return res;
  }

  /* §6.8 — saisie rapide : « 9-12:30 13:30-17 @projet note » */
  function normaliserSaisie(t){
    t=String(t==null?'':t);
    try{ t=t.normalize('NFKC'); }catch(e){}
    t=t.replace(RX.controle, ' ');
    t=t.replace(/(\d)\s+h(?=[\s\d\-–—→]|$)/gi, '$1h');            // « 9 h » → « 9h »
    t=t.replace(/(\d)h\s+(\d{2})(?=\s|$)/gi, '$1h$2');            // « 2h 30 » → « 2h30 »
    t=t.replace(/(\d)\s+(min|mn|m)(?=\s|$)/gi, '$1$2');           // « 90 min » → « 90min »
    t=t.replace(/([\dh])\s*(?:[-–—→]|à)\s*(?=\d)/gi, '$1-');      // tirets, flèche, « à » entre deux heures
    return t.replace(/\s+/g, ' ').trim();
  }
  function heureSaisie(s, estFin){
    var m, h, mi;
    if((m=/^(\d{1,2})h?$/i.exec(s))){ h=+m[1]; mi=0; }
    else if((m=/^(\d{1,2})[h:](\d{2})$/i.exec(s))){ h=+m[1]; mi=+m[2]; }
    else if((m=/^(\d{3,4})$/.exec(s))){ h=Math.floor(+m[1]/100); mi=+m[1]%100; }
    else return NaN;
    if(mi>59) return NaN;
    if(h===24 && mi===0) return estFin?1440:NaN;
    return (h>23)?NaN:h*60+mi;
  }
  function dureeSaisie(s){
    var m;
    if((m=/^(\d{1,2})h(\d{2})?$/i.exec(s))){ if(m[2] && +m[2]>59) return NaN; return (+m[1])*60+(m[2]?+m[2]:0); }
    if((m=/^(\d{1,2})[,.](\d{1,2})h$/i.exec(s))) return Math.round(parseFloat(m[1]+'.'+m[2])*60);
    if((m=/^(\d{1,4})(?:min|mn|m)$/i.exec(s))) return +m[1];
    return null;                                                   // pas une durée
  }
  function analyserSaisie(texte, ctx){
    ctx=objetSimple(ctx)?ctx:{};
    var res={ plagesParJour:{}, plages:[], projet:'', note:'', erreurs:[], traverseMinuit:false };
    var t=normaliserSaisie(texte);
    if(!t) return res;
    var cleJ=cleValide(ctx.cleJour)?ctx.cleJour:cleDate(new Date()), cleJ1=ajouterJours(cleJ, 1);
    var pas=(typeof ctx.pas==='number' && ctx.pas>0)?ctx.pas:1;
    function err(code, message, jeton, extra){ var e={ code:code, message:message, jeton:jeton==null?'':String(jeton) }; if(extra) Object.keys(extra).forEach(function(k){ e[k]=extra[k]; }); res.erreurs.push(e); }
    var parJour={}, mots=[], nombreNu=null, durees=[], jetonProjet=null;
    function ajouter(cle, d, f){ if(f>d) (parJour[cle]=parJour[cle]||[]).push([d, f]); }
    t.split(' ').forEach(function(tok){
      if(tok.charAt(0)==='@' && tok.length>1){
        if(jetonProjet!==null){ err('plusieurs-projets', 'Un seul projet par saisie.', tok.slice(1)); return; }
        jetonProjet=tok.slice(1); return;
      }
      if(/^\d[\dh:]*-\d[\dh:]*$/i.test(tok)){
        var parts=tok.split('-'), d=heureSaisie(parts[0], false), f=heureSaisie(parts[1], true);
        if(isNaN(d) || isNaN(f)){ err('heure-invalide', 'Heure invalide : « '+tok+' ».', tok); return; }
        if(f===d){ err('duree-nulle', 'Durée nulle : « '+tok+' ».', tok); return; }
        if(f<d && f<720 && f+720>d) f+=720;                       // « 9-1 » → 09:00–13:00 (seule heuristique)
        if(f<d){ res.traverseMinuit=true; ajouter(cleJ, d, 1440); ajouter(cleJ1, 0, f); return; }
        ajouter(cleJ, d, f); return;
      }
      var du=dureeSaisie(tok);
      if(du!==null){
        if(isNaN(du)){ err('heure-invalide', 'Durée invalide : « '+tok+' ».', tok); return; }
        if(du<=0){ err('duree-nulle', 'Durée nulle : « '+tok+' ».', tok); return; }
        durees.push({ min:du, jeton:tok }); return;
      }
      if(/^\d+$/.test(tok) && nombreNu===null) nombreNu=tok;
      mots.push(tok);
    });
    if(durees.length>1) err('plusieurs-durees', 'Une seule durée par saisie.', durees[1].jeton);
    else if(durees.length===1){
      var dur=durees[0].min, deb, fin;
      if(typeof ctx.maintenantMin==='number' && isFinite(ctx.maintenantMin)){
        fin=Math.min(1440, arrondir(ctx.maintenantMin, pas, ctx.mode==='favorable'?'haut':'proche'));
        deb=fin-dur;
        if(deb<0) err('debut-negatif', 'La durée dépasse le début de la journée.', durees[0].jeton);
        else ajouter(cleJ, deb, fin);
      } else {
        var finsJour=(Array.isArray(ctx.plagesJour)?ctx.plagesJour:[]).map(function(p){ return p?minutes(p.f):NaN; }).concat((parJour[cleJ]||[]).map(function(x){ return x[1]; })).filter(function(x){ return isFinite(x); });
        deb=finsJour.length?Math.max.apply(null, finsJour):(isFinite(minutes(ctx.debutHabituel))?minutes(ctx.debutHabituel):540);
        fin=deb+dur;
        if(fin-1440>1440) err('duree-24h', 'Durée supérieure à 24 h : « '+durees[0].jeton+' ».', durees[0].jeton);   // jamais rabotée en silence
        else if(fin>1440){ res.traverseMinuit=true; ajouter(cleJ, deb, 1440); ajouter(cleJ1, 0, fin-1440); }
        else ajouter(cleJ, deb, fin);
      }
    }
    // Projet : correspondance exacte (casse, accents ignorés) sur les projets non archivés, sinon préfixe unique.
    if(jetonProjet!==null){
      var q=normaliserTexte(jetonProjet), actifs=(Array.isArray(ctx.projets)?ctx.projets:[]).filter(function(p){ return objetSimple(p) && p.a!==true && typeof p.id==='string' && typeof p.nom==='string'; });
      var exacts=actifs.filter(function(p){ return normaliserTexte(p.nom)===q; });
      var cands=exacts.length?exacts:actifs.filter(function(p){ return normaliserTexte(p.nom).indexOf(q)===0; });
      if(cands.length===1) res.projet=cands[0].id;
      else if(cands.length>1) err('projet-ambigu', 'Projet ambigu : '+cands.map(function(p){ return p.nom; }).join(', ')+'.', jetonProjet, { candidats:cands.map(function(p){ return p.nom; }) });
      else err('projet-inconnu', 'Projet inconnu : « '+jetonProjet+' ».', jetonProjet);
    }
    var nb=0;
    [cleJ, cleJ1].forEach(function(cle){
      var l=(parJour[cle]||[]).sort(function(a, b){ return a[0]-b[0] || a[1]-b[1]; });
      for(var i=1;i<l.length;i++){ if(l[i][0]<l[i-1][1]){ err('chevauchement', 'Les plages saisies se chevauchent.', versHHMM(l[i][0])+'-'+versHHMM(l[i][1])); break; } }
      if(!l.length) return;
      res.plagesParJour[cle]=l.map(function(x){ nb++; res.plages.push({ jour:cle, d:versHHMM(x[0]), f:versHHMM(x[1]) }); return { d:versHHMM(x[0]), f:versHHMM(x[1]) }; });
    });
    if(nb>H_LIMITES.saisiePlages) err('trop-de-plages', 'Au plus '+H_LIMITES.saisiePlages+' plages par saisie.', '');
    if(!nb && nombreNu!==null && !res.erreurs.length) err('incomplet', 'Précisez : 9-12 ou 2h', nombreNu);
    res.note=texteNettoye(mots.join(' '), H_LIMITES.note);
    return res;
  }

  /* §8 — réglages (bornes) */
  function reglagesDefaut(){
    return { objHebdoMin:2100, dureeJourMin:420, joursOuvres:[1,2,3,4,5], debutHabituel:'09:00', pauseDejMin:60, coupure:'13:00',
      seuilDemiMin:null, rattrapage:true, arrondiMin:1, modeArrondi:'proche', alerteOubliMin:600, projetDemarrage:'dernier',
      secondes:true, vibration:true, autoPointer:false, journeeType:null, raccourcis:true, rappelSauvegardeJours:30 };
  }
  function idsProjets(projets){
    if(!Array.isArray(projets)) return null;
    var c=Object.create(null);
    projets.forEach(function(p){ if(objetSimple(p) && typeof p.id==='string' && RX.idProjet.test(p.id)) c[p.id]=true; });
    return c;
  }
  function projetConnu(p, connus){ return typeof p==='string' && RX.idProjet.test(p) && (!connus || connus[p]===true); }
  function validerReglagesDetail(o, connus){
    var def=reglagesDefaut(), r={}, ign=0;
    o=objetSimple(o)?o:{};
    function a(k){ return aPropre.call(o, k); }
    function prendre(k, ok){ if(!a(k)) r[k]=def[k]; else if(ok) r[k]=o[k]; else { r[k]=def[k]; ign++; } }
    function entier(k, min, max, pas){ var v=o[k]; prendre(k, Number.isInteger(v) && v>=min && v<=max && (!pas || v%pas===0)); }
    function booleen(k){ prendre(k, typeof o[k]==='boolean'); }
    function parmi(k, liste){ prendre(k, liste.indexOf(o[k])!==-1); }
    entier('objHebdoMin', 0, 4800, 15);
    entier('dureeJourMin', 60, 840, 15);
    if(a('joursOuvres') && Array.isArray(o.joursOuvres)){
      var vus=[];
      o.joursOuvres.forEach(function(j){ if(Number.isInteger(j) && j>=1 && j<=7){ if(vus.indexOf(j)===-1) vus.push(j); } else ign++; });
      r.joursOuvres=vus.sort(function(x, y){ return x-y; });
    } else { if(a('joursOuvres')) ign++; r.joursOuvres=def.joursOuvres; }
    prendre('debutHabituel', valide.heure(o.debutHabituel));
    entier('pauseDejMin', 0, 180);
    prendre('coupure', valide.heure(o.coupure) && minutes(o.coupure)>=360 && minutes(o.coupure)<=1080);
    if(a('seuilDemiMin') && o.seuilDemiMin!==null){
      var s=o.seuilDemiMin;
      if(Number.isInteger(s) && s>=15 && s<=r.dureeJourMin/2) r.seuilDemiMin=s; else { r.seuilDemiMin=null; ign++; }
    } else r.seuilDemiMin=null;
    booleen('rattrapage');
    parmi('arrondiMin', [1,5,10,15]);
    parmi('modeArrondi', ['proche','favorable']);
    entier('alerteOubliMin', 120, 1440);
    parmi('projetDemarrage', ['dernier','aucun']);
    booleen('secondes'); booleen('vibration'); booleen('autoPointer');
    if(a('journeeType') && o.journeeType!==null){
      if(Array.isArray(o.journeeType)){
        var jt=[];
        o.journeeType.forEach(function(x){
          if(!objetSimple(x) || !valide.heure(x.d) || !(x.f==='24:00' || valide.heure(x.f)) || minutes(x.f)<=minutes(x.d)){ ign++; return; }
          jt.push({ d:x.d, f:x.f, p:projetConnu(x.p, connus)?x.p:'' });
        });
        jt.sort(function(x, y){ return minutes(x.d)-minutes(y.d); });
        var sans=[];
        jt.forEach(function(x){ var prec=sans[sans.length-1]; if(prec && minutes(x.d)<minutes(prec.f)){ ign++; return; } sans.push(x); });
        if(sans.length>H_LIMITES.journeeType){ ign+=sans.length-H_LIMITES.journeeType; sans=sans.slice(0, H_LIMITES.journeeType); }
        r.journeeType=sans;
      } else { r.journeeType=null; ign++; }
    } else r.journeeType=null;
    booleen('raccourcis');
    parmi('rappelSauvegardeJours', [0,7,30]);
    return { reglages:r, ignores:ign };
  }
  function validerReglages(o, projets){ return validerReglagesDetail(o, idsProjets(projets)).reglages; }
  // Seuil automatique d'une demi-journée : ¼ de la journée, au multiple de 5 min (UNE seule formule).
  function seuilAuto(dureeJourMin){ return Math.round(dureeJourMin/4/5)*5; }
  function seuilDe(r){ return (r.seuilDemiMin!=null)?r.seuilDemiMin:seuilAuto(r.dureeJourMin); }   // r déjà validé
  function seuilDemi(reglages){ return seuilDe(validerReglages(reglages)); }
  // §7.1 — RÈGLE UNIQUE heures → demi-journées (vue Mois, ligne CRA, CSV, import CRA).
  function demiJournees(plages, reglages){
    var r=validerReglages(reglages), c=minutes(r.coupure);
    var minAm=unionDans(plages, 0, c), minPm=unionDans(plages, c, 1440);
    var seuil=seuilDe(r);
    var am=minAm>=seuil, pm=minPm>=seuil;
    if(!am && !pm && r.rattrapage && minAm+minPm>=seuil){ if(minAm>=minPm) am=true; else pm=true; }   // égalité : matin
    return { am:am, pm:pm, minAm:minAm, minPm:minPm };
  }
  function activiteJour(plages, projets, max){
    max=(typeof max==='number' && max>=1)?Math.floor(max):200;
    var noms=Object.create(null);
    (Array.isArray(projets)?projets:[]).forEach(function(p){ if(objetSimple(p) && typeof p.id==='string' && typeof p.nom==='string') noms[p.id]=p.nom; });
    var tri=(Array.isArray(plages)?plages:[]).filter(objetSimple).slice().sort(function(a, b){ return (minutes(a.d)||0)-(minutes(b.d)||0); });
    var vusP=[], vusN=[];
    tri.forEach(function(x){ var nom=(typeof x.p==='string' && x.p)?noms[x.p]:''; if(nom && vusP.indexOf(nom)===-1) vusP.push(nom); });
    tri.forEach(function(x){ var n=(typeof x.n==='string')?x.n.trim():''; if(n && vusN.indexOf(n)===-1) vusN.push(n); });
    var s=vusP.concat(vusN).join(' · ');
    return s.length>max?s.slice(0, max-1)+'…':s;
  }
  function resumeMois(donnees, annee, mois0){
    var out={};
    if(!donnees || !objetSimple(donnees.jours) || !Number.isInteger(annee) || !Number.isInteger(mois0) || mois0<0 || mois0>11) return out;
    var prefixe=annee+'-'+pad2(mois0+1)+'-', r=validerReglages(donnees.reglages);
    Object.keys(donnees.jours).forEach(function(cle){
      if(cle.indexOf(prefixe)!==0 || !cleValide(cle)) return;
      var plages=donnees.jours[cle];
      if(!Array.isArray(plages) || !plages.length) return;
      var dj=demiJournees(plages, r);
      out[+cle.slice(8, 10)]={ min:unionMinutes(plages), minAm:dj.minAm, minPm:dj.minPm, am:dj.am, pm:dj.pm, activite:activiteJour(plages, donnees.projets, 200) };
    });
    return out;
  }
  // §7.3 — plan PUR de l'import dans le CRA (aucune écriture).
  function planifierImport(craDays, resume, mode, avecActivite){
    var remplacer=(mode==='remplacer');
    craDays=objetSimple(craDays)?craDays:{}; resume=objetSimple(resume)?resume:{};
    var changements=[], s={ joursDetectes:0, joursProposes:0, inchanges:0, ajoutes:0, decoches:0 };
    for(var j=1;j<=31;j++){
      var k=String(j);
      var c=(aPropre.call(craDays, k) && objetSimple(craDays[k]))?craDays[k]:null;
      var r=(aPropre.call(resume, k) && objetSimple(resume[k]))?resume[k]:null;
      if(!c && !r) continue;
      var avant={ am:!!(c && c.am===true), pm:!!(c && c.pm===true), act:(c && typeof c.act==='string')?c.act:'' };
      var ram=!!(r && r.am===true), rpm=!!(r && r.pm===true);
      var apres={ am:remplacer?ram:(avant.am||ram), pm:remplacer?rpm:(avant.pm||rpm), act:avant.act };
      if(r && avecActivite && avant.act.trim()==='' && typeof r.activite==='string') apres.act=r.activite;
      if(r){ s.joursDetectes++; s.joursProposes+=(ram?0.5:0)+(rpm?0.5:0); }
      if(avant.am && !apres.am) s.decoches++;
      if(avant.pm && !apres.pm) s.decoches++;
      if(!avant.am && apres.am) s.ajoutes++;
      if(!avant.pm && apres.pm) s.ajoutes++;
      if(avant.am!==apres.am || avant.pm!==apres.pm || avant.act!==apres.act) changements.push({ jour:j, avant:avant, apres:apres });
      else if(r) s.inchanges++;
    }
    return { changements:changements, synthese:s };
  }
  function lireHashCra(hash){
    var m=(typeof hash==='string')?RX.hashCra.exec(hash):null;
    return m?{ annee:+m[1], mois0:+m[2]-1 }:null;
  }
  function hashCra(annee, mois0){
    if(!Number.isInteger(annee) || annee<1000 || annee>9999 || !Number.isInteger(mois0) || mois0<0 || mois0>11) return '';
    return '#heures-'+annee+'-'+pad2(mois0+1);
  }

  /* §5.2 — validation des données (reconstruction champ par champ) */
  function validerChrono(c, projets, maintenant){
    if(!objetSimple(c) || typeof c.s!=='string' || !RX.idSession.test(c.s)) return null;
    var now=(typeof maintenant==='number' && isFinite(maintenant))?maintenant:Date.now();
    var connus=(projets && !Array.isArray(projets))?projets:idsProjets(projets);
    function borne(t){ return typeof t==='number' && isFinite(t) && t>=946684800000 && t<=now+86400000; }
    var o={ e:'', t0:null, tp:null, p:projetConnu(c.p, connus)?c.p:'', n:texteNettoye(c.n, H_LIMITES.note), s:c.s };
    if(c.e==='marche'){ if(!borne(c.t0) || c.tp!=null) return null; o.e='marche'; o.t0=c.t0; }
    else if(c.e==='pause'){ if(!borne(c.tp) || c.t0!=null) return null; o.e='pause'; o.tp=c.tp; }
    else return null;
    return o;
  }
  function validerPlageH(x, connus){
    if(!objetSimple(x)) return null;
    var d=valide.heure(x.d)?x.d:null, f=(x.f==='24:00' || valide.heure(x.f))?x.f:null;
    if(!d || !f || minutes(f)<=minutes(d)) return null;
    var p={ id:(typeof x.id==='string' && RX.idPlage.test(x.id))?x.id:nouvelId('h'), d:d, f:f,
      p:projetConnu(x.p, connus)?x.p:'', n:texteNettoye(x.n, H_LIMITES.note), o:(x.o==='c'||x.o==='s'||x.o==='m')?x.o:'s' };
    if(typeof x.s==='string' && RX.idSession.test(x.s)) p.s=x.s;
    return p;
  }
  function valider(brut, options){
    var maintenant=(options && typeof options.maintenant==='number' && isFinite(options.maintenant))?options.maintenant:Date.now();
    if(brut===undefined || brut===null) return { donnees:null, rapport:{ statut:'vide', ignores:0, details:[] } };
    if(typeof brut==='string'){
      try{ brut=JSON.parse(brut); }catch(e){ return { donnees:null, rapport:{ statut:'illisible', ignores:0, details:['JSON invalide'] } }; }
    }
    if(!objetSimple(brut) || !aPropre.call(brut, 'v')) return { donnees:null, rapport:{ statut:'illisible', ignores:0, details:['format inconnu'] } };
    if(!Number.isInteger(brut.v) || brut.v<1) return { donnees:null, rapport:{ statut:'illisible', ignores:0, details:['version invalide'] } };
    var rapport={ statut:'ok', ignores:0, details:[] }, vus={};
    function ignorer(cat, n){ rapport.ignores+=(n||1); if(!vus[cat]){ vus[cat]=true; rapport.details.push(cat); } }

    var d={ v:1, rev:(Number.isInteger(brut.rev) && brut.rev>=0)?brut.rev:0, jours:Object.create(null), chrono:null, projets:[], reglages:null, meta:null };
    // Projets d'abord : les références des plages s'y résolvent.
    var connus=Object.create(null);
    if(Array.isArray(brut.projets)){
      brut.projets.forEach(function(p){
        if(d.projets.length>=H_LIMITES.projets){ ignorer('limite de projets'); return; }
        if(!objetSimple(p) || typeof p.id!=='string' || !RX.idProjet.test(p.id) || connus[p.id]){ ignorer('projet invalide'); return; }
        var nom=texteNettoye(p.nom, H_LIMITES.nom);
        if(!nom){ ignorer('projet invalide'); return; }
        d.projets.push({ id:p.id, nom:nom, t:(Number.isInteger(p.t) && p.t>=0 && p.t<=7)?p.t:0, a:p.a===true });
        connus[p.id]=true;
      });
    } else if(brut.projets!==undefined) ignorer('projets illisibles');

    var rr=validerReglagesDetail(brut.reglages, connus);
    d.reglages=rr.reglages;
    if(rr.ignores) ignorer('réglage invalide', rr.ignores);

    if(objetSimple(brut.jours)){
      var idsVus=Object.create(null);
      var cles=Object.keys(brut.jours).filter(function(k){ if(cleValide(k)) return true; ignorer('date invalide'); return false; }).sort();
      if(cles.length>H_LIMITES.jours){ ignorer('limite de jours', cles.length-H_LIMITES.jours); cles=cles.slice(cles.length-H_LIMITES.jours); }
      cles.forEach(function(k){
        var liste=brut.jours[k];
        if(!Array.isArray(liste)){ ignorer('jour illisible'); return; }
        var plages=[];
        liste.forEach(function(x){
          var p=validerPlageH(x, connus);
          if(!p){ ignorer('plage invalide'); return; }
          if(idsVus[p.id]) p.id=nouvelId('h');                     // id dupliqué dans l'objet : régénéré
          idsVus[p.id]=true; plages.push(p);
        });
        var n=normaliserDetail(plages);
        if(n.retirees) ignorer('chevauchement', n.retirees);
        if(n.plafonnees) ignorer('limite de plages', n.plafonnees);
        if(n.plages.length) d.jours[k]=n.plages;
      });
    } else if(brut.jours!==undefined) ignorer('jours illisibles');

    d.chrono=validerChrono(brut.chrono, connus, maintenant);
    if(brut.chrono!=null && !d.chrono) ignorer('chrono invalide');

    var m=objetSimple(brut.meta)?brut.meta:{};
    d.meta={ creeLe:cleValide(m.creeLe)?m.creeLe:cleDate(new Date(maintenant)), derniereSauvegarde:cleValide(m.derniereSauvegarde)?m.derniereSauvegarde:null, accueilVu:m.accueilVu===true };

    rapport.statut=(brut.v>1)?'futur':(rapport.ignores?'partiel':'ok');
    return { donnees:d, rapport:rapport };
  }
  function lireHeures(st){
    st=(st && typeof st.lireTexte==='function')?st:stockage;
    var t=st.lireTexte(CLES.heures);
    if(t==null) return { donnees:null, rapport:{ statut:'vide', ignores:0, details:[] } };
    return valider(t);
  }
  var heures=Object.freeze({
    CLE:CLES.heures, LIMITES:H_LIMITES, reglagesDefaut:reglagesDefaut, validerReglages:validerReglages,
    valider:valider, lire:lireHeures, validerChrono:validerChrono,
    minutes:minutes, versHHMM:versHHMM, arrondir:arrondir, unionMinutes:unionMinutes,
    normaliserJour:normaliserJour, normaliserDetail:normaliserDetail, insererPlage:insererPlage, decouperSegment:decouperSegment, analyserSaisie:analyserSaisie,
    demiJournees:demiJournees, seuilDemi:seuilDemi, seuilAuto:seuilAuto, activiteJour:activiteJour, resumeMois:resumeMois,
    planifierImport:planifierImport, lireHashCra:lireHashCra, hashCra:hashCra
  });

  /* ============================================================
     NAVIGATION — la liste des modules est le <nav> STATIQUE du HTML
     (une seule source, aucun décalage de mise en page). TAF.nav ne
     fait que l'enrichir : aria-current, retour en haut, pastille
     « en cours » sur l'onglet Heures (lecture SEULE de taf_heures_v1).
  ============================================================ */
  function moduleActif(){ return (doc && doc.body && doc.body.getAttribute('data-module'))||''; }
  var nav=(function(){
    var lien=null, pastille=null, texte=null, base='', timer=null, pret=false;
    function etatPastille(chrono, maintenant){
      if(!objetSimple(chrono)) return null;
      if(chrono.e==='pause') return { etat:'pause', texte:'pause', libelle:'chrono en pause', prochaine:null };
      if(chrono.e!=='marche' || typeof chrono.t0!=='number' || !isFinite(chrono.t0)) return null;
      var ecoule=Math.max(0, maintenant-chrono.t0), min=Math.floor(ecoule/60000);
      return { etat:'marche', texte:pad2(Math.floor(min/60))+':'+pad2(min%60), libelle:'chrono en cours depuis '+fmtDureeLongue(min), prochaine:60000-(ecoule%60000) };
    }
    function lireChrono(){
      var t=stockage.lireTexte(CLES.heures); if(t==null) return null;
      var o; try{ o=JSON.parse(t); }catch(e){ return null; }
      return (objetSimple(o) && o.v===1)?validerChrono(o.chrono, null, Date.now()):null;   // même validateur que heures.valider
    }
    function rafraichir(){
      if(!lien) return;
      if(timer){ clearTimeout(timer); timer=null; }
      var e=etatPastille(lireChrono(), Date.now());
      if(!e){ if(pastille) pastille.hidden=true; lien.removeAttribute('aria-label'); return; }
      if(!pastille){
        texte=el('span', { class:'tnp-texte' });
        pastille=el('span', { class:'taf-nav-pastille', 'aria-hidden':'true' }, [ el('span', { class:'tnp-point' }), texte ]);
        lien.appendChild(pastille);
      }
      pastille.setAttribute('data-etat', e.etat); texte.textContent=e.texte; pastille.hidden=false;
      lien.setAttribute('aria-label', base+', '+e.libelle);
      if(e.prochaine!=null && doc.visibilityState!=='hidden') timer=setTimeout(rafraichir, e.prochaine+40);
    }
    function init(){
      if(pret || !doc || !doc.body) return; pret=true;
      var actif=moduleActif();
      Array.prototype.forEach.call(doc.querySelectorAll('.taf-nav a[data-module]'), function(a){
        if(a.getAttribute('data-module')===actif) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
        // Onglet du module courant : pas de rechargement, retour en haut de page.
        a.addEventListener('click', function(e){
          if(a.getAttribute('aria-current')!=='page' || e.metaKey || e.ctrlKey || e.shiftKey || e.button!==0) return;
          e.preventDefault();
          try{ global.scrollTo({ top:0, behavior:mouvementReduit()?'auto':'smooth' }); }catch(_){ global.scrollTo(0,0); }
        });
      });
      lien=doc.querySelector('.taf-nav a[data-module="'+MODULE_CHRONO+'"]');
      if(!lien) return;
      base=(lien.textContent||'').replace(/\s+/g, ' ').trim();
      rafraichir();
      global.addEventListener('storage', function(e){
        if(e.key!==null && e.key!==CLES.heures) return;
        try{ if(e.storageArea && e.storageArea!==global.localStorage) return; }catch(_){ return; }
        rafraichir();
      });
      doc.addEventListener('visibilitychange', function(){ if(doc.visibilityState==='visible') rafraichir(); else if(timer){ clearTimeout(timer); timer=null; } });
      global.addEventListener('pageshow', function(e){ if(e.persisted) rafraichir(); });
    }
    return Object.freeze({ init:init, rafraichir:rafraichir, etatPastille:etatPastille });
  })();

  /* ============================================================
     IMPRESSION — titre FIXE « TAF » ; seule exception : le nom du
     fichier PDF pendant l'impression. preparerImpression() est
     idempotente et appelée AVANT window.print() (certains WebView
     n'émettent pas beforeprint) ; beforeprint / afterprint restent
     un filet de sécurité. Sans afterprint, le titre revient à la
     prochaine interaction.
  ============================================================ */
  var fournisseurNom=null, impressionEnCours=false;
  var EVTS_FIN_IMPRESSION=['pointerdown','keydown'];
  function definirNomImpression(fn){ fournisseurNom=(typeof fn==='function')?fn:null; }
  function nomImpression(){ var n=''; try{ n=fournisseurNom?nomFichier(fournisseurNom()):''; }catch(e){ n=''; } return n||TITRE; }
  function terminerImpression(){
    EVTS_FIN_IMPRESSION.forEach(function(t){ doc.removeEventListener(t, terminerImpression, true); });
    global.removeEventListener('focus', terminerImpression);
    impressionEnCours=false;
    doc.title=TITRE;
  }
  function preparerImpression(){
    doc.title=nomImpression();
    if(impressionEnCours) return;
    impressionEnCours=true;
    EVTS_FIN_IMPRESSION.forEach(function(t){ doc.addEventListener(t, terminerImpression, true); });
    global.addEventListener('focus', terminerImpression);
  }
  global.addEventListener('beforeprint', preparerImpression);
  global.addEventListener('afterprint', terminerImpression);

  /* ============================================================
     ANTI-CADRE (clickjacking) — frame-ancestors est ignoré dans une CSP
     <meta> et GitHub Pages n'envoie ni X-Frame-Options ni CSP en en-tête.
     Encadrée par une page tierce, une page de module ne lit ni n'écrit
     RIEN (pas de migration, pas de #pointer / autoPointer, pas d'import
     #heures-AAAA-MM) : contenu inerte + avis « Ouvrir dans un onglet ».
  ============================================================ */
  function estEncadre(g){ try{ return g.self!==g.top; }catch(e){ return true; } }   // pure : accès refusé = encadré
  var ENCADRE=estEncadre(global);
  function neutraliserSiEncadre(){
    if(!ENCADRE || !doc.body) return false;
    doc.documentElement.classList.add('taf-encadre');
    Array.prototype.forEach.call(doc.body.children, function(n){ n.inert=true; n.setAttribute('aria-hidden', 'true'); });
    var cible=(global.location.pathname.split('/').pop()||'index.html');
    doc.body.appendChild(el('div', { class:'taf-cadre-avis', role:'alert' }, [
      el('p', { text:'Pour protéger vos données, TAF ne s’utilise pas dans une page tierce.' }),
      el('a', { class:'btn primary', href:cible, target:'_blank', rel:'noopener noreferrer', text:'Ouvrir TAF dans un onglet' })
    ]));
    ['click','auxclick','dblclick','pointerdown','pointerup','mousedown','mouseup','touchstart','keydown','keyup','input','change','submit','dragstart','drop','paste','contextmenu'].forEach(function(t){
      doc.addEventListener(t, function(e){
        if(e.target && e.target.closest && e.target.closest('.taf-cadre-avis')) return;
        e.preventDefault(); e.stopImmediatePropagation();
      }, true);
    });
    return true;
  }

  /* ============================================================
     INITIALISATION (pages de module uniquement)
  ============================================================ */
  function init(){
    if(!doc.body || !doc.body.hasAttribute('data-module')) return;   // ex. page de tests : rien
    if(neutraliserSiEncadre()) return;                              // encadrée : ni lecture ni écriture
    var m=migrerDepuisStockage(stockage);
    prefsCourantes=m.prefs;
    migrationAttente=m.enAttente;
    construireSectionApparence(doc.getElementById('tafApparence'));
    appliquerApparence();
    nav.init();

    var b=doc.getElementById('openSettings'), f=doc.getElementById('closeSettings'), v=doc.getElementById('overlay');
    if(b) b.addEventListener('click', function(){ ouvrirTiroir(b); });
    if(f) f.addEventListener('click', fermerTiroir);
    if(v) v.addEventListener('click', fermerTiroir);

    // Synchro inter-onglets : un autre onglet a changé l'apparence → on l'applique (sans réécrire).
    global.addEventListener('storage', function(e){
      if(e.key!==null && e.key!==CLES.prefs) return;
      try{ if(e.storageArea && e.storageArea!==global.localStorage) return; }catch(_){ return; }
      var brut=stockage.lire(CLES.prefs, null);
      if(!objetSimple(brut)) return;                       // clé effacée ailleurs : on garde l'apparence affichée
      sauvegardePrefs.annuler();
      prefsCourantes=validerPrefs(brut);
      if(migrationAttente){ migrationAttente=false; }      // un autre onglet a écrit taf_prefs_v1 : migration faite
      appliquerApparence(); notifier('externe');
    });

    if(!stockage.lisible()) etatTemoin('indisponible', 'stockage');
    else if(!stockage.disponible()) etatTemoin('echec', 'stockage');
    if(migrationAttente){
      etatTemoin('echec', CLES.prefs);
      toast({ message:'Apparence non migrée : stockage local plein. Elle reste conservée dans l’ancien format — allégez le logo ou les profils, ou exportez vos données.', type:'erreur', duree:9000 });
    }
    alleger();
  }

  /* ============================================================
     EXPOSITION — objet gelé, propriété globale non réassignable
  ============================================================ */
  var TAF=Object.freeze({
    TITRE:TITRE, CLES:CLES, ACCENT_DEFAUT:ACCENT_DEFAUT, SWATCHES:SWATCHES, MARQUES:MARQUES,
    MOIS:MOIS, JOURS_LONGS:JOURS_LONGS, JOURS_COURTS:JOURS_COURTS,
    valide:valide, objetSimple:objetSimple, cleSure:cleSure, texteBorne:texteBorne, accentValide:accentValide, markValide:markValide,
    estImageDataUrl:estImageDataUrl, sigValide:sigValide, validerPrefs:validerPrefs, etatJour:etatJour, pastilleJour:pastilleJour,
    stockage:stockage, creerStockage:creerStockage, creerMemoire:creerMemoire, creerSauvegarde:creerSauvegarde,
    extrairePrefsCra:extrairePrefsCra, migrerPrefs:migrerPrefs, migrerDepuisStockage:migrerDepuisStockage,
    migrationEnAttente:migrationEnAttente, avecApparenceHeritee:avecApparenceHeritee,
    prefs:prefs, definirPrefs:definirPrefs, reinitialiserPrefs:reinitialiserPrefs, surPrefs:surPrefs,
    appliquerApparence:appliquerApparence, creerIconeMarque:creerIconeMarque, construireSectionApparence:construireSectionApparence,
    encreSur:encreSur, image:image,
    gererModale:gererModale, ouvrirTiroir:ouvrirTiroir, fermerTiroir:fermerTiroir, glisserPourFermer:glisserPourFermer,
    annoncer:annoncer, toast:toast, temoin:temoin, mouvementReduit:mouvementReduit, vibrer:vibrer,
    el:el, creerSvg:creerSvg, vider:vider,
    fichier:fichier, nomFichier:nomFichier, id:nouvelId, normaliserTexte:normaliserTexte,
    format:format, dates:dates, csv:csv, heures:heures,
    moduleActif:moduleActif, nav:nav, definirNomImpression:definirNomImpression, preparerImpression:preparerImpression,
    encadre:ENCADRE, estEncadre:estEncadre
  });
  try{ Object.defineProperty(global, 'TAF', { value:TAF, writable:false, configurable:false, enumerable:true }); }
  catch(e){ global.TAF=TAF; }

  init();
})(window);
