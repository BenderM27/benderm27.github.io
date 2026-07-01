# Propositions de features — Générateur de CRA

Synthèse des pistes d'évolution issues de quatre angles d'analyse (rapidité de
saisie, fiabilité des données, finition UX/accessibilité, portée &
réutilisabilité), fusionnées et filtrées.

**Critère prioritaire : la généralisation.** Chaque feature retenue doit
laisser l'outil **générique, réutilisable, non couplé à un cas particulier** :
un seul `index.html` auto-suffisant, aucune valeur métier en dur (société,
client, consultant, TJM, layout), une seule source de vérité (`state.days` /
`state`) dont toutes les vues dérivent, 100 % local (aucun réseau, aucune
télémétrie), pas d'`innerHTML` non échappé, responsive à jetons et auto-fit
une-page du PDF préservés, accessibilité WCAG 2.2 AA non régressée. Tout ce qui
est spécifique est **paramétrable / optionnel avec un défaut sensé**.

Les propositions sont classées par ratio **valeur / effort** : les quick wins
d'abord.

## Classement

| # | Feature | Valeur | Effort | Résumé |
|---|---------|--------|--------|--------|
| 1 | Export / import du CRA en `.json` | Élevée | S | Sauvegarde et transfert hors-ligne du même `state`, réimportable — le seul filet contre la perte de `localStorage`. |
| 2 | Témoin d'état de sauvegarde + détection d'échec | Élevée | S | Rend visible et vérifiable que le travail est réellement enregistré ; alerte si quota dépassé ou `localStorage` indisponible. |
| 3 | Modèles d'activité réutilisables (presets) | Élevée | S | Puces cliquables mémorisant les libellés d'activité fréquents pour remplir `defAct` en un clic. |
| 4 | Retour vocal et visuel des actions (`aria-live`) | Élevée | S | Annonce le total et le résultat des actions groupées aux lecteurs d'écran, sans canal purement visuel. |
| 5 | Archive multi-mois locale | Élevée | M | Ne détruit plus le mois précédent au changement de période ; les selects mois/année deviennent un parcours d'historique. |
| 6 | Focus déplacé et piégé dans les surfaces modales | Élevée | M | Fiche du jour, tiroir et calendrier plein écran reçoivent et retiennent le focus clavier (WCAG 2.4.3 / 2.4.11). |
| 7 | Profils d'identité enregistrables | Élevée | M | Capture et rejoue société/client/accent/logo/TJM… pour servir plusieurs clients ou consultants sans tout re-saisir. |

---

### 1. Export / import du CRA en `.json`

**Problème.** La seule sortie actuelle est le PDF (`imprimer()`), qui n'est pas
réimportable. Toute la donnée vit uniquement dans `localStorage` (clé
`cra_app_v3`). Vider le cache, changer de machine, passer en navigation privée,
ou tomber sur `LS===null` (l.784, `localStorage` indisponible) entraîne une
perte totale, sans filet ni transfert possible — tout en restant hors-ligne.

**Fonctionnement.** Deux boutons dans la section « Mes données » du tiroir de
personnalisation (à côté de `clearData`). *Exporter (.json)* : sérialise
l'objet `state` déjà produit par `save()`, via un `Blob` `application/json` +
`URL.createObjectURL` + `<a download>`, nom de fichier dérivé de
`syncNomFichier()` (ex. `CRA_Societe_Mars_2025.json`) ; aucune bibliothèque.
*Importer (.json)* : `<input type="file" accept="application/json">` lu par
`FileReader` (déjà utilisé pour logo/signatures), `JSON.parse` dans un
`try/catch`, validation défensive des clés attendues (`fields`, `days`,
`accent`, `sig`…), puis ré-hydratation de `state` par le même chemin que
`restaurer()` et rappel des fonctions de rendu existantes (`construireGrille`,
`rendreIcones`, `appliquerAccent`, `pads.*.restore`, `recalculer`,
`rafraichirPrint`). Confirmation avant d'écraser un brouillon non vide.

