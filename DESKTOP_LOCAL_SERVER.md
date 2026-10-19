# Studio Nova Desktop : le serveur complet, en local

## L'idée

Pas de serveur cloud : chaque installation desktop embarque **son propre
backend Django**, avec **sa propre base de données** dans le dossier de
l'utilisateur. Rien ne sort de la machine.

```
┌─ Studio Nova (Electron) ─────────────────────────────┐
│  Fenêtre (frontend React, servi en local)            │
│        │  /api  /media  /ws                          │
│  Petit proxy local (desktop/main.cjs)                │
│        ├──► Serveur embarqué (sidecar PyInstaller)   │
│        │    Django + SQLite + médias                 │
│        │    données : <userData>/backend-data/       │
│        │    studio-nova.sqlite3, media/, secret…     │
│        └──► Assistant IA (serveur MCP Node, déjà là) │
└──────────────────────────────────────────────────────┘
```

## Ce qui est livré (phase 1)

- `backend/doory/settings/desktop.py` — réglages dédiés : SQLite et médias
  dans le dossier utilisateur, boucle locale uniquement (127.0.0.1),
  temps réel en mémoire (aucun Redis), e-mail désactivé, PDF serveur
  désactivé (pas de Chromium embarqué pour l'instant).
- `desktop/backend/run_server.py` — le lanceur : génère le secret Django
  de l'installation, migre la base, installe les catalogues locaux
  (éléments, templates, audio) au premier démarrage, télécharge polices
  et modèle en arrière-plan, puis sert l'API + WebSocket (uvicorn).
- `desktop/backend/studio-nova-backend.spec` + `build-sidecar.mjs` —
  packaging PyInstaller (`npm run build:backend`, sur l'OS cible).
- `desktop/main.cjs` — démarre le sidecar, attend son `/api/v1/health/`,
  et route `/api`, `/media`, `/ws` vers lui. Un `apiOrigin` cloud dans
  `desktop-config.json` reste prioritaire pour ceux qui le veulent.
- Le workflow GitHub **desktop packages** construit le sidecar sur chaque
  OS avant l'installeur.

## Ce qui marche alors dans l'app installée

Comptes **locaux**, designs cloud→locaux (dashboard, dossiers, corbeille),
templates et éléments fournis, uploads, kit de marque, historique,
collaboration entre fenêtres de la même machine, Remove Background,
exports. Les designs restent sur la machine : pas de synchronisation
entre ordinateurs, et les liens de partage ne sont pas publics.

Restent dépendants d'Internet/clés, comme avant : photos stock
(Unsplash/Pexels), connexion Google, assistant IA (clé fournisseur dans
la config MCP de l'utilisateur).

## Limites connues / phases suivantes

1. **Premier démarrage ~30 s** (migrations + catalogues) ; le splash
   couvre désormais cette préparation : sa ligne de statut suit
   `startup-status.json` écrit par le sidecar (workspace, assets,
   templates…) et une rotation d'astuces fait office d'introduction. La
   fenêtre s'ouvre dès que `health` répond (plafond 45 s) ; au-delà elle
   s'ouvre quand même sur le studio local, avec une carte « préparation »
   qui compte les secondes et relance la connexion automatiquement.
2. **PDF serveur off** : l'export PDF navigateur continue de marcher.
   Embarquer Chromium = phase 2.
3. **Taille** : le sidecar ajoute quelques dizaines de Mo à l'installeur.
4. **Validation du binaire** : `npm run smoke:backend` démarre le binaire
   PyInstaller sur un dossier vierge et exige `health` + `config` + base
   créée ; la CI le lance sur chaque OS avant de packager l'installeur,
   donc un sidecar qui ne démarre pas casse le build, pas l'utilisateur.
   (Le code serveur est en plus testé directement sous Python.)
5. **Comptes locaux** : l'inscription sert surtout à séparer les profils
   sur une machine partagée ; un mode « utilisateur unique » automatique
   est une phase 2 possible.

## Corriger les limites restantes (recettes)

- **Synchro entre ordinateurs** : trois niveaux, du plus simple au plus
  complet — (a) export/import d'un design en `.zip` (à construire,
  aucune infra) ; (b) pointer `apiOrigin` vers son propre serveur
  Studio Nova auto-hébergé (déjà supporté par `desktop-config.json`) ;
  (c) moteur de synchro opt-in vers ce même serveur. Ne jamais mettre le
  fichier SQLite dans un dossier Google Drive/Dropbox synchronisé :
  corruption quasi garantie, la synchro doit passer par (a) ou (c).
- **Liens de partage publics** : par nature impossibles en 100 % local.
  Alternatives : partager le **fichier** exporté (design + médias),
  partage **réseau local** (lien temporaire sur le Wi-Fi, même machine
  émettrice allumée), ou publication via le serveur opt-in de (b).
- **PDF serveur (vectoriel haute fidélité)** : l'export PDF navigateur
  (300 dpi, fond perdu, traits de coupe) fonctionne déjà. Pour le PDF
  serveur, embarquer le Chromium de Playwright dans le sidecar
  (+~150 Mo, `EXPORT_CHROMIUM_PATH` + `SERVER_PDF_ENABLED=true`), ou
  passer par `printToPDF` d'Electron (le Chromium de l'app, rien à
  embarquer — piste à privilégier).
- **Photos stock / Google sans clé perso** : ajouter un fournisseur
  sans clé (Openverse) derrière l'interface `providers.py` existante,
  en gardant la liste blanche d'hôtes pour la sécurité ; la connexion
  Google n'a pas de sens en local (comptes locaux à la place).

## Données et désinstallation

Tout vit dans le dossier de données de l'app
(`<userData>/backend-data/`) : supprimer ce dossier = repartir de zéro.
Les mises à jour de l'app migrent la base sur place.

## L'expérience d'installation et de lancement

- **Écran de démarrage Studio Nova** (`desktop/main.cjs`) : au lancement,
  une fenêtre de marque (ciel de nuit, étoile, barre de progression, statut
  en direct) s'affiche pendant que le serveur local démarre — fini l'écran
  vide des premiers démarrages. Elle se ferme dès que le studio est prêt.
- **Le studio local ouvre toujours** : la fenêtre n'attend plus la fin des
  migrations du moteur embarqué (jusqu'à ~30 s au premier lancement). Si le
  serveur local ou Internet manque, l'app s'ouvre sur `/studio` — les
  designs de l'appareil, les templates fournis et l'éditeur fonctionnent
  hors ligne. Les pages de compte ne sont plus un cul-de-sac : la garde
  d'authentification redirige vers `/studio`, et l'app réessaie la session
  toute seule pendant que le moteur finit de démarrer.
- **Icône sur le bureau : au choix de l'utilisateur** (Windows,
  `desktop/installer.nsh`) : l'installeur pose la question sur une page
  dédiée, après le choix du dossier d'installation. Case cochée par
  défaut ; les installations silencieuses gardent l'ancien comportement.
  Le script suit les points d'accroche officiels d'electron-builder
  (`customPageAfterChangeDir`, `customInstall`) : la première CI Windows
  confirmera sa compilation NSIS, comme pour le binaire du serveur local.
