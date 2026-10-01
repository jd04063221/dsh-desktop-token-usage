# Changelog

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-de.md) | Français | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ko.md)

Ce fichier documente toutes les modifications notables de `dsh-desktop-token-usage`.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), et les numéros de version suivent [Semantic Versioning](https://semver.org/).

> **Note de mise à jour** : ce plugin est un bundle DSH qui se charge en deux moitiés. `client.js` (l'interface) est rechargé à chaud par le navigateur,
> tandis que `index.js` / `lib/*` (le Host) **met en cache la génération de modules JS qu'il a déjà importée** à l'intérieur du processus DSH — réactiver
> le plugin ne suffit pas, pas plus que changer le spécificateur, réinstaller, ou même renommer le paquet (Node met en cache les ESM par realpath) :
> DSH doit être redémarré une fois avant que le nouveau code ne soit chargé. Pour savoir quelle génération tourne, vérifiez si `Config.listConfigs`
> rapporte `schema` ou `absent` pour ce plugin, ainsi que si le processus a été redémarré depuis votre modification ; `boot.json`
> est réécrit par chaque `apply`, sa présence ne dit donc que quand le fiber a été remonté pour la dernière fois.

## [Unreleased]

### Ajouté

- **Localisation (i18n)** : le tableau de bord suit désormais **le propre réglage de langue de DSH** — il n'a pas de
  sélecteur à lui, et changer de langue dans DSH bascule le tableau de bord immédiatement, sans rechargement. Dix langues
  sont livrées ici : `en` et `zh` via les dictionnaires intégrés de DSH, plus les paquets `zh-TW` (臺灣正體), `zh-HK` (香港繁體),
  `de`, `fr`, `es`, `it`, `ja` et `ko` que ce plugin enregistre dans le catalogue de DSH. Nombres, pourcentages, dates,
  noms de jours et de mois et formes de pluriel viennent tous de `Intl`, si bien que séparateurs de milliers, `萬`/`億` là
  où l'anglais écrit `K`/`M`/`B`, et les catégories de pluriel propres à chaque langue ressortent correctement. Les textes
  vivent dans `locales/<id>.json` et sont générés dans le bundle client par [`scripts/build-dicts.mjs`](../scripts/build-dicts.mjs) :
  le bloc généré ne doit jamais être modifié à la main, et un test échoue lorsqu'il est périmé. `translations/README-<id>.md` et
  `translations/CHANGELOG-<id>.md` portent les deux documents dans chacune des langues livrées. Note : choisir un paquet de langue laisse
  **la propre interface de DSH** sur `zh`/`en` — seul ce plugin bascule.

### Corrigé

- **L'infobulle de la tendance se lit comme celle de la carte de chaleur** : son titre ne colle plus la date au total de
  tokens — la date reste seule et le total est une ligne `Tokens` à part (forme compacte), si bien qu'une ligne est un
  chiffre.
- **Plus rien ne s'enroule dans une infobulle** : la boîte suit son contenu (`width:max-content`) et se suspend à la
  colonne survolée — ancrée à gauche dans la moitié de gauche, ancrée à droite dans la moitié de droite — au lieu de se
  centrer dans une boîte bornée, et un long nom de modèle comme `deepseek-v4.1-flash` est ellipsé sur une ligne au lieu
  d'être poussé sur une seconde.

### Prévu

- **Localisation, palier restant** : les six codes de langue `pt-BR`, `ru`, `vi`, `th`, `id` et `ar` sont conçus mais pas
  encore implémentés. `ar` exige aussi la coque de droite à gauche — marges intérieures, infobulles et côtés des axes en
  miroir, l'axe temporel restant de gauche à droite — qu'aucune des dix langues livrées ne demande. Voir
  [la conception](../docs/superpowers/specs/2026-10-01-i18n-design.md).

## [0.1.5] - 2026-10-01

### Ajouté

- **Une option de regroupement** : par modèle réel (modèles de même nom fusionnés entre fournisseurs), par fournisseur
  API, ou les deux. Avec « les deux », la section de tendance et la section de répartition portent chacune leur propre
  pastille, commutable indépendamment.
- **Une option de palette** : Primer (le défaut de GitHub), cvd (Okabe–Ito, accessible aux daltoniens) ou Atténuée (faible
  saturation), chacune livrant un jeu clair et un jeu sombre de variables qui suit automatiquement le thème du système.

### Modifié

- **La courbe de taux de réussite se superpose aux barres** : les barres empilées de tokens et la courbe de taux de
  réussite du cache partagent un seul graphique (la courbe est projetée sur la zone de tracé par l'amplitude
  min−10% span ~ max+10% span de la période, avec de vrais pourcentages étiquetés à droite), au lieu de prendre une
  bande à elle seule.
- **L'axe Y de la courbe de taux est piloté par les données** : le min/max de la période fixe l'étendue avec 10%
  d'amplitude ajoutés à chaque extrémité ; la courbe conserve l'interpolation cubique monotone.
- **Sémantique du taux de réussite** : le côté échec inclut désormais cacheWrite (hit / (hit + miss)), conforme à la
  définition officielle ; sur cette machine cacheWrite vaut toujours 0, donc aucun nombre ne change.

### Corrigé

- **Les palettes des graphiques suivent le propre sélecteur de thème de DSH**, pas celui du système d'exploitation : DSH
  marque le sombre avec `body[data-ds-dark-theme]` et laisse `<body>` nu en mode clair, si bien que les palettes lisent
  désormais ce marqueur (via `light-dark()` + `color-scheme`) au lieu de `prefers-color-scheme`. Une coque sombre sur un
  desktop clair laissait jadis tous les graphiques clairs — et une coque claire sur un desktop sombre faisait l'inverse.
- **Un modèle, une ligne** : les fournisseurs ne s'accordent pas sur les id de modèles — `commandcode` rapporte
  `deepseek/deepseek-v4.1-flash` là où `opencode-go` rapporte `deepseek-v4.1-flash`, et la vue par modèle listait ce
  modèle deux fois. La clé par modèle est désormais le segment final de l'id ; la vue par fournisseur distingue toujours
  les deux.
- **La carte de chaleur d'activité remplit sa ligne** : les 53 semaines figées ne s'arrêtent plus en plein milieu de la
  carte. Les 53 colonnes partagent désormais la largeur disponible sur une base de 11px (les cellules restent carrées, et
  l'axe des mois et les bandes de jours de la semaine s'étirent avec elles) ; seule une carte trop étroite pour une cellule
  de 11px retombe sur le défilement, et ce défilement s'ouvre sur la semaine la plus récente au lieu des plus anciennes
  (vides sur cette machine). Les coins sont arrondis de 24% de la cellule plutôt que d'un 2px fixe, un changement de
  palette ou de métrique fait un fondu croisé sur 0.18s, survoler éclaircit un jour via `filter: brightness()` (pas de
  décalage de mise en page, pas de reflow), et `prefers-reduced-motion` désactive les transitions.
- **Trois correctifs de lisibilité dans la carte de chaleur** : un jour sans activité conserve un filet d'un pixel à
  l'étape 0 au lieu d'un aplat (une fois le calendrier à travers toute la carte, un mur de gris plein se lit comme des
  données) ; aujourd'hui est marqué par un anneau bicolore en retrait (couleur du panneau à l'extérieur, couleur du
  libellé à l'intérieur) qui reste visible sur l'étape la plus pâle comme sur la plus sombre ; et survoler un jour lève
  désormais l'infobulle propre du tableau de bord — la même boîte que celle du graphique de tendance, bornée au tracé par
  une fraction du centre de colonne, et disposée en quatre lignes : date / Tokens / tours / requêtes, avec le chiffre de
  tokens sous la même forme compacte que celle des cartes de statistiques et de l'infobulle de tendance (`1.45亿` plutôt
  que `145,156,311`, donc aucun compte de tokens ne peut élargir la boîte) — au lieu du `title` natif, retardé et non
  stylable. Tout le calendrier est **centré avec 15px de chaque côté**, et ses 53 colonnes partagent la largeur restante,
  si bien que **plus rien ne défile** — la boîte de défilement a disparu. La barre du bas était tout ce temps la boîte de
  survol : dès qu'un compte de tokens devient long, elle dépasse les 160px de largeur minimale pour laquelle elle était
  bornée, donc aux colonnes bordoises elle dépassait de la boîte de défilement, et un pixel suffisait. La boîte s'éloine
  désormais du bord qu'elle frôle — une colonne dans la moitié de gauche est alignée à gauche et croît vers la droite, une
  colonne dans la moitié de droite est alignée à droite et croît vers la gauche — avec `max-width:calc(50% - 25px)` qui
  garantit que la moitié de l'envergure de colonne peut contenir toute la boîte. Elle ne traverse jamais le calendrier
  quelle que soit sa largeur, et n'a besoin d'aucune mesure de sa propre largeur pour le garantir.
- **Le pied du tableau de bord se lit à raison un fait par ligne.** Trois éléments flex de longueurs très différentes
  s'enroulaient en un paragraphe irrégulier, et la longue note se coupait en plein milieu d'une expression « … » ; chaque
  expression entre guillemets est désormais insécable.

## [0.1.4] - 2026-09-30

### Modifié

- **La carte de la barre latérale obtient désormais sa propre ligne pleine largeur dans le siège de pied.**
  `sidebar.footer.action` est une seule ligne horizontale (`display: flex`) et sur une installation standard
  `dsh-opencode-go-usage`, le badge Cordis et `commandcode-panel` s'y trouvent aussi — et chacun d'eux déclare
  `width: 100%`, si bien qu'aucun ne peut partager la ligne. Mesuré dans une fenêtre 0.2.0-rc.2 en direct, sans rien
  intervenir la carte de ce plugin est comprimée à **105.2px** pendant que son voisin prend 150.8px, et les trois séries
  de libellés se chevauchent. La carte transforme désormais le **siège en colonne**
  (`[class*="_footerActions"]:has(.dtu-footCard)`), si bien que chaque occupant obtient la ligne pleine largeur pour
  laquelle il a été écrit : la carte couvre les **256px** entiers. Le fait de matcher sur le suffixe de classe plus
  `:has()` la rend indépendante des noms de classe hachés de DSH et l'épargne tous les ancêtres — forcer une direction sur
  les conteneurs de ligne de la coque elle-même empilerait la barre latérale au-dessus du panneau principal. C'est
  `flex-direction` plutôt que `flex-wrap` pour deux raisons : la coque enveloppe chaque slot dans un élément
  `display: contents`, donc un sélecteur d'enfant direct ne matche jamais le siège ; et sur un siège **colonne**
  `flex-wrap` signifie « commencer une autre colonne » — mesuré, cela place la carte à côté de son voisin et élargit la
  barre latérale à 387.8px, la faisant déborder. Cela demande `:has()`, c'est pourquoi le tableau de compatibilité
  ci-dessous consigne désormais le Chromium embarqué.
- **Les mêmes fenêtres sont aussi affichées dans le tableau de bord**, dans une ligne `Fenêtres configurées` : libellé,
  total, répartition entrée/sortie, taux de réussite du cache et tours. Ce sont des reculs d'horloge — le Host les
  construit à partir de `{root, useCache, now}` seul — et ils ignorent délibérément le filtre de source, si bien que cette
  ligne le dit plutôt que de se ranger parmi les cartes de statistiques qui suivent le filtre. Avec les deux fenêtres
  désactivées, elle retombe sur une carte cumulée unique.
- **La tendance quotidienne ne met plus deux échelles sur un même tracé.** Le taux de réussite du cache était une ligne
  dessinée par-dessus les barres de tokens avec son propre axe droit 0-100% ; comme il se situe normalement au-dessus de
  90%, la ligne flottait le long du haut du tracé sans lien visible avec les barres en dessous. Le taux de réussite est
  déjà donné par fenêtre dans les cartes de statistiques et la ligne `Fenêtres configurées`, donc cette courbe a disparu :
  le graphique superpose désormais le **total quotidien de tokens** aux barres, partageant l'unique axe de tokens de
  gauche, ses sommets tombant sur le haut de chaque colonne empilée pour que la composition et la tendance se lisent
  ensemble. Les jours sans usage descendent la ligne jusqu'à la ligne de base, ce qui rend plus claire la forme
  vide-puis-pique. L'entrée de taux de réussite de la légende est devenue `Total quotidien`.
- **La courbe coule au lieu de tourner.** Les jours voisins sont reliés par une interpolation **cubique monotone**
  (Fritsch-Carlson), si bien que la tangente est continue à chaque point de donnée. Monotone plutôt qu'un simple spline,
  exprès : un simple spline dépasse entre les points, et juste à côté d'un jour sans usage cela signifie plonger sous
  l'axe.
- **Les écritures sont atomiques, bornées, et désactivables.** Les deux écritures écrivent désormais un frère
  `<name>.<pid>.tmp` et le renomment par-dessus la cible, si bien qu'un lecteur concurrent ne voit jamais un fichier à
  moitié écrit et qu'un processus tué ne peut en laisser un tronqué. L'index de sessions est plafonné à 800 entrées (les
  plus anciennes abandonnées, rescannées à la demande) et tout `.tmp` laissé par un crash est balayé à l'écriture
  suivante. Les diagnostics du Host (`calls.json`, `boot.json`) peuvent être entièrement désactivés avec
  `DSH_TOKEN_USAGE_DIAG=0`. Tout est écrit dans `$DSH_HOME/cache/dsh-desktop-token-usage/` ; le README documente désormais
  chaque fichier, à quoi il sert, et comment le désactiver.
- **La compatibilité est déclarée pour DSH Desktop 0.2.0-rc.1.** Ce plugin ne déclare toujours aucune peer dependency
  `@deepseek-ai/dsh*`, c'est ce que DSH valide réellement ; `engines.dsh` est élargi à `^0.1.7-rc.2 || ^0.2.0-rc.1` pour
  les lecteurs seulement. Chaque paquet publié auquel ce plugin touche a été comparé entre les deux releases :
  `dsh-plugin-manager` est identique au caractère près, et `dsh-client-ui-sidebar`, `dsh-client-ui-layout` et
  `dsh-client-ui-cordis` ne diffèrent que par la chaîne de version, un appel d'analyse et le CSS de la barre de titre. Le
  contrat de slot est inchangé.

### Note

- Après la release, un essai manuel sur DSH Desktop `0.2.0-rc.2` a été mené avec le plugin `0.1.3` : le tableau de bord et
  les appels Remote fonctionnent.
- L'entrée a brièvement déménagé vers `sidebar.panellist`, qui donne une ligne pleine largeur dont la barre latérale est
  propriétaire — mais ce siège ne rend qu'une icône et un libellé, donc les chiffres d'usage que la carte existe pour
  montrer n'auraient eu nulle part où aller. Elle est revenue.

## [0.1.3] - 2026-09-28

### Modifié

- **La CI publie désormais via Trusted Publishing (OIDC) ; le dépôt ne stocke plus de token npm.** Le workflow abandonne
  `NODE_AUTH_TOKEN`, ajoute `id-token: write`, et met à jour npm sur le runner (Node 22 embarque un npm plus ancien que la
  11.5.1 qu'exige la publication de confiance). Les attestations de provenance sont générées automatiquement, et le secret
  de dépôt `NPM_TOKEN` n'est plus référencé.

## [0.1.2] - 2026-09-28

### Modifié

- **Le nom de paquet a perdu son scope** : `@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`. Les
  versions 0.1.0 et 0.1.1 étaient des paquets scopés ; le nom scopé est déprécié et pointe désormais ici. Un nom sans
  scope n'a pas besoin de scope npm correspondant, donc la commande d'installation est plus courte et la publication ne
  dépend plus d'en posséder un. Mis à jour de concert : le `REMOTE_PACKAGE` du Host, le `id` du module Client, et le
  `name` de la ligne dans `cordis.patch.yml`. Le `id` de la ligne et la clé de slot `PANEL_ID` étaient déjà la chaîne sans
  scope, donc aucune configuration de profile n'a dû être migrée cette fois.

### Note

- Le nom du dépôt GitHub était déjà `dsh-desktop-token-usage`, donc ni l'URL du dépôt ni les tags de release n'ont eu
  besoin de changer.

## [0.1.1] - 2026-09-28

### Corrigé

- **La page npm rendait par défaut le README chinois.** npm 11 choisit le readme dans
  `@npmcli/package-json/lib/normalize.js` en globbant `{README,README.*}` et en prenant la première correspondance qui
  ressemble à du markdown ; sur cette machine ce glob a renvoyé `README.zh.md`, si bien que le champ `readme` du packument
  contenait le document chinois. Les docs chinois s'appellent désormais `README-zh.md` et `CHANGELOG-zh.md` (un trait
  d'union ne fait pas partie de ce glob, donc seul `README.md` peut être sélectionné).

### Modifié

- Les liens du sélecteur de langue en haut des deux documents sont des URL GitHub absolues : un lien relatif ne peut pas
  être ouvert depuis la page npm du paquet, car npm ne sert pas les fichiers du dépôt comme pages. Les URL absolues
  fonctionnent sur GitHub comme sur npm.

### Ajouté

- Un workflow de publication GitHub Actions (`.github/workflows/publish.yml`) : pousser un tag `v*` publie sur npm, une
  exécution manuelle fait une simulation (dry run) par défaut, et une poussée de tag est vérifiée contre le `version` de
  `package.json`. L'authentification utilise le secret de dépôt `NPM_TOKEN` (un jeton d'accès granulaire avec bypass 2FA
  activé).

## [0.1.0] - 2026-09-27

Première release : statistiques d'utilisation de tokens entièrement hors ligne, avec toutes les données prises dans les
journaux de sessions sous le `$DSH_HOME/sessions` local.

### Ajouté

**Statistiques et couche de données**

- Lit `session.vN.jsonl.zstd` : ces fichiers sont des conteneurs dans lesquels **plusieurs trames zstd sont concaténées
  bout à bout**. L'API de décompression de Node ne décode que la première trame, donc le code localise les frontières de
  trames par un scan structurel (sans décompresser) en suivant l'officiel `scanZstdFrames`, puis décompresses trame par
  trame et analyse ligne par ligne.
- Sémantique de **pliage** `(turn, step)` : dans un même slot un enregistrement d'usage ultérieur remplace le précédent,
  et l'accumulation ne commence qu'après `llm/retry-started` ; `reasoningTokens` est traité comme un sous-ensemble de
  `outputTokens` et n'est jamais compté deux fois.
- L'index est compartimenté par **heure locale** et mis en cache de façon incrémentale par `mtime+size` de fichier,
  persisté dans `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`.
- Inférence de l'origine de la session : `Desktop · Web` / `CLI · Bots` / `Sous-agents` — les journaux ne contiennent
  aucun champ d'origine client, donc l'origine ne peut être dérivée que de `origin`, `delegationDepth` et du `source.rpcId`
  du tour utilisateur.

**Interfaces**

- Expose trois Remotes sur le canal officiel Typert : `dshUsage/summary` (résumé d'usage), `dshUsage/config` (lit la
  fenêtre de la carte, `writable` compris), et `dshUsage/setConfig` (réécrit dans le patch du profile via l'officiel
  `configEditor`).

**Interface utilisateur**

- Carte de pied de la barre latérale (`sidebar.footer.action`) : affiche la fenêtre « dernières N heures » / « derniers N
  jours » ou la valeur cumulée selon la configuration ; chaque fenêtre affiche le **volume d'entrée** (entrée non mise en
  cache + lectures de cache), le **volume de sortie**, et le **taux de réussite du cache**.