**Impact généralisation & préservation.** Le format exporté **est** déjà le
contrat de `state` : même schéma générique que la persistance, dans les deux
sens, sans hypothèse sur un cas d'usage. Strictement hors-ligne (`Blob` +
`FileReader` + `JSON` natifs, aucun endpoint) : promesse de confidentialité
intacte. Pas de seconde source de vérité (import = ré-hydratation de `state`,
export = lecture directe). Le fichier importé est traité comme donnée non
fiable : aucun `innerHTML`, passage par les setters et l'échappement existants ;
si invalide, on annule proprement sans casser l'état courant. N'impacte ni le
responsive à jetons ni l'auto-fit PDF.

**Effort.** S.

**Valeur.** Élevée.

---

### 2. Témoin d'état de sauvegarde + détection d'échec

**Problème.** `saveSoon()` est un `setTimeout` totalement silencieux (l.785) et
`save()` avale toute erreur dans un `catch(e){}` vide (l.784). Deux angles morts
de confiance : (1) l'utilisateur ne sait jamais si son travail est réellement
enregistré ; (2) si `LS===null` ou si le quota est dépassé — les dataURL de logo
et de signatures canvas sont volumineux et peuvent faire échouer `setItem` —
la sauvegarde échoue en silence, l'utilisateur croyant son CRA à l'abri.

**Fonctionnement.** Un témoin discret dans la topbar (à côté de `brand-text`).
`save()` passe de silencieux à retour booléen (`true`/`false` selon la réussite
de `setItem`), remonté via un unique `setStatut('enregistrement' | 'enregistré'
| 'échec' | 'local indisponible')`. Texte injecté par `textContent` uniquement.
`LS===null` connu dès le chargement affiche un message persistant « Sauvegarde
locale indisponible — pensez à exporter », renvoyant vers l'export JSON
(feature 1). Même alerte en cas d'échec quota. Zone en `aria-live="polite"`,
respect de `prefers-reduced-motion` (via `reduit()`) pour toute transition.

**Impact généralisation & préservation.** Zéro spécifique : indicateur
d'infrastructure valable pour n'importe quel CRA. Aucune donnée ne quitte
l'appareil (on ne fait que refléter l'état de `localStorage`). Pas de nouvel
état métier : le témoin **dérive** du résultat de `save()`, il ne stocke rien en
parallèle. Accessibilité non régressée (`aria-live` natif, contraste via jetons
`--muted`/`--accent`). Rend **vérifiable** la promesse produit « données
enregistrées localement ».

**Effort.** S.

**Valeur.** Élevée.

---

### 3. Modèles d'activité réutilisables (presets)

**Problème.** Le seul levier de saisie de texte est le champ unique `defAct` +
`appliquerActivite()` : le consultant retape (ou copie-colle) la même
formulation d'activité chaque mois, puisque `changerPeriode()` remet
`state.days={}` à zéro. Aucune mémoire des libellés fréquents — c'est le poste
de saisie le plus répétitif.

**Fonctionnement.** Une liste de modèles de libellés persistée dans `state`
(nouvelle clé `state.presets = []`, sérialisée dans `cra_app_v3` comme le
reste). Sous la barre `.aids`, une rangée de puces cliquables : un clic remplit
`defAct.value` avec le modèle (l'utilisateur clique ensuite « Appliquer », donc
aucun changement au flux `appliquerActivite()`). Un bouton « + » enregistre le
contenu courant de `defAct` comme nouveau modèle ; une croix retire une puce.
Rendu via `rendrePresets()` appelée à la restauration et à chaque ajout/
suppression, avec échappement `& < >` (ou `textContent`) — jamais d'`innerHTML`
brut. La liste démarre **vide**, aucune donnée pré-remplie.

**Impact généralisation & préservation.** Les modèles sont saisis par
l'utilisateur, stockés localement, aucun libellé métier codé en dur (le
placeholder existant n'est qu'un exemple). Pur amplificateur du mécanisme
`defAct` déjà générique. Une seule source (`state.presets`), une seule vue
dérivée (`rendrePresets`), barre `.aids` partagée mobile/desktop donc pas de
duplication. Confidentialité intacte.

**Effort.** S.

**Valeur.** Élevée.

---

### 4. Retour vocal et visuel des actions (`aria-live`)

