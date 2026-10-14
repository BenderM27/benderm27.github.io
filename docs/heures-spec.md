# Spécification — Module Heures de TAF (`heures.html`)

> Document de référence du module Heures (cf. CLAUDE.md §1, §9). Il est implémentable en une passe par un agent front.
> Fichiers : `heures.html`, `assets/heures.css`, `assets/heures.js`, des ajouts dans `assets/taf.js` et `assets/taf.css`, le dialogue d'import dans `assets/cra.js` / `assets/cra.css`, et des tests dans `tests/`.
> Tout est en français : UI, code et commentaires.

---

## 1. Vision et principes UX

**Promesse.** « Pointer en un geste, corriger en deux, et à la fin du mois, le CRA se remplit tout seul. » Heures est l'outil du quotidien du consultant : un chrono sous le pouce, une journée type en un toucher, une semaine lisible d'un regard. Le CRA reste le document signé, et Heures en est la source de mesure.

Principes :
1. **Le temps n'est jamais compté en mémoire.** Tout dérive d'horodatages et de plages stockés. Le rechargement, la fermeture, la veille ou un autre onglet ne perdent rien.
2. **Une action principale par vue** :
   - Jour (aujourd'hui) : le chrono ;
   - jour passé vide : « Journée type » ;
   - Semaine : « Remplir N jours ouvrés vides » ;
   - Mois : « Ouvrir dans le CRA ».
3. **Préremplir plutôt que demander.** Chaque formulaire s'ouvre sur la valeur la plus probable : fin de la dernière plage, maintenant arrondi, journée type.
4. **Tout se défait.** Pas de `confirm()`. Les actions sont immédiates, avec un toast « Annuler » et Ctrl/Cmd+Z. Les seules confirmations, intégrées à la page, concernent la réinitialisation des données, l'import JSON et le remplacement du mois dans le CRA.
5. **La forme avant la couleur.** Les hexagones creux, demi ou pleins (grammaire de la pastille CRA) et les niveaux d'alvéole portent l'information, doublée d'un texte.
6. **Généricité.** Aucun projet, objectif ou horaire n'est codé en dur. Tout est réglable, avec des défauts sensés (35 h, 7 h, 09:00, coupure 13:00).
7. **Un seul écrivain.** `heures.js` est le seul à écrire `taf_heures_v1`. Le CRA lit, convertit via `taf.js`, et écrit seulement dans sa propre clé.

## 2. Périmètre

### 2.1 MVP (livré maintenant)

**Socle**
- `heures.html` : titre fixe `TAF`, CSP stricte identique au CRA, `<meta name="referrer" content="no-referrer">`, scripts classiques `defer` (`taf.js` puis `heures.js`), aucun inline.
- Navigation de modules partagée (topbar ≥ 700 px, barre d'onglets basse < 700 px), témoin de sauvegarde partagé, view-transition inter-pages.

**Chrono horodaté**
- Démarrer / Pause / Reprendre / Arrêter, avec écriture synchrone.
- Survie au rechargement, au bfcache et à la veille ; synchronisation entre onglets.
- « Démarrer à… », « Arrêter à… », correction du début en cours.
- Changement de projet en marche.
- Garde du chrono oublié et découpe à minuit.

**Pointeuse** : un seul composant DOM, présenté en dock (mobile), en pilule flottante (tablette) ou en carte collante (desktop).

**Vue Jour**
- En-tête de jour et bande semaine à 7 mini-hexagones.
- Jauge du jour, frise horizontale avec ligne de coupure et ligne « maintenant ».
- Liste des plages, ligne « En cours » dérivée.
- « Journée type » / « Compléter avec la journée type », « + Plage ».

**Feuille Plage**
- Préremplissage, tuiles Début / Fin à ±5 min, durées rapides.
- Saisie rapide analysée avec aperçu.
- Projet, note, aperçu de chevauchement (« la plus récente gagne »).
- Supprimer, « Reprendre ▶ » (relance le chrono sur le même projet et la même note).

**Journée type** : une seule, proposée au premier lancement et éditable dans les réglages. « Enregistrer ce jour comme journée type ».

**Vue Semaine** : jauge hexagonale d'objectif, frise des 7 jours (une rangée par jour) et « Remplir N jours ouvrés vides » (jours ≤ aujourd'hui seulement).

**Vue Mois** : alvéoles à niveau, aperçu CRA (½ / 1 j), synthèse (total, jours pointés, moyenne, équivalent CRA), répartition par projet, « Voir en tableau ».

**Annuler universel** : toast de 8 s, Ctrl/Cmd+Z et Ctrl/Cmd+Maj+Z, pile de 20 en mémoire.

**Projets** : nom, teinte 0–7, archivage.

**Réglages** (§8), dont la persistance (`navigator.storage.persist()`) et le rappel de sauvegarde.

**Exports et import**
- CSV « Détail des plages » et « Synthèse par jour » (§9).
- Sauvegarde JSON et restauration JSON en mode remplacement, avec rapport.

**Pont CRA**
- `TAF.heures.*` dans taf.js.
- Bouton « Depuis mes heures » et dialogue d'aperçu Compléter / Remplacer dans le CRA.
- Fragment `#heures-AAAA-MM` ; pastille « en cours » sur l'onglet Heures (les deux pages).

**Tests** : `tests/` (§15), plus la matrice responsive de CLAUDE.md §4.

### 2.2 Plus tard (hors MVP, ne pas implémenter)
- Plusieurs journées types et actions groupées par sélection de jours.
- Glisser pour créer, redimensionner ou déplacer des blocs sur la frise ; mini-frise à poignées.
- Glisser une ligne pour la supprimer.
- Statuts congé / férié / absence, objectif proratisé, solde cumulé.
- Onglet Tendances (8 / 12 / 26 semaines), médianes d'arrivée et de départ.
- Seuil « journée complète » (total ≥ X ⇒ 1 j).
- Facturation : TJM / taux par projet, « marquer facturé », clients.
- Import JSON en mode fusion (par id + horodatage de modification).
- PWA / service worker, notifications locales, favicon d'état.
- Relevé d'heures imprimable A4 ; vue d'écarts CRA ↔ Heures ; option « main gauche ».

## 3. Écrans et disposition

### 3.1 Structure commune
```
header.topbar (TAF + bascule de modules ≥700 / bouton Réglages)
nav.vues  [Jour | Semaine | Mois]  ← liens #jour #semaine #mois, aria-current="page"
main#contenu
aside#pointeuse (composant chrono unique)
nav.onglets-modules (< 700 px, en bas)
div#toasts (role=status)  · div#liveHeures (aria-live polite, sr-only)
```
- Sous-vue pilotée par le hash, en liste blanche : `#jour`, `#semaine`, `#mois`, `#pointer`. Toute autre valeur donne `#jour`.
- La période affichée (jour / semaine / mois) vit en mémoire et en `sessionStorage` (`taf_heures_ui`, try/catch). Elle ne va jamais dans `taf_heures_v1`.
- Lien d'évitement « Aller au chrono » en tête de page.

### 3.2 Paliers

| Palier | Disposition |
|---|---|
| **Mobile < 700** | Une colonne. `nav.vues` est un contrôle segmenté collant sous la topbar (`top: calc(var(--topbar-h) + env(safe-area-inset-top))`). La **Pointeuse en dock** (64 px) est fixée au-dessus de la barre d'onglets de modules (56 px + safe-area). Contenu : `padding-bottom: calc(var(--dock-h) + var(--tabbar-h) + env(safe-area-inset-bottom) + 16px)`. Toasts empilés au-dessus du dock. |
| ≤ 389 | Hexagone du dock à 52 px, chiffres à `clamp(18px,5.5vw,22px)`, puce de projet masquée du dock (visible dans la feuille Chrono). |
| Paysage court (hauteur ≤ 500) | Dock compact de 52 px, frise du jour masquée (la liste suffit), segmenté de 40 px, jauges en ligne. |
| **Tablette 700–1023** | Bascule de modules dans la topbar (pas de barre basse). Colonne centrée `max-width: 760px`. **Pointeuse en pilule flottante** centrée en bas (`max-width: 560px`, `--radius`, `--shadow-pop`, safe-area). Semaine : frise pleine largeur. Mois : grille d'alvéoles à gauche et synthèse dessous ; à partir de 900 px, deux colonnes. |
| **Desktop ≥ 1024** | Grille `minmax(340px,380px) minmax(0,1fr)`, avec un gap de 24 px. **Colonne gauche collante** : carte Pointeuse (chiffres de 48 px, hexagone de 88 px), bouton Journée type, **champ de saisie rapide toujours visible** (focus avec `/`). **Colonne droite** : `nav.vues` puis la vue. |
| ≥ 1280 | Frises plus hautes (rangées de 56 px). Mois : alvéoles à gauche, synthèse et projets à droite. |
| ≥ 1600 | Contenu plafonné à `max-width: 1360px`, centré. |

- Les composants (jauge, frise, ruche) dimensionnent leur contenu par **container queries** (`container-type: inline-size`), pas par la largeur d'écran.
- Zéro débordement horizontal à tous les paliers et au zoom 200 %, surfaces ouvertes comme fermées.

### 3.3 Vue Jour

**En-tête**
- `h1` « Mardi 14 octobre » (format long fr-FR), boutons ‹ › de 44 px, et bouton « Aujourd'hui » visible seulement hors du jour courant.
- Un glissement horizontal sur l'en-tête change de jour : seuil de 60 px, et seulement si |dx| > 1,5·|dy|.

**Bande semaine**
- 7 boutons (L…D) avec un mini-hexagone dont le niveau vaut min(1, total / dureeJour), plus le total en chiffres (`7,5`).
- `aria-label` « Lundi 13 octobre, 7 h 05 » ; `aria-current="date"` sur aujourd'hui.
- Le jour affiché porte `aria-pressed="true"` et un indicateur qui glisse en `translateX`.

**Carte total**
- Jauge hexagonale (composant `rendreJauge`, §3.5) sur la base de la durée de la journée.
- Texte « 5 h 42 sur 7 h ». Selon le cas, « reste 1 h 18 » ou « + 0 h 45 au-delà ».
- Ligne CRA : « Matin 3 h 30 · Après-midi 2 h 12 → ½ j CRA (matin) », dérivée de `TAF.heures.demiJournees`.

**Frise du jour** (`rendreFrise`, une seule rangée de 64 px)
- Axe automatique (§6.9) avec graduations ; ligne pointillée de coupure marquée « M | A ».
- Ligne « maintenant » si le jour affiché est aujourd'hui.
- Blocs : fond `--accent-fill`, liseré gauche de 4 px à la teinte du projet.
- Le segment en cours est un bloc fantôme hachuré qui s'élargit à chaque minute.
- La frise est décorative (`aria-hidden="true"`). Un clic ou un toucher sur une zone vide ouvre la feuille Plage préremplie à l'heure visée, arrondie à 15 min (début), avec fin = début + 1 h.

**Liste des plages** (source accessible)
- `<ul>`, une ligne `<button>` de 56 px minimum par plage : « 09:02 → 12:31 », durée « 3 h 29 », monogramme + nom du projet, note tronquée, icône d'origine (chrono / saisie / journée type) avec un `title` textuel.
- Ligne « En cours depuis 13:40 · 1 h 12 » dérivée du chrono si `t0` tombe le jour affiché. Elle ouvre la feuille Chrono.
- Plage rognée par chevauchement résiduel à la lecture : aucune, puisque la normalisation garantit l'absence de chevauchement.

**Actions du jour**
- Jour vide : deux gros boutons, « Journée type · 7 h » (primaire si le jour est passé ou si le chrono est actif ailleurs) et « + Plage ».
- Jour entamé : « Compléter avec la journée type » (secondaire) et « + Plage ».
- Menu ⋯ : « Enregistrer ce jour comme journée type », « Vider le jour » (toast Annuler).

**Bannières** (en tête de vue, une à la fois, par priorité)
1. Données illisibles ou version future (§5.5).
2. Chrono oublié (§4.1).
3. Stockage indisponible (« Mode temporaire : rien n'est enregistré sur cet appareil »).
4. Rappel de sauvegarde (« Dernière sauvegarde il y a 34 jours · Exporter · Plus tard »).

### 3.4 Pointeuse (composant chrono unique `#pointeuse`)

- **Contenu commun**
  - Pastille d'état textuelle (« Prêt », « En marche », « En pause »).
  - Chiffres `HH:MM:SS` (secondes plus petites, en `--muted`, masquées si `secondes=false`).
  - Sous-ligne « Projet X · depuis 09:02 » ou « En pause depuis 12:31 · 18 min ».
  - **Hexagone principal** (60 px en dock, 88 px en carte) et **■ Arrêter** (48 px, visible seulement en marche ou en pause).
  - Bouton ⋯ « Plus d'options » qui ouvre la feuille Chrono.
- **Encodage par la forme** :
  - repos = hexagone creux + ▶ et le texte « Démarrer » ;
  - marche = hexagone plein accent + ❚❚ et « Pause » ;
  - pause = hexagone à moitié plein + ▶ et « Reprendre ».
- **Mobile (dock)** : à gauche la zone d'info (bouton qui ouvre la feuille Chrono), au centre ■, à droite l'hexagone sous le pouce. Appui long de 450 ms sur l'hexagone au repos : « Démarrer à… » ; sur ■ : « Arrêter à… ». Le bouton ⋯ en est l'alternative non gestuelle.
- **Tablette** : même contenu en pilule flottante.
- **Desktop** : carte avec boutons secondaires visibles (« Démarrer à… », « Arrêter à… », « Corriger le début », puce Projet). Ils ouvrent la même feuille Chrono, rendue en dialogue centré de 480 px.
- **Feuille Chrono** (une seule surface `role=dialog`)
  - Grand affichage et segments de la session (liste, avec les pauses visibles).
  - « Début 09:02 [−5] [+5] [heure…] » en marche.
  - Choix du projet : puces des 5 projets les plus récents (dérivées des plages), « Tous les projets », « Sans projet », « + Nouveau projet ».
  - Note (≤ 200).
  - Puces « Démarrer à… » : il y a 5 / 10 / 15 / 30 min, heure de début de la journée type, Autre (`input type=time`).
  - Puces « Arrêter à… » : fin de la journée type, Autre (date + heure).
  - En marche, « Changer de projet » demande « à partir de maintenant » ou « pour toute la session ».

### 3.5 Composants visuels partagés de la page (dans heures.js, purs, sans état interne)
- `rendreJauge(conteneur, valeurMin, objectifMin, libelle)` : SVG construit par `createElementNS` à partir de constantes.
  - 6 côtés = 6 `<rect>` pivotés ; chaque côté vaut 1/6 de l'objectif et se remplit par `transform: scaleX(var(--f))`.
  - Au-delà de l'objectif, un hexagone extérieur pointillé apparaît (opacity) avec le texte « + 1 h 15 ».
  - `role="img"` avec `aria-labelledby` vers le texte visible.
  - Objectif 0 : jauge masquée, total seul.
- `rendreFrise(conteneur, rangées, axe, options)` : une rangée = `{ cle, libelle, plages, enCours }`.
  - Positions posées par `el.style.setProperty('--deb', pct)` et `('--lar', pct)`.
- `rendreRuche(conteneur, mois)` : alvéoles (§3.7).

### 3.6 Vue Semaine

**En-tête** : « Semaine 42 · 12–18 oct. » (numéro ISO 8601) avec ‹ › et « Cette semaine ».

**Héros**
- Jauge hexagonale de 132 px en mobile, 168 px sur tablette, 200 px en desktop.
- Tuiles (2×2 en desktop, empilées en mobile) :
  - **Semaine** « 31 h 30 / 35 h » ;
  - **Reste** « 3 h 30 », ou « Objectif atteint ✓ », ou « + 1 h 15 au-delà de l'objectif » (libellés neutres, aucun calcul légal d'heures supplémentaires) ;
  - **Aujourd'hui** « 5 h 20 » ;
  - **Équivalent CRA** « 4,5 j ».

**Frise de la semaine** (`rendreFrise`, 7 rangées lun → dim de 44 px en mobile, 56 px dès 1280)
- Chaque rangée est un `<button>` entier qui ouvre la vue Jour de ce jour.
- Libellé « Lun 13 » et total à droite ; jour ouvré passé et vide marqué « vide » en texte.
- Ligne de coupure M | A sur toute la hauteur ; ligne « maintenant » sur la rangée du jour.
- Week-end non ouvré et vide : rangées repliées en une seule « Sam 17 · Dim 18 — rien », qui se déplie au toucher.

**Action principale** : bouton collant « Remplir 3 jours ouvrés vides » (au-dessus du dock en mobile). Il est affiché seulement si N > 0 et si une journée type existe. Il ne remplit que les jours ouvrés ≤ aujourd'hui sans aucune plage.

**État vide** : frise fantôme pointillée et texte « Aucune heure cette semaine. Démarrez le chrono ou appliquez votre journée type. »

### 3.7 Vue Mois

**En-tête** : « Octobre 2026 » avec ‹ › et « Ce mois ».

**Ruche**
- Grille de 7 colonnes à partir du lundi. Chaque cellule est un `<button>` carré, sans gap, de 44 px minimum. À 320 px, la carte passe bord à bord avec 6 px de padding : 7 × 44 = 308 px.
- L'hexagone (clip-path) est dessiné *à l'intérieur*. Il contient un « liquide » translaté en Y selon le niveau : `clamp(total / dureeJour, 0, 1)`.
- Numéro du jour ; total (« 7,5 ») affiché si la cellule fait ≥ 52 px (container query).
- Mini-pastille CRA tri-état de 14 px (vide / demi gauche / demi droite / pleine), forme identique au CRA.
- États :
  - jour non ouvré : contour pointillé ;
  - futur : contour fin, vide ;
  - au-delà de la durée de la journée : anneau `--accent-deep` ;
  - aujourd'hui : anneau encre, numéro en gras, `aria-current="date"`.
- Jours hors mois : cellules vides non interactives.
- Navigation clavier type sélecteur de date (tabindex mobile) : ←→↑↓ pour les jours, Origine / Fin pour la semaine, PageHaut / PageBas pour le mois, Entrée pour ouvrir la vue Jour.
- `aria-label` complet, par exemple « Mardi 14 octobre : 7 h 45, équivalent CRA journée complète ».

**Synthèse**
- Total du mois, jours pointés, moyenne par jour pointé, **équivalent CRA « 18,5 j »** (somme de `demiJournees`).
- Répartition par projet : barres horizontales en `scaleX`, libellé, valeur et %, « Sans projet » inclus, pourcentages par la méthode du plus fort reste.

**Actions**
- Primaire : « Ouvrir dans le CRA » (lien `index.html#heures-AAAA-MM`).
- Secondaires : « Exporter… » (dialogue §9) et « Voir en tableau ».
- « Voir en tableau » bascule vers un `<table>` avec `<caption>` et `th scope` : Date · Total · Matin · Après-midi · CRA · Projets.

### 3.8 Feuille Plage (ajout / édition)
- Conteneur : feuille basse < 700 px (poignée, glisser vers le bas > 80 px pour fermer) ; dialogue centré de 480 px au-delà. Même DOM, une classe par palier.
- Titre « Nouvelle plage · mar. 14 oct. » ou « Modifier la plage ».
- **Saisie rapide** : `input` texte de 16 px, placeholder « 9-12:30 @projet note ».
  - Aperçu analysé en direct sous le champ, en puces (« 09:00 → 12:30 · 3 h 30 · Client A »), relié par `aria-describedby`.
  - Erreur en texte avec `aria-invalid`.
  - Entrée valide si l'analyse est OK.
- **Tuiles Début / Fin** : `input type=time` natif (`step=60`, label visible) et boutons −5 / +5 de 44 px (Maj ou appui long : ±15). « Fin 24:00 » possible par la case « jusqu'à minuit ».
- Durées rapides : « Maintenant » (fin), « +30 min », « +1 h », « +2 h », « ½ journée » (dureeJour / 2).
- Durée calculée affichée en direct (annoncée seulement à l'enregistrement).
- **Encart de chevauchement** si la plage recouvre une plage existante : « Chevauche 13:00–14:00 (Projet B) → sera rognée à 13:00–13:30 ».
- Projet (puces récentes + « Tous » + « Sans projet » + « + Nouveau »), note (≤ 200, compteur).
- Pied :
  - édition : [Supprimer] (ghost danger), « Reprendre ▶ » et [Enregistrer] (primaire, pleine largeur en mobile) ;
  - création : [Enregistrer] seul.
- Focus initial : la saisie rapide pour une création, la tuile Fin pour une édition.

### 3.9 Réglages (tiroir)
Même composant tiroir que le CRA (taf.css) : plein écran glissant < 700 px, `min(440px, 92vw)` à droite au-delà. Sections repliables (`details`/`summary`) : Journée et semaine · Conversion CRA · Chrono · Journée type · Projets · Raccourcis · Mes données Heures · Apparence (section partagée fournie par `TAF.apparence`). Détail au §8.

### 3.10 Premier lancement
Si `meta.accueilVu === false`, une carte « Votre journée type » s'affiche à la place de la liste (vue Jour) ou en tête de la colonne droite (desktop).
- Deux plages préremplies depuis les réglages (09:00–12:30 et 13:30–17:00, cf. §6.10), modifiables par ±15 min et `input time`.
- [C'est ma journée] enregistre `reglages.journeeType` et `accueilVu=true`. [Passer] fait seulement `accueilVu=true`.
- Indice : « Touchez l'hexagone pour démarrer le chrono. »
- Aucun projet n'est créé.

### 3.11 États d'erreur
- **Stockage indisponible** : bannière persistante et témoin « indisponible ». Tout fonctionne en mémoire ; l'export reste possible.
- **Quota dépassé** à l'écriture : l'état en mémoire revient à l'état d'avant la mutation, le témoin passe à « Échec — exportez » et un toast d'erreur s'affiche.
- **Données illisibles ou version future** : §5.5.
- **Horloge reculée** (now < t0) : la durée affichée vaut 0 et la feuille Chrono affiche l'avertissement « L'horloge de l'appareil a reculé ».

## 4. Interactions détaillées

### 4.1 Chrono

**Démarrer** (repos)
- Écriture synchrone de `chrono = {e:'marche', t0:maintenantArrondiDebut(), tp:null, p, n:'', s:nouvelId('s')}`.
- `p` = le projet de la plage d'origine `c` la plus récente si `projetDemarrage='dernier'`, sinon `''`.
- Au premier démarrage, `navigator.storage.persist()` (geste utilisateur, résultat ignoré si absent).
- Vibration de 10 ms (si `vibration` et sans reduced-motion). Annonce : « Chrono démarré à 9 h 02 ».

**Pause** (marche)
- Le segment `[t0, now]` est découpé et arrondi (§6.3), puis inséré dans `jours` avec `o:'c'` et `s`.
- `chrono = {e:'pause', t0:null, tp:now, p, n, s}`. Annonce : « Pause, segment de 3 h 29 enregistré ».

**Reprendre** (pause) : `t0 = now`, `tp = null`, même `s`, même `p` et même `n`.

**Arrêter**
- Depuis la marche : comme Pause, puis `chrono = null`.
- Depuis la pause : `chrono = null` (rien à écrire).
- Toast « Session enregistrée · 7 h 12 · Annuler ». Annuler restaure les jours touchés et le chrono à l'identique (même `t0`).

**Démarrer à…** : `t0 = maintenant − X` ou l'heure choisie aujourd'hui. Borné à `[maintenant − 24 h, maintenant]`.

**Arrêter à…** : fin choisie dans `[t0, maintenant]` (date + heure). La découpe à minuit est appliquée.

**Corriger le début** (marche) : ±5 min ou une heure précise. Nouveau `t0` dans `[maintenant − 24 h, maintenant]`. Un éventuel chevauchement avec une plage existante est résolu à l'enregistrement du segment (« la plus récente gagne »), et le toast nomme la plage rognée.

**Changer de projet en marche**
- « à partir de maintenant » : enregistre `[t0, now]` avec l'ancien `p`, puis `t0 = now` avec le nouveau `p` et le même `s`.
- « pour toute la session » : réétiquette toutes les plages portant `s` et le chrono.
- En pause : change `chrono.p` seulement.

**Chrono oublié**
- Au chargement, au `visibilitychange` visible, au `pageshow` et à l'Arrêter : si `e==='marche'` et (`now − t0 > alerteOubliMin` ou jour local de `t0` ≠ aujourd'hui), afficher la bannière (`role="alert"`, une seule fois par `s`, mémorisée en `sessionStorage`).
- Texte : « Chrono en marche depuis hier 09:02 (24 h 38) ».
- Trois boutons :
  - « Arrêté à 17:30 » : fin de la journée type du jour de `t0`, sinon `t0 + dureeJour`, bornée à now ;
  - « Choisir l'heure… » : feuille Arrêter à… ;
  - « C'est correct ».
- Aperçu de découpe affiché : « 09:02–24:00 mar. · 00:00–09:40 mer. ».
- Une session de plus de 24 h demande une confirmation intégrée.

**Tick d'affichage**
- `setTimeout` aligné sur la prochaine seconde (ou minute si `secondes=false`). Il ne modifie que des `textContent`.
- Suspendu si `document.hidden`, recalculé sur `visibilitychange` et `pageshow`.
- La frise et la jauge sont rafraîchies à la minute.

### 4.2 Plages
- **« + Plage »** : préremplissage (§6.10). Le cas courant tient en deux touchers (+ Plage, Enregistrer).
- **Enregistrer** : validation (fin > début, sauf 24:00 ; durée ≥ 1 min), puis `insererPlage` (§6.4) dans `muter`. Toast « Plage ajoutée · 3 h 30 · Annuler » ; si une plage a été rognée : « … · 13:00–14:00 rognée · Annuler ».
- **Édition** : la plage modifiée est retirée puis réinsérée (elle devient « la plus récente »). Elle garde son `id` et son `o`, et `s` est conservé.
- **Supprimer** (bouton dans la feuille, ou touche Suppr sur une ligne focalisée en desktop) : suppression immédiate, toast Annuler, focus rendu à la ligne suivante, sinon à « + Plage ».
- **Reprendre ▶** : démarre le chrono avec le `p` et la `n` de la plage (un chrono actif est d'abord arrêté, avec un seul toast « Chrono basculé · Annuler »).
- **Saisie rapide** (desktop colonne gauche ou feuille) : `analyserSaisie` (§6.8). Entrée enregistre toutes les plages de l'aperçu en une seule mutation (un seul Annuler). L'aperçu est obligatoire : pas d'enregistrement si l'analyse a une erreur.

### 4.3 Journée type
- **Jour vide** : « Journée type · 7 h » applique `reglages.journeeType` (plages `o:'m'`, `s` absent).
- **Jour entamé** : « Compléter avec la journée type » n'ajoute que les plages du modèle qui ne chevauchent **rien** d'existant. Si aucune ne convient : toast « Rien à compléter ».
- **« Enregistrer ce jour comme journée type »** : copie `{d,f,p}` des plages du jour, au plus 8 ; une confirmation intégrée apparaît si une journée type existe déjà (« Remplacer la journée type actuelle ? »).
- **Semaine « Remplir N jours ouvrés vides »** : une seule mutation, toast « 3 jours remplis · 21 h · Annuler ».
- **Sans journée type** : les boutons deviennent « Définir ma journée type », qui ouvre la section du tiroir.

### 4.4 Navigation de période
- Jour : ‹ ›, glissement sur l'en-tête, bande semaine, ← / → (raccourcis), « Aujourd'hui » / T.
- Semaine et Mois : ‹ › et ← / →.
- Changement de période : transition orientée (§11) et annonce « Mercredi 15 octobre, 7 h 05 ».
- `#pointer` (favori d'écran d'accueil) : vue Jour aujourd'hui, focus sur l'hexagone (halo bref).
  - Si `autoPointer` est vrai, que le chrono est au repos et que `performance.getEntriesByType('navigation')[0].type === 'navigate'`, démarrer, puis afficher le toast « Chrono démarré · Annuler ».
  - Le fragment est remplacé par `#jour` via `history.replaceState`.

### 4.5 Projets
- Création en ligne (feuille Plage, feuille Chrono, tiroir) : nom de 1 à 40 caractères (espaces rognés, doublon insensible à la casse et aux accents refusé), teinte = première teinte libre 0–7, sinon 0.
- Édition (tiroir) : renommer, teinte (8 pastilles nommées : « Teinte 1 »…), archiver ou désarchiver. Un projet archivé est masqué des puces mais conservé dans l'historique et les exports.
- Supprimer : possible seulement si aucune plage ne le référence ; sinon le bouton devient « Archiver », avec un texte explicatif.
- Rendu : monogramme de 2 lettres (initiales du nom normalisé) sur la teinte, encre via `TAF.encreSur`, avec **toujours le nom à côté**.

### 4.6 Annuler
- `muter` empile `{libelle, avant:{jours touchés (copie profonde, ou absent), chrono, projets?, reglages?}}`, au plus 20 entrées en mémoire.
- Annuler réapplique l'instantané via `muter` (rev+1) et alimente la pile Rétablir.
- Toast : 8 s, compte à rebours en `scaleX`, pause au survol et au focus, un seul toast visible (le nouveau remplace l'ancien ; l'ancienne opération reste annulable par Ctrl+Z).
- La pile est **vidée** quand un événement `storage` d'un autre onglet arrive, pour éviter de restaurer un état périmé.

### 4.7 Clavier
- Partout : Tab / Maj+Tab, Échap ferme la surface du dessus et rend le focus, Entrée valide les feuilles.
- Ctrl/Cmd+Z et Ctrl/Cmd+Maj+Z (ou Ctrl+Y) hors champ de saisie.
- **Raccourcis à une touche** : désactivables, actifs par défaut, inactifs dans un champ, avec un dialogue ouvert ou avec un modificateur. Déclarés par `aria-keyshortcuts` et listés dans le tiroir :
  - **P** démarrer / pause ;
  - **N** nouvelle plage ;
  - **J** journée type ;
  - **T** aujourd'hui ;
  - **← / →** période ;
  - **/** saisie rapide ;
  - **1 / 2 / 3** Jour / Semaine / Mois.
  (Pas de raccourci Espace.)
- Tuiles horaires : ↑ / ↓ = ±5 min (Maj : ±15).
- Liste des plages en desktop : Suppr sur une ligne focalisée = supprimer (Annuler).

### 4.8 Multi-onglets et cycle de vie
- `storage` (clé `taf_heures_v1`) : relire, valider, re-rendre la vue et la Pointeuse. Si une feuille Plage édite un `id` qui a changé ou disparu : fermeture et toast « Modifiée dans un autre onglet ».
- `pageshow` avec `persisted` (bfcache) : relire et re-rendre.
- `pagehide` / `visibilitychange:hidden` : vider l'écriture différée de la note.

## 5. Modèle de données — `taf_heures_v1`

### 5.1 Schéma
```jsonc
{
  "v": 1,                        // version du schéma (entier). v > 1 ⇒ lecture seule (§5.5)
  "rev": 128,                    // entier ≥ 0, +1 à chaque écriture
  "jours": {                     // clé "AAAA-MM-JJ" ; ≤ 4000 jours ; jour vide = clé absente
    "2026-10-14": [              // ≤ 48 plages, triées par d, sans chevauchement
      { "id": "h_k3f9a2x1q0",    // ^h_[a-z0-9]{10}$
        "d": "09:02",            // début, ^([01]\d|2[0-3]):[0-5]\d$
        "f": "12:31",            // fin, même regex OU "24:00" ; minutes(f) > minutes(d)
        "p": "p_ab12cd34ef",     // id de projet existant, sinon ""
        "n": "",                 // note, texte brut ≤ 200
        "o": "c",                // origine : "c" chrono | "s" saisie | "m" journée type
        "s": "s_9z8y7x6w5v" }    // FACULTATIF : id de session chrono ^s_[a-z0-9]{10}$
    ]
  },
  "chrono": null,                // ou { "e":"marche", "t0":1760425320000, "tp":null, "p":"", "n":"", "s":"s_…" }
                                 //    { "e":"pause",  "t0":null, "tp":1760437860000, "p":"", "n":"", "s":"s_…" }
  "projets": [                   // ≤ 50
    { "id": "p_ab12cd34ef", "nom": "…", "t": 3, "a": false }  // nom 1–40, t entier 0–7, a = archivé
  ],
  "reglages": { /* §8, tous présents après normalisation */ },
  "meta": { "creeLe": "2026-10-14", "derniereSauvegarde": null, "accueilVu": false }
}
```
- **Rien de dérivé n'est stocké** : totaux, plage en cours, temps de session, aperçu CRA, projets récents et dernier projet sont tous recalculés.
- Ids : préfixe + 10 caractères `[a-z0-9]` tirés par `crypto.getRandomValues` (`TAF.id(prefixe)`), avec un repli `Math.random` seulement si `crypto` est absent.
- Volume estimé : environ 30 Ko par an pour 3 plages par jour.

### 5.2 Validation (`TAF.heures.valider(objetBrut) → {donnees, rapport}`)
Elle s'applique à chaque lecture : chargement, `storage`, `pageshow`, import, et lecture par le CRA.
- L'entrée est traitée comme **non fiable**. L'objet est reconstruit champ par champ dans des littéraux neufs, sans `Object.assign` ni spread de l'entrée. `jours` est créé avec `Object.create(null)` puis exposé ; seules les clés validées par regex y sont affectées.
- Regex :
  - `RE_JOUR = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/`, puis vérification que la date existe (`new Date(a, m−1, j)` restitue les mêmes composantes) et que 2000 ≤ a ≤ 2100 ;
  - `RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/` ; `"24:00"` toléré pour `f` uniquement ;
  - `RE_ID_PLAGE = /^h_[a-z0-9]{10}$/`, `RE_ID_SESSION = /^s_[a-z0-9]{10}$/`, `RE_ID_PROJET = /^p_[a-z0-9]{10}$/`.
- Types et bornes :
  - chaînes : `typeof === 'string'`, rognées puis tronquées (nom 40, note 200), caractères de contrôle `[\u0000-\u001F\u007F]` retirés ;
  - booléens : `=== true` ;
  - entiers : `Number.isInteger`, puis bornes.
- Cardinalités : au-delà de 4000 jours, on garde les 4000 plus récents ; au-delà de 48 plages par jour, les 48 premières après tri ; au-delà de 50 projets, les 50 premiers. L'excédent est compté dans `rapport.ignores`.
- Références : un `p` inconnu devient `""`. Un `id` de plage dupliqué dans tout l'objet est régénéré.
- `chrono` :
  - `e ∈ {marche, pause}` ;
  - en marche, `t0` est un nombre fini dans `[946684800000, now + 86 400 000]` et `tp` vaut null ;
  - en pause, `tp` dans les mêmes bornes et `t0` vaut null ;
  - `s` est valide.
  Sinon `chrono = null` et le rapport le signale.
- `reglages` : chaque champ est validé avec sa borne (§8). Une valeur invalide prend le défaut.
- Normalisation de chaque jour : `normaliserJour` (§6.5).
- `rapport = { statut: 'ok' | 'partiel' | 'vide' | 'illisible' | 'futur', ignores: n, details: [libellés courts] }`.

### 5.3 Écriture (`muter(libelle, fn, options)`, propre à heures.js)
1. Relire la clé fraîche et la valider. Si le statut est `illisible` ou `futur`, refuser (mode lecture seule).
2. Prendre l'instantané ciblé pour Annuler (jours que `fn` déclare toucher, plus `chrono`, et `projets` / `reglages` s'ils sont concernés).
3. Appliquer `fn(etat)`.
4. Normaliser les jours touchés.
5. `rev + 1`.
6. `JSON.stringify`, refus si > 2 000 000 caractères (« Limite de stockage atteinte — exportez puis allégez »).
7. `setItem` **synchrone** (immédiat pour toute action chrono ou plage ; différé de 300 ms seulement pour la frappe d'une note, vidé sur `pagehide` / `visibilitychange:hidden`).
8. Mettre à jour le témoin partagé (`TAF.temoin`).

En cas d'échec de `setItem`, l'état en mémoire est restauré à l'instantané et le témoin passe à « Échec — exportez ».

### 5.4 Limites
| Élément | Limite |
|---|---|
| jours | 4000 |
| plages / jour | 48 |
| projets | 50 (nom 1–40) |
| note | 200 caractères |
| journée type | 8 plages |
| JSON sérialisé | 2 000 000 caractères |
| fichier importé | 2 097 152 octets (vérifié via `file.size` avant lecture) |

### 5.5 Données illisibles et version future
- **`illisible`** (JSON invalide, racine non objet ou `v` absent) : bannière bloquante « Données Heures illisibles ».
  - Toutes les écritures sont bloquées.
  - Boutons : « Exporter le brut » (Blob texte du contenu d'origine, `TAF_Heures_brut_AAAA-MM-JJ.txt`) et « Réinitialiser », avec une confirmation intégrée : bouton en deux étapes, « Confirmer la réinitialisation » pendant 5 s.
  - **Jamais d'écrasement silencieux.**
- **`futur`** (`v > 1`) : lecture seule, avec le message « Créées par une version plus récente de TAF ». Export brut possible.
- **`partiel`** : bandeau discret « N éléments illisibles ignorés · Exporter le brut d'origine », avec le brut conservé en mémoire pendant la session. Les écritures sont autorisées.

## 6. Règles de calcul et cas limites

### 6.1 Unités
- Toutes les durées sont des **minutes entières**. Les heures sont des chaînes `HH:MM` en **heure murale locale**.
- `minutes('HH:MM')` ; `'24:00'` = 1440.
- Durée d'une plage = `minutes(f) − minutes(d)` > 0.

### 6.2 Totaux
- Total du jour = `unionMinutes(plages)`, plus le segment vivant s'il tombe ce jour-là (portion du jour). L'union garantit l'absence de double compte, même sur des données anormales.
- Semaine **ISO 8601** (lundi → dimanche, S1 = semaine du premier jeudi, S53 gérée).
  - `reste = max(0, objHebdo − total)`, `dela = max(0, total − objHebdo)`.
  - Une semaine révolue sous l'objectif affiche « 2 h 30 sous l'objectif ».
- Mois civil : total, jours pointés (au moins une plage), moyenne = total / jours pointés (« — » si 0), total par projet.
- Équivalent CRA = Σ `0,5·am + 0,5·pm` par jour.

### 6.3 Chrono → plages (`decouperSegment(debutMs, finMs, pas, mode)`, pure dans taf.js)
- Si `finMs < debutMs` : aucune plage et `horlogeReculee: true`.
- Découper aux minuits **locaux** successifs (`new Date(a, m, j+1)`), au plus 8 jours (au-delà, refus avec message).
- Pour chaque morceau :
  - `dBrut` = minutes murales du début avec les secondes (`h·60 + m + s/60`) ;
  - `reel = (fin − début) / 60000` ;
  - `fBrut = dBrut + reel` (et non l'heure murale de fin : la durée réelle est préservée lors des changements d'heure) ;
  - `d = arrondir(dBrut, pas, mode==='favorable' ? 'bas' : 'proche')` ;
  - `f = min(1440, arrondir(fBrut, pas, mode==='favorable' ? 'haut' : 'proche'))`.
  Un morceau qui finit à minuit donne `f = 1440`.
- Un morceau avec `f − d < 1` est ignoré. Si tous le sont : toast « Moins d'une minute — ignoré · Annuler ».
- **Changement d'heure (DST)** : le jour concerné, `f = d + durée réelle`. La plage affiche donc la durée réellement travaillée, avec un écart d'une heure sur l'heure murale de fin. C'est documenté dans l'aide (« les jours de changement d'heure, la fin affichée suit la durée réelle »). Les saisies manuelles restent en heure murale pure.
- `arrondir(x, pas, sens)` : `proche` = `Math.round(x/pas)·pas` ; `bas` = `floor` ; `haut` = `ceil`. Avec `pas = 1` et `proche`, on obtient la minute la plus proche.

### 6.4 Insertion et chevauchement (`insererPlage(plagesJour, nouvelle) → {plages, rognees}`, pure)
Règle « **la saisie la plus récente gagne** ». Pour chaque plage existante E qui recouvre N :
- E est entièrement couverte : elle est supprimée ;
- E déborde d'un côté : elle est rognée à `[E.d, N.d]` ou `[N.f, E.f]` ;
- E englobe N : elle est scindée en `[E.d, N.d]` (même id) et `[N.f, E.f]` (nouvel id, mêmes `p`, `n`, `o`, `s`).

`rognees` décrit chaque modification, pour l'aperçu et le toast. Le résultat est normalisé.

### 6.5 Normalisation (`normaliserJour(plages)`, pure)
1. Retirer les plages invalides (`f ≤ d`).
2. Trier par `d` puis `f`.
3. Chevauchement résiduel (données externes) : la plage suivante est rognée pour commencer à la fin de la précédente, ou retirée si elle devient vide.
4. Fusionner les plages **contiguës** (`a.f === b.d`) si elles partagent le même `s` non vide, le même `p` et la même `n`.
5. Plafonner à 48.

Un tableau vide entraîne la suppression de la clé du jour.

### 6.6 Passage de minuit
- Chrono : §6.3.
- Saisie « 22-2 » : `[22:00–24:00]` le jour J et `[00:00–02:00]` à J+1. L'aperçu indique « traverse minuit ».
- Feuille Plage : la case « se termine le lendemain » apparaît si fin ≤ début, et produit la même découpe.
- Une plage stockée ne traverse jamais minuit.

### 6.7 Multi-onglets
- Chaque mutation relit la clé avant d'écrire. L'événement `storage` re-rend la vue.
- Le chrono est unique (une seule clé). Deux démarrages simultanés : la dernière écriture gagne. L'autre onglet se met à jour par `storage` ; le risque résiduel est négligeable.

### 6.8 Saisie rapide (`analyserSaisie(texte, ctx) → {plages, projet, note, erreurs, traverseMinuit}`, pure dans taf.js)
`ctx = { cleJour, maintenantMin|null, plagesJour, projets, debutHabituel, pas, mode }`

- Texte normalisé : NFKC, tirets `– — → à` convertis en `-`, espaces multiples réduits.
- **Heure** : `9`, `9h`, `9h30`, `9:30`, `930`, `0930`, `24` / `24h` / `24:00` (en fin seulement). Heures 0–24, minutes 0–59.
- **Plage** : `HEURE-HEURE`. Si `fin ≤ debut` et `fin < 12:00` et `fin + 720 > debut`, alors `fin += 720` (« 9-1 » donne 09:00–13:00). Sinon, si `fin ≤ debut`, la plage traverse minuit. C'est la seule heuristique.
- **Durée seule** (unité obligatoire) : `2h`, `2h30`, `2 h 30`, `1,5h`, `1.5h`, `90min`, `90 min`, `45m`.
  - Aujourd'hui (`maintenantMin` non null) : fin = maintenant arrondi selon le réglage, début = fin − durée ; si début < 0, erreur.
  - Jour passé : début = fin de la dernière plage du jour, sinon `debutHabituel`.
- **Projet** : jeton `@xxx`. Correspondance exacte (insensible à la casse et aux accents) sur les projets non archivés, sinon préfixe **unique**. Plusieurs candidats ou aucun : erreur, avec la liste ou le bouton « Créer « xxx » ».
- **Note** : le reste du texte, rogné et tronqué à 200.
- Erreurs :
  - nombre nu sans unité ni plage (« Précisez : 9-12 ou 2h ») ;
  - heure invalide ;
  - durée nulle ;
  - plages de la saisie qui se chevauchent entre elles ;
  - plus de 12 plages dans une même saisie.
- Une chaîne vide ne renvoie ni plage ni erreur.

### 6.9 Axe de la frise
Auto : de `floor((min début − 30) / 60)·60` à `ceil((max fin + 30) / 60)·60`, sur 8 h au minimum, avec un défaut de 07:00–19:00 si rien n'est saisi. Le segment vivant et la ligne de coupure sont inclus. L'axe est borné à [0, 1440].
`--deb = (d − axeD) / (axeF − axeD) · 100%`.

### 6.10 Préremplissage
- **Début** = fin de la dernière plage du jour, sinon début de la première plage de la journée type, sinon `debutHabituel`.
- **Fin** :
  - jour courant et maintenant > début : maintenant arrondi au quart d'heure le plus proche ;
  - sinon : début + 60 ;
  - borne : 1440.
- **Journée type proposée** au premier lancement :
  - P1 = `[debutHabituel, debutHabituel + dureeJour/2]` ;
  - P2 = `[fin P1 + pauseDej, fin P2 = début P2 + dureeJour/2]`.
  Défauts : 09:00–12:30 et 13:30–17:00.

### 6.11 Formats
- Durée : « 0 min », « 45 min », « 1 h », « 7 h 30 », « 10 h 05 ».
- Décimal d'export : minutes / 60 arrondi à 2 décimales, sans zéros inutiles, avec une virgule (« 7,5 », « 0,17 »).
- Durée vocalisée : « 3 heures 29 minutes ».
- Dates d'export `jj/mm/aaaa`.

## 7. Pont CRA

### 7.1 Règle partagée (taf.js)
`TAF.heures.demiJournees(plagesJour, reglages) → {am, pm, minAm, minPm}`
- `coupure = minutes(reglages.coupure)`.
- `minAm` = minutes de l'union des plages dans `[0, coupure)` ; `minPm` = minutes dans `[coupure, 1440)`.
- `seuil = reglages.seuilDemiMin ?? round5(dureeJourMin / 4)` (défaut 105).
- `am = minAm ≥ seuil` ; `pm = minPm ≥ seuil`.
- **Rattrapage** (`reglages.rattrapage`, défaut vrai) : si ni `am` ni `pm` mais `minAm + minPm ≥ seuil`, la demi la plus chargée est cochée (égalité : matin).

Exemples avec les défauts (coupure 13:00, seuil 1 h 45, rattrapage actif) :

| Plages | minAm / minPm | Résultat |
|---|---|---|
| 09:00–12:30 + 13:30–17:00 | 210 / 210 | 1 j |
| 14:00–16:00 | 0 / 120 | après-midi |
| 11:00–14:00 | 120 / 60 | matin |
| 12:00–14:00 | 60 / 60 | matin (rattrapage, égalité) |
| 12:30–13:30 | 30 / 30 | 0 |
| 13:00–14:45 | 0 / 105 | après-midi |

Cette fonction sert à la fois à la vue Mois, à la ligne CRA de la vue Jour, à l'équivalent CRA, au CSV synthèse **et** à l'import CRA. Les deux pages affichent donc toujours les mêmes nombres.

### 7.2 Résumé du mois
`TAF.heures.resumeMois(donnees, annee, mois0) → { [numJour 1..31]: {min, minAm, minPm, am, pm, activite} }`
Seuls les jours ayant au moins une plage y figurent. `activite = TAF.heures.activiteJour(plages, projets, 200)` : noms de projets distincts dans l'ordre d'apparition, puis notes distinctes non vides, joints par « · » et tronqués à 200 caractères avec « … ».

### 7.3 Plan d'import (pur, taf.js)
`TAF.heures.planifierImport(craDays, resume, mode, avecActivite) → {changements:[{jour, avant:{am,pm,act}, apres:{am,pm,act}}], synthese:{joursDetectes, joursProposes, inchanges, ajoutes, decoches}}`

- **`completer`** (défaut) :
  - `apres.am = avant.am || r.am`, idem pour `pm`. On **ne décoche jamais**.
  - Si `avecActivite` et `avant.act.trim() === ''`, alors `apres.act = r.activite`. Sinon l'activité est inchangée.
- **`remplacer`** :
  - pour **chaque jour du mois**, `apres.am / pm = r ? r.am / r.pm : false` ;
  - l'activité est conservée, sauf si elle est vide et `avecActivite`.
- Seuls les jours où `avant ≠ apres` figurent dans `changements`.

### 7.4 Côté CRA (cra.js / cra.css)
- **Bouton « Depuis mes heures »** dans `.aids` de `#calPanel`.
  - Affiché seulement si `TAF.heures.lire()` renvoie un statut `ok` ou `partiel` et qu'au moins un jour du mois affiché a des plages.
  - Badge : nombre de jours détectés.
  - Mis à jour à l'ouverture de la pop-up, au changement de période et sur l'événement `storage` de `taf_heures_v1`.
- **Dialogue « Importer mes heures »** : plein écran < 700 px, centré de 560 px au-delà, au-dessus de la pop-up calendrier.
  - Pile de modales : `TAF.gererModale` ; Échap ferme le dialogue seul et rend le focus au bouton.
  - Contenu :
    - synthèse « 17 jours détectés → 16,5 j · 6 jours déjà cochés inchangés » ;
    - rappel de la règle « Demi-journée dès 1 h 45 avant / après 13:00 — modifiable dans Heures », avec un lien `heures.html#mois` ;
    - radios Compléter (défaut) / Remplacer le mois ;
    - case « Remplir les activités vides avec les projets et notes du jour » (cochée par défaut) ;
    - liste avant → après par jour (pastilles tri-état du CRA, durée source, activité proposée en `textContent`) ;
    - boutons [Annuler] et [Importer N jours].
  - « Remplacer » demande une confirmation intégrée en deux étapes, avec le texte « N demi-journées seront décochées ».
- **Application**
  - Pour chaque changement : `assurerJour(j)`, affectation `am` / `pm` / `act`, `nettoyerJour(j)`, `majCellule(j)`.
  - Puis, une seule fois : `recalculer()`, `construireTableauPdf()`, `saveSoon()`.
  - Annonce dans `#calLiveRegion` : « 16,5 j importés depuis Heures ».
  - Toast « Calendrier mis à jour · Annuler » (10 s). L'instantané `JSON` de `state.days` est gardé en mémoire et détruit à l'expiration : ce n'est pas un second état.
- **Fragment `#heures-AAAA-MM`**
  - Validé par `/^#heures-(\d{4})-(0[1-9]|1[0-2])$/` au chargement et sur `hashchange`. Toute autre valeur est ignorée.
  - Il ouvre la pop-up calendrier puis le dialogue, **sans jamais rien appliquer d'office**. Le hash est retiré par `history.replaceState`.
  - Si le mois diffère de celui du CRA, le dialogue affiche d'abord « Le CRA affiche septembre 2026 » avec le bouton « Passer à octobre 2026 ». Celui-ci règle `monthSel` / `yearSel` puis appelle `changerPeriode()`, ce qui archive le mois courant comme d'habitude.
- **Invariant** : le CRA n'écrit jamais `taf_heures_v1`, et Heures n'écrit jamais `cra_app_v3`.
- **`file://` sous Firefox** : origines distinctes, donc aucune heure visible. Le bouton reste masqué ; la documentation dans le tiroir Heures dit « disponible via le site ».

### 7.5 Pastille « en cours » (taf.js, les deux pages)
`TAF.nav` lit `chrono` (lecture seule).
- Sur l'onglet ou lien « Heures » : point plein et « 02:14 » (heures:minutes, mis à jour à la minute, suspendu si la page est cachée).
- En pause : demi-point et « pause ».
- `aria-label` du lien : « Heures, chrono en cours depuis 2 heures 14 ».
- Mise à jour sur `storage`.

## 8. Paramètres (`reglages`, tiroir Réglages de heures.html)

| Champ | Défaut | Bornes / valeurs | Section | Usage |
|---|---|---|---|---|
| `objHebdoMin` | 2100 (35 h) | 0–4800, pas de 15 ; 0 masque la jauge | Journée et semaine | jauge, reste |
| `dureeJourMin` | 420 (7 h) | 60–840, pas de 15 | Journée et semaine | jauge du jour, niveau d'alvéole, ½ journée, seuil auto |
| `joursOuvres` | [1,2,3,4,5] | ISO 1–7, uniques, triés, éventuellement vide | Journée et semaine | « vide », remplir, pointillés |
| `debutHabituel` | "09:00" | HH:MM | Journée et semaine | préremplissage |
| `pauseDejMin` | 60 | 0–180 | Journée et semaine | journée type proposée |
| `coupure` | "13:00" | HH:MM entre 06:00 et 18:00 | Conversion CRA | demi-journées, frises |
| `seuilDemiMin` | null (auto = dureeJour/4 arrondi à 5 → 105) | null ou 15 – dureeJour/2 | Conversion CRA | demi-journées |
| `rattrapage` | true | bool | Conversion CRA | demi-journée dominante |
| `arrondiMin` | 1 | 1, 5, 10, 15 | Chrono | segments du chrono et « Maintenant » (jamais les heures tapées) |
| `modeArrondi` | "proche" | "proche" / "favorable" | Chrono | §6.3 |
| `alerteOubliMin` | 600 | 120–1440 | Chrono | bannière |
| `projetDemarrage` | "dernier" | "dernier" / "aucun" | Chrono | Démarrer |
| `secondes` | true | bool | Chrono | affichage |
| `vibration` | true | bool (coupée si reduced-motion) | Chrono | retour tactile |
| `autoPointer` | false | bool | Chrono | `#pointer` |
| `journeeType` | null | null ou 0–8 `{d,f,p}` valides, sans chevauchement | Journée type | boutons Journée type |
| `raccourcis` | true | bool | Raccourcis | §4.7 |
| `rappelSauvegardeJours` | 30 | 0 (désactivé), 7, 30 | Mes données | bannière |

- La section **Conversion CRA** contient un exemple vivant, calculé avec `demiJournees` sur la journée type et sur 3 cas fixes (« 09:00–12:30 + 13:30–17:00 → 1 j », « 14:00–16:00 → ½ j après-midi », « 12:00–14:00 → ½ j matin »).
- La section **Mes données Heures** contient :
  - l'état de `navigator.storage.persisted()` et le bouton « Protéger mes données » ;
  - Exporter CSV / JSON, Importer JSON ;
  - « Effacer mes données Heures » : confirmation intégrée en deux étapes ; ne touche jamais les clés du CRA ni `taf_prefs_v1` ;
  - la mention « Données enregistrées localement sur cet appareil uniquement. Rien n'est envoyé en ligne. » ;
  - une note sur iOS et le mode écran d'accueil (stockage séparé).
- **Apparence** : section partagée (`taf_prefs_v1`).

## 9. Export / import

### 9.1 Dialogue Export
- Période : jour, semaine ou mois affiché, ou « Du… au… » (deux `input date`, au plus 366 jours).
- Format :
  - « Détail des plages (CSV) » ;
  - « Synthèse par jour (CSV) » ;
  - « Sauvegarde complète (JSON) », qui ignore la période.
- Aperçu : nombre de lignes et total (« 43 lignes · 142,25 h »), plus les 3 premières lignes en `textContent`.
- Téléchargement : `Blob`, `URL.createObjectURL`, `<a download>` temporaire, puis `revokeObjectURL` après 1 s. Aucune requête réseau.

### 9.2 CSV (`TAF.csv`)
- Séparateur `;`, fin de ligne CRLF, BOM UTF-8 `﻿` en tête, encodage UTF-8.
- **Cellule texte** : guillemets doublés (`"` → `""`), puis cellule entière entre guillemets. **Anti-injection** : si la valeur commence par `= + - @`, une tabulation ou un retour chariot, **ou** par des espaces suivis de `= + - @`, préfixer `'`.
- **Cellule numérique** : chiffres et virgule décimale, sans guillemets, jamais négatifs.
- **Détail des plages**, une ligne par plage triée par date puis début. En-tête exact :
  `Date;Jour;Début;Fin;Durée (h);Durée (min);Projet;Note;Origine`
  Exemple : `14/10/2026;mardi;09:02;12:31;3,48;209;"Client A";"réunion";chrono`
  - Origine ∈ {chrono, saisie, journée type}.
  - Projet vide pour « Sans projet ».
- **Synthèse par jour**, une ligne par jour de la période ayant au moins une plage. En-tête exact :
  `Date;Jour;Total (h);Total (min);Matin (h);Après-midi (h);Équivalent CRA (j);Projets`
  - Équivalent CRA ∈ {0 ; 0,5 ; 1}.
  - Projets = noms distincts joints par « · ».
  - Ligne finale : `Total;;<h>;<min>;<h>;<h>;<j>;`.
- **Noms de fichiers** (nettoyés par `TAF.nomFichier`, `[^\p{L}\p{N}_-]` remplacé par `_`) :
  - `TAF_Heures_AAAA-MM.csv` (mois) ;
  - `TAF_Heures_AAAA-Sxx.csv` (semaine ISO) ;
  - `TAF_Heures_AAAA-MM-JJ.csv` (jour) ;
  - `TAF_Heures_AAAA-MM-JJ_AAAA-MM-JJ.csv` (période libre).

### 9.3 JSON
- **Export** : enveloppe `{ "format": "taf-heures", "version": 1, "exporte": "<ISO 8601>", "donnees": <taf_heures_v1 validé, chrono inclus> }`, nommée `TAF_Heures_sauvegarde_AAAA-MM-JJ.json`. Met à jour `meta.derniereSauvegarde`.
- **Import** :
  - `input type=file accept=".json,application/json"`, taille ≤ 6 Mo vérifiée avant lecture (pire cas UTF-8 d’une sauvegarde stockable, export compact) et type contrôlé (.json), `FileReader.readAsText`, `JSON.parse` en try/catch ;
  - `format === 'taf-heures'` et `version === 1` exigés ;
  - `TAF.heures.valider(donnees)`.
- **Rapport** affiché : « 412 plages sur 180 jours, 6 projets ; 3 éléments ignorés (heure invalide) ».
- **Mode remplacement uniquement** (MVP) : confirmation intégrée « Remplacer toutes vos heures actuelles (N plages) ? ». Elle est appliquée via `muter`, donc annulable par le toast pendant la session.
- Un fichier illisible ne modifie rien et affiche un message d'erreur clair.

## 10. Accessibilité (WCAG 2.2 AA)

**Structure**
- Landmarks : `header`, `nav aria-label="Modules"` (`aria-current="page"` sur Heures), `nav aria-label="Vues"` (`aria-current="page"` sur la vue active), `main`, `aside aria-labelledby` pour la Pointeuse.
- Un `h1` par vue, des `h2` par carte. Lien d'évitement « Aller au chrono ».

**Chrono**
- `role="timer"` et `aria-live="off"` sur les chiffres : **aucune annonce par seconde**.
- Une description textuelle (`#etatChrono`, « Chrono en marche depuis 9 h 02, projet Client A ») est mise à jour **uniquement aux changements d'état** et annoncée une fois via `TAF.annoncer`.
- `aria-label` dynamique de l'hexagone : « Démarrer le chrono », « Mettre en pause », « Reprendre ».
- La forme et le texte visible doublent toujours la couleur.

**Visualisations** : chacune a un équivalent texte.
- Jauge : `role="img"` et `aria-labelledby` vers les chiffres visibles.
- Frises : `aria-hidden`, la liste des plages ou les boutons de rangée sont la source accessible.
- Ruche : boutons avec `aria-label` complet et « Voir en tableau » (`<table>`, `<caption>`, `th scope`).

**Couleur jamais seule**
- Projets : monogramme et nom.
- Niveau d'alvéole : hauteur de remplissage et chiffre.
- Dépassement : anneau et texte « + ».
- Jours non ouvrés : contour pointillé.
- Aperçu CRA : pastille tri-état (forme).

**Alternatives aux gestes** (2.5.1 / 2.5.7)
- appui long : bouton ⋯ ;
- glissement de jour : ‹ › et ← / → ;
- glisser pour fermer une feuille : bouton Fermer et Échap.

**Cibles** : ≥ 44×44 px sur les paliers tactiles (hexagone 60 px, 52 px sous 389 ; ■ 48 ; ±5 44 ; alvéoles 44 ; rangées 44 ; puces 44 de haut).

**Surfaces modales** (feuilles Plage et Chrono, dialogue Export, tiroir, confirmations, import CRA)
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Focus déplacé, piégé et rendu au déclencheur par `TAF.gererModale`.
- Échap ferme la surface du dessus ; `aria-hidden` / `inert` sur l'arrière-plan.

**Toasts**
- `role="status"`, ils ne volent pas le focus.
- Le bouton Annuler est atteignable au clavier (raccourci Alt+U pendant la vie du toast, en plus de Ctrl+Z).
- Le compte à rebours se met en pause au survol et au focus (2.2.1).

**Raccourcis à une touche** : désactivables et inactifs dans les champs (2.1.4).

**Formulaires**
- `label` visibles, unités dans le libellé (« Objectif hebdomadaire (heures) »), `input type=time` / `date` natifs.
- Erreurs reliées par `aria-describedby` avec `aria-invalid` ; focus sur le premier champ fautif.
- Police de 16 px minimum dans les champs en mobile.
- Aperçu de saisie rapide : `aria-describedby`, sans live à la frappe. Le résultat est annoncé à l'enregistrement.

**Contraste et reflow**
- Texte sur accent via `--on-accent`, texte d'accent en `--accent-deep`.
- Teintes projet (`--p0…--p7`) ≥ 3:1 sur `--paper` pour les liserés ; monogrammes avec encre calculée (`TAF.encreSur`).
- Focus `:focus-visible` avec anneau accent et `--focus-halo` (≥ 3:1 quel que soit l'accent). Sur une alvéole en clip-path, l'anneau est posé sur le bouton parent.
- Reflow à 320 px CSS et zoom 200 % sans défilement horizontal : le dock passe sur deux lignes si besoin, et l'hexagone et ■ restent visibles.
- `aria-current="date"` sur aujourd'hui (bande, frise semaine, ruche).

## 11. Animations et micro-interactions

**Règles générales**
- Uniquement `transform` et `opacity`, en 150–320 ms avec `--ease`.
- Aucune animation de `width`, `height`, `top` ou `left` : zéro CLS. Les dimensions sont réservées (aspect-ratio des alvéoles, hauteurs fixes des rangées, `tabular-nums`).
- `prefers-reduced-motion: reduce` : tout est coupé (y compris le halo, le FLIP, les cascades et les view-transitions), les états s'affichent directement et la vibration est désactivée.

**Chrono**
- **Démarrer** : l'hexagone fait `scale(.94)` puis `1` (180 ms), la couche pleine apparaît en fondu et ▶ / ❚❚ passent en fondu croisé. Pendant la marche, un **halo** (pseudo-élément, `scale 1 → 1.08`, `opacity .35 → 0`, boucle de 2,4 s) tourne ; c'est la seule animation continue, coupée si l'onglet est caché.
- **Pause** : la moitié droite s'efface (opacity), ce qui donne la forme demi-pleine ; le halo s'arrête ; le libellé « En pause depuis » glisse de `translateY(6px)` à 0.
- **Chiffres** : les secondes changent sans animation ; au changement de minute, le groupe des minutes glisse de `translateY(-30%)` à 0 avec un fondu (160 ms).

**Listes et frises**
- **Ajout de plage** : la ligne entre en `scale(.96)` vers 1 avec un fondu (200 ms) ; les voisines glissent par **FLIP** (`translateY`).
- **Blocs de frise** : `scaleX(0 → 1)` depuis le début du bloc (240 ms). La journée type appliquée fait apparaître ses blocs en cascade de 40 ms.
- **Suppression** : `translateX(-12px)` et fondu (180 ms), puis les voisines remontent en FLIP ; Annuler rejoue l'entrée.
- **Jauge hexagonale** : les côtés se remplissent par `scaleX` en cascade de 40 ms (320 ms au total) ; quand la valeur change, le côté partiel glisse vers sa nouvelle longueur (240 ms). La première fois que l'objectif est atteint dans la semaine (mémorisé en `sessionStorage`), un « pop » `scale 1 → 1.04 → 1` (320 ms) s'accompagne d'une annonce. Pas de confettis.
- **Ruche** : entrée des alvéoles en fondu avec `scale(.92 → 1)`, en cascade diagonale de 12 ms (240 ms maximum). Le liquide monte par `translateY((1-niveau)*100%)` (320 ms). Après une saisie, l'alvéole concernée se remplit sous les yeux.

**Navigation et surfaces**
- **Changement de période ou de vue** : `document.startViewTransition` quand il est disponible, avec un glissement orienté de ±16 px et un fondu (180 ms) ; sinon un simple fondu. L'indicateur du segmenté et celui de la bande semaine glissent en `translateX`.
- **Feuilles, tiroir et dialogues** : mêmes mécaniques que le CRA, mutualisées dans `taf.css` (feuille `translateY(100%) → 0` en 300 ms, dialogue en translate + opacity sur 260 ms, voile en fondu). On peut tirer la feuille pour la fermer.
- **Toasts** : `translateY(16px) → 0` avec un fondu (200 ms). Barre de compte à rebours en `scaleX(1 → 0)` linéaire.
- **Inter-pages** : `@view-transition { navigation: auto; }`. La topbar et la marque portent un `view-transition-name` stable ; l'indicateur de module glisse du CRA vers Heures.
- **Vibration** : 10 ms au démarrage, à la pause et à l'arrêt (`TAF.vibrer`).

## 12. Sécurité spécifique

**CSP**
- La meta CSP est identique à celle de CLAUDE.md §8.
- Aucun `<script>` ou `<style>` inline, aucun `style="…"`, aucun `on…=`.
- Les positions et niveaux passent **uniquement** par `el.style.setProperty('--x', valeur)` (CSSOM), avec des valeurs numériques calculées et bornées.
- Teintes de projet : **index 0–7**, rendu via `data-t` et les jetons CSS. Aucune couleur libre stockée, donc aucune injection CSS.

**DOM**
- `createElement` / `createElementNS` et `textContent` exclusivement pour toute donnée : notes, noms de projets, activités proposées, aperçus CSV, rapport d'import, brut illisible.
- Aucun `innerHTML`, `outerHTML` ni `insertAdjacentHTML` avec une donnée. Le SVG ne contient que des constantes du code.
- Ni `eval`, ni `new Function`, ni `setTimeout(string)`.

**Données lues non fiables** (localStorage, `storage`, fichier importé, et lecture par le CRA) : §5.2.
- Reconstruction champ par champ, regex sur toutes les clés et valeurs.
- `Object.create(null)` pour les dictionnaires ; `__proto__`, `constructor` et `prototype` ne passent pas les regex.
- `Number.isFinite` et des bornes partout ; longueurs et cardinalités plafonnées.

**URL**
- Hash en liste blanche (`#jour`, `#semaine`, `#mois`, `#pointer`) côté Heures et regex stricte `#heures-AAAA-MM` côté CRA.
- Aucune donnée utilisateur dans une URL. Aucune écriture déclenchée par l'URL, sauf `autoPointer` (opt-in, navigation de type `navigate` uniquement, Annuler).

**Fichiers**
- Import : taille vérifiée avant lecture et type contrôlé.
- Export : Blob local, URL révoquée, noms de fichiers nettoyés. CSV neutralisé (§9.2).

**Stockage et réseau**
- Les écritures sont bornées (2 000 000 caractères) et le quota est géré avec rollback.
- Les données illisibles ne sont jamais écrasées.
- Effacer ne touche que `taf_heures_v1`.
- Aucun réseau : pas de `fetch`, `XMLHttpRequest`, `sendBeacon` ni `WebSocket`, pas de police web ni de CDN. `referrer: no-referrer`. Les liens internes sont relatifs.
- `navigator.storage.persist()` et `navigator.vibrate` sont des API locales sans réseau.
- Aucun secret. Les ids viennent de `crypto.getRandomValues`.
- Le titre reste `TAF` : jamais de minuteur dans `document.title`.

## 13. API

### 13.1 À ajouter dans `taf.js` (objet global gelé `TAF` ; réutiliser l'existant si déjà présent)
Liste de référence :

- TAF.heures.CLE : constante 'taf_heures_v1'.
- TAF.heures.reglagesDefaut() -> objet reglages complet (défauts du §8).
- TAF.heures.valider(objetBrut) -> {donnees, rapport:{statut:'ok'|'partiel'|'vide'|'illisible'|'futur', ignores, details}} : reconstruction champ par champ, regex, bornes, normalisation (partagé entre heures.js, le CRA et l'import).
- TAF.heures.lire() -> {donnees, rapport} : lecture seule validée de localStorage[taf_heures_v1], try/catch, et {donnees:null, rapport:{statut:'vide'}} si la clé est absente ou si le stockage est indisponible. N'écrit jamais.
- TAF.heures.minutes(hhmm) -> entier 0..1440 ou NaN ; TAF.heures.versHHMM(min) -> 'HH:MM' ('24:00' pour 1440).
- TAF.heures.arrondir(min, pas, sens:'proche'|'bas'|'haut') -> nombre.
- TAF.heures.unionMinutes(plages) -> minutes de l'union des intervalles [d,f).
- TAF.heures.normaliserJour(plages) -> plages triées, sans chevauchement, fusionnées (§6.5).
- TAF.heures.insererPlage(plagesJour, nouvelle) -> {plages, rognees} : règle « la plus récente gagne » (§6.4).
- TAF.heures.decouperSegment(debutMs, finMs, pas, mode) -> {plagesParJour:{'AAAA-MM-JJ':[{d,f}]}, horlogeReculee:bool} : découpe aux minuits locaux et arrondi (§6.3).
- TAF.heures.analyserSaisie(texte, ctx) -> {plagesParJour, projet, note, erreurs:[{code,message,jeton}], traverseMinuit} : grammaire de saisie rapide (§6.8).
- TAF.heures.demiJournees(plagesJour, reglages) -> {am, pm, minAm, minPm} : RÈGLE UNIQUE heures -> demi-journées (coupure, seuil auto dureeJour/4, rattrapage).
- TAF.heures.seuilDemi(reglages) -> minutes effectives du seuil (null => arrondi à 5 de dureeJourMin/4).
- TAF.heures.activiteJour(plagesJour, projets, max=200) -> chaîne « Projet A · Projet B · note » dédoublonnée et tronquée avec '…'.
- TAF.heures.resumeMois(donnees, annee, mois0) -> {[jour]: {min, minAm, minPm, am, pm, activite}} : seulement les jours avec plages.
- TAF.heures.planifierImport(craDays, resume, mode:'completer'|'remplacer', avecActivite) -> {changements:[{jour, avant, apres}], synthese:{joursDetectes, joursProposes, inchanges, ajoutes, decoches}} : plan pur de l'import CRA.
- TAF.heures.RE_HASH_CRA : /^#heures-(\d{4})-(0[1-9]|1[0-2])$/ (partagée par le lien « Ouvrir dans le CRA » et le parseur côté CRA).
- TAF.dates.cle(date) -> 'AAAA-MM-JJ' local ; TAF.dates.depuisCle(cle) -> Date locale à midi ou null ; TAF.dates.cleValide(cle) -> bool (regex + date réelle + années 2000–2100).
- TAF.dates.lundiDe(cle) -> cle du lundi ; TAF.dates.semaineIso(cle) -> {annee, semaine} ; TAF.dates.ajouterJours(cle, n) -> cle.
- TAF.format.duree(min) -> '7 h 30' ; TAF.format.decimal(min) -> '7,5' ; TAF.format.dureeLongue(min) -> '3 heures 29 minutes' ; TAF.format.jours(n) -> '18,5 j' ; TAF.format.dateCourte / dateLongue (fr-FR).
- TAF.csv.cellule(valeur) -> cellule texte échappée et neutralisée contre l'injection de formules ; TAF.csv.nombre(n) -> '7,5' ; TAF.csv.construire(lignes) -> chaîne avec BOM, séparateur ';' et CRLF.
- TAF.fichier.telecharger(contenu, nom, type) : Blob, objectURL, <a download> temporaire, révocation, sans réseau ; TAF.fichier.lireTexte(file, maxOctets) -> Promise<string> (refus au-delà de la taille).
- TAF.nomFichier(...parties) -> nom de fichier nettoyé (partagé avec le nom PDF du CRA).
- TAF.id(prefixe) -> prefixe + '_' + 10 caractères [a-z0-9] via crypto.getRandomValues.
- TAF.normaliserTexte(s) -> minuscules sans accents (NFD) pour les recherches et la correspondance des projets.
- TAF.encreSur(couleurOuJeton) -> encre lisible (contraste AA) pour les monogrammes.
- TAF.gererModale(panneau, declencheur, premier) : pile de modales, focus piégé et restitué, Échap ferme la surface du dessus (existant, mutualisé).
- TAF.annoncer(message, region?) : région aria-live polie partagée (existant, mutualisé).
- TAF.toast({message, action:{libelle, fn}, duree}) -> poignée {fermer()} : toast role=status, compte à rebours en pause au survol et au focus, un seul visible.
- TAF.temoin.etat('cours'|'ok'|'echec'|'indisponible') : témoin de sauvegarde partagé.
- TAF.stockage.lire(cle) -> string|null et TAF.stockage.ecrire(cle, chaine) -> bool : accès localStorage protégé par try/catch (écriture appelée seulement par le propriétaire de la clé).
- TAF.vibrer(ms=10) : navigator.vibrate silencieux, coupé si prefers-reduced-motion ; TAF.reduit() -> bool.
- TAF.nav.init(moduleActif) : bascule de modules (topbar / barre basse), aria-current, et pastille « en cours » de l'onglet Heures lue depuis TAF.heures.lire().chrono, mise à jour à la minute et sur l'événement storage.
- TAF.apparence.* (existant) : section Apparence du tiroir et taf_prefs_v1, appliquée aussi à heures.html.
 Les fonctions pures sont testées dans `tests/`.

### 13.2 Propre à `heures.js` (IIFE, non exposé)
- `charger()` ; `muter(libelle, fn, opts)` ; `annuler()` / `retablir()` ; `ecouterStockage()`.
- Chrono : `demarrerChrono(t0?)`, `pauseChrono()`, `reprendreChrono()`, `arreterChrono(finMs?)`, `corrigerDebut(t0)`, `changerProjetChrono(p, mode)`, `verifierOubli()`, `planifierTick()`.
- Plages : `ouvrirFeuillePlage(cleJour, id?, preremplissage?)`, `enregistrerPlage()`, `supprimerPlage(cleJour, id)`, `reprendrePlage(cleJour, id)`, `appliquerJourneeType(cleJour, mode)`, `remplirJoursOuvresVides(lundi)`, `enregistrerCommeJourneeType(cleJour)`.
- Rendu : `rendre()` (selon la vue), `rendreJour()`, `rendreSemaine()`, `rendreMois()`, `rendrePointeuse()`, `rendreJauge()`, `rendreFrise()`, `rendreRuche()`, `rendreBannieres()`, `animerFlip(liste, mutation)`.
- Navigation : `lireHash()`, `allerA(vue, periode)`, `gererRaccourcis(e)`.
- Projets et réglages : `creerProjet(nom)`, `majProjet(id, champs)`, `ouvrirReglages(section?)`, `appliquerReglage(cle, valeur)`.
- Données : `exporterCsv(type, du, au)`, `exporterJson()`, `importerJson(fichier)`, `effacerDonnees()`, `exporterBrut()`.

### 13.3 Côté CRA (`cra.js`)
`majBoutonHeures()`, `ouvrirImportHeures(annee?, mois0?)`, `appliquerImportHeures(plan)`, `lireHashHeures()`. Ces fonctions utilisent uniquement `TAF.heures.lire`, `resumeMois`, `planifierImport` et les fonctions existantes `assurerJour`, `nettoyerJour`, `majCellule`, `recalculer`, `construireTableauPdf`, `saveSoon`, `changerPeriode`.

## 14. Checklist de non-regression du module Heures


1. heures.html : <title>TAF</title> fixe en permanence (aucun minuteur dans le titre), CSP meta identique au CRA, referrer no-referrer, aucun script, style ou style= inline ni on…=, console sans erreur ni violation CSP.
2. Navigation de modules : topbar ≥ 700 px, barre d'onglets basse < 700 px avec safe-area, aria-current=page sur Heures, view-transition CRA <-> Heures, pastille « en cours » visible sur l'onglet Heures depuis les deux pages quand le chrono tourne.
3. Sous-vues Jour / Semaine / Mois par hash en liste blanche (#jour, #semaine, #mois, #pointer), hash inconnu = #jour, raccourcis 1 / 2 / 3.
4. Premier lancement : carte Journée type préremplie (09:00–12:30 / 13:30–17:00 depuis les réglages), « C'est ma journée » et « Passer », aucun projet créé.
5. Chrono : Démarrer, Pause (segment enregistré immédiatement), Reprendre (même session), Arrêter (toast Annuler qui restaure le même t0), états hexagone creux / demi / plein et texte visible.
6. Chrono robuste : rechargement, fermeture puis réouverture, bfcache (pageshow), onglet caché puis visible et second onglet synchronisé par l'événement storage, sans perte ni double comptage.
7. Démarrer à… / Arrêter à… / Corriger le début (bornes respectées), appui long ET bouton ⋯ équivalent, changement de projet « à partir de maintenant » et « pour toute la session ».
8. Chrono oublié : bannière au-delà du seuil ou si minuit a été franchi, trois choix, aperçu de découpe, découpe à minuit correcte ; horloge reculée = 0 avec avertissement.
9. Arrondi du chrono (1 / 5 / 10 / 15, proche / favorable) appliqué seulement au chrono et à « Maintenant », jamais aux heures tapées ; segment de moins d'une minute ignoré avec toast.
10. Vue Jour : en-tête ‹ › et glissement, bande semaine (aria-current=date), jauge du jour et ligne CRA, frise (coupure M | A, ligne maintenant, clic dans une zone vide = nouvelle plage préremplie), liste accessible, ligne « En cours » dérivée.
11. Feuille Plage : préremplissage (§6.10), tuiles ±5 / ±15 et input time, durées rapides, case « jusqu'à minuit » et « se termine le lendemain », aperçu de chevauchement avant enregistrement et toast qui nomme la plage rognée.
12. Saisie rapide : formats d'heure et de durée, @projet (exact puis préfixe unique, erreur si ambigu ou inconnu), note, heuristique +12 h unique, traverse minuit, aperçu obligatoire, une seule mutation annulable.
13. Édition, suppression et Reprendre ▶ d'une plage ; focus restitué ; Suppr au clavier sur une ligne (desktop).
14. Journée type : appliquer sur un jour vide, Compléter (n'ajoute que les plages sans chevauchement), Enregistrer ce jour comme journée type (confirmation intégrée si elle remplace), boutons « Définir ma journée type » si elle est absente.
15. Vue Semaine : numéro ISO, jauge hexagonale (objectif, débordement + texte), tuiles, frise de 7 rangées cliquables, week-end vide replié, « Remplir N jours ouvrés vides » (jours ≤ aujourd'hui seulement, une mutation, un Annuler).
16. Vue Mois : alvéoles à niveau, pointillés, anneaux et aujourd'hui, mini-pastille CRA tri-état identique au CRA, navigation clavier de type sélecteur de date, synthèse et équivalent CRA, répartition par projet (somme à 100 %), « Voir en tableau ».
17. Annuler universel : toast de 8 s en pause au survol et au focus, Ctrl/Cmd+Z et Ctrl+Maj+Z hors champ, pile de 20, pile vidée sur un événement storage d'un autre onglet.
18. Raccourcis P / N / J / T / ← → / '/' / 1-2-3 : inactifs dans les champs et les dialogues, désactivables dans les réglages ; pas de raccourci Espace.
19. Projets : création en ligne, doublon refusé, teinte 0–7, archivage, suppression bloquée si des plages le référencent ; monogramme + nom toujours affichés ; nom rendu par textContent (essai avec <img src=x onerror=…>).
20. Réglages : chaque champ est borné et validé, l'exemple de conversion vivant suit les réglages, persistance (storage.persisted / persist), rappel de sauvegarde, Effacer mes données Heures (confirmation intégrée, CRA et taf_prefs_v1 intacts), Apparence partagée appliquée.
21. Export CSV Détail et Synthèse : en-têtes exacts, ';', BOM, CRLF, décimales à virgule, dates jj/mm/aaaa, neutralisation (= + - @ tabulation retour) vérifiée dans le fichier, nom de fichier nettoyé, aucune requête réseau.
22. Export JSON (enveloppe format / version / exporte, met à jour derniereSauvegarde) et import JSON : taille ≤ 6 Mo (export compact), validation, rapport, confirmation de remplacement, Annuler ; fichier corrompu ou hostile (__proto__) sans effet.
23. Données illisibles ou version future : bannière, écritures bloquées, Exporter le brut, Réinitialiser avec confirmation, jamais d'écrasement silencieux ; partiel : bandeau avec export du brut d'origine.
24. Stockage indisponible (navigation privée ou bloqué) : mode mémoire et témoin « indisponible » ; quota dépassé : rollback de l'état et témoin « Échec — exportez ».
25. Pont CRA : bouton « Depuis mes heures » visible seulement si le mois a des heures (badge = nombre de jours), aperçu avant / après, Compléter ne décoche jamais et ne remplace pas une activité non vide, Remplacer avec confirmation, activité optionnelle, Annuler (10 s), annonce dans #calLiveRegion, total et PDF recalculés.
26. Fragment #heures-AAAA-MM : regex stricte, ouvre la pop-up et le dialogue sans rien appliquer, propose le changement de mois via changerPeriode (archive), hash nettoyé ; le CRA n'écrit jamais taf_heures_v1 et Heures n'écrit jamais cra_app_v3.
27. Mêmes nombres partout : la vue Mois, la ligne CRA du jour, la synthèse CSV et l'import CRA donnent un équivalent en jours identique (TAF.heures.demiJournees).
28. Accessibilité : landmarks, lien d'évitement, role=timer aria-live=off (aucune annonce par seconde), annonces aux changements d'état seulement, dialogues avec focus piégé et restitué, Échap ferme la surface du dessus, alternatives à chaque geste, focus visible, contraste AA avec trois accents différents.
29. Responsive : matrice complète de CLAUDE.md §4 (320×568 → 1920×1080, paysages, tablettes) avec vues fermées, feuille Plage, feuille Chrono, tiroir, Export et import CRA ouverts : scrollWidth ≤ innerWidth, cibles ≥ 44 px, dock / pilule / carte selon le palier, rien de masqué derrière le dock ou la barre d'onglets ; zoom 200 % et reflow à 320 px.
30. Animations : uniquement transform / opacity, pas de CLS, halo seulement en marche et onglet visible, tout est coupé avec prefers-reduced-motion (vibration comprise), view-transitions en amélioration progressive sans erreur sur un navigateur non compatible.
31. file:// sous Chrome : heures.html fonctionne (scripts classiques defer, pas de module ES) ; tests/index.html tout au vert sans toucher les vraies clés localStorage.

 Elle est à rejouer sur toute la matrice de CLAUDE.md §4, surfaces fermées **et** ouvertes, avec la console sans erreur ni violation CSP. La checklist CRA (CLAUDE.md §9) est également à rejouer après l'ajout du pont.

## 15. Tests unitaires (`tests/index.html` + `tests/heures.test.js`, stockage simulé, jamais les vraies clés)

**Temps et formats**
1. `minutes('09:30')` → 570 ; `minutes('24:00')` → 1440 ; `minutes('7:00')` → `NaN` / invalide ; `versHHMM(1440)` → `'24:00'` ; `versHHMM(5)` → `'00:05'`.
2. `format.duree(0)` → `'0 min'` ; `45` → `'45 min'` ; `60` → `'1 h'` ; `450` → `'7 h 30'` ; `605` → `'10 h 05'`.
3. `format.decimal(450)` → `'7,5'` ; `10` → `'0,17'` ; `0` → `'0'` ; `format.dureeLongue(209)` → `'3 heures 29 minutes'` ; `60` → `'1 heure'` ; `1` → `'1 minute'`.
4. `arrondir(577,15,'proche')` → 570 ; `arrondir(578,15,'proche')` → 585 ; `arrondir(571,15,'bas')` → 570 ; `arrondir(571,15,'haut')` → 585 ; `arrondir(571,1,'proche')` → 571.

**Dates**
5. `dates.semaineIso('2026-01-01')` → `{annee:2026, semaine:1}` ; `'2027-01-01'` → `{2026, 53}` ; `'2020-12-31'` → `{2020, 53}` ; `dates.lundiDe('2026-10-14')` → `'2026-10-12'` ; `dates.lundiDe('2026-10-12')` → `'2026-10-12'`.
6. `dates.cleValide('2026-02-30')` → false ; `'2024-02-29'` → true ; `'2026-13-01'` → false ; `'1999-12-31'` → false ; `'2026-1-01'` → false.

**Chrono : découpe des segments**
7. `decouperSegment(new Date(2026,9,14,9,2,0), new Date(2026,9,14,12,31,40), 1, 'proche')` → `{'2026-10-14':[{d:'09:02',f:'12:32'}]}`.
8. Même segment avec `pas` 15 et `favorable` → `{d:'09:00', f:'12:45'}`.
9. `decouperSegment(new Date(2026,9,14,22,30), new Date(2026,9,15,1,15), 1, 'proche')` → `{'2026-10-14':[{d:'22:30',f:'24:00'}], '2026-10-15':[{d:'00:00',f:'01:15'}]}`.
10. Segment de 40 s → `{}` (ignoré) ; `fin < debut` → `{}` et `horlogeReculee: true`.
11. *(seulement si `Intl…timeZone === 'Europe/Paris'`, sinon « ignoré »)*
    - `new Date(2026,9,25,1,30)` → `new Date(2026,9,25,3,30)` (180 min réelles) → `{'2026-10-25':[{d:'01:30',f:'04:30'}]}` ;
    - `new Date(2026,2,29,1,30)` → `new Date(2026,2,29,3,30)` (60 min réelles) → `{d:'01:30', f:'02:30'}`.

**Insertion et normalisation**
12. `insererPlage([{09:00–12:00 A}], {11:00–13:00})` → `[09:00–11:00 A, 11:00–13:00]`, avec `rognees` de longueur 1.
13. `insererPlage([{09:00–12:00 A}], {10:00–11:00})` → `[09:00–10:00 A, 10:00–11:00, 11:00–12:00 A(nouvel id)]`.
14. `insererPlage([{09:00–12:00}], {08:00–13:00})` → `[08:00–13:00]`.
15. `normaliserJour([{14:00–15:00},{09:00–11:00},{10:00–12:00},{16:00–16:00}])` → `[09:00–11:00, 11:00–12:00, 14:00–15:00]`.
16. `normaliserJour([{09:00–10:00 s1 pA},{10:00–11:00 s1 pA}])` → `[09:00–11:00]` ; même cas avec des `p` différents → inchangé ; sans `s` → inchangé.
17. `unionMinutes([09:00–11:00, 10:00–12:00])` → 180 ; `unionMinutes([])` → 0.

**Conversion en demi-journées** (défauts : coupure 13:00, `dureeJourMin` 420, seuil auto 105, rattrapage)
18. `09:00–12:30 + 13:30–17:00` → `{am:true, pm:true, minAm:210, minPm:210}`.
19. `14:00–16:00` → `{am:false, pm:true}` ; `11:00–14:00` → `{am:true, pm:false, minAm:120, minPm:60}`.
20. `12:00–14:00` → `{am:true, pm:false}` (rattrapage, égalité : matin) ; même cas avec `rattrapage:false` → `{am:false, pm:false}`.
21. `12:30–13:30` → `{false, false}` ; `13:00–14:45` → `{am:false, pm:true}` ; `13:00–14:44` → `{false, false}` ; `[]` → `{false, false, 0, 0}`.
22. Chevauchement `[09:00–11:00, 10:00–12:00]` → `minAm` 180, `am:true` ; `22:00–24:00` → `pm:true` ; `coupure` à `'12:00'` avec `11:00–13:00` → rattrapage `am:true`.

**Saisie rapide** (ctx : jour courant `2026-10-14`, `maintenantMin` 907 (15:07), `pas` 1, `debutHabituel` 09:00)
23. `'9-12:30'` → `[{d:'09:00',f:'12:30'}]`, aucune erreur.
24. `'9-12:30 13:30-17 @cli réunion'` avec le projet « Client A » → 2 plages avec `p = id(Client A)`, `note = 'réunion'`.
25. `'9h30–12h'` → `09:30–12:00` ; `'930-1200'` → idem ; `'9-1'` → `09:00–13:00`.
26. `'22-2'` → `{'2026-10-14':[22:00–24:00], '2026-10-15':[00:00–02:00]}` avec `traverseMinuit:true`.
27. `'2h'` (aujourd'hui) → `13:07–15:07`. Pour un jour passé dont la dernière plage finit à 12:00 → `12:00–14:00`. Pour un jour passé vide → `09:00–11:00`. `'1h30'`, `'90min'` et `'1,5h'` donnent tous 90 min.
28. Erreurs : `'9'` → erreur « incomplet » ; `'25-26'` → heure invalide ; `'9-9'` → durée nulle ; `'9-12 10-11'` → chevauchement interne ; `'@inconnu 9-10'` → projet inconnu (jeton `'inconnu'`) ; `'@c 9-10'` avec « Client A » et « Conseil » → projet ambigu.
29. `''` → `{plages:[], erreurs:[]}` ; `'9-10 <img src=x>'` → `note === '<img src=x>'`, chaîne conservée telle quelle.

**CSV**
30. `csv.cellule('=SUM(A1)')` → `'"\'=SUM(A1)"'` ; `'+33'` → `'"\'+33"'` ; `'-x'`, `'@x'`, `'\tx'` et `'  =x'` sont préfixés par `'` ; `'a"b'` → `'"a""b"'` ; `'Réunion'` → `'"Réunion"'`.
31. `csv.construire([['A','B'],['c','d']])` commence par `﻿`, utilise `;` et des fins de ligne `\r\n`.

**Validation des données**
32. `valider(JSON.parse('{"__proto__":{"pollue":1},"v":1,"jours":{}}'))` → `({}).pollue === undefined` et `donnees.jours` sans prototype pollué.
33. Clés de jour `'2026-02-30'`, `'__proto__'` et `'constructor'` rejetées ; `rapport.ignores` est égal à 3.
34. Plage avec `d:'24:00'` rejetée ; `f:'24:00'` acceptée ; `p` inconnu ramené à `''` ; note de 300 caractères tronquée à 200 ; `nom` de 60 caractères tronqué à 40 ; `t:9` ramené à 0.
35. `chrono:{e:'marche', t0:'abc'}` → `chrono:null` ; `t0` à `now + 2 jours` → `null` ; `v:2` → statut `'futur'` ; chaîne non JSON → statut `'illisible'` ; 49 plages sur un jour → 48 conservées, `ignores >= 1`.

**Pont CRA**
36. `planifierImport({3:{am:true,pm:false,act:''}}, {3:{am:true,pm:true,activite:'Client A'}}, 'completer', true)` → jour 3 `apres = {am:true, pm:true, act:'Client A'}`.
37. En mode `completer`, un jour CRA `{am:true, pm:true, act:'X'}` avec des heures `{am:true, pm:false}` ne produit aucun changement (rien n'est décoché, l'activité est conservée).
38. En mode `remplacer`, un jour CRA `{am:true, pm:true, act:'X'}` sans heures donne `apres = {am:false, pm:false, act:'X'}`, et `synthese.decoches` vaut 2.
39. `activiteJour` avec les projets A, B, A et les notes 'r', '', 'r' → `'A · B · r'`. Une sortie de plus de 200 caractères est tronquée avec `'…'`.
40. Regex de hash : `'#heures-2026-10'` → ok ; `'#heures-2026-13'`, `'#heures-2026-10&x'` et `'#heures-26-10'` → refusés.
41. `resumeMois` sur octobre 2026, avec des plages au 14 et au 15 seulement, ne renvoie que les clés `{14, 15}`. Une plage du `2026-11-01` est exclue.

**Identifiants**
42. `TAF.id('h')` correspond à `^h_[a-z0-9]{10}$`, et 1000 tirages ne produisent aucun doublon.

**Tests Playwright (http://127.0.0.1)**
- Matrice complète de CLAUDE.md §4, avec la vue Jour, la vue Semaine, la vue Mois, la feuille Plage ouverte, la feuille Chrono ouverte, le tiroir ouvert, le dialogue Export ouvert et le dialogue d'import dans le CRA ouvert. À chaque fois : `scrollWidth ≤ innerWidth`, cibles ≥ 44 px, aucun rognage.
- Parcours complet : premier lancement, chrono démarrer / pause / reprendre / arrêter, rechargement pendant la marche, saisie rapide, Annuler, puis remplissage de la semaine, export CSV, import dans le CRA.
- Console sans erreur ni violation CSP.