- Tableau de bord central (le panneau `main`) : filtres de plage temporelle et d'origine, 6 cartes de statistiques, une
  carte de chaleur d'activité, une tendance quotidienne des tokens (empilée par modèle plus une ligne de taux de réussite
  du cache), un graphique en anneau de l'usage par modèle, et une liste de parts.
- **Calendrier** d'activité : aligné sur lundi sur les 53 dernières semaines, avec en-têtes de mois et coordonnées de jours
  de la semaine, cellules fixes à 11px ; un contrôle en haut bascule entre **Tokens / tours**, en choisissant par défaut
  la dimension qui a le plus de jours de données.
- Formulaire de configuration de la page du plugin (`plugins.bundle.config`) : `hours` (0-23) et `days` (1-30), où `0`
  désactive cette fenêtre.
- Toute l'interface ne dépend que de React et des jetons de thème `--dsw-alias-*`, et ne référence aucun paquet client
  `@deepseek-ai`.

**Diagnostics**

- `boot.json` : la chaîne d'activation du Host (apply / injection typert / fourniture de service / enregistrement du
  descripteur) et la configuration de fenêtre effective.
- `calls.json` : les 20 dernières invocations du tableau de bord (filtres, fenêtres, nombre de sessions, total de tokens,
  temps écoulé).

