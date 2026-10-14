/* ============================================================================
   TAF — HARNAIS DE TESTS (tests/harnais.js)
   Zéro dépendance. Les fichiers de tests (tests.js, heures.test.js) déclarent
   leurs cas avec TafTests.test(nom, fn) ; l'exécution démarre au
   DOMContentLoaded (après tous les scripts defer). Un test peut renvoyer une
   chaîne (détail affiché) ou une promesse.
   Le stockage est TOUJOURS simulé en mémoire (TAF.creerMemoire) : aucun test
   ne lit ni n'écrit le localStorage réel.
   Résultat exposé pour l'automatisation : body[data-etat="ok"|"echec"] et
   body[data-bilan="réussis/total"].
============================================================================ */
(function(){
  "use strict";
  var tests=[];
  function test(nom, fn){ tests.push({ nom:nom, fn:fn }); }
  function egal(obtenu, attendu, msg){
    var a=JSON.stringify(obtenu), b=JSON.stringify(attendu);
    if(a!==b) throw new Error((msg?msg+' — ':'')+'obtenu '+a+', attendu '+b);
  }
  function vrai(v, msg){ if(!v) throw new Error(msg||'valeur fausse'); }
  function leve(fn, msg){ var ok=false; try{ fn(); }catch(e){ ok=true; } if(!ok) throw new Error(msg||'aucune exception levée'); }
  function attendre(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function espaces(s){ return String(s).replace(/\s/g, ' '); }   // espaces fines insécables fr-FR → espace simple

  function lancer(){
    var liste=document.getElementById('resultats'), resume=document.getElementById('resume');
    var reussis=0, i=0;
    if(!window.TAF){ resume.textContent='TAF introuvable : assets/taf.js n’a pas été chargé.'; document.body.setAttribute('data-etat','echec'); return; }
    function suivant(){
      if(i>=tests.length){
        var ok=reussis===tests.length;
        document.body.setAttribute('data-etat', ok?'ok':'echec');
        document.body.setAttribute('data-bilan', reussis+'/'+tests.length);
        resume.textContent=(ok?'Tous les tests passent — ':'Échecs — ')+reussis+' / '+tests.length+' réussis';
        return;
      }
      var t=tests[i++], li=document.createElement('li'), texte=document.createElement('span');
      texte.textContent=t.nom; li.appendChild(texte); liste.appendChild(li);
      Promise.resolve().then(t.fn).then(function(detail){
        reussis++;
        if(typeof detail==='string'){ var d=document.createElement('span'); d.className='t-detail'; d.textContent=detail; texte.appendChild(d); }
      }, function(err){
        li.className='ko';
        var d=document.createElement('span'); d.className='t-detail'; d.textContent=String(err && err.message || err); texte.appendChild(d);
      }).then(suivant);
    }
    suivant();
  }
  document.addEventListener('DOMContentLoaded', lancer);
  window.TafTests=Object.freeze({ test:test, egal:egal, vrai:vrai, leve:leve, attendre:attendre, espaces:espaces });
})();
