# CLAUDE.md — Générateur de CRA

Contexte de travail pour tout agent qui touche à cet outil. À lire **avant**
toute modification. Les trois sections qui comptent le plus : le **principe de
généralisation** (critère prioritaire), les **interdits**, le **système
visuel**.

---

## 1. Raison d'être

**Générateur de CRA** (Compte Rendu d'Activité) : un outil qui permet à un
consultant / une société sous-traitante de produire son CRA mensuel, puis de
l'exporter en PDF prêt à signer.

Parcours : choisir mois/année → cocher les demi-journées travaillées sur un
calendrier (matin / après-midi, ou journée complète) → saisir l'activité par
jour → renseigner les infos (société, client, consultant, destinataire) →
signer → exporter le PDF sur une page A4.

En bonus (hors PDF) : une estimation de revenu indicative (TJM × jours,
moins les charges).

## 2. Architecture — à préserver

- **Un seul fichier : [`index.html`](index.html).** HTML + `<style>` inline +
  un `<script>` en IIFE. Rien d'autre.
- **Zéro dépendance, zéro build, zéro framework.** Vanilla JS, pas de npm au
  runtime, pas de bundler, pas d'étape de compilation. On ouvre le fichier,
  ça marche.
- **100 % côté client, hors-ligne.** Aucun appel réseau. La persistance passe
  **uniquement** par `localStorage` (clé `cra_app_v3`, cf. `STORE_KEY`),
  protégée si `localStorage` est indisponible.
- **Confidentialité comme promesse produit** : « Données enregistrées
  localement sur cet appareil uniquement. Rien n'est envoyé en ligne. »
- Hébergé en page GitHub Pages (`benderm27.github.io`).
- Pour tester : ouvrir `index.html` dans un navigateur (ou le servir en
  statique). Pas de commande de lancement.

## 3. Principe de généralisation — CRITÈRE PRIORITAIRE

L'outil doit rester **générique, réutilisable, non couplé à un cas
particulier**. Toute évolution est jugée d'abord là-dessus. Concrètement :

1. **Une seule source de vérité.** `state.days = { [numJour]: {am, pm, act} }`
   (plus le reste de `state` : `fields`, `accent`, `mark`, `logo`, `motif`,
   `provisoire`, `tjm`, `charges`, `sig`, `month`, `year`, `presets`,
   `archive` ; + la clé séparée `cra_profiles_v1` pour les profils
   d'identité). La grille écran, le tableau PDF,
   le total, l'estimation et la fiche du jour (mobile) **dérivent tous du même
   état**. Le même état alimente les vues mobile et desktop — **jamais** deux
   logiques parallèles à maintenir.

2. **Vues et exports dérivés, jamais dupliqués.** L'état d'un jour (pastille
   tri-état), le total, le tableau PDF sont **recalculés à la demande** depuis
   `state` (`etatJour()`, `recalculer()`, `construireTableauPdf()`). Pas de
   seconde copie de l'état à resynchroniser.

3. **Rien de hardcodé à un cas d'usage.** Aucun nom de société, client,
   consultant, ESN, TJM ou mise en page figée dans le code. Tout ce qui est
   spécifique est **paramétrable** : couleur d'accent, logo/icône, motif,
   valeurs des champs, rôles des signataires, TJM/charges. L'identité ALVEOLEN
   (accent ambre `#E2A400`, hexagone) n'est qu'un **défaut**, entièrement
   remplaçable par l'utilisateur.

4. **Auto-suffisant.** Un seul fichier, sans dépendance ni backend. On
   n'introduit pas de réseau, de service externe ou de build « en passant ».

> Toute feature qui exigerait du spécifique doit être proposée en
> **paramétrable / optionnel avec un défaut sensé**, jamais en dur.

## 4. Système visuel

Tous les styles vivent dans le `<style>` de `index.html`, organisés en
sections numérotées (1. Jetons de design … 15. Système responsive). Réutiliser
les jetons existants ; ne pas réintroduire de valeurs en dur.

### Palette (jetons `:root`)
- **Accent ambre ALVEOLEN** : `--accent:#E2A400`, `--on-accent` calculé pour le
  contraste. Variantes dérivées via `color-mix()` : `--accent-top`,
  `--accent-deep`, `--accent-fill`, `--accent-fill-2`, `--accent-edge`,
  `--accent-ring`. **Ne pas coder de teinte d'accent en dur** — passer par ces
  jetons pour que la couleur personnalisée fonctionne.
- **Encre** : `--ink #15171C`, `--ink-soft`, `--muted`, `--faint`.
- **Lignes** : `--line`, `--line-2`, `--line-3`.
- **Fonds** : `--canvas-top`, `--canvas`, `--paper`, `--paper-2`.

### Rayons, ombres, mouvement
- Rayons : `--radius:20px`, `--radius-md:14px`, `--radius-sm:11px`, `--r1:7px`.
- Ombres en couches : `--shadow-soft`, `--shadow-sheet`, `--shadow-pop`.
- Typo : pile système (`--font`, `-apple-system…`). Chiffres en
  `font-variant-numeric:tabular-nums`. Micro-labels en majuscules + letter-spacing.
- Animation : easing unique `--ease` = `cubic-bezier(.22,.61,.27,1)`.
- Signature de marque : motif hexagone (alvéole) en fond, opacité ~0.05,
  désactivable (`body.no-motif`).

### Icônes / identité
- Jeu d'icônes de marque : `hex` (défaut), `drop`, `doc`, `spark`, `bolt`,
  `leaf` (objet `MARKS`). Logo importé possible (remplace l'icône, apparaît sur
  le PDF).
- Palette de swatches d'accent : 8 couleurs (`SWATCHES`).

### Système responsive continu (jetons pilotes)
Les dimensions du calendrier viennent de jetons recalculés par palier :
`--cell-min`, `--slot-h`, `--num-size`, `--full-size`. **Ne pas figer ces
tailles en pixels ailleurs** — ajuster le jeton au palier voulu.

Structure unifiée : le **calendrier vit dans une pop-up modale** (`#calPanel`,
`role="dialog"`, focus géré par `gererModale()`), ouverte par une **carte
déclencheur** (« Modifier le calendrier » + compteur de jours cochés dérivé de
`recalculer()`). Le **contenu du document** (infos, estimation, commentaire,
signatures, tableau PDF) occupe la **pleine largeur** : une colonne en mobile,
**deux colonnes internes** (`.lay-grid`) sur grand écran. Une seule logique —
pas de vue mobile/desktop séparée à maintenir.

Paliers : `≤389` (petit téléphone, hexagone resserré), `≤560` (colonnes → 1),
`≤699` (téléphone : pop-up calendrier plein écran glissant + fiche du jour en
feuille basse), `≥1000` (contenu en 2 colonnes internes), `≥1280`, `≥1600`
(ultra-large), + garde « paysage court ». **Zéro débordement horizontal** à
tous les paliers (`scrollWidth ≤ innerWidth`), pop-up ouverte comme fermée.

### Impression / PDF
Réagencement vers l'ordre document (infos → tableau liste → total → commentaire
→ signatures) en A4 portrait, avec **auto-fit** (zoom mesuré pour tenir sur une
page). Le calendrier-grille est masqué à l'impression au profit du tableau
liste (`.print-table`, généré depuis l'état). Colonnes du tableau, de gauche à
droite : **Matin · Après-midi · Date · Activité réalisée**. Les jours **non
cochés** (`tr.nc`) sont grisés d'une teinte **distincte** du week-end (`tr.we`).

## 5. Interdits

- ❌ **Pas de framework / build / bundler / dépendance runtime.** Ça reste un
  seul `index.html` auto-suffisant.
- ❌ **Pas de valeur spécifique en dur** (société, client, consultant, TJM,
  layout d'un cas précis). Le spécifique = paramétrable, optionnel, avec défaut.
- ❌ **Pas de logique dupliquée** entre vue mobile et desktop. Un seul état,
  des vues dérivées.
- ❌ **Pas de seconde copie de l'état** à maintenir en parallèle de
  `state.days` / `state`. Toujours dériver.
- ❌ **Pas d'envoi de données**, pas d'endpoint externe, pas de télémétrie /
  analytics. Les données restent locales ; la promesse de confidentialité est
  intacte.
- ❌ **Pas de `innerHTML` avec du contenu utilisateur non échappé**, pas de
  `eval` / `new Function`. Le texte utilisateur (activités) est échappé
  (`& < >`) avant insertion — garder cette règle ; préférer `textContent`.
- ❌ **Pas de secret / clé en dur.**
- ❌ **Ne pas casser** le responsive à jetons ni l'auto-fit une-page du PDF.

## 6. Accessibilité — acquis à ne pas régresser

- Focus visible net (`:focus-visible`, anneau accent), respect de
  `prefers-reduced-motion`.
- Cibles tactiles ≥ 44×44px (créneaux, pastille journée complète, boutons de
  la fiche du jour).
- **États encodés par la forme, pas seulement la couleur** : la pastille
  hexagone « journée complète » est tri-état (vide / demie / pleine) lisible en
  niveaux de gris. Ne pas retomber sur « couleur seule ».
- `aria-pressed` / `aria-label` sur les contrôles du calendrier, `aria-hidden`
  géré sur les feuilles/tiroirs. Compléter (landmarks, `aria-current`,
  `aria-live`) sans ajouter d'ARIA là où le HTML natif suffit.
- Viser WCAG 2.2 AA sur le contraste, sans casser l'identité visuelle.

## 7. Conventions

- **UI et code en français** (libellés, commentaires, noms de fonctions :
  `construireGrille`, `definirCreneau`, `recalculer`…). S'y conformer.
- Formats **fr-FR** : demi-journée = `0,5 j`, montants via
  `toLocaleString('fr-FR', {currency:'EUR'})`, dates `jj/mm/aaaa` à l'impression.
- Une demi-journée cochée = 0,5 j ; matin = moitié gauche, après-midi = moitié
  droite ; semaine commençant le **lundi**.
- Un CRA = **un mois affiché à la fois**. Changer de mois/année **archive** le
  mois courant dans `state.archive` (localStorage) puis charge le mois demandé —
  l'historique n'est plus détruit (feature archive multi-mois). `state.days`
  reste la seule vérité du mois affiché.