### Corrigé

- **Les valeurs de retour des Remote étaient traitées comme des charges utiles** : la vraie forme est
  `{ ok, value }` / `{ ok: false, error }`, où l'échec est une valeur plutôt qu'une exception. Le code d'origine laissait
  `data.totals` à `undefined`, ce qui faisait que tout le tableau de bord lançait une erreur et s'affichait à vide tandis
  que la carte de la barre latérale n'affichait que `0`.
- **Effondrement de la hauteur du tableau de bord** : `.dtu-body` utilisait `flex:1 + min-height:0`, ce qui était coupé
  chaque fois que la hauteur du conteneur parent était indéterminée et s'effondrait à une hauteur de 0 ; retour à
  `display:block + height:100% + overflow:auto`, avec un en-tête rendu collant.
- **Cellules de la carte de chaleur étirées** : `grid-auto-columns` élargit les pistes pour remplir la largeur du
  conteneur, étirant les carrés de 11px en de larges barres ; passage à une mise en page flex.
- **Échelle de couleurs de la carte de chaleur défaillante** : elle compartimentait auparavant par « jour ÷ maximum », si
  bien qu'un seul jour exceptionnellement grand poussait tout le reste dans le même compartiment ; passage aux quartiles
  sur les jours non nuls.
- **Ajout d'une frontière d'erreur de rendu** : toute exception de rendu à l'intérieur d'un slot affiche désormais une
  explication textuelle au lieu d'un bloc vide.