**Problème.** Le total (`totalNum`) ne change qu'avec l'animation `.pulse`, et
les actions groupées `joursOuvres()` / `toutDecocher()` / `appliquerActivite()`
reconstruisent la grille sans aucune annonce. Un utilisateur au lecteur d'écran
ne perçoit ni le passage à X,X jours, ni le résultat d'un clic sur « Jours
ouvrés » ou « Tout décocher ». Lacune de finition et d'accessibilité.

**Fonctionnement.** Une région polie `aria-live="polite"` `.sr-only` unique (la
classe `.sr-only` existe déjà) alimentée par une fonction `annoncer(msg)`
centralisée. Appelée en fin de `recalculer()` — seul point où le total est
recalculé — pour dire « 3,5 jours cochés », et par `joursOuvres` /
`toutDecocher` / `appliquerActivite` pour confirmer l'action (« Jours ouvrés
cochés », « Calendrier vidé », « Activité appliquée à N jours »). Côté visuel,
réutiliser `.pulse` et les jetons pour un micro-toast optionnel non bloquant.
Tout le texte via `textContent`.

**Impact généralisation & préservation.** Neutre : la région dérive du même état
(`recalculer` lit `state.days`), aucune donnée spécifique, aucune logique
dupliquée mobile/desktop puisque `recalculer()` est le point commun. Aucun
réseau, aucun analytics. Messages génériques (jours, activité) sans nom de
société/client. Source de vérité unique préservée en branchant les annonces sur
les fonctions dérivées existantes.

**Effort.** S.

**Valeur.** Élevée.

---

### 5. Archive multi-mois locale

**Problème.** `changerPeriode()` (l.1188-1189) fait `state.days={}` au moindre
changement de mois/année : le mois précédent est écrasé et définitivement
perdu. Un seul CRA existe à la fois — impossible de rouvrir janvier après avoir
commencé février, ni de corriger un mois passé. C'est la première cause de perte
de données de l'outil, et elle est **silencieuse**.

**Fonctionnement.** Un dictionnaire optionnel `state.archive = { 'AAAA-MM': {
days, fields?, sig?, … } }`. Avant de vider `state.days` dans
`changerPeriode()`, on sérialise le mois courant (clé dérivée de
`state.month`/`state.year`) dans `state.archive` s'il contient au moins une
demi-journée cochée ; à l'inverse, en entrant sur un mois, si une entrée
d'archive existe on restaure `state.days` depuis elle. La grille, le tableau
PDF, le total et l'estimation continuent de **dériver** de `state.days` (aucune
vue nouvelle, aucune logique dupliquée). Pas de sélecteur en v1 : les selects
`monthSel`/`yearSel` existants deviennent de fait un parcours d'historique.
Persistance inchangée (même objet `state` sous `cra_app_v3`).

*Variante couverte :* la piste « Reprendre le mois précédent » (report de
l'ossature saisie sur le nouveau mois) devient un simple pré-remplissage
optionnel dérivé d'une entrée d'archive, plutôt qu'un second instantané à
maintenir.

**Impact généralisation & préservation.** Aucun cas d'usage hardcodé : l'archive
est un index par période, agnostique du contenu. 100 % local, zéro réseau.
Source de vérité unique préservée : `state.days` reste LA vérité du mois
affiché, l'archive n'est qu'un magasin sérialisé qu'on hydrate/déshydrate ;
jamais deux états vivants à resynchroniser. La règle « un CRA = un mois » est
respectée côté affichage (un seul mois montré) — on évite juste la destruction.
Rétrocompatible : si `state.archive` absent (anciens brouillons), on le crée
vide.

**Effort.** M.

**Valeur.** Élevée.

---

### 6. Focus déplacé et piégé dans les surfaces modales

**Problème.** `ouvrirFiche()` (l.1029), `ouvrirTiroir()` (l.1089) et
`ouvrirCal()` (l.1091) affichent des surfaces modales mais ne déplacent jamais
le focus à l'intérieur et ne le piègent pas : au clavier, le focus reste sur la
page derrière, sous l'overlay. À la fermeture, il n'est pas rendu au
déclencheur. Défaut d'ergonomie clavier et trou WCAG 2.2 (2.4.3 Focus Order,
2.4.11 Focus Not Obscured) sur des composants déjà pensés accessibles
(`aria-hidden` géré, mais pas le focus).

