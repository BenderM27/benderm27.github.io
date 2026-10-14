/* ============================================================================
   TAF — MODULE CRA, DONNÉES (assets/cra-donnees.js)
   Fonctions PURES du CRA : validation de tout ce qui est lu (localStorage,
   fichier importé, profils d'identité), bornes, choix du format d'import,
   ajustement du plan d'import Heures. Aucun DOM, aucun stockage, aucun état :
   testées par tests/ (stockage simulé). Script classique chargé APRÈS
   assets/taf.js (dont il réutilise les validateurs) et AVANT assets/cra.js.
   Expose un unique global gelé et non réassignable : window.CraDonnees.

   ── API (window.CraDonnees) ────────────────────────────────────────────
     MAX, ANNEES {min, max}               bornes de saisie / d'import
     joursDansMois(annee, mois0) → 28..31
     cleArchive(annee, mois0) → 'AAAA-MM'  lireCleArchive(cle) → {annee, mois0} | null
     validerJour(j) → {am, pm, act} | null
     validerJours(days, nbJours?) → {…}    clés 1..nbJours (31 par défaut)
     validerArchive(a) → {'AAAA-MM': {days}}   années 1970–2999, jours ≤ mois
     validerPresets(p), validerChamps(f, champs)
     nombreTexte(v, max?) → chaîne affichable par <input type=number> ('' si
                            invalide ou négatif ; ramenée à max au-delà)
     entierBorne(v, min, max) → entier | null
     validerEtat(s, {champs, maintenant}?) → état complet et borné
     etatPlausible(o) → bool               lireImport(o, options?) → {etat, prefs, format} | null
     etatStockePlausible(o) → bool         (cra_app_v3 : plausible ou objet vide)
     tailleEtatLu(o) → caractères JSON de l'état lu (apparence exclue)   etatTropLourd(o) → bool
     classerBrut(texte, plausible?) → {statut:'absent'|'ok'|'illisible', valeur}
     validerDonneesProfil(d, champs), validerProfils(a, champs) → {profils, ignores}
     etatJour(j) → {st:'empty'|'half'|'full', side:'am'|'pm'|''}   (pastille tri-état)
     ajusterPlanImport(plan) → plan        (activité proposée seulement pour un jour coché)
============================================================================ */
(function(global){
  "use strict";

  var TAF=global.TAF;
  if(!TAF) return;

  var aPropre=Object.prototype.hasOwnProperty, objetSimple=TAF.objetSimple, texteBorne=TAF.texteBorne;

  /* Bornes (généreuses : aucune donnée réaliste n'est tronquée).
     profils : nombre maximal d'ajouts ; profilsLus : au-delà, un profil lu est ignoré
     (et l'utilisateur en est averti) — en deçà, rien n'est jamais supprimé en silence. */
  var MAX=Object.freeze({ champ:500, commentaire:10000, activite:2000, preset:200, presets:100,
    profils:50, profilsLus:200, nomProfil:60, signatureOctets:15e6, importOctets:25e6, tjm:1e7, charges:100,
    etatImport:4e6,               // état CRA lu dans un fichier : au-delà (caractères JSON), import refusé
    signaturePng:300000 });       // signature PNG restaurée au-delà : re-rastérisée (canevas 600×220)
  var ANNEES=Object.freeze({ min:1970, max:2999 });

  /* ============================================================
     PÉRIODES — jours d'un mois, clés d'archive 'AAAA-MM'
  ============================================================ */
  function joursDansMois(annee, mois0){ return new Date(annee, mois0+1, 0).getDate(); }
  function entierBorne(v, min, max){
    var n=(typeof v==='number')?v:((typeof v==='string' && /^\d{1,4}$/.test(v))?Number(v):NaN);
    return (Number.isInteger(n) && n>=min && n<=max)?n:null;
  }
  function cleArchive(annee, mois0){ return annee+'-'+(mois0<9?'0':'')+(mois0+1); }
  // Clé d'archive valide ET bornée comme l'année du CRA (1970–2999).
  function lireCleArchive(k){
    if(!TAF.valide.mois(k)) return null;
    var a=Number(k.slice(0, 4)), m=Number(k.slice(5, 7))-1;
    return (a>=ANNEES.min && a<=ANNEES.max)?{ annee:a, mois0:m }:null;
  }

  /* ============================================================
     JOURS, ARCHIVE, MODÈLES, CHAMPS
        Clés validées (jour 1..nombre de jours du mois, mois AAAA-MM
        borné), types vérifiés, textes bornés. Aucune affectation sur
        une clé non validée : pas de pollution de prototype possible.
  ============================================================ */
  function validerJour(j){
    if(!objetSimple(j)) return null;
    var r={ am:j.am===true, pm:j.pm===true, act:texteBorne(j.act, MAX.activite) };
    return (r.am || r.pm || r.act.trim())?r:null;
  }
  function validerJours(days, nbJours){
    var out={}, max=(Number.isInteger(nbJours) && nbJours>=1 && nbJours<=31)?nbJours:31;
    if(!objetSimple(days)) return out;
    Object.keys(days).forEach(function(k){
      if(!TAF.valide.jour(k) || Number(k)>max) return;         // ex. 31 en février : écarté
      var j=validerJour(days[k]); if(j) out[k]=j;
    });
    return out;
  }
  function validerArchive(a){
    var out={};
    if(!objetSimple(a)) return out;
    Object.keys(a).forEach(function(k){
      var p=lireCleArchive(k);
      if(!p || !objetSimple(a[k])) return;
      var d=validerJours(a[k].days, joursDansMois(p.annee, p.mois0));
      if(Object.keys(d).length) out[k]={ days:d };
    });
    return out;
  }
  function validerPresets(p){
    var out=[];
    if(!Array.isArray(p)) return out;
    p.forEach(function(t){
      if(typeof t!=='string' || out.length>=MAX.presets) return;
      t=texteBorne(t.trim(), MAX.preset);
      if(t && out.indexOf(t)===-1) out.push(t);
    });
    return out;
  }
  // champs : liste des clés persistées (dérivée du balisage par cra.js) ; rien d'autre n'est lu.
  function validerChamps(f, champs){
    var out={};
    if(!objetSimple(f) || !Array.isArray(champs)) return out;
    champs.forEach(function(k){
      if(!TAF.cleSure(k) || !aPropre.call(f, k) || typeof f[k]!=='string') return;
      out[k]=texteBorne(f[k], k==='comment'?MAX.commentaire:MAX.champ);
    });
    return out;
  }

  /* TJM / charges : chaîne affichable TELLE QUELLE par un <input type=number> (nombre
     flottant valide au sens HTML, ≥ 0) — l'état est donc toujours ce que montre le champ.
     Virgule décimale acceptée à la lecture (ancien format) ; au-delà de max → max. */
  var RX_NOMBRE=/^(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;
  function nombreTexte(v, max){
    var t;
    if(typeof v==='number') t=isFinite(v)?String(v):'';
    else if(typeof v==='string') t=v.trim().replace(',', '.');
    else return '';
    if(!t || t.length>20 || !RX_NOMBRE.test(t)) return '';
    var n=Number(t);
    if(!isFinite(n) || n<0) return '';
    if(typeof max==='number' && isFinite(max) && n>max) return String(max);
    return t;
  }

  /* ============================================================
     ÉTAT COMPLET — chemin unique (restauration locale / import)
        Le mois / l'année invalides prennent ceux de « maintenant » ;
        les jours sont bornés au mois RÉELLEMENT affiché.
  ============================================================ */
  function dateDe(x){
    var d=(x instanceof Date)?x:new Date((typeof x==='number' && isFinite(x))?x:Date.now());
    return isNaN(d.getTime())?new Date():d;
  }
  function validerEtat(s, options){
    options=objetSimple(options)?options:{};
    s=objetSimple(s)?s:{};
    var auj=dateDe(options.maintenant);
    var month=entierBorne(s.month, 0, 11), year=entierBorne(s.year, ANNEES.min, ANNEES.max);
    if(month===null) month=auj.getMonth();
    if(year===null) year=Math.min(ANNEES.max, Math.max(ANNEES.min, auj.getFullYear()));
    return {
      fields:validerChamps(s.fields, options.champs), provisoire:s.provisoire===true,
      tjm:nombreTexte(s.tjm, MAX.tjm), charges:nombreTexte(s.charges, MAX.charges), sig:TAF.sigValide(s.sig),
      month:month, year:year, days:validerJours(s.days, joursDansMois(year, month)),
      presets:validerPresets(s.presets), archive:validerArchive(s.archive)
    };
  }

  /* ============================================================
     IMPORT D'UN FICHIER — forme plausible + choix du format
        nouveau : apparence dans l'objet « prefs » ;
        ancien  : accent / mark / logo / motif au premier niveau ;
        sans apparence : l'apparence courante est conservée.
  ============================================================ */
  function etatPlausible(o){
    if(!objetSimple(o)) return false;
    if(o.days!=null && !objetSimple(o.days)) return false;
    if(o.fields!=null && !objetSimple(o.fields)) return false;
    return ['days','fields','sig','accent','prefs'].some(function(k){ return aPropre.call(o, k); });
  }
  // État CRA stocké (cra_app_v3) : objet plausible, ou objet vide (rien à perdre).
  function etatStockePlausible(o){ return objetSimple(o) && (Object.keys(o).length===0 || etatPlausible(o)); }
  /* Taille (caractères JSON) de la partie « état CRA » d'un objet lu — avant validation,
     apparence exclue (elle vit dans taf_prefs_v1). Infinity si non sérialisable. */
  var CLES_ETAT=['fields','provisoire','tjm','charges','sig','month','year','days','presets','archive'];
  function tailleEtatLu(o){
    if(!objetSimple(o)) return 0;
    var part={};
    CLES_ETAT.forEach(function(k){ if(aPropre.call(o, k)) part[k]=o[k]; });
    try{ var t=JSON.stringify(part); return (typeof t==='string')?t.length:Infinity; }catch(e){ return Infinity; }
  }
  function etatTropLourd(o){ return tailleEtatLu(o)>MAX.etatImport; }
  function lireImport(o, options){
    if(!etatPlausible(o)) return null;
    var nouveau=objetSimple(o.prefs);
    var prefs=nouveau?TAF.validerPrefs(o.prefs):TAF.extrairePrefsCra(o);
    return { etat:validerEtat(o, options), prefs:prefs, format:nouveau?'nouveau':(prefs?'ancien':'sans-apparence') };
  }

  /* ============================================================
     PROFILS D'IDENTITÉ (clé cra_profiles_v1) — validés AU CHARGEMENT
        Un profil = {name, data:{fields, accent, mark, logo, motif, tjm,
        charges}} ; jamais days / sig / month / year. Au-delà de
        MAX.profils, rien n'est supprimé : seuls les AJOUTS sont refusés.
  ============================================================ */
  function validerDonneesProfil(d, champs){
    d=objetSimple(d)?d:{};
    var p=TAF.validerPrefs(d);
    return { fields:validerChamps(d.fields, champs), accent:p.accent, mark:p.mark, logo:p.logo, motif:p.motif,
      tjm:nombreTexte(d.tjm, MAX.tjm), charges:nombreTexte(d.charges, MAX.charges) };
  }
  function validerProfils(a, champs){
    var res={ profils:[], ignores:0 };
    if(!Array.isArray(a)){ if(a!=null) res.ignores=1; return res; }
    a.forEach(function(p){
      var nom=(objetSimple(p) && typeof p.name==='string')?texteBorne(p.name.trim(), MAX.nomProfil):'';
      if(!nom || res.profils.length>=MAX.profilsLus){ res.ignores++; return; }
      res.profils.push({ name:nom, data:validerDonneesProfil(p.data, champs) });
    });
    return res;
  }

  /* ============================================================
     TEXTE BRUT D'UNE CLÉ — 'absent' | 'ok' | 'illisible'
        Distingue la clé ABSENTE (null : valeurs par défaut, écriture
        permise) de la clé ILLISIBLE (JSON invalide ou forme non
        plausible : lecture seule, le brut est gardé pour l'export —
        jamais écrasé en silence). plausible(v) : prédicat de forme.
  ============================================================ */
  function classerBrut(texte, plausible){
    if(texte==null) return { statut:'absent', valeur:null };
    if(typeof texte!=='string') return { statut:'illisible', valeur:null };
    var v;
    try{ v=JSON.parse(texte); }catch(e){ return { statut:'illisible', valeur:null }; }
    if(typeof plausible==='function' && !plausible(v)) return { statut:'illisible', valeur:null };
    return { statut:'ok', valeur:v };
  }

  /* ============================================================
     PASTILLE TRI-ÉTAT — dérivée d'un jour {am, pm} : règle UNIQUE
     portée par le socle (TAF.etatJour), simple alias ici.
  ============================================================ */
  var etatJour=TAF.etatJour;

  /* ============================================================
     PLAN D'IMPORT HEURES (TAF.heures.planifierImport) — ajustement CRA
        Le PDF n'imprime l'activité QUE des jours cochés : une activité
        n'est proposée que pour un jour qui reste coché après l'import
        (sinon le changement serait invisible). Pur, sans mutation.
  ============================================================ */
  function ajusterPlanImport(plan){
    var s=(plan && objetSimple(plan.synthese))?plan.synthese:{};
    var out={ changements:[], synthese:{ joursDetectes:s.joursDetectes||0, joursProposes:s.joursProposes||0, inchanges:s.inchanges||0, ajoutes:s.ajoutes||0, decoches:s.decoches||0 } };
    ((plan && Array.isArray(plan.changements))?plan.changements:[]).forEach(function(c){
      if(!objetSimple(c) || !objetSimple(c.avant) || !objetSimple(c.apres)) return;
      var avant={ am:c.avant.am===true, pm:c.avant.pm===true, act:(typeof c.avant.act==='string')?c.avant.act:'' };
      var apres={ am:c.apres.am===true, pm:c.apres.pm===true, act:(typeof c.apres.act==='string')?c.apres.act:'' };
      if(!apres.am && !apres.pm) apres.act=avant.act;
      if(apres.am===avant.am && apres.pm===avant.pm && apres.act===avant.act){ out.synthese.inchanges++; return; }
      out.changements.push({ jour:c.jour, avant:avant, apres:apres });
    });
    return out;
  }

  /* ============================================================
     EXPOSITION — objet gelé, propriété globale non réassignable
  ============================================================ */
  var API=Object.freeze({
    MAX:MAX, ANNEES:ANNEES,
    joursDansMois:joursDansMois, cleArchive:cleArchive, lireCleArchive:lireCleArchive,
    validerJour:validerJour, validerJours:validerJours, validerArchive:validerArchive,
    validerPresets:validerPresets, validerChamps:validerChamps, nombreTexte:nombreTexte, entierBorne:entierBorne,
    validerEtat:validerEtat, etatPlausible:etatPlausible, lireImport:lireImport,
    etatStockePlausible:etatStockePlausible, tailleEtatLu:tailleEtatLu, etatTropLourd:etatTropLourd, classerBrut:classerBrut,
    validerDonneesProfil:validerDonneesProfil, validerProfils:validerProfils,
    etatJour:etatJour, ajusterPlanImport:ajusterPlanImport
  });
  try{ Object.defineProperty(global, 'CraDonnees', { value:API, writable:false, configurable:false, enumerable:true }); }
  catch(e){ global.CraDonnees=API; }
})(window);