- **Les tests écrasaient les fichiers de diagnostic de production** : le `apply` de `npm test` écrivait les vrais
  `boot.json` / `calls.json`, alors que le README enseigne précisément à lire ces deux fichiers pour savoir « quelle
  génération de Host tourne actuellement ». Le répertoire de diagnostics peut désormais être redirigé par la variable
  d'environnement `DSH_TOKEN_USAGE_DIAG_DIR`, et la suite de tests pointe automatiquement vers un répertoire temporaire,
  si bien qu'elle ne pollue plus les fichiers de production.
- **Tests en concurrence avec l'écrivain des journaux de sessions** : des assertions comme « les plages par jour
  partitionnent le total » échouaient par intermittence chaque fois qu'une session en cours ajoutait un enregistrement
  (écart observé : 157,951 tokens, avec la somme par jour qui ressortait *plus grande* que le total de l'instantané). Ces
  fenêtres partagent désormais une borne supérieure épinglée au **début de l'heure courante** — le filtrage par heure se
  fait par compartiment, donc épingler « maintenant » n'aurait pas aidé : les enregistrements écrits plus tard dans le
  compartiment de l'heure courante comptent toujours. La carte de chaleur ignore délibérément la plage temporelle, elle
  compare donc désormais la grille de dates stable, avec une seule relecture lors de la sommation à travers les
  instantanés.

### Modifié

- Les compartiments d'index sont passés des jours aux **heures locales** (`CACHE_VERSION` 1 → 2, ce qui reconstruit
  l'index une fois au premier démarrage), rendant possibles des fenêtres comme « les dernières heures » ; le graphique
  quotidien du tableau de bord est fusionné depuis les compartiments horaires par le Host.
- Les données de la carte de chaleur sont indépendantes de la plage temporelle (la réponse `summary` a gagné un champ
  `heatmap`, qui suit toujours le filtre d'origine) : un calendrier filtré à 7 jours signifierait « 7 cellules allumées
  dans une grille d'un an », ce qui n'est pas ce qu'une carte de chaleur devrait signifier.
- Les valeurs de configuration sont persistées dans le `cordis.patch.yml` du profile via l'officiel `configEditor`, pas
  dans les fichiers du plugin.
- Introduction de la seule dépendance `@deepseek-ai/*` : `@deepseek-ai/schemastery` (requis par la carte `Config`
  officielle).

### Préparation de la release (npm)

- **Nom de paquet, row id et nom de dépôt unifiés en `@jd04063221/dsh-desktop-token-usage`** (le scope a été retiré en
  0.1.2) : ce plugin ne vise que **DSH Desktop** (ses données viennent des `$DSH_HOME/sessions` de Desktop), donc le nom
  porte `desktop` pour le distinguer de toute autre surface. Mis à jour ensemble : le nom de paquet, le `REMOTE_PACKAGE`
  du Host, le `id` du module Client (la convention officielle veut que le `id` d'un module soit son nom de paquet — voir
  `dsh-api-remotes/lib/client.js`), le `name` de la ligne **et** le `id` de la ligne dans `cordis.patch.yml`, la clé de
  slot de la carte de configuration (`plugins.bundle.config` est indexé par le **nom du paquet**), le répertoire de
  diagnostics et de cache d'index, et l'URL du dépôt GitHub.
- **En omettre ne serait-ce qu'un échoue silencieusement** : le `id` du module et la clé de la carte de config doivent
  être égaux au nom du paquet, et le `name` de la ligne doit être exactement le nom de paquet installé dans le profile. Le
  `id` de la ligne est aussi l'ancre de la surcharge de configuration `- id: …` d'un profile — le changer signifie migrer
  cette surcharge, sinon les `hours`/`days` enregistrés cessent de s'appliquer (migré ici). En reconnaissant sa propre
  entrée de Loader, le Host matche à la fois le **nom de paquet** et le **row id**, si bien qu'une ligne héritière peut
  toujours lire et écrire la configuration (couvert par un test).
- Suppression de `private: true` et ajout de `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public` (les paquets scopés sont restreints par défaut) / `engines.dsh` (déclaratif ; DSH ne
  l'applique pas) / `prepublishOnly: npm test`, plus un nouveau `LICENSE` MIT.
- ⚠️ **`jd04063221` dans `name` / `author` / les URLs du dépôt est un nom d'utilisateur provisoire** : il doit être
  remplacé par votre propre scope npm et votre nom d'utilisateur GitHub avant de publier.

### Compatibilité et replis

- **Un Client plus récent que le Host** est l'état normal (le premier se recharge à chaud, le second exige un
  redémarrage), donc chaque champ manquant a un repli : quand `card` est absent, le bloc cumulé est calculé à la volée
  depuis `totals` ; quand `heatmap` est absent, le calendrier est rempli à partir des `days` de la plage de filtre
  courante, et l'intitulé de l'en-tête change en conséquence.
- Quand le profile ne fournit pas `configEditor`, le formulaire de configuration devient **en lecture seule** avec une
  explication de la raison, et l'interface d'écriture rapporte une erreur explicite.

### Documentation

- `README.md` (anglais, la valeur par défaut) / `README-zh.md` (chinois) : installation, utilisation, options de
  configuration, le tableau de comptabilité des tokens, les limites de l'inférence d'origine, les limitations connues, et
  un ordre de dépannage, avec les deux sélecteurs du haut des fichiers se reliant l'un à l'autre.
- `docs/DESIGN.md` : le contrat de données, les arbitrages clés, et les pièges rencontrés (zstd multi-trames, l'enveloppe,
  la mise en cache des générations de modules, le mécanisme de la page de configuration, et ainsi de suite).
- `docs/research/` : notes de recherche précoces et scripts de sonde de journaux de sessions réutilisables.
- `docs/` n'est pas publié : la liste blanche `files` porte désormais une entrée explicite `!docs` (le `files` de npm
  supporte bien la négation, tandis qu'un `.npmignore` à la racine ne peut pas annuler `files`, donc la négation est la
  forme qui fonctionne).
- Notes de recherche caviardées : les chemins de machine comme `C:\Users\<user>` sont écrits `%USERPROFILE%` / `$DSH_HOME`,
  les enregistrements réels citent le répertoire utilisateur sous `<user>`, et la convention est énoncée en haut du
  document.

### Limitations connues

- Le desktop et le web **ne peuvent pas être distingués** dans les données locales et sont fusionnés en « Desktop · Web ».
- La granularité des fenêtres est arrondie à l'heure (les journaux ne contiennent pas de marqueurs au niveau de la
  minute).
