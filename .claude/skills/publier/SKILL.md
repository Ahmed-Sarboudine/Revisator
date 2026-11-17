---
name: publier
description: Publie les changements de Revisator sur GitHub (commit + push), ce qui redéploie GitHub Pages. À utiliser quand l'utilisateur dit « publie », « mets en ligne », « push ».
---

# Publier sur GitHub Pages

## 0. Mettre à jour les nouveautés

L'accueil affiche l'encadré « Nouveautés » à partir de `contenu/nouveautes.json`. Avant chaque publication qui apporte quelque chose de visible pour l'utilisateur (nouveau cours, QCM, fiche, corrigé, fonctionnalité, correction notable) :

- si la version du jour existe déjà en tête de `versions`, y ajouter les nouveaux points ;
- sinon, ajouter **en tête** une version `{ "date": "AAAA-MM-JJ", "titre": "…", "ajouts": [ … ] }` (date du jour, titre court qui résume la version).

Chaque ajout est une phrase courte, du point de vue de l'utilisateur (« Réseaux : 2ᵉ QCM de révision, 36 questions »), sous forme de texte ou de `{ "texte": "…", "lien": "#/m/<matiere>" }` pour mener à la matière concernée. Ne pas y mettre les changements purement techniques. Une nouvelle date fait réapparaître le badge « Nouveau » chez l'utilisateur.

## 1. Valider d'abord

```bash
node scripts/build-index.js
```

Si le script échoue, ne rien publier : la GitHub Action échouerait aussi. Corriger ou montrer les erreurs.

## 2. Première publication (si le dossier n'est pas encore un dépôt git ou n'a pas de `origin`)

Demander l'URL du dépôt GitHub (vide) à l'utilisateur, puis :

```bash
git init
git branch -M main
git remote add origin <url>
```

Rappeler qu'il faut, une seule fois, régler **Settings → Pages → Source : GitHub Actions** sur GitHub.

## 3. Commit et push

- `git status` pour voir les changements ; ne pas ajouter de fichiers sans rapport (PDF oubliés à la racine, fichiers temporaires). `contenu/index.json` est ignoré, c'est normal.
- Message de commit en français, qui décrit le contenu : « Ajout QCM Réseaux cours 02 : couche physique », « Correction question intro-012 ».
- `git push` (avec `-u origin main` la première fois).

## 4. Suivi

Le déploiement prend 1 à 2 minutes. Si `gh` est disponible, `gh run watch` ou `gh run list --limit 1` pour vérifier qu'il a réussi. Donner l'adresse du site : `https://<utilisateur>.github.io/<depot>/`.
