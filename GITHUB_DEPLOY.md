# Publier Studio Nova sur GitHub

## 1. Créer le dépôt

1. Crée un dépôt GitHub vide, par exemple `studio-nova`.
2. Télécharge et décompresse `Studio-Nova-GitHub.zip`.
3. Dans un terminal, ouvre le dossier décompressé et exécute :

   ```sh
   git init -b main
   git add .
   git commit -m "Initial Studio Nova source"
   git remote add origin https://github.com/TON-COMPTE/studio-nova.git
   git push -u origin main
   ```

Ne pousse pas les fichiers `.env` contenant des secrets. Les exemples `.env.example` sont prévus pour être partagés.

## 2. Construire les installateurs et le site de téléchargement

Dans le dépôt GitHub, ouvre **Actions → Studio Nova desktop packages → Run workflow**. Le workflow construit les installateurs Windows, macOS et Linux sur leurs runners natifs, puis publie un artefact Actions nommé `studio-nova-site` contenant le site statique et les installateurs dans `downloads/`.

Télécharge cet artefact et déploie son contenu à la racine de ton hébergement web. La page d’accueil contient le bouton **Install Studio Nova for desktop** et `/download` affiche les installateurs disponibles.

Le workflow prépare un artefact de site ; il ne le publie pas automatiquement sur GitHub Pages ni sur un autre hébergeur. Pour un déploiement public, configure ton hébergement statique ou demande l’ajout d’un déploiement GitHub Pages adapté à l’URL de ton dépôt.

## 3. Configurer les services

L’éditeur invité fonctionne localement. Les comptes, le stockage cloud et certaines fonctionnalités demandent le backend Django; le chat IA nécessite une clé fournisseur dans l’environnement serveur. Ne place jamais une clé API dans le frontend ni dans GitHub.

## 4. Licence

Conserve `LICENSE`, `NOTICE` et l’attribution visible qu’ils exigent. La page de téléchargement ne remplace pas cette attribution.