- La carte n'a pas de canal de poussée et repose sur un rafraîchissement silencieux toutes les 5 minutes ; pour voir un
  changement de configuration immédiatement, ouvrez le tableau de bord et cliquez sur « Actualiser ».
- Les sessions historiques importées (comme la migration reasonix) ont toutes un usage de 0 ; ce sont des données valides
  et elles ne sont pas estimées.

### Compatibilité

- **Environnement testé : DSH Desktop `0.1.7-rc.2`** (`@deepseek-ai/dsh-desktop@0.1.7-rc.2`), Windows 11 Pro build 26200
  (AMD64), Node v25.2.1. Activation du plugin, carte de la barre latérale, tableau de bord, carte de configuration de la
  page du plugin, RPC navigateur → Host, et un rapprochement champ par champ des nombres avec la propre cache de
  projection de DSH ont tous passé la vérification — l'usage normal sur 0.1.7-rc.2 est garanti.
- `engines.dsh` est déclaré comme `^0.1.7-rc.2` (auparavant `>=0.1.7-rc.2`, ce qui revenait à affirmer la compatibilité
  avec 0.2/1.0 aussi, sans preuve). Le champ est **déclaratif** : la documentation officielle dit clairement que déclarer
  une plage ne rejette pas les hôtes incompatibles.
