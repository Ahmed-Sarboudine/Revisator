---
name: generer-qcm
description: Génère le qcm.json d'un cours ou d'un TD à partir de son PDF et le range dans contenu/. À utiliser quand l'utilisateur ajoute un PDF de cours/TD et demande « fais le QCM », « génère les questions », « ajoute ce cours ».
---

# Générer un QCM à partir d'un PDF

Le format de `qcm.json` est défini dans [README.md](../../../README.md), section « Format du fichier qcm.json ». Le relire avant d'écrire.

## 1. Rassembler les infos

Il faut :
- le **PDF** (souvent déposé à la racine du projet) ;
- la **matière** : reprendre un dossier existant de `contenu/` si elle existe déjà (lire son `matiere.json`), sinon en créer un (`contenu/<slug>/matiere.json` avec `{ "nom": "..." }`) ;
- le **type** : `cours` ou `td` (souvent dans le nom du fichier) ;
- pour un TD, le **cours rattaché** s'il y en a un évident (même thème), sinon pas de champ `cours`.

Ne demander à l'utilisateur que ce qui ne se déduit pas du nom du fichier, du contenu du PDF ou des dossiers existants.

## 2. Ranger le PDF

```
contenu/<matiere>/<type><NN>-<slug-du-titre>/document.pdf
```

`NN` = numéro suivant pour ce type dans la matière (`cours01`, `cours02`, `td01`…), ou le numéro qui figure dans le nom du fichier. Déplacer le PDF (pas de copie) et le signaler à l'utilisateur.

## 3. Lire le PDF

```bash
python -P .claude/skills/generer-qcm/extraire_pdf.py <document.pdf> <scratchpad>/<dossier> [--rendre 30,35-37]
```

- Lire `texte.txt` en entier.
- Le script liste les pages avec peu de texte : ce sont des schémas, tableaux ou exercices en image. Les rendre avec `--rendre`, ainsi que les pages dont le texte annonce une figure (se termine par « : », « Exercice », « Exemple »…), puis lire les PNG.
- Dépendances : `pypdf` et `pypdfium2` (`python -m pip install --user pypdf pypdfium2` si manquants).

## 4. Écrire `qcm.json`

Règles :
- **Couvrir tout le document**, dans l'ordre du cours : environ une question pour 2 pages de contenu, entre 15 et 40 questions.
- Environ **un tiers de `"multiple"`**, dont une ou deux qui n'ont qu'une seule bonne réponse (pour que « Plusieurs réponses » ne soit pas un indice).
- **Exercices** : quand le document contient un exercice ou un exemple chiffré, créer des questions avec le champ `exercice` (les données) et l'`enonce` (ce qu'on demande). Pour un TD, c'est l'essentiel des questions.
- **Mauvaises réponses plausibles** : confusions entre notions proches du cours (hub/switch, segment/datagramme, LAN/MAN…), pas de réponses absurdes.
- **Explication** : justifier la bonne réponse avec le cours, et dire pourquoi le piège principal est faux.
- **`page`** : numéro de page du PDF (index du fichier, à partir de 1), pas un numéro imprimé s'il diffère.
- **Rester fidèle au cours** : ne pas faire de question sur une affirmation du cours qui est fausse ou discutable ; la signaler à l'utilisateur à la place.
- `id` : préfixe court du document + numéro sur 3 chiffres (`intro-001`, `td2-014`). Ne jamais renuméroter les `id` d'un QCM existant (ils servent à mémoriser les erreurs).
- Markdown autorisé ; code entre backticks ; LaTeX entre `$...$` avec antislashs doublés dans le JSON.

## 5. Valider

```bash
node scripts/build-index.js
```

Corriger jusqu'à ce que le script passe.

## 6. Fiche de révision

Écrire `fiches/<matiere>/<dossier>.html` sur le modèle des fiches existantes (même structure : en-tête, encadré « À retenir en priorité », sections numérotées, tableaux, encadrés `methode` pour chaque type de calcul avec un exemple chiffré vérifié par script, `piege`, `astuce`). Viser 2 à 5 pages A4. Puis :

```bash
node scripts/build-fiches.js <dossier>
node scripts/build-index.js
```

Rendre les pages du PDF en PNG et les relire (débordements, alignement des calculs posés en `<pre>` : n'y mettre que des caractères de largeur fixe).

## 7. Compte rendu

Dire à l'utilisateur : où le PDF a été rangé, le nombre de questions (unique / multiple / exercices), les thèmes couverts, et les pages non exploitées ou les points du cours volontairement écartés.
