# CLAUDE.md — TAF (suite : CRA + Heures)

Contexte de travail pour tout agent qui touche à TAF. À lire **avant** toute
modification. Ce qui compte le plus : le **principe de généralisation**
(critère prioritaire, §3), l'**architecture** (§2), les **interdits** (§5), la
**sécurité** (§8) et la **non-régression** (§9).

---

## 1. Raison d'être

**TAF** est la boîte à outils du consultant / de la société sous-traitante :
100 % locale, sans compte ni serveur. Deux modules, **une page chacun** :

- **CRA** (`index.html`) — Compte Rendu d'Activité mensuel : cocher les
  demi-journées sur un calendrier (pop-up), saisir l'activité, renseigner les
  infos, signer, exporter un PDF A4 d'une page. Bonus hors PDF : estimation de
  revenu (TJM × jours − charges).
- **Heures** (`heures.html`) — suivi / comptabilité des heures de travail.
  Spécification détaillée : [`docs/heures-spec.md`](docs/heures-spec.md).

## 2. Architecture — à préserver

Site **statique multi-pages** servi par GitHub Pages (`benderm27.github.io`).
**Zéro build, zéro dépendance, zéro framework** : HTML + CSS + JS vanilla,
fichiers locaux uniquement.

| Fichier | Rôle |
|---|---|
| `index.html` | Module CRA (URL historique conservée) |
| `heures.html` | Module Heures |
| `assets/taf.css` | Socle visuel partagé : jetons, base, composants communs (topbar, navigation de modules, boutons, champs `.taf-input`, tiroir, feuilles / dialogues `.taf-feuille`, overlay, toasts, témoin, pastille tri-état), animations, view-transitions |
| `assets/taf.js` | Noyau partagé exposé en global gelé `TAF` (API documentée en tête de fichier) : stockage sûr, sauvegarde différée partagée (`creerSauvegarde`), apparence partagée + section « Apparence » du tiroir, `gererModale`, `glisserPourFermer`, `annoncer`, toasts, utilitaires DOM sûrs, validateurs, formats fr-FR, navigation (+ pastille chrono en cours), impression (`preparerImpression`), et logique pure du module Heures `TAF.heures.*` (conversion heures → demi-journées, plan d'import CRA…) |
| `assets/cra-donnees.js` | Validateurs purs du CRA (sans DOM, global gelé), chargés avant `cra.js` et par `tests/` |
| `assets/cra.css`, `assets/cra.js` | Spécifique CRA (écran) |
| `assets/cra-print.css` | Impression du CRA, liée en `media="print"` et basculée en `all` par l'auto-fit le temps de mesurer : **toute règle d'impression du CRA va ici**, jamais dans un `@media print` d'une autre feuille (elle ne serait pas prise en compte par la mesure) |
| `assets/heures.css`, `assets/heures.js` | Spécifique Heures |
| `tests/` | Tests unitaires navigateur, zéro dépendance (`index.html`, `harnais.js`, `tests.js`, `cra.test.js`, `heures.test.js`) |
| `assets/favicon.svg`, `_config.yml` | Favicon ; exclusion Jekyll des fichiers internes |

- **Scripts classiques** `<script src="…" defer>`, `taf.js` chargé en premier.
  **Pas de modules ES** : ils échouent en `file://`.
- **Ce qui est commun aux deux pages vit dans `taf.css` / `taf.js`** — jamais
  copié-collé dans une page.
- **Titre fixe** : `<title>TAF</title>` sur toutes les pages, jamais modifié à
  l'exécution. Seule exception : entre `beforeprint` et `afterprint`, le titre
  prend le nom de fichier PDF (`CRA_<société>_<mois>_<année>`, nom par défaut
  proposé par le navigateur) puis revient immédiatement à `TAF`.
- **Navigation** : bascule de module dans la topbar (≥ 700 px) / barre
  d'onglets fixée en bas avec safe-area (< 700 px) ; `aria-current="page"` sur
  le module actif ; fondu d'entrée du contenu à chaque page. Les transitions
  inter-documents (`@view-transition`) sont **désactivées** : sous la CSP
  stricte, Chromium les abandonne (vérifié) et on ne relâche pas la CSP pour
  un effet. Les transitions internes à une page (`startViewTransition`)
  restent actives.
- **100 % côté client, hors-ligne, local** : persistance uniquement par
  `localStorage`, protégée si indisponible. Aucun appel réseau.
- Pour tester : servir le dossier en statique (`http://`) ; l'ouverture directe
  en `file://` sous Chrome doit rester fonctionnelle.

### Clés de stockage — un seul écrivain par clé

| Clé | Écrivain | Contenu |
|---|---|---|
| `taf_prefs_v1` | `taf.js` (API `TAF`, appelée par les deux pages ; synchro inter-onglets via l'événement `storage`) | apparence partagée `{accent, mark, logo, motif}`, migrée une fois depuis `cra_app_v3` |
| `cra_app_v3` | `cra.js` | le CRA (`state`, sans l'apparence après migration) |
| `cra_profiles_v1` | `cra.js` | profils d'identité (l'apparence d'un profil est appliquée via l'API `TAF`) |
| `taf_heures_v1` | `heures.js` | module Heures |

Un module **n'écrit jamais** dans la clé d'un autre ; il peut la **lire**
(ex. le CRA lit `taf_heures_v1` pour proposer « Importer mes heures »).

## 3. Principe de généralisation — CRITÈRE PRIORITAIRE

TAF doit rester **générique, réutilisable, non couplé à un cas particulier**.
Toute évolution est jugée d'abord là-dessus :

1. **Une seule source de vérité par module.** CRA : `state.days =
   { [numJour]: {am, pm, act} }` (+ `fields`, `provisoire`, `tjm`, `charges`,
   `sig`, `month`, `year`, `presets`, `archive`). La grille, le tableau PDF, le
   total, l'estimation et la fiche du jour **dérivent tous du même état** — une
   seule logique pour mobile et desktop.
2. **Vues et exports dérivés, jamais dupliqués** (`etatJour()`,
   `recalculer()`, `construireTableauPdf()`…). Pas de seconde copie d'état.
3. **Rien de codé en dur pour un cas d'usage** : société, client, consultant,
   TJM, projets, objectif d'heures, mise en page… tout le spécifique est
   **paramétrable** avec un défaut sensé. L'identité ALVEOLEN (ambre
   `#E2A400`, hexagone) n'est qu'un **défaut** remplaçable.
4. **Heures** : projets / étiquettes vides au départ ; objectif hebdomadaire,
   durée d'une journée, seuils de conversion heures → demi-journées :
   paramétrables (défauts : 35 h / semaine, 7 h / jour) — jamais une hypothèse
   de contrat codée en dur.
5. **Une règle = un endroit** : une règle utilisée par les deux modules vit
   dans `taf.js`.
6. **Auto-suffisant** : pas de réseau, de service externe ni de build
   introduits « en passant ».

> Toute feature qui exigerait du spécifique est proposée en
> **paramétrable / optionnel avec un défaut sensé**, jamais en dur.

## 4. Système visuel

Socle dans `assets/taf.css`, spécificités dans le CSS de chaque module.
Réutiliser les jetons ; ne pas réintroduire de valeurs en dur.

### Palette (jetons `:root`)
- **Accent** (défaut ambre ALVEOLEN) : `--accent:#E2A400`, `--on-accent`
  calculé pour le contraste. Variantes via `color-mix()` : `--accent-top`,
  `--accent-deep`, `--accent-fill`, `--accent-fill-2`, `--accent-edge`,
  `--accent-ring`. **Jamais de teinte d'accent en dur** — l'accent est
  personnalisable.
- **Encre** : `--ink`, `--ink-soft`, `--muted`, `--faint`.
- **Lignes** : `--line`, `--line-2`, `--line-3`.
- **Fonds** : `--canvas-top`, `--canvas`, `--paper`, `--paper-2`.

### Rayons, ombres, typo
- Rayons `--radius` 20 / `--radius-md` 14 / `--radius-sm` 11 / `--r1` 7.
- Ombres en couches `--shadow-soft`, `--shadow-sheet`, `--shadow-pop`.
- Pile système (`--font`). Chiffres en `tabular-nums`. Micro-labels en
  majuscules + letter-spacing.
- Signature : motif hexagone en fond (~0.05), désactivable (`body.no-motif`).
- Icônes de marque `TAF.MARQUES` (`hex` défaut, `drop`, `doc`, `spark`,
  `bolt`, `leaf`), logo importable (réduit à l'import), 8 swatches d'accent.

### Responsive — « ultra responsive »
Le CRA garde ses jetons de grille pilotés par palier (`--cell-min`,
`--slot-h`, `--num-size`, `--full-size` — ne pas figer ces tailles ailleurs).
Calendrier CRA en **pop-up modale** ; contenu du document en pleine largeur
(une colonne en mobile, deux colonnes internes sur grand écran).

**Matrice de test obligatoire** (les deux pages, surfaces fermées ET ouvertes :
pop-up, tiroir, feuilles) — téléphones portrait 320×568, 360×740, 375×667,
390×844, 414×896, 430×932 ; téléphones paysage 667×375, 844×390 ; tablettes
portrait 600×960, 768×1024, 820×1180 ; tablettes paysage 1024×768,
1180×820 ; portables 1280×720, 1366×768, 1440×900 ; bureau 1920×1080 ;
+ zoom 200 % (reflow sans scroll horizontal à 320 px CSS).
Critères durs : `scrollWidth ≤ innerWidth` partout, aucun contenu rogné,
cibles tactiles ≥ 44×44 px sur les paliers tactiles, texte lisible.

### Animations & fluidité
Uniquement `transform` / `opacity` (60 fps), durées 150–320 ms, easing unique
`--ease` = `cubic-bezier(.22,.61,.27,1)`. Aucun décalage de mise en page (CLS).
`prefers-reduced-motion: reduce` → animations coupées. Pas de transition
inter-documents (CSP, cf. §2) : fondu d'entrée de page + transitions internes
via `document.startViewTransition` (amélioration progressive).

### Impression / PDF (CRA)
Ordre document (infos → tableau → total → commentaire → signatures), A4
portrait, **auto-fit** une page. Le calendrier est masqué au profit du tableau
`.print-table` (généré depuis l'état). Colonnes : **Matin · Après-midi · Date ·
Activité réalisée**. Total imprimé (`#printTotalNum`). Jours non cochés
(`tr.nc`) et week-ends (`tr.we`) en deux gris **transparents** distincts
(laissent voir le filigrane). Mode **Provisoire** : filigrane, signatures
masquées, total conservé.

## 5. Interdits

- ❌ Framework, build, bundler, dépendance externe (CDN, police web, script
  tiers). Fichiers statiques locaux uniquement.
- ❌ Modules ES ; `<script>` / `<style>` inline ; attributs `style="…"` ;
  gestionnaires `on…=` dans le HTML (CSP stricte, §8).
- ❌ Code commun copié dans une page au lieu de `taf.css` / `taf.js`.
- ❌ Valeur spécifique en dur (société, client, TJM, projet, objectif…).
- ❌ Logique dupliquée mobile / desktop ; seconde copie d'un état.
- ❌ Écrire dans la clé de stockage d'un autre module.
- ❌ Envoi de données, endpoint externe, télémétrie.
- ❌ `innerHTML` / `outerHTML` / `insertAdjacentHTML` avec une donnée
  utilisateur ; `eval` / `new Function`.
- ❌ Secret ou clé en dur.
- ❌ Casser le responsive, l'auto-fit une-page du PDF ou une fonction du §9.

## 6. Accessibilité — WCAG 2.2 AA, acquis à ne pas régresser

- Focus visible net (`:focus-visible`, anneau accent) ; `prefers-reduced-motion`.
- Cibles tactiles ≥ 44×44 px.
- États encodés par la **forme**, pas seulement la couleur (pastille hexagone
  tri-état…).
- Surfaces modales : `role="dialog"`, `aria-modal`, focus déplacé / piégé /
  restitué (`gererModale`), Escape ferme la surface la plus haute.
- `aria-live` pour les résultats d'action (pas d'annonce chaque seconde pour un
  chronomètre) ; `aria-current` (module actif, jour courant) ; landmarks.
- Contraste AA sur tous les accents personnalisés (`--on-accent` calculé).

## 7. Conventions

- **UI et code en français** (`construireGrille`, `definirCreneau`,
  `recalculer`…).
- Formats **fr-FR** : demi-journée `0,5 j` ; montants
  `toLocaleString('fr-FR', {style:'currency', currency:'EUR'})` ; dates
  `jj/mm/aaaa` à l'impression ; heures 24 h `HH:MM` ; durées `7 h 30`
  (décimal `7,5 h` dans les exports).
- Semaine commençant le **lundi**. Matin = avant la coupure (défaut 13:00),
  après-midi = après.
- CRA : un mois affiché à la fois ; changer de période **archive** le mois
  courant (`state.archive`) puis charge le mois demandé.

## 8. Sécurité — maximum

- **CSP meta identique sur chaque page**, sans `'unsafe-inline'` ni
  `'unsafe-eval'` :
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; require-trusted-types-for 'script'; trusted-types 'none'`
  (toute exception doit être justifiée et minimale ; vérifié : `'self'`
  fonctionne en `file://` sous Chrome). Styles dynamiques **uniquement via
  CSSOM** (`el.style.setProperty`, variables CSS) — jamais de `<style>` créé
  dynamiquement.
- **Trusted Types `'none'`** : aucun puits HTML (`innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `DOMParser`…) n'est utilisable à l'exécution sous
  Chromium — le DOM se construit par `createElement` / `createElementNS` /
  `textContent` (SVG à partir de constantes).
- DOM : création d'éléments + `textContent` ; balisage HTML seulement pour des
  constantes statiques du code (ex. SVG `MARKS`).
- **Toute donnée lue est non fiable** (localStorage, fichier importé) :
  `JSON.parse` en `try/catch`, validation de forme et de type, **clés validées
  par regex** (jour 1–31, date `AAAA-MM-JJ`, `HH:MM`…) — jamais d'affectation
  sur une clé non validée (pollution de prototype : `__proto__`,
  `constructor`, `prototype`).
- Export CSV : neutraliser l'injection de formules (cellule commençant par
  `= + - @` tabulation ou retour → préfixe `'`), échapper `"`.
- Bornes : longueur max des textes, taille max des images (logo, signatures),
  gestion propre du quota (témoin de sauvegarde).
- Aucun secret, aucune sortie réseau, pas de télémétrie. `referrer` :
  `no-referrer`.
- Fichiers internes (`CLAUDE.md`, `docs/`, `tests/`, `.claude/`) : ne pas les
  publier sur le site (exclusion Jekyll via `_config.yml`, à versionner avec le
  reste). Le dépôt étant public, ils restent lisibles sur github.com.
- **Hébergement** : ne jamais activer GitHub Pages sur un autre dépôt du compte
  (il serait servi sous `benderm27.github.io/<dépôt>/`, donc sur la **même
  origine** que TAF, avec un accès complet à ses `localStorage`).
- **Anti-cadre** : `frame-ancestors` est ignoré en `<meta>` et GitHub Pages
  n'envoie pas d'en-tête : `taf.js` neutralise l'application si elle est
  affichée dans un cadre (aucune écriture possible).

## 9. Non-régression — checklist

**CRA** (à revérifier après toute modification) :
1. Carte déclencheur « Modifier le calendrier » + compteur → pop-up calendrier ;
   créneaux matin / après-midi ; pastille hexagone tri-état ; clic-glissé
   (souris) ; fiche du jour mobile (feuille basse, glisser pour fermer).
2. Aides : activité par défaut + Appliquer, Jours ouvrés, Tout décocher,
   modèles d'activité (+ Modèle, puces, suppression).
3. Total, estimation (TJM / charges).
4. Infos, titre du document, commentaire, signatures (dessin, import, glisser-
   déposer, effacer, nom / date).
5. Mois / année + archive multi-mois.
6. Export / import JSON (validation, confirmation, ancien et nouveau format).
7. Témoin de sauvegarde (succès / échec / indisponible).
8. Annonces `aria-live` (`#liveRegion`, `#calLiveRegion`).
9. Focus piégé (fiche, tiroir, calendrier) ; Escape ferme la surface du dessus.
10. Profils d'identité (enregistrer / appliquer / supprimer).
11. Mention Provisoire (badge écran, filigrane PDF, signatures masquées).
12. PDF : tableau Matin · Après-midi · Date · Activité, total imprimé, gris
    transparents `we` / `nc`, auto-fit une page, dates `jj/mm/aaaa`, titre /
    commentaire vides masqués.
13. Apparence : accent (swatches + sélecteur, encre lisible), icône / logo,
    motif — désormais partagée entre les modules.
14. Effacer mes données.

**Heures** : voir la checklist de `docs/heures-spec.md`.

## 10. Tests

- `tests/index.html` : tests unitaires des fonctions pures (durées, découpe à
  minuit, conversion heures → demi-journées, échappement CSV, validateurs,
  migration). **Ne touchent jamais les vraies clés `localStorage`** (stockage
  en mémoire simulé).
- Playwright sur `http://` (le MCP bloque `file://`) : matrice responsive §4,
  parcours complets, rendu print (`browser_emulate_media`), console sans erreur
  et sans violation CSP.
- Vérification `file://` sous Chrome : `chrome --headless=new --dump-dom
  file:///…/index.html` → le DOM généré (grille, etc.) doit être présent.