- Les releases DSH plus anciennes peuvent ne pas avoir le slot `plugins.bundle.config` et le service `configEditor` que ce
  plugin utilise ; les versions plus récentes n'ont pas été testées.
- La conclusion mesurée est aussi écrite dans deux textes affichés : la `description` de `package.json` et le
  `meta.description` de la locale. La raison : l'interface de liste des plugins (`listBundles`) passe l'**URL de fichier**
  de `package.json` à `readPluginMeta`, et la documentation officielle dit « File paths and file URLs return no
  metadata », donc seule la description de `package.json` prend effet sur ce chemin (mesuré : chaque bundle de la liste
  n'a qu'une `description` et pas de `meta`) ; l'entrée de locale est utilisée par les chemins d'interface qui peuvent
  résoudre les métadonnées par nom de paquet.

### Vérification

- Le résultat du pliage correspond à la propre cache de projection de DSH champ par champ (`session-5964a5d3-*` :
  `286650 / 182633 / 43826560 / 0`).
- Le résumé est auto-cohérent : les dimensions jour/modèle se recréent à partir du total ; les intervalles de millisecondes
  quotidiens et horaires partitionnent exactement le total ; le calendrier partitionne exactement par origine ; chaque
  résumé de fenêtre est ≤ la valeur cumulée ; `hours=99` / `days=-3` sont bornés.