**Fonctionnement.** Une fonction générique `gererModale(panneau, declencheur)` :
à l'ouverture, mémoriser `document.activeElement`, déplacer le focus sur le
premier contrôle interactif du panneau (ou son titre avec `tabindex="-1"`), et
installer un gestionnaire `keydown` Tab qui boucle le focus à l'intérieur (focus
trap) tant que le panneau est ouvert. À la fermeture, retirer le piège et rendre
le focus au déclencheur. Réutiliser le handler Escape déjà présent. Aucun HTML
nouveau hormis un `tabindex="-1"` sur les titres existants
(`#daySheetTitle`, `.drawer-head h2`, `.cal-mobile-head .cal-title`).

**Impact généralisation & préservation.** Totalement générique : la même
fonction sert les trois surfaces, donc pas de logique dupliquée ni de couplage à
un cas d'usage. Aucun contenu spécifique, aucun réseau. Responsive à jetons
intact (aucune taille touchée) et auto-fit PDF intact (modales déjà masquées à
l'impression). Respecte `prefers-reduced-motion` : on ne touche qu'au focus, pas
aux animations.

**Effort.** M.

**Valeur.** Élevée.

---

### 7. Profils d'identité enregistrables

**Problème.** L'outil ne mémorise qu'**une** configuration (`cra_app_v3`). Un
consultant qui facture plusieurs clients/ESN, ou une société avec plusieurs
consultants, doit re-saisir à chaque fois société, client, destinataire, rôles
des signataires, accent, logo/icône, motif, TJM/charges. C'est le cas d'usage le
plus fréquent et le plus pénible, sans rien de spécifique à une entreprise.

**Fonctionnement.** Une section « Profils » dans le tiroir : bouton « Enregistrer
comme profil » (nom libre) et une liste de profils avec « Appliquer » /
« Supprimer ». Un profil = un sous-ensemble sérialisable de l'état **déjà
existant** : `state.fields`, `state.accent`, `state.mark`, `state.logo`,
`state.motif`, `state.tjm`, `state.charges`. Volontairement, un profil
**n'inclut pas** `state.days`, `state.sig` ni `month`/`year` (calendrier et
signatures restent propres au CRA du mois). Stockage dans une clé séparée (ex.
`cra_profiles_v1`), à côté de `STORE_KEY`. Appliquer un profil = écrire dans
`state` puis rappeler les fonctions de rendu existantes (`appliquerAccent`,
`rendreIcones`, `appliquerMotif`, `majEstimation`, remplissage des inputs
`data-k`). Libellés via `textContent`, jamais `innerHTML`. Liste vide au départ,
aucun profil pré-rempli (pas de profil « ALVEOLEN » livré).

**Impact généralisation & préservation.** Renforce la généralisation : on ne
fait que capturer/rejouer des champs **déjà paramétrables**, rien de spécifique
en dur. Clé `localStorage` séparée, pas de seconde copie de l'état vivant à
resynchroniser (un profil est un instantané appliqué via les setters existants).
100 % local, aucun réseau. PDF auto-fit et responsive non touchés (seules des
valeurs d'état déjà gérées sont modifiées).

**Effort.** M.

**Valeur.** Élevée.

---

## Écartées / fusionnées

- **Export / import `.json` (doublon).** Deux propositions identiques fusionnées
  dans la feature 1.
- **Reprendre le mois précédent.** Absorbée par l'archive multi-mois (feature
  5) : plutôt qu'un second instantané `state.dernierSchema` à maintenir, le
  report devient un pré-remplissage optionnel depuis une entrée d'archive.
- **Snapshot d'annulation (undo).** Solide (S / moyenne), complémentaire de la
  feature 2 ; conservée comme runner-up mais sortie du top 7 pour rester sur les
  ratios les plus forts.
- **État vide guidant + garde-fou d'export.** Bonne finition (M / élevée) mais
  chevauche partiellement les features 2 et 4 ; runner-up.
- **Repérage des jours fériés, unité jours/heures, locale/devise
  paramétrables, sélection Shift-clic, raccourcis clavier, `aria-current`
  jour courant.** Toutes conformes à la généralisation, mais de ratio valeur/
  effort inférieur (valeur moyenne, ou effort M–L) ; à considérer dans un
  second temps.
