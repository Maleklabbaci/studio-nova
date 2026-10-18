# Déployer la landing page sur Cloudflare Pages

## Le bug du 404

Le site est une application React située dans `frontend/` : **il n'y a aucun
`index.html` à la racine du dépôt**. Si Cloudflare Pages construit/déploie la
racine du dépôt, il publie un dossier vide et répond **HTTP 404** sur
`https://studio-nova-b6e.pages.dev/`.

## Réglage correct (dashboard Cloudflare)

Dans **Cloudflare → Workers & Pages → studio-nova-b6e → Settings → Builds** :

| Réglage | Valeur |
| --- | --- |
| Production branch | `main` |
| Root directory | *(racine du dépôt, laisser vide)* |
| Build command | `npm --prefix frontend ci && npm --prefix frontend run build` |
| Build output directory | `frontend/dist` |
| Variable d'environnement | `NODE_VERSION` = `22` |

⚠️ Ne pas mettre `frontend` en Root directory **en plus** de la commande
ci-dessus (le préfixe `frontend` serait appliqué deux fois). Et ne jamais
ajouter de section `[build]` dans `wrangler.toml` : Cloudflare Pages la
refuse (« Configuration file for Pages projects does not support "build" »),
seul le champ `pages_build_output_dir` y a sa place.

Enregistrer, puis **Deployments → Retry deployment** (ou pousser un commit
sur `main`). Le fichier `wrangler.toml` à la racine du dépôt décrit la même
configuration ; `frontend/public/_redirects` assure le routage SPA
(`/download`, `/features`, … servis par `index.html`).

Alternative sans dashboard : le workflow GitHub Actions
**Deploy site to Cloudflare Pages** (onglet Actions, lancement manuel)
construit et envoie le site via Wrangler. Il faut d'abord ajouter les
secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.

## Le bouton « Download Windows »

La page `/download` lit `/downloads/manifest.json`. Les installeurs
(~100 Mo) dépassent la limite de **25 Mo par fichier** de Cloudflare
Pages : ils sont donc hébergés sur **GitHub Releases**, et le manifest
pointe vers
`https://github.com/Maleklabbaci/studio-nova/releases/latest/download/StudioNova-win-x64.exe`.

Pour publier (ou mettre à jour) les installeurs :

```sh
git tag v0.1.0
git push origin v0.1.0
```

Le workflow **Studio Nova desktop packages** construit les installeurs
Windows/macOS/Linux et les attache automatiquement à la release GitHub
correspondante. Les boutons de téléchargement fonctionnent dès que la
release existe. Pour une nouvelle version, créer un tag `vX.Y.Z` et
mettre à jour `version` dans `frontend/public/downloads/manifest.json`.

## Générer les 310 modèles (un clic)

La galerie du site n'affiche que les modèles dont les fichiers générés
existent dans `backend/data/templates/`. Les 310 designs sont codés
(`frontend/scripts/templates/designs/`), mais leurs documents et vignettes
se fabriquent avec un vrai navigateur : **Actions GitHub → « Generate
the 310 templates » → Run workflow**. Le robot génère tout, met à jour les
tests, et pousse les fichiers dans le dépôt ; Cloudflare redéploie alors
le site avec le catalogue complet (et le backend de l'app PC lira les
mêmes fichiers à la prochaine installation). En local, l'équivalent est :

```sh
cd frontend
npx playwright install chromium
npm run templates:build
npx vitest run scripts/templates/starter.test.ts -u
```