- Les descripteurs filaires des deux côtés correspondent champ par champ (trois points d'entrée), et le codec de
  paramètres accepte les valeurs que le navigateur envoie réellement.
- Le rendu passe avec un React/DOM simulé dans un environnement sans navigateur (couvrant les deux formes de carte, le
  formulaire de configuration, la structure du calendrier, et les deux replis).
- Après installation, `fiberPhase: active`, et `sidebar.footer.action` et `main` sont tous deux enregistrés.
- 23 tests au total, avec `npm test` entièrement vert. **L'apparence visuelle et les chiffres finaux exigent une
  confirmation manuelle** (cet environnement ne contrôle pas de navigateur).

---

## Annexe : index des commits

La release 0.1.0 se compose des commits suivants (`git log --reverse`, jusqu'à `2b4be69`) :

| Commit | Heure | Contenu |
|---|---|---|
| `9b46227` | 15:01 | Agrégation de tokens côté Host sur les journaux de sessions locaux et interfaces Remote d'usage |
| `3b63332` | 15:02 | Carte d'usage de la barre latérale et tableau de bord central des tokens |
| `5407357` | 15:02 | Rapprochement de référence de l'agrégation et tests de fumée client sans navigateur |
| `6d6408e` | 15:02 | README, notes de conception, et notes de recherche précoces |
| `7d66caa` | 15:58 | Correction de l'enveloppe `{ok,value}` et de l'effondrement de la hauteur du panneau |
| `61f272d` | 16:04 | Traçage de la chaîne d'activation du Host et documentation de dépannage |
| `5ad18db` | 16:48 | Fenêtre de la carte de configuration Config officielle, index affiné aux heures |
| `dda8906` | 16:49 | Correction des notes sur la prise d'effet de la configuration (les changements de config passent par `fiber.restart`) |
| `3a593c5` | 16:58 | Le Client retombe sur la valeur cumulée quand le Host manque de `card` |
| `2ae0a20` | 19:00 | Formulaire de configuration intégré à la page du plugin (hours/days) |
| `e104dc2` | 19:31 | Carte de chaleur d'activité refaite (sémantique de calendrier, axes, échelle de couleurs par quantiles, bascule de métrique) |
| `2b4be69` | 09:20 | Nom de paquet changé pour un nom scopé et métadonnées de publication npm complétées (préparation de la release) |
